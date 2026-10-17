# DICOM3D

DICOM3D is an open development project for preserving the meaning and spatial context of anatomical structures reconstructed from medical imaging. It separates source DICOM reality, semantic and spatial metadata, portable geometry, and renderer-owned presentation.

## Status

**v0.1.0** is the first installable IRIS for Health development release. The exact Apache-2.0 package passed install, resource enforcement, authenticated browser/API, restart persistence, uninstall/absence and same-artifact reinstall in two isolated Docker targets. See [Docker quick start](docs/DOCKER_QUICKSTART.md) and [notice audit](docs/NOTICE_AUDIT.md). Native Windows 0.0.2 viewer/API qualification remains separate; native Windows IPM support is unverified. Research presentation only; not intended for clinical use.

The current viewer is a small Babylon Lite/WebGPU development shell. It can load a manifest and matching GLB selected locally; the repository does not bundle a patient-derived example. The H000 example was derived from a qualified public research study. Redistribution of derived example assets remains a separate decision.

## Representation and ownership

- DICOM files remain the source reality.
- A manifest carries semantic identity, provenance, units, and spatial mappings.
- GLB carries portable derived geometry and stable semantic identity.
- Babylon Lite and the application own rendering and other presentation state.

Presentation transforms, camera, material, lighting, and transient renderer-generated normals do not become source or clinical truth. Current DICOM3D Model Space v1 qualification is limited to one BIPED study and one semantic structure. It does not establish multi-structure composition, anatomical outward-normal correctness, clinical validity, or source-slice correlation.

## Development

Requires Node.js and npm. From `viewer/`:

```sh
npm ci
npm run dev
```

Open the local Vite URL printed by the command. Choose a manifest JSON file first, then its corresponding GLB. The viewer verifies the GLB SHA-256 against the manifest before loading it. The browser must support WebGPU. To produce the static development build, run `npm run build`.

For the native development host, see [NATIVE_DEV_INSTALL.md](docs/NATIVE_DEV_INSTALL.md). The authenticated entry is `/dicom3d/DICOM3D.Entry.cls`; the read-only identity endpoint is `/dicom3d-api/health`. Imaging files remain local browser inputs. No OpsDeck installation is needed.

## Roadmap

- `0.0.1`: public product baseline.
- `0.0.x`: bounded public development milestones before the first installable release.
- `0.1.0`: first directly installable IRIS for Health development release, including IPM install/uninstall/reinstall lifecycle and a Docker clean-room quick start.
- `1.0.0`: stable, independently installable, documented, reproducible product contract.

OpsDeck is an implementation donor for packaging and representation-measurement methods. It is not a DICOM3D runtime dependency. See [ROADMAP.md](ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License and feedback

DICOM3D is licensed under Apache-2.0. Copyright 2026 KennethJSmithDev, personally. See LICENSE, NOTICE and docs/NOTICE_AUDIT.md. Native64 World and its unreleased engine are excluded. Use GitHub Issues for questions, feedback, and proposed changes.
