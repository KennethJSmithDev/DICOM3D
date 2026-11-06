# Exact051 FileCopy retirement

## Ownership and reason

The initial060 native candidate installed375 correct new files but left204 retired051 destinations. Existing IPM per-file Activate overwrites named files without retiring names removed from the new module. This document defines the subsequently corrected upgrade policy; it does not rewrite the original failed qualification.

The immutable051 source TGZ SHA-256 is `83b7c207b9c203b29e4ba8e622f2784c8bf7b9d71d8be23606f9ce3533a7cd2d`. The fixed difference contains200 generated JavaScript chunks and four synthetic-reference GLB/JSON files, totaling1,226,267 bytes. It contains no H000 data. Current BodyParts3D/HRA models and every current FileCopy target are disjoint from this list.

Source owner: `scripts/retired-filecopy-051.json`. Canonical target-map SHA-256: `282c8029a22bcc6ab808489fd329ba6e37b66018768e2908c66e8cc1dc3cfb43`. `scripts/generate-retirement-051.py --check` verifies the generated `DICOM3D.InstallMigration` class, policy and accepted060 entry identity before staging. No previous archive download is required at runtime.

## Execution

IPM invokes `Retire051` after nondeferred FileCopies activate. The class accepts only the normal install-directory CSP root, admits its direct location or the qualified `/durable/dicom3d/csp` alias, and retains directory/file handles. The resolved root and present retired files must belong to the installing IRIS account. Other root aliases are refused. Child paths use no-follow, directory-relative operations. Existing retired entries must be single-link regular files with exactly the old size and SHA-256. Missing entries are idempotent no-ops.

All present retired targets are preflighted before the first deletion, then rechecked immediately before exact-name unlink. There is no directory sweep, recursive removal, role grant, permission broadening, external Python process or new pip dependency. The adapter uses the supported IRIS Embedded Python standard library because the native File attributes/canonical APIs followed symlinks in observed probes. Runtime capability gates refuse hosts without the required no-follow/descriptor operations.

The `DICOM3D051_RETIREMENT` report records policy identity, each retired relative path, already-absent count and success/refusal. No web route exposes installation control. The new class belongs to the existing DICOM3D package resource and must disappear on uninstall.

## Maintenance and failure boundaries

Back up the host and exclude concurrent writers to this package directory during installation. Descriptor anchoring and identity/hash rechecks do not provide atomic compare-and-unlink against a malicious concurrent directory writer. That is not a claimed security boundary.

A failed preflight deletes no retired targets. Earlier IPM FileCopy writes and metadata changes may already have happened. Filesystem deletion itself is not a database transaction: an I/O failure during retirement can leave a recorded partial retirement. Preserve the report; resolve the exact cause under normal host policy, then retry the same qualified artifact. Already absent entries permit resumption. Never use a broad CSP delete, forced hash bypass or global permission change.

The immutable old archive and host backup preserve rollback source. Restore the host backup or use the exact051 package under the documented package removal/reinstallation procedure. This migrates obsolete web files only; medical data, transforms, geometry and semantic identity are untouched.

## Qualification

Use the exact native release receipt for executed cases, platform/runtime, artifact hashes and source commit. Required cases include modified late-sorted targets, wrong size, leaf/dangling/parent links, directories/FIFO/hardlinks, wrong root, current-entry mismatch, unrelated-file preservation, partial I/O refusal/resumption, idempotence, both supported clean/upgrade/lifecycle lanes and complete new-class absence. Source code or this policy alone does not prove these executions.
