# DICOM3D Core installation

Core runs the anatomy and imaging research viewer independently of IRIS and Orthanc. It includes the curated public H000 and H001 examples and opens prepared local study files without uploading them. Live CT and native-frame retrieval are currently qualified in a separate connected preview with isolated authentication and source fixtures. The standalone package excludes those credentials, services and original DICOM objects.

## Run a standalone ZIP

Verify the ZIP against its accompanying SHA-256 record, then extract it into a new directory. From that directory, with Node.js 24 available, run:

```sh
node docker/core/server.mjs --local
```

Open the loopback URL printed in the terminal. Stop Core with Ctrl+C in that terminal. To return to an earlier version, run it from its preserved extraction directory. Local studies do not become part of the extracted installation.

## Create a local review package

From the candidate source checkout, build the frontend into a fresh directory and review its inventory with the existing build gate.

```sh
node scripts/build-alpha-distribution.mjs NEW_BUILD SEE-EXACT-INPUTS
node scripts/test-alpha-distribution.mjs NEW_BUILD
python scripts/archive-core.py --candidate-build NEW_BUILD --build-manifest-sha256 REVIEWED_SHA256 --output NEW_CORE.zip
```

Use the lowercase SHA-256 of NEW_BUILD/demo-build-manifest.json. The archiver verifies the frontend inventory and records the exact Core runtime bytes separately. An uncommitted candidate keeps its frontend source marker and requires an independent exact-archive installation witness.

## Create a Docker build-input archive

Stage the reviewed frontend and regenerate the source inventory before committing. From the exact committed source checkout, run:

```sh
python scripts/archive-core.py --source-commit EXACT_COMMIT --output NEW_CORE_SOURCE.zip
```

This ZIP contains the inputs for both Core Docker recipes. It requires the pinned base image and lockfile dependencies, or the verified offline npm cache for the offline recipe. It includes neither a Docker image nor an IPM installer. Core's Docker port is bound to loopback by Compose and configurable through DICOM3D_CORE_PORT. The default image tag in the 0.8.0 checkout is 0.8.0, and DICOM3D_CORE_IMAGE_TAG can override it. The package receipt records source identity and scope. Review Docker and native IPM distributions separately.
