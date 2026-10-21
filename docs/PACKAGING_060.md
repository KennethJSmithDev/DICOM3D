# v0.6.0 installation source and reproduction

The original v0.6.0 tag identifies accepted web/source commit d3490dd659e19e44b8800abe87bbc626f45350a2. A later packaging completion commit reconciles installation identifiers and consumes the accepted visual source. The external release/artifact manifest records that exact later commit, source snapshot, archive hashes and qualification receipts. Never move the tag or relabel an earlier snapshot.

## One frontend source

Core and IRIS/IPM invoke scripts/build-demo.mjs in the existing guarded visual mode with base /dicom3d/. Pages retains /DICOM3D/. Both use viewer/reference.html, the existing Babylon Lite renderer, the pinned lockfile, exact admitted reference/brand assets and PUBLIC_STUDY_ENABLED=false. Hosting paths and the Core/IRIS adapters differ. No anatomical source, transform or semantic sampling change is needed.

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

Baseline distributions contain generalized reference anatomy only. The H000 assessment records a separate exact proposed inventory; public hosting requires the user's explicit approval of those hashes.
