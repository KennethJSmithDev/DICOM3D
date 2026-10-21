# Public data policy — v0.6.0 build profiles

The owner has admitted **exactly five unchanged H000 files** as an optional acquired research CT/SEG study in the `curated-h000` Safe Demo web profile. This current decision is separate from the original reference-only v0.6.0 release and the files' historical local-candidate assessment. Exact build, browser and deployed-byte qualification remain separate evidence steps; admission is not a claim that deployment has completed.

The default `reference-only` profile and baseline Core/native installations exclude H000. Runtime queries, browser preferences and arbitrary URLs cannot extend a build profile's data ownership.

## Generalized references and branding

Both profiles retain seven reference objects byte-for-byte:

- `bp3d-male.glb`, `bp3d-male.manifest.json`, `bp3d-source-members.json`, `BODYParts3D-NOTICE.txt`.
- `hra-female.glb`, `hra-female.manifest.json`, `HRA-FEMALE-NOTICE.txt`.

These live under `reference/public/reference/`; two semantic-cube SVGs under `reference/public/brand/` are application branding. Generated HTML/JavaScript/CSS and software/third-party notices are inventoried separately. BodyParts3D and HRA retain their independent identities, coordinates, coverage and licenses. They are not registered to each other or to the acquired study.

## Exact current H000 admission

Portable owner decision: `H000-SAFE-DEMO-060-FIVE-FILES`, implemented in `viewer/src/public-h000-admission.mjs`. Preserved decision receipt SHA-256: `7ef56b825f0b8bfffacecdb0f556a91a3454d718b611450f0577ccd23bd474bf`.

Only these source paths beneath `reference/public/demo/h000/` are admitted. Web URLs use `demo/h000/` beneath `/DICOM3D/`.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `ct.npy.bin` | 32,972,849 | `645c9ebaf383bb447e415e0a400973aabb2da50e147033fb710180fa0b179b88` |
| `mask.npy.bin` | 28,346 | `44c55da565e520ee2d1eee25710650d23ada10bfb510c2e39e1cabb06ec0399c` |
| `lesion.glb` | 263,976 | `0e77bfb887791614b5fcb15c614c4948ae4d48e24ab6e9fa289aa0603c66076d` |
| `source-binding.json` | 22,129 | `605073678ef244b7ebd44995d01789e79f5cb31a715c66a21d4b76b12161d73e` |
| `NOTICE.md` | 3,865 | `0dfff975e61696fd4b570e32b38e84ef4515ebb812906196169aab0818081d2a` |

Total: **33,291,165 bytes**. The two `.bin` objects retain their exact gzip containers. Native decoding is bounded and verifies stored and decoded identities. No H000 object is requested until the visitor explicitly chooses the study action or its source-notice link. Loading the study requests the five fixed same-origin objects without credentials, redirects or fallback URLs.

The immutable `source-binding.json` and `NOTICE.md` continue to say local candidate / publication not authorized by that artifact. Their exact historical bytes are retained. The current application-owned admission authorizes this five-file web scope; loader metrics expose both records independently. Historical metadata is not rewritten to manufacture a newer assessment.

## Source credit, policy and scientific limits

The study derives from [QIN LUNG CT](https://doi.org/10.7937/K9/TCIA.2015.NPGZYZBZ) and [QIN-LungCT-Seg](https://doi.org/10.7937/K9/TCIA.2015.1BUVFJR7), provided through TCIA under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Full author/title citations, source links, derivative changes and limitations remain in the unchanged [H000 notice](../reference/public/demo/h000/NOTICE.md). Data licensing is separate from software licensing; no source endorsement is implied.

Retain dataset attribution, DOI/license links, transformation disclosures and the [TCIA use policy](https://www.cancerimagingarchive.net/data-usage-policies-and-restrictions/) downstream. Do not identify or contact participants or create readily identifying representations. Public aliases and source UIDs provide provenance, not authority to identify a person. Existing bounded visual screening is not comprehensive privacy certification.

The study contains 103 acquired CT frames and one source segmentation, `lesion.lung.mass.001`. Stored values, source-mask membership, semantic identity and patient/model transforms remain authoritative. Display windowing, materials, particles, camera and clipping are presentation choices. No new segmentation, whole-lung model, diagnosis, calibrated-HU claim, report, reference registration or clinical qualification is established.

## Material that remains excluded

- The separately assessed CT screenshot, other patient-study screenshots and renamed copies. Screenshot SHA-256 `fcfdacfeaf8fd78e929f313a7d33abf34e214de6b2ad3c813ecf2ebcade13335` is denied regardless of filename.
- Raw DICOM, additional NPY/NPZ volumes, private fields, original research receipts, local paths and caches.
- Arbitrary patient import, caller-selected study URLs, private connections and Connect/FHIR provider UI.
- Unknown H000 files, changed bytes at admitted paths, admitted bytes under different paths and synthetic demo fixtures in the landing experience.

Hidden content is still public if present in Git or the deployed artifact. The curated Git-index check permits only the five exact source paths and bytes. All other payload/screenshot paths and renamed admitted-byte copies are rejected. The build disables Vite automatic public-directory copying and copies only named assets. Failed admission stops the build.

## Qualification and installer boundary

```powershell
# Optional curated Safe Demo; Pages base only.
node scripts/build-demo.mjs --profile curated-h000
node scripts/test-demo.mjs --profile curated-h000
node scripts/test-public-research-data.mjs
# After staging the complete intended Git publication set:
node scripts/test-publication.mjs --profile curated-h000

# Reference-only default for Core/native frontend preparation:
node scripts/build-demo.mjs --base /dicom3d/ --out-dir <new-reference-output>
node scripts/test-demo.mjs --base /dicom3d/ --out-dir <new-reference-output>
```

The curated profile is rejected with the installer base. Frozen installer artifacts and source remain separately identified; this follow-on web branch does not regenerate their prebuilt frontend, module mapping or source manifest. Reproduce installers from their recorded source snapshot.

Tests establish bounded static/data claims. Browser verification separately covers explicit loading, rendered pixels/overlays/plane, selection, contextual learning, disposal, desktop interaction and notice access. Publication requires exact deployed-byte and actual rendering readback. See [Safe Demo](SAFE_DEMO.md) and the current addendum in [publication procedure](VISUAL_PUBLICATION_PROCEDURE.md).
