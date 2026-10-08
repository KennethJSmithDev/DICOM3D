# DICOM3D

DICOM3D is an open development project for preserving the meaning and spatial context of anatomical structures reconstructed from medical imaging. It separates source DICOM reality, semantic and spatial metadata, portable geometry, and renderer-owned presentation.

## Status

This repository begins the **0.0.1 public development baseline** after the H000 research qualification passed. DICOM3D is research software and is not intended for clinical use, diagnosis, or treatment decisions. No IRIS for Health integration or installable package exists yet.

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

## Roadmap

- `0.0.1`: public product baseline.
- `0.0.x`: bounded public development milestones before the first installable release.
- `0.1.0`: first directly installable IRIS for Health development release, including IPM install/uninstall/reinstall lifecycle and a Docker clean-room quick start.
- `1.0.0`: stable, independently installable, documented, reproducible product contract.

OpsDeck is an implementation donor for packaging and representation-measurement methods. It is not a DICOM3D runtime dependency. See [ROADMAP.md](ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License and feedback

The product license is an unresolved publication decision; no license is implied by this repository. Use GitHub Issues for questions, feedback, and proposed changes.
