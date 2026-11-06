# DICOM3D v0.7.0-alpha.1 source checkpoint

DICOM3D is an open-source interactive anatomy and medical imaging platform. This is the existing React 19.2.7 / Three.js 0.180.0 / R3F 9.6.1 prototype, with Vite 8.2.4; no renderer migration or feature changes were made for this handoff.

## Exact origin

- Preserved dirty-worktree base: `355570e3f250c4c4644deabd39c675f466eea7ec`; that commit alone is not the candidate.
- Final source recovery ZIP SHA-256: `d800910a3f7c52ed0d70e4b4d613ceacd253491c0a17a244bcf7fe5b39586640`.
- Final local runtime ZIP SHA-256: `58d932424eecbb300cbea04154eb4d38c8ea85a2a14e146a4b068c494dc3c01e`.
- Exact final runtime manifest SHA-256: `58041de7f3a71d91e036b1e12c3f16c20b1df2d46af5b71ced0ddb0ae9db047b`; 54 runtime files, extracted hash readback passed.
- Five local builds and one headed Edge session in the closed alpha pass. Final directory was browser tested; extracted archive bytes matched, but its separately launched URL was not browser tested.

The source manifest records portable path changes. In particular, the NRX C++ include is repository-relative and two local fixture tests take environment variables. Original source and receipts remain immutable locally. `SOURCE-HASHES.json` inside the historical NRX bridge describes its original checkpoint, not these portability-only adapter/test edits.

## Functional, at the recorded scope

WebGPU is primary; forced WebGL compatibility is preserved. Male 1,186 admitted owners and female 380 owners support representative loading, source selection, focus, isolation and restoration. Skin is hidden by default. Independent bundle residency, linked comparison cameras and source-plane presentation remain implemented. Manual/bounds-based atlas placement is not patient registration.

Beginner / Explore / Evidence learning adapts to selected reference structures, CT and SEG context. Eight-second introductory materialization can start while loading and settles into Scientific; Holographic remains selectable. Skip and reduced motion are explicit user choices. The Controls workspace exposes existing effects. H000 accumulation preserves source data; 11 GPU volume probes matched and source-plane CPU checks passed. Male/female, missing female chunk recovery, and zero-renderer teardown passed at documented scopes.

NRX H000 SEG extraction is a wasm32 R002 derivative (70,096 triangles in its source fixture), separate from the native Wasm64 field path. It is **not** whole-scan organ segmentation. Whole CT display is direct volume rendering. Fine features may be lost by smoothing; authoritative SEG and original stored values remain separate.

## How to review and reproduce

The source includes the lockfile. With supported Node and approved installed dependencies, run the seven named `test-*.mjs` scripts from `three-prototype/`; `test-study-accumulation.mjs` additionally takes an authorized H000 `source-binding.json` path. Historical successful results are in `evidence/AUTOMATED_RESULTS.json`.

`npm ci` is a separate dependency acquisition action; do not run it without your environment's permission. `npm run build` builds source when dependencies are present. It does **not** make a complete standalone distribution: Vite has `publicDir:false`, and required runtime assets must be supplied through a reviewed packaging step matching `EXPECTED_RUNTIME_MANIFEST.json`. This branch does not automatically fetch or redistribute them.

For fixture-only tests, `DICOM3D_H000_FIXTURE` is a local H000 directory with a trailing separator, and `DICOM3D_ABDOMEN_FIXTURE` is the admitted male abdomen GLB. Do not substitute private studies into public evidence.

## Remaining boundaries

- Male 416 held entries and female 305 held relationships remain unresolved; counts do not mean missing organs.
- Exact expanded BodyParts3D 4.3i redistribution terms still need reconciliation: current publisher CC BY 4.0 evidence and historical version-specific BY-SA 2.1 JP notices differ. No permission is inferred by this source push. No expanded atlas GLBs or private runtime ZIP uploaded here.
- General anatomy is an independent reference, never an inferred patient-specific organ or segmentation.
- No qualified live IRIS frontend admission, newly qualified Core installer/IPM/Docker release, arbitrary-study organ provider, or actual installed-update/rollback claim.
- Broader atlas/accessibility qualification, clean distributable asset inventory, and deployment remain separate gates.

The original Babylon application, public v0.6.5 release, private data and running local preview remain preserved.
