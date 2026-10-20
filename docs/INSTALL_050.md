# Install v0.5.0

Download the verified distributions from the [GitHub v0.5.0 release](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.5.0). GitHub is authoritative; Open Exchange and IPM indexing may lag. Verify SHA256SUMS and release-manifest.json before use.

## Standalone Core (no IRIS)

Download dicom3d-core-0.5.0.zip and SHA256SUMS, verify the ZIP with `sha256sum` (Linux/macOS) or `Get-FileHash -Algorithm SHA256` (PowerShell), and extract to a new directory. Keep the tree intact. Docker Compose v2/Linux containers and a desktop WebGPU browser are required.

```sh
docker compose -f compose.core.yaml -p dicom3d-core up --build -d --wait --wait-timeout 120
docker compose -f compose.core.yaml -p dicom3d-core ps
```

Open http://127.0.0.1:53042/dicom3d/reference.html. The male reference loads automatically; choose Female to switch. Select anatomy, isolate, restore, and test camera controls. Local studies are optional and remain browser-local. See CORE_DOCKER_QUICKSTART.md for port configuration, restart, safe stop and teardown. Do not reuse another project's container, volume or port.

## Optional IRIS/IPM host

The standalone Docker Compose command above uses **no IRIS**. For a separate, isolated IRIS container host and durable-storage diagnostics, see the [published v0.5.1 development-host procedure](IRIS_DOCKER_DEV_051.md). The historical [IRIS Docker guide](DOCKER_QUICKSTART.md) is tied to v0.1.0. An IRIS-startup success alone is not evidence that IPM installed DICOM3D.

Acquire a licensed/authorized IRIS for Health environment and IPM separately; DICOM3D does not redistribute either. Use the exact dicom3d-0.5.0.tgz from GitHub until the external registry actually exposes0.5.0. Copy it to an approved local/container path, verify its hash again, then in namespace **USER** (all three web applications in v0.5.0 `module.xml` target USER):

```objectscript
zpm "load /approved/path/dicom3d-0.5.0.tgz"
zpm "list"
```

Require installed dicom3d0.5.0 and Activate SUCCESS. Do not replace0.5.0 with an older registry result. Open the protected `/dicom3d/DICOM3D.Entry.cls` entry using your own authorized account; its versioned link opens reference.html. `/dicom3d-api/health` reports0.5.0. The package requires existing %Development authorization and password authentication; it grants no roles. Unauthenticated/restricted access must be denied. No Connect/FHIR configuration is performed.

After OEX/IPM synchronization, `zpm "install dicom3d"` may install the registry version. Read installed inventory and require0.5.0; listing/version lag is not proof that the GitHub artifact is wrong. Registry archives may have different container metadata from GitHub TGZs: verify version, all installed payload hashes and resource gates rather than assuming byte identity.

For a development lifecycle in an isolated target: verify installed static hashes/security and restart persistence; `zpm "uninstall dicom3d"`; verify package classes/routes/static files absent; reload the SAME hashed TGZ. Do not force/purge, grant broad roles or alter existing IRIS/FHIR environments. Native Windows IPM remains unqualified. Production identity provisioning and optional Connect are separate contracts.

## Build from source

The source archive/repository contains prebuilt public shell/assets and source-addressable licensed reference assets for registry FileCopy processing. No Node build is required during an IPM install. Maintainers regenerate the IPM stage with `scripts/stage-package.ps1 -OutputDirectory NEW_EMPTY_DIRECTORY` and archive with `python scripts/archive-package.py STAGE NEW.tgz`. Core is frozen with `python scripts/archive-core.py --output NEW.zip`. For byte-exact reproduction outside Git, also pass `--source-commit BASE_COMMIT` using sourceGitHead from the included distribution-manifest.json; this is a recorded base commit, while sourceIdentitySha256 binds the actual candidate files. Use the pinned npm lock and a fresh output path; never overwrite accepted artifacts. Compare resulting manifests with the release before making a reproducibility claim.
