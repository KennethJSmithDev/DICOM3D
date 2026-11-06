# NRX research checkpoint — 2026-11-06

## Read this boundary first

NRX is experimental native-rendering and field research. The operator explicitly authorized the public `KennethJSmithDev/DICOM3D:experimental` branch for screened NRX and v0.7.0-alpha.1 source review, superseding the earlier private-destination restriction. No default-branch merge, release, Pages dispatch, infrastructure change or production takeover is authorized.

This handoff commit combines selected original NRX source, the frozen native integration snapshot and the independently owned alpha source checkpoint. Use the commit containing this document as the review identity; the post-push receipt names its exact SHA. The preserved native integration base is `cc5c1d9b25776ab055b6a8ac2afa48da63f33904`, with **79 subsequent source files**, all matching the frozen product-pivot manifest. The current root README is intentionally left for the independent reviewer to update in a separate proposed diff.

## Source ownership and inventory

Paths below are relative to this directory. Historical sources are retained, not collapsed into a fictitious single new implementation. Duplicate experiment snapshots preserve stage identity. `SOURCE_MANIFEST.json` binds their original logical names, hashes, publication hashes and portability changes.

| Capability | Authoritative source | Maturity / status | Evidence and limits / consumer |
|---|---|---|---|
| Direct CT slice, native lifetime baseline | `c001/source/`, `c001/tasks/task-1/continuation-001/source/` | Research / historical scoped PASS | Genuine Wasm64/direct WebGPU slice baseline; not full product proof. Later CT targets reuse its ownership path. |
| Full CT stored-value volume | `c001/tasks/task-2/source/volume.cpp`, `shader.mjs` | Qualified research component / PASS at fixture scope | H000 512×512×103 uint16 values in R16Uint; historical complete upload/readback, 65,536 probes and four matched views. Fresh later-target compile and visible rendering below. Not segmented whole organs. |
| Source-linked SEG and CT plane | `c001/tasks/task-3/source/`, final `c001/tasks/task-6/study/source/` | Prototype / scoped PASS | Source-linked mask projection/plane, picks and source identity; geometry is a bounded mask representation, not a general lung model. Fresh native study visible/pick/teardown PASS. |
| R002 paired-field extraction core | `c002/tasks/task-3/reuse/`, `source/r002-adapter.h` | Research / bounded PASS | Exact donor commit `8b7dfd9ac9b25d2de889072fd88f8c85f39df230`; signed paired constraints, canonical tetrahedral identities, intersection/topology checks and allocation tracking. Not a general clinical mesher. |
| Source-mesh to signed field | `c001/tasks/task-4/source/field.h`, `c002/ingest.py`, `c002/tasks/task-2/source/field.h` | Qualified bounded research / PASS | Three eligible closed HRA fixtures, BVH nearest distance and parity checked independently. Unsupported open, nonidentity/grouped, intersecting or large inputs rejected; no geometry repair. |
| N32/N64 dense and sparse paths | same field headers | Research / PASS at six fixture/resolution cases | N means **grid resolution**, not ABI bitness. Dense/sparse sample and canonical mesh equality; source-metre transforms reversible. N64 error is sampled, not global Hausdorff or thin-feature guarantee. |
| Immutable ownership and publication | field headers; `reuse/lifecycle.h` | Research / scoped PASS | Generation/revision rejection, retained readers, publication and failure gates. Linear Wasm capacity remaining allocated is not an owner leak or proven physical release. |
| Local brush/smoothing/undo | `c002/tasks/task-3/source/editor.h` | Prototype / scoped PASS | Eight bounded immutable histories, quartic brush/Jacobi smoothing; 8 dirty regions regenerated, 504 retained, local/full geometry equality. Fresh actual brush and undo buttons passed. Intentional field edits, not source changes. |
| Packed field representation | `c002/tasks/task-4/investigate.py` | Storage experiment / historical PASS | Exact reconstruction including halos, metadata/index costs counted. Not adopted as compressed active edit residency; dense editable controls remain about 2.2 MB. |
| Native CT + anatomy composition | `c002/tasks/task-6/site/workstation.mjs` and `index.html`; original hosts above | Prototype / fresh scoped PASS | Separate acquired/reference contexts; both visible, source-linked selection and learning; no atlas registration. Static complete fixture site remains local. |
| Supplied-canvas product bridge | `native-workstation/viewer/src/native-session.cpp`, `.ts`, `renderer-contract.ts` | Prototype / phase 1–2 historical PASS | Host-scheduled native WebGPU, CT integration, joined disposal; does not replace product source in this branch. |
| Native reference catalogs | `native-workstation/viewer/src/native-reference-*`, `native-glb-source.mjs` | Prototype / PARTIAL | 33 male structures / 22 female semantic structures in that older checkpoint, 55 identities checked. State/readback PASS; actual opacity framebuffer threshold FAIL; subsequent HRA pixel/resize checks NOT TESTED. Different scope from expanded alpha atlas. |
| PBR/FX, broader native workstation parity | Native phase 4–7 plans | Deferred / NOT TESTED | No implemented/qualified phase claim inferred from plans. |
| NRX-to-Three reference CPU bridge | `../../prototypes/alpha/three-prototype/src/nrx/` and `nrx-reference/` | Consumer prototype / scoped prior evidence | Uses Task 2 Wasm64 field exports and restores recorded source transforms; it does not initialize NRX's native GPU renderer. Some generalized source fixtures only. |
| NRX-to-Three SEG bridge | `../../prototypes/alpha/three-prototype/src/nrx-seg/` | Consumer experiment / PARTIAL | Separate wasm32 occupancy adapter, not Task 2 ABI. Historical negative winding corrected in consumer; smoothed single-voxel feature disappears. No global surface accuracy proof. |
| Standalone Vulkan / D3D12 / native OS renderer | None found in inventoried NRX source | NOT IMPLEMENTED in this checkpoint | Browser WebGPU may use platform APIs underneath; that is not an independently implemented NRX Vulkan/D3D12 backend. |
| General NRX Core library/package | Core mechanisms exist in the modules above | Research / no separately qualified distributable Core package | Do not confuse missing packaging/bridge with missing extraction implementation. |

## Fresh verification

Two original-source compiler commands ran with existing Emscripten **5.0.6**, Emdawn port package **20260720.160313**, C++17, wasm64, one compiler job, initial Wasm 256 MiB and maximum 2 GiB. Full commands and raw logs remain in the local review receipt. No dependency installation or toolchain change occurred.

| Target | Build time | Peak process private commit | Peak job private commit | Output SHA-256 |
|---|---:|---:|---:|---|
| C001 Task 3 native study | 3.693 s | 92,942,336 B | 111,124,480 B | `057e2941e70418edb76a5d3a81cf8670656b273b5037335249d395ce155dc181` |
| C002 Task 3 editable field | 8.135 s | 118,386,688 B | 137,072,640 B | `15bce67c08236fbefb7120013e75e5dbe71ce730d5da2ca8e79e8d7c6f3b6436` |

Both reproduce the accepted historical Wasm hashes exactly. Compilation is separate from the visible witness: the browser used the hash-verified retained final C002 site, whose native modules have those identities.

Fresh headed **Edge / WebGPU / AMD Radeon RX 7900 XT**, normal desktop window, CSS viewport 2040×1020, DPR 1.25 and visual viewport scale 1. Screen reports 2048×1152 CSS pixels. These are observed browser metrics, not proof of an OS scaling setting or a physical pixel capture size. No mobile/device viewport emulation used.

Study ready 1,819 ms; both contexts ready 5,173 ms in this single run. CT/SEG and reference field are visibly rendered in retained captures, not inferred from draw counters. Picks returned `lesion.lung.mass.001` and `VH_F_right_ovary`; brush and undo advanced revisions; contextual learning returned three entries. At close: native live=0, bridge objects=0, pending=0; study 8/8 and anatomy 15/15 tracked resources destroyed; no recorded GPU/page errors. This is one fresh repetition, not a new stress campaign.

Witness elapsed 11.595 s, Windows job peak process private commit **876,347,392 B**, peak aggregate private commit **1,802,543,104 B**. These are measured process/job peaks, not RSS and not GPU memory. Physical GPU residency is **UNMEASURED**. No matched speedup claim. Only the new witness browser/server were closed; the alpha preview and unrelated services were preserved.

Readback confirmed **2,222 retained manifest references / 1,826 unique files**, zero mismatches; all **79** frozen native integration source files match. This validates applicability of retained evidence, not a fresh rerun of every scientific assertion. The first reconciliation command's encoding typo was retained, then corrected; no historical failure was erased.

## Reproduction

Run from an isolated checkout with an already configured Emscripten SDK and existing Emdawn port:

```text
python research/nrx/build.py study --emxx <existing-em++.py> --emdawn-port <existing-emdawnwebgpu.port.py> --output <new-study-output>
python research/nrx/build.py editable-field --emxx <existing-em++.py> --emdawn-port <existing-emdawnwebgpu.port.py> --output <new-field-output>
```

The entry point uses a 150-second timeout and one compiler core; run under a local resource-limited process supervisor (4 GiB initial process ceiling, 12 GiB total). It does not install dependencies. The historical export order differed; output hash equality must be checked rather than assumed for a newly configured toolchain.

Independent geometry tests in `c001/tasks/task-4/independent_geometry.py` and `c002/tasks/task-2/independent.py` require retained source fixtures/catalog and captured field meshes. `NRX_HRA_FIXTURE` selects the original hash-bound HRA GLB for ingestion. Their absent local fixture files are explicit dependencies; these tests are **not** advertised as runnable from a bare public clone. `c002/tasks/task-4/investigate.py` requires original sampled fields and writes new packed outputs—use an isolated copy, not the sealed local evidence folder.

Review `SOURCE_MANIFEST.json` to verify published source identities. `WITHHELD.json` records embedded HRA source-mesh headers omitted from older single-fixture snapshots. Later dynamic-input C002 native targets compile without those embedded headers. Raw traces, fixture arrays, all old failed experiments, local tool configuration and full historical receipts remain preserved locally; safe logical evidence IDs are C001 Task2–6, C002 Task1–6, Native Workstation Phase1–3, and NRX checkpoint review 20261106. A public reviewer needs the operator to supply authorized local evidence for full reruns; no private path or medical dataset is required for source review.

## Known failures and limits to challenge

- Native phase 3 selected-heart opacity 0.2 produced framebuffer energy ratio **0.757103890**, failing the harness threshold `<0.7`. Pixel changes are established; multiple overlapping surfaces are only a hypothesis. Alpha publication/depth sorting/material errors remain alternative explanations. Do not lower the threshold to manufacture PASS.
- HRA left kidney capsule rejected 283 forbidden triangle pairs of 9,156 examined; liver exceeded the bounded admission/accessor scope. Do not generalize three admitted fixtures into all-anatomy support.
- Task 4 N64 right-ovary sampled maximum error about 0.182 mm, source pitch about 0.562 mm; features below two pitches are not assured. Left ovary and patella have different pitches/errors. These are sampled approximation checks, not clinical accuracy.
- Native Task6 repaired a partial-initialization ownership leak; failed attempt remains retained. Current fresh zero counters do not erase it.
- R002/Three SEG experiments lose a synthetic single voxel and originally had opposite winding. Their consumer fixes do not qualify native phase3 or arbitrary organ segmentation.
- Native CT logical GPU storage can exceed a baseline because proof buffers and a plane/SEG workload are additional. Wasm capacity and logical GPU buffer totals are not actual resident memory.
- No hardware speedup, all-device compatibility, complete atlas, patient registration, live IRIS packaging or production-readiness claim follows.

## Publication and provenance

All new files are explicitly staged under `research/nrx/`, `prototypes/alpha/` and the top-level handoff. Original product files, README, FUNDING, workflows and releases remain untouched relative to the selected public main base. Pages remains manual-only and restricted to main; no dispatch. The old experimental tip and current public main are retained as parents of the review commit, avoiding a destructive rewrite.

R002 is the existing project-owned CPU experiment at the exact donor identity above; standard C++/Emscripten/Emdawn dependencies remain external. HRA fixture evidence retains Kristen Browne / Heidi Schlehlein, NLM / HRA / HuBMAP attribution and CC BY 4.0 notice; no new raw atlas redistribution. Public H000 captures derive from the already admitted QIN-LUNG-CT/TCIA example and original SEG; existing repository source notices remain authoritative. Alpha anatomical assets are not newly published; its exact-version male licensing question remains open.

The screen covers every newly added source file, file types/sizes, explicit secret patterns and machine-private paths, complete staged file list, asset exclusions, ancestry and workflows. It is a scoped publication check, not a universal secrets or legal audit of all pre-existing history. Historical notices and evidence are not rewritten.

## Next bounded boundary

Independent read-only review should first challenge source completeness, native lifetime semantics, field approximation claims and alpha integration distinctions. Then separately propose the smallest native phase3 compositing witness, asset/licensing closure and packaging work. Do not change accepted alpha/Babylon source or expand architectures during this review. A new root README can be drafted from the branch's actual capabilities, preserving the established product identity and explicitly describing research limits.

## Portable-copy build readback

The published editable-field source and new `build.py` entry point also compiled successfully in an isolated output directory (third build): 4.665 s, peak process private commit 118,272,000 B, peak job 146,321,408 B. Wasm SHA-256 `15bce67c08236fbefb7120013e75e5dbe71ce730d5da2ca8e79e8d7c6f3b6436`. This verifies compilation of the publication copy; no additional browser claim is inferred.

Five dependency-free alpha source tests passed in this new checkout. The system-visibility test could not import `three` because dependencies were intentionally not installed here; its earlier qualified result remains separately recorded. Three trailing-blank-line warnings from unchanged source snapshots are preserved, not repaired for cosmetic diff cleanliness. Nested attributes preserve exact source bytes in Git.
