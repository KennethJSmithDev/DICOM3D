# DICOM3D public safe demo — DEMO-050

Live URL: https://kennethjsmithdev.github.io/DICOM3D/

DEMO-050 (deployed October 18, 2026) reuses the qualified reference viewer. It automatically loads the licensed generalized male reference, offers female HRA switching, and supports anatomy selection, isolation, restoration, orbit/zoom and camera controls. No patient study, login, private dataset, IRIS service, FHIR production endpoint or write API is included.

Historical DEMO-001 provided a deterministic synthetic icosahedron (12 vertices / 20 triangles), not anatomy. Its accepted fixtures and scripts remain historical regression evidence; it is no longer the public landing experience.

The Pages workflow is `.github/workflows/pages-demo.yml`, building from the existing Vite reference viewer and deploying static assets on approved `main` changes. Licensing and asset-specific BodyParts3D/HRA notices remain required. Browser compatibility is bounded by WebGPU support; native medical/diagnostic and all-device qualification are not claimed.

Publication record: [DEMO-050 commit](https://github.com/KennethJSmithDev/DICOM3D/commit/0c26e951ecc0c2074798281b6c49e162ff0dd692). The source and runtime distributions remain distinct from the browser-only demonstration.
