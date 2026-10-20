# DICOM3D Safe Demo — v0.6.0 web scope

[Open the demo](https://kennethjsmithdev.github.io/DICOM3D/).

The v0.6.0 Visual Research Workstation uses the existing reference viewer and Babylon Lite/WebGPU renderer. It opens generalized male BodyParts3D anatomy and supports female HRA switching, selection, visibility, isolation, restoration and camera controls. Scientific, holographic and bounded materialization modes share authoritative reference geometry. Learn sits directly below Lab.

## Reference-only publication

Safe Demo includes licensed generalized anatomy, source notices, branding and browser code. No H000 CT, segmentation mask, lesion mesh, source binding, CT screenshot or real-study download action is part of this release. No login, private dataset, IRIS service, production FHIR endpoint or write API is required.

The reference catalogs have different source membership and partial coverage. They are not registered patient anatomy. Presentation samples are visual effects, not new tissue, acquired voxels or scientific measurements. Keep the [BodyParts3D notice](../reference/public/reference/BODYParts3D-NOTICE.txt), [HRA notice](../reference/public/reference/HRA-FEMALE-NOTICE.txt) and [data policy](PUBLIC_RESEARCH_DATA_POLICY.md) with the assets.

## Build and deployment

The existing `.github/workflows/pages-demo.yml` builds the reference entry using `scripts/build-demo.mjs` and deploys `.demo-dist` on applicable main changes. `scripts/test-demo.mjs` checks exact public output and policy. Build success, deployment and actual remote rendering are separate evidence steps.

The [publication procedure](VISUAL_PUBLICATION_PROCEDURE.md) requires remote version, manifest, asset, notice and UI readback before declaring deployment complete. See [release scope](RELEASE_060.md) and [visual limits](VISUAL_RELEASE_060.md). A WebGPU-capable desktop browser is required; all-device or clinical qualification is not claimed.

## Preserved history

DEMO-050, deployed October 18, 2026, established the anatomy-first landing experience. Its [publication commit](https://github.com/KennethJSmithDev/DICOM3D/commit/0c26e951ecc0c2074798281b6c49e162ff0dd692) remains historical evidence.

DEMO-001 used a synthetic icosahedron, with 12 vertices and 20 triangles. Its accepted fixtures/tests remain regression history and are excluded from the public landing payload.

Frozen v0.5.1 Core/IPM installation distributions remain separate and unchanged.
