"""Refresh only the generated repository frontend and native FileCopy adapter."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import os
import stat

if not __debug__:
    raise RuntimeError('Frontend admission requires Python assertions')

def no_links(path):
    current = Path(os.path.abspath(path))
    while True:
        try:
            info = current.lstat()
        except FileNotFoundError:
            pass
        else:
            if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
                raise ValueError('Linked or reparse-point path refused: ' + str(current))
        if current.parent == current:
            return
        current = current.parent

def checked_read(path):
    no_links(path)
    data = path.read_bytes()
    no_links(path)
    return data

parser = argparse.ArgumentParser()
parser.add_argument('frontend', type=Path)
parser.add_argument('--profile', choices=('legacy', 'alpha'), default='legacy')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
public = (root / 'public').resolve()
manifest_data = checked_read(args.frontend / 'demo-build-manifest.json')
manifest = json.loads(manifest_data)
if args.profile == 'legacy':
    assert manifest['release'] == '0.6.5' and manifest['entrypoint'] == '/dicom3d/'
    assert not manifest['patientDerivedResearchData'] and not manifest['approvedPublicResearchFixtures']
else:
    assert manifest['schema'] == 'dicom3d-alpha-distribution-1'
    alpha_version = json.loads((root / 'prototypes/alpha/three-prototype/package.json').read_text())['version']
    assert alpha_version in {'0.7.0-alpha.1', '0.7.0-alpha.2', '0.7.0', '0.8.0'}
    assert manifest['release'] == alpha_version and manifest['entrypoint'] == '/dicom3d/reference.html'
    assert manifest['containsPrivatePatientImaging'] is False
    assert manifest['patientDerivedResearchData'] and manifest['approvedPublicResearchFixtures'] == json.loads(checked_read(root / 'distribution-manifest.json'))['approvedPublicResearchFixtures']
assert isinstance(manifest['files'], dict) and 'demo-build-manifest.json' not in manifest['files']
assert len({name.casefold() for name in manifest['files']}) == len(manifest['files'])
files = {**manifest['files'], 'demo-build-manifest.json': {'bytes': len(manifest_data), 'sha256': hashlib.sha256(manifest_data).hexdigest()}}
# Verify all source paths and bytes before writing anything; a null digest is
# never an admission. Keep the verified bytes rather than reopening inputs.
verified = {}
for name, expected in files.items():
    assert isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9_./-]+', name)
    assert all(part not in {'', '.', '..'} for part in name.split('/'))
    assert isinstance(expected, dict) and set(expected) == {'bytes', 'sha256'}
    assert type(expected['bytes']) is int and 0 <= expected['bytes'] < 100000000
    assert isinstance(expected['sha256'], str) and re.fullmatch(r'[a-f0-9]{64}', expected['sha256'])
    data = manifest_data if name == 'demo-build-manifest.json' else checked_read(args.frontend / name)
    assert {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} == expected
    verified[name] = data
old = subprocess.check_output(['git', 'ls-files', '-z', 'public/'], cwd=root).decode().split('\0')
generated_names = set()
for name in files:
    if args.profile == 'alpha':
        assert name in {'index.html', 'reference.html', 'demo-build-manifest.json', 'LICENSE', 'NOTICE', 'distribution-manifest.json'} or re.fullmatch(r'(assets|atlas|female-delta|attribution|reference|third-party|demo/h000)/[A-Za-z0-9_./-]+', name)
        if name in {'attribution/BODYParts3D-NOTICE.txt', 'reference/BODYParts3D-NOTICE.txt'}:
            assert checked_read(root / 'prototypes/alpha/three-prototype/expanded-atlas/LICENSE.md') == verified[name]
        external = name.startswith(('atlas/', 'female-delta/', 'demo/h000/', 'third-party/')) or name in {'LICENSE', 'NOTICE', 'distribution-manifest.json'}
    else:
        external = name.startswith(('reference/', 'brand/', 'third-party/')) or name in {'LICENSE', 'NOTICE'}
        assert external or name in {'index.html', 'reference.html', 'demo-build-manifest.json'} or re.fullmatch(r'assets/[^/]+\.(js|css)', name)
    if not external:
        generated_names.add('public/' + name)
    else:
        if args.profile == 'alpha' and name.startswith('atlas/'):
            canonical = 'prototypes/alpha/three-prototype/expanded-atlas/' + name.removeprefix('atlas/')
        elif args.profile == 'alpha' and name.startswith('female-delta/'):
            canonical = 'prototypes/alpha/three-prototype/atlas-delta/' + name.removeprefix('female-delta/')
        elif args.profile == 'alpha' and name.startswith('demo/h000/'):
            canonical = 'reference/public/' + name
        elif args.profile == 'alpha' and name in {'attribution/BODYParts3D-NOTICE.txt', 'reference/BODYParts3D-NOTICE.txt'}:
            canonical = 'prototypes/alpha/three-prototype/expanded-atlas/LICENSE.md'
        elif args.profile == 'legacy' and name.startswith(('reference/', 'brand/')):
            canonical = 'reference/public/' + name
        else:
            canonical = name
        assert checked_read(root / canonical) == verified[name], f'Canonical asset differs: {canonical}'
assert checked_read(root / 'module.xml').decode('utf-8').count('  <WebApplication Name="/dicom3d"') == 1
assert len(re.findall(r'Parameter VIEWERBUILD = "[^"]+";', checked_read(root / 'src/DICOM3D/Entry.cls').decode('utf-8'))) == 1
assert 'reference.html' in verified
mutations = {name for name in filter(None, old) if name not in generated_names}
mutations.update(generated_names)
mutations.update({'module.xml', 'src/DICOM3D/Entry.cls'})
originals = {}
for name in mutations:
    path = root / name
    no_links(path)
    if path.exists():
        assert path.is_file(), f'Non-file destination: {name}'
        originals[name] = checked_read(path)
        if name.startswith('public/') and name in generated_names and originals[name] == verified[name.removeprefix('public/')]:
            continue
        tracked = subprocess.check_output(['git', 'ls-files', '-z', '--', name], cwd=root).decode().split('\0')
        assert name in tracked, f'Untracked or ignored destination preserved: {name}'
        indexed = subprocess.check_output(['git', 'rev-parse', '--verify', ':' + name], cwd=root).strip()
        actual = subprocess.check_output(['git', 'hash-object', '--path=' + name, '--stdin'], cwd=root, input=originals[name]).strip()
        assert actual == indexed, f'Modified destination preserved: {name}'
        staged = subprocess.run(['git', 'diff', '--cached', '--quiet', '--', name], cwd=root)
        assert staged.returncode == 0, f'Staged destination preserved: {name}'
        status = subprocess.check_output(['git', 'status', '--porcelain=v1', '--untracked-files=all', '--', name], cwd=root)
        assert not status, f'Dirty or untracked destination preserved: {name}'
    else:
        originals[name] = None

def unchanged(name):
    path = root / name
    no_links(path)
    before = originals[name]
    if before is None:
        assert not path.exists(), f'Destination appeared after preflight: {name}'
    else:
        assert path.is_file() and checked_read(path) == before, f'Destination changed after preflight: {name}'
copies = []
generated = set()
for name, expected in sorted(files.items()):
    data = verified[name]
    if args.profile == 'alpha':
        assert name in {'index.html', 'reference.html', 'demo-build-manifest.json', 'LICENSE', 'NOTICE', 'distribution-manifest.json'} or re.fullmatch(r'(assets|atlas|female-delta|attribution|reference|third-party|demo/h000)/[A-Za-z0-9_./-]+', name)
        assert '..' not in Path(name).parts
        # Reuse canonical admitted geometry; only compiled shell files are generated.
        if name.startswith('atlas/'):
            source = 'prototypes/alpha/three-prototype/expanded-atlas/' + name.removeprefix('atlas/')
        elif name.startswith('female-delta/'):
            source = 'prototypes/alpha/three-prototype/atlas-delta/' + name.removeprefix('female-delta/')
        elif name.startswith('demo/h000/'):
            source = 'reference/public/' + name
        elif name in {'LICENSE', 'NOTICE', 'distribution-manifest.json'} or name.startswith('third-party/'):
            source = name
        else:
            source = 'public/' + name
            destination = root / source
            no_links(destination)
            assert destination.resolve().is_relative_to(public)
            unchanged(source)
            destination.parent.mkdir(parents=True, exist_ok=True)
            if originals[source] != data:
                destination.write_bytes(data)
            generated.add(source)
    elif name.startswith(('reference/', 'brand/')):
        source = 'reference/public/' + name
    elif name in {'LICENSE', 'NOTICE'} or name.startswith('third-party/'):
        source = name
    else:
        assert name in {'index.html', 'reference.html', 'demo-build-manifest.json'} or re.fullmatch(r'assets/[^/]+\.(js|css)', name)
        source = 'public/' + name
        destination = root / source
        no_links(destination)
        assert destination.resolve().is_relative_to(public)
        unchanged(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if originals[source] != data:
            destination.write_bytes(data)
        generated.add(source)
    if not source.startswith('public/'):
        assert checked_read(root / source) == data, f'Canonical asset differs: {source}'
    copies.append(f'  <FileCopy Name="{source}" Target="{{$cspdir}}dicom3d/{name}" />')
# Only superseded tracked generated files under the named public root are removed.
for name in filter(None, old):
    if name not in generated:
        destination = root / name
        no_links(destination)
        assert destination.resolve().is_relative_to(public)
        unchanged(name)
        destination.unlink(missing_ok=True)
module = (root / 'module.xml').read_text(encoding='utf-8')
module = re.sub(r'(?m)^\s*<FileCopy Name="[^\r\n]+\r?\n', '', module)
module = module.replace('  <WebApplication Name="/dicom3d"', '\n'.join(copies) + '\n  <WebApplication Name="/dicom3d"')
unchanged('module.xml')
(root / 'module.xml').write_bytes(module.encode('utf-8'))
entry = root / 'src/DICOM3D/Entry.cls'
value = hashlib.sha256(verified['reference.html']).hexdigest()
text, count = re.subn(r'Parameter VIEWERBUILD = "[^"]+";', f'Parameter VIEWERBUILD = "{value}";', entry.read_text(encoding='utf-8'))
assert count == 1
unchanged('src/DICOM3D/Entry.cls')
entry.write_bytes(text.encode('utf-8'))
print(json.dumps({'fileCopyTargets': len(copies), 'generatedFiles': len(generated), 'viewerBuild': value}))
