# Qualified Docker package development profile

0.0.3 is qualified in USER on the community-maintained image
`intersystemsdc/irishealth-community@sha256:7746ec696970a7e41fc265e9828a99c0bc1bc534a514f1690e60fb03c957cff2`
(linux/amd64, IRIS for Health 2026.2 Build221U, USER IPM0.10.5-SNAPSHOT mapped from HSLIB).
This is not a vendor ICR image equivalence or general native Windows IPM support claim.

The module owns DICOM3D classes, `/dicom3d`, `/dicom3d-api` and its generated CSP files.
Both applications require Password authentication and `%Development`; they grant no roles.
The manifest uses `Resource`, the native Security.Applications property.

Run `scripts/stage-package.ps1` to stage classes, module.xml and a built viewer in an empty directory.
Archive that directory and bind the exact SHA-256 before installation. Never include local study files.
In an isolated USER namespace, use `zpm "load /path/to/archive.tgz"` and verify installed inventory,
both application resource settings, authenticated browser/API, and denial without the resource.
Use `zpm "uninstall dicom3d"`, verify both classes/routes and all package static files absent,
then reinstall the same archive. Do not use force/purge or grant broad roles to end users.

The development target recovered from an initialization alert after one graceful restart using its
existing durable volume. The original image healthcheck remains enabled; require running/ok and
Docker healthy. Do not clear genuine alerts or reset volumes to manufacture a PASS.
Native Windows 0.0.2 viewer/API qualification is separate; native Windows IPM remains unverified.
No CT/SEG/GLB/manifest examples are distributed. Research presentation only; no clinical claims.
