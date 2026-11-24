import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
import urllib.request

spec = importlib.util.spec_from_file_location('provision', Path(__file__).with_name('provision-ipm-assets.py'))
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)


class ProvisionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.dest = self.root / 'dicom3d'
        self.addCleanup(self.temp.cleanup)
        self.original = (provision.ARCHIVE_SHA256, provision.ARCHIVE_BYTES, provision.MANIFEST_SHA256)
        self.addCleanup(self.restore)

    def restore(self):
        provision.ARCHIVE_SHA256, provision.ARCHIVE_BYTES, provision.MANIFEST_SHA256 = self.original

    def bundle(self, extra=(), bad_hash=False):
        data = b'public fixture'
        manifest = json.dumps({'release':'fixture', 'files':{'atlas/a.glb':{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}}}).encode()
        provision.MANIFEST_SHA256 = hashlib.sha256(manifest).hexdigest()
        path = self.root / 'bundle.tgz'
        with tarfile.open(path, 'w:gz') as tar:
            for name, content in [('public/demo-build-manifest.json',manifest),('public/atlas/a.glb', data),*extra]:
                entry=tarfile.TarInfo(name);entry.size=len(content);tar.addfile(entry,io.BytesIO(content))
        provision.ARCHIVE_BYTES = path.stat().st_size
        provision.ARCHIVE_SHA256 = '0'*64 if bad_hash else provision.digest(path)
        return path

    def test_success(self):
        result=provision.provision(self.bundle(),self.dest)
        self.assertEqual(result['files'],2)
        self.assertEqual((self.dest/'atlas/a.glb').read_bytes(),b'public fixture')

    def test_tampered_archive_preserves_destination(self):
        with self.assertRaisesRegex(ValueError,'identity mismatch'):
            provision.provision(self.bundle(bad_hash=True),self.dest)
        self.assertFalse(self.dest.exists())

    def test_duplicate_and_traversal_refused(self):
        for extra in ([('public/atlas/a.glb',b'x')],[('public/../escape',b'x')]):
            with self.subTest(extra=extra), self.assertRaisesRegex(ValueError,'Unsafe'):
                provision.provision(self.bundle(extra=extra),self.dest)
            self.assertFalse(self.dest.exists())

    def test_existing_destination_preserved(self):
        archive=self.bundle();self.dest.mkdir();(self.dest/'sentinel').write_text('keep')
        with self.assertRaises(FileExistsError): provision.provision(archive,self.dest)
        self.assertEqual((self.dest/'sentinel').read_text(),'keep')

    def test_untrusted_redirect_refused(self):
        request=urllib.request.Request(provision.ARCHIVE_URL)
        with self.assertRaisesRegex(ValueError,'Unexpected'):
            provision.SafeRedirect().redirect_request(request,None,302,'',{},'https://example.com/asset')


if __name__=='__main__': unittest.main()
