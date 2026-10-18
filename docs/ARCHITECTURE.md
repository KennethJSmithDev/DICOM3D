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

Historical DEMO-001 was a browser-only synthetic mathematical fixture. The current DEMO-050 public Pages experience loads licensed generalized male anatomy, supports switching to the female reference, and retains selection/visibility/camera controls without bundling patient imaging. H002's synthetic derived presentation slices remain a separately bounded historical qualification.

The unpublished H002 candidate adds manipulation of five derived open bands only for the exact synthetic demo fixture. Canonical source buffers and transforms are preserved; each band's immutable origin composes with temporary individual offsets/rotation and global model-Y spacing. Named glTF transform parents own placement; their mesh descendants own renderer visibility and trusted pick identity. See H002_CANDIDATE.md for qualification and publication boundary.

Camera framing is another presentation projection. Source/model origin remains fixed by the manifest. Geometric bounds center is computed from public local mesh AABBs transformed into renderer world space. The camera target copies a chosen bounds center; it is not an anatomical landmark or a rewritten source origin. Aspect-aware enclosing-sphere fit uses the actual canvas dimensions. Fit-complete includes hidden bands without changing visibility, focus uses the visible selected band, expansion/layout changes refit, and reset-all restores original orientation/FOV and original visible bounds at the current aspect.

The current Core includes bounded local imaging adapters, the H000 source-linked SEG/CT/lesion example and deterministic contextual lessons. General medical mesh slicing, complete multi-structure composition, universal native DICOM ingress, production FHIR/PACS connections, clinical decision-making, Unreal/Niagara effects and clinical use remain unqualified or unimplemented. Public FHIR test reads and synthetic clinical references do not establish production interoperability. Unrelated engine implementations are excluded. See ROADMAP.md for current and proposed release boundaries.
