# v0.7.0-alpha.1 approval and cutover procedure

This is a prepared procedure, not publication authorization. The private approval packet binds the exact proposed commit, parent main/experimental SHAs, full diff, assets and checksums. No push, tag, GitHub release, Pages action, registry update or announcement was performed during preparation.

## Reviewed boundaries

- Release title: **DICOM3D v0.7.0-alpha.1 — Anatomy & Imaging Foundation**; GitHub **prerelease**, not latest stable. Preserve v0.6.5 as the stable rollback.
- Qualified source: `4df33582a974e398cd65a7d83f2cb0ea0c7480f3`; actual runtime artifacts: `623d81bcab9081a0522281be36a698d16ecbda4b`. The proposed successor changes documentation/release plumbing only; application, geometry, source data, dependencies and qualified artifacts stay unchanged.
- Expected remote main: `101c2185e5891ca63ec464e5dcac25396aba04ed`; experimental: `4df33582a974e398cd65a7d83f2cb0ea0c7480f3`. Recheck both immediately before execution. The private successor contains both histories, so ordinary fast-forward updates preserve the README restoration and accepted checkpoints. Stop on drift or branch-protection rejection; do not force or change protections.
- [Exact asset pins](releases/070-alpha1-assets.json), [download descriptions](DOWNLOADS_070_ALPHA.md), [release notes](RELEASE_NOTES_070_ALPHA1.md), [qualification](RELEASE_070_ALPHA_ACCEPTANCE.md). No new asset redistribution or historical manifest flag is inferred.
- Branding assets and the existing 480px logo HTML remain exact. Navigation order and section order are retained; destinations and screenshots are updated for the current alpha. Original screenshots, historical documentation and FUNDING.yml remain unchanged.

## Proposed approved execution sequence

1. Recheck destination SHAs, the exact approved local commit/tree, clean tracked state, source inventory, assets and checksums. Confirm no v0.7.0-alpha.1 tag/release already exists. Do not proceed through changed state by guessing.
2. Push only the approved successor to experimental/main using ordinary fast-forward updates (atomic if supported). If main requires a PR, follow that existing policy rather than bypassing it. Verify both remote SHAs. This source update does not deploy Pages.
3. Create a **draft prerelease** targeted at the approved commit/tag `v0.7.0-alpha.1`. Attach only the frozen Safe Demo ZIP, IPM TGZ, byte-identical standalone preview helper and SHA256SUMS. Do not upload qualification folders, caches, local images/credentials or patient data. GitHub tag source archives remain source, not a built Core ZIP. Read back every uploaded size/digest before publishing the prerelease.
4. Confirm the tag resolves to the approved main commit; publish the prerelease with the reviewed notes. Preserve every v0.6.5 tag/asset. No Docker Hub, IPM registry or OEX update follows.
5. Manually dispatch `pages-demo.yml` on main with `expected_commit` equal to the approved 40-character SHA and `profile=alpha`. The workflow checks the source, tag and rebuild, verifies the fixed archive hash and uploads the **unchanged qualified ZIP payload**, rather than silently substituting rebuilt bytes.
6. Wait for the exact new run to finish. Dispatch success is not deployment success. Read back public HTML, all manifest assets, version, atlas index, current female supplement and source notices; verify representative public browser interactions before announcing completion. Check README/download links and uploaded checksums. Do not announce alpha installation routes as published until their corresponding assets are actually available.

The Git credential manager supports source pushes, but the local GitHub CLI currently reports no authenticated host. Release/upload/dispatch execution therefore needs a supported authenticated GitHub UI/CLI session at execution time. The connected account reports repository access; no credential extraction, browser/security changes or new secret store is part of this packet. If a required authenticated operation is unavailable, stop that operation and preserve completed source/publication state.

## Manual live-demo rollback

If the new static deployment fails its acceptance gate, preserve failure evidence and explicitly dispatch the same workflow on the current approved main SHA with `profile=rollback-065`. It checks immutable tag `v0.6.5` -> `4d5cac71cf1266c8eb1a272ae44ac528d238f919`, downloads the frozen Safe Demo (SHA-256 `2d3e91c5805860a8df6266ce7b4d9d375a898823feb4e58e8a435be38cc00f9f`), validates every original file and deploys only its original public payload. No dependency install or legacy rebuild is required for that rollback profile. Read back the restored release and representative behavior. This is a manual contingency, not an automatic rollback or a main reset.

Restoring that static demo does not roll back an installed IRIS/Core application, settings, local medical studies or stored data. Such an installed migration/rollback remains unqualified and needs its own bounded plan. Leave affected installations intact; do not uninstall or restore them automatically.

## Current evidence and limits

A fresh export of committed source rebuilt the identical JS/CSS/Wasm, geometry and H000 bytes. Four explicitly named descriptor/notice text files differ only by checkout line endings; the Pages adapter allows that comparison only for those four paths, while promoting the unchanged qualified archive. Exact alpha and legacy archive extraction/hash checks passed locally. No hosted Actions run or new public rendering is claimed by those local checks.

Latest recorded successful Pages run at preparation was `42389702321`, source `a534b99bf949802898045401939103468596f967`, created November 7, 2026. Its historical push trigger predates the current manual-only workflow; it is not this prepared alpha. Current public atlas readback remains the older 1,186-owner/15-bundle build. Keep these deployed and proposed identities separate.
