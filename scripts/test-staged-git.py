"""Regression tests for staged-byte hashing and concurrent index replacement."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

from staged_git import StagedBlobReader


def identity(data):
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


class StagedGitTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='dicom3d-git-reader-')
        self.root = Path(self.tmp.name)
        env = dict(os.environ)
        for key in ('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR',
                    'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
                    'GIT_REPLACE_REF_BASE', 'GIT_NO_REPLACE_OBJECTS'):
            env.pop(key, None)
        env.update(GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_SYSTEM=os.devnull)
        self.environment = mock.patch.dict(os.environ, env, clear=True)
        self.environment.start()
        self.git('init', '-q')
        (self.root / 'space name.txt').write_bytes(b'original\x00\xff')
        (self.root / 'empty.txt').write_bytes(b'')
        (self.root / 'unicode-\u00e9.txt').write_bytes('source \u2603'.encode())
        self.git('add', '--', 'space name.txt', 'empty.txt', 'unicode-\u00e9.txt')

    def tearDown(self):
        self.environment.stop()
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, stderr=subprocess.PIPE)

    def stage(self, data):
        (self.root / 'space name.txt').write_bytes(data)
        self.git('add', '--', 'space name.txt')

    def test_staged_bytes_empty_unicode_large_and_missing(self):
        (self.root / 'space name.txt').write_bytes(b'unstaged change')
        large = bytes(range(256)) * 4097
        (self.root / 'large.dat').write_bytes(large)
        self.git('add', '--', 'large.dat')
        with StagedBlobReader(self.root) as reader:
            self.assertEqual(reader.digest('space name.txt'), identity(b'original\x00\xff'))
            self.assertEqual(reader.digest('empty.txt'), identity(b''))
            self.assertEqual(reader.digest('unicode-\u00e9.txt'), identity('source \u2603'.encode()))
            self.assertEqual(reader.digest('large.dat'), identity(large))
            with self.assertRaises(subprocess.CalledProcessError):
                reader.digest('missing.txt')

    def test_index_replaced_between_reads(self):
        with StagedBlobReader(self.root) as reader:
            self.assertEqual(reader.digest('space name.txt'), identity(b'original\x00\xff'))
            old_process = reader.process
            self.stage(b'new staged value')
            self.assertEqual(reader.digest('space name.txt'), identity(b'new staged value'))
            self.assertIsNot(reader.process, old_process)

    def test_index_replaced_during_read_uses_fresh_lookup(self):
        with StagedBlobReader(self.root) as reader:
            original_stamp, calls = reader._lookup_stamp, [0]
            def replace_before_second_stamp():
                calls[0] += 1
                if calls[0] == 2:
                    self.stage(b'concurrently staged')
                return original_stamp()
            with mock.patch.object(reader, '_lookup_stamp', side_effect=replace_before_second_stamp), \
                 mock.patch.object(reader, '_legacy', wraps=reader._legacy) as fallback:
                self.assertEqual(reader.digest('space name.txt'), identity(b'concurrently staged'))
                fallback.assert_called_once_with('space name.txt')

    def test_newline_path_uses_original_lookup(self):
        with StagedBlobReader(self.root) as reader:
            with mock.patch.object(reader, '_legacy', return_value=identity(b'x')) as fallback:
                self.assertEqual(reader.digest('line\nname.txt'), identity(b'x'))
                fallback.assert_called_once_with('line\nname.txt')

    def test_alternate_index_is_respected(self):
        alternate = self.root / 'alternate-index'
        shutil.copyfile(self.root / '.git' / 'index', alternate)
        original = (self.root / '.git' / 'index').read_bytes()
        with mock.patch.dict(os.environ, {'GIT_INDEX_FILE': str(alternate)}):
            self.stage(b'alternate staged content')
            with StagedBlobReader(self.root) as reader:
                self.assertEqual(reader.digest('space name.txt'), identity(b'alternate staged content'))
        self.assertEqual((self.root / '.git' / 'index').read_bytes(), original)

    def test_replacement_refs_added_after_a_batch_read_are_respected(self):
        oid = self.git('rev-parse', ':space name.txt').decode().strip()
        replacement = subprocess.check_output(['git', 'hash-object', '-w', '--stdin'],
                                               cwd=self.root, input=b'replacement').decode().strip()
        with StagedBlobReader(self.root) as reader:
            self.assertEqual(reader.digest('space name.txt'), identity(b'original\x00\xff'))
            self.git('replace', oid, replacement)
            self.assertEqual(reader.digest('space name.txt'), identity(b'replacement'))
            self.assertEqual(reader.digest('space name.txt'), identity(self.git('show', ':space name.txt')))

    def test_unknown_ref_store_uses_original_lookup(self):
        with StagedBlobReader(self.root) as reader:
            reader.legacy_only = True
            with mock.patch.object(reader, '_legacy', wraps=reader._legacy) as fallback:
                self.assertEqual(reader.digest('empty.txt'), identity(b''))
                fallback.assert_called_once_with('empty.txt')

    def test_custom_replacement_namespace_uses_original_lookup(self):
        with mock.patch.dict(os.environ, {'GIT_REPLACE_REF_BASE': 'refs/custom-replacements/'}):
            with StagedBlobReader(self.root) as reader:
                self.assertTrue(reader.legacy_only)
                self.assertEqual(reader.digest('empty.txt'), identity(b''))

    def test_unavailable_file_identity_uses_original_lookup(self):
        with StagedBlobReader(self.root) as reader:
            with mock.patch.object(reader, '_lookup_stamp', return_value=((1,0,1,1,1),None,None)), \
                 mock.patch.object(reader, '_legacy', wraps=reader._legacy) as fallback:
                self.assertEqual(reader.digest('empty.txt'), identity(b''))
                fallback.assert_called_once_with('empty.txt')

    def test_unreadable_metadata_is_treated_as_unknown_identity(self):
        inaccessible = mock.Mock()
        inaccessible.stat.side_effect = PermissionError('synthetic metadata failure')
        self.assertEqual(StagedBlobReader._path_stamp(inaccessible), (0,0,0,0,0))

    def test_inventory_requires_the_shared_reader_to_be_staged(self):
        source = Path(__file__).resolve().parent
        (self.root / 'scripts').mkdir()
        (self.root / 'viewer' / 'src').mkdir(parents=True)
        for name in ('update-source-manifest.py', 'staged_git.py'):
            shutil.copyfile(source / name, self.root / 'scripts' / name)
        shutil.copyfile(source.parent / 'viewer' / 'src' / 'public-h000-admission.mjs',
                        self.root / 'viewer' / 'src' / 'public-h000-admission.mjs')
        (self.root / 'distribution-manifest.json').write_text(
            '{"version":"0.7.0-alpha.1","frontendProfile":"three-r3f-alpha"}', encoding='utf-8')
        package = self.root / 'prototypes/alpha/three-prototype/package.json'
        package.parent.mkdir(parents=True)
        package.write_text('{"version":"0.7.0-alpha.1"}', encoding='utf-8')
        args = [sys.executable, '-B', 'scripts/update-source-manifest.py', '--profile', 'alpha']
        missing = subprocess.run(args, cwd=self.root, capture_output=True, text=True)
        self.assertNotEqual(missing.returncode, 0)
        self.assertIn('Required staged source missing: scripts/staged_git.py', missing.stderr)
        self.assertFalse((self.root / 'source-manifest.json').exists())
        self.git('add', '--', 'scripts/staged_git.py', 'viewer/src/public-h000-admission.mjs',
                 'distribution-manifest.json', 'prototypes/alpha/three-prototype/package.json')
        present = subprocess.run(args, cwd=self.root, capture_output=True, text=True)
        self.assertEqual(present.returncode, 0, present.stderr)
        package.write_text('{"version":"0.7.0-alpha.2"}', encoding='utf-8')
        self.git('add', '--', 'prototypes/alpha/three-prototype/package.json')
        before = (self.root / 'source-manifest.json').read_bytes()
        mismatch = subprocess.run(args, cwd=self.root, capture_output=True, text=True)
        self.assertNotEqual(mismatch.returncode, 0)
        self.assertEqual((self.root / 'source-manifest.json').read_bytes(), before)
        (self.root / 'distribution-manifest.json').write_text(
            '{"version":"0.7.0-alpha.2","frontendProfile":"three-r3f-alpha"}', encoding='utf-8')
        # Unstaged descriptor must not change the staged source identity.
        unstaged = subprocess.run(args, cwd=self.root, capture_output=True, text=True)
        self.assertNotEqual(unstaged.returncode, 0)
        self.git('add', '--', 'distribution-manifest.json')
        next_version = subprocess.run(args, cwd=self.root, capture_output=True, text=True)
        self.assertEqual(next_version.returncode, 0, next_version.stderr)
        self.assertEqual(json.loads((self.root / 'source-manifest.json').read_text())['version'], '0.7.0-alpha.2')

    def test_unstaged_admission_cannot_authorize_extra_h000(self):
        source = Path(__file__).resolve().parent
        (self.root / 'scripts').mkdir()
        (self.root / 'viewer/src').mkdir(parents=True)
        for name in ('update-source-manifest.py', 'staged_git.py'):
            shutil.copyfile(source / name, self.root / 'scripts' / name)
        admission = self.root / 'viewer/src/public-h000-admission.mjs'
        shutil.copyfile(source.parent / 'viewer/src/public-h000-admission.mjs', admission)
        self.git('add', '--', 'scripts/staged_git.py', 'viewer/src/public-h000-admission.mjs')
        extra = self.root / 'reference/public/demo/h000/private.txt'
        extra.parent.mkdir(parents=True)
        extra.write_text('not public', encoding='utf-8')
        self.git('add', '--', 'reference/public/demo/h000/private.txt')
        admission.write_text('export const APPROVED_H000_ASSETS = {"private.txt": {"bytes":10,"sha256":"'
                             + hashlib.sha256(b'not public').hexdigest() + '"}};', encoding='utf-8')
        result = subprocess.run([sys.executable, '-B', 'scripts/update-source-manifest.py'],
                                cwd=self.root, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Unadmitted source path', result.stderr)
        self.assertFalse((self.root / 'source-manifest.json').exists())

    def test_publication_gate_uses_staged_excluded_hash(self):
        source = Path(__file__).resolve().parent
        (self.root / 'scripts').mkdir()
        (self.root / 'viewer/src').mkdir(parents=True)
        (self.root / 'docs').mkdir()
        shutil.copyfile(source / 'test-publication.mjs', self.root / 'scripts/test-publication.mjs')
        secret = b'synthetic excluded screenshot'
        (self.root / 'docs/renamed.txt').write_bytes(secret)
        release = self.root / 'viewer/src/public-release.mjs'
        release.write_text("export const PUBLIC_RELEASE={release:'0.6.5'}; export const publicBuildProfile=()=>({studyEnabled:false});")
        admission = self.root / 'viewer/src/public-h000-admission.mjs'
        admission.write_text("export const APPROVED_H000_ASSETS={}; export const EXCLUDED_STUDY_SCREENSHOT_SHA256='" + hashlib.sha256(secret).hexdigest() + "';")
        (self.root / 'viewer/package.json').write_text('{"version":"0.6.5"}')
        (self.root / 'distribution-manifest.json').write_text('{}')
        self.git('add', '--', 'scripts/test-publication.mjs', 'viewer', 'docs', 'distribution-manifest.json')
        names = self.git('ls-files', '-z').decode().split('\0')
        files = {name: identity(self.git('show', ':' + name)) for name in names if name and name != 'distribution-manifest.json'}
        (self.root / 'source-manifest.json').write_text(json.dumps({'files':files}))
        self.git('add', '--', 'source-manifest.json')
        admission.write_text("export const APPROVED_H000_ASSETS={}; export const EXCLUDED_STUDY_SCREENSHOT_SHA256='" + '0'*64 + "';")
        result = subprocess.run(['node', 'scripts/test-publication.mjs'], cwd=self.root, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Excluded screenshot under renamed path', result.stderr)

    def test_child_is_closed_on_failure(self):
        child = None
        with self.assertRaisesRegex(RuntimeError, 'synthetic failure'):
            with StagedBlobReader(self.root) as reader:
                reader.digest('empty.txt')
                child = reader.process
                raise RuntimeError('synthetic failure')
        self.assertIsNotNone(child.poll())

    def test_unexpected_child_exit_fails_without_leaking_process(self):
        child = None
        with self.assertRaises((BrokenPipeError, subprocess.CalledProcessError, EOFError)):
            with StagedBlobReader(self.root) as reader:
                reader.digest('empty.txt')
                child = reader.process
                child.kill()
                child.wait(timeout=10)
                reader.digest('empty.txt')
        self.assertIsNotNone(child.poll())


if __name__ == '__main__':
    unittest.main()
