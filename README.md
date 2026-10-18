# DICOM3D

<p align="center">
  <a href="https://kennethjsmithdev.github.io/DICOM3D/"><strong>Live Demo</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/INSTALL_050.md#optional-irisipm-host"><strong>Native Install QuickStart</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/CORE_DOCKER_QUICKSTART.md"><strong>Docker Quick Start</strong></a>
</p>

<p align="center"><img src="assets/branding/dicom3d-logo.png" alt="DICOM3D Logo" width="480"></p>

**v0.5.0 — research and development release.**

DICOM3D is a desktop-first research imaging and generalized-anatomy explorer. No patient study is required to explore the licensed male BodyParts3D and female HRA reference subsets. Reference anatomy and patient-specific evidence remain separate.

Start with the [installation guide](docs/INSTALL_050.md) or [standalone Docker quick start](docs/CORE_DOCKER_QUICKSTART.md). Read the [release scope](docs/RELEASE_050.md), [compatibility and limitations](docs/COMPATIBILITY_050.md), and [changelog](CHANGELOG.md).

## v0.5.0 distribution

- **Standalone Core**: self-contained source/assets ZIP, digest-pinned Docker build, loopback-only static host, automatic male/female reference loading. No IRIS, login, server upload or patient imaging is bundled.
- **IPM**: the same built reference viewer and assets, plus the existing password/resource-protected IRIS hosting wrapper and read-only identity endpoint. This does not configure FHIR, clinical integrations or optional Connect.
- **GitHub is authoritative** for the exact release files and SHA256SUMS. Open Exchange and its IPM registry may update later; verify the actual installed version rather than inferring it from a listing. See the [publication handoff](docs/OPEN_EXCHANGE_050_HANDOFF.md).

The existing public Safe Demo is independently deployed and may show an older synthetic fixture. Its link is not proof of the v0.5.0 anatomy distribution. Published [v0.1.0](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.1.0) and [v0.2.0](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.2.0) remain immutable.

## Experience and evidence

Explore 33 male and 22 female semantic structures with selection, visibility, isolation, opacity, clipping, camera presets and restoration. The references have partial coverage and different sources; they are not one registered patient scan. Skin remains rendered and explicitly selectable from the list while exposed eligible anatomy can be picked in the canvas.

Local acquired-CT frame/volume presentation requires separately qualified local pixels, metadata and source transforms. The browser also accepts converted local image bundles. It is not a universal native DICOM decoder or PACS. Modality recognition, pixel decoding, display and independent qualification are distinct capabilities.

DICOM/source arrays remain authoritative. Derived meshes preserve provenance and spatial identity. Camera, materials, window/level, clipping and reversible presentation transforms do not become medical observations. No calibrated HU/SUV, anatomical accuracy, diagnostic validity, new segmentation, AI interpretation or physiological simulation is claimed.

## Development

Use the pinned viewer lockfile with Node.js 24 and `npm ci` in `viewer/`. Run `npm run dev` and open `/reference.html`; the default `/` development entry remains the earlier local-study shell. The Core Dockerfile builds `vite.reference.config.mjs`. Existing `scripts/stage-package.ps1`, `scripts/archive-package.py` and `scripts/archive-core.py` prepare the release distributions. No third-party renderer or additional runtime dependency is introduced.

## License

Apache-2.0; copyright 2026 KennethJSmithDev personally. Preserve LICENSE, NOTICE and third-party notices. BodyParts3D-derived assets retain CC BY-SA 2.1 Japan attribution; HRA assets retain CC BY 4.0 attribution and source limitations. Their notices accompany the reference assets. Optional IRIS software is acquired separately under its applicable license.
