"""Focused tests use an isolated synthetic repository; no study data."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('refresh-package-frontend.py')

class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='dicom3d-refresh-test-')
        self.root = Path(self.tmp.name)
        for name in ('scripts', 'public/assets', 'src/DICOM3D', 'frontend/assets'):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SCRIPT, self.root / 'scripts/refresh-package-frontend.py')
        (self.root / 'module.xml').write_text('<Export>\n  <WebApplication Name="/dicom3d" />\n</Export>\n')
        (self.root / 'src/DICOM3D/Entry.cls').write_text('Parameter VIEWERBUILD = "old";\n')
        (self.root / 'public/assets/old.js').write_text('old content')
        (self.root / 'LICENSE').write_text('approved license')
        for name in ('index.html', 'reference.html', 'assets/new.js'):
            (self.root / 'frontend' / name).write_text('content ' + name)
        self.manifest = {'release':'0.6.5', 'entrypoint':'/dicom3d/', 'patientDerivedResearchData':False, 'approvedPublicResearchFixtures':[], 'files':{}}
        self.set_records('index.html', 'reference.html', 'assets/new.js')
        self.git('init', '-q')
        self.git('config', 'user.name', 'Synthetic Test')
        self.git('config', 'user.email', 'test@example.invalid')
        self.git('add', '--', 'scripts', 'public', 'src', 'module.xml', 'LICENSE')
        self.git('commit', '-qm', 'fixture')

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        subprocess.run(['git', *args], cwd=self.root, check=True, capture_output=True)

    def set_records(self, *names):
        for name in names:
            data = (self.root / 'frontend' / name).read_bytes()
            self.manifest['files'][name] = {'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
        (self.root / 'frontend/demo-build-manifest.json').write_text(json.dumps(self.manifest))

    def run_refresh(self, *python_args):
        return subprocess.run([sys.executable, *python_args, 'scripts/refresh-package-frontend.py', str(self.root / 'frontend')], cwd=self.root, capture_output=True, text=True)

    def test_valid_refresh_and_clean_stale_output(self):
        result = self.run_refresh()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.root / 'public/assets/old.js').exists())
        self.assertEqual((self.root / 'public/assets/new.js').read_text(), 'content assets/new.js')

    def test_dirty_stale_file_and_dirty_module_are_preserved(self):
        stale = self.root / 'public/assets/old.js'
        stale.write_text('user work')
        result = self.run_refresh()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(stale.read_text(), 'user work')
        self.assertFalse((self.root / 'public/assets/new.js').exists())
        stale.write_text('old content')
        (self.root / 'module.xml').write_text('user module work')
        self.assertNotEqual(self.run_refresh().returncode, 0)
        self.assertEqual((self.root / 'module.xml').read_text(), 'user module work')

    def test_null_digest_and_traversal_are_rejected_before_writes(self):
        self.manifest['files']['assets/new.js'] = None
        (self.root / 'frontend/demo-build-manifest.json').write_text(json.dumps(self.manifest))
        self.assertNotEqual(self.run_refresh().returncode, 0)
        self.assertTrue((self.root / 'public/assets/old.js').exists())
        self.assertFalse((self.root / 'public/assets/new.js').exists())
        self.set_records('assets/new.js')
        self.manifest['files']['../outside'] = {'bytes': 0, 'sha256': hashlib.sha256(b'').hexdigest()}
        (self.root / 'frontend/demo-build-manifest.json').write_text(json.dumps(self.manifest))
        self.assertNotEqual(self.run_refresh().returncode, 0)

    def test_input_link_is_rejected_when_supported(self):
        original = self.root / 'frontend/assets/new.js'
        target = self.root / 'outside.js'
        target.write_bytes(original.read_bytes())
        original.unlink()
        try:
            original.symlink_to(target)
        except (OSError, NotImplementedError) as error:
            self.skipTest('File links unavailable on this host: ' + str(error))
        result = self.run_refresh()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Linked or reparse-point path refused', result.stderr)
        self.assertFalse((self.root / 'public/assets/new.js').exists())

    @unittest.skipUnless(sys.platform == 'win32', 'Windows junction test')
    def test_input_directory_junction_is_rejected(self):
        assets = self.root / 'frontend/assets'
        actual = self.root / 'frontend/assets-real'
        assets.rename(actual)
        result = subprocess.run(['cmd', '/c', 'mklink', '/J', str(assets), str(actual)], capture_output=True, text=True)
        if result.returncode:
            self.skipTest('Junction creation unavailable: ' + result.stderr)
        result = self.run_refresh()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Linked or reparse-point path refused', result.stderr)
        self.assertFalse((self.root / 'public/assets/new.js').exists())

    def test_canonical_mismatch_does_not_partially_write(self):
        (self.root / 'frontend/LICENSE').write_text('wrong license')
        self.set_records('LICENSE')
        self.assertNotEqual(self.run_refresh().returncode, 0)
        self.assertFalse((self.root / 'public/assets/new.js').exists())
        self.assertTrue((self.root / 'public/assets/old.js').exists())

    def test_assertion_disabled_mode_is_refused(self):
        self.assertNotEqual(self.run_refresh('-O').returncode, 0)

    def test_ignored_and_assume_unchanged_user_files_are_preserved(self):
        (self.root / '.gitignore').write_text('*.local\n')
        private = self.root / 'public/assets/private.local'
        private.write_text('user data')
        (self.root / 'frontend/assets/private.local').write_text('different data')
        self.set_records('assets/private.local')
        self.assertNotEqual(self.run_refresh().returncode, 0)
        self.assertEqual(private.read_text(), 'user data')
        self.manifest['files'].pop('assets/private.local')
        (self.root / 'frontend/demo-build-manifest.json').write_text(json.dumps(self.manifest))
        self.git('update-index', '--assume-unchanged', '--', 'public/assets/old.js')
        stale = self.root / 'public/assets/old.js'
        stale.write_text('hidden user modification')
        self.assertNotEqual(self.run_refresh().returncode, 0)
        self.assertEqual(stale.read_text(), 'hidden user modification')

if __name__ == '__main__':
    unittest.main()
