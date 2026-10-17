# DICOM3D Roadmap

## Current state

H000 is **PASS / CLOSED**. Its accepted claim and evidence identity are summarized in [H000_BASELINE.md](docs/H000_BASELINE.md). H001-A establishes this product repository and a minimal viewer baseline. Exploded presentation is outside this gate.

V010-B / **0.0.2** qualifies the native IRIS for Health development viewer/API shell and restart behavior. IPM package lifecycle and DICOM3D Docker clean-room qualification remain open.

## Version boundaries

- **0.0.1** — public product baseline.
- **0.0.x** — public development milestones; interfaces may evolve.
- **0.1.0** — first directly installable IRIS for Health development release. Target shape includes an IPM package lifecycle (install, uninstall, reinstall) and a Docker clean-room quick start using a supported IRIS for Health base, exact package installation, authenticated/native smoke, and restart/persistence check. OpsDeck may inform packaging and qualification methods but is not a runtime dependency.
- **1.0.0** — stable, independently installable, documented, and reproducible product boundary.

The order of later capabilities remains evidence-driven. Native DICOM ingress, multi-structure composition, H004 source-image correlation, archive query/retrieve, longitudinal timelines, veterinary anatomy, physiology, XR, and AI segmentation are not active in this baseline. AI remains last, after deterministic provider workflows.

## Platform direction

IRIS for Health is a qualified development host at 0.0.2; it does not own DICOM3D semantic representation. The observed target is 2026.2 Build 221U; qualification of other supported baselines remains open. Reuse native platform capabilities where qualified, keep DICOM3D independently installable, and select the oldest reasonable supported platform baseline for each release. Do not make developer-preview platform features mandatory without evidence.
