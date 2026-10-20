# DICOM3D — Visual Research Workstation

**From Pixels to Meaning.**

<p align="center"><a href="https://kennethjsmithdev.github.io/DICOM3D/"><strong>Live Demo</strong></a> · <a href="docs/RELEASE_060.md"><strong>v0.6.0 Web / Source Release</strong></a> · <a href="docs/INSTALL_051.md"><strong>v0.5.1 Install Guide</strong></a></p>

<p align="center"><img src="reference/public/brand/semantic-cube.svg" alt="DICOM3D semantic cube" width="96"></p>

DICOM3D is a desktop-first research workstation for exploring generalized anatomy in a central 3D workspace. The v0.6.0 web/source release combines the existing male BodyParts3D and female HRA references with scientific, holographic and bounded materialization presentations. Source geometry, semantic identity and attribution stay intact.

**Release scope:** v0.6.0 covers the browser experience and its source. The qualified **[v0.5.1 installation distributions](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.5.1)** remain available and unchanged. No v0.6.0 native, Core Docker or IPM installation package is included. Open Exchange and its registry are separate surfaces.

## A 3D-first anatomy workspace

![DICOM3D reference anatomy in the desktop holographic workspace](docs/images/visual-060-reference-desktop.jpg)

Actual local release02 Edge/WebGPU rendering of generalized anatomy. These screenshots are not patient studies or generated concept art. The [original logo](assets/branding/dicom3d-logo.png) remains preserved alongside the semantic-cube icon family.

- A dominant 4:3 3D viewport with collapsible anatomy and presentation tools.
- Scientific source materials, controlled cyan holography and bounded materialization that resolves to the existing mesh.
- Male/female reference selection, semantic picking, hide/show/isolate/restore, opacity, camera presets and focus.
- Orbit, zoom and right-drag pan, with cancellation and reduced-motion controls.
- **Learn**, directly below **Lab**, explains the current source, presentation choices, limitations and attribution without a permanent bottom panel.

See actual captures of [female HRA anatomy](docs/images/visual-060-female-desktop.jpg), [materialization](docs/images/visual-060-materialization.jpg) and [contextual learning](docs/images/visual-060-learning.jpg). Details and evidence limits: [Visual Research Workstation](docs/VISUAL_RELEASE_060.md).

## Source identity and limits

The catalogs contain **33 male and 22 female semantic groups**. A group can own several mesh primitives. These independently sourced references have partial coverage and are not registered to one another or to a patient scan.

Male BodyParts3D lung groups contain source airway/vessel branches rather than complete lung envelopes. Female HRA has its own membership and limitations. Presentation effects preserve these distinctions and do not invent missing anatomy.

**The v0.6.0 Safe Demo is reference-only.** It includes no H000 CT/SEG/lesion payload, source-binding metadata file, CT screenshot, arbitrary patient upload or study-download action. Separately qualified local imaging work remains outside this release. See the [data policy](docs/PUBLIC_RESEARCH_DATA_POLICY.md) and [Safe Demo scope](docs/SAFE_DEMO.md).

Camera, materials, clipping and animation are presentation state. This research software makes no clinical, diagnostic, anatomical-accuracy, new-segmentation, registration or physiological-simulation claim.

## Installable v0.5.1 distributions

- **Standalone Core:** the frozen source/assets ZIP and [Docker quick start](docs/CORE_DOCKER_QUICKSTART.md). No IRIS or account is required.
- **Protected IRIS/IPM host:** the exact published package and scope in the [installation guide](docs/INSTALL_051.md).
- **Optional IRIS development host:** the [isolated durable-volume procedure](docs/IRIS_DOCKER_DEV_051.md), separating startup from package activation.

Use exact v0.5.1 release files and SHA256SUMS. A changing checkout or listing version does not identify those archived bytes. The [qualification record](docs/RELEASE_051.md), [compatibility limits](docs/COMPATIBILITY_051.md) and earlier releases remain preserved.

## Run the web experience locally

Use Node.js 24 and the pinned viewer lockfile. From the repository root:

```powershell
npm ci --prefix viewer
node scripts/build-demo.mjs
node scripts/test-demo.mjs
Push-Location viewer
node node_modules/vite/bin/vite.js preview --config vite.reference.config.mjs --outDir ../.demo-dist --base /DICOM3D/ --host 127.0.0.1 --port 53260 --strictPort
```

Open `http://127.0.0.1:53260/DICOM3D/`. Stop with Ctrl+C, then use `Pop-Location`. The build uses the existing reference entry and Babylon Lite renderer, without an additional rendering engine or runtime dependency.

Inactive source code retains public TCIA identity/hash constants and research preparation tests, but no H000 data payload or study route is emitted by the reference-only build. Earlier research adapters and installation tooling do not qualify a new installable package. Reproduce v0.5.1 packages from their exact release source. The [publication procedure](docs/VISUAL_PUBLICATION_PROCEDURE.md) separates source integration, Pages deployment and actual remote rendering checks.

## History and license

H000 established one source CT/SEG-to-semantic-mesh engineering chain. Later gates added protected IRIS hosting, synthetic presentation slices, generalized anatomy, local imaging and contextual learning. Named receipts establish each bounded claim; this repository is not the complete research evidence store. See [changelog](CHANGELOG.md), [roadmap](ROADMAP.md), [architecture](docs/ARCHITECTURE.md) and [provenance](docs/PROVENANCE.md). v0.5.0/v0.5.1 artifacts remain immutable.

DICOM3D software is Apache-2.0, copyright 2026 KennethJSmithDev personally. Preserve LICENSE, NOTICE and third-party notices. BodyParts3D-derived assets retain the embedded CC BY-SA 2.1 Japan grant and the notice's distinct current publisher-license statement. HRA retains CC BY 4.0 attribution and source limitations. Read the unchanged [BodyParts3D notice](reference/public/reference/BODYParts3D-NOTICE.txt) and [HRA notice](reference/public/reference/HRA-FEMALE-NOTICE.txt). Optional IRIS software is acquired separately under its applicable license.
