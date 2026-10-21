# DICOM3D

<p align="center">
  <a href="https://kennethjsmithdev.github.io/DICOM3D/"><strong>Live Demo</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/INSTALL_060.md"><strong>Native Install QuickStart</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/CORE_DOCKER_QUICKSTART.md"><strong>Docker Quick Start</strong></a>
</p>

<p align="center"><img src="assets/branding/dicom3d-logo.png" alt="DICOM3D Logo" width="480"></p>

**v0.6.0 — Visual Research Workstation.** *From Pixels to Meaning.*

DICOM3D is an open-source, desktop-first medical imaging and anatomical research workstation. Explore generalized male and female reference anatomy, inspect source-linked acquired CT/segmentation evidence, and move between Scientific, Holographic and Materialization presentations without changing the underlying source data.

The goal is straightforward: **beautiful enough to invite exploration, informative enough to teach, and evidence-backed within its qualified research scope.** DICOM3D is designed to grow toward interoperability with existing healthcare imaging infrastructure, rather than replace a PACS. Production PACS integration and clinical use are **not** currently qualified.

Start with the [Live Demo](https://kennethjsmithdev.github.io/DICOM3D/), [v0.6.0 installation guide](docs/INSTALL_060.md), or [release downloads](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.0). See the [release scope](docs/RELEASE_060.md), [Safe Demo data policy](docs/PUBLIC_RESEARCH_DATA_POLICY.md), and [changelog](CHANGELOG.md) for exact evidence boundaries.

## v0.6.0 distributions

- **Public Safe Demo:** browser-only Visual Research Workstation. Generalized BodyParts3D male anatomy opens first, with HRA female switching. **Explore Real CT Study** optionally loads one attributed H000 acquired CT/SEG research example on demand (approximately 33.3 MB). No login, private patient import or connected PACS is provided.
- **Standalone Core / Docker:** [`dicom3d-core-0.6.0.zip`](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.0) serves the reference-only workstation locally. No IRIS, account, or acquired H000 study is bundled.
- **Protected IRIS/IPM:** [`dicom3d-0.6.0.tgz`](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.0) provides the versioned visual frontend behind the existing password/resource-protected IRIS for Health hosting boundary. The optional [isolated IRIS development host](docs/IRIS_DOCKER_DEV_051.md) supports installation testing; it does not configure production FHIR/PACS connectivity.
- **Provenance and verification:** frozen Core and IPM artifacts, checksums, and qualification receipts are attached to the [v0.6.0 release](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.0). The original v0.6.0 web/source tag and later, separately qualified installer-source commits have distinct identities; read [packaging provenance](docs/PACKAGING_060.md) before reproducing an installer. Open Exchange and its IPM registry are separate publication surfaces.

Historical releases, including [v0.5.1](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.5.1), remain preserved.

## Milestone and evidence history

DICOM3D began with **H000: acquired CT + DICOM SEG → verified spatial alignment → semantic 3D geometry and provenance**. Subsequent milestones established the **V010 IRIS/IPM lifecycle**, **H002 reversible presentation slices**, imaging and reference-anatomy exploration, **contextual learning**, and the v0.5.0 functional foundation. **v0.5.1** repaired and independently qualified Docker/IPM installation. **v0.6.0** introduced the Visual Research Workstation and qualified reference-only Core/IPM distributions; the optional curated H000 Safe Demo was admitted and published afterward.

Public checkpoints: [v0.1.0](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.1.0) · [v0.2.0](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.2.0) · [v0.5.0](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.5.0) · [v0.5.1](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.5.1) · [v0.6.0](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.0).

Named qualification receipts, not appearances, build success or version labels alone, establish test claims. Technical evidence is preserved in the [release documentation](docs/RELEASE_060.md), [architecture](docs/ARCHITECTURE.md), and separately owned research records.

## Experience and evidence

![DICOM3D v0.6.0 — actual desktop holographic anatomy workstation](docs/images/visual-060-reference-desktop.jpg)

**Explore reference anatomy.** Select from **33 BodyParts3D male** and **22 HRA female** semantic groups. Use source-preserving selection, visibility, isolation, opacity, camera controls and restoration. The references have different sources, partial anatomical coverage and **no registration to a patient study**.

**Choose the presentation.** Scientific mode displays source-oriented materials; Holographic mode provides controlled cyan translucency; Materialization offers bounded source-derived assembly effects and reduced-motion controls. These affect presentation only, not anatomy, measurements or medical evidence. See [female anatomy](docs/images/visual-060-female-desktop.jpg) and [materialization](docs/images/visual-060-materialization.jpg) screenshots.

**Inspect real source-linked imaging.** The optional **Explore Real CT Study** action loads the curated H000 CT/SEG example into the public Safe Demo: source CT frames, segmentation contours, a distinct semantic lesion mesh, linked 3D cutaway/interior and source-aware inspection. The source study remains authoritative; generalized reference anatomy is not registered to it. The five files are admitted by an [explicit public-data policy](docs/PUBLIC_RESEARCH_DATA_POLICY.md), not as a generic patient-import feature.

**Learn in context.** The **Learn** workspace explains active structures, source identity, rendering choices, limits and attribution alongside the experience. See the [contextual learning capture](docs/images/visual-060-learning.jpg).

DICOM/source arrays and spatial metadata remain authoritative. The manifest owns semantics and provenance; GLB owns portable derived geometry; Babylon Lite/WebGPU owns rendering. Windowing, clipping, camera position and visual effects do not create medical observations. DICOM3D does **not** claim diagnostic validity, clinical approval, universal native DICOM/PACS connectivity, complete anatomical coverage, or new segmentation/AI interpretation.

## Development

Use Node.js 24 and the pinned `viewer/package-lock.json`:

```powershell
npm ci --prefix viewer
node scripts/build-demo.mjs --profile curated-h000
node scripts/test-demo.mjs --profile curated-h000
```

Preview the built Safe Demo using the [local instructions](docs/SAFE_DEMO.md) or [README's release procedure](docs/VISUAL_PUBLICATION_PROCEDURE.md). Omit `--profile curated-h000` for the reference-only build; Core/IPM installer preparation does not admit the optional H000 study. The application reuses the existing Babylon Lite renderer rather than introducing a second engine.

For native/Core installation, use the [v0.6.0 guide](docs/INSTALL_060.md) and verified archives rather than rebuilding from GitHub's original web/source tag without the separately identified packaging source.

## License

DICOM3D software is Apache-2.0; copyright 2026 KennethJSmithDev personally. Preserve [LICENSE](LICENSE), [NOTICE](NOTICE), and third-party notices. BodyParts3D-derived assets retain the source-specific CC BY-SA 2.1 Japan attribution and additional publisher-license details documented in the [BodyParts3D notice](reference/public/reference/BODYParts3D-NOTICE.txt); HRA retains [CC BY 4.0 attribution](reference/public/reference/HRA-FEMALE-NOTICE.txt) and source limitations. The optional H000 research study has its own [source and usage notice](reference/public/demo/h000/NOTICE.md). IRIS software is acquired separately under its applicable license.
