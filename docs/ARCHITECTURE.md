# Architecture and ownership

## Data path

```text
DICOM source reality
        ↓
manifest: semantic, provenance, units, spatial authority
        ↓
GLB: portable derived geometry and stable semantic identity
        ↓
Babylon Lite: renderer-owned presentation
        ↓
HTML/CSS/TypeScript: application UI
```

The product viewer accepts a user-selected manifest and matching GLB. It checks the asset name and SHA-256 from the manifest before loading. The renderer does not become source authority. The public baseline ships no patient-derived model.

## Rules

- Preserve stable semantic identity across serialization and consumers.
- Represent spatial transforms and units explicitly; do not distribute compensating rotations or flips across pipeline stages.
- Renderer changes must not rewrite source geometry or promote camera, world transforms, materials, lighting, or transient normals into semantic truth.
- Keep the rendering provider replaceable behind the manifest/GLB boundary.
- Current DICOM3D Model Space v1 qualification is BIPED-only for the accepted study.
- H000 qualification does not establish clinical validity or anatomical outward-normal correctness.
- This product repository is not the complete research evidence store.
- AI segmentation remains last, after deterministic providers and their contracts are established.

## Qualified deployment versus future scope

The v0.1.0 release includes an independently installable IRIS for Health package with two ObjectScript classes, authenticated viewer/API endpoints, IPM lifecycle qualification and a tested isolated Docker development profile. These host and deployment capabilities do **not** make IRIS the owner of DICOM3D semantic geometry. Native Windows viewer/API v0.0.2 was qualified separately; native Windows IPM installation remains unverified.

DEMO-001 is a browser-only GitHub Pages safe demo with a synthetic mathematical fixture and existing selection/visibility/camera controls. It does not ship a medical study. The v0.2.0 roadmap proposes independently manipulable, derived presentation slices without modifying the canonical GLB.

Unimplemented features include exploded/slice manipulation, multi-structure composition, native DICOM ingress, H004 source correlation, FHIR, Unreal, AI, and clinical use. Native64 World is excluded. See ROADMAP.md for current and proposed release boundaries.
