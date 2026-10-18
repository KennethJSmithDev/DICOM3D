# v0.5.0 Open Exchange/IPM handoff — separate approval required

GitHub is authoritative. Use the existing repository/release and OEX application; do not create another distribution channel or treat current OEX/IPM version lag as a GitHub release blocker.

## Observed versus inferred

KNOWN: GitHub publishes immutable v0.1.0/v0.2.0 TGZs and SHA256SUMS. OEX currently lists0.1.0 and links the same GitHub repository plus the public registry. Its downloaded0.1.0 registry archive is a source snapshot, differs from the GitHub binary TGZ and lacks the public/ sources required by its module FileCopy entries. This is an actual historical artifact mismatch, not indexing lag. v0.5.0 includes the required source-addressable prebuilt shell/assets and explicit reference resources.

KNOWN platform documentation: repository updates can be reflected in OEX; OEX app/release approval and the Publish in Package Manager option control public registry publication. Root module.xml supplies package identity/version. GitHub release upload alone is not documented to import attached TGZs into IPM. OEX offers explicit Add new release/edit approval steps. Existing repo has only the Pages workflow, not a GitHub-to-registry publisher.

UNVERIFIED until publication: this application's current publisher settings, exact refresh delay, which revision the backend selects, and whether the newly indexed installed payload matches the frozen candidate. No automatic synchronization deadline or artifact equivalence is promised.

Sources: [OEX updates](https://docs.openexchange.intersystems.com/apps/update/), [releases](https://docs.openexchange.intersystems.com/apps/releases/), [IPM publication](https://docs.openexchange.intersystems.com/apps/ipm/).

## Existing publication sequence

1. Verify final manifest/SHA256SUMS, source allowlist, root module0.5.0 and all FileCopy paths. Commit only the reconciled candidate and generated release inputs; preserve unrelated local work and old tags. No rebuild/substitution after artifact freeze.
2. Push the approved source commit, create/push v0.5.0 at that commit, and create the GitHub release with the exact listed ZIP/TGZ/source/manifest/checksums. Record the final commit and independently download/hash every public attachment.
3. The existing main-push Pages workflow is a separate deployment side effect. Preserve the current Safe Demo; do not deploy a redesigned reference demo merely by publishing the Core release. Publication planning must hold/skip that workflow or use an approved release ref before updating main; changing its behavior requires explicit approval.
4. Allow documented repository synchronization. If OEX requires a release/edit approval, use the EXISTING DICOM3D application's normal workflow, version0.5.0, the same GitHub source/tag and release notes. Keep Publish in Package Manager according to the existing application setup; verify it rather than assume. This step requires separate OEX approval, not implemented here.
5. Once registry0.5.0 exists, independently inspect/download it and install in an isolated target. Verify module/API0.5.0, every FileCopy source, installed viewer/assets/notices and resource enforcement. Report indexing lag separately from missing files or wrong hashes. Until verified, GitHub direct TGZ/ZIP is the qualified route.

Suggested release text: DICOM3D0.5.0 adds a reproducible standalone anatomy/image explorer, licensed male/female reference subsets, shared presentation controls and stale GPU-pick protection. Optional IRIS hosts the same viewer with existing protected routes. Research prototype only; no patient data, production Connect/FHIR or clinical claims. Read GitHub release checksums and compatibility scope.

GitHub publication is authorized separately by the operator. This handoff does not authorize an Open Exchange submission, registry publication or configuration change.
