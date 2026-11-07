# Source-native export repair — private continuation

Continues preserved checkpoint `45b05d7f38afa75161b151343316bb29dec9ddc6`.
`SOURCE_NATIVE_ATLAS.md` records that preceding checkpoint and remains unchanged.
This update is not published and does not replace the normal application.

## Owning defect and correction

`scripts/admit-anatomy.py` skipped two valid BodyParts3D 4.0 OBJ elements because
their native Concept ID and English name headers were blank. Their file IDs,
original geometry and published PART-OF membership tables identify them exactly.
The admission stage now accepts that pinned evidence while leaving the missing
native metadata null. It does not invent an anatomical identity for the element.

`scripts/repair-bp3d-export.py` restores FJ1450 and FJ1656 into one independent
34,340-byte bundle. The previous fifteen GLBs and their manifests are byte-identical.
The original source transform `(x,y,z) mm -> (x,z,-y) m` is unchanged. Atom IDs
are `BP3D40:FJ1450` and `BP3D40:FJ1656`; renderer owner names use underscores
because GLTFLoader sanitizes colons. Published compound membership supplies the
anatomical labels; the elements are not mislabeled as whole organs.

| Coverage category | Male | Female composite |
| --- | ---: | ---: |
| Draw owners | 1,188 | 1,218 |
| Active mesh instances | 1,188 | 1,239 |
| Source component occurrences | 2,266 | 2,314 |
| Distinct physical spans | 2,265 | 2,313 |
| Explicit geometry alias occurrences | 1 | 1 |
| Exact PART-OF selections | 1,368 | 1,361 |
| Partial / catalog-only PART-OF records | 0 / 0 | 2 / 5 |
| Exact IS-A selections | 2,062 | 2,052 |
| Partial / catalog-only IS-A records | 272 / 571 | 266 / 587 |
| Exact native-concept selections | 1,638 | 1,629 |
| Broad owner-proxy records | 706 | 706 |
| Catalog-only native-concept records | 87 | 96 |
| Exact / partial / catalog-only HRA hierarchy | — | 78 / 4 / 991 |
| Distinct concept IDs with an exact representation | 2,960 | 3,023 |
| Native IS-A owner-membership links | 11,951 | 11,838 |
| Distinct native IS-A classifications on owners | 1,597 | 1,581 |

Source views overlap and are not additive anatomical-organ counts. An exact
selection can contain one component or a multi-component compound. Male PART-OF
has 628 multi-component and 740 single-component exact selections. Female shares
1,179 male owners, excludes nine, and adds 39 HRA owners containing 60 meshes.
Its loaded buffers still contain the nine hidden replacements; loaded mesh count
is 1,248, not the active count above. No HRA geometry or fitting transform changed.

## Affected compounds and holds

All 27 previously incomplete male PART-OF compounds now contain their exact
published members. In the female composite, 26 are exact; `PART_OF:FMA20394`
(the source's human-body compound) remains explicitly partial because the
composite excludes prostate and testes components FJ3139/FJ3148/FJ3149.
The new components are present in both variants. This female exclusion is not
converted into a PASS by substituting HRA parts into the male source membership.

The original 416 held 4.3i files / 221 concepts remain recorded. Of these,
381 have documented older-source representations; that does not admit the newer
held geometry. The remaining 35 files / 27 concepts have been reconciled:

- 17 files / 13 concepts are potential unchanged-export recoveries. Their
  current sibling-owner links are broad proxies, not exact selections.
- Three files / two concepts overlap existing geometry: FJ5028 shares 864/2,320
  triangles with BP3D40:FJ1661; FJ5104 shares 541/1,386 with BP3D40:FJ1680;
  FJ6035 shares 18/5,450 exactly with BP3D40:FJ2924 and also has matching vertex
  and triangle counts with small coordinate differences. They require a version
  or component-overlap policy before admission, not another duplicate mesh.
- 15 files / 12 concepts retain explicit laterality holds. No geometry was
  mirrored, renamed or promoted to resolve those holds.

The 17 recoveries are a next export/mapping step, not part of this two-omission
repair. Exact per-file source hashes, memberships, overlap checks and required
corrections are retained in the private continuation receipt.

## Verification and exact identity

Atlas index SHA-256:
`e90d1d5f4a06d989b3b26788ebbb0701c537cf791fb19ec580f2586886df04de`.
Repair GLB SHA-256:
`6f472a2e087a8cf41e930a292496b456e70de678d3d49829693ff97ea7348001`.

Passed: pinned source arrays and transforms; original-bundle preservation;
no exact duplicate of 2,263 prior physical spans; deterministic replay; loader
identity and missing/corrupted repair-bundle rejection; all 7,606 male source
selection/projection/restoration cases; the 27 affected female-composite
projections at their declared exact/partial scope; six atomic rejection and
replacement probes; one application build. Original geometry buffers, transforms
and object identities remained unchanged during projection testing.

Run the tracked loader regression from this directory:

```text
node --experimental-vm-modules --max-old-space-size=4096 tests/test-source-native-contract.mjs
```

The repair script takes `--atlas`, `--source-dir`, and `--evidence`; it verifies
the pinned archive and tables before writing. Deterministic replay requires the
preserved baseline inputs in that evidence directory. No downloading is needed.

Private evidence is under `.staging/qualification/atlas-source-native-002` in the
canonical workspace: export checks, exhaustive projection scripts/results,
35-file crosswalk, male/female coverage, build identity and Playwright witness.
The initial colon-name export defect and superseded hashes are preserved there.

**Browser qualification is pending.** The old running preview serves a different
index. The prior server-start automatic approval rejection remains respected;
the operator must start the prepared inventory-restricted preview. The prepared
headed Playwright witness verifies every served file before opening Edge.
CPU tests and a successful build are not visible rendering, canvas picking,
camera, browser lifecycle or GPU-memory evidence.
