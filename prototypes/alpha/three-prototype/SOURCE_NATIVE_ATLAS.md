# Source-native atlas checkpoint

Private integration based on `0090914a5f0b826c79456561245472fffbd410d9`.
This checkpoint preserves the pinned BodyParts3D and HRA geometry and labels.
It is application mapping, not clinical recertification or a complete-atlas claim.

## What changed

The existing fifteen male bundles and all 1,186 geometry owners are unchanged.
`expanded-atlas/source-native.json` adds the original PART-OF, IS-A, native
source concepts and ordered geometry membership. The inspector selects exact
triangle ranges in existing buffers, including compounds spanning owners.
Geometry is not copied to implement compound selection. Selection, opacity,
isolation and restoration reuse the existing presentation owner.

| Source view | Records | Exact | Partial | Proxy | Catalog only |
| --- | ---: | ---: | ---: | ---: | ---: |
| BodyParts3D 4.0 PART-OF | 1,368 | 1,341 | 27 | 0 | 0 |
| Pinned BodyParts3D IS-A | 2,905 | 2,062 | 272 | 0 | 571 |
| Versioned native concepts | 2,431 | 1,638 | 0 | 706 | 87 |
| HRA original hierarchy in female supplement | 1,073 | 78 | 4 | 0 | 991 |

These are overlapping source relationship records, **not additive counts of
distinct organs**. The male catalog has 2,264 source occurrences and 2,263
physical spans. An explicit alias shares one range; a source element already
present under two original owners retains both occurrence identities.

477 previously unclassified added owners now expose exact native IS-A paths.
The other 323 do not have a supported mapping in the retained tables. IS-A
classes are not silently converted into PART-OF systems.

The shared-base female composite now adds 39 HRA owners / 60 original mesh
components, rather than seven owners / 28 components. These include the
already-retained mammary, uterine ligament and pouch structures. The existing
nine male-owner omissions and approximate translation remain unchanged:
1,186 - 9 + 39 = **1,216 composite draw owners**. No patient registration is
implied. The full original HRA hierarchy remains discoverable, including
source records not rendered by this shared-base variant. Catalog-only HRA
records do not mean those organs are absent from the shared male geometry.

## Evidence and limits

All original male POSITION/NORMAL/index bytes and owner partitions passed.
All 184 original HRA attribute/index arrays in the supplement passed, including
four normals that the exporter initially normalized and which were restored
to original bytes. All 7,604 male exact/partial/atom projection cases and 138
female cases passed in Node, including restoration and unchanged buffers,
IDs and transforms. Missing-member and consecutive-application failures were
retained and then repaired; six adversarial cases subsequently passed.

One application build passed. The actual loader contract test checks catalog
discovery without mesh requests, both catalogs, female geometry loading,
corruption, missing catalog and cancellation:

```powershell
node --max-old-space-size=4096 --experimental-vm-modules tests/test-source-native-contract.mjs
node --max-old-space-size=4096 build-public-review.mjs <new-output-directory>
```

New headed WebGPU appearance, picking, H000 interaction and teardown remain
**NOT TESTED**: automatic approval review blocked starting the preview server.
Static and Node results do not establish a browser pass. The prior public,
Babylon, NRX, H000 and accepted reference checkpoints are preserved.

## Remaining source-native omissions

Two original 4.0 source elements were skipped because their per-OBJ concept
headers are blank, although the pinned membership tables identify them:

- FJ1450: 250 vertices / 368 triangles; FMA21930 external anal sphincter.
- FJ1656: 524 vertices / 766 triangles; FMA50544 anterior inferior cerebellar artery.

The owning filter is `scripts/admit-anatomy.py:46`. Exporting these unchanged
elements with versioned FJ identity and explicit table links would complete
all 27 PART-OF partial compounds. Do not invent their blank native-header IDs.
This is an export correction, not a request for clinical review. It is not
included in the single built candidate of this bounded pass.

The 416 held 4.3i files cover 221 concepts. Of those concepts, 193 already have
complete exact older-source compounds and one has the partial FMA21930.
These account for 381 held-file records. The remaining 35 records cover 27
concepts: 20 sibling-mapping records / 15 concepts and 15 unresolved laterality
records / 12 concepts. None of the held newer-version geometry was promoted.
32 records retain a laterality flag, including 17 with older-source fallback.

HRA/FMA correspondence is semantic evidence, not spatial equivalence: the
audit found 48 HRA rows / 45 FMA identifiers matching current male draw
owners, and 96 rows / 93 IDs matching the broader source catalog. Conflicting
source ontology fields remain explicit; no guessed UBERON/FMA conversion.

## Local evidence

The campaign's preserved evidence is under the canonical workspace's
`.staging/qualification/atlas-source-native-001/`: `male-audit/`,
`female-audit/`, `contract-test.log`, `build.log`, and `RECEIPT.md`.
Full paths stay in private receipts; runtime catalogs retain filenames and
SHA-256 pins. The female portable generator and independent array verifier
are in `female-audit/female-source-native-generator.zip`. The male generator
and independently replayed output hashes are in `male-audit/README.md`.

Next: complete the two demonstrated export omissions, then witness the exact
built candidate's individual/compound selection, opacity, both variants,
H000 round trip and zero active renderer ownership. No new dataset or
renderer is needed for that step. No push or publication is included here.
