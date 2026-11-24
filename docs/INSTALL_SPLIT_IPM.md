# Split IPM installation candidate

This 0.8.0 source-module configuration separates the small IRIS module from the public viewer assets. It is distinct from the original self-contained GitHub release archive. The module does not automatically install the assets and requires the setup step below.

On the IRIS host, before loading the module into a **fresh** installation, use Python 3.11 or later to provision a new CSP directory:

```sh
python provision-ipm-assets.py --destination /path/to/iris/csp/dicom3d
```

The script downloads the existing public GitHub 0.8.0 IPM archive, verifies its fixed byte count and SHA-256, verifies the pinned frontend manifest and every asset, and places the files into the new directory. For offline setup, supply the already downloaded `dicom3d-0.8.0.tgz` with `--bundle /path/to/dicom3d-0.8.0.tgz`.

Then load the source module in the authorized IRIS namespace using `zpm "load /path/to/module/dir"`, or load the small split archive. The installation must use the same CSP directory. It requires appropriate permissions and sufficient temporary disk space. The destination must not already exist: the tool refuses to overwrite an existing installation. Back up and plan migrations separately; in-place upgrade and automatic asset cleanup are not implemented.

The module's uninstall removes its classes, but the separately provisioned asset directory remains and must be retained or removed by its administrator after verifying ownership and backups. Do not treat the IPM uninstall as asset cleanup. The viewer and source assets retain their existing attribution and research-only boundaries.
