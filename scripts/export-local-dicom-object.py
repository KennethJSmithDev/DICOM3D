"""Prepare inspectable source metadata from a local DICOM SR, plan, or structure set."""
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
    "1.2.840.10008.5.1.4.1.1.481.8": "RTPLAN",
    "1.2.840.10008.5.1.4.1.1.481.3": "RTSTRUCT",
}
ION_PLAN = "1.2.840.10008.5.1.4.1.1.481.8"
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


def references(ds, depth=0):
    require(depth <= 20, "Reference nesting exceeds supported depth")
    result = []
    for element in ds:
        if element.VR != "SQ" or not element.keyword.startswith((
            "Referenced", "Predecessor", "CurrentRequested", "PertinentOther", "RTReferenced", "ContourImage",
        )):
            continue
        for item in element.value:
            values = strings(item, ("ReferencedSOPClassUID", "ReferencedSOPInstanceUID", "ReferencedFrameNumber",
                                    "ReferencedSegmentNumber", "ReferencedWaveformChannels",
                                    "FrameOfReferenceUID", "StudyInstanceUID", "SeriesInstanceUID",
                                    "ReferencedBeamNumber", "ReferencedFractionGroupNumber"))
            nested = references(item, depth + 1)
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
    elif value_type in ("SCOORD", "SCOORD3D"):
        item["values"] = strings(ds, ("GraphicType", "GraphicData", "ReferencedFrameOfReferenceUID",
                                      "PixelOriginInterpretation", "FiducialUID"))
        item["limited"] = not ("GraphicType" in ds and "GraphicData" in ds and
                               (value_type == "SCOORD" or "ReferencedFrameOfReferenceUID" in ds))
    elif value_type == "TCOORD":
        offsets = ("ReferencedSamplePositions", "ReferencedTimeOffsets", "ReferencedDateTime")
        item["values"] = strings(ds, ("TemporalRangeType", *offsets))
        item["limited"] = "TemporalRangeType" not in ds or not any(key in ds for key in offsets)
    elif "ReferencedContentItemIdentifier" in ds:
        item["values"] = strings(ds, ("ReferencedContentItemIdentifier",))
    elif value_type not in ("IMAGE", "COMPOSITE", "WAVEFORM") or not item["references"]:
        item["limited"] = True
    item["children"] = [report_item(child, depth + 1) for child in ds.get("ContentSequence", [])]
    return item


def plan_metadata(ds, sop_class):
    ion = sop_class == ION_PLAN
    beam_fields = ("BeamNumber", "BeamName", "BeamType", "RadiationType", "TreatmentDeliveryType",
                   "NumberOfControlPoints")
    if ion:
        beam_fields += ("RadiationAtomicNumber", "RadiationMassNumber", "RadiationChargeState", "ScanMode", "ModulatedScanModeType")
    fraction_fields = ("FractionGroupNumber", "NumberOfFractionsPlanned", "NumberOfBeams")
    return {
        "fields": strings(ds, ("RTPlanLabel", "RTPlanName", "RTPlanGeometry", "ApprovalStatus")),
        "beams": [strings(beam, beam_fields) for beam in ds.get("IonBeamSequence" if ion else "BeamSequence", [])],
        "fractions": [
            {"fields": strings(group, fraction_fields), "references": references(group)}
            for group in ds.get("FractionGroupSequence", [])
        ],
        "references": references(ds),
    }


def structure_metadata(ds):
    regions = [strings(item, ("ROINumber", "ROIName", "ReferencedFrameOfReferenceUID", "ROIGenerationAlgorithm"))
               for item in ds.get("StructureSetROISequence", [])]
    region_ids = {int(item["ROINumber"]) for item in regions if item.get("ROINumber")}
    require(len(region_ids) == len(regions), "Missing or duplicate ROI number")
    contours = []
    for group in ds.get("ROIContourSequence", []):
        require("ReferencedROINumber" in group and int(group.ReferencedROINumber) in region_ids,
                "Contour references an absent ROI")
        items = []
        for item in group.get("ContourSequence", []):
            record = {
                "fields": strings(item, ("ContourNumber", "ContourGeometricType", "NumberOfContourPoints")),
                "references": references(item),
            }
            if "ContourData" in item:
                count = int(item.NumberOfContourPoints)
                require(1 <= count <= 4000 and len(item.ContourData) == count * 3,
                        "Contour coordinate count does not match the source")
                record["coordinatesMm"] = [float(value) for value in item.ContourData]
            items.append(record)
        contours.append({
            "fields": strings(group, ("ReferencedROINumber", "ROIDisplayColor")),
            "items": items,
        })
    observations = []
    for item in ds.get("RTROIObservationsSequence", []):
        require("ReferencedROINumber" in item and int(item.ReferencedROINumber) in region_ids,
                "Observation references an absent ROI")
        observations.append(strings(item, ("ObservationNumber", "ReferencedROINumber", "RTROIInterpretedType")))
    return {
        "fields": strings(ds, ("StructureSetLabel", "StructureSetName")),
        "studyIdentity": str(ds.StudyInstanceUID) if "StudyInstanceUID" in ds else None,
        "regions": regions, "contours": contours, "observations": observations, "references": references(ds),
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
    if family == "SR":
        content = report_item(ds)
    elif family == "RTPLAN":
        content = plan_metadata(ds, sop_class)
    else:
        content = structure_metadata(ds)
    payload = {
        "source": {"sha256": sha256(original), "sopClassUID": sop_class, "sopInstanceUID": instance,
                   "transferSyntaxUID": syntax, "family": family},
        "content": content,
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
