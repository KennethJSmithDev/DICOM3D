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

## Scope

This baseline does not implement exploded presentation, multiple-structure composition, IRIS for Health, IPM, Docker, native DICOM ingress, H004 source correlation, FHIR, Unreal, or AI.
