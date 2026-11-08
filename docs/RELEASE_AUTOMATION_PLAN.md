# Governed release automation — proposed process

This is a design for review, not a deployed workflow or permission to publish. Documentation-only improvements do not increment the product version. Keep existing manual-only deployment controls and the preserved v0.6.5 rollback.

## Reuse existing gates

The alpha audit checks source/build contracts and a software WebGL2 browser path on a standard Ubuntu runner. It does not establish hardware WebGPU behavior. The durable IRIS preflight is a historical positive control; its success is not a fresh alpha IPM installation. Pages already guards exact source identities and promotes the approved frozen payload.

One manual release controller should compose these existing gates rather than introduce a competing release system:

1. Verify the candidate commit/tree, source inventory, dependencies, notices and approved public assets.
2. Run tests proportional to the changed surface and qualify each affected distribution separately. Hardware WebGPU remains a local recorded gate.
3. Freeze downloads and record names, sizes, hashes, source identities, supported platforms and known limitations.
4. Obtain operator approval for the exact source/artifact identities and each destination. Check approved remote heads again before mutation; stop on drift.
5. Create the approved release, upload only frozen assets, and verify downloaded bytes. Publish Docker only when explicitly included; keep the immutable image digest and platform evidence.
6. Deploy Pages only through the approved manual path. Verify public manifests, payloads and representative visible behavior.
7. If acceptance fails, use the approved static rollback boundary. Do not equate static rollback with restoring an installed application's settings or private data.

Open Exchange and the community IPM registry remain manual publication boundaries. Never transmit proprietary IRIS distributions, credentials or private imaging to public CI. Use approved public/synthetic fixtures and existing authorization mechanisms.

## Budget and retention

Use standard free GitHub-hosted Ubuntu runners, existing bounded job timeouts and one release/deployment at a time. Do not select larger/paid runners, paid services or metered APIs. Public standard-runner compute is free under [GitHub's current policy](https://docs.github.com/en/billing/concepts/product-billing/github-actions); account billing and storage configuration still require explicit review rather than an assumption of zero cost.

Keep alpha-audit evidence at seven days and Pages promotion artifacts at one day unless a reviewed need justifies longer retention. Durable release assets and sanitized acceptance records have a different retention role from temporary workflow artifacts. Do not delete historical artifacts as an automatic cleanup policy.

Key dependency caches by the committed lockfile and supported platform. Avoid caching data studies, secrets, generated atlases or duplicate release ZIPs. Reuse frozen assets instead of uploading another large archive at every documentation change. Report artifact/cache size before enabling a revised workflow; do not change billing settings.

## Review before implementation

The proposed controller needs a reviewed diff, negative tests for identity/destination drift, a dry-run mode with no remote mutation, and an explicit operator decision before any workflow activation. No current workflow is changed by this document.
