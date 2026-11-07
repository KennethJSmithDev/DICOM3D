# DICOM3D v0.7.0-alpha.1 downloads

**Exact release identities.** These artifacts have the recorded local qualification; verify their availability and hashes against the versioned GitHub release. Download links become available when the reviewed prerelease is published. The public Live Demo is updated separately through a manual Pages action, so inspect its displayed version rather than assuming it matches a newly published download.

| Download | Purpose | SHA-256 |
|---|---|---|
| [Safe Demo ZIP](https://github.com/KennethJSmithDev/DICOM3D/releases/download/v0.7.0-alpha.1/dicom3d-0.7.0-alpha.1-safe-demo.zip) | Exact 87-file static payload, including expanded references, approved public H000 and notices | `b36566266ad7441e63326197dc042194bcc0754681972abd75b6b954fe8d4368` |
| [IPM archive](https://github.com/KennethJSmithDev/DICOM3D/releases/download/v0.7.0-alpha.1/dicom3d-0.7.0-alpha.1-002.tgz) | Fresh installation into an authorized IRIS host; not a public registry update | `6b4215b78134df6f1d9189072e7b7b1b0b639bfe59c9687ea730ca2405070d18` |
| [Local preview helper](https://github.com/KennethJSmithDev/DICOM3D/releases/download/v0.7.0-alpha.1/dicom3d-0.7.0-alpha.1-preview.mjs) | Existing inventory-checked loopback host; Node 24 and the extracted ZIP required | `db085fd92811483cae68ace1c864a6520d9dbf8ddfd8a0a297ddba9cf8511313` |
| [SHA256SUMS](https://github.com/KennethJSmithDev/DICOM3D/releases/download/v0.7.0-alpha.1/SHA256SUMS) | Checksums for the three exact files above | Compare with this page and the release packet |

For local exploration, extract the Safe Demo ZIP into a new directory, place the preview helper nearby, then run:

```powershell
node dicom3d-0.7.0-alpha.1-preview.mjs --root <extracted-directory> --port 0
```

Open the loopback URL printed by the helper. It verifies the payload before serving, accepts no uploads and requires no IRIS, Orthanc or AI service. Stop it with Ctrl+C. Opening the HTML directly with `file:` is not the qualified launch path. If replacing another host on the same origin, stale cached worker headers can require clearing that site's cache; see the [acceptance disclosures](RELEASE_070_ALPHA_ACCEPTANCE.md#hosting-transition-disclosures).

For Docker source builds and the protected native Entry/login route, follow [installation](INSTALL_070_ALPHA.md) and [launch instructions](LAUNCH_070_ALPHA.md). The local qualified Docker image is identified in the [acceptance record](RELEASE_070_ALPHA_ACCEPTANCE.md); this release does not publish a Docker Hub image. A GitHub release attachment also does not update Open Exchange or the IPM registry. Do not assume `zpm "install dicom3d"` retrieves this archive.

GitHub's tag source archives are **source**, not a prebuilt Core runtime or native MSI/EXE. Fresh local Docker/IPM installation was exercised; online Docker acquisition, in-place upgrade, settings/data migration and installed rollback remain separate gates. No arbitrary-study organ segmentation or live PACS admission is claimed.

## Preserved v0.6.5 rollback

The [published v0.6.5 release](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.5) and tag `4d5cac71cf1266c8eb1a272ae44ac528d238f919` remain unchanged:

- `dicom3d-0.6.5-safe-demo.zip`: `2d3e91c5805860a8df6266ce7b4d9d375a898823feb4e58e8a435be38cc00f9f`.
- `dicom3d-0.6.5-core-source.zip`: `5d286bffe21f5aef335694c37325ba37a5d77f0ed9d4014e3a1bdcfdd96cda6e` — source, not a built runtime.

The prepared Pages workflow can explicitly restore the frozen Safe Demo asset without resetting main, rewriting history or rebuilding the legacy viewer. That is a static-site rollback, not a qualified rollback of an installed IRIS/Core application or private study data. See the [release procedure](RELEASE_070_ALPHA_PROCEDURE.md).
