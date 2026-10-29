# v0.5.0 release scope

GitHub v0.5.0 is published and authoritative for frozen release downloads. Open Exchange/IPM registry status must be verified separately. DEMO-050 subsequently deployed the same reference-anatomy experience to the existing GitHub Pages URL.

The immutable UX-RACE-001 Core baseline is SHA-256 `03a8bcf6e05b127cdcc7068c0ee534b53522cde3d6737e3fa1f3cbb13e0fa77d`. Final v0.5.0 archives have new identities because version, packaging and documentation metadata differ. Exact hashes are in the accompanying release-manifest.json and SHA256SUMS; do not substitute the baseline archive. The publication README and documentation changes receive new Core/source archive hashes; the IPM runtime archive remains unchanged.

Release assets: dicom3d-core-0.5.0.zip, dicom3d-0.5.0.tgz, dicom3d-source-0.5.0.zip, release-manifest.json, SHA256SUMS and release notes. Core contains the distributed Dockerfile/Compose/config/server, lockfile-pinned viewer source and licensed reference assets. The IPM TGZ contains the generated public viewer, required notices, module.xml and DICOM3D classes. The source ZIP includes the corresponding repository FileCopy inputs and packaging scripts; no Node modules, credentials, proprietary image or medical study is included.

The version is 0.5.0 in frontend/package lock, module.xml, identity API and Core image/distribution metadata. The package wrapper remains a protected static viewer, not production-ready IRIS Connect. No FHIR repository, clinical endpoint, user/role grant or patient storage is configured.

Geometry, pixels, transforms, semantic identities, viewer algorithms and runtime dependencies are preserved from the accepted baseline. Reuse its behavioral evidence only where final built JS/CSS/reference bytes match; qualify changed packaging, routes and version metadata against exact final files. Historical v0.1.0/v0.2.0 releases remain unchanged. The public Safe Demo is a separate deployment and subsequently advanced to [DEMO-050](SAFE_DEMO.md) on October 18, 2026; its [Pages deployment](https://github.com/KennethJSmithDev/DICOM3D/actions/runs/39166437377) completed successfully.

See INSTALL_050.md and COMPATIBILITY_050.md. The accepted qualification receipts and published release manifests bound the tested claims; a source version number alone is not a qualification claim.
