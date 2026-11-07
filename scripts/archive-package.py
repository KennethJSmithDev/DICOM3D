"""Create a reproducible IPM archive from an explicitly staged package directory."""
import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument("stage", type=Path)
parser.add_argument("archive", type=Path)
args = parser.parse_args()
files = sorted(p for p in args.stage.rglob("*") if p.is_file())
if not (args.stage / "module.xml").is_file():
    parser.error("stage must contain module.xml")
if args.archive.exists():
    parser.error("archive already exists; choose a new output path")
identity = json.loads((args.stage / "package-manifest.json").read_text(encoding="utf-8-sig"))
alpha = identity.get("profile") == "three-r3f-alpha"
if identity["version"] != ("0.7.0-alpha.1" if alpha else "0.6.5") or not re.fullmatch(r"[0-9a-f]{40}", identity["sourceCommit"]):
    parser.error("exact reviewed packaging version and source identity required")
actual = {
    path.relative_to(args.stage).as_posix(): {
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    } for path in files if path.name != "package-manifest.json"
}
if actual != identity["files"]:
    parser.error("stage differs from its exact package inventory")
frontend = json.loads((args.stage / "public/demo-build-manifest.json").read_text())
if alpha:
    if frontend.get("schema") != "dicom3d-alpha-distribution-1" or frontend.get("release") != "0.7.0-alpha.1" or frontend.get("containsPrivatePatientImaging") is not False or frontend.get("approvedPublicResearchFixtures") != ["H000"]:
        parser.error("unadmitted alpha distribution")
    admission = frontend.get("approvedPublicResearchAssets", {})
    # Five unchanged, operator-admitted public H000 objects; not arbitrary studies.
    if hashlib.sha256(json.dumps(admission, sort_keys=True, separators=(",", ":")).encode()).hexdigest() != "b199c0f8b3d8df40a0f23a03f9bd851aebb3febc86f184b2cf7cbdeb3d8f93e8":
        parser.error("public H000 admission differs")
    for name, expected in admission.items():
        if frontend["files"].get("demo/h000/" + name) != expected:
            parser.error("public H000 asset differs: " + name)
elif frontend["patientDerivedResearchData"] or frontend["approvedPublicResearchFixtures"]:
    parser.error("research data is not admitted in the legacy profile")
public_files = {path.relative_to(args.stage / "public").as_posix() for path in (args.stage / "public").rglob("*") if path.is_file()}
if public_files != set(frontend["files"]) | {"demo-build-manifest.json"}:
    parser.error("unexpected frontend file")
for name, expected in frontend["files"].items():
    if actual["public/" + name] != expected:
        parser.error("frontend identity mismatch: " + name)
with args.archive.open("wb") as raw:
    with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as tar:
            for path in files:
                name = path.relative_to(args.stage).as_posix()
                if path.is_symlink() or not (name in ("module.xml", "LICENSE", "NOTICE", "package-manifest.json", "docs/INSTALL_060.md", "docs/PACKAGING_060.md", "docs/INSTALL_070_ALPHA.md", "docs/PACKAGING_070_ALPHA.md", "docs/IRIS_FILECOPY_RETIREMENT_051.md") or name.startswith(("src/", "public/", "third-party/"))):
                    raise ValueError(f"unexpected package file: {name}")
                info = tarfile.TarInfo(name)
                info.size = path.stat().st_size
                info.mode = 0o644
                info.uid = info.gid = info.mtime = 0
                with path.open("rb") as source:
                    tar.addfile(info, source)
print(hashlib.sha256(args.archive.read_bytes()).hexdigest())
