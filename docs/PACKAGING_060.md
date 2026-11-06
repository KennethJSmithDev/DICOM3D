# v0.6.0 installation source and reproduction

The original v0.6.0 tag identifies accepted web/source commit d3490dd659e19e44b8800abe87bbc626f45350a2. A later packaging completion commit reconciles installation identifiers and consumes the accepted visual source. The external release/artifact manifest records that exact later commit, source snapshot, archive hashes and qualification receipts. Never move the tag or relabel an earlier snapshot.

The corrected native package is bound to `bb7d34f250bd09852273924fa6f711e190c49c2c` and its separate `dicom3d-ipm-source-0.6.0.zip`. Use `INSTALLATION_ARTIFACTS_060_IPM.json`, `IPM_060_RECEIPT.md` and `SHA256SUMS-IPM` for that native completion. All five native release assets were published and their GitHub digests and independent download hashes matched the frozen packet. The earlier qualified Core packet retains its original artifacts and source identity. The follow-on curated Safe Demo branch descends from the corrected native source but does not regenerate that frozen installer or its source manifest.

## One frontend source

Core and IRIS/IPM invoke scripts/build-demo.mjs with the reference-only default and base /dicom3d/. Pages retains /DICOM3D/ and explicitly selects `--profile curated-h000` for the separately admitted optional research study. Both use viewer/reference.html, the existing Babylon Lite renderer, the pinned lockfile and exact reference/brand assets. The installer profile keeps study loading disabled; selecting the curated profile for its base is rejected. No anatomical source, transform or semantic sampling change is needed.

The builder copies exact admitted assets and notices; Vite automatic public-directory copying stays disabled. The static verifier checks complete output. Source archives use the explicit Git inventory rather than recursive local discovery, so ignored H000 files, CT screenshots, credentials and caches cannot enter by being present in a developer directory.

## Reproduce from the identified packaging source

Extract the supplied packaging-source snapshot to a fresh directory, or check out the exact packaging commit recorded in INSTALLATION_ARTIFACTS_060.json. Use Git LF checkout/export bytes; do not substitute Windows CRLF copies for content-bound source inventory. Two branding SVGs retain their accepted bytes through .gitattributes.

With Node.js 24, Python and PowerShell:

~~~powershell
npm ci --prefix viewer --no-audit --no-fund
node scripts/build-demo.mjs --base /dicom3d/ --out-dir NEW_FRONTEND
node scripts/test-demo.mjs --base /dicom3d/ --out-dir NEW_FRONTEND
./scripts/stage-package.ps1 -OutputDirectory NEW_STAGE -SourceCommit EXACT_PACKAGING_COMMIT
python scripts/archive-package.py NEW_STAGE dicom3d-0.6.0.tgz
python scripts/archive-core.py --output dicom3d-core-0.6.0.zip --source-commit EXACT_PACKAGING_COMMIT
~~~

Every output path must be new. Staging recomputes DICOM3D.Entry.VIEWERBUILD from exact HTML and generates one FileCopy owner per served destination, including notices. package-manifest.json binds staged files, HTML identity and packaging commit. TGZ/ZIP archive metadata is deterministic. Reproduce twice and compare full SHA-256 values.

Native staging also verifies the generated DICOM3D.InstallMigration adapter against scripts/retired-filecopy-051.json. The204-path policy comes from the immutable published051 TGZ minus current375 FileCopy targets. It introduces no frontend or medical-source change. Read [retirement ownership, maintenance and refusal boundaries](IRIS_FILECOPY_RETIREMENT_051.md). The initial native candidate's failed upgrade evidence remains historical; corrected archives have their own source commit and exact hashes.

source-manifest.json inventories staged Git objects and excludes itself plus the generated Core descriptor to avoid a circular hash. The external manifest binds the final commit/source archive. distribution-manifest.json in the source checkout is a descriptor; the Core archiver generates its exact input inventory and packaging-commit binding.

## Qualification and publication

Fresh extraction, Docker build/runtime/browser, exact IPM activation/upgrade/lifecycle and installed FileCopy hashes are separate from a successful source build. See [installation instructions](INSTALL_060.md) and the exact qualification receipt.

Attach only qualified installers, packaging-source snapshot, checksums, manifest and receipts to the existing release. Preserve the original tag and all existing assets; read back uploaded bytes. Open Exchange and IPM registry publication remain user-owned.

Baseline distributions contain generalized reference anatomy only. The owner has separately admitted the exact five-file H000 subset for the optional Safe Demo web profile. That decision does not admit it into Core/native artifacts; see [current public data policy](PUBLIC_RESEARCH_DATA_POLICY.md).
