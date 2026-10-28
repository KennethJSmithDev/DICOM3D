"""Freeze inventoried Core inputs; no build, downloads or Docker mutation."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source-commit', required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Refusing to overwrite an archive')
    if not re.fullmatch(r'[0-9a-f]{40}', args.source_commit):
        parser.error('An exact packaging source commit is required')
    # Freeze the exact committed objects, not Windows checkout newline variants.
    # WHY: source-manifest hashes staged Git bytes; CRLF worktree bytes can differ.
    # INVARIANT: no dirty or unrelated work silently enters a named source archive.
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip()
    if head != args.source_commit:
        raise ValueError('Archive identity must name this exact source HEAD')
    def frozen(name):
        return subprocess.check_output(['git', 'show', args.source_commit + ':' + name], cwd=ROOT)
    source_bytes = frozen('source-manifest.json')
    source = json.loads(source_bytes)
    assert source['version'] == '0.6.5'
    singles = {
        'Dockerfile.core', 'compose.core.yaml', '.env.core.example', '.dockerignore',
        'LICENSE', 'NOTICE', 'README.md', 'CHANGELOG.md', 'ROADMAP.md',
        'Dockerfile.iris-dev', 'compose.iris-dev.yaml', 'docker/core/server.mjs',
        'scripts/archive-core.py', 'scripts/archive-static.py', 'scripts/build-demo.mjs', 'scripts/test-demo.mjs',
        'docs/RELEASE_CANDIDATE_065.md', 'docs/INTEROPERABILITY_065.md', 'docs/ANATOMY_REFERENCE_CAPABILITY.md', 'docs/MOBILE_HANDOFF_065.md', 'scripts/map-reference-owners.py', 'scripts/preview-static.mjs', 'scripts/open-preview.ps1', 'scripts/stop-preview.ps1', 'scripts/test-reference-hierarchy.mjs', 'scripts/test-public-reference-visual.mjs',
    }
    admitted_reference = {
        'reference/public/reference/' + name for name in [
            'bp3d-male.glb', 'bp3d-male.manifest.json', 'bp3d-source-members.json',
            'BODYParts3D-NOTICE.txt', 'hra-female.glb.part001', 'hra-female.glb.part002', 'hra-female.glb.part003', 'hra-female.manifest.json',
            'HRA-FEMALE-NOTICE.txt', 'anatomy-source-catalog.json', 'anatomy-admission.json', 'anatomy-owner-map.json']
    } | {'reference/public/brand/favicon.svg', 'reference/public/brand/semantic-cube.svg'}
    selected = singles | admitted_reference | {
        name for name in source['files'] if name.startswith(('viewer/', 'third-party/', 'docs/', 'assets/branding/', 'reference/metadata/'))
    }
    selected.discard('docs/H002_CANDIDATE.md')  # Historical machine-local paths stay in the source repository.
    files = {}
    for name in sorted(selected):
        if name not in source['files']:
            raise ValueError('Uninventoried source: ' + name)
        if re.search(r'(^|/)(\.secrets|node_modules|demo/h000)(/|$)|study-docked|\.(dcm|npy|npz|bin|raw16)$', name, re.I):
            raise ValueError('Unadmitted data/secret source: ' + name)
        path = ROOT / name
        if path.is_symlink():
            raise ValueError('Source symlink: ' + name)
        data = frozen(name)
        if {'bytes': len(data), 'sha256': sha(data)} != source['files'][name]:
            raise ValueError('Source inventory mismatch: ' + name)
        files[name] = data
    files['source-manifest.json'] = source_bytes
    identity = {name: {'bytes': len(data), 'sha256': sha(data)} for name, data in sorted(files.items())}
    manifest = {
        'distribution': 'DICOM3D Core', 'version': '0.6.5',
        'sourceGitHead': args.source_commit,
        'publishedWebCommit': 'd3490dd659e19e44b8800abe87bbc626f45350a2',
        'originalTag': 'v0.6.0', 'originalTagContainsInstallationCompletion': False,
        'commitBinding': 'Later packaging commit identified here; original v0.6.0 tag remains immutable. External release manifest binds archive bytes and source snapshot.',
        'sourceIdentitySha256': sha(json.dumps(identity, sort_keys=True, separators=(',', ':')).encode()),
        'baseImage': 'node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f',
        'entrypoint': '/dicom3d/reference.html', 'requiresIRIS': False,
        'containsPatientImaging': False, 'privateReleaseCandidate': True, 'publicationApproved': False,
        'qualification': 'Requires separate exact-artifact qualification receipt',
        'files': identity,
    }
    files['distribution-manifest.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    digest = sha(args.output.read_bytes())
    args.output.with_suffix(args.output.suffix + '.sha256').write_text(digest + '  ' + args.output.name + '\n')
    print(json.dumps({'archive': str(args.output), 'bytes': args.output.stat().st_size,
                      'sha256': digest, 'sourceCommit': args.source_commit,
                      'sourceIdentitySha256': manifest['sourceIdentitySha256'], 'files': len(files)}))

if __name__ == '__main__':
    main()
