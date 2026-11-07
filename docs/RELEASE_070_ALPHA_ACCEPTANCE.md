# v0.7.0-alpha.1 — Anatomy & Imaging Foundation

DICOM3D is an open-source interactive anatomy and medical imaging platform. This snapshot describes a local research-alpha candidate, not a public release or a clinically validated diagnostic product. Build, installed runtime, browser qualification and publication are separate claims.

## Exact identities

Application/packaging source: `623d81bcab9081a0522281be36a698d16ecbda4b`. Later documentation-only commits do not change this runtime identity.

| Artifact | SHA-256 or image ID | Scope |
|---|---|---|
| IPM `dicom3d-0.7.0-alpha.1-002.tgz` | `6b4215b78134df6f1d9189072e7b7b1b0b639bfe59c9687ea730ca2405070d18` | Final source; fresh load after prior uninstall, activation, authenticated female compound and H000 browser checks passed |
| Safe Demo `dicom3d-0.7.0-alpha.1-safe-demo.zip` | `b36566266ad7441e63326197dc042194bcc0754681972abd75b6b954fe8d4368` | 150,526,764 bytes; 87 extracted files verified; headed WebGPU and forced WebGL2 witnessed |
| Local Docker Core image | `sha256:ebca2fb8be5ee11f9e6bc74c48b335b8174c17d94b9f9c36513216ef01e597a4` | Final runtime source `623d81bcab9081a0522281be36a698d16ecbda4b`; all 86 HTTP payloads and manifest match staged IPM bytes |
| Source-native atlas index | `574feef9e1e659a644cf51a51042e8c65b6433455b95070b7ae89aa681357478` | Unchanged accepted geometry/catalog input |

These are local artifact identities, not download URLs or registry tags. This snapshot does not establish that GitHub, Pages, Docker Hub, IPM registries or Open Exchange distribute them.

## Qualification matrix

| Area | Status | Evidence boundary |
|---|---|---|
| Pinned source recovery | PASS | 17 original files recovered plus 16 exact geometry aliases; old geometry and transforms preserved; 27/27 earlier affected compounds remain exact |
| Source-native selection mechanism | PASS | 19,189 lookup/key cases, all 60 HRA components, collision isolation, source IDs and restoration at recorded scope |
| Female metadata and Learn | PASS | 21 metadata/real-data tests and 25 contextual Learn assertions; excluded/unresolved owners and source-specific attribution retained |
| Headed reference and H000 interactions | PASS, earlier runtime | Edge WebGPU on RX 7900 XT and separately forced WebGL2; source-native picking, isolation/opacity, switching and teardown witnessed before final metadata assembly |
| Final-source headed browser | PASS, scoped | Extracted WebGPU full male, female component/compound isolation and opacity, Learn, Scientific/Holographic/Materialization, H000 and forced WebGL2; zero teardown |
| Docker offline build and runtime | PASS, scoped final image | Two bounded offline builds; pinned base, exact 86-file Core/IPM payload comparison, health, missing-asset 404 and unsupported-method 405. Initial package and final image visible WebGPU H000/NRX, exact source identity, restart and zero teardown passed |
| Final IPM archive installation | PASS | Actual `0.7.0-alpha.1` parsing, load/activation, listing and compiled health class; 204 retired paths already absent |
| IPM uninstall/restart | PASS, scoped packages | Clean removed the three classes and all 87 frontend files for both tested archives; final uninstall left zero frontend files. Restart succeeded through authenticated native Entry |
| Direct static bookmark after IPM restart | PARTIAL | A direct static bookmark returned 404 until the documented Entry/login path was used; preserve this limitation |
| Final Safe Demo extraction | PASS | All 87 extracted runtime files match the exact archive inventory |
| Online Docker build | NOT TESTED | Offline build success does not prove fresh network acquisition |
| Installed upgrade/settings/data rollback | NOT TESTED | Fresh install/uninstall and side-by-side historical runtime rehearsal do not establish an installed upgrade or rollback |
| Arbitrary DICOM or live IRIS/Orthanc retrieval | NOT TESTED here | Prepared local admission and historical retrieval remain separate from a live packaged frontend connection |
| Public deployment/publication | NOT TESTED / unauthorized | No publication follows from these local checks |

These scoped results qualify a reviewable research alpha; they do not establish a public deployment, installed upgrade, every-device performance or clinical readiness.

## Atlas coverage and limits

| Measure | Male | Female composite |
|---|---:|---:|
| Draw owners | 1,205 | 1,235 |
| Source-component occurrences | 2,299 | 2,347 |
| Distinct physical geometry spans | 2,282 | 2,330 |
| Geometry alias records | 17 | 17 |
| Exact PART-OF selections | 1,368 | 1,361 |
| Newly exact 4.3i source-concept selections | 13 | 13 |

These measures overlap and must not be summed as an organ count. Broad owner proxies remain separately identified; the female whole-body compound is intentionally partial. The female context shares BodyParts3D geometry, excludes/replaces nine owners and adds 39 HRA owners containing 60 exact component records with an approximate preserved fit.

The 416 historical review entries are retained history, not 416 currently missing organs. Eighteen source files covering 14 concepts remain unresolved: three overlap cases and 15 laterality/placement cases. They were not mirrored, relabeled or automatically admitted. General references are independent of acquired CT; manual comparison does not establish patient registration.

## Imaging, presentation and resources

The public H000 example preserves 103 CT frames, the original source SEG relationship, source-linked highlight, a display-derived lesion surface and WebGPU direct CT-volume presentation. Eleven recorded GPU sample/interpolation readbacks matched original stored values with zero observed error. These scoped checks do not establish global surface accuracy, thin-feature preservation or whole-scan organ segmentation. The NRX/R002 lesion derivative is not a production organ-segmentation service.

The earlier headed witness exercised contextual Learn, Scientific/Holographic controls, an 8-second Materialization introduction, manual Skip, explicit reduced motion and teardown/remount. One intermittent startup fetch failure remains preserved with unverified cause; later reload success does not erase it.

Earlier bounded resource samples observed approximately 3.53 GiB aggregate owned-process private bytes and 2.33 GiB working set, with approximately 49.3 GiB minimum host free memory. GPU process allocation counters observed approximately 1.99 GiB dedicated and 0.249 GiB shared allocation. These are sampled process observations, not exhaustive campaign peaks, physical VRAM residency or an FPS benchmark. No performance claim transfers automatically to another machine.

## Preservation and next gate

The published v0.6.5 source/artifacts remain the rollback reference. Main README from `101c2185` is preserved byte-for-byte; software stays Apache 2.0, while BodyParts3D/HRA retain their separate CC BY 4.0 attribution and historical notices. Public H000 admission does not authorize private studies, reports or derived patient imagery in a package.

Detailed raw receipts remain in protected local qualification storage under campaign identities `ATLAS-INTEGRATION-004` and `ALPHA-PACKAGING-070-001`; they are not included wholesale in public source. This document is the sanitized evidence summary. The next public gate is independent release review and an operator decision about mainline, Pages and downloadable-artifact publication. Qualified source may advance only to the explicitly authorized experimental branch.

## Hosting transition disclosures

Reusing one loopback origin across Core, IRIS and the static host exposed cached worker headers incompatible with the static host's isolation policy. The source lesion remained available when its NRX derivative failed; clearing the automation-owned cache restored the worker, with no source or security-setting change. One recreated Docker fixture was internally healthy but had no effective host binding; recreating only that read-only, volume-free owned fixture restored the same requested binding. Internal causes of Docker's stale mapping remain unverified. No unrelated service was restarted.

## Separate release verdicts

| Decision | Verdict |
|---|---|
| Development checkpoint | ACCEPTED at the recorded source and test scope |
| Local runtime | QUALIFIED LOCAL; listed startup/cache/host-transition failures retained |
| Installable alpha | Docker Core and fresh IPM qualified at recorded scopes; native MSI/EXE and installed upgrade not qualified |
| Public Live Demo | Candidate static artifact prepared and locally witnessed; existing deployment remains older |
| GitHub release | READY FOR OPERATOR REVIEW; artifacts not uploaded or released |
| Open Exchange/IPM registry | NOT PUBLISHED; local archive does not update public registry downloads |
| Announcement | Factual draft below; wait for the exact intended public surface to be updated and read back |

A new visitor can explore the existing public alpha and find historical install routes, but the newly qualified artifacts and source-native coverage are not yet the public demo. A sponsor can identify the platform and sponsor link; the smallest launch improvement is to link this acceptance/launch guide and current captures from the preserved README after review, then publish/read back the specifically approved artifacts and demo.

Factual announcement draft: DICOM3D's Anatomy & Imaging Foundation alpha advances source-backed male/female-composite exploration, exact component and compound selection, contextual learning, an introductory materialization effect, and public H000 source-linked CT/SEG visualization through Three.js/R3F with hardware WebGPU and separately tested WebGL2. Fresh local Docker Core and authenticated IPM installations were exercised. Funding supports usability, independently reproducible installation, anatomy coverage and interoperability work; live PACS admission, whole-scan organ segmentation and clinical validation are not claimed.

## Candidate captures

All four captures are from the exact `623d81bc` runtime in headed Edge WebGPU on the RX 7900 XT. The normal desktop window reported 1,898 × 990 CSS pixels, DPR 1.25, 125% Windows scaling and inferred 100% browser zoom. No device emulation was used. The female image shows the shared-base composite with an exact 10-component uterus selection; it does not claim a separately modeled female body.

- [Male Scientific](images/visual-070-male-scientific.png)
- [Female composite and source selection](images/visual-070-female-composite.png)
- [Public H000 CT/SEG and 3D](images/visual-070-h000.png)
- [Male Holographic](images/visual-070-male-holographic.png)

The root README, including its 480px logo, navigation and historical captures, remains the restored main version. These new assets are prepared for a surgical README update; they do not replace its images automatically. The current public atlas readback remains 1,186 owners/15 bundles (index SHA-256 `8e3b71c6eb259a55532d8b3f45a58057eedbc587857ebb99c2efab4ca4c7faac`); its manifest URL returned 404. Neither source push nor local artifact qualification changes that deployment.
