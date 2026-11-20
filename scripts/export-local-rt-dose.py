"""Prepare a local frame bundle for a bounded relative RT Dose object."""
import argparse
import base64
import hashlib
import io
import json
import math
from pathlib import Path

import numpy as np
import pydicom


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def bundle(original):
    require(132 <= len(original) <= 16 * 1024**2, "Source size outside supported range")
    ds = pydicom.dcmread(io.BytesIO(original))
    uid = str(ds.SOPInstanceUID)
    expected_class = "1.2.840.10008.5.1.4.1.1.481.2"
    syntax = str(ds.file_meta.TransferSyntaxUID)
    require(str(ds.SOPClassUID) == expected_class and str(ds.file_meta.MediaStorageSOPClassUID) == expected_class
            and uid == str(ds.file_meta.MediaStorageSOPInstanceUID) and ds.Modality == "RTDOSE", "Expected original RT Dose")
    require(syntax in ("1.2.840.10008.1.2", "1.2.840.10008.1.2.1"), "Expected uncompressed little-endian DICOM")
    require(ds.DoseUnits == "RELATIVE" and ds.SamplesPerPixel == 1 and ds.PhotometricInterpretation == "MONOCHROME2",
            "Expected relative monochrome RT Dose")
    require((ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation) == (32, 32, 31, 0),
            "Expected unsigned 32-bit source values")
    frames, rows, cols = int(ds.get("NumberOfFrames", 1)), int(ds.Rows), int(ds.Columns)
    require(1 <= frames <= 256 and 1 <= rows <= 4096 and 1 <= cols <= 4096, "Frame dimensions outside supported range")
    require(len(ds.PixelData) == frames * rows * cols * 4 <= 16 * 1024**2, "Stored grid size mismatch")
    values = np.frombuffer(ds.PixelData, dtype="<u4")
    scaling = float(ds.DoseGridScaling)
    require(math.isfinite(scaling) and scaling > 0, "Invalid relative dose scaling")
    scaled_max = int(values.max()) * scaling
    require(math.isfinite(scaled_max), "Dose range outside supported values")
    offsets = [float(value) for value in ds.get("GridFrameOffsetVector", [])]
    require((not offsets and frames == 1) or (len(offsets) == frames and all(math.isfinite(v) for v in offsets)),
            "Invalid source frame offset vector")
    return {
        "schema": "DICOM3D-local-image-1",
        "source": {
            "format": "DICOM", "sha256": sha256(original), "sopName": "RT Dose Storage",
            "family": "RTDOSE", "transferSyntax": syntax,
            "identity": {"SOPInstanceUID": uid, "SOPClassUID": expected_class, "Modality": "RTDOSE", "DoseUnits": "RELATIVE"},
            "relativeDose": {"gridScaling": scaling, "sourceFrameOffsets": offsets},
        },
        "support": {"decoded": True},
        "pixels": {"shape": [frames, rows, cols, 1], "dtype": "<u4", "photometric": "MONOCHROME2",
                   "sha256": sha256(ds.PixelData), "base64": base64.b64encode(ds.PixelData).decode("ascii")},
        "frameIdentity": {"sop": uid, "frameNumbers": list(range(1, frames + 1))},
        "display": {"slope": scaling, "intercept": 0, "center": scaled_max / 2, "width": max(1, scaled_max),
                    "range": [0, scaled_max], "function": "LINEAR_EXACT", "invert": False},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    require(args.original.stat().st_size <= 16 * 1024**2, "Source exceeds 16 MiB")
    prepared = bundle(args.original.read_bytes())
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(prepared, output, allow_nan=False, separators=(",", ":"))
