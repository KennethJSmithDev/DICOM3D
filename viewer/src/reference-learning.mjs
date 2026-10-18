// Explanations of verified metadata/representation only; no diagnostic inference.
export function referenceLesson(manifest,part,state) {
  const label=part?.label??'the complete reference';
  let scope=part?'A named source structure or group; not a patient finding.':'The available source subset, not an exhaustive model of every anatomical structure.';
  if(part?.label.toLowerCase().includes('capsule'))scope='The source label identifies a capsule surface. It is not a whole-organ segmentation or a measured organ volume.';
  else if(part?.label.toLowerCase().includes('source fat'))scope='This source group contains the labeled fat geometry. It does not represent the complete mammary gland.';
  else if(part?.label.toLowerCase().includes('partial')||part?.label.toLowerCase().includes('subset'))scope='Only the source structures included in this subset are shown. Missing geometry is not evidence that anatomy is absent.';
  return {
    title:`Understand ${label}`,
    known:`Source identity: ${part?.id??manifest.structure.semantic_id}. ${manifest.reference.id}. ${scope}`,
    presentation:`Display: ${state.isolate?'selected structure isolated':'assembly context'}; opacity gain ${part?(state.opacity.get(part.id)??1):'per structure'}; ${state.context?'surrounding selection context softened':'source context opacity'}; clip height ${state.clip} model metres. Highlights, transparency, clipping and camera fit are reversible presentation choices.`,
    unverified:'This reference is not registered to a patient study. Clinical accuracy, diagnosis and anatomical measurements are not established by its appearance.',
    credit:`${manifest.provenance.copyright??'Source attribution in manifest'} · ${manifest.provenance.license}`,
    source:manifest.provenance.source_url??null,
  };
}
