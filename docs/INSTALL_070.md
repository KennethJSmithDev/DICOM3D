# Installing the DICOM3D 0.7.0 candidate

DICOM3D is an interactive anatomy and medical imaging research viewer. The same frontend runs in the standalone download and the IRIS package. Start with the reference atlas, or open **Imaging → Open H000 example** to explore the included public CT and its source segmentation. The viewer identifies generalized anatomy separately from acquired imaging.

## Standalone viewer

Verify the ZIP against the accompanying SHA-256 record, extract it into a new directory and open a terminal there. With Node.js 24 available, run:

```sh
node scripts/preview-static.mjs --root public --port 0
```

Open the loopback URL printed by the launcher. Ctrl+C in that terminal stops the preview. The viewer includes the male and female references, Learn, H000, local FHIR inspection, read-only OpenAPI export, limited HL7 v2 drafting and a synthetic SMART demonstration. Ordinary offline exploration requires no FHIR account or server. The optional configured ImagingStudy reader requires an authorized HTTPS source and explicit credentials for that source. Setup and supported fields are documented in [FHIR interoperability](FHIR_INTEROP_ALPHA2.md) and [Synthetic SMART](SMART_SYNTHETIC_FOUNDATION.md).

## IRIS and IPM

Use an isolated research installation with a suitable IRIS web gateway, IPM in the USER namespace and Embedded Python available for the installation adapter. Verify the TGZ against the accompanying SHA-256 record and make it readable to the instance. From the authorized USER terminal run:

```objectscript
zpm "load /path/to/dicom3d-0.7.0.tgz -v"
zpm "list"
```

Confirm activation succeeded and IPM reports version 0.7.0. Open `/dicom3d/DICOM3D.Entry.cls` on the instance's normal web origin, sign in, and follow **Open DICOM3D viewer**. The authenticated `/dicom3d-api/health` endpoint reports the product version. For configured live reads, an administrator must grant a reader one explicit source/study binding and the FHIR repository must authorize that reader. The package supplies the viewer and the binding route. Data, credentials and site permissions belong to the installation.

## Source builds and rollback

The source checkout includes the online and offline Docker Core recipes. Use the exact source revision in the candidate receipt when reproducing the build. The standalone ZIP is a runnable distribution with an existing Node 24 installation; the TGZ targets IPM. Neither artifact is a Docker image.

Install evaluation packages alongside the working installation. To return to the previous version, reopen its preserved instance or preview. For an in-place installation, retain and test a backup of the instance, configuration and application files before upgrading. The historical GitHub release assets for v0.7.0-alpha.1 and v0.6.5 have separate identities.

The receipt accompanying the local artifacts records which runtime and installation checks were exercised. Use synthetic inputs for interoperability testing. This software is for research and education.
