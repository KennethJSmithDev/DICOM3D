# H002 candidate status

A/B PASS; C fresh requalification PASS; D/E including camera framing and F bounded PASS. **Published as v0.2.0 on 2026-10-17.** See the [v0.2.0 release](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.2.0).

The historical C failure receipt remains preserved. Its visual failure was not reproduced in fresh builds, including an uninstrumented fresh Edge tab and installed-product browsers. No visibility code defect was demonstrated, so no speculative renderer/adapter patch was made. The historical cause remains unverified; fresh acceptance does not explain it.

Actual mesh/renderable ownership, parent links, visibility flags and canonical reset positions were traced with temporary read-only diagnostics, removed before final builds. Fresh visual isolation, GPU hit/hidden miss, independent state, reassembly, desktop/narrow layout and authenticated package checks are recorded in CompDocs H002 C–F receipts and D:/DICOM3D/evidence/H002/.

Only the exact DEMO-001 synthetic fixture enables five open model-Y presentation bands. These are not acquired CT slices, anatomy or a clinical feature. H000 remains on the original unsliced viewer path; source hashes and semantic identity are unchanged. No Native64 or new dependency.

Camera controls fit the complete assembly, focus a visible selected slice, refit on expansion/canvas resize and restore original framing on reset-all. Camera targets follow world-space geometric bounds, independently of source-space origin. Model transforms are not recentered. Collapsed controls retain the camera toolbar. Original framing restores initial orientation/FOV and original visible bounds; distance adapts to the current canvas aspect.

Frozen qualified candidate: `dicom3d-0.2.0.tgz`, 205915 bytes, SHA-256 `37159b955e2cefc3217aef88092e523e05782b49d04768a6830c2f1842506221`. Two independently staged builds match. Exact install/restart/uninstall/absence/reinstall, protected resource read-back, restricted identities and authenticated browser checks pass existing dedicated and new clean-room Docker targets. Historical camera/cache candidates remain preserved and are not publication artifacts. Physical-phone compatibility, peak heap/GPU memory and full accessibility certification remain unverified.

The F stale-client cause is now observed: browser disk cache supplied an old mutable HTML shell that selected the obsolete bundle; no service worker was registered. The supported application cache timeout now separates mutable files from protected hashed assets. The native entry binds to the exact shell hash, and ordinary reload/revisit checks pass while assets retain cache hits. See [cache policy and legacy-bookmark migration](CACHE_POLICY.md). A text-wrapping rule fixes the product status identifier's narrow-layout overflow; renderer scripts are unchanged.

Reproduce pure checks with `node scripts/test-slices.mjs`; build the private standalone preview with `node scripts/build-demo.mjs`, serve `.demo-dist` at `/DICOM3D/`, and run `node scripts/test-demo.mjs`. Package with the existing stage/archive scripts. Never promote the prior failed screenshot or pure-state tests to new browser evidence.

Publication update (2026-10-17): the qualified checkpoint `38ed849349abbe2ef4ba8cc04244173777616b7a` is on main, the [v0.2.0 release](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.2.0) is published, and its [Pages deployment](https://github.com/KennethJSmithDev/DICOM3D/actions/runs/39054943071) completed. The published archive's GitHub-reported size and SHA-256 digest match the frozen artifact above. See the [historical publication handoff](H002_RELEASE_HANDOFF.md). v0.1.0 remains available as the earlier release. Open Exchange updates remain operator-owned.
