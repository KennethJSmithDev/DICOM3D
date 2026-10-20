# Public data policy — v0.6.0 reference-only release

The v0.6.0 GitHub/Pages release admits **generalized reference anatomy only**. The separately qualified H000 research candidate has no exact data-publication approval in this release and is excluded.

## Admitted assets

The browser build preserves these seven reference objects byte-for-byte, with exact admitted identities enforced by the build and static tests:

- `bp3d-male.glb`, `bp3d-male.manifest.json`, `bp3d-source-members.json`, `BODYParts3D-NOTICE.txt`.
- `hra-female.glb`, `hra-female.manifest.json`, `HRA-FEMALE-NOTICE.txt`.

Their location is `reference/public/reference/`. Semantic-cube SVGs are application branding. Generated HTML, JavaScript and CSS and application/third-party licenses are separately inventoried output.

References retain their own semantic identities, coordinates, coverage limits and licenses. BodyParts3D and HRA are separate generalized datasets with no patient registration.

## Excluded material

- All five H000 candidate files: stored CT container, segmentation-mask container, derived lesion GLB, source-binding metadata and H000 notice.
- The source-derived CT screenshot and other patient-study images.
- Raw DICOM, private patient identifiers, research receipts, local filesystem paths, caches and unrelated private data.
- Arbitrary patient uploads, remote study URLs, Connect/FHIR provider UI and synthetic demo fixtures in the public landing experience.

Exclusion covers Git publication and Pages output. A hidden UI file is still published if included in Git or the built site. A failed admission check must stop the build rather than serve an alternate dataset.

Inactive research source code may retain already-public TCIA identifiers, hashes and preparation/test logic. Those constants are not the excluded source-binding JSON or imaging payload. The reference-only release emits no study route or study implementation chunks; retaining source code does not approve acquired-data publication.

## Scientific and publication ownership

Source assets own geometry, semantic membership, coordinates and provenance. The renderer owns camera, material, visibility and animation. Effect samples do not replace source meshes or become measurements.

Earlier local H000 source comparisons, privacy screening, licensing research and browser qualification remain in the preserved research record. They do not approve that data for v0.6.0. A future acquired-data release requires its own exact inventory, source/license/notice review, explicit admission decision and bounded qualification. Historical publication flags and receipts remain unchanged.

The [BodyParts3D notice](../reference/public/reference/BODYParts3D-NOTICE.txt) and [HRA notice](../reference/public/reference/HRA-FEMALE-NOTICE.txt) remain unchanged. Software and data retain separate licenses. No clinical, diagnostic, privacy-certification or source-endorsement claim follows from this release.

## Verification boundary

`scripts/test-demo.mjs` checks the reference-only distribution, source/output identity, notices and build declarations. After the complete release index is staged, `node scripts/test-publication.mjs` checks every indexed path and byte identity against the five excluded payload hashes plus the CT screenshot hash; renamed copies are denied too. Reference-effect checks establish bounded semantic/sample ownership. Final-build browser checks and remote readback are separate; see [release scope](RELEASE_060.md) and [publication procedure](VISUAL_PUBLICATION_PROCEDURE.md).
