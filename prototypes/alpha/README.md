# DICOM3D v0.7.0-alpha.1 source checkpoint

DICOM3D is an open-source interactive anatomy and medical imaging platform. This is the existing React 19.2.7 / Three.js 0.180.0 / R3F 9.6.1 prototype, with Vite 8.2.4; the current source-native integration preserves its renderer and scientific source contracts.

Current release-candidate qualification and installation: [acceptance snapshot](../../docs/RELEASE_070_ALPHA_ACCEPTANCE.md) and [launch guide](../../docs/LAUNCH_070_ALPHA.md). These distinguish local artifacts from the older public deployment.

## Preserved earlier alpha origin

- Preserved dirty-worktree base: `355570e3f250c4c4644deabd39c675f466eea7ec`; that commit alone is not the candidate.
- Final source recovery ZIP SHA-256: `d800910a3f7c52ed0d70e4b4d613ceacd253491c0a17a244bcf7fe5b39586640`.
- Final local runtime ZIP SHA-256: `58d932424eecbb300cbea04154eb4d38c8ea85a2a14e146a4b068c494dc3c01e`.
- Exact final runtime manifest SHA-256: `58041de7f3a71d91e036b1e12c3f16c20b1df2d46af5b71ced0ddb0ae9db047b`; 54 runtime files, extracted hash readback passed.
- Five local builds and one headed Edge session in the closed alpha pass. Final directory was browser tested; extracted archive bytes matched, but its separately launched URL was not browser tested.

The source manifest records portable path changes. In particular, the NRX C++ include is repository-relative and two local fixture tests take environment variables. Original source and receipts remain immutable locally. `SOURCE-HASHES.json` inside the historical NRX bridge describes its original checkpoint, not these portability-only adapter/test edits.

## Functional, at the recorded scope

WebGPU is primary; forced WebGL compatibility is preserved. The current source-native candidate has 1,205 male draw owners and 1,235 female-composite draw owners, in 17 independently loadable male bundles plus the HRA supplement. Male/female catalogs contain 2,299/2,347 source-component occurrences, 2,282/2,330 distinct geometry spans and 1,368/1,361 exact PART-OF selections. These categories overlap and must not be added into a structure count. The 706 broad owner proxies are separate; exact components and compounds use geometry membership rather than proxy substitution. Skin is hidden by default. Independent bundle residency, linked comparison cameras and source-plane presentation remain implemented. Manual/bounds-based atlas placement is not patient registration.

Beginner / Explore / Evidence learning adapts to selected reference structures, CT and SEG context. Eight-second introductory materialization can start while loading and settles into Scientific; Holographic remains selectable. Skip and reduced motion are explicit user choices. The Controls workspace exposes existing effects. H000 accumulation preserves source data; 11 GPU volume probes matched and source-plane CPU checks passed. Male/female, missing female chunk recovery, and zero-renderer teardown passed at documented scopes.

NRX H000 SEG extraction is a wasm32 R002 derivative (70,096 triangles in its source fixture), separate from the native Wasm64 field path. It is **not** whole-scan organ segmentation. Whole CT display is direct volume rendering. Fine features may be lost by smoothing; authoritative SEG and original stored values remain separate.

## How to review and reproduce

The source includes the lockfile. With supported Node and approved installed dependencies, run the named `test-*.mjs` scripts from `three-prototype/` and the source-native tests under `tests/` (the loader contract and recovery tests require `--experimental-vm-modules`); `test-study-accumulation.mjs` additionally takes an authorized H000 `source-binding.json` path. Historical successful results are in `evidence/AUTOMATED_RESULTS.json`.

`npm ci` is a separate dependency acquisition action; do not run it without your environment's permission. `npm run build` builds source when dependencies are present. It does **not** make a complete standalone distribution: Vite has `publicDir:false`, and required runtime assets must be supplied through `build-public-review.mjs`, which verifies the current catalog, bundle and supplement hashes. `EXPECTED_RUNTIME_MANIFEST.json` identifies the earlier alpha package, not a newly built successor. This build does not automatically fetch sources.

For fixture-only tests, `DICOM3D_H000_FIXTURE` is a local H000 directory with a trailing separator, and `DICOM3D_ABDOMEN_FIXTURE` is the admitted male abdomen GLB. Do not substitute private studies into public evidence.

## Remaining boundaries

- The 416 historical source-review records remain preserved. Of the most recent 35 residual files, 17 were recovered from pinned BodyParts3D 4.3i geometry, supporting 13 exact versioned source concepts; 18 remain held (3 overlap, 15 laterality cases). Sixteen versioned aliases reuse exact existing spans. No disputed geometry was mirrored or relabeled. Female whole-body membership remains intentionally partial where male-specific anatomy is excluded.
- The expanded BodyParts3D assets and HRA delta are CC BY 4.0. DICOM3D code is Apache 2.0.
- General anatomy is an independent reference, never an inferred patient-specific organ or segmentation.
- No qualified live IRIS frontend admission, arbitrary-study organ provider, native MSI/EXE, or installed-update/settings/data rollback claim. Fresh alpha Docker Core and isolated IPM results are recorded separately in the acceptance snapshot; registry publication remains separate.
- Broader atlas/accessibility qualification, clean distributable asset inventory, and deployment remain separate gates.

The original Babylon application, public v0.6.5 release, private data and running local preview remain preserved.

## Test the shared atlas on another machine

This profile builds the current 17 semantic BodyParts3D bundles, the separately verified 42.1 MB HRA supplement and the public H000 example. The male view has 1,205 draw owners and the female composite has 1,235; source-native selection counts are described above. All individual assets remain below 100 MB. See the [expanded atlas license and attribution](three-prototype/expanded-atlas/LICENSE.md).

From the repository root, with Node 24 and npm:

```sh
cd prototypes/alpha/three-prototype
npm ci
node build-public-review.mjs ../review-dist
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --outDir ../review-dist
```

Open the printed URL and select **Female · composite**. Search for the uterus, ovaries or uterine tubes, then select the male view to compare. Use a new output directory each time you build. Use `build-public-review.mjs` for this source-native candidate. The historical `package-composite.mjs` targets an older package and must not assemble this candidate.

Both variants use the BodyParts3D body envelope, skeleton and shared organ geometry. The 39-owner HRA supplement includes female reproductive anatomy and additional source-backed organ subtrees, and replaces the bladder. It exposes 60 original HRA components with explicit component selection keys distinct from their compound keys. The composite omits identified male-specific owners, including the prostate, urethra, testes and penile vessels when present in the base. The HRA placement is a translation fitted to the shared bladder center. The female pelvis and exterior body shape still use the shared base, and its approximate placement is not a registered female body reconstruction. The standalone NRX ovary fixture requires the expanded local runtime.

The HRA delta comes from Human Reference Atlas / HuBMAP female united reference v1.5 by Kristen Browne and Heidi Schlehlein under CC BY 4.0. The delta preserves named organ subtrees, applies a translation in metres, and preserves original exported attribute/index arrays. See [source notice](three-prototype/atlas-delta/HRA-FEMALE-NOTICE.txt) and [current supplement descriptor](three-prototype/atlas-delta/female-delta.json). Shared BodyParts3D assets retain their existing attribution and license notice.
