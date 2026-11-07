# DICOM3D

<p align="center">
  <a href="https://kennethjsmithdev.github.io/DICOM3D/"><strong>Live Demo</strong></a>
  &nbsp;·&nbsp;
  <a href="prototypes/alpha/three-prototype/"><strong>v0.7.0-alpha Source</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.5"><strong>v0.6.5 Downloads</strong></a>
</p>

<p align="center"><img src="assets/branding/dicom3d-logo.png" alt="DICOM3D Logo" width="480"></p>

**v0.7.0-alpha — Interactive Anatomy & Medical Imaging Research Preview.** *From Pixels to Meaning.*

DICOM3D is an open-source interactive anatomy and medical imaging platform for exploring generalized reference anatomy, public acquired CT and source-linked segmentation. The new web frontend uses **Three.js, React Three Fiber and React**, with **WebGPU preferred and WebGL2 fallback**. This is a research/educational alpha for feedback and further development, **not a clinically validated diagnostic tool**.

**Current public research build:** v0.7.0-alpha source under [`prototypes/alpha/three-prototype/`](prototypes/alpha/three-prototype/). The established Babylon Lite workstation, earlier documentation and install assets remain in this repository for comparison and rollback.

## Try it and download

- **[Live Demo](https://kennethjsmithdev.github.io/DICOM3D/):** Web frontend with the available generalized anatomy and approved public H000 CT/SEG research example. Inspect its displayed version and renderer status when evaluating a deployment.
- **[v0.7.0-alpha source](prototypes/alpha/three-prototype/):** Three.js/R3F reference implementation and reviewed expanded atlas build. No general-purpose installer, live PACS connection or AI provider is bundled.
- **[Published v0.6.5 downloads](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.5):** Retained Babylon Lite Safe Demo ZIP and Core **source** ZIP; this is the previous release and rollback reference.
- **[Legacy v0.6.0 native/IPM/Docker instructions](docs/INSTALL_060.md):** Historical installation paths, not an alpha upgrade procedure.

## What the alpha can do

**Explore expanded anatomy.** The source-backed BodyParts3D male reference exposes **1,186 selectable draw owners across 15 loadable bundles**. The **1,184-owner female composite** reuses the expanded base, excludes identified male-specific structures and adds an HRA-derived seven-owner bladder/reproductive supplement. It is an approximate visual composite, not a separately modeled complete female skeleton or registered patient anatomy. These are selectable owner counts, **not counts of distinct organs**.

**Interact with a reference.** Search, select, focus, hide, isolate and restore supported geometry. Load and unload independent bundles; choose source-oriented or stylized presentation. The body envelope starts **hidden** so interior anatomy is visible. WebGPU is requested first, and a tested WebGL2 compatibility path remains available. Some hierarchy labels share mesh owners; classifications and independent subpart availability are incomplete in this published remote checkpoint.

**Connect source CT and 3D.** The approved public **H000 CT/SEG** study demonstrates 103 acquired CT frames, source segmentation overlays and related 3D visualization/accumulation. The optional NRX-derived lesion surface is a **display derivative of the supplied SEG**, not whole-scan organ segmentation. Reference anatomy is not spatially registered to that study.

**Learn as you explore.** The contextual Beginner, Explore and Evidence views explain active anatomy, imaging sources, presentation effects, provenance and limitations without requiring AI. Materialization includes Skip and reduced-motion behavior.

**Know the boundaries.** This alpha is a public research demonstration. It does not claim diagnosis, treatment guidance, anatomical completeness, arbitrary DICOM/SEG interpretation, clinical validation, general PACS interoperability, production FHIR/AI features or a qualified installed-update wizard. Its published source covers the earlier 1,186/1,184-owner atlas; newer local-only recovery work is not silently represented here.

## Build the research alpha from source

Use Node.js 24 and npm on a supported desktop. From the repository root:

```sh
cd prototypes/alpha/three-prototype
npm ci
node build-public-review.mjs ../review-dist
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --outDir ../review-dist
```

Open the loopback URL printed by Vite. The public-review builder checks the committed atlas index and all 15 bundle hashes, builds the Three/R3F frontend, and includes approved H000 and HRA-supplement assets. It does not use developer-private scans or paths. See the [alpha source handoff and historical qualification](prototypes/alpha/README.md) for more detail.

## Legacy screenshots (Babylon Lite, not the new Three/R3F alpha)

**The screenshots below are retained from v0.6.0 and v0.6.5 until fresh, version-matched Three/R3F captures are available.** They show earlier application layouts and must not be interpreted as screenshots of this alpha.

![Legacy v0.6.5 Babylon Lite holographic reference anatomy](docs/images/visual-065-reference-desktop.png)

![Legacy v0.6.0 Babylon Lite public H000 CT and source-linked holographic view](docs/images/visual-060-h000-holographic.png)

![Legacy v0.6.0 Babylon Lite public H000 CT and scientific view](docs/images/visual-060-h000-scientific.png)

![Legacy v0.6.0 Babylon Lite public H000 CT and angled source-plane view](docs/images/visual-060-h000-source-plane.png)

The earlier [female reference](docs/images/visual-060-female-desktop.jpg), [materialization](docs/images/visual-060-materialization.jpg) and [learning](docs/images/visual-060-learning.jpg) captures are also **legacy Babylon Lite** examples.

## Project structure and contributions

- [`prototypes/alpha/three-prototype/`](prototypes/alpha/three-prototype/): Current Three.js/R3F research frontend, atlas assets, manifests, UI, and focused tests.
- [`prototypes/alpha/viewer/src/`](prototypes/alpha/viewer/src/): Shared imaging data/geometry contracts used by the alpha. Source verification is separate from visual styling.
- [`viewer/`](viewer/): Preserved published Babylon Lite workstation source, not the current alpha browser entrypoint.
- [`research/nrx/`](research/nrx/): Separately qualified native rendering/geometry research; do not assume every NRX experiment runs in the public alpha.
- [`EXPERIMENTAL_HANDOFF.md`](EXPERIMENTAL_HANDOFF.md): Historical source-review provenance. Distinguish those earlier checkpoint figures from the current deployment.

Changes should preserve source identities, laterality, provenance, original CT values, segmentation correspondence and safe cleanup. Keep comments focused on **why a constraint exists** and on non-obvious ownership boundaries. Public issues and contributions are welcome; never add patient scans, identifying records, credentials or proprietary IRIS distributions.

## Research scope, data and licenses

DICOM3D software is **Apache-2.0** (see [LICENSE](LICENSE) and [NOTICE](NOTICE)). The current expanded BodyParts3D assets and HRA female supplement carry their separate **CC BY 4.0** attribution and source-specific conditions; see [expanded atlas notice](prototypes/alpha/three-prototype/expanded-atlas/LICENSE.md) and [HRA supplement notice](prototypes/alpha/three-prototype/atlas-delta/HRA-FEMALE-NOTICE.txt). Older BodyParts3D notices record historical publisher terms; keep them with earlier archives. The public H000 example carries an independent [research data policy](docs/PUBLIC_RESEARCH_DATA_POLICY.md). IRIS software requires separate licensing and deployment.

Generalized atlases, acquired imaging and derived surfaces remain distinct sources. **Not for clinical diagnosis or treatment.**
