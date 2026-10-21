// WHY: the owner admitted exactly five unchanged H000 objects for the Safe Demo.
// BOUNDARY: curated-h000 is an explicit web build; installers default to reference-only.
// INVARIANT: no runtime query/storage option can enable an unbuilt study route.
// EVIDENCE: scripts/test-demo.mjs and docs/PUBLIC_RESEARCH_DATA_POLICY.md.
// REGRESSION: changing the default would silently widen Core/native data admission.
export const PUBLIC_STUDY_ENABLED = typeof import.meta.env !== 'undefined' && import.meta.env.DICOM3D_PUBLIC_STUDY === true;
export const PUBLIC_RELEASE = Object.freeze({
  release: '0.6.0',
  title: 'DICOM3D v0.6.0 — Visual Research Workstation',
  distribution: 'REFERENCE_WEB_AND_SOURCE',
  publicationApproved: true,
  researchDataPublicationApproved: false,
  previousRelease: '0.5.1',
  previousMainCommit: 'f03162cdec8b89a522dd4032e3815ea7d3ed0401',
});

export function publicBuildProfile(name = 'reference-only') {
  if (!['reference-only', 'curated-h000'].includes(name)) throw Error('Unreviewed public build profile: ' + name);
  const studyEnabled = name === 'curated-h000';
  return Object.freeze({name, studyEnabled, release: Object.freeze({...PUBLIC_RELEASE,
    distribution: studyEnabled ? 'REFERENCE_AND_CURATED_H000_WEB' : PUBLIC_RELEASE.distribution,
    researchDataPublicationApproved: studyEnabled,
  })});
}
