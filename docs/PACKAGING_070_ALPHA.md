# DICOM3D v0.7.0-alpha.1 — packaging contract

This contract assembles the existing Three.js/R3F application into standalone Core and native IPM distributions. Packaging selects the qualified implementation and preserves its source identities; it does not create another renderer, ingestion service or anatomy conversion pipeline.

The published v0.6.5 release and accepted PACKAGING-065-005 receipts remain immutable evidence. Their Docker/IPM results apply to their exact old payloads and do not automatically qualify the alpha.

## Owning paths

| Concern | Owner |
|---|---|
| Application and dependency lock | `prototypes/alpha/three-prototype` |
| Verified source-native runtime build | `prototypes/alpha/three-prototype/build-public-review.mjs` |
| Distribution aliases and inventory | `scripts/build-alpha-distribution.mjs` |
| Core build/context/runtime | `Dockerfile.core`, `Dockerfile.core.offline`, `.dockerignore`, `docker/core/server.mjs` |
| Core version and local launch | `distribution-manifest.json`, `compose.core.yaml` |
| Native classes and protected entry | `src/DICOM3D` |
| IPM file targets and version | `module.xml` |
| Exact package staging/archive | `scripts/stage-package.ps1`, `scripts/archive-package.py` |
| Software attribution | `LICENSE`, `NOTICE`, `third-party/alpha-runtime-NOTICE.txt`, `third-party/alpha` |

Use the actual source commit and checked-in lockfile. Do not point the alpha build at the old `viewer` frontend or use the historical `package-composite.mjs` assembly route.

## Frontend contract

The source-native build verifies the atlas index, source catalog, every semantic bundle/manifest and the HRA supplement before assembling the application. The distribution wrapper also binds the approved public H000 inventory and required notices. Exact inventories must include generated assets, worker scripts, Wasm modules and all on-demand bundle files. A successful initial screenshot does not prove an optional asset was distributed.

All source IDs, positions, normals, index spans, source-to-model transforms and explicit holds retain their accepted ownership. Exact compound selection reuses existing geometry through membership records. Version aliases and broad owner proxies are reported separately. This packaging step does not resolve disputed laterality or infer anatomy classifications.

Two compatibility aliases are deliberate:

- `reference.html` has exactly the same bytes as the alpha `index.html`.
- `reference/BODYParts3D-NOTICE.txt` resolves to the same admitted BodyParts3D notice used by the alpha.

The first preserves the existing native entry and the `Retire051` current-frontend check. Rebind its hash to the actual alias bytes. Preserve the exact 204-path retirement target map, policy hash and all no-follow, ownership, identity and preflight checks. Do not turn a new frontend into permission to sweep a CSP directory or delete unknown files.

The second preserves established contextual-learning attribution routes. Neither alias adds or duplicates model geometry. An installed alpha must not silently serve a leftover v0.6.5 `reference.html`.

## Data and licensing contract

DICOM3D code is Apache 2.0. The admitted BodyParts3D and HRA anatomy retain separate CC BY 4.0 attribution and historical notices. Framework/runtime dependencies retain their own license texts. Legacy Babylon/build-tool notices may remain as historical source material; their presence does not identify the alpha renderer or dependency versions.

The alpha includes approved public H000 CT/SEG research data. Record that inclusion explicitly, including the original source notices and exact asset hashes. Distinguish it from private patient studies: no personal DICOMs, reports, local credentials, protected fixture paths or private derived images belong in the package. A generic `containsPatientImaging:false` statement would be misleading for a distribution that includes H000.

A new alpha profile must retain exact file admission and integrity validation rather than disable the older reference-only checks. Public H000 admission does not authorize any other dataset. No source identity or segmentation relationship may be changed for packaging convenience.

## Core recipe

The pinned Node base is retained:

```text
node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f
```

The build stage uses the alpha package/lockfile and the source-owned distribution builder. The runtime stage uses the existing static Core host, nonroot user and loopback compose publishing. Health, redirects and asset delivery must resolve the alpha entry and report its actual distribution identity. Core has no IRIS dependency and accepts no uploads or clinical API requests.

The offline recipe uses a named, verified npm-cache build context. Reuse exact local tarballs where possible; any acquisition must use the lockfile's pinned approved-registry URL and integrity metadata. No dependency version or lockfile regeneration is implicit. The accepted v0.6.5 offline cache and its Linux native bindings do not establish the alpha cache's completeness.

Online and offline build results are distinct claims. A cached base image must retain its digest; a version tag alone is insufficient.

## Native IPM contract

`module.xml` identifies `dicom3d` version `0.7.0-alpha.1` and enumerates the current package-owned frontend. IPM's publisher [documents prerelease versions](https://github.com/intersystems/ipm/wiki/03.-IPM-Manifest-%28Module.xml%29). Inspect and test the installed IPM version rather than replacing the alpha label with a different version to evade a parser failure.

Retain the existing authenticated `/dicom3d`, `/dicom3d/assets` and `/dicom3d-api` applications, namespace ownership, native entry and exact migration policy. The application must use validated same-origin session requests when loading protected assets. Preserve the path allowlist, redirect restrictions and per-file hashes; do not solve an authenticated asset failure with anonymous access or security changes.

The existing qualified IRIS reference is the retained IRIS for Health 2026.2 fixture and its vendor `/iris-main` launch profile. Its old bootstrap and CSPpwd workaround are fixture-specific evidence, not a universal public setup recipe. Preserve the original instance, credentials, volumes and receipts. New tests must use an explicitly owned fixture and existing authorized credential references without recording their values.

IPM installation here hosts the frontend and identity API. It does not establish a distributable live IRIS/Orthanc retrieval adapter, PACS access or arbitrary-study segmentation.

## Qualification gates

| Gate | Required evidence |
|---|---|
| Source and assembly | Exact commit, lockfile, atlas/data pins, complete generated file inventory, required licenses |
| Archive | Reproducible archive process, SHA-256, safe extraction and exact extracted-file comparison |
| Docker | Pinned base, successful owned build, actual image identity, health/GET/HEAD/404/405 behavior, exact runtime files, shutdown/restart |
| Fresh IPM | Actual prerelease parsing, load/activation/listing, compiled classes, protected entry, anonymous401/authenticated200, all installed frontend/source hashes |
| Browser | Actual headed renderer/backend/hardware; representative male/female loading, picking, isolation, source imaging and lifecycle cleanup |
| On-demand assets | Missing/corrupt bundle rejection, retry and independent unload, distributed worker/Wasm/bundle identities |
| Upgrade | Separate existing-install fixture, settings/data and unrelated-file preservation, exact old-file retirement, working new entry |
| Uninstall/rollback | Independently exercised supported procedure; fresh-install success is insufficient |
| Publication | Separate reviewed branch/artifact destination, authorization and actual readback; local tests do not update GitHub, an IPM registry, Open Exchange or Pages |

The current source/documentation does not itself claim those runtime gates passed. Record exact commands, raw failures, fixture states, browser captures and measured resources in the owning receipt. ANSI-normalized package listing may help assertions, but retain the original raw output. A vendor health-check result and actual HTTP/rendered behavior are separate observations.

Qualification should remain proportionate to an early public-demonstration/research alpha. Reuse unchanged scientific and source evidence at its recorded scope; repeat affected paths. Installed artifacts, screenshots and process activity must never substitute for one another's claims.
