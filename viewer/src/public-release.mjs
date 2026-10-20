// WHY: GitHub publication is authorized; the separate H000 data release is not.
// BOUNDARY: released reference-viewer composition only; no runtime opt-in can grant admission.
// INVARIANT: study pixels and study-loading routes remain outside this release.
// EVIDENCE: scripts/test-demo.mjs and docs/PUBLIC_RESEARCH_DATA_POLICY.md.
// REGRESSION: an environment/query override would bypass the explicit data-release decision.
export const PUBLIC_STUDY_ENABLED = false;
export const PUBLIC_RELEASE = Object.freeze({
  release: '0.6.0',
  title: 'DICOM3D v0.6.0 — Visual Research Workstation',
  distribution: 'REFERENCE_WEB_AND_SOURCE',
  publicationApproved: true,
  researchDataPublicationApproved: false,
  previousRelease: '0.5.1',
  previousMainCommit: 'f03162cdec8b89a522dd4032e3815ea7d3ed0401',
});
