# Standalone Core Docker quick start — v0.5.1

Research/reference prototype, not clinical software. No IRIS, account or patient study is required. Optional Connect/FHIR is not provisioned or qualified by this distribution. This is an unpublished v0.5.1 candidate; obtain its complete Core ZIP and checksums from the qualification handoff. GitHub becomes the authoritative download source only after separately approved publication. Historical v0.5.0 remains available from its existing release.

Use Docker with Compose v2+ and Linux containers. The initial qualification target is linux/amd64; other architectures remain unverified. A WebGPU-capable desktop browser is required. The image build obtains the digest-pinned official Node base and lockfile-pinned npm dependencies; internet access is required for the first build. Node's built-in HTTP API serves the compiled viewer; no server package is installed.

1. Extract the complete Core distribution archive to a new directory. Keep its file tree intact. Verify its supplied SHA-256 and the included `distribution-manifest.json` before use.
2. From that extracted directory run:

```sh
docker compose -f compose.core.yaml -p dicom3d-core up --build -d --wait --wait-timeout 120
docker compose -f compose.core.yaml -p dicom3d-core ps
```

3. Open **http://127.0.0.1:53042/dicom3d/reference.html**. The male BodyParts3D reference loads automatically. Select Female to load the qualified HRA reference. Select structures and use the existing visibility/isolation, opacity, camera, clipping and reset controls. Both references have partial anatomical coverage and are independently sourced generalized models, not a registered patient scan.
4. If the port is occupied, copy `.env.core.example` to a private `.env.core`, choose a free port, and add `--env-file .env.core` to every Compose command. The bind address stays loopback-only. Do not put credentials or imaging paths in the environment file.

Operational checks:

```sh
docker compose -f compose.core.yaml -p dicom3d-core restart
docker compose -f compose.core.yaml -p dicom3d-core ps
docker compose -f compose.core.yaml -p dicom3d-core stop
docker compose -f compose.core.yaml -p dicom3d-core start --wait --wait-timeout 120
docker compose -f compose.core.yaml -p dicom3d-core down
```

`down` removes only this Compose project's containers/network. There are no persistent volumes, host mounts or server-side study storage. Do not run global prune or `down -v`. Leave unrelated IRIS/OpsDeck projects alone. Keep the built image unless its deletion is separately desired/authorized.

Reference files persist in the immutable image across container restart/recreation. Selection, transforms and local imported study buffers are browser-session presentation state; they are not saved by Docker. Reload returns to the default reference. Choose local study files again when needed. The Core server offers GET/HEAD static reads only and rejects writes; it does not upload or store those files. Optional public-source reader controls inherited from the candidate may contact their explicitly selected public providers; no private endpoint or credentials are configured here.

The container runs as the unprivileged Node user with a read-only filesystem, no added capabilities, 2 CPU / 768 MiB runtime limits and an HTTP healthcheck. Host-browser/GPU memory is outside those server limits. Health means the static host is serving its shell, not that WebGPU/anatomy rendering has passed.

## Assets and notices

Software remains Apache-2.0, personally copyrighted KennethJSmithDev. Preserve LICENSE, NOTICE and third-party/. BodyParts3D-derived data remains separately CC BY-SA 2.1 Japan as recorded in `reference/public/reference/BODYParts3D-NOTICE.txt`; HRA female data is CC BY 4.0, with creators/source/changes recorded in HRA-FEMALE-NOTICE.txt. Both notices and semantic manifests are served with the assets. No patient CT, SEG, H000 lesion, proprietary IRIS image, license key or credential is bundled.

To rebuild a distribution from an authorized working source snapshot using Python 3:

```sh
python scripts/archive-core.py --output /absolute/path/to/new-core.zip
```

Use a fresh output path. The archiver creates an explicit allowlisted source/asset archive and internal SHA-256 manifest without copying node_modules, caches, imaging studies or developer paths. Source Git HEAD plus the manifest digest identifies the candidate; HEAD alone is insufficient when accepted work is uncommitted. Qualify the exact extracted archive before claiming distribution PASS. The frozen release assets and recorded qualification, rather than a fresh unqualified rebuild, define this release.
