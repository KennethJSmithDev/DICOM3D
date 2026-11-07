# Cloud development continuation

**Development branch:** `experimental`. **Application label:** `v0.7.0-alpha`.
Use the existing configured cloud workspace. Do not create another deployment environment or permanent development branch.

## Execution contract

- All three workflows on `main` and `experimental` are manual-only (`workflow_dispatch`). Do not enable push, PR, schedule or workflow-run triggers. Do not dispatch Actions for ordinary development or qualification.
- Build, test and use Playwright inside the configured cloud environment. No access to the operator's local workstation is required.
- Preserve the published frontend and the v0.6.5 release. Push reviewed, public-safe progress to `experimental`; promotion to `main` and deployment are separate explicit decisions.
- Continue through ordinary fixes, tests and checkpoints within a finite declared budget. Checkpoint and continue; do not request approval after every PASS.
- Stop at credentials, private data, paid infrastructure, destructive actions or material architecture/license decisions. Continue independent work when one integration is blocked.

## Source checkpoint

The starting product snapshot is `a534b99bf949802898045401939103468596f967`; manual-only workflows are recorded at `a805de3e46cd5388a4be9b6544c1b3db8e359d11`. Fetch the actual current `experimental` head before starting and preserve any newer work.

The available remote atlas is 1,186 male owners and a 1,184-owner female composite using a seven-owner HRA supplement. Later local source-native expansions are not recovered or implied by this work.

## First implementation: female metadata and attribution

`female-catalog.mjs` now composes metadata from existing admitted sources. The scene loader calls it and retains small per-bundle attribution records rather than discarding the source relationships and holds.

- Existing IDs, system arrays, geometry bundles and transforms remain unchanged.
- Relationships retain original owner IDs while exposing only selectable owners. Excluded, unresolved, partial and unmapped records are distinguishable.
- An excluded BodyParts3D bladder relationship is not silently remapped to the approximately fitted HRA bladder.
- Base-source holds remain base-source records, not a missing-female-organ count. Missing HRA hierarchy/hold inventories are reported as not supplied, not as verified complete coverage.
- Inspector and Learn attribution follows the selected BodyParts3D or HRA source. An unselected composite exposes both notices.

### Evidence already obtained

An isolated Node.js 22.16.0 harness passed 20 synthetic metadata/learning tests and the existing contextual Learn regression script (which reports 25 assertions). `female-reference.js` and `learn-context.mjs` passed syntax checks; `FemaleInspector.jsx` passed JSX transpilation. Three original Learn source/dependency blobs were checked against pinned Git blob IDs before modification. No geometry files, datasets, package versions or dependencies were changed.

**Not yet established:** fresh-clone full Vite build, actual expanded-catalog projection, geometry loading, browser rendering or user interaction for this new metadata candidate. These require the next cloud run, not GitHub Actions. Do not inherit a browser PASS from the previous deployed alpha.

## First cloud gate: qualify the current change

Inspect existing repository instructions and runtime tools; reuse installed dependencies when consistent with the lockfile. From `prototypes/alpha/three-prototype`:

```sh
node --test test-female-catalog.mjs test-female-learning.mjs
node test-learn-context.mjs
```

Then run the existing alpha contract suite, including `test-verified-volume.mjs` and `test-study-accumulation.mjs` with the approved public H000 binding. Build the expanded profile into a fresh output directory with `build-public-review.mjs`.

Use the actual checked-in index and supplement manifest to verify unchanged owner counts, no dangling selectable owner IDs, preserved holds, and explicit partial/unavailable relationship dispositions. Do not infer anatomical completeness from label counts.

Reuse `scripts/test-alpha-browser.mjs` and the approved Playwright runtime. Serve the exact build on loopback, record source/asset identities and use an owned browser. Add visible checks for a BodyParts3D heart and an HRA uterus in the female composite, their source links in Inspector and Learn, retained relationships/holds, excluded owners, male/female switching and teardown. Keep actual backend evidence separate: software WebGL2 is not hardware WebGPU qualification.

## Continue the agreed imaging campaign

After the metadata gate, inventory the existing DICOM parsing/decoding in `viewer/src/` and its alpha adapters before adding dependencies. Generalize supported original-DICOM CT admission and source-linked SEG handling beyond the fixed H000 fixture using established parsers and explicitly supported transfer syntaxes. Do not write a new general parser without demonstrating a missing capability.

Preserve original UIDs, frame/segment relationships, stored values, calibration and coordinate conventions. Test independent public/synthetic studies, ordering, rejected mixed identities, malformed inputs, cancellation and correspondence between source pixels and displayed geometry. Do not infer patient organs from the reference atlas.

Prepare DICOMweb and native FHIR R5 integration against independently owned test fixtures when available. Reuse IRIS mediation and PACS storage authority. An unavailable service or credential is a scoped blocker, not permission to mock an end-to-end PASS. No Health records, clinical systems or external AI providers are needed for this campaign.

Finish each meaningful milestone with a clean remote checkpoint, tests, measured resource use, limitations and the next runnable step. Keep the README's existing branding; keep older screenshots labeled legacy until version-matched captures are accepted.
