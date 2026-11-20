"""Refresh packaging source inventory from explicit staged Git objects."""
from pathlib import Path
import json
import re
import subprocess
import argparse
import base64
from staged_git import StagedBlobReader

parser = argparse.ArgumentParser()
parser.add_argument('--profile', choices=('legacy', 'alpha'), default='legacy')
args = parser.parse_args()

root = Path(__file__).resolve().parents[1]
entries = subprocess.check_output(['git', 'ls-files', '--stage', '-z'], cwd=root).decode().split('\0')
names = []
for entry in filter(None, entries):
    info, name = entry.split('\t', 1)
    mode, _, stage = info.split(' ')
    if stage != '0' or mode not in {'100644', '100755'}:
        raise ValueError('Unmerged or non-regular staged source: ' + name)
    names.append(name)
if 'scripts/staged_git.py' not in names:
    raise ValueError('Required staged source missing: scripts/staged_git.py')
# Only the five H000 files named by the owner admission may enter this inventory;
# the legacy Core archive continues to exclude all demo/h000 paths.
admission_path = 'viewer/src/public-h000-admission.mjs'
if admission_path not in names:
    raise ValueError('Required staged admission missing: ' + admission_path)
staged_admission = subprocess.check_output(['git', 'show', ':' + admission_path], cwd=root)
approved_h000 = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    "const m = await import('data:text/javascript;base64,' + process.argv[1]); console.log(JSON.stringify(m.APPROVED_H000_ASSETS));",
    base64.b64encode(staged_admission).decode('ascii')], cwd=root))
files = {}
with StagedBlobReader(root) as staged:
    for name in sorted(filter(None, names)):
        if name in {'source-manifest.json', 'distribution-manifest.json'}:
            continue
        admitted = name.startswith('reference/public/demo/h000/') and name.removeprefix('reference/public/demo/h000/') in approved_h000
        if not admitted and re.search(r'reference/public/demo/|study-docked|\.(dcm|npy|npz|bin|raw16)$|(^|/)\.secrets/', name, re.I):
            raise ValueError('Unadmitted source path: ' + name)
        files[name] = staged.digest(name)
        if admitted and files[name] != approved_h000[name.removeprefix('reference/public/demo/h000/')]:
            raise ValueError('Owner-admitted source bytes changed: ' + name)
manifest = {
    'distribution': 'DICOM3D v0.6.5 source inventory', 'version': '0.6.5',
    'publishedWebCommit': 'd3490dd659e19e44b8800abe87bbc626f45350a2',
    'originalTag': 'v0.6.0', 'originalTagContainsInstallationCompletion': False,
    'commitBinding': 'The external release/artifact manifest identifies the later exact packaging commit. This inventory excludes itself and distribution-manifest.json to avoid circular hashes.',
    'files': files,
}
if args.profile == 'alpha':
    alpha_package = json.loads(subprocess.check_output(['git', 'show', ':prototypes/alpha/three-prototype/package.json'], cwd=root))
    alpha_version = alpha_package['version']
    if alpha_version not in {'0.7.0-alpha.1', '0.7.0-alpha.2', '0.7.0'}:
        raise ValueError('Unreviewed alpha version')
    manifest.update(distribution=f'DICOM3D v{alpha_version} source inventory', version=alpha_version,
                    profile='three-r3f-alpha')
    # Historical release identities belong to the legacy inventory, not this candidate.
    for key in ['publishedWebCommit', 'originalTag', 'originalTagContainsInstallationCompletion']:
        manifest.pop(key)
    descriptor = json.loads(subprocess.check_output(['git', 'show', ':distribution-manifest.json'], cwd=root))
    if descriptor['version'] != alpha_version or descriptor['frontendProfile'] != 'three-r3f-alpha':
        raise ValueError('Source and distribution versions differ')
(root / 'source-manifest.json').write_bytes((json.dumps(manifest, indent=2) + '\n').encode('utf-8'))
descriptor = {
    'distribution': 'DICOM3D Core', 'version': '0.6.5',
    'publishedWebCommit': 'd3490dd659e19e44b8800abe87bbc626f45350a2',
    'originalTag': 'v0.6.0', 'originalTagContainsInstallationCompletion': False,
    'entrypoint': '/dicom3d/reference.html', 'requiresIRIS': False,
    'containsPatientImaging': False,
    'baseImage': 'node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f',
    'commitBinding': 'Source descriptor only. archive-core.py generates the exact distributed input inventory and packaging commit binding.',
}
if args.profile == 'legacy':
    (root / 'distribution-manifest.json').write_bytes((json.dumps(descriptor, indent=2) + '\n').encode('utf-8'))
print(json.dumps({'files': len(files), 'bytes': sum(f['bytes'] for f in files.values())}))
