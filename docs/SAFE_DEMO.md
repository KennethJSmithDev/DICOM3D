# DEMO-001 — browser-only safe demo

Live URL: https://kennethjsmithdev.github.io/DICOM3D/

The sample is an independent mathematical fixture generated deterministically by
`scripts/build-demo.mjs`:12vertices/20triangles, not anatomy, no imaging or H000 input.
The new sample/generator are DICOM3D-owned Apache-2.0 work with personal attribution.
H000-derived examples remain unapproved for redistribution and are NOT used.

The adapter fetches only two same-origin static sample files, supplies them to the
existing manifest/GLB integrity+semantic loading path and reuses the same scene,
materials, GPU picking and camera controls. There are no public write APIs, login,
IRIS endpoint, patient upload or external engine dependency. The Open Exchange link points
to the directory because no product listing URL has been supplied.

Build: `npm ci --prefix viewer`, then `node scripts/build-demo.mjs`.
Test: `node scripts/test-demo.mjs`. Repeat the build and compare every output hash.
Output `.demo-dist/` is separate from the installable viewer's `viewer/dist/`.
Apache/Babylon/Vite/Rolldown notices accompany the static site. No new dependencies.
The product input seam still accepts local files. Package staging regenerates its
hashed static FileCopy entries so future source builds remain consistent; no
v0.1.0 tag or release artifact is rebuilt or replaced.

Browser acceptance: fresh load automatically renders synthetic.demo.icosahedron.001;
click selection/clear; hide/show and hidden misses; drag orbit and wheel zoom;
check semantic identity/provenance/research label and links; inspect console errors.
Check desktop,390x844 and320x568 layouts with no horizontal overflow. These are
viewport checks, not a claim that every mobile device supports WebGPU. Unsupported
WebGPU follows the existing bounded error path. Physical mobile touch testing is
outside the observed desktop-browser evidence.

Deployment: main-only GitHub Actions build/test/upload/deploy to Pages. The
OpsDeck pin6ecf9e2 was read-only method reference for this workflow shape; its
simulated providers and application code are not copied. No IRIS/Docker mutation.
