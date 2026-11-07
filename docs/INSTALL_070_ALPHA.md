# DICOM3D v0.7.0-alpha.1 — local installation

DICOM3D is an open-source interactive anatomy and medical imaging platform. This alpha uses React, Three.js and React Three Fiber, with WebGPU as the primary renderer and a WebGL2 compatibility path. It includes source-backed reference anatomy and the approved public H000 CT/SEG example.

These instructions describe the alpha packaging candidate. The published v0.6.5 artifacts and historical installation receipts remain separate. A source version label does not mean a Docker image, IPM registry package or Open Exchange download has been updated. Use an exact artifact and its qualification receipt; do not assume `zpm "install dicom3d"` currently retrieves this alpha.

## Choose a local host

| Option | What it provides | What you need |
|---|---|---|
| Docker Core | The standalone browser application | Docker Desktop or a compatible Docker engine; a desktop browser with GPU support |
| IPM/ZPM | The same frontend inside an authorized IRIS web application | A supported IRIS development instance, IPM installed in `USER`, and your existing login |
| Source build | A reproducible frontend for inspection or packaging | Node 24, the checked-in lockfile and PowerShell 7 for the IPM staging step |

Core does not require IRIS, IRIS for Health, Orthanc, an AI service or patient data. IPM is the InterSystems Package Manager; its command is still named `zpm`. Installing the viewer through IPM does not by itself connect it to a PACS or establish live IRIS imaging retrieval.

## Docker Core

Start Docker Desktop first. `docker info` should reach the engine. From the reviewed source checkout:

```powershell
docker compose -f compose.core.yaml up --build --detach core
```

Open [the local Core viewer](http://127.0.0.1:53042/dicom3d/). This is the compose file's default loopback port; `DICOM3D_CORE_PORT` can select a different port for your own installation. Qualification environments may deliberately use an existing port instead.

To stop this Core container:

```powershell
docker compose -f compose.core.yaml stop core
```

Use `docker compose -f compose.core.yaml start core` to start that existing container again. Avoid deleting volumes or pruning Docker resources as an installation troubleshooting step. The Core recipe serves a static application, runs as the image's nonroot user and does not mount personal studies from the host.

The online build uses the checked-in alpha lockfile and a pinned Node base image. An offline recipe additionally needs the separately verified Linux npm cache for this exact alpha lockfile; the old v0.6.5 cache is not automatically compatible. See [packaging and qualification](PACKAGING_070_ALPHA.md).

## IPM/ZPM in IRIS

Use an authorized local development instance. The retained qualification reference is IRIS for Health 2026.2; a successful test there does not establish every IRIS/IPM combination. The installer includes an Embedded Python maintenance adapter, so its supported Python runtime must be available. Do not change instance security, credentials or shared application permissions to make installation pass.

1. Obtain the exact reviewed `dicom3d-0.7.0-alpha.1.tgz` and its SHA-256 from the packaging receipt. An unreleased filename is not a download location.
2. Open the IRIS terminal in the `USER` namespace. Confirm that `zpm "list"` works and record the installed IPM version.
3. Make the archive available at a local path the IRIS instance can read, then load that exact file:

```objectscript
zpm "load /path/to/dicom3d-0.7.0-alpha.1.tgz -v"
zpm "list"
```

Check the actual output for successful activation and `dicom3d 0.7.0-alpha.1`; do not rely only on a zero process exit code. IPM [supports prerelease versions](https://github.com/intersystems/ipm/wiki/03.-IPM-Manifest-%28Module.xml%29), but the installed package manager's parser and installation still need qualification.

Open your instance's existing web origin followed by `/dicom3d/DICOM3D.Entry.cls`. For example, if your authorized local gateway already uses `http://127.0.0.1:52773`, the entry is `http://127.0.0.1:52773/dicom3d/DICOM3D.Entry.cls`. Use the normal login with existing credentials, then follow **Open DICOM3D viewer**. The authenticated health route is `/dicom3d-api/health`.

The protected applications retain authentication. A `401` before login is different from a missing file or a renderer failure. If an asset fails after login, preserve its request URL, HTTP status and package identity for review; do not enable anonymous access. Same-origin session requests must retain the existing path allowlist, redirects policy and asset-integrity checks.

The viewer entry uses `reference.html` as a byte-identical alias of the alpha's `index.html`. This keeps the established native entry and exact legacy-retirement guard working; it does not load the old Babylon application. The install receipt must prove the alias hash and the installed payload.

## Build a reviewable package from source

Use an isolated checkout and fresh output directories. With the approved, lockfile-pinned alpha dependencies available:

```powershell
$sourceCommit = git rev-parse HEAD
node scripts/build-alpha-distribution.mjs .package/alpha-web $sourceCommit
pwsh scripts/stage-package.ps1 -OutputDirectory .package/alpha-ipm -SourceCommit $sourceCommit
python scripts/archive-package.py .package/alpha-ipm .package/dicom3d-0.7.0-alpha.1.tgz
```

`npm ci` in `prototypes/alpha/three-prototype` is the lockfile-based dependency setup when acquisition is authorized. It is not needed merely to inspect an already qualified archive. Do not regenerate the lockfile or substitute a different atlas to make a package build.

The existing Vite command alone does not assemble all runtime assets. The alpha distribution wrapper verifies and packages the semantic atlas, HRA supplement, public H000 assets, aliases and attribution. The exact source commit, frontend inventory and archive hash belong in the receipt.

## What to expect

The default reference is male anatomy in Scientific presentation, with skin hidden and an introductory materialization effect. The female view shares the admitted BodyParts3D base and adds the approximately fitted HRA supplement. Structures can be selected, isolated and restored; source components, compounds, proxies and held records are different kinds of records rather than interchangeable organ counts.

H000 provides public source CT frames, source SEG highlighting, a display-derived lesion surface and a whole CT volume on WebGPU. Whole CT display is direct volume rendering; it is not whole-scan organ segmentation. WebGL2 availability is qualified separately and does not establish WebGPU operation.

Generalized anatomy is an independent reference. A manual comparison is not patient-specific registration, and approximate placement is disclosed. Personal DICOMs, reports, credentials and private derived data must remain outside public packages. This alpha does not establish clinical diagnostic accuracy.

Fresh installation, upgrade, uninstall, installed settings/data migration, live IRIS/Orthanc interoperability and public registry publication are separate gates. Preserve the v0.6.5 source and artifacts until the particular replacement/rollback procedure has passed its own qualification.
