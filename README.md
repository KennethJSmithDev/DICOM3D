# DICOM3D

<p align="center">
  <a href="https://kennethjsmithdev.github.io/DICOM3D/"><strong>Live Demo</strong></a>
  &nbsp;·&nbsp;
  <a href="prototypes/alpha/three-prototype/"><strong>v0.8.0 Source</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.8.0"><strong>v0.8.0 Downloads</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/INSTALL_CORE.md"><strong>Docker &amp; Core</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/INSTALL_070.md#iris-and-ipm"><strong>IRIS / IPM Install</strong></a>
</p>

<p align="center"><img src="assets/branding/dicom3d-logo.png" alt="DICOM3D Logo" width="480"></p>

**v0.8.0 — Anatomy & Imaging Foundation.** *From Pixels to Meaning.*

DICOM3D is an open-source interactive anatomy and medical imaging platform for exploring generalized reference anatomy, public imaging and source-linked segmentation. The web frontend uses **React and Three.js/React Three Fiber**, with an **NRX WebGPU atlas renderer** on supported devices and Three.js as a fallback. It is a research and educational platform, **not a clinically validated diagnostic tool**.

**Current release:** [v0.8.0](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.8.0), with a standalone Core ZIP and IRIS/IPM archive. The [v0.7.0-alpha.1 downloads](docs/DOWNLOADS_070_ALPHA.md) and [v0.6.5 release](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.5) remain available as historical releases and rollback references.

New here? Follow the [five-minute beginner guide](docs/BEGINNER_GUIDE.md), then explore the [roadmap](ROADMAP.md). Milestones advance through [evidence and release approval](VERSIONING.md), not dates.

## Try it and download

- **[Live Demo](https://kennethjsmithdev.github.io/DICOM3D/):** The existing deployed demo may serve an earlier release; check its displayed version. The 0.8.0 release did not update GitHub Pages.
- **[v0.8.0 downloads](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.8.0):** Standalone Core ZIP, IPM archive, source and release notes.
- **[Published v0.6.5 downloads](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.5):** Retained Babylon Lite Safe Demo ZIP and Core **source** ZIP; this is the previous release and rollback reference.
- **[Core installation](docs/INSTALL_CORE.md)** and **[IRIS/IPM setup](docs/INSTALL_070.md#iris-and-ipm):** Use the v0.8.0 downloads; the IRIS commands in the latter document name the earlier 0.7.0 archive, so substitute `dicom3d-0.8.0.tgz` and confirm version `0.8.0`.

## Install and integrate

The **v0.8.0** standalone Core ZIP, source-directory IPM load and IPM archive passed fresh-install checks. A Docker Core image was built and tested locally; the previously published Docker Hub image and Open Exchange registry are not automatically updated by a GitHub release. There is no qualified in-place upgrade in this release:

- **[Standalone Core](docs/INSTALL_CORE.md):** Extract the 0.8.0 ZIP and run it with Node.js 24, or build the Docker image from the tagged source. Core runs without IRIS, Orthanc or AI.
- **[IRIS/IPM installation](docs/INSTALL_070.md#iris-and-ipm):** The original 0.8.0 release archive is self-contained. The smaller [source-module installation](docs/INSTALL_SPLIT_IPM.md) provisions its verified public viewer assets separately before loading. A fresh isolated installation, authenticated access, restart and uninstall passed; the public IPM registry update is separate.
- **[v0.6.0 release downloads](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.0)** and **[packaging provenance](docs/PACKAGING_060.md):** Historical distribution identities, source/packaging boundaries and qualification receipts.
- **[v0.6.5 downloads](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.5):** Previous Babylon Lite Safe Demo ZIP and Core source ZIP, not a v0.7.0-alpha installer.

For the preserved Babylon Lite workstation, see the [Safe Demo build guide](docs/SAFE_DEMO.md) and [architecture and ownership](docs/ARCHITECTURE.md). Those documents describe the earlier implementation; the alpha's active frontend and source contracts are identified below. See the [changelog](CHANGELOG.md) and [release history](ROADMAP.md) for version-specific milestones.

The earlier workstation also documents a **verified local CT** input route using a volume descriptor and stored pixels kept in the browser. This is a legacy capability, not a claim that arbitrary local DICOM import is qualified in the current alpha.

## What DICOM3D can do

**Explore expanded anatomy.** The BodyParts3D male reference provides **1,205 source-backed geometry groups across 17 independently loadable bundles**. The **1,235-group female composite** shares that base, excludes/replaces nine groups and adds 39 HRA groups containing 60 source components. These are rendered ownership groups, **not counts of distinct organs**. Published hierarchies support exact component and compound selection without copying geometry; the [coverage table](docs/RELEASE_070_ALPHA_ACCEPTANCE.md#atlas-coverage-and-limits) reports overlapping selection categories separately. The female fit is approximate and retains the shared base skeleton and body shape.

**Interact with a reference.** Search, select, focus, hide, isolate and restore supported geometry. Load and unload independent bundles; choose source-oriented or stylized presentation. The body envelope starts **hidden** so interior anatomy is visible. WebGPU is requested first, and a tested WebGL2 compatibility path remains available. Exact source components and compounds remain distinct from larger-owner proxies and unavailable source relationships; 18 source files remain held rather than being mirrored or relabeled.

**Connect source CT and 3D.** The approved public **H000 CT/SEG** study demonstrates 103 acquired CT frames, source segmentation overlays and related 3D visualization/accumulation. The optional NRX-derived lesion surface is a **display derivative of the supplied SEG**, not whole-scan organ segmentation. Reference anatomy is not spatially registered to that study.

**Explore H001.** Published ultrasound figures and separate MRI-derived teaching references support a pregnancy and fibroid exploration. The figures and models have different sources and are not a registered reconstruction of one patient.

**Learn as you explore.** The contextual Beginner, Explore and Evidence views explain active anatomy, imaging sources, presentation effects, provenance and limitations without requiring AI. The introductory Materialization effect lasts approximately eight seconds and settles into Scientific; Holographic remains selectable. Skip and reduced-motion controls remain available as explicit choices.

![Actual alpha.1 Materialization replay settling into Scientific](docs/media/materialization-alpha1.gif)

Actual frozen alpha.1 runtime on hardware WebGPU; approximately 9.5 seconds of real presentation, exported at reduced resolution. [Capture method and media boundaries](docs/DEMONSTRATION_MEDIA.md).

**Know the boundaries.** This release does not claim diagnosis, treatment guidance, anatomical completeness, arbitrary DICOM/SEG interpretation, clinical validation, universal PACS interoperability, production FHIR/AI features or a qualified installed-update wizard. Whole CT display is direct volume rendering, not whole-scan organ segmentation. Fresh installation does not establish an installed settings/data migration or rollback.

## Build from source

Use Node.js 24 and npm on a supported desktop. From the repository root:

```sh
npm ci --prefix prototypes/alpha/three-prototype
node scripts/build-alpha-distribution.mjs .package/alpha-web "$(git rev-parse HEAD)"
node scripts/preview-static.mjs --root .package/alpha-web --port 0
```

Open the loopback URL printed by the inventory-checked static host. Use a new build directory for each build and Ctrl+C to stop that host. The distribution builder checks the committed atlas index, all 17 bundle hashes and the current HRA supplement, and includes approved H000 assets plus software/source notices. It does not use developer-private scans or paths. See the [alpha source handoff and historical qualification](prototypes/alpha/README.md) for more detail.

## v0.7.0-alpha.1 screenshots

**Actual Three/R3F candidate captures on hardware WebGPU (RX 7900 XT).** These show the qualified `623d81bc` runtime; the [acceptance record](docs/RELEASE_070_ALPHA_ACCEPTANCE.md#candidate-captures) binds their source, viewport and limitations.

![v0.7.0-alpha.1 male Scientific reference anatomy](docs/images/visual-070-male-scientific.png)

![v0.7.0-alpha.1 female composite with exact source compound selected](docs/images/visual-070-female-composite.png)

![v0.7.0-alpha.1 public H000 source CT, SEG and derived lesion presentation](docs/images/visual-070-h000.png)

![v0.7.0-alpha.1 male Holographic presentation](docs/images/visual-070-male-holographic.png)

The v0.6.5 release and its original screenshots remain preserved; the earlier [female reference](docs/images/visual-060-female-desktop.jpg), [materialization](docs/images/visual-060-materialization.jpg) and [learning](docs/images/visual-060-learning.jpg) captures are also **legacy Babylon Lite** examples.

## Project structure and contributions

- [`prototypes/alpha/three-prototype/`](prototypes/alpha/three-prototype/): Current Three.js/R3F research frontend, atlas assets, manifests, UI, and focused tests.
- [`prototypes/alpha/viewer/src/`](prototypes/alpha/viewer/src/): Shared imaging data/geometry contracts used by the alpha. Source verification is separate from visual styling.
- [`viewer/`](viewer/): Preserved published Babylon Lite workstation source, not the current alpha browser entrypoint.
- [`research/nrx/`](research/nrx/): Separately qualified native rendering/geometry research; do not assume every NRX experiment runs in the public alpha.
- [`EXPERIMENTAL_HANDOFF.md`](EXPERIMENTAL_HANDOFF.md): Historical source-review provenance. Distinguish those earlier checkpoint figures from the current deployment.

To [report a problem](https://github.com/KennethJSmithDev/DICOM3D/issues), include the version, browser/backend, reproducible steps and public-safe screenshots. See [CONTRIBUTING](CONTRIBUTING.md) for focused contributions. [Sponsor DICOM3D](https://github.com/sponsors/KennethJSmithDev) to support anatomy coverage, accessible learning, reproducible installation and imaging integration.

Changes should preserve source identities, laterality, provenance, original CT values, segmentation correspondence and safe cleanup. Keep comments focused on **why a constraint exists** and on non-obvious ownership boundaries. Public issues and contributions are welcome; never add patient scans, identifying records, credentials or proprietary IRIS distributions.

## Research scope, data and licenses

DICOM3D software is **Apache-2.0** (see [LICENSE](LICENSE) and [NOTICE](NOTICE)). The current expanded BodyParts3D assets and HRA female supplement carry their separate **CC BY 4.0** attribution and source-specific conditions; see [expanded atlas notice](prototypes/alpha/three-prototype/expanded-atlas/LICENSE.md) and [HRA supplement notice](prototypes/alpha/three-prototype/atlas-delta/HRA-FEMALE-NOTICE.txt). Older BodyParts3D notices record historical publisher terms; keep them with earlier archives. The public H000 example carries an independent [research data policy](docs/PUBLIC_RESEARCH_DATA_POLICY.md). IRIS software requires separate licensing and deployment.

Generalized atlases, acquired imaging and derived surfaces remain distinct sources. **Not for clinical diagnosis or treatment.**

## Development transparency

This project is developed through human-directed, AI-assisted collaboration. AI assistants, including ChatGPT and OpenAI Codex, contribute to research, design, code, tests, documentation, and reviews. Some project materials are AI-generated or substantially AI-assisted; they are not represented as exclusively human-authored.

Kenneth J. Smith directs the project, decides what is accepted and published, and takes responsibility for its releases. Functionality and verification claims are limited to the evidence documented for the relevant version. This disclosure does not replace individual contributor credits, dependency licenses, or third-party attribution.
