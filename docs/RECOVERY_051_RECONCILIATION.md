# Recovery and publication reconciliation — October 19, 2026

Maturity: prototype/research installation recovery. Main baseline: `efdb0cafcd41543bd49c64728c5b0db371ecab61`. The [branch policy](BRANCHES.md) preserves experimental history separately. No historical tag, archive or checksum is replaced.

## Separate findings

**Docker startup — reproduced.** A fresh root-owned durable volume reproduces `ERROR #5001: Cannot create target: /durable/iris/` on community 2026.1.0.235.2. Explicit preparation for the image's nonroot UID fixes this mechanism. The original moderator environment has not been modified or independently inspected.

**IPM installation — reproduced host prerequisite.** A healthy stock image still denies creation of the default IPM package directory. Preparing only DICOM3D's IPM/CSP targets allows the frozen v0.5.0 archive to activate. The optional recovery host makes these exact destinations writable/durable without broadening IRIS roles or permissions. The moderator's separate IPM failure log is unavailable, so this reproduced mechanism is not asserted to explain every aspect of his install.

**Publication — timeout notification with completed registry publication.** The October 18 failure notification says only `ERROR #5922: Timed out waiting for response`. Read-only checks now find registry 0.5.0, published approximately two seconds after that notice, with a downloadable 67,693,922-byte archive. All 404 registry member Git blobs match the released source commit `504becd40ac772ec61560b10ae793d3572e56205`. It is a repository-source package, not the frozen GitHub TGZ wrapper; its installed FileCopy payload matches. It independently activates locally.

The OEX page displays 0.5.0 but its archive button still points to 0.1.0. This is a real listing-link mismatch, separate from registry installation. No listing or registry write was made. Correcting that field/publication remains operator-approved work after release review.

**UNVERIFIED:** which OEX HTTP request timed out, its caller timeout, processing/network breakdown and deployed backend revision. The email contains no request trace. A package-size cause is not demonstrated. Local IPM `PublishTimeout` settings do not establish or repair the OEX caller's timeout. No speculative timeout or dependency change was applied.

## Inspected publication implementation and cost

[Official OEX IPM instructions](https://docs.openexchange.intersystems.com/apps/ipm/) require a public repository and root module.xml. Inspected [registry source](https://github.com/intersystems-community/zpm-registry/tree/b170bdba23d53f4c5d8f476e859f17ae2124287a) downloads the repository's default branch for publication; its metadata helper contains a separate hard-coded master path. That source revision is not proven to be the public deployment. Exact observed package/source byte matching is stronger evidence about this publication than assuming deployed internals from upstream code. There is no evidence that an uploaded GitHub release TGZ is automatically used by OEX.

Frozen GitHub TGZ: 65,731,281 bytes; uncompressed tar: 117,155,840 bytes. Male/female source GLBs remain 47,348,364 / 67,539,748 bytes. Independently gzipped members contribute approximately 28.68 / 36.55 MB; these estimates are not additive tar-stream accounting. Whole-stream gzip levels 1/6/9 produce 85,478,337 / 67,316,895 / 65,731,281 bytes in approximately 0.77 / 1.93 / 3.45 seconds on the qualification host. All decode losslessly. Level 9 already matches the frozen artifact exactly. No useful large duplicate atlas was found. Anatomy remains bundled and offline-capable; no external-asset architecture change is justified by this evidence.

## PR reconciliation and proposed cleanup (approval required)

| Reference | Actual content and preservation | Proposed disposition |
|---|---|---|
| PR #1 / `d9df225828c9a2512168d0d4539134b9b1f81030` | Published v0.2.0 status is already represented in current README, changelog, roadmap and H002 documents. Older full-tree replacement would regress later work. | Retain draft/branch now; recommend superseded closure only after operator review. |
| PR #2 / `9e13d8759dfec0ec6169376ef93cb271c4309f43`, `417fba8ad6b813f02ce80e478e0b5435bd832fb5` | Its publication wording remains useful. Current recovery documentation records GitHub v0.5.0 and later DEMO-050 separately, without rewriting frozen prepublication records. | Retain draft/branch now; content is reconciled here, closure requires approval and accepted integration. |
| Merged PR #3 / `cbdd8723f568065f13c2484c488c83831a6a8084` | Its final tree equals main `efdb0ca`; all six raw commits survive on the retained branch and squash integration. | Potential branch deletion only after approval. |
| `codex/h002-slice-expansion` / `38ed849349abbe2ef4ba8cc04244173777616b7a` | Ancestor of main, no unique commits. | Potential deletion only after approval. |
| `codex/v030-visual-experience` / `2d32518dd310c30698e7177107b31d96a4063253` | Both original commits remain directly reachable from permanent `experimental`. Main contains later visual implementation; no old snapshot merged into recovery. | Retain original branch now; deletion requires approval. |

GitHub v0.5.0 was published October 18, 2026. The separate [DEMO-050 deployment](https://github.com/KennethJSmithDev/DICOM3D/actions/runs/39166437377) subsequently completed. These facts do not retroactively enlarge installed-package or clinical qualification. Historical release records stay unchanged.

## Promotion boundary

Review recovery → main only after the final exact-archive receipt passes. Main integration, v0.5.1 tag/release and OEX/IPM publication are separate approval gates. The existing Pages workflow reacts to main/viewer changes; preserve the independently deployed demo and review any resulting deployment before claiming it was updated. No branch deletion or draft PR closure is included in candidate qualification.
