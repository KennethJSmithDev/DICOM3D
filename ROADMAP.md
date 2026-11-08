# DICOM3D roadmap

DICOM3D is an open-source interactive anatomy and medical imaging platform designed to help people see, explore and understand the human body and its underlying medical images.

This is a proposed direction, not a delivery calendar. Later milestones need scoped implementation, evidence and release approval. Documentation-only improvements do not increment the product version. See [versioning](VERSIONING.md), [beginner guidance](docs/BEGINNER_GUIDE.md) and the [interactive preview instructions](docs/ROADMAP_PREVIEW.md).

## Milestones

These structured milestone sections are the canonical input to the separate interactive preview.

### anatomy-imaging-foundation | v0.7.0-alpha.1 — Anatomy & Imaging Foundation
- Status: AVAILABLE
- Outcome: Expanded male anatomy and the female composite, contextual learning, Scientific/Holographic/Materialization presentations, and the public H000 CT/SEG example.
- Evidence: [Published alpha.1](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.7.0-alpha.1); [acceptance](docs/RELEASE_070_ALPHA_ACCEPTANCE.md); [downloads](docs/DOWNLOADS_070_ALPHA.md).
- Acceptance: Source-native selection, picking, isolation, opacity, camera and lifecycle at recorded scopes; hardware WebGPU and separately forced WebGL2; independently qualified static, Core and IPM paths.
- Limits: 1,205 male and 1,235 female-composite draw owners are not organ counts. Female placement is approximate. H000 volume display is not whole-scan organ segmentation. No patient registration or clinical validation.
- Media: [Actual male Scientific capture](docs/images/visual-070-male-scientific.png); [actual female composite](docs/images/visual-070-female-composite.png); [actual H000](docs/images/visual-070-h000.png).

### public-readiness | Make the current alpha easier to try and understand
- Status: IN_DEVELOPMENT
- Outcome: Align installation, architecture, roadmap and beginner documentation with the released alpha; prepare genuine demonstration footage and a separate interactive roadmap.
- Evidence: [Beginner guide](docs/BEGINNER_GUIDE.md); [installation](docs/INSTALL_070_ALPHA.md); [media capture contract](docs/DEMONSTRATION_MEDIA.md).
- Acceptance: Verified links/artifact names, preserved branding/runtime/rollback, accessible local roadmap preview, source-bound public-safe media, and operator review before commit or publication.
- Limits: This documentation/media candidate changes no product feature, frozen runtime, public deployment or version. Publication remains separately approved.
- Media: Released screenshots illustrate actual behavior; review-candidate recordings remain unpublished until approved.

### source-native-coverage | Finish justified source-native atlas corrections
- Status: PLANNED
- Outcome: Resolve remaining male source-admission cases where publisher evidence permits and improve the female composite through explicit shared, replacement and exclusion mappings.
- Evidence: [Current atlas scope](prototypes/alpha/README.md); [BodyParts3D attribution](prototypes/alpha/three-prototype/expanded-atlas/LICENSE.md); [HRA attribution](prototypes/alpha/three-prototype/atlas-delta/HRA-FEMALE-NOTICE.txt).
- Acceptance: Exact component/compound membership, laterality and unchanged transforms; real selection/isolation; counts by category; remaining holds preserved rather than guessed away.
- Limits: Eighteen residual files have overlap/laterality dispositions. A held file is not necessarily a missing organ. No mirroring, relabeling or new geometry solely to inflate a count.
- Media: Record demonstrated source selections; unresolved anatomy must not be illustrated as completed functionality.

### connected-imaging | Proposed v0.8 direction — connected imaging and learning
- Status: PLANNED
- Outcome: Compose existing ingestion, Orthanc/IRIS retrieval and source-linked imaging into a usable supported-study path, while standalone anatomy remains independent.
- Evidence: [Architecture](docs/ARCHITECTURE.md); [installation scope](docs/INSTALL_070_ALPHA.md); [current acceptance](docs/RELEASE_070_ALPHA_ACCEPTANCE.md).
- Acceptance: Authorized retrieval reaches the frontend with verified source identities, values and spatial transforms; clear authentication/failure states, source-linked findings where supported, and beginner contextual learning.
- Limits: Historical retrieval and an installed IRIS viewer are not a packaged live PACS workflow. DICOM SR/SEG, FHIR findings and generic local admission need explicit contracts and gates. AI Hub is a separate deployment path.
- Media: Use public/synthetic studies for distributable examples; private imaging and reports stay local.

### reproducible-platform | Proposed v0.9 / beta direction — installation and recovery
- Status: PLANNED
- Outcome: Make Core/IRIS installation, setup guidance, compatibility and updates reproducible for people unfamiliar with the project.
- Evidence: [Installation](docs/INSTALL_070_ALPHA.md); [versioning](VERSIONING.md); [proposed release process](docs/RELEASE_AUTOMATION_PLAN.md).
- Acceptance: Fresh-machine reproduction, clear dependency/security requirements, supported update and settings/data-preserving rollback, accessibility checks and independently qualified distributions.
- Limits: A Core setup wizard and installed-update flow are not delivered by alpha.1. Fresh install is not migration evidence. Registry publication and live interoperability remain independent decisions.
- Media: Record real setup/recovery workflows only after their acceptance gates pass.

### stable-platform | Proposed v1.0 — stable anatomy and imaging platform
- Status: PLANNED
- Outcome: A coherent, documented and independently reproducible platform for anatomy learning and supported imaging exploration by educators, families, trainees, researchers and professionals.
- Evidence: [Current scope](README.md); [promotion requirements](VERSIONING.md); [contributing](CONTRIBUTING.md).
- Acceptance: Agreed feature scope, stable compatibility contracts, independent installation/use/reproduction, accessible learning/navigation, accepted limitations, maintainable tests and support/rollback instructions.
- Limits: Version 1.0 would not establish diagnostic, therapeutic or medical-device approval. Consequential scope choices need review rather than silently removing expected capabilities.
- Media: Released workflows use actual footage with exact build identities.

### research-directions | Longer-term research — representations, segmentation and registration
- Status: EXPLORATORY
- Outcome: Investigate broader scan-derived tissue/organ representations, segmentation, patient-specific registration, advanced NRX rendering, levels of detail and future device/infrastructure integrations.
- Evidence: [Independent NRX research](research/nrx/HANDOFF.md); [current architecture](docs/ARCHITECTURE.md); [source/data boundaries](docs/PUBLIC_RESEARCH_DATA_POLICY.md).
- Acceptance: Establish source authority and each missing capability, reuse existing mechanisms, demonstrate transforms/identity/lifecycle and representation costs, then qualify an explicit integration boundary before product admission.
- Limits: Research directions are not released capabilities or promised dates. Reference anatomy is not patient segmentation; ontology links are not registration; smoothing can lose thin features.
- Media: Label concept imagery conceptual and keep it distinct from actual runtime and source-derived evidence.

## Preserved release history

- [v0.7.0-alpha.1](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.7.0-alpha.1): Three.js/R3F Anatomy & Imaging Foundation prerelease; [distribution boundaries](docs/DOWNLOADS_070_ALPHA.md).
- [v0.6.5](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.5): preserved Babylon Lite release and static rollback; original artifacts remain immutable.
- [v0.6.0 installation history](docs/INSTALL_060.md): earlier distributions retain their own qualification/source identities.
- [Original pre-alpha roadmap](https://github.com/KennethJSmithDev/DICOM3D/blob/f1d0012e99f661871563ea5baf5b543230e5ff90/ROADMAP.md): unchanged historical milestones and receipts, not the current rendering architecture.

[Contribute focused, source-backed changes](CONTRIBUTING.md) or [sponsor DICOM3D](https://github.com/sponsors/KennethJSmithDev). Support helps anatomy coverage, accessible learning, reproducible installation and imaging integration. No release date is promised by this roadmap.
