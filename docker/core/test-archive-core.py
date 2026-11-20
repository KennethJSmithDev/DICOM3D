import importlib.util
import json
from pathlib import Path
import unittest

archive_path = Path(__file__).resolve().parents[2] / 'scripts/archive-core.py'
spec = importlib.util.spec_from_file_location('archive_core', archive_path)
archive_core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive_core)


class CoreSourceArchive(unittest.TestCase):
    def inputs(self, version):
        package = 'prototypes/alpha/three-prototype/'
        names = archive_core.CORE_RUNTIME | archive_core.CORE_BUILD | archive_core.CORE_DOCS | archive_core.H000_INPUTS | {
            'Dockerfile.core', 'Dockerfile.core.offline', 'compose.core.yaml', '.env.core.example', '.dockerignore',
            'LICENSE', 'NOTICE', 'README.md', 'scripts/archive-core.py', package + 'src/viewer.jsx',
        } | {package + name for name in ('package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'build-public-review.mjs')}
        if version == '0.8.0':
            names |= archive_core.PREVIEW_BUILD_INPUTS | {'docs/INSTALL_CORE.md'}
        files = {name: name.encode() for name in names}
        files[package + 'package.json'] = json.dumps({'version': version}).encode()
        inventory = {name: archive_core.record(data) for name, data in files.items()}
        files['distribution-manifest.json'] = json.dumps({
            'version': version, 'frontendProfile': 'three-r3f-alpha', 'containsPrivatePatientImaging': False,
            'approvedPublicResearchFixtures': ['H000', 'H001'], 'entrypoint': '/dicom3d/reference.html',
            'baseImage': 'node:24-alpine',
        }).encode()
        source = {'version': version, 'profile': 'three-r3f-alpha', 'files': inventory}
        tree = {name: '100644' for name in files}
        return source, files, tree

    def test_preserves_07_and_08_source_identity(self):
        commit = 'a' * 40
        for version in ('0.7.0', '0.8.0'):
            with self.subTest(version=version):
                inventory, files, tree = self.inputs(version)
                source_bytes = json.dumps(inventory).encode()
                result = archive_core.modern_source_payload(inventory, source_bytes, files.__getitem__, tree, commit)
                receipt = json.loads(result['core-package-manifest.json'])
                self.assertEqual(receipt['sourceGitHead'], commit)
                self.assertFalse(receipt['requiresIRIS'])
                self.assertEqual(receipt['version'], version)
                self.assertEqual(result['source-manifest.json'], source_bytes)
                self.assertEqual(result['distribution-manifest.json'], files['distribution-manifest.json'])
                for name, expected in receipt['files'].items():
                    self.assertEqual(archive_core.record(result[name]), expected)

    def test_rejects_added_source_absent_from_inventory(self):
        inventory, files, tree = self.inputs('0.8.0')
        tree['prototypes/alpha/three-prototype/src/extra.jsx'] = '100644'
        with self.assertRaisesRegex(ValueError, 'absent from committed inventory'):
            archive_core.modern_source_payload(inventory, b'', files.__getitem__, tree, 'a' * 40)

    def test_rejects_admitted_path_that_is_a_symlink(self):
        inventory, files, tree = self.inputs('0.8.0')
        tree['prototypes/alpha/three-prototype/src/viewer.jsx'] = '120000'
        with self.assertRaisesRegex(ValueError, 'Nonregular or unadmitted'):
            archive_core.modern_source_payload(inventory, b'', files.__getitem__, tree, 'a' * 40)

    def test_rejects_wrong_source_bytes_or_descriptor_version(self):
        inventory, files, tree = self.inputs('0.8.0')
        files['README.md'] += b' changed'
        with self.assertRaisesRegex(ValueError, 'Core source inventory mismatch'):
            archive_core.modern_source_payload(inventory, b'', files.__getitem__, tree, 'a' * 40)
        files['distribution-manifest.json'] = files['distribution-manifest.json'].replace(b'0.8.0', b'0.7.0')
        with self.assertRaisesRegex(ValueError, 'Core distribution or source profile mismatch'):
            archive_core.modern_source_payload(inventory, b'', files.__getitem__, tree, 'a' * 40)


if __name__ == '__main__':
    unittest.main()
