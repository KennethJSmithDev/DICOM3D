"""Prepare only the five locally admitted H000 candidate files; never modify inputs."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

EXPECTED = {
    "ct": ("data/derived/volumes/h000-b-ct-stored.npy", 54001792, "25c48e0d392888c61eb157093dc9b5db00e7cb9fcf84c2d6dfb4fbb4fcbf2340"),
    "mask": ("data/derived/masks/lesion.lung.mass.001.npy", 27000960, "beb646363d8e19a86215d2df92a14d12d76d2e2bb7757efd553d813da7b8e17f"),
    "mesh": ("data/derived/models/study.glb", 263976, "0e77bfb887791614b5fcb15c614c4948ae4d48e24ab6e9fa289aa0603c66076d"),
}
DRAFT_SHA256 = "d38fcacc3a4fe700227cc2bb58b2b702804b6d470c9d76559cc944f1b1347f47"
FILES = {"ct.npy.bin", "mask.npy.bin", "lesion.glb", "source-binding.json", "NOTICE.md"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def prepare(research_root, draft_path, output):
    draft_bytes = draft_path.read_bytes()
    if sha(draft_bytes) != DRAFT_SHA256:
        raise ValueError("Metadata draft identity changed; explicit admission review required")
    metadata = json.loads(draft_bytes)
    payloads = {}
    original_hashes = {}
    for key, (relative, size, expected) in EXPECTED.items():
        original = (research_root / relative).read_bytes()
        if len(original) != size or sha(original) != expected:
            raise ValueError(f"Unadmitted {key} source identity")
        original_hashes[key] = expected
        if key in ("ct", "mask"):
            encoded = gzip.compress(original, compresslevel=9, mtime=0)
            declared = metadata["assets"][key]
            if len(encoded) != declared["compressed_bytes"] or sha(encoded) != declared["compressed_sha256"]:
                raise ValueError("Encoder output differs from reviewed gzip identity; review before packaging")
            if gzip.decompress(encoded) != original:
                raise ValueError("Lossless round-trip failed")
            # The gzip container stays byte-identical; .bin avoids static-host HTTP auto-decoding.
            payloads[f"{key}.npy.bin"] = encoded
            declared["proposed_relative_url"] = f"demo/h000/{key}.npy.bin"
        else:
            payloads["lesion.glb"] = original

    metadata["schema"] = "DICOM3D.public-source-binding"
    metadata["admission"]["status"] = "LOCAL_PUBLICATION_CANDIDATE"
    metadata["admission"]["publicationApproved"] = False
    metadata["limitations"][-1] = "Explicit public metadata projection; never an original H000-B/C PASS receipt. Local candidate only; publication is not approved."
    legal = metadata["legal"]
    lines = [
        "# H000 acquired research example — source and derivative notices",
        "",
        "LOCAL PUBLICATION CANDIDATE. Publication is not approved by this artifact.",
        "This is an acquired public research CT and one source segmentation, not synthetic data, a clinical report, a whole-lung segmentation or a validated diagnostic product.",
        "",
        "## Source credits",
        "",
    ]
    for key in ("ct", "seg", "methods", "tcia", "idc"):
        credit = legal["credits"][key]
        lines += [credit["citation"], credit["doi"]]
        if credit.get("source"):
            lines.append(credit["source"])
        lines.append("")
    lines += [
        "## Input license and policies",
        "",
        f"Both selected CT and SEG inputs: {legal['input_license']}. {legal['license_url']}",
        legal["downstream_notice"],
        f"TCIA use policy: {legal['policy_url']}",
        f"TCIA Data Analysis Center guidance: {legal['dac_guidance_url']}",
        "Accessible official policy: https://wiki.cancerimagingarchive.net/display/Public/Data+Usage+Policies+and+Restrictions",
        "Accessible official DAC guidance: https://wiki.cancerimagingarchive.net/pages/viewpage.action?pageId=22515655",
        "IDC licensing: https://learn.canceridc.dev/data/licensing",
        legal["code_license_scope"],
        "",
        "## Changes and evidence limits",
        "",
        legal["changes"],
        "Source acquisition was through NCI Imaging Data Commons v24; selected-series licensing and public identity were rechecked against IDC v25 on 2026-10-20.",
        "The public archive alias QIN-LSC-0064 and source UIDs provide provenance, not authority to identify or contact a participant.",
        "All 103 CT frames were locally visually screened in two display mappings; no readable burned-in identifiers were observed. This bounded screening is not comprehensive privacy certification.",
        "Patient/model transforms, source frame correspondence, native samples and semantic ID lesion.lung.mass.001 are preserved. Generalized reference anatomy is a separate unregistered dataset.",
        "Source intensity RescaleType is empty. Display windowing is presentation only; no independent HU calibration, diagnosis or clinical accuracy is claimed.",
        "Original source DICOM, private fields and research receipts are excluded from this five-file subset.",
        "",
    ]
    payloads["NOTICE.md"] = "\n".join(lines).encode("utf-8")
    metadata["assets"]["notice"] = {
        "proposed_relative_url": "demo/h000/NOTICE.md", "encoding": "identity",
        "bytes": len(payloads["NOTICE.md"]), "sha256": sha(payloads["NOTICE.md"]),
    }
    payloads["source-binding.json"] = (json.dumps(metadata, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    if set(payloads) != FILES:
        raise ValueError("Payload allowlist differs")
    if output.exists():
        if any(not p.is_file() or p.name not in FILES for p in output.iterdir()):
            raise ValueError("Unexpected object in candidate data directory")
        for name, content in payloads.items():
            target = output / name
            if target.exists() and target.read_bytes() != content:
                raise ValueError(f"Refusing to overwrite different candidate bytes: {name}")
    output.mkdir(parents=True, exist_ok=True)
    for name, content in payloads.items():
        target = output / name
        if not target.exists():
            target.write_bytes(content)
    for key, (relative, _, expected) in EXPECTED.items():
        if sha((research_root / relative).read_bytes()) != expected:
            raise ValueError("Source changed during preparation")
    return {
        "status": "LOCAL_PUBLICATION_CANDIDATE", "publicationApproved": False,
        "source_unchanged": True,
        "files": {name: {"bytes": len(data), "sha256": sha(data)} for name, data in payloads.items()},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--research-root", type=Path, required=True)
    parser.add_argument("--metadata-draft", type=Path, required=True)
    args = parser.parse_args()
    destination = Path(__file__).resolve().parents[1] / "reference/public/demo/h000"
    print(json.dumps(prepare(args.research_root.resolve(), args.metadata_draft.resolve(), destination), indent=2))
