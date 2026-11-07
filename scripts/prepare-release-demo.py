"""Validate and extract an exact approved release payload; never publish it."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import stat
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def digest_file(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def safe_member(info):
    name = info.filename
    parts = name.rstrip('/').split('/')
    if not name or '\\' in name or name.startswith('/') or any(p in ('', '.', '..') or ':' in p for p in parts):
        raise ValueError('Unsafe archive member')
    if stat.S_ISLNK(info.external_attr >> 16):
        raise ValueError('Archive symlink refused')
    return name

def prepare(archive, output, profile, rebuilt=None):
    pins = json.loads((ROOT / 'docs/releases/070-alpha1-assets.json').read_text(encoding='utf-8'))
    pin = pins[profile]
    if output.exists():
        raise ValueError('Use a fresh output directory')
    if archive.stat().st_size != pin['bytes'] or digest_file(archive) != pin['sha256']:
        raise ValueError('Release archive identity mismatch')
    with zipfile.ZipFile(archive) as z:
        infos = z.infolist()
        names = [safe_member(i) for i in infos]
        if len(set(names)) != len(names) or sum(i.file_size for i in infos) > 1024**3:
            raise ValueError('Duplicate or oversized archive')
        prefix = pin['payloadPrefix']
        manifest = json.loads(z.read(prefix + 'demo-build-manifest.json'))
        if manifest['release'] != pin['release']:
            raise ValueError('Wrong release in archive')
        files = manifest['files']
        expected = set(files) | {'demo-build-manifest.json'}
        actual = {i.filename[len(prefix):] for i in infos if not i.is_dir() and i.filename.startswith(prefix)}
        if actual != expected:
            raise ValueError('Archive payload differs from exact inventory')
        for name, record in files.items():
            data = z.read(prefix + name)
            if len(data) != record['bytes'] or hashlib.sha256(data).hexdigest() != record['sha256']:
                raise ValueError('Payload hash mismatch: ' + name)
        if profile == 'alpha':
            if manifest['schema'] != 'dicom3d-alpha-distribution-1' or manifest['sourceBase'] != pins['qualifiedRuntimeSource']:
                raise ValueError('Wrong qualified alpha source')
            if rebuilt:
                build = json.loads((rebuilt / 'demo-build-manifest.json').read_text(encoding='utf-8'))
                if build['sourceInputs'] != manifest['sourceInputs'] or set(build['files']) != set(files):
                    raise ValueError('Rebuilt application source/inventory changed')
                for name, record in files.items():
                    data = (rebuilt / name).read_bytes()
                    if len(data) != build['files'][name]['bytes'] or hashlib.sha256(data).hexdigest() != build['files'][name]['sha256']:
                        raise ValueError('Rebuilt file differs from its manifest: ' + name)
                    if build['files'][name] == record:
                        continue
                    # Only explicitly reviewed text files may differ by checkout EOL.
                    # Geometry, imaging, JavaScript and arbitrary files remain exact.
                    if name not in pins['rebuildTextEolAllowlist']:
                        raise ValueError('Rebuilt payload changed: ' + name)
                    if data.replace(b'\r\n', b'\n') != z.read(name).replace(b'\r\n', b'\n'):
                        raise ValueError('Rebuilt text content changed: ' + name)
        # Complete every check before writing only the inventoried static payload.
        output.mkdir(parents=True)
        for name in sorted(expected):
            destination = output / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            with z.open(prefix + name) as source, destination.open('xb') as target:
                shutil.copyfileobj(source, target)
    return {'status':'PASS', 'profile':profile, 'release':pin['release'], 'files':len(expected),
            'archiveSha256':pin['sha256'], 'rebuiltCompared':rebuilt is not None,
            'deployment':'NOT PERFORMED'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--profile', choices=('alpha', 'rollback-065'), required=True)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--rebuilt', type=Path)
    args = parser.parse_args()
    print(json.dumps(prepare(args.archive, args.output, args.profile, args.rebuilt)))
