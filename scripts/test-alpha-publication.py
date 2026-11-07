"""Screen the staged alpha and outgoing Git objects; this is not a secrets audit of all history."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--base', required=True, help='Verified existing destination commit or ref')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
def indexed(name):
    return git('show', ':' + name)
sha = lambda b: hashlib.sha256(b).hexdigest()
manifest = json.loads(indexed('source-manifest.json'))
assert manifest['version'] == '0.7.0-alpha.1' and manifest['profile'] == 'three-r3f-alpha'
paths = list(filter(None, git('ls-files', '-z').decode().split('\0')))
assert set(manifest['files']) == set(paths) - {'source-manifest.json', 'distribution-manifest.json'}
for name, expected in manifest['files'].items():
    data = indexed(name)
    assert {'bytes': len(data), 'sha256': sha(data)} == expected, name
descriptor = json.loads(indexed('distribution-manifest.json'))
assert descriptor['version'] == '0.7.0-alpha.1' and descriptor['containsPrivatePatientImaging'] is False
assert descriptor['approvedPublicResearchFixtures'] == ['H000']
assert b'KennethJSmithDev' in indexed('.github/FUNDING.yml')
for name in paths:
    if name.startswith('.github/workflows/') and name.endswith(('.yml', '.yaml')):
        text = indexed(name).decode()
        triggers = text.split('\non:', 1)[1].split('\npermissions:', 1)[0]
        assert 'workflow_dispatch:' in triggers
        assert not re.search(r'^  (push|pull_request|schedule|workflow_run):', triggers, re.M), name
pages = indexed('.github/workflows/pages-demo.yml').decode()
assert "github.ref == 'refs/heads/main'" in pages
assert 'prototypes/alpha' in pages and 'deploy-pages@' in pages

changed = list(filter(None, git('diff', '--cached', '--name-only', '--diff-filter=AM', args.base, '-z').decode().split('\0')))
blocked = re.compile(r'(^|/)(\.staging|\.secrets|node_modules|__pycache__)(/|$)|\.(dcm|iso|log|env|pyc)$', re.I)
secrets = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-proj-[A-Za-z0-9_-]{30,}')
private_paths = []
for name in changed:
    assert not blocked.search(name), name
    data = indexed(name)
    assert not secrets.search(data), 'Secret-shaped content: ' + name
    if Path(name).suffix.lower() in {'.md', '.json', '.txt', '.html', '.yml', '.yaml'}:
        if re.search(rb'[CD]:[\\/](?:Users|DICOM3D|AI)[\\/]', data, re.I):
            private_paths.append(name)
assert not private_paths, 'Review local path disclosure: ' + ', '.join(private_paths)

# Check every newly reachable object, including superseded commits in the push.
objects = git('rev-list', '--objects', args.base + '..HEAD')
sizes = subprocess.check_output(['git', 'cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize) %(rest)'], input=objects, cwd=root).decode().splitlines()
blobs = [line.split(' ', 3) for line in sizes if ' blob ' in line]
assert all(int(fields[2]) < 100_000_000 for fields in blobs), 'Oversized ordinary Git object in outgoing ancestry'
print(json.dumps({'status':'PASS', 'version':manifest['version'], 'indexedFiles':len(paths),
                  'changedFilesScreened':len(changed), 'outgoingBlobs':len(blobs),
                  'largestOutgoingBlobBytes':max([int(b[2]) for b in blobs], default=0),
                  'manualOnlyWorkflows':True, 'sponsorsPreserved':True,
                  'limits':'Exact inventory, explicit path and high-confidence secret patterns; not exhaustive historical or medical privacy certification'}))
