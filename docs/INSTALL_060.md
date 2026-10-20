# Install DICOM3D v0.6.0

**Visual Research Workstation. From Pixels to Meaning.**

Use the exact dicom3d-core-0.6.0.zip or dicom3d-0.6.0.tgz, SHA256SUMS and installation qualification receipt attached to the [v0.6.0 release](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.0). Asset presence and the external release manifest establish publication; these instructions alone do not establish a successful qualification run.

The original v0.6.0 tag remains the published web/source commit d3490dd659e19e44b8800abe87bbc626f45350a2. Installation completion comes from the separately identified packaging commit and reproducible packaging-source snapshot named in the release manifest. The original tag does not contain later packaging changes. See [reproduction and provenance](PACKAGING_060.md). Existing [v0.5.1 downloads](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.5.1) remain immutable.

## Standalone Core / Docker

Verify SHA-256, then extract the complete Core ZIP into a fresh directory. Use Docker with Linux containers and Compose v2+, and a desktop WebGPU browser. The qualification target is Linux/amd64; other platforms need their own checks. Initial build requires access to the pinned official Node image and lockfile dependencies.

~~~powershell
docker compose -f compose.core.yaml -p dicom3d-core060 up --build -d --wait --wait-timeout 120
docker compose -f compose.core.yaml -p dicom3d-core060 ps
~~~

Open **http://127.0.0.1:53042/dicom3d/reference.html**. If occupied, choose another loopback port using DICOM3D_CORE_PORT or the environment-file procedure in the [Core quick start](CORE_DOCKER_QUICKSTART.md). Use a unique project; do not stop another installation.

Male BodyParts3D loads first; choose Female for HRA. Scientific, Holographic and Materialization modes, selection/isolation, camera controls and **Learn below Lab** use the same canonical visual source as Safe Demo. Both references are generalized, independently sourced and unregistered to a patient scan. No H000 payload or arbitrary upload is admitted.

The Core host reports version 0.6.0 at /healthz. It serves GET/HEAD only, runs unprivileged with a read-only root, and retains the existing loopback bind, resource limits and capability restrictions. Health readiness is separate from browser rendering.

~~~powershell
docker compose -f compose.core.yaml -p dicom3d-core060 restart
docker compose -f compose.core.yaml -p dicom3d-core060 stop
docker compose -f compose.core.yaml -p dicom3d-core060 start --wait --wait-timeout 120
docker compose -f compose.core.yaml -p dicom3d-core060 down
~~~

Core has no persistent study storage or host mounts. The last command removes only that project's containers/network. Preserve the image unless separately removing it is intended.

## Protected IRIS/IPM

Acquire an authorized supported IRIS for Health environment and IPM separately. Neither proprietary images nor credentials are distributed. The package needs only its own writable IPM module destination and CSP directory under existing host policy. Do not broaden global filesystem permissions or grant users/roles to make installation pass.

Verify the TGZ's host hash and copied hash. In namespace USER:

~~~objectscript
zpm "load /approved/path/dicom3d-0.6.0.tgz"
zpm "list"
~~~

Require **dicom3d 0.6.0** and **Activate SUCCESS**. Authenticate using an already authorized account with %Development. Open /dicom3d/DICOM3D.Entry.cls, then its content-bound viewer link. /dicom3d-api/health reports 0.6.0. Entry, static assets and API retain password authentication (AutheEnabled=32) and %Development resource protection. The package grants no roles/users.

The TGZ contains the prebuilt canonical frontend and exact generated FileCopy inventory; installation needs no npm build. The repository's old public tree is not a release installer. Build/stage from the packaging-source snapshot or use the exact qualified TGZ.

For upgrade, preserve a host backup and load the qualified TGZ over the existing v0.5.1 module. Confirm version, content-bound link, exact new files and actual rendering. Rollback is explicit package removal followed by the exact v0.5.1 TGZ under the host's normal backup/restore procedure; no data migration is introduced.

~~~objectscript
zpm "uninstall dicom3d"
~~~

Verify absence of DICOM3D compiled classes, three package web applications and served files. IPM may retain its own package cache; do not force-purge shared caches. Same-artifact reinstall uses the identical TGZ and checksum.

## Optional isolated IRIS Docker host

Dockerfile.iris-dev and compose.iris-dev.yaml remain a supporting host recipe. Its durable preparation gate checks a pre-existing private .secrets/merge.cpf regular file and prepares only the new owned volume/package destinations. It refuses invalid or foreign existing content. Keep private configuration outside archives.

~~~powershell
docker compose -f compose.iris-dev.yaml -p dicom3d-iris060 up --build -d
~~~

Default loopback ports are 52887 (web) and 51987 (superserver). Choose independent ports/projects/volumes when occupied. Inspect actual vendor health status, then separately activate the exact TGZ and test authenticated rendering. Preserve the durable volume across recreation.

## Limits and notices

Read the exact qualification receipt for tested image digests, runtime/IPM versions, lifecycle results and browser conditions. Native Windows IPM, other IRIS patches, authenticated low-privilege denial without an existing valid fixture, other browser/device coverage and clinical validation are not established by these instructions.

Preserve software LICENSE/NOTICE, third-party licenses and source-specific BodyParts3D/HRA notices. H000 public research-data admission remains independent and closed. Open Exchange and IPM registry publication remain user-owned.
