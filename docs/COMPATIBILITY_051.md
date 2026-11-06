# Published v0.5.1 compatibility

Current status, October 20, 2026: [v0.5.1 is published](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.5.1). This page describes that frozen installation-recovery release. The [v0.6.0 web/source release](RELEASE_060.md) has different browser bytes and includes no replacement installation package; these v0.5.1 compatibility results remain scoped to the frozen distribution.

Desktop-first research/prototype anatomy and imaging. Existing rendering, semantic identities, source geometry and runtime dependencies are unchanged. No clinical-use claim.

- Core: Docker Compose v2, Linux containers, pinned Node 24 Alpine image, desktop WebGPU browser. No IRIS dependency.
- Optional IRIS development host: pinned IRIS Health community 2026.2 Build 221U and preinstalled IPM; full startup and package qualification are recorded separately from the CI ownership preflight.
- Moderator's 2026.1 Build 235U: an available community 2026.1.0.235.2 image is investigated independently. A matching build family does not establish identical patch, packaging or host configuration.
- Protected IPM wrapper: USER namespace; existing `%Development` and password authentication. No FHIR repositories, permissions or credentials are configured by DICOM3D.
- The v0.5.1 static reference-viewer payload retains v0.5.0's bytes. It does not include the v0.6.0 web visual workstation.

See [release qualification](RELEASE_051.md) for observed results and unresolved limits. Installation on an arbitrary native or container host is not implied by class compilation or a successful local Compose preflight.
