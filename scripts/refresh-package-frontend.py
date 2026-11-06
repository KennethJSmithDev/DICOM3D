"""Refresh only the generated repository frontend and native FileCopy adapter."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('frontend', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
public = (root / 'public').resolve()
manifest = json.loads((args.frontend / 'demo-build-manifest.json').read_text())
assert manifest['release'] == '0.6.5' and manifest['entrypoint'] == '/dicom3d/'
assert not manifest['patientDerivedResearchData'] and not manifest['approvedPublicResearchFixtures']
files = {**manifest['files'], 'demo-build-manifest.json': None}
copies = []
generated = set()
for name, expected in sorted(files.items()):
    data = (args.frontend / name).read_bytes()
    if expected:
        assert {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} == expected
    if name.startswith(('reference/', 'brand/')):
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
        destination.unlink()
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
