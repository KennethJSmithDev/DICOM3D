// Compose metadata from already admitted geometry; never infer anatomy from labels.
// The scene loader owns geometry and transforms. This module owns catalog projection.
export const FEMALE_EXCLUDED_OWNER_IDS = Object.freeze([
  'FMA15900', // The BodyParts3D bladder is replaced visually by the HRA bladder.
  'FMA9600', 'FMA19667', // Prostate and male urethra.
  'FMA7211', 'FMA7212', // Testes.
  'FMA21385', 'FMA21386', 'FMA20818', 'FMA20819', // Penile vessels.
]);

const sourceNotices = Object.freeze({
  BodyParts3D: Object.freeze({label:'BodyParts3D source attribution', path:'attribution/BODYParts3D-NOTICE.txt'}),
  HRA: Object.freeze({label:'HRA source attribution', path:'female-delta/HRA-FEMALE-NOTICE.txt'}),
});

export function referenceSourceLinks(female, part) {
  if (!female) return [sourceNotices.BodyParts3D];
  const notice = Object.hasOwn(sourceNotices, part?.source ?? '') ? sourceNotices[part.source] : null;
  // Without an identified selection, show both sources rather than guessing one.
  return notice ? [notice] : [sourceNotices.BodyParts3D, sourceNotices.HRA];
}

function projectRelationships(records, available, excluded, source) {
  if (records === undefined) return [];
  if (!Array.isArray(records)) throw new TypeError(`${source}: hierarchy must be an array when supplied`);
  return records.map(record => {
    if (!record || typeof record.id !== 'string' || !Array.isArray(record.owner_ids) ||
        record.owner_ids.some(id => typeof id !== 'string')) {
      throw new TypeError(`${source}: invalid relationship ownership`);
    }
    const original = [...new Set(record.owner_ids)];
    const represented = original.filter(id => available.has(id));
    const missing = original.filter(id => !available.has(id));
    return {
      ...record,
      source,
      source_owner_ids: original,
      owner_ids: represented,
      excluded_owner_ids: missing.filter(id => excluded.has(id)),
      unresolved_owner_ids: missing.filter(id => !excluded.has(id)),
      // 'represented' means that recorded owner references survived, not anatomical completeness.
      availability: !original.length ? 'unmapped' : !missing.length ? 'represented' : represented.length ? 'partial' : 'unavailable',
    };
  });
}

function copyHolds(records, source) {
  if (records === undefined) return [];
  if (!Array.isArray(records)) throw new TypeError(`${source}: holds must be an array when supplied`);
  return records.map(record => ({...record, source}));
}

/** Preserve source relationships and holds while filtering only selectable owner references. */
export function buildFemaleCatalog(base, supplementManifest, supplementBundle) {
  const supplement = supplementManifest?.reference;
  if (!Array.isArray(base?.structures) || !Array.isArray(base?.bundles) ||
      !Array.isArray(supplement?.structures) || typeof supplementBundle?.id !== 'string') {
    throw new TypeError('Composite requires admitted base and supplement catalogs');
  }
  const excluded = new Set(FEMALE_EXCLUDED_OWNER_IDS);
  const structures = [
    ...base.structures.filter(part => !excluded.has(part.id)).map(part => ({...part, source:'BodyParts3D'})),
    ...supplement.structures.map(part => ({...part, bundleId:supplementBundle.id, source:'HRA'})),
  ];
  const available = new Set();
  for (const part of structures) {
    if (typeof part.id !== 'string' || !part.id || available.has(part.id)) {
      throw new Error('Composite contains an invalid or duplicate owner ID');
    }
    available.add(part.id);
  }
  return {
    structures,
    hierarchy: [
      ...projectRelationships(base.hierarchy, available, excluded, 'BodyParts3D'),
      ...projectRelationships(supplement.hierarchy, available, new Set(), 'HRA'),
    ],
    held: [...copyHolds(base.held, 'BodyParts3D'), ...copyHolds(supplement.held, 'HRA')],
    bundles: [...base.bundles, supplementBundle],
    coverage: {
      baseHierarchySupplied: Array.isArray(base.hierarchy),
      baseHoldsSupplied: Array.isArray(base.held),
      supplementHierarchySupplied: Array.isArray(supplement.hierarchy),
      supplementHoldsSupplied: Array.isArray(supplement.held),
    },
  };
}

export function relationshipScope(record) {
  if (record.availability === 'partial') return 'Partial in this composite; some source owners are excluded or unavailable';
  if (record.availability === 'unavailable') return 'No selectable owner in this composite; source relationship retained';
  if (record.availability === 'unmapped') return 'Source relationship has no supplied owner mapping';
  return record.ownership_scope === 'DIRECT' ? 'Direct source owner' : 'Represented through existing owners; not an independent mesh';
}

export function compositeCoverageText(index) {
  const c = index?.coverage;
  if (!c) return 'Composite coverage metadata was not supplied; an empty list does not establish complete coverage.';
  return [
    c.baseHierarchySupplied ? 'BodyParts3D relationships are retained with excluded owners identified.' : 'BodyParts3D hierarchy was not supplied.',
    c.baseHoldsSupplied ? 'BodyParts3D holds are retained as base-source records, not a female-specific missing-organ count.' : 'BodyParts3D holds were not supplied.',
    c.supplementHierarchySupplied ? 'HRA supplement relationships are retained.' : 'The HRA supplement does not supply a hierarchy.',
    c.supplementHoldsSupplied ? 'HRA supplement holds are retained.' : 'The HRA supplement does not supply a hold inventory.',
  ].join(' ');
}

// Retain attribution, not another copy of each bundle's full hierarchy and structures.
export function sourceAttributionManifest(manifest) {
  const p = manifest?.provenance ?? {};
  return {
    reference: {id:manifest?.reference?.id},
    structure: {semantic_id:manifest?.structure?.semantic_id},
    provenance: {copyright:p.copyright, license:p.license, source_url:p.source_url},
  };
}
