"""Prepare one binary or fractional SEG segment for review on its source CT grid."""
import argparse
import base64
import hashlib
import io
import json
import math
from pathlib import Path

import numpy as np
import pydicom

SEG_SOP = "1.2.840.10008.5.1.4.1.1.66.4"
CT_SOP = "1.2.840.10008.5.1.4.1.1.2"
MAX_BYTES = 16 * 1024**2
MAX_FRAMES = 256


def require(condition, message):
    if not condition:
        raise ValueError(message)


def single(dataset, name):
    values = dataset.get(name, [])
    require(len(values) == 1, f"Expected one {name} item")
    return values[0]


def frame_group(frame, shared, name):
    require(not (name in frame and name in shared), f"Ambiguous {name}")
    return single(frame if name in frame else shared, name)


def uid(value):
    require(bool(value) and value.is_valid, "Invalid DICOM UID")
    return str(value)


def vector(dataset, name, size):
    values = [float(value) for value in dataset.get(name, [])]
    require(len(values) == size and all(map(math.isfinite, values)), f"Invalid {name}")
    return values


def references(items):
    require(1 <= len(items) <= MAX_FRAMES, "Expected bounded CT references")
    out = []
    seen = set()
    for item in items:
        require(str(item.ReferencedSOPClassUID) == CT_SOP, "Referenced source must be classic CT")
        instance = uid(item.ReferencedSOPInstanceUID)
        require(int(item.get("ReferencedFrameNumber", 1)) == 1 and instance not in seen,
                "Expected unique single-frame CT references")
        seen.add(instance)
        out.append({"sopIdentity": instance, "sourceFrame": 1})
    return out


def derivation_refs(groups):
    derivation = single(groups, "DerivationImageSequence")
    return references(derivation.get("SourceImageSequence", []))


def bundle(original, segment_number=None):
    require(132 <= len(original) <= MAX_BYTES, "Source size outside supported range")
    ds = pydicom.dcmread(io.BytesIO(original))
    name = uid(ds.SOPInstanceUID)
    require(str(ds.SOPClassUID) == SEG_SOP and str(ds.file_meta.MediaStorageSOPClassUID) == SEG_SOP and
            name == uid(ds.file_meta.MediaStorageSOPInstanceUID) and ds.Modality == "SEG", "Expected original DICOM SEG")
    require(str(ds.file_meta.TransferSyntaxUID) in ("1.2.840.10008.1.2", "1.2.840.10008.1.2.1"),
            "Expected uncompressed little-endian DICOM")
    seg_type = str(ds.SegmentationType)
    require(seg_type in ("BINARY", "FRACTIONAL") and ds.PhotometricInterpretation == "MONOCHROME2" and
            ds.SamplesPerPixel == 1 and ds.PixelRepresentation == 0, "Expected binary or fractional grayscale SEG")
    fractional = None
    if seg_type == "FRACTIONAL":
        meaning = str(ds.get("SegmentationFractionalType", ""))
        maximum = ds.get("MaximumFractionalValue")
        require((ds.BitsAllocated, ds.BitsStored, ds.HighBit) == (8, 8, 7) and
                meaning in ("PROBABILITY", "OCCUPANCY") and isinstance(maximum, int) and 1 <= maximum <= 255,
                "Invalid fractional SEG encoding")
        fractional = {"type": meaning, "maximum": maximum}
    else:
        require((ds.BitsAllocated, ds.BitsStored, ds.HighBit) == (1, 1, 0), "Invalid binary SEG encoding")

    rows, columns, frame_count = int(ds.Rows), int(ds.Columns), int(ds.NumberOfFrames)
    require(1 <= rows <= 4096 and 1 <= columns <= 4096 and 1 <= frame_count <= MAX_FRAMES,
            "SEG dimensions outside supported range")
    plane_pixels = rows * columns
    plane_bytes = plane_pixels if fractional else (plane_pixels + 7) // 8
    require(frame_count * plane_bytes <= MAX_BYTES, "SEG dimensions outside supported range")
    payload_bytes = plane_pixels * frame_count if fractional else (plane_pixels * frame_count + 7) // 8
    require(len(ds.PixelData) == payload_bytes + (payload_bytes % 2), "Unexpected SEG pixel payload length")
    if fractional:
        require(not payload_bytes % 2 or ds.PixelData[-1] == 0, "Invalid fractional SEG padding byte")
    segments = {}
    for item in ds.get("SegmentSequence", []):
        number = int(item.SegmentNumber)
        label = str(item.SegmentLabel).strip()
        require(1 <= number <= 65535 and 1 <= len(label) <= 64, "Invalid segment label or number")
        require(number not in segments, "Duplicate declared segment number")
        segments[number] = label
    require(0 < len(segments) <= MAX_FRAMES, "Expected bounded segment definitions")
    if segment_number is None:
        require(len(segments) == 1, "Use --segment for a source with multiple segments")
        segment_number = next(iter(segments))
    require(segment_number in segments, "Requested segment is absent from the source")

    series = single(ds, "ReferencedSeriesSequence")
    allowed = references(series.get("ReferencedInstanceSequence", []))
    allowed_ids = {entry["sopIdentity"] for entry in allowed}
    shared = single(ds, "SharedFunctionalGroupsSequence")
    shared_refs = derivation_refs(shared) if "DerivationImageSequence" in shared else None
    if shared_refs is not None:
        require({entry["sopIdentity"] for entry in shared_refs} == allowed_ids, "Shared source references do not match the CT series list")
    sequence = ds.get("PerFrameFunctionalGroupsSequence", [])
    require(len(sequence) == frame_count, "Per-frame metadata count does not match pixel frames")
    frames = []
    indices = []
    for index, frame in enumerate(sequence):
        number = int(frame_group(frame, shared, "SegmentIdentificationSequence").ReferencedSegmentNumber)
        require(number in segments, "Frame references an undeclared segment")
        if number != segment_number:
            continue
        if shared_refs is None:
            explicit = derivation_refs(frame)
            require(len(explicit) == 1 and explicit[0]["sopIdentity"] in allowed_ids, "Expected one original CT reference per SEG frame")
            reference = explicit[0]
        else:
            require("DerivationImageSequence" not in frame, "Ambiguous shared and per-frame source references")
            reference = shared_refs[0] if len(shared_refs) == 1 else None
        position = vector(frame_group(frame, shared, "PlanePositionSequence"), "ImagePositionPatient", 3)
        orientation = vector(frame_group(frame, shared, "PlaneOrientationSequence"), "ImageOrientationPatient", 6)
        spacing = vector(frame_group(frame, shared, "PixelMeasuresSequence"), "PixelSpacing", 2)
        require(all(value > 0 for value in spacing), "Invalid pixel spacing")
        frames.append({"reference": reference, "position": position, "orientation": orientation, "spacing": spacing})
        indices.append(index)

    require(bool(indices), "Requested segment has no source frames")
    pixels = ds.pixel_array.reshape(frame_count, plane_pixels)
    if fractional:
        require(int(pixels.max()) <= fractional["maximum"], "Fractional SEG sample exceeds its declared maximum")
    if len(indices) != frame_count:
        pixels = pixels[indices]
    packed = pixels.tobytes() if fractional else np.packbits(pixels, axis=1, bitorder="little").tobytes()
    return {
        "schema": "DICOM3D-local-fractional-seg-1" if fractional else "DICOM3D-local-binary-seg-1",
        **({"fractional": fractional} if fractional else {}),
        "source": {
            "segSopIdentity": name,
            "sha256": hashlib.sha256(original).hexdigest(),
            "studyIdentity": uid(ds.StudyInstanceUID),
            "ctSeriesIdentity": uid(series.SeriesInstanceUID),
            "frameOfReferenceIdentity": uid(ds.FrameOfReferenceUID),
            "references": allowed,
        },
        "segment": {"number": segment_number, "label": segments[segment_number]},
        "dimensions": [rows, columns],
        "frames": frames,
        "payload": {"bytes": len(packed), "sha256": hashlib.sha256(packed).hexdigest(),
                    "base64": base64.b64encode(packed).decode("ascii")},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--segment", type=int, help="Recorded segment number, required for multi-segment sources")
    args = parser.parse_args()
    require(args.original.stat().st_size <= MAX_BYTES, "Source exceeds 16 MiB")
    prepared = bundle(args.original.read_bytes(), args.segment)
    with args.output.open("x", encoding="utf-8") as out:
        json.dump(prepared, out, allow_nan=False, separators=(",", ":"))
