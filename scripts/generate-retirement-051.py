"""Generate the bounded native retirement adapter from the exact051 owner map.

The map is derived from the immutable published051 TGZ, minus current FileCopies.
It is installation policy, never a recursive runtime discovery/deletion rule.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
inventory = json.loads((root / 'scripts/retired-filecopy-051.json').read_text())
targets = inventory['files']
assert inventory['sourceArchiveSha256'] == '83b7c207b9c203b29e4ba8e622f2784c8bf7b9d71d8be23606f9ce3533a7cd2d'
assert len(targets) == 204 and sum(r['bytes'] for r in targets.values()) == 1226267
assert all(re.fullmatch(r'assets/[A-Za-z0-9_-]+\.js|reference/(male|female)(\.glb|\.manifest\.json)', n) for n in targets)
assert all(set(r) == {'bytes', 'sha256'} and r['bytes'] > 0 and re.fullmatch(r'[0-9a-f]{64}', r['sha256']) for r in targets.values())
current = {e.attrib['Target'].removeprefix('{$cspdir}dicom3d/') for e in ET.parse(root / 'module.xml').findall('.//FileCopy')}
assert len(current) == 379 and not set(targets) & current
entry = (root / 'src/DICOM3D/Entry.cls').read_text()
viewer_build = re.search(r'Parameter VIEWERBUILD = "([0-9a-f]{64})";', entry)[1]
policy_hash = hashlib.sha256(json.dumps(targets, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
assert policy_hash == '282c8029a22bcc6ab808489fd329ba6e37b66018768e2908c66e8cc1dc3cfb43', 'Retirement owner map differs from the independently verified051 policy'
template = '''/// Exact051 FileCopy retirement; no renderer, source data or permission changes.
Class DICOM3D.InstallMigration Extends %RegisteredObject
{

/// WHY: IPM per-file Activate leaves obsolete051 names behind on upgrade.
/// BOUNDARY: only204 published051 paths/old hashes; privileged maintenance install.
/// INVARIANT: preflight all before any deletion; current379 targets are disjoint.
/// EVIDENCE: scripts/retired-filecopy-051.json and exact native release receipt.
/// REGRESSION: filesystem deletion is not transactional; no concurrent CSP writer.
ClassMethod Retire051(root As %String) As %Status [ Language = python ]
{
    import hashlib, json, os, stat
    import iris

    targets = __TARGETS__
    policy_sha = "__POLICY_SHA__"
    viewer_sha = "__VIEWER_SHA__"
    descriptors = []
    retired = []
    missing = 0
    phase = "preflight"
    try:
        def require(condition, message):
            if not condition:
                raise ValueError(message)

        require(hasattr(os, "O_NOFOLLOW") and hasattr(os, "O_DIRECTORY") and hasattr(os, "O_NONBLOCK"), "host lacks no-follow file operations")
        require(all(fn in os.supports_dir_fd for fn in (os.open, os.stat, os.unlink)), "host lacks directory-relative file operations")
        require(os.stat in os.supports_follow_symlinks, "host lacks no-follow metadata")
        require(hashlib.sha256(json.dumps(targets, sort_keys=True, separators=(",", ":")).encode()).hexdigest() == policy_sha, "retirement policy identity differs")
        logical = os.path.abspath(os.fspath(root))
        expected = os.path.abspath(os.path.join(str(iris.cls("%SYSTEM.Util").InstallDirectory()), "csp", "dicom3d"))
        require(logical == expected, "root differs from IPM CSP ownership")
        # The approved host deliberately aliases this root into its durable volume.
        # Only that root mapping is resolved; child directories/leaves never follow links.
        anchor = os.path.realpath(logical, strict=True)
        require(anchor in (expected, "/durable/dicom3d/csp"), "CSP root alias is not an admitted host mapping")
        root_fd = os.open(anchor, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        descriptors.append(root_fd)
        def identity(s):
            return (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns, s.st_uid, s.st_gid)
        root_identity = identity(os.fstat(root_fd))
        require(stat.S_ISDIR(root_identity[2]), "CSP anchor is not a directory")
        require(os.fstat(root_fd).st_uid == os.geteuid(), "CSP anchor is not owned by the installing IRIS account")
        def root_unchanged():
            # Directory timestamps change as files are removed; anchor identity is dev/ino.
            require(os.path.realpath(logical, strict=True) == anchor, "CSP root mapping changed")
            require(identity(os.stat(logical))[:2] == root_identity[:2], "CSP anchor changed")
        def file_hash(fd):
            os.lseek(fd, 0, os.SEEK_SET)
            h = hashlib.sha256()
            total = 0
            while True:
                block = os.read(fd, 65536)
                if not block:
                    return h.hexdigest()
                total += len(block)
                require(total <= 1048576, "retirement hash read exceeds1MiB bound")
                h.update(block)
        # Bind retirement to the actual accepted060 frontend entry, not version text.
        entry_fd = os.open("reference.html", os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=root_fd)
        descriptors.append(entry_fd)
        require(stat.S_ISREG(os.fstat(entry_fd).st_mode) and file_hash(entry_fd) == viewer_sha, "current060 frontend identity differs")
        parents = {}
        records = []
        for relative, wanted in sorted(targets.items()):
            directory, name = relative.split("/")
            require(directory in ("assets", "reference") and name not in ("", ".", "..") and "/" not in name and "\\\\" not in name, "unsafe retired relative path")
            if directory not in parents:
                parent_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=root_fd)
                descriptors.append(parent_fd)
                parents[directory] = (parent_fd, identity(os.fstat(parent_fd))[:2])
            parent_fd, parent_identity = parents[directory]
            try:
                before = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
            except FileNotFoundError:
                missing += 1
                continue
            require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_uid == os.geteuid(), "retired entry is not an installer-owned single-link regular file: " + relative)
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent_fd)
            descriptors.append(fd)
            opened = os.fstat(fd)
            require(identity(before) == identity(opened) and opened.st_size == wanted["bytes"], "retired identity/size differs: " + relative)
            require(file_hash(fd) == wanted["sha256"] and identity(os.fstat(fd)) == identity(opened), "retired old hash differs: " + relative)
            records.append((relative, directory, name, fd, identity(opened), wanted))
        def recheck(record):
            relative, directory, name, fd, expected_identity, wanted = record
            root_unchanged()
            parent_fd, parent_identity = parents[directory]
            parent_now = os.stat(directory, dir_fd=root_fd, follow_symlinks=False)
            require(stat.S_ISDIR(parent_now.st_mode) and identity(parent_now)[:2] == parent_identity, "retired parent changed: " + directory)
            require(identity(os.stat(name, dir_fd=parent_fd, follow_symlinks=False)) == expected_identity and identity(os.fstat(fd)) == expected_identity, "retired path identity changed: " + relative)
            require(file_hash(fd) == wanted["sha256"] and identity(os.fstat(fd)) == expected_identity, "retired file changed: " + relative)
        # Complete every validation before the first unlink. A failed preflight removes0.
        for record in records:
            recheck(record)
        phase = "retirement"
        for record in records:
            recheck(record)
            relative, directory, name, fd, expected_identity, wanted = record
            os.unlink(name, dir_fd=parents[directory][0])
            retired.append(relative)
        print("DICOM3D051_RETIREMENT " + json.dumps({"status":"PASS", "policySha256":policy_sha, "retired":retired, "alreadyAbsent":missing}, sort_keys=True))
        return 1
    except Exception as error:
        print("DICOM3D051_RETIREMENT " + json.dumps({"status":"REFUSED", "phase":phase, "policySha256":policy_sha, "retired":retired, "alreadyAbsent":missing, "reason":str(error)}, sort_keys=True))
        return iris.cls("%SYSTEM.Status").Error(5001, "DICOM3D051 retirement refused: " + str(error))
    finally:
        for fd in reversed(descriptors):
            os.close(fd)
}

}
'''
body = template.replace('__TARGETS__', json.dumps(targets, sort_keys=True, indent=4).replace('\n', '\n    ')).replace('__POLICY_SHA__', policy_hash).replace('__VIEWER_SHA__', viewer_build)
destination = root / 'src/DICOM3D/InstallMigration.cls'
if args.check:
    assert destination.read_bytes() == body.encode(), 'Generated native retirement adapter is stale'
else:
    destination.write_bytes(body.encode())
print(json.dumps({'retiredPaths': len(targets), 'retiredBytes': sum(v['bytes'] for v in targets.values()), 'policySha256': policy_hash, 'frontendSha256': viewer_build, 'check': args.check}))
