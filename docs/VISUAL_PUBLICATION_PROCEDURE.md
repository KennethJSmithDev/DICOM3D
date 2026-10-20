# v0.6.0 web/source publication and readback

Current installation addendum: the later, separately identified v0.6.0 packaging completion is described in [INSTALL_060.md](INSTALL_060.md) and [PACKAGING_060.md](PACKAGING_060.md). The original web/source publication boundary recorded below remains historical; its tag and previous installation archives stay immutable.

Identity: **DICOM3D v0.6.0 — Visual Research Workstation. From Pixels to Meaning.**

The selected operation covers GitHub main, a v0.6.0 tag/release and GitHub Pages. The payload is reference-only. Open Exchange, IPM registry actions, native installations and new Core/IPM archives are outside this operation. These are required steps; completed command and readback evidence establishes their result.

## 1. Freeze the reference-only release

Preserve the earlier CT-inclusive candidate and research evidence outside public Git and Pages. Review the final source tree, lockfile, screenshots and output. The [data policy](PUBLIC_RESEARCH_DATA_POLICY.md) requires the five H000 payload files and CT screenshot to be absent from both publication surfaces.

Use the existing build path:

```powershell
node scripts/build-demo.mjs
node scripts/test-demo.mjs
```

Record final output hashes and sizes. Earlier Build04 hashes and CT-inclusive totals do not identify this release. Retain reference notices and reject unexpected files. Qualify final reference behavior, semantic ownership, visibility, camera/input, learning, reduced motion and bounded effects against frozen bytes.

## 2. Keep version ownership explicit

| Surface | Release treatment |
| --- | --- |
| `viewer/package.json` and root entries in `viewer/package-lock.json` | v0.6.0 browser/source identity; preserve dependency graph |
| Browser title/header and build manifest | v0.6.0 Visual Research Workstation, reference-only scope |
| `module.xml`, `src/DICOM3D/Health.cls`, Compose distribution identifiers | Retain v0.5.1 installation identity |
| Existing v0.5.0/v0.5.1 archives, manifests/checksums | Immutable; no replacement or relabeling |
| GitHub source archives | Source snapshots; no native/Core/IPM installation qualification implied |
| Open Exchange and IPM registry | No action |

Do not create a v0.6.0 installer to make all version fields match. Any later installable distribution needs its own exact-artifact gate.

## 3. Integrate source and observe Pages

1. Read public main and compare with accepted source. Preserve unrelated work/history; reconcile intervening changes deliberately.
2. Review the full staged/public inventory. Run `node scripts/test-publication.mjs` against the complete release index to reject excluded paths and renamed copies of all five payloads plus the CT screenshot. Keep private receipts and new local absolute paths out of publication; preserve previously published historical evidence documents. Commit/push only the authorized reference-only scope.
3. Use `.github/workflows/pages-demo.yml`. Applicable main changes trigger deployment; an asset-only change may need an explicit dispatch if its path is not covered.
4. Observe actual completion and record the accepted commit, workflow result and URL.
5. Read deployed HTML, version/manifest, hashed code/styles, references and notices. Verify actual remote reference rendering and representative interactions. A successful job or HTTP 200 alone is insufficient.

## 4. Tag/release accepted source

Bind the v0.6.0 tag/release to the accepted commit. Use [RELEASE_060.md](RELEASE_060.md) for web/source notes and the unchanged v0.5.1 installation destination. Do not silently rebuild between qualification and upload. If an approved web artifact is attached, verify downloaded bytes against its frozen checksum.

Verify tag/release, source identity, links and artifact inventory. Do not present a planned URL or pending workflow as success. Record completion only after remote readback.

## 5. Failure and rollback boundary

Stop on unexpected files, altered assets/notices, semantic regressions or broken desktop rendering. Preserve failures and receipts. If deployment needs rollback, use a reviewed new commit and verify restored Pages behavior; do not force-push history, rewrite tags or replace immutable assets under an existing identity.

v0.5.1 installation remains available. This operation does not change installed environments, OEX fields or registry state.

## 6. Final receipt

Record KNOWN / INFERRED / UNVERIFIED, OBJECTIVE, AUTHORITY, OWNERSHIP, REPRESENTATION, CHANGE / WHY REQUIRED, COMMANDS, TESTS / METRICS, LIMITATIONS, KNOWN DEBT and NEXT BOUNDARY.

Separate local acceptance, source publication, tag/release, Pages completion and remote rendering. Report actual commit/tag, release/deployment URLs, output identities, reference-only exclusions and unchanged v0.5.1 installation scope. OEX/IPM remains a separate future task.
