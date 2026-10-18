# DICOM3D Roadmap

DICOM3D is an independently installable, open-source IRIS for Health research-presentation viewer. Source DICOM data, semantic/spatial provenance, portable derived geometry and renderer-owned presentation remain separate.

## Accepted milestones

- **H000 PASS / CLOSED:** one identified public CT/SEG study through deterministic reconstruction, reversible model/patient transforms, semantic GLB and independent Babylon Lite/WebGPU rendering; source and canonical evidence remain frozen. Not a clinical validation claim.
- **0.0.1:** initial public product baseline.
- **0.0.2:** native IRIS for Health development viewer/API shell, qualified independently of IPM.
- **0.1.0 / V010-F/G PASS:** Apache-2.0 package and exact-artifact IPM install/uninstall/absence/reinstall, security and browser checks, and second isolated Docker clean-room qualification. GitHub release published. Native Windows IPM remains unverified; see docs/DOCKER_QUICKSTART.md.
- **DEMO-001 PASS:** public GitHub Pages Live Safe Demo with auto-loaded synthetic icosahedron, semantic selection, orbit/zoom and hide/show. No patient imaging or clinical claim. Public URL: https://kennethjsmithdev.github.io/DICOM3D/

## 0.2.0 — Interactive slice expansion (published October 17, 2026)

H002-A/B and fresh C/D/E/F bounded checks passed on the candidate branch, including camera framing, cache repair and exact-artifact package qualification. Historical failures remain preserved; the earlier C screenshot's cause is not claimed resolved. See [candidate status](docs/H002_CANDIDATE.md). The v0.2.0 release is published. The live public demo subsequently moved to anatomy-first DEMO-050.

**Objective:** Extend the existing Babylon Lite viewer with reversible, independently selectable and manipulable **derived presentation slices**, keeping original geometry, semantic identity and source-space transforms authoritative. Use a synthetic test fixture for public demonstrations.

**Explicit non-goals:** no unrelated engine code, clinical claims, native DICOM ingestion, AI, new renderer, or mutation of H000 artifacts. Acquired CT slices must not be confused with mesh-derived cross-sections.

### Bounded gates

1. **H002-A — inventory and contract:** read-only inspect the actual DEMO-001 viewer, its synthetic fixture and H000 interaction/spatial contracts. Determine smallest slice representation and UI/state owner. Record existing capability and missing sockets, versioned tests and cost baseline.
2. **H002-B — synthetic slicing:** derive multiple deterministic sections from the existing synthetic shape (or an equally small explicitly synthetic fixture). Each has stable local identity and immutable canonical placement; preserve original fixture and source geometry.
3. **H002-C — independent interaction:** trusted pick resolves slice identity; select, hide/show, isolate, opacity, drag/translation and rotation apply only to derived presentation state. Restore one or all slices to exact canonical placements.
4. **H002-D — global expansion:** one reversible slider controls spacing along a declared axis; composition with individual offsets/rotation is deterministic. Check reassembly, ordering, bounds, camera independence and no source mutation.
5. **H002-E — browser/UI qualification:** test fresh-page and replay in desktop and narrow mobile layouts, WebGPU rendering, selection/hidden misses, labels, keyboard/touch affordances, accessibility basics, errors and visible legibility.
6. **H002-F — release/package qualification:** qualify the same slice UI in the standalone GitHub Pages demo and the IRIS/IPM build; deterministic artifact, resource gates, security, install/uninstall/absence/reinstall and independent clean-room Docker replay. Preserve 0.1.0 tag and accepted evidence. Publish GitHub v0.2.0 only on PASS, then prepare user-owned Open Exchange update.

**Gate behavior:** continuous bounded execution through ordinary PASS steps. On a genuine failure or material design/authority decision, stop with exact evidence. Never promote an inferred or saved-only replay to new browser observation. Preserve the original DEMO-001 fixture as a regression control.

## v0.5.0 — Published functional foundation (October 18, 2026)

Licensed generalized male/female anatomy, bounded multimodality presentation, source-linked H000 semantic evidence, deterministic contextual learning, stable selection/isolation/camera behavior and qualified Core/IPM distributions. The public DEMO-050 loads male anatomy directly and permits female switching. Live FHIR, DICOMweb, generic SEG/SR interpretation, clinical validation and AI decisions are not production-qualified.

## Historical planning targets and later proposed releases (subject to evidence)

- **0.3.0 — recognizable anatomical context:** qualified public/synthetic contextual study presentation, CT-volume display and legibility; preserve source versus interpolated detail.
- **0.4.0 — source correlation:** H004 DICOM SOP/frame/source-slice navigation and derived-section distinctions.
- **0.5.0 — contextual learning:** bring OpsDeck's deterministic field/action/result teaching patterns into DICOM3D without making OpsDeck a runtime dependency.
- **0.6.0 — interoperability and optional AI seam:** independently qualify IRIS for Health workflows and read-only provider-neutral AI hooks; any contest-specific AI Hub implementation is a separate scope with its own requirements.
- **0.7.x–0.9.x — hardening:** multi-structure composition, additional imaging workflows, UX/accessibility, performance, compatibility, security and evidence-driven stability.
- **1.0.0 — stable contract:** independently installable, documented, reproducible, tested and supportable release with clearly bounded medical/research claims.

The historical 0.3–0.5 planning descriptions above are superseded by the published v0.5.0 capability statement and must not be interpreted as pending releases. Targets above 0.5 remain proposals, not fixed dates.

## Core ownership and representation

- Source imaging remains authoritative; manifest owns semantics/provenance/units/spatial transforms; GLB owns portable derived geometry; Babylon Lite owns display-only transforms/materials/normals.
- Derived slices preserve stable identity and canonical transform while allowing temporary manipulation. Never rewrite the original GLB or accepted H000 mesh to implement visual expansion.
- Use small semantic IDs and explicit domains; load rich per-slice payload only when needed. Measure browser requests, generated assets, memory and interaction latency as well as correctness.
- The live safe demo must remain no-login, browser-only and safe for public access. The IRIS/IPM product remains independently installable.
- Unrelated private research implementations are excluded from this product.
- No claim of clinical validity, diagnostic support or submillimetre anatomical accuracy follows from a smoother display.

## Release process

Read current contracts and receipts; use existing providers and packages; qualify each bounded gate; preserve evidence; update docs/version; freeze exact artifact; verify lifecycle in two independent qualified environments; publish tagged GitHub release only on PASS. Open Exchange submissions/updates remain operator-owned.
