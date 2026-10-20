"""Refresh packaging source inventory from explicit staged Git objects."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
names = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
files = {}
for name in sorted(filter(None, names)):
    if name in {'source-manifest.json', 'distribution-manifest.json'}:
        continue
    if re.search(r'reference/public/demo/|study-docked|\.(dcm|npy|npz|bin)$|(^|/)\.secrets/', name, re.I):
        raise ValueError('Unadmitted source path: ' + name)
    if (root / name).is_symlink():
        raise ValueError('Source symlink: ' + name)
    data = subprocess.check_output(['git', 'show', ':' + name], cwd=root)
    files[name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
manifest = {
    'distribution': 'DICOM3D v0.6.0 installation packaging source', 'version': '0.6.0',
    'publishedWebCommit': 'd3490dd659e19e44b8800abe87bbc626f45350a2',
    'originalTag': 'v0.6.0', 'originalTagContainsInstallationCompletion': False,
    'commitBinding': 'The external release/artifact manifest identifies the later exact packaging commit. This inventory excludes itself and distribution-manifest.json to avoid circular hashes.',
    'files': files,
}
(root / 'source-manifest.json').write_bytes((json.dumps(manifest, indent=2) + '\n').encode('utf-8'))
descriptor = {
    'distribution': 'DICOM3D Core', 'version': '0.6.0',
    'publishedWebCommit': manifest['publishedWebCommit'],
    'originalTag': 'v0.6.0', 'originalTagContainsInstallationCompletion': False,
    'entrypoint': '/dicom3d/reference.html', 'requiresIRIS': False,
    'containsPatientImaging': False,
    'baseImage': 'node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f',
    'commitBinding': 'Source descriptor only. archive-core.py generates the exact distributed input inventory and packaging commit binding.',
}
(root / 'distribution-manifest.json').write_bytes((json.dumps(descriptor, indent=2) + '\n').encode('utf-8'))
print(json.dumps({'files': len(files), 'bytes': sum(f['bytes'] for f in files.values())}))
