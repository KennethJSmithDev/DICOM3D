# Source and asset boundary

The frontend is the already-qualified Babylon Lite Safe Demo RC1 from source `e98aba4379ce24023ee56a2436bd57dfd79cefef`. Original ZIP SHA-256: `f7fc26ab4683363f63f5a198ff07c346c7893a27a462ea73226396f45a0668a6`. Its387public payload files are retained byte-for-byte. Do not substitute the later published v0.6.5 ZIP: it has a different identity and packaging.

The187,220,140-byte female GLB exceeds GitHub's single-file limit. This source packet uses the existing published v0.6.5 lossless parts, which concatenate to the exact RC1 GLB SHA-256 `24abc4d8bd0a00bfc93ab45e227c1e9b157ffc0d21d1e5c22408fbe3933f60cb`. `ASSEMBLY.json` binds each part and the output. The launcher assembles it in private runtime storage; the HTTP adapter serves those original bytes at the original URL. No mesh conversion, simplification, renderer or client-loader change is involved. All other original frontend payload files remain exact.

The included public H000 demonstration and its nine synthetic/public FHIR records are the previously approved research fixtures. No private study import, imaging download, segmentation/reconstruction or source transformation is performed. `PROVENANCE.json`, `MANIFEST.json` and the fixture records preserve identities and hashes.

Software licensing and asset licensing are separate. Existing frontend LICENSE/NOTICE, Babylon notices, BodyParts3D's retained CC BY-SA2.1Japan grant and HRA female's retained CC BY4.0 attribution remain alongside their assets. No source attribution or software license is changed. Original atlas geometry, units and selection identities are retained. Reference anatomy does not establish patient registration.

This packet is prepared locally; it does not authorize a new external asset publication. Retained source records and any historical source/version-specific attribution holds must be reviewed at the publication gate. Do not infer a new redistribution grant merely from local rendering or from the existence of an earlier public release.
