"""Extract the ten-node placenta subtree from the pinned HRA united-female v1.5 GLB."""
import hashlib
import json
import struct
import sys
from pathlib import Path


def chunk(kind, data, padding):
    data += padding * (-len(data) % 4)
    return struct.pack("<I4s", len(data), kind) + data


def extract(path):
    expected = "472567a56896b9b7890508da6501fbf858e56aaa30745365f7a71ade782b529c"
    with path.open("rb") as source:
        if hashlib.file_digest(source, "sha256").hexdigest() != expected:
            raise ValueError("Expected the pinned HRA united-female v1.5 GLB")
        source.seek(12)
        length, kind = struct.unpack("<I4s", source.read(8))
        assert kind == b"JSON"
        src = json.loads(source.read(length))
        _, kind = struct.unpack("<I4s", source.read(8))
        assert kind == b"BIN\0"
        base = source.tell()
        # Both excluded ancestors have identity transforms; keep source coordinates.
        for i in (0, 420):
            assert not src["nodes"][i].keys() & {"matrix", "translation", "rotation", "scale"}
        assert 420 in src["nodes"][0]["children"] and 421 in src["nodes"][420]["children"]
        g = {"asset": {"version": "2.0", "copyright": "Human Reference Atlas / HuBMAP, CC BY 4.0"},
             "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [], "meshes": [],
             "accessors": [], "bufferViews": [], "materials": []}
        binary = bytearray()
        materials = {}

        def copy_accessor(index):
            a = src["accessors"][index].copy()
            view = src["bufferViews"][a["bufferView"]]
            width = {5123: 2, 5125: 4, 5126: 4}[a["componentType"]] * {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[a["type"]]
            assert view.get("byteStride", width) == width and "sparse" not in a
            length = width * a["count"]
            source.seek(base + view.get("byteOffset", 0) + a.pop("byteOffset", 0))
            binary.extend(bytes(-len(binary) % 4))
            a["bufferView"] = len(g["bufferViews"])
            g["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": length})
            payload = source.read(length)
            assert len(payload) == length
            binary.extend(payload)
            g["accessors"].append(a)
            return len(g["accessors"]) - 1

        for i in range(421, 431):
            node = src["nodes"][i].copy()
            node["extras"] = {**node.get("extras", {}), "sourceKey": f"HRA:{i}"}
            if "children" in node:
                node["children"] = [c - 421 for c in node["children"]]
            if "mesh" in node:
                mesh = src["meshes"][node["mesh"]].copy()
                node["mesh"] = len(g["meshes"])
                primitives = []
                for original in mesh["primitives"]:
                    p = original.copy()
                    p["attributes"] = {k: copy_accessor(v) for k, v in p["attributes"].items()}
                    p["indices"] = copy_accessor(p["indices"])
                    m = p["material"]
                    if m not in materials:
                        materials[m] = len(g["materials"])
                        g["materials"].append(src["materials"][m])
                    p["material"] = materials[m]
                    primitives.append(p)
                g["meshes"].append({**mesh, "primitives": primitives})
            g["nodes"].append(node)
    g["buffers"] = [{"byteLength": len(binary)}]
    chunks = chunk(b"JSON", json.dumps(g, separators=(",", ":")).encode(), b" ") + chunk(b"BIN\0", bytes(binary), b"\0")
    return struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks


if __name__ == "__main__":
    source, destination = map(Path, sys.argv[1:])
    result = extract(source)
    with destination.open("xb") as output:
        output.write(result)
    print(len(result), hashlib.sha256(result).hexdigest())
