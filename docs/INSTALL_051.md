# Install published v0.5.1

Current status, October 20, 2026: [v0.5.1 is published](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.5.1). Obtain `dicom3d-core-0.5.1.zip` or `dicom3d-0.5.1.tgz` and SHA256SUMS from that exact release. Do not substitute a v0.5.0 checksum or infer registry bytes from an Open Exchange listing. These instructions apply to the frozen v0.5.1 distribution; the [v0.6.0 web/source release](RELEASE_060.md) does not replace this installation package.

## Standalone Core

Verify and extract `dicom3d-core-0.5.1.zip` into a fresh directory. Run:

```sh
docker compose -f compose.core.yaml -p dicom3d-core051 up --build -d --wait --wait-timeout 120
```

Open http://127.0.0.1:53042/dicom3d/reference.html in a desktop WebGPU browser. Male anatomy loads automatically; Female switches references. No IRIS, file selection or patient study is required. See [Core Docker quick start](CORE_DOCKER_QUICKSTART.md) for port changes, restart and safe teardown. Use a unique project and available port; never clean another project's resources.

## Optional protected IRIS/IPM distribution

Acquire an authorized IRIS for Health image and IPM separately; neither is redistributed in the archives. The [isolated development host](IRIS_DOCKER_DEV_051.md) prepares durable storage and only this package's filesystem destinations. It does not provision FHIR or grant application roles. Existing hosts must independently provide a writable IPM ModuleRoot and DICOM3D CSP destination for the IRIS OS user; do not broaden permissions on the entire installation.

Verify the exact TGZ hash on the host and again after copying it into the isolated container. In namespace USER:

```objectscript
zpm "load /approved/path/dicom3d-0.5.1.tgz"
zpm "list"
```

Require dicom3d 0.5.1 and Activate SUCCESS. Authenticate with an already authorized account holding `%Development`; open `/dicom3d/DICOM3D.Entry.cls`, then its content-bound viewer link. `/dicom3d-api/health` must report 0.5.1. The viewer, hashed assets and API remain password/resource protected. The package grants no roles or users. HTTP readiness is separate from actual visible WebGPU rendering.

The public registry was independently observed serving 0.5.0 during the earlier timeout investigation. That historical result does not establish its current version. OEX's listing, archive button and registry state are distinct. Use the exact published v0.5.1 TGZ above unless current registry resolution has been independently verified.

## Reproduce artifacts

Use the pinned `viewer/package-lock.json` with `npm ci --no-audit --no-fund`. Stage into a new directory using `scripts/stage-package.ps1 -OutputDirectory NEW_DIRECTORY`, then `python scripts/archive-package.py NEW_DIRECTORY NEW.tgz`. Core: `python scripts/archive-core.py --output NEW.zip --source-commit EXACT_CANDIDATE_COMMIT`. Compare actual file inventories and hashes; never overwrite accepted archives. Repository FileCopy sources are prebuilt; an IPM install needs no npm build.

Reproduction of v0.5.1 must use its release source, not the v0.6.0 web/source checkout. Any newly built archive needs its own qualification. On an isolated target, qualify uninstall, package-owned absence and same-artifact reinstall before promotion. Native Windows IPM, optional Connect/FHIR and arbitrary host/image compatibility remain outside this release's supported claims.
