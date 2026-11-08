# Launch and review v0.7.0-alpha.1

Use an exact reviewed source checkout or artifact. The alpha is a research and educational preview with WebGPU preferred and a WebGL2 compatibility path. A version label alone does not identify the package; compare it with the [acceptance snapshot](RELEASE_070_ALPHA_ACCEPTANCE.md).

## Docker Core

For the published, digest-pinned image, use the [Docker installation command](INSTALL_070_ALPHA.md#published-image-no-source-build-required). It needs no source checkout. The source-build alternative below remains available with Docker running:

```powershell
docker compose -f compose.core.yaml up --build --detach core
```

Open [the local Core application](http://127.0.0.1:53042/dicom3d/). This is the normal compose default, not a requirement to create another preview when an operator already owns a working endpoint. Stop only this compose service with:

```powershell
docker compose -f compose.core.yaml stop core
```

Core needs no IRIS, Orthanc, AI service or private study. Building locally does not publish an image. Online and offline reproduction have separate qualification boundaries; see [installation](INSTALL_070_ALPHA.md) and [packaging](PACKAGING_070_ALPHA.md).

## IPM/ZPM

In an authorized IRIS terminal, `USER` namespace, load the exact reviewed TGZ made available to that instance:

```objectscript
zpm "load /path/to/dicom3d-0.7.0-alpha.1-002.tgz -v"
zpm "list"
```

Confirm activation and the actual alpha version in the output. Do not assume the public registry's `install dicom3d` command retrieves this candidate.

Open the instance's existing origin followed by `/dicom3d/DICOM3D.Entry.cls`, authenticate through the normal mechanism, then choose **Open DICOM3D viewer**. Use this Entry/login route again after restarting the instance. The recorded fixture returned 404 for a direct static bookmark after restart before the documented authenticated entry flow; do not change security settings or enable anonymous access as a workaround.

IPM hosts the same frontend and protected identity API. Installation does not automatically connect IRIS to a PACS, retrieve a study or segment organs. Fresh installation, upgrade, uninstall and rollback are separate claims.

## Extracted Safe Demo

The reviewed ZIP is an inventory-bound static frontend payload: extract it into a new directory and verify its SHA-256 and file inventory. It requires a compatible loopback HTTP host; opening `index.html` as a `file:` URL is not a qualified launch path. This archive does not contain a launcher or Node dependencies.

With Node 24 available, download the separately published preview helper from [downloads](DOWNLOADS_070_ALPHA.md), then serve the extracted directory:

```powershell
node dicom3d-0.7.0-alpha.1-preview.mjs --root <extracted-directory> --port 0
```

Alternatively, from this source checkout, use its existing inventory-checked helper:

```powershell
node scripts/preview-static.mjs --root <extracted-directory> --port 57980
```

Use an unused loopback port in your own environment; the qualification campaign reused only 57980. The helper prints the URL and verifies every admitted file before listening. Stop its console with Ctrl+C. It does not accept uploads, proxy requests or browse directories. Do not run it over an existing service on that port.

The exact extracted payload was witnessed in headed Edge on WebGPU and separately forced WebGL2. Switching hosts with different isolation headers on one origin exposed a cached-worker failure; clearing only the automation-owned browser cache restored the NRX worker. Normal separate installation origins do not inherit that test cache. Keep the failure disclosure when reproducing same-origin host changes.

## Quick review

1. Confirm the displayed alpha version and actual renderer backend. WebGL2 success is not a WebGPU PASS.
2. Explore male anatomy, load the complete reference if needed, search a source name, select, focus, isolate and restore it. Skin begins hidden.
3. Switch to the female composite. Check a shared structure and an HRA component; inspect source-specific attribution. A component and its larger compound remain distinct selections.
4. Open the public H000 example. Navigate source frames, toggle SEG highlighting and inspect the linked lesion/CT presentation. Whole CT volume display requires WebGPU; it does not segment every organ.
5. Open Learn for the current reference or imaging context. Return to the full-body reference when finished.

Materialization introduces available anatomy and settles into Scientific presentation; its visual assembly does not reconstruct new anatomical data. Generalized anatomy and acquired imaging retain distinct source identities. Approximate/manual comparison is disclosed and reversible, not patient-specific registration.

Keep personal DICOMs, reports and credentials local. Share only public-safe screenshots and the exact source/artifact identities when reporting an issue. The current [acceptance snapshot](RELEASE_070_ALPHA_ACCEPTANCE.md) lists remaining limitations and pending gates; no launch instruction authorizes push, deployment or replacement of the established public release.
