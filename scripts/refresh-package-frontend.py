"""Refresh only the generated repository frontend and native FileCopy adapter."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('frontend', type=Path)
parser.add_argument('--profile', choices=('legacy', 'alpha'), default='legacy')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
public = (root / 'public').resolve()
manifest = json.loads((args.frontend / 'demo-build-manifest.json').read_text())
if args.profile == 'legacy':
    assert manifest['release'] == '0.6.5' and manifest['entrypoint'] == '/dicom3d/'
    assert not manifest['patientDerivedResearchData'] and not manifest['approvedPublicResearchFixtures']
else:
    assert manifest['schema'] == 'dicom3d-alpha-distribution-1'
    assert manifest['release'] == '0.7.0-alpha.1' and manifest['entrypoint'] == '/dicom3d/reference.html'
    assert manifest['containsPrivatePatientImaging'] is False
    assert manifest['patientDerivedResearchData'] and manifest['approvedPublicResearchFixtures'] == ['H000']
files = {**manifest['files'], 'demo-build-manifest.json': None}
copies = []
generated = set()
for name, expected in sorted(files.items()):
    data = (args.frontend / name).read_bytes()
    if expected:
        assert {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} == expected
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
        elif name in {'attribution/BODYParts3D-NOTICE.txt', 'reference/BODYParts3D-NOTICE.txt'}:
            source = 'prototypes/alpha/three-prototype/expanded-atlas/LICENSE.md'
        elif name in {'LICENSE', 'NOTICE', 'distribution-manifest.json'} or name.startswith('third-party/'):
            source = name
        else:
            source = 'public/' + name
            destination = (root / source).resolve()
            assert destination.is_relative_to(public)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            generated.add(source)
    elif name.startswith(('reference/', 'brand/')):
        source = 'reference/public/' + name
    elif name in {'LICENSE', 'NOTICE'} or name.startswith('third-party/'):
        source = name
    else:
        assert name in {'index.html', 'reference.html', 'demo-build-manifest.json'} or re.fullmatch(r'assets/[^/]+\.(js|css)', name)
        source = 'public/' + name
        destination = (root / source).resolve()
        assert destination.is_relative_to(public)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        generated.add(source)
    if not source.startswith('public/'):
        assert (root / source).read_bytes().replace(b'\r\n', b'\n') == data.replace(b'\r\n', b'\n')
    copies.append(f'  <FileCopy Name="{source}" Target="{{$cspdir}}dicom3d/{name}" />')
# Only superseded tracked generated files under the named public root are removed.
old = subprocess.check_output(['git', 'ls-files', '-z', 'public/'], cwd=root).decode().split('\0')
for name in filter(None, old):
    if name not in generated:
        destination = (root / name).resolve()
        assert destination.is_relative_to(public) and not destination.is_symlink()
        destination.unlink(missing_ok=True)
module = (root / 'module.xml').read_text(encoding='utf-8')
module = re.sub(r'(?m)^\s*<FileCopy Name="[^\r\n]+\r?\n', '', module)
module = module.replace('  <WebApplication Name="/dicom3d"', '\n'.join(copies) + '\n  <WebApplication Name="/dicom3d"')
(root / 'module.xml').write_bytes(module.encode('utf-8'))
entry = root / 'src/DICOM3D/Entry.cls'
value = hashlib.sha256((args.frontend / 'reference.html').read_bytes()).hexdigest()
text, count = re.subn(r'Parameter VIEWERBUILD = "[^"]+";', f'Parameter VIEWERBUILD = "{value}";', entry.read_text(encoding='utf-8'))
assert count == 1
entry.write_bytes(text.encode('utf-8'))
print(json.dumps({'fileCopyTargets': len(copies), 'generatedFiles': len(generated), 'viewerBuild': value}))
