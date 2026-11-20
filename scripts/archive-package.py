"""Create a reproducible IPM archive from an explicitly staged package directory."""
import argparse
import gzip
import io
import stat
import hashlib
import json
import re
from pathlib import Path
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument("stage", type=Path)
parser.add_argument("archive", type=Path)
args = parser.parse_args()
def linked(path):
    info = path.lstat()
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400)

if linked(args.stage):
    parser.error("linked stage refused")
entries = sorted(args.stage.rglob("*"))
if any(linked(path) for path in entries):
    parser.error("linked stage entry refused")
files = [path for path in entries if path.is_file()]
if not (args.stage / "module.xml").is_file():
    parser.error("stage must contain module.xml")
if args.archive.exists():
    parser.error("archive already exists; choose a new output path")
manifest_bytes = (args.stage / "package-manifest.json").read_bytes()
identity = json.loads(manifest_bytes.decode("utf-8-sig"))
alpha = identity.get("profile") == "three-r3f-alpha"
allowed_versions = {"0.7.0-alpha.1", "0.7.0-alpha.2", "0.7.0"} if alpha else {"0.6.5"}
if identity["version"] not in allowed_versions or not re.fullmatch(r"[0-9a-f]{40}", identity["sourceCommit"]):
    parser.error("exact reviewed packaging version and source identity required")
actual = {
    path.relative_to(args.stage).as_posix(): {
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    } for path in files if path != args.stage / "package-manifest.json"
}
if actual != identity["files"]:
    parser.error("stage differs from its exact package inventory")
frontend = json.loads((args.stage / "public/demo-build-manifest.json").read_text())
if alpha:
    if frontend.get("schema") != "dicom3d-alpha-distribution-1" or frontend.get("release") != identity["version"] or frontend.get("containsPrivatePatientImaging") is not False or frontend.get("approvedPublicResearchFixtures") != ["H000"]:
        parser.error("unadmitted alpha distribution")
    if frontend.get('sourceBase') != identity['sourceCommit'] or not isinstance(identity.get('installedBuildDependencyTree'), dict) or identity['installedBuildDependencyTree'] != frontend.get('buildToolchain', {}).get('installedTree') or not re.fullmatch(r'[0-9a-f]{64}', identity['installedBuildDependencyTree'].get('sha256', '')):
        parser.error('package and frontend build-input identities differ')
    admission = frontend.get("approvedPublicResearchAssets", {})
    # Five unchanged, operator-admitted public H000 objects; not arbitrary studies.
    if hashlib.sha256(json.dumps(admission, sort_keys=True, separators=(",", ":")).encode()).hexdigest() != "b199c0f8b3d8df40a0f23a03f9bd851aebb3febc86f184b2cf7cbdeb3d8f93e8":
        parser.error("public H000 admission differs")
    for name, expected in admission.items():
        if frontend["files"].get("demo/h000/" + name) != expected:
            parser.error("public H000 asset differs: " + name)
    if {name for name in frontend['files'] if name.startswith('demo/h000/')} != {'demo/h000/' + name for name in admission}:
        parser.error('unexpected H000 asset')
elif frontend["patientDerivedResearchData"] or frontend["approvedPublicResearchFixtures"]:
    parser.error("research data is not admitted in the legacy profile")
public_files = {path.relative_to(args.stage / "public").as_posix() for path in (args.stage / "public").rglob("*") if path.is_file()}
if public_files != set(frontend["files"]) | {"demo-build-manifest.json"}:
    parser.error("unexpected frontend file")
for name, expected in frontend["files"].items():
    if actual["public/" + name] != expected:
        parser.error("frontend identity mismatch: " + name)
with args.archive.open("xb") as raw:
    with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as tar:
            for path in files:
                name = path.relative_to(args.stage).as_posix()
                if path.is_symlink() or not (name in ("module.xml", "LICENSE", "NOTICE", "package-manifest.json", "docs/INSTALL_060.md", "docs/PACKAGING_060.md", "docs/INSTALL_070_ALPHA.md", "docs/PACKAGING_070_ALPHA.md", "docs/IRIS_FILECOPY_RETIREMENT_051.md", "docs/INSTALL_070.md", "docs/FHIR_INTEROP_ALPHA2.md", "docs/SMART_SYNTHETIC_FOUNDATION.md") or name.startswith(("src/", "public/", "third-party/"))):
                    raise ValueError(f"unexpected package file: {name}")
                info = tarfile.TarInfo(name)
                data = manifest_bytes if name == "package-manifest.json" else path.read_bytes()
                if name != "package-manifest.json" and actual[name] != {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}:
                    raise ValueError(f"package input changed while archiving: {name}")
                info.size = len(data)
                info.mode = 0o644
                info.uid = info.gid = info.mtime = 0
                tar.addfile(info, io.BytesIO(data))
print(hashlib.sha256(args.archive.read_bytes()).hexdigest())
