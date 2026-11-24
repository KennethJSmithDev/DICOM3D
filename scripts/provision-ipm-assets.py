"""Provision the immutable 0.8.0 public frontend before installing a split IPM module."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import tarfile
import tempfile
import urllib.parse
import urllib.request

ARCHIVE_SHA256 = '85e4d70697487dedcd9bf9741bcfa09bffa1b3ccbfaf492165ab412b2c67411c'
ARCHIVE_BYTES = 164696501
ARCHIVE_URL = 'https://github.com/KennethJSmithDev/DICOM3D/releases/download/v0.8.0/dicom3d-0.8.0.tgz'
MANIFEST_SHA256 = 'b3cb1ad332ea0c9f9b5ab7db568d12e5537a86013f28eaf260adb998e293b416'
ALLOWED_HOSTS = {'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'}


def no_links(path):
    path = Path(os.path.abspath(path))
    for item in (path, *path.parents):
        if item.is_symlink() or (item.exists() and getattr(item.lstat(), 'st_file_attributes', 0) & 0x400):
            raise ValueError('Linked asset destination refused')


def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url = urllib.parse.urlsplit(newurl)
        if url.scheme != 'https' or url.hostname not in ALLOWED_HOSTS or url.username or url.password:
            raise ValueError('Unexpected asset download redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(path):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), SafeRedirect())
    with opener.open(ARCHIVE_URL, timeout=30) as response, path.open('xb') as out:
        total = 0
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > ARCHIVE_BYTES:
                raise ValueError('Asset download exceeds pinned size')
            out.write(chunk)
    if total != ARCHIVE_BYTES:
        raise ValueError('Incomplete asset download')


def provision(bundle, destination):
    no_links(destination)
    if destination.exists():
        raise FileExistsError('Destination already exists; preserve the installed directory')
    parent = destination.parent.resolve(strict=True)
    no_links(parent)
    # Copy to an owned temporary file and verify the same bytes we will extract.
    with tempfile.TemporaryDirectory(prefix='.dicom3d-ipm-', dir=parent) as temp:
        temp = Path(temp)
        archive = temp / 'assets.tgz'
        if bundle is None:
            download(archive)
        else:
            no_links(bundle)
            if bundle.stat().st_size != ARCHIVE_BYTES:
                raise ValueError('Asset archive has an unexpected size')
            shutil.copyfile(bundle, archive)
        if archive.stat().st_size != ARCHIVE_BYTES or digest(archive) != ARCHIVE_SHA256:
            raise ValueError('Asset archive identity mismatch')
        payload = temp / 'payload'
        payload.mkdir()
        with tarfile.open(archive, 'r:gz') as tar:
            members = [m for m in tar.getmembers() if m.name.startswith('public/')]
            names = [m.name for m in members]
            if len(names) != len(set(names)) or any(not m.isfile() or '..' in PurePosixPath(m.name).parts or '\\' in m.name for m in members):
                raise ValueError('Unsafe asset entries')
            manifests = [m for m in members if m.name == 'public/demo-build-manifest.json']
            if len(manifests) != 1 or manifests[0].size > 2_000_000:
                raise ValueError('Missing asset manifest')
            manifest_bytes = tar.extractfile(manifests[0]).read()
            if hashlib.sha256(manifest_bytes).hexdigest() != MANIFEST_SHA256:
                raise ValueError('Asset manifest identity mismatch')
            manifest = json.loads(manifest_bytes)
            records = manifest['files']
            if set(names) != {'public/' + name for name in records} | {'public/demo-build-manifest.json'}:
                raise ValueError('Asset inventory mismatch')
            for member in members:
                name = member.name.removeprefix('public/')
                if name != 'demo-build-manifest.json' and member.size != records[name]['bytes']:
                    raise ValueError('Asset size mismatch: ' + name)
                out = payload.joinpath(*PurePosixPath(name).parts)
                out.parent.mkdir(parents=True, exist_ok=True)
                h = hashlib.sha256()
                with tar.extractfile(member) as src, out.open('xb') as dst:
                    while chunk := src.read(1024 * 1024):
                        h.update(chunk)
                        dst.write(chunk)
                if name != 'demo-build-manifest.json' and h.hexdigest() != records[name]['sha256']:
                    raise ValueError('Asset hash mismatch: ' + name)
        no_links(destination)
        if destination.exists():
            raise FileExistsError('Destination appeared during provisioning')
        os.rename(payload, destination)
    return {'status': 'PASS', 'files': len(members), 'version': manifest['release'], 'archiveSha256': ARCHIVE_SHA256}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--bundle', type=Path, help='Verified 0.8.0 IPM TGZ for offline setup; omit to download it')
    p.add_argument('--destination', type=Path, required=True, help='New IRIS CSP directory, before IPM installation')
    args = p.parse_args()
    print(json.dumps(provision(args.bundle, args.destination)))


if __name__ == '__main__':
    main()
