"""Create a reproducible IPM archive from an explicitly staged package directory."""
import argparse
import gzip
import hashlib
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
with args.archive.open("wb") as raw:
    with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as tar:
            for path in files:
                name = path.relative_to(args.stage).as_posix()
                if path.is_symlink() or not (name == "module.xml" or name.startswith(("src/", "public/"))):
                    raise ValueError(f"unexpected package file: {name}")
                info = tarfile.TarInfo(name)
                info.size = path.stat().st_size
                info.mode = 0o644
                info.uid = info.gid = info.mtime = 0
                with path.open("rb") as source:
                    tar.addfile(info, source)
print(hashlib.sha256(args.archive.read_bytes()).hexdigest())
