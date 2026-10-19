# IRIS Docker development host — v0.5.1 recovery candidate

**Status: experimental / not yet runtime-qualified.** This is an optional IRIS/IPM development host, NOT the standalone Core Docker distribution. It provides a reproducible, isolated way to investigate the 2026-10-19 durable storage error. The previously qualified v0.1.0 profile remains recorded in [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md).

## Why this exists

InterSystems IRIS runs as nonroot `irisowner` (UID/GID 51773 in documented Linux container profiles). A named volume mounted at `/durable` can initially be root-owned; IRIS must be able to write `/durable/iris` before the first startup. The old quickstart required a separate, manually executed root-owned preparation command, which is easy to miss when copying only its Compose template. The new `compose.iris-dev.yaml` makes that preparation an explicit dependency of IRIS startup.

**Root cause of the moderator's 2026.1/235U failure remains UNVERIFIED.** This compose file retains the independently pinned community-maintained 2026.2/221U image used by the historical DICOM3D profile. It is **not** a reproduction of the moderator's exact image. Do not claim 2026.1 compatibility without a separate test.

## Boundary and safety

- Use a new checkout/workspace with Docker Compose v2 and Linux/amd64 containers.
- Only `dicom3d-iris-dev051` and its **own new named data volume** are in scope; never reuse another project volume, existing patient instance or port.
- `prepare-durable` runs one shell as root, initializes the top-level empty volume and `/durable/iris` to UID/GID 51773, then exits. IRIS itself runs as the image's nonroot user.
- If durable contents already exist with unexpected ownership, preparation **fails closed**. It does not recursively change ownership, erase or migrate existing data.
- The pinned image comes from the community-maintained repository, not a proven equivalent of the vendor ICR image.
- This is an authorized development profile. Do not put credentials, clinical data or license files into Git.

## Prepare private authentication configuration

The `iris` service still requires `.secrets/merge.cpf` with a vendor-compatible, locally generated password hash. Follow the private hash-generation guidance in [the historical setup](DOCKER_QUICKSTART.md), using the pinned vendor PasswordHash utility and keeping the password out of source control, CLI arguments, logs and receipts. Verify that the file exists **as a regular file** before starting IRIS:

```sh
test -f .secrets/merge.cpf
```

Do not commit or publish that file. A missing merge file is a separate startup error from the durable-volume permissions problem.

## Validate and bootstrap

```sh
docker compose -f compose.iris-dev.yaml config --quiet
docker compose -f compose.iris-dev.yaml up prepare-durable
docker compose -f compose.iris-dev.yaml ps -a
```

The preparation service must exit with status 0 and report numeric ownership 51773 on `/durable` and `/durable/iris`. The new volume is created automatically. **Do not** use `docker compose down -v` or a global Docker prune.

Once the private merge file is present, verify the directory from the nonroot IRIS image *before* attempting IRIS startup:

```sh
docker compose -f compose.iris-dev.yaml run --rm --no-deps --entrypoint /bin/sh iris -eu -c 'test "$(id -u)" = 51773 && test -w /durable/iris'
```

Then start only this isolated development service:

```sh
docker compose -f compose.iris-dev.yaml up -d iris
docker compose -f compose.iris-dev.yaml ps -a
docker compose -f compose.iris-dev.yaml logs --no-color --tail=160 prepare-durable iris
```

Do not call startup successful until IRIS reports a running instance, its health check succeeds, and `iris qlist IRIS` confirms its targets. Investigate warnings rather than suppressing them. The development web entry is bound to `127.0.0.1:52887` and the superserver to `127.0.0.1:51987`.

## Distinguish startup from IPM installation

Only after IRIS initializes, verify IPM in **USER** (the namespace hard-coded into the DICOM3D web applications). For a source-controlled positive control, load the *existing* GitHub v0.5.0 package **without modifying its bytes**:

- GitHub asset: `dicom3d-0.5.0.tgz`
- Required SHA-256: `cfc8eeafd29c2cc98e731c7a6d7aa10fca0eaa2ca7559c5817fcbc79670bd49d`

Copy it to an approved container location, verify its SHA-256 again, then from a USER IRIS terminal:

```objectscript
zpm "load /approved/path/dicom3d-0.5.0.tgz"
zpm "list"
```

Require module version 0.5.0, Activate SUCCESS and authenticated `/dicom3d/DICOM3D.Entry.cls`, `/dicom3d/reference.html`, static assets and `/dicom3d-api/health`. Independently verify unauthorized requests are denied. Do not confuse a successful IRIS boot with a successful package install, or a successful API response with visible WebGPU rendering. Once v0.5.1 is built and qualified, test its *own* SHA-pinned artifact separately.

The public registry must also be checked independently: the Open Exchange listing version is not proof of the downloaded registry package version.

## Preserve diagnostics and state

If boot fails, retain `docker compose config`, `ps -a`, service logs, numeric directory ownership, image digest and IRIS version; redact authentication secrets. On the named volume, read existing diagnostics but do not reset `/durable`. Use `docker compose -f compose.iris-dev.yaml down` to stop/remove only these containers and their network while **preserving the volume**. Never use `down -v`, force uninstall, or broad permission changes to manufacture a pass.

A narrow remote preflight workflow validates Compose syntax, runs the preparation service on its *own disposable GitHub runner volume*, and tests a nonroot write. That is a filesystem gate, **not** an IRIS boot, IPM install or moderator-environment reproduction claim.

Official guidance: [InterSystems container durable %SYS](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=ADOCK) · [Docker Compose dependency conditions](https://docs.docker.com/reference/compose-file/services/#depends_on).
