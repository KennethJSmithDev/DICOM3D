import {digest} from './ct-frame.mjs';

const need = (ok, message) => { if (!ok) throw new Error(message); };
const idPattern = /^[A-Za-z0-9.-]{1,64}$/;
const typePattern = /^[A-Z][A-Za-z0-9]{0,63}$/;
const relativeResourcePattern = /^[A-Z][A-Za-z0-9]{0,63}\/[A-Za-z0-9.-]{1,64}$/;
const relativeHistoryPattern = /^[A-Z][A-Za-z0-9]{0,63}\/[A-Za-z0-9.-]{1,64}\/_history\/[A-Za-z0-9.-]{1,64}$/;
const supportedTypes = new Set(['ImagingStudy', 'DiagnosticReport', 'Observation', 'ImagingSelection']);
// Bound the complete projection, not only each individual FHIR reference list.
export const MAX_PROJECTED_REFERENCES = 4096;

function family(version) {
  if (typeof version === 'string' && /^4\.0(?:\.\d+)?$/.test(version)) return 'R4';
  if (typeof version === 'string' && /^4\.3(?:\.\d+)?$/.test(version)) return 'R4B';
  if (typeof version === 'string' && /^5\.0(?:\.\d+)?$/.test(version)) return 'R5';
  throw new Error('Only explicitly selected FHIR R4, R4B or R5 is supported');
}

function references(value) {
  if (value === undefined) return [];
  need(Array.isArray(value) && value.length <= 1024, 'Unsupported reference list');
  return value;
}

// DiagnosticReport changed its imaging-study reference field between releases.
// This reads the selected source version; it does not convert either resource.
export function reportStudyReferences(report, version) {
  return references(family(version) === 'R5' ? report.study : report.imagingStudy);
}

function reference(value) {
  return typeof value?.reference === 'string' && value.reference.length > 0 && value.reference.length <= 2048 ? value.reference : null;
}

function restBase(fullUrl, resource) {
  if (typeof fullUrl !== 'string') return null;
  try {
    const url = new URL(fullUrl), suffix = `/${resource.resourceType}/${resource.id}`;
    if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || !url.pathname.endsWith(suffix)) return null;
    return `${url.origin}${url.pathname.slice(0, -suffix.length)}/`;
  } catch { return null; }
}

function rejectUninterpretedModifiers(value) {
  const pending = [value], seen = new Set();
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);
    need(seen.size <= 100000, 'Unsupported FHIR structure size');
    for (const [key, child] of Object.entries(item)) {
      if (key === 'implicitRules') need(child === undefined || child === null || child === '', 'Unsupported FHIR modifier or implicit rules');
      if (key === 'modifierExtension') need(Array.isArray(child) && child.length === 0, 'Unsupported FHIR modifier or implicit rules');
      if (child && typeof child === 'object') pending.push(child);
    }
  }
}

export function modalityCodes(study, version) {
  const values = study.modality ?? [];
  need(Array.isArray(values) && values.length <= 64, 'Unsupported modality list');
  const codes = [];
  for (const value of values) {
    need(value && typeof value === 'object' && !Array.isArray(value), 'Invalid modality value');
    need(version !== 'R5' ? value.coding === undefined : !(value.code !== undefined && value.coding === undefined), 'Modality shape does not match the selected FHIR version');
    const codings = version !== 'R5' ? [value] : value?.coding ?? [];
    need(Array.isArray(codings) && codings.length <= 64, 'Unsupported modality coding');
    for (const coding of codings) {
      need(coding && typeof coding === 'object' && !Array.isArray(coding), 'Invalid modality coding');
      if (coding.code !== undefined) {
        need(typeof coding.code === 'string' && coding.code.length <= 128, 'Invalid modality code');
        need(coding.system === undefined || (typeof coding.system === 'string' && coding.system.length <= 512), 'Invalid modality system');
        codes.push({system:coding.system ?? null, code:coding.code});
      }
    }
  }
  return codes;
}

function validateSeriesModalities(study, version) {
  const series = study.series === undefined ? [] : study.series;
  need(Array.isArray(series) && series.length <= 1024, 'Unsupported study series list');
  for (const item of series) {
    need(item && typeof item === 'object' && !Array.isArray(item), 'Invalid study series');
    if (item.modality !== undefined) modalityCodes({modality:[item.modality]},version);
  }
}

function selectionSubsets(selection) {
  const instances = selection.instance ?? [];
  need(Array.isArray(instances) && instances.length <= 1024, 'Unsupported imaging selection instance list');
  const values = [];
  for (const instance of instances) {
    need(instance && typeof instance === 'object' && !Array.isArray(instance), 'Invalid imaging selection instance');
    need(instance.uid === undefined || (typeof instance.uid === 'string' && instance.uid.length <= 128), 'Invalid imaging selection instance UID');
    const subset = instance?.subset ?? [];
    need(Array.isArray(subset) && subset.length <= 128, 'Unsupported imaging selection subset');
    for (const value of subset) {
      need(typeof value === 'string' && value.length <= 128, 'Invalid imaging selection subset');
    }
    need(instance.sopClass === undefined || (instance.sopClass && typeof instance.sopClass === 'object' && !Array.isArray(instance.sopClass)), 'Invalid imaging selection SOP class');
    const sopClass = instance.sopClass?.code ?? null;
    need(sopClass === null || (typeof sopClass === 'string' && sopClass.length <= 256), 'Invalid imaging selection SOP class');
    if (subset.length) values.push({instanceUid:instance.uid ?? null, sopClass, values:[...subset]});
  }
  return {instanceCount:instances.length, subsets:values};
}

// BOUNDARY: an explicitly versioned, local reference projection; source FHIR
// stays authoritative and is never rewritten or promoted to another release.
// INVARIANT: resolve only exact in-bundle references; do not infer study/patient
// registration, frame correspondence, access rights or clinical interpretation.
export function projectFhirEvidence(bundle, {fhirVersion} = {}) {
  const version = family(fhirVersion);
  need(bundle && bundle.resourceType === 'Bundle', 'Unsupported FHIR Bundle');
  rejectUninterpretedModifiers(bundle);
  const entries = bundle.entry ?? [];
  need(Array.isArray(entries) && entries.length <= 512, 'Unsupported Bundle entry list');
  const byReference = new Map(), byKey = new Map(), ignored = {}, selected = [];
  let missingResourceEntries = 0, ignoredWithoutIdentity = 0;
  function register(alias, item) {
    if (!alias) return;
    need(typeof alias === 'string' && alias.length <= 2048, 'Unsupported Bundle fullUrl');
    const old = byReference.get(alias);
    need(!old || old === item, 'Ambiguous Bundle reference');
    byReference.set(alias, item);
  }
  for (const entry of entries) {
    if (!entry?.resource) { missingResourceEntries++; continue; }
    const resource = entry.resource;
    need(resource && typeof resource === 'object' && !Array.isArray(resource) && typeof resource.resourceType === 'string' && typePattern.test(resource.resourceType), 'Unsupported or missing resource type');
    need(!(version !== 'R5' && resource.resourceType === 'ImagingSelection'), 'ImagingSelection is not an R4 or R4B resource');
    if (typeof resource.id !== 'string' || !idPattern.test(resource.id)) {
      need(!supportedTypes.has(resource.resourceType), 'Unsupported or missing resource identity');
      ignored[resource.resourceType] = (ignored[resource.resourceType] ?? 0) + 1;
      ignoredWithoutIdentity++;
      continue;
    }
    const item = {resource, key:`${resource.resourceType}/${resource.id}`, fullUrl:entry.fullUrl ?? null, base:restBase(entry.fullUrl, resource)};
    need(!byKey.has(item.key), 'Duplicate resource identity');
    byKey.set(item.key, item); register(entry.fullUrl, item);
    if (supportedTypes.has(resource.resourceType)) selected.push(item);
    else ignored[resource.resourceType] = (ignored[resource.resourceType] ?? 0) + 1;
  }

  const rows = selected.map(({resource, key}) => {
    need(resource.status === undefined || (typeof resource.status === 'string' && resource.status.length <= 64), 'Invalid resource status');
    if (resource.resourceType === 'ImagingStudy') validateSeriesModalities(resource,version);
    return {key, type:resource.resourceType, status:resource.status ?? null,
      modality:resource.resourceType === 'ImagingStudy' ? modalityCodes(resource, version) : [],
      selection:resource.resourceType === 'ImagingSelection' ? selectionSubsets(resource) : null};
  });
  const links = [], warnings = [];
  function scopedReference(item, value) {
    const ref = reference(value);
    if (!ref || ref.startsWith('#')) return null;
    if (relativeResourcePattern.test(ref) || relativeHistoryPattern.test(ref)) {
      if (item.base) return item.base + ref;
      return item.fullUrl ? null : `bundle:${ref}`;
    }
    try { new URL(ref); return ref; } catch { return null; }
  }
  function targetFor(item, value) {
    const ref = reference(value);
    if (!ref) return {target:null, resolution:'REFERENCE_NOT_PROVIDED'};
    if (relativeResourcePattern.test(ref)) {
      if (item.base) {
        const target = byReference.get(item.base + ref) ?? null;
        return {target, resolution:target ? 'SCOPED_RELATIVE' : 'TARGET_NOT_IN_BUNDLE'};
      }
      if (item.fullUrl) return {target:null, resolution:'TARGET_NOT_IN_BUNDLE'};
      const local = byKey.get(ref);
      const target = local && !local.fullUrl ? local : null;
      return {target, resolution:target ? 'UNSCOPED_LOCAL_KEY' : 'TARGET_NOT_IN_BUNDLE'};
    }
    const target = byReference.get(ref) ?? null;
    return {target, resolution:target ? 'EXACT_FULL_URL' : 'TARGET_NOT_IN_BUNDLE'};
  }
  const subjectsMatch = (a, b) => {
    if (!reference(a.resource.subject) || !reference(b.resource.subject)) return 'SUBJECT_NOT_PROVIDED';
    const left = scopedReference(a, a.resource.subject), right = scopedReference(b, b.resource.subject);
    if (!left || !right) return 'SUBJECT_SCOPE_UNRESOLVED';
    if (left.startsWith('bundle:') !== right.startsWith('bundle:')) return 'SUBJECT_SCOPE_UNRESOLVED';
    if (left.startsWith('bundle:') && left === right) return 'SAME_UNSCOPED_SUBJECT_REFERENCE';
    if (left === right || (byReference.has(left) && byReference.get(left) === byReference.get(right))) return 'SAME_SUBJECT_REFERENCE';
    return 'SUBJECT_REFERENCE_MISMATCH';
  };
  function appendLinks(item, list, field, allowedTypes) {
    const candidates = references(list);
    need(links.length + candidates.length <= MAX_PROJECTED_REFERENCES, 'Unsupported aggregate FHIR reference count');
    for (const candidate of candidates) {
      const {target, resolution} = targetFor(item, candidate);
      const subjectStatus = target && allowedTypes.includes(target.resource.resourceType) ? subjectsMatch(item, target) : null;
      const status = !target ? resolution : !subjectStatus ? 'UNSUPPORTED_TARGET_TYPE' : resolution === 'UNSCOPED_LOCAL_KEY' ? 'UNSCOPED_LOCAL_KEY' : subjectStatus;
      links.push({source:item.key, field, target:target?.key ?? null, status, ...(resolution === 'UNSCOPED_LOCAL_KEY' ? {subjectStatus} : {})});
    }
  }
  for (const item of selected) {
    const resource = item.resource;
    if (resource.resourceType === 'DiagnosticReport') {
      const field = version === 'R5' ? 'DiagnosticReport.study' : 'DiagnosticReport.imagingStudy';
      appendLinks(item, reportStudyReferences(resource, fhirVersion), field, ['ImagingStudy']);
      appendLinks(item, resource.result, 'DiagnosticReport.result', ['Observation']);
      if (version !== 'R5' && resource.study !== undefined) warnings.push(`R5 DiagnosticReport.study was not used for an ${version} projection.`);
      if (version === 'R5' && resource.imagingStudy !== undefined) warnings.push('R4/R4B DiagnosticReport.imagingStudy was not used for an R5 projection.');
    }
    if (resource.resourceType === 'ImagingSelection') appendLinks(item, resource.derivedFrom, 'ImagingSelection.derivedFrom', ['ImagingStudy', 'ImagingSelection']);
  }
  if ((bundle.link ?? []).some?.(item => item?.relation === 'next')) warnings.push('The Bundle identifies another page; it was not fetched.');
  if (links.some(link => link.status === 'UNSCOPED_LOCAL_KEY')) warnings.push('Some relative references match a local key, but this bundle supplies no server base; those links are not resolved FHIR identities.');
  if (missingResourceEntries) warnings.push(`${missingResourceEntries} Bundle entries have no resource and were not projected.`);
  if (ignoredWithoutIdentity) warnings.push(`${ignoredWithoutIdentity} other resources lack a supported identity and could not be resolved.`);
  return {schema:'DICOM3D-FHIR-evidence-projection-1', sourceVersion:fhirVersion, family:version,
    entryCount:entries.length, resources:rows, links, ignored, warnings};
}

// Local files are bounded and read in the browser only. Caller-selected version
// is explicit because ordinary FHIR resources do not identify their release.
export async function readLocalFhirEvidence(file, {fhirVersion, signal} = {}) {
  const check = () => { if (signal?.aborted) throw new Error('CANCELLED'); };
  check();
  need(file && Number.isSafeInteger(file.size) && file.size > 0 && file.size <= 1024 * 1024 && typeof file.arrayBuffer === 'function', 'Unsupported local evidence size');
  const bytes = new Uint8Array(await file.arrayBuffer());
  check(); need(bytes.byteLength === file.size, 'Local evidence size changed');
  const projection = projectFhirEvidence(JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)), {fhirVersion});
  const sha256 = await digest(bytes);
  check();
  return {projection, provenance:{kind:'local-file', bytes:bytes.byteLength, sha256}};
}
