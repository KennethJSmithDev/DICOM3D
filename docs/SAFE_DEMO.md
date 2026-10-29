# DICOM3D Safe Demo — v0.6.0 web scope

[Open the demo](https://kennethjsmithdev.github.io/DICOM3D/).

The v0.6.0 Visual Research Workstation uses the existing reference viewer and Babylon Lite/WebGPU renderer. It opens generalized male BodyParts3D anatomy and supports female HRA switching, selection, visibility, isolation, restoration and camera controls. Scientific, holographic and bounded materialization modes share authoritative reference geometry. Learn sits directly below Lab.

## Optional curated public research profile

The original v0.6.0 Safe Demo was reference-only. The follow-on `curated-h000` profile admits the five unchanged files specified in the [current data policy](PUBLIC_RESEARCH_DATA_POLICY.md): CT container, source SEG-mask container, lesion GLB, source binding and original notice. They total approximately 33.3 MB and load only after an explicit study action. Default reference browsing causes no H000 requests. The [Pages deployment](https://github.com/KennethJSmithDev/DICOM3D/actions/runs/39531191232) completed successfully on October 21, 2026 at 02:07 UTC for `cc5c1d9b25776ab055b6a8ac2afa48da63f33904`. The [published release record](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.0) separately records exact deployed-payload readback and bounded desktop Edge/WebGPU checks; these are recorded qualification results, not new tests performed by this documentation update.

The acquired study preserves existing native-frame display, cyan source SEG contours, optional amber surface intersection, linked CT plane, acquired chest context, masked CT interior and contextual learning. The final mesh and semantic identity remain authoritative; no full lung segmentation or reference-body registration is inferred. Credits and TCIA policy are accessible before load and through Source & evidence. No CT screenshot, arbitrary import, private dataset connection, login, IRIS service or clinical write API is included.

The reference catalogs have different source membership and partial coverage. They are not registered patient anatomy. Presentation samples are visual effects, not new tissue, acquired voxels or scientific measurements. Keep the [BodyParts3D notice](../reference/public/reference/BODYParts3D-NOTICE.txt), [HRA notice](../reference/public/reference/HRA-FEMALE-NOTICE.txt) and [data policy](PUBLIC_RESEARCH_DATA_POLICY.md) with the assets.

## Build and deployment

The existing `.github/workflows/pages-demo.yml` selects `--profile curated-h000` explicitly for the existing reference entry, runs exact public-output/index and research-data checks, and deploys `.demo-dist` on applicable main changes. The CLI default remains `reference-only`; Core/native staging uses that default and cannot select the curated profile at `/dicom3d/`. Build success, deployment and actual remote rendering are separate evidence steps.

The [publication procedure](VISUAL_PUBLICATION_PROCEDURE.md) requires remote version, manifest, asset, notice and UI readback before declaring deployment complete. See [release scope](RELEASE_060.md) and [visual limits](VISUAL_RELEASE_060.md). A WebGPU-capable desktop browser is required; all-device or clinical qualification is not claimed.

## Preserved history

DEMO-050, deployed October 18, 2026, established the anatomy-first landing experience. Its [publication commit](https://github.com/KennethJSmithDev/DICOM3D/commit/0c26e951ecc0c2074798281b6c49e162ff0dd692) remains historical evidence.

DEMO-001 used a synthetic icosahedron, with 12 vertices and 20 triangles. Its accepted fixtures/tests remain regression history and are excluded from the public landing payload.

Frozen v0.5.1 Core/IPM installation distributions remain separate and unchanged.
