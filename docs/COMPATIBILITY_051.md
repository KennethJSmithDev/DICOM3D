# v0.5.1 candidate compatibility

Desktop-first research/prototype anatomy and imaging. Existing rendering, semantic identities, source geometry and runtime dependencies are unchanged. No clinical-use claim.

- Core: Docker Compose v2, Linux containers, pinned Node 24 Alpine image, desktop WebGPU browser. No IRIS dependency.
- Optional IRIS development host: pinned IRIS Health community 2026.2 Build 221U and preinstalled IPM; full startup and package qualification are recorded separately from the CI ownership preflight.
- Moderator's 2026.1 Build 235U: an available community 2026.1.0.235.2 image is investigated independently. A matching build family does not establish identical patch, packaging or host configuration.
- Protected IPM wrapper: USER namespace; existing `%Development` and password authentication. No FHIR repositories, permissions or credentials are configured by DICOM3D.
- Published historical releases and independently deployed Pages demo are not changed by this candidate.

See [release qualification](RELEASE_051.md) for observed results and unresolved limits. Installation on an arbitrary native or container host is not implied by class compilation or a successful local Compose preflight.
