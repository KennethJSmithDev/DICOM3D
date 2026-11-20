"""Prepare a local 12-lead ECG display bundle from an authorized Part-10 file."""
import argparse
import base64
from hashlib import sha256
from io import BytesIO
import json
import math
from pathlib import Path

import pydicom


SOP = "1.2.840.10008.5.1.4.1.1.9.1.1"
SYNTAXES = {"1.2.840.10008.1.2", "1.2.840.10008.1.2.1"}
LEADS = dict(zip(
    ("1", "2", "61", "62", "63", "64", "3", "4", "5", "6", "7", "8"),
    ("I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"),
))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def calibration(channel):
    source = channel.ChannelSourceSequence[0]
    unit = channel.ChannelSensitivityUnitsSequence[0]
    code = str(source.CodeValue).removeprefix("5.6.3-9-")
    require(source.CodingSchemeDesignator == "SCPECG" and source.CodeValue == "5.6.3-9-" + code
            and code in LEADS and unit.CodingSchemeDesignator == "UCUM" and unit.CodeValue == "uV",
            "Only the named standard leads calibrated in microvolts are supported.")
    require(int(channel.WaveformBitsStored) == 16 and
            float(channel.get("ChannelSampleSkew", 0)) == 0 and
            float(channel.get("ChannelTimeSkew", 0)) == 0,
            "Unsupported waveform storage or channel skew.")
    gain = float(channel.ChannelSensitivity) * float(channel.ChannelSensitivityCorrectionFactor)
    baseline = float(channel.get("ChannelBaseline", 0))
    require(math.isfinite(gain) and 0 < gain <= 1e6 and math.isfinite(baseline) and abs(baseline) <= 1e9,
            "Invalid lead calibration.")
    return {"label": "Lead " + LEADS[code], "gain": gain, "baseline": baseline, "unit": "uV"}


def export(original):
    require(len(original) <= 8 * 1024 * 1024, "Source exceeds the local ECG limit.")
    ds = pydicom.dcmread(BytesIO(original))
    syntax = str(ds.file_meta.TransferSyntaxUID)
    require(ds.SOPClassUID == SOP and ds.file_meta.MediaStorageSOPClassUID == SOP
            and ds.SOPInstanceUID == ds.file_meta.MediaStorageSOPInstanceUID and syntax in SYNTAXES,
            "Expected a 12-lead ECG Waveform Storage original in supported native little-endian syntax.")
    require(1 <= len(ds.WaveformSequence) <= 8, "Invalid multiplex group count.")
    groups = []
    received_bytes = 0
    for i, item in enumerate(ds.WaveformSequence):
        frequency = float(item.SamplingFrequency)
        samples = int(item.NumberOfWaveformSamples)
        require(item.NumberOfWaveformChannels == 12 and len(item.ChannelDefinitionSequence) == 12
                and item.WaveformBitsAllocated == 16 and item.WaveformSampleInterpretation == "SS"
                and "WaveformPaddingValue" not in item and "WaveformData" in item
                and 2 <= samples <= 120000 and 1 <= frequency <= 20000
                and float(item.get("MultiplexGroupTimeOffset", 0)) == 0,
                "Unsupported waveform group representation.")
        raw = item.WaveformData
        received_bytes += len(raw)
        require(len(raw) == samples * 24 and received_bytes <= 4 * 1024 * 1024,
                "Waveform byte count mismatch.")
        originality = str(item.WaveformOriginality)
        require(originality in {"ORIGINAL", "DERIVED"}, "Unrecognized waveform originality.")
        channels = [calibration(channel) for channel in item.ChannelDefinitionSequence]
        require(len({channel["label"] for channel in channels}) == 12, "Duplicate leads.")
        # Keep only the known group labels. Free-text DICOM labels and headers
        # are omitted from the local waveform bundle.
        label = str(item.get("MultiplexGroupLabel", ""))
        groups.append({
            "label": label if label in {"RHYTHM", "MEDIAN BEAT"} else f"Group {i + 1}",
            "originality": originality, "frequency": frequency, "samples": samples,
            "channels": channels, "sampleSha256": sha256(raw).hexdigest(),
            "base64": base64.b64encode(raw).decode("ascii"),
        })
    return {"schema": "DICOM3D-local-ecg-1",
            "source": {"sopClass": SOP, "transferSyntax": syntax, "sha256": sha256(original).hexdigest()},
            "groups": groups}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    inputs = parser.parse_args()
    with inputs.source.open("rb") as stream:
        original = stream.read(8 * 1024 * 1024 + 1)
    packet = export(original)
    with inputs.output.open("x", encoding="utf-8") as stream:
        json.dump(packet, stream, allow_nan=False, separators=(",", ":"))
