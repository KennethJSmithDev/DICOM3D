# IRIS Docker development host — published v0.5.1

**Current status, October 20, 2026: v0.5.1 is published.** Local full startup, IPM activation, exact-artifact, browser and lifecycle evidence is recorded separately in [RELEASE_051.md](RELEASE_051.md). This optional development host is separate from standalone Core. The previously qualified v0.1.0 profile remains recorded in [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md). The positive-control procedure below intentionally retains the v0.5.0 artifact; use [INSTALL_051.md](INSTALL_051.md) for the exact published v0.5.1 package. No v0.6.0 IPM or Docker qualification is implied.

## Why this exists

InterSystems IRIS runs as nonroot `irisowner` (UID/GID 51773 in documented Linux container profiles). A named volume mounted at `/durable` can initially be root-owned; IRIS must be able to write `/durable/iris` before the first startup. The old quickstart required a separate, manually executed root-owned preparation command, which is easy to miss when copying only its Compose template. The new `compose.iris-dev.yaml` makes that preparation an explicit dependency of IRIS startup.

The reported `Cannot create target: /durable/iris/` error was independently reproduced with an unprepared root-owned volume and community IRIS Health 2026.1.0.235.2 (reported Build 235U). The prepared profile starts successfully in that build family. The moderator's exact image digest, patch and configuration remain UNVERIFIED. The default Compose base remains the pinned community 2026.2/221U image; it is not silently substituted.

A separate healthy-host failure was also reproduced: stock nonroot IRIS cannot create `/usr/irissys/ipm/dicom3d/0.5.0/`. The frozen package activates after only DICOM3D's destinations are writable. `Dockerfile.iris-dev` adds two package-specific links: `/usr/irissys/ipm/dicom3d` → `/durable/dicom3d/ipm`, and `/usr/irissys/csp/dicom3d` → `/durable/dicom3d/csp`. Preparation creates those exact owned directories. No installation-wide chmod/chown, role grant, payload removal or new renderer is involved. Database and static application files survive on this project's volume.

## Boundary and safety

- Use a new checkout/workspace with Docker Compose v2 and Linux/amd64 containers.
- Only `dicom3d-iris-dev051` and its **own new named data volume** are in scope; never reuse another project volume, existing patient instance or port.
- `prepare-durable` runs one shell as root, initializes the empty volume, `/durable/iris` and the three exact `/durable/dicom3d` directories to UID/GID 51773, then exits. IRIS itself runs as the image's nonroot user. The runtime is bounded to 2 CPU / 2 GiB, 64 MiB shared memory and a 30-second graceful stop.
- If durable contents already exist with unexpected ownership, preparation **fails closed**. It does not recursively change ownership, erase or migrate existing data.
- The pinned image comes from the community-maintained repository, not a proven equivalent of the vendor ICR image.
- This is an authorized development profile. Do not put credentials, clinical data or license files into Git.

## Prepare private authentication configuration

The `iris` service still requires `.secrets/merge.cpf` with a vendor-compatible, locally generated password hash. Follow the private hash-generation guidance in [the historical setup](DOCKER_QUICKSTART.md), using the pinned vendor PasswordHash utility and keeping the password out of source control, CLI arguments, logs and receipts. Verify that the file exists **as a regular file** before starting IRIS:

```sh
test -f .secrets/merge.cpf
```

Do not commit or publish that file. A missing merge file is a separate configuration error. Preparation verifies the actual mounted file type before touching durable data. This is required even with `create_host_path: false`: the tested Docker Desktop permitted a missing Windows bind source to reach container creation.

## Validate and bootstrap

```sh
docker compose -f compose.iris-dev.yaml config --quiet
docker compose -f compose.iris-dev.yaml build iris
docker compose -f compose.iris-dev.yaml up prepare-durable
docker compose -f compose.iris-dev.yaml ps -a
```

The preparation service must exit with status 0 and report numeric ownership 51773 on `/durable` and `/durable/iris`. The new volume is created automatically. **Do not** use `docker compose down -v` or a global Docker prune.

Once the private merge file is present, verify the directory from the nonroot IRIS image *before* attempting IRIS startup:

```sh
docker compose -f compose.iris-dev.yaml run --rm --no-deps --entrypoint /bin/sh iris -eu -c 'test "$(id -u)" = 51773 && test -w /durable/iris && test -w /usr/irissys/ipm/dicom3d && test -w /usr/irissys/csp/dicom3d'
```

Then start only this isolated development service:

```sh
docker compose -f compose.iris-dev.yaml up -d --wait --wait-timeout 300 iris
docker compose -f compose.iris-dev.yaml ps -a
docker compose -f compose.iris-dev.yaml logs --no-color --tail=160 prepare-durable iris
```

Require a running instance and the real image healthcheck within five minutes. The pinned image explicitly accepts `warn` or `ok`; observed `%IPM` mapping warnings did not prevent healthy startup. Preserve warnings and test restart separately. Never reset a volume or suppress health checks to manufacture PASS. The development web entry is bound to `127.0.0.1:52887` and the superserver to `127.0.0.1:51987`.

## Distinguish startup from IPM installation

Only after IRIS initializes, verify IPM in **USER** (the namespace hard-coded into the DICOM3D web applications). For a source-controlled positive control, load the *existing* GitHub v0.5.0 package **without modifying its bytes**:

- GitHub asset: `dicom3d-0.5.0.tgz`
- Required SHA-256: `cfc8eeafd29c2cc98e731c7a6d7aa10fca0eaa2ca7559c5817fcbc79670bd49d`

Copy it to an approved container location, verify its SHA-256 again, then from a USER IRIS terminal:

```objectscript
zpm "load /approved/path/dicom3d-0.5.0.tgz"
zpm "list"
```

Require module version 0.5.0 for this positive control, Activate SUCCESS and authenticated `/dicom3d/DICOM3D.Entry.cls`, `/dicom3d/reference.html`, static assets and `/dicom3d-api/health`. Independently verify unauthorized requests are denied. Do not confuse a successful IRIS boot with a successful package install, or a successful API response with visible WebGPU rendering. The published v0.5.1 package has its own SHA-pinned identity and separate recorded qualification; the positive-control hash is not interchangeable.

The public registry must also be checked independently: the Open Exchange listing version is not proof of the downloaded registry package version.

## Preserve diagnostics and state

If boot fails, retain `docker compose config`, `ps -a`, service logs, numeric directory ownership, image digest and IRIS version; redact authentication secrets. On the named volume, read existing diagnostics but do not reset `/durable`. Use `docker compose -f compose.iris-dev.yaml down` to stop/remove only these containers and their network while **preserving the volume**. Never use `down -v`, force uninstall, or broad permission changes to manufacture a pass.

The updated CI workflow validates preparation, full runtime health/running state and frozen v0.5.0 IPM activation on its own disposable runner resources. Its execution status is evidence only after that run completes. Browser pixels, effective authorization, lifecycle and the separate 2026.1 comparison require their own receipts. No FHIR setup is performed.

Official guidance: [InterSystems container durable %SYS](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=ADOCK) · [Docker Compose dependency conditions](https://docs.docker.com/reference/compose-file/services/#depends_on).
