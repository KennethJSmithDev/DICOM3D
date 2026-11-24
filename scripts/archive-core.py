"""Freeze inventoried Core inputs; no build, downloads or Docker mutation."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MODERN_CORE = {'0.7.0', '0.8.0'}
CORE_RUNTIME = {
    'docker/core/server.mjs', 'docker/core/fhir-loopback-route.mjs',
    'docker/core/fhir-configured-metadata.mjs', 'prototypes/alpha/viewer/src/fhir-capability-model.mjs',
}
CORE_BUILD = {
    'scripts/build-alpha-distribution.mjs', 'scripts/test-alpha-distribution.mjs',
    'scripts/admitted-public-files.mjs', 'scripts/admitted-notices.json', 'scripts/preview-verified-file.mjs',
}
PREVIEW_BUILD_INPUTS = {
    'scripts/preview-static.mjs', 'scripts/live-h000-ct.mjs', 'scripts/live-native-images.mjs','scripts/live-rle.mjs',
}
CORE_DOCS = {'docs/INSTALL_070.md', 'docs/FHIR_INTEROP_ALPHA2.md', 'docs/SMART_SYNTHETIC_FOUNDATION.md'}
FRONTEND_SOURCE_TREES = ('prototypes/alpha/three-prototype/src/', 'prototypes/alpha/viewer/src/')
H000_INPUTS = {
    'reference/public/demo/h000/' + name
    for name in ('ct.npy.bin', 'mask.npy.bin', 'lesion.glb', 'NOTICE.md', 'source-binding.json')
}
CORE_SOURCE_TREES = (
    *FRONTEND_SOURCE_TREES, 'prototypes/alpha/three-prototype/atlas-delta/',
    'prototypes/alpha/three-prototype/expanded-atlas/', 'third-party/',
)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def record(data):
    return {'bytes': len(data), 'sha256': sha(data)}

def write_archive(output, files):
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    with output.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    with output.with_suffix(output.suffix + '.sha256').open('x', encoding='utf-8') as stream:
        stream.write(digest + '  ' + output.name + '\n')
    return {'archive': str(output), 'bytes': output.stat().st_size, 'sha256': digest}

def approved_path(name, admitted_binary=()):
    return (re.fullmatch(r'[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*', name)
            and not set(name.split('/')) & {'.', '..'}
            and not re.search(r'(^|/)(\.secrets|\.staging|node_modules|[^/]+-fixture)(/|$)|study-docked', name, re.I)
            and (name in admitted_binary or not re.search(r'\.(dcm|npy|npz|bin|raw16|iso)$', name, re.I)))

def read_regular(root, name):
    path = root / name
    if path.resolve(strict=True) != path or not path.is_file():
        raise ValueError('Input must be a regular file inside its inventory: ' + name)
    return path.read_bytes()

def candidate_payload(build, expected_hash):
    """Read a known build manifest and bind exact standalone runtime bytes."""
    root = build.resolve(strict=True)
    manifest_bytes = read_regular(root, 'demo-build-manifest.json')
    if sha(manifest_bytes) != expected_hash:
        raise ValueError('Frontend manifest does not match the reviewed SHA-256')
    manifest = json.loads(manifest_bytes)
    if manifest['release'] not in MODERN_CORE:
        raise ValueError('Unsupported standalone Core frontend version')
    subprocess.run(['node', str(ROOT / 'scripts/test-alpha-distribution.mjs'), str(root)], cwd=ROOT, check=True)
    source_inputs = manifest['sourceInputs']
    actual_sources = {
        path.relative_to(ROOT).as_posix() for directory in FRONTEND_SOURCE_TREES
        for path in (ROOT / directory).rglob('*') if path.is_file() or path.is_symlink()
    }
    declared_sources = {name for name in source_inputs if name.startswith(FRONTEND_SOURCE_TREES)}
    if actual_sources != declared_sources:
        raise ValueError('Frontend source file set changed since the reviewed build')
    for name, digest in source_inputs.items():
        if not approved_path(name) or sha(read_regular(ROOT, name)) != digest:
            raise ValueError('Build input changed: ' + name)
    if sha(read_regular(ROOT, 'distribution-manifest.json')) != sha(read_regular(root, 'distribution-manifest.json')):
        raise ValueError('Frontend distribution descriptor differs from current source')
    admitted_binary = {name.removeprefix('reference/public/') for name in H000_INPUTS}
    files = {'public/demo-build-manifest.json': manifest_bytes}
    for name, expected in manifest['files'].items():
        if not approved_path(name, admitted_binary):
            raise ValueError('Unexpected public package path: ' + name)
        if name.startswith('demo/') and name not in admitted_binary:
            raise ValueError('Unadmitted public fixture: ' + name)
        data = read_regular(root, name)
        if record(data) != expected:
            raise ValueError('Frontend changed while reading: ' + name)
        files['public/' + name] = data
    for name in CORE_RUNTIME | {'docs/INSTALL_CORE.md', 'LICENSE', 'NOTICE'}:
        files[name] = read_regular(ROOT, name)
    files['README.md'] = (
        '# DICOM3D Core ' + manifest['release'] + '\n\n'
        'With Node.js 24, run the command below here and open the printed loopback link.\n\n'
        '    node docker/core/server.mjs --local\n\n'
        'See [Core installation](docs/INSTALL_CORE.md) for scope and shutdown.\n'
    ).encode()
    return manifest, files

def modern_source_payload(source, source_bytes, frozen, tree, commit):
    version = source['version']
    descriptor_bytes = frozen('distribution-manifest.json')
    descriptor = json.loads(descriptor_bytes)
    if (source.get('profile') != 'three-r3f-alpha' or descriptor.get('frontendProfile') != source['profile']
            or descriptor.get('version') != version or descriptor.get('containsPrivatePatientImaging') is not False
            or descriptor.get('approvedPublicResearchFixtures') != ['H000', 'H001']):
        raise ValueError('Core distribution or source profile mismatch')
    package_base = 'prototypes/alpha/three-prototype/'
    if json.loads(frozen(package_base + 'package.json')).get('version') != version:
        raise ValueError('Core frontend package version mismatch')
    selected = CORE_RUNTIME | CORE_BUILD | CORE_DOCS | H000_INPUTS | {
        'Dockerfile.core', 'Dockerfile.core.offline', 'compose.core.yaml', '.env.core.example', '.dockerignore',
        'LICENSE', 'NOTICE', 'README.md', 'scripts/archive-core.py',
    } | {package_base + name for name in ('package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'build-public-review.mjs')}
    if version == '0.8.0':
        selected |= PREVIEW_BUILD_INPUTS | {'docs/INSTALL_CORE.md'}
    # Enumerate committed inputs independently so a stale inventory fails closed.
    selected |= {name for name in tree if name.startswith(CORE_SOURCE_TREES)}
    identity = source['files']
    files = {}
    for name in sorted(selected):
        if not approved_path(name, H000_INPUTS) or tree.get(name) not in ('100644', '100755'):
            raise ValueError('Nonregular or unadmitted Core source: ' + name)
        if name not in identity:
            raise ValueError('Core source is absent from committed inventory: ' + name)
        data = frozen(name)
        if record(data) != identity[name]:
            raise ValueError('Core source inventory mismatch: ' + name)
        files[name] = data
    files['distribution-manifest.json'] = descriptor_bytes
    files['source-manifest.json'] = source_bytes
    receipt = {
        'distribution': 'DICOM3D Core build inputs', 'version': version, 'sourceGitHead': commit,
        'entrypoint': descriptor['entrypoint'], 'baseImage': descriptor['baseImage'], 'requiresIRIS': False,
        'containsPrivatePatientImaging': False, 'approvedPublicResearchFixtures': ['H000', 'H001'],
        'publicationApproved': False, 'qualification': 'Requires separate exact-artifact qualification',
        'files': {name: record(data) for name, data in sorted(files.items())},
    }
    return {**files, 'core-package-manifest.json': (json.dumps(receipt, indent=2) + '\n').encode()}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--source-commit')
    mode.add_argument('--candidate-build', type=Path)
    parser.add_argument('--build-manifest-sha256')
    args = parser.parse_args()
    if args.output.exists() or args.output.with_suffix(args.output.suffix + '.sha256').exists():
        parser.error('Refusing to overwrite an archive')
    if args.candidate_build:
        if not re.fullmatch(r'[0-9a-f]{64}', args.build_manifest_sha256 or ''):
            parser.error('An exact reviewed frontend manifest hash is required for a candidate build')
        frontend, files = candidate_payload(args.candidate_build, args.build_manifest_sha256)
        candidate = {
            'distribution': 'DICOM3D Core standalone candidate', 'version': frontend['release'],
            'frontendManifestSha256': args.build_manifest_sha256, 'frontendSourceBase': frontend['sourceBase'],
            'requiresIRIS': False, 'containsPrivatePatientImaging': False, 'publicationApproved': False,
            'qualification': 'Requires separate exact-artifact qualification',
            'files': {name: record(data) for name, data in sorted(files.items())},
        }
        files['core-package-manifest.json'] = (json.dumps(candidate, indent=2) + '\n').encode()
        print(json.dumps({**write_archive(args.output, files), 'version': frontend['release'],
                          'frontendManifestSha256': args.build_manifest_sha256, 'files': len(files)}))
        return
    if args.build_manifest_sha256:
        parser.error('--build-manifest-sha256 is only for --candidate-build')
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
    if source['version'] in MODERN_CORE:
        raw_tree = subprocess.check_output(['git', 'ls-tree', '-rz', '--full-tree', args.source_commit], cwd=ROOT)
        tree = {name.decode(): metadata.split()[0].decode() for metadata, name in
                (entry.split(b'\t', 1) for entry in raw_tree.split(b'\0') if entry)}
        files = modern_source_payload(source, source_bytes, frozen, tree, args.source_commit)
        print(json.dumps({**write_archive(args.output, files), 'sourceCommit': args.source_commit,
                          'version': source['version'], 'files': len(files)}))
        return
    if source['version'] != '0.6.5':
        raise ValueError('Unsupported Core source version')
    singles = {
        'Dockerfile.core', 'Dockerfile.core.offline', 'compose.core.yaml', '.env.core.example', '.dockerignore',
        'LICENSE', 'NOTICE', 'README.md', 'CHANGELOG.md', 'ROADMAP.md',
        'Dockerfile.iris-dev', 'compose.iris-dev.yaml', 'docker/core/server.mjs',
        'scripts/archive-core.py', 'scripts/archive-static.py', 'scripts/build-demo.mjs', 'scripts/test-demo.mjs',
        'docs/RELEASE_CANDIDATE_065.md', 'docs/INTEROPERABILITY_065.md', 'docs/ANATOMY_REFERENCE_CAPABILITY.md', 'scripts/map-reference-owners.py', 'scripts/preview-static.mjs', 'scripts/open-preview.ps1', 'scripts/stop-preview.ps1', 'scripts/test-reference-hierarchy.mjs', 'scripts/test-public-reference-visual.mjs',
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
    selected.discard('docs/H002_CANDIDATE.md')  # This qualification predates the Core distribution.
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
    print(json.dumps({**write_archive(args.output, files), 'sourceCommit': args.source_commit,
                      'sourceIdentitySha256': manifest['sourceIdentitySha256'], 'files': len(files)}))

if __name__ == '__main__':
    main()
