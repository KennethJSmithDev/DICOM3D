# v0.1.0 notice and ownership audit

DICOM3D copyright: 2026 KennethJSmithDev, personally, as selected by the operator.
Apache License 2.0 applies to DICOM3D-owned work. Third-party copyrights/licenses remain intact.
No LLC ownership is asserted.
No voxelization, mesh deformation, new smoothing algorithm or new dependency was introduced.

## Pinned redistribution

The registry @babylonjs/lite1.32.0 archive integrity matches package-lock.json:
sha512-FqVBncRib64TnsbHVAPi50+rdVMtM7tLIKN7NZVEgjUg2LYKzc31Zu1dzaTxrAyHOp38jMPVeWwGtOBlkbtG5g==.
Its LICENSE and NOTICE.txt match the installed files byte-for-byte. Package release sourceVersion:
2e064d88ec7422af946f8ec7f089ac6519f99295. Apache-2.0 LICENSE is preserved verbatim.
The entire upstream NOTICE.txt is preserved verbatim: manifold-3d3.5.1 (Apache-2.0),
recast-navigation core/generators/wasm0.43.1 (MIT), text-shaper0.1.28 (MIT and FreeType attribution),
and upstream Recast/Detour, Emscripten/Node notices. Retaining the complete package notice avoids
silently dropping upstream attribution. It does not assert all optional native/WASM components
are shipped: no standalone WASM or manifold/recast/text-shaper vendor chunk appears in this build.
No new inference about upstream authorship or additional obligations is added.

Vite8.3.0 and Rolldown1.2.12 are build dependencies, but their emitted module-preload/import helpers
are redistributed browser code. Their core MIT notices accompany the build; Rolldown's accompanying
third-party text is retained verbatim. Native bindings, package managers, compilers and node_modules
are not redistributed. Their presence as build tools does not by itself require packaging their
entire dependency trees or Vite's full bundled-tool license catalog with this browser output.
No Havok optional peer or new runtime dependency is installed/bundled by DICOM3D.

Root LICENSE/NOTICE and third-party/ are included in the IPM archive and package-owned CSP files,
so recipients receive readable license texts. Upstream notice files are unmodified. Minification,
tree-shaking and bundling are build transformations, not changes to canonical medical geometry.
The original Babylon Lite source files are unmodified. Source checkout includes all notices.

OpsDeck is an owned method donor, not a runtime dependency. Its pinned MIT license remains unchanged.
IRIS community image licensing remains separate; DICOM3D does not redistribute that image or claim
an upstream open-source license licenses the IRIS product. See DOCKER_QUICKSTART.md.

Audit result: compatible notice preservation for the exact candidate browser assets. No copyleft
component or incompatible redistribution term was observed in the inspected pinned package/notice
set. This is bounded to this artifact; a future dependency/build change requires re-audit.
