"""Prepare an inspectable, source-linked view of a local DICOM SR or RT Plan."""
import argparse
import hashlib
import io
import json
from pathlib import Path

import pydicom


SOP_TYPES = {
    "1.2.840.10008.5.1.4.1.1.88.11": "SR",
    "1.2.840.10008.5.1.4.1.1.88.22": "SR",
    "1.2.840.10008.5.1.4.1.1.88.33": "SR",
    "1.2.840.10008.5.1.4.1.1.88.34": "SR",
    "1.2.840.10008.5.1.4.1.1.481.5": "RTPLAN",
}
MAX_SOURCE = 2 * 1024 * 1024
MAX_PAYLOAD = 512 * 1024


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def strings(ds, keys):
    return {key: str(ds[key].value) for key in keys if key in ds}


def codes(ds, name):
    return [
        strings(code, ("CodeValue", "LongCodeValue", "URNCodeValue", "CodingSchemeDesignator",
                       "CodingSchemeVersion", "CodeMeaning"))
        for code in ds.get(name, [])
    ]


def references(ds):
    result = []
    for element in ds:
        if element.VR != "SQ" or not element.keyword.startswith(("Referenced", "Predecessor", "CurrentRequested", "PertinentOther")):
            continue
        for item in element.value:
            values = strings(item, ("ReferencedSOPClassUID", "ReferencedSOPInstanceUID", "ReferencedFrameNumber",
                                    "ReferencedSegmentNumber", "StudyInstanceUID", "SeriesInstanceUID",
                                    "ReferencedBeamNumber", "ReferencedFractionGroupNumber"))
            nested = references(item)
            if values or nested:
                result.append({"sequence": element.keyword, "values": values, "references": nested})
    return result


def report_item(ds, depth=0):
    require(depth <= 20, "SR nesting exceeds supported depth")
    value_type = str(ds.get("ValueType", ""))
    item = {
        "type": value_type or "REFERENCE",
        "relationship": str(ds.get("RelationshipType", "")),
        "concepts": codes(ds, "ConceptNameCodeSequence"),
        "references": references(ds),
        "values": {},
    }
    if value_type in ("TEXT", "DATE", "TIME", "DATETIME", "UIDREF"):
        item["values"] = strings(ds, {
            "TEXT": ("TextValue",), "DATE": ("Date",), "TIME": ("Time",),
            "DATETIME": ("DateTime",), "UIDREF": ("UID",),
        }[value_type])
    elif value_type == "CODE":
        item["codedValues"] = codes(ds, "ConceptCodeSequence")
    elif value_type == "NUM":
        item["measurements"] = [
            {
                "values": strings(measure, ("NumericValue", "FloatingPointValue",
                                            "RationalNumeratorValue", "RationalDenominatorValue")),
                "units": codes(measure, "MeasurementUnitsCodeSequence"),
            }
            for measure in ds.get("MeasuredValueSequence", [])
        ]
        item["qualifiers"] = codes(ds, "NumericValueQualifierCodeSequence")
    elif value_type == "CONTAINER":
        item["values"] = strings(ds, ("ContinuityOfContent",))
    elif "ReferencedContentItemIdentifier" in ds:
        item["values"] = strings(ds, ("ReferencedContentItemIdentifier",))
    elif value_type not in ("IMAGE", "COMPOSITE", "WAVEFORM") or not item["references"]:
        item["limited"] = True
    item["children"] = [report_item(child, depth + 1) for child in ds.get("ContentSequence", [])]
    return item


def plan_metadata(ds):
    beam_fields = ("BeamNumber", "BeamName", "BeamType", "RadiationType", "TreatmentDeliveryType",
                   "NumberOfControlPoints")
    fraction_fields = ("FractionGroupNumber", "NumberOfFractionsPlanned", "NumberOfBeams")
    return {
        "fields": strings(ds, ("RTPlanLabel", "RTPlanName", "RTPlanGeometry", "ApprovalStatus")),
        "beams": [strings(beam, beam_fields) for beam in ds.get("BeamSequence", [])],
        "fractions": [
            {"fields": strings(group, fraction_fields), "references": references(group)}
            for group in ds.get("FractionGroupSequence", [])
        ],
        "references": references(ds),
    }


def bundle(original):
    require(132 <= len(original) <= MAX_SOURCE and original[128:132] == b"DICM",
            "Expected a bounded DICOM Part 10 source")
    ds = pydicom.dcmread(io.BytesIO(original), stop_before_pixels=True)
    sop_class = str(ds.SOPClassUID)
    instance = str(ds.SOPInstanceUID)
    syntax = str(ds.file_meta.TransferSyntaxUID)
    family = SOP_TYPES.get(sop_class)
    require(family and ds.Modality == family and instance == str(ds.file_meta.MediaStorageSOPInstanceUID)
            and sop_class == str(ds.file_meta.MediaStorageSOPClassUID),
            "Source SOP identity or modality does not match the file meta information")
    require(syntax in ("1.2.840.10008.1.2", "1.2.840.10008.1.2.1"), "Unsupported transfer syntax")
    payload = {
        "source": {"sha256": sha256(original), "sopClassUID": sop_class, "sopInstanceUID": instance,
                   "transferSyntaxUID": syntax, "family": family},
        "content": report_item(ds) if family == "SR" else plan_metadata(ds),
    }
    body = json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    encoded = body.encode("utf-8")
    require(len(encoded) <= MAX_PAYLOAD, "Prepared inspection exceeds size limit")
    return {"schema": "DICOM3D-local-object-1", "payload": body, "payloadSha256": sha256(encoded)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    require(args.original.stat().st_size <= MAX_SOURCE, "Source exceeds 2 MiB")
    result = bundle(args.original.read_bytes())
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(result, output, allow_nan=False, separators=(",", ":"))
