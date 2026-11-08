# DICOM3D versioning and promotion

DICOM3D versions identify evidence-backed product milestones. Commits preserve work; they do not automatically earn a release. This policy applies to the open-source anatomy and medical imaging platform, not to clinical certification.

## Current identity

The current prerelease is **v0.7.0-alpha.1 — Anatomy & Imaging Foundation**. Its tag and published artifacts remain immutable. Documentation corrections, roadmap previews and demonstration media do not change that version. The preserved v0.6.5 release remains a rollback reference.

## Commits, prereleases and releases

| Identity | Meaning and promotion boundary |
|---|---|
| Commit | A reviewable source checkpoint; may contain explicitly experimental work. A commit is not an installed or deployed product. |
| `X.Y.Z-alpha.N` | A bounded public development milestone with exact source/artifact identities, demonstrated workflows and explicit gaps. Increase `N` only for another approved product milestone. |
| `X.Y.Z-beta.N` | The agreed release scope is integrated; supported installation paths and compatibility contracts are stable enough for broader testing. |
| `X.Y.Z-rc.N` | Intended release payload is frozen; acceptance, distribution, documentation and rollback gates have passed with no unresolved release-blocking defect. |
| `X.Y.Z` | The stated scope is independently reproducible, accepted and approved for release. Stable does not mean clinically validated. |

Before 1.0, minor milestones may deliberately evolve contracts, but must describe their changes and migration requirements. From 1.0 onward, incompatible changes to published stable contracts require a major release. A minor release adds a bounded capability while preserving applicable compatibility; a patch repairs behavior within the existing contract. Security and privacy corrections follow the same evidence and disclosure boundaries.

## Component maturity and compatibility

The frontend, standalone Core host, IRIS/IPM adapter, imaging admission contracts and NRX research have separate evidence boundaries. They need not advance in lockstep. Record each component's source and maturity instead of giving an experimental adapter the frontend's PASS by association.

Compatibility includes source identifiers, selection membership, manifest schemas, units and transforms, original imaging values, source-frame/SEG correspondence, supported entrypoints and package lifecycle. A change to one of these contracts requires an explicit compatibility decision and relevant regression evidence. Changes to generalized anatomy never establish registration to patient imaging.

## Promotion record

Every product promotion records:

1. The user capability and acceptance boundary that changed.
2. Exact source commit, dependency/asset identities and frozen artifact hashes.
3. Relevant automated and visible-runtime results, actual backend and supported environments.
4. Installation/deployment results for each claimed distribution independently.
5. Known failures, exclusions, remaining uncertainty and compatibility implications.
6. Preservation or migration/rollback procedure appropriate to the changed surface.
7. Operator approval of exact identities and publication destinations, followed by public readback.

A passing build does not prove rendering, installation, interoperability or release readiness. Documentation-only work uses link, content, preview and preservation checks; it does not repeat expensive scientific qualification without contradictory evidence.

## Immutable publication

Do not move a published release tag or replace an artifact's bytes under its existing name. Publish a separately approved corrected artifact or release when needed. GitHub source, release downloads, Docker, Pages and IPM/Open Exchange are distinct destinations; none inherits publication authority or qualification from another. Keep a previously accepted release recoverable.

This policy uses evidence-gated milestone promotion while retaining DICOM3D's own numbering and release scope. The [roadmap](ROADMAP.md) expresses direction, not release dates or delivery commitments.
