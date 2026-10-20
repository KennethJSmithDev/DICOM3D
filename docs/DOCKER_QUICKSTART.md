# Docker quick start — qualified development profile

> **Historical v0.1.0 IRIS/IPM reproduction only.** This embedded Compose template is **not** a self-contained quick start: the new named volume must first be prepared with the nonroot IRIS owner, as directed below. Copying the YAML alone may fail with `ERROR #5001: Cannot create target: /durable/iris/`. For the published v0.5.1 isolated host use [IRIS Docker development host](IRIS_DOCKER_DEV_051.md) and `compose.iris-dev.yaml`. Published standalone Core uses [CORE_DOCKER_QUICKSTART.md](CORE_DOCKER_QUICKSTART.md). Do not change the historical image, recorded archive hash or another project's volume.


This procedure reproduces the V010-E mechanism. Use Docker Desktop with Linux/amd64 containers and PowerShell7. The tested engine is29.8.2. Do not use another application's container/volume. It is research software, not for clinical use.

Frozen development package: dicom3d-0.1.0.tgz, SHA-256
`b8cba446cd3873fef47518a8eed04e676bb29ea30e332c30496497718c371d3a`.
The qualified v0.1.0 artifact is available from the GitHub v0.1.0 release. Build/stage with `scripts/stage-package.ps1` and `scripts/archive-package.py`; generated artifacts are ignored. Compare the archive hash before loading it. Do not substitute source-head qualification for exact-artifact verification.

Use this Compose template in a new local directory, alongside a private `.secrets/merge.cpf` and your frozen archive. Names and ports must be available. Do not use `down -v`, reset or cleanup another project.

```yaml
services:
  iris:
    image: intersystemsdc/irishealth-community@sha256:7746ec696970a7e41fc265e9828a99c0bc1bc534a514f1690e60fb03c957cff2
    container_name: dicom3d-quickstart-iris
    entrypoint: ["/iris-main"]
    environment:
      ISC_DATA_DIRECTORY: /durable/iris
      ISC_CPF_MERGE_FILE: /dicom3d-setup/merge.cpf
    ports:
      - "127.0.0.1:52886:52773"
      - "127.0.0.1:51986:1972"
    volumes:
      - iris-data:/durable
      - ./.secrets/merge.cpf:/dicom3d-setup/merge.cpf:ro
    shm_size: 64m
    stop_grace_period: 30s
volumes:
  iris-data:
    external: true
    name: dicom3d-quickstart_iris-data
```

Generate a cryptographically random local password, keep it in ignored `.secrets/iris-password.txt`, and feed it twice via stdin to the vendor PasswordHash utility:
`containers.intersystems.com/intersystems/passwordhash:1.1@sha256:784ee9ad3b6daf54badc0a7f57a934de7633d27da0da38e6482c2306d3d898db`, arguments `-algorithm SHA512 -workfactor 10000`.
Write `[Startup]` followed by its hash output to `.secrets/merge.cpf`. Do not put passwords in Compose, source control, shell arguments or receipts.

Create the NEW named volume. Using the pinned IRIS image and a one-shot root shell with only that volume mounted at `/durable`, run `mkdir -p /durable/iris && chown irisowner:irisowner /durable/iris`. Then `docker compose -p dicom3d-quickstart up -d`. Root is used only for filesystem ownership; no IRIS end-user roles are added.

Wait for initialization to finish. Inspect `docker logs`, `iris qlist IRIS`, and `/irisHealth.sh` within this container. First-boot community IPM mapping warnings were observed. A graceful `docker restart --timeout 30 dicom3d-quickstart-iris` after completed initialization recovered the tested targets to running/ok. Preserve warnings; never clear alerts or disable the healthcheck to manufacture success. Stop if health fails to recover.

Before package load, establish only the package directories `/usr/irissys/ipm/dicom3d` and `/usr/irissys/csp/dicom3d`, owner irisowner, mode0700, matching the tested donor pattern. Copy the verified archive into the container, hash it again, then in `iris session IRIS -U USER` run:

```objectscript
zpm "load /tmp/dicom3d-0.1.0.tgz"
zpm "list"
```

Require Activate SUCCESS and dicom3d0.1.0. Open `http://127.0.0.1:52886/dicom3d/DICOM3D.Entry.cls` and sign in with the locally initialized _SYSTEM development credential. Production end-user provisioning is outside this development profile. No role is granted by DICOM3D. Verify BOTH applications' native `Resource=%Development`, Password auth32, API401/static404 unauthenticated and denial to a role-free identity.

The native entry links to the viewer; `/dicom3d-api/health` returns nonclinical identity. Choose your own accepted manifest/GLB locally. Check select/clear/hide/show, restart/persistence, then `zpm "uninstall dicom3d"`. Verify DICOM3D classes, both routes and static files absent; reinstall the SAME hash and recheck native reads.

## Image provenance and support limits

The image is community-maintained, from [zpm-dockerhub](https://github.com/intersystems-community/zpm-dockerhub), not a claimed vendor ICR equivalent. Tested runtime is IRIS for Health2026.2/221U, USERIPM0.10.5-SNAPSHOT mapped from HSLIB (%SYS0.10.9). Snapshot and startup warning limitations are explicit. Other versions, architectures and native Windows IPM are unverified.

InterSystems Community Edition is intended for evaluation/testing, has data/core/functionality limits and a time-limited license. Consult the [vendor limitations](https://irisdocs.intersystems.com/irisforhealthlatest/csp/docbook/DocBook.UI.Page.cls?KEY=ACLOUD) and [container guidance](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=ADOCK). No IRIS image/license is redistributed in the DICOM3D package; upstream open-source licenses do not grant an IRIS redistribution license.
