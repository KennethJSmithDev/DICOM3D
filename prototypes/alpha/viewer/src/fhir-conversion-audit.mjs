import {digest} from './ct-frame.mjs';
import {projectFhirEvidence} from './fhir-evidence-projection.mjs';

const need = (condition, message) => { if (!condition) throw new Error(message); };
const MAX_BYTES = 1024 * 1024;

// Compare selected imaging identities and explicit references only. This is
// deliberately not a FHIR validator or a guarantee of lossless conversion.
export function auditR4ToR5Evidence(source, converted, {sourceVersion='4.0.1'} = {}) {
  need(['4.0.1','4.3.0'].includes(sourceVersion), 'Choose FHIR R4 or R4B as the source version');
  const from = projectFhirEvidence(source, {fhirVersion:sourceVersion});
  const to = projectFhirEvidence(converted, {fhirVersion:'5.0.0'});
  const index = bundle => new Map((bundle.entry ?? []).filter(entry => entry?.resource?.id).map(entry => [
    `${entry.resource.resourceType}/${entry.resource.id}`, entry,
  ]));
  const originals = index(source), outputs = index(converted), findings = [];
  const add = (code, resource, detail) => findings.push({code, resource, detail});
  const canonical = value => JSON.stringify(value, function (key, item) {
    return item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item;
  });
  const plainRefs = (resource, field) => {
    const value = resource[field] ?? [];
    need(Array.isArray(value) && value.length <= 1024, 'Unsupported reference list');
    return value.map(ref => canonical(ref)).sort();
  };
  const keys = entry => {
    const series = entry.resource.series ?? [];
    need(Array.isArray(series) && series.length <= 1024, 'Unsupported study series');
    const result = [];
    for (const item of series) {
      need(item && typeof item === 'object' && !Array.isArray(item), 'Invalid study series');
      const instances = item.instance ?? [];
      need(Array.isArray(instances) && instances.length <= 100000, 'Unsupported study instance list');
      result.push(`series:${item.uid ?? ''}`);
      for (const instance of instances) result.push(canonical([item.uid ?? null, instance?.uid ?? null, instance?.sopClass ?? null]));
    }
    return result.sort();
  };
  let checked = 0;
  for (const [key, original] of originals) {
    if (!['DiagnosticReport','ImagingStudy'].includes(original.resource.resourceType)) continue;
    checked++;
    const result = outputs.get(key);
    if (!result) { add('RESOURCE_MISSING', key, 'The converted bundle does not contain the same resource type and ID.'); continue; }
    if ((original.fullUrl ?? null) !== (result.fullUrl ?? null)) {
      add('SOURCE_SCOPE_CHANGED', key, 'The resource fullUrl changed or was omitted; source scope needs review.');
      continue;
    }
    if (canonical(original.resource.subject ?? null) !== canonical(result.resource.subject ?? null))
      add('SUBJECT_REFERENCE_CHANGED', key, 'The explicit subject reference changed; this check does not establish patient identity.');
    if (original.resource.resourceType === 'DiagnosticReport') {
      const before = plainRefs(original.resource, 'imagingStudy');
      const after = plainRefs(result.resource, 'study');
      if (canonical(before) !== canonical(after)) add('REPORT_STUDY_REFERENCE_CHANGED', key,
        `${sourceVersion === '4.3.0' ? 'R4B' : 'R4'} imagingStudy has ${before.length} reference(s); R5 study has ${after.length}. Review the original source before using this conversion.`);
      if (canonical(plainRefs(original.resource, 'result')) !== canonical(plainRefs(result.resource, 'result')))
        add('REPORT_RESULT_REFERENCE_CHANGED', key, 'The report result references changed or were omitted.');
    } else {
      if (canonical(original.resource.identifier ?? []) !== canonical(result.resource.identifier ?? []))
        add('STUDY_IDENTIFIER_CHANGED', key, 'The study identifier values changed or were omitted.');
      if (canonical(keys(original)) !== canonical(keys(result)))
        add('STUDY_SERIES_OR_INSTANCE_CHANGED', key, 'The source series, instance or SOP-class identity changed or was omitted.');
      const before = from.resources.find(item => item.key === key)?.modality ?? [];
      const after = to.resources.find(item => item.key === key)?.modality ?? [];
      if (canonical(before) !== canonical(after)) add('STUDY_MODALITY_CHANGED', key, 'The source modality coding changed or was omitted.');
    }
  }
  for (const [key, result] of outputs) {
    if (['DiagnosticReport','ImagingStudy'].includes(result.resource.resourceType) && !originals.has(key))
      add('UNMATCHED_CONVERTED_RESOURCE', key, 'The converted bundle contains an imaging resource not matched to the source.');
  }
  return {schema:sourceVersion === '4.3.0' ? 'DICOM3D-FHIR-R4B-R5-audit-1' : 'DICOM3D-FHIR-R4-R5-audit-1', sourceVersion, checkedResources:checked, findings,
    result:findings.length ? 'REVIEW_REQUIRED' : checked ? 'SELECTED_CHECKS_PASSED' : 'NO_COMPARABLE_IMAGING',
    limitations:['Only selected imaging identities and report-to-study references were compared.',
      'Matching local IDs without source fullUrls do not establish a shared server identity.',
      'Other FHIR elements, profiles, clinical meaning, authorization and patient identity are not validated.',
      'Keep the original source; a passing comparison does not establish lossless conversion.']};
}

// Both files remain in this browser or process. Neither source nor result is
// uploaded, stored persistently or changed by this comparison.
export async function readLocalConversionAudit(sourceFile, convertedFile, {signal, sourceVersion='4.0.1'} = {}) {
  const check = () => { if (signal?.aborted) throw new Error('CANCELLED'); };
  async function read(file) {
    check();
    need(file && Number.isSafeInteger(file.size) && file.size > 0 && file.size <= MAX_BYTES && typeof file.arrayBuffer === 'function', 'Unsupported local bundle size');
    const bytes = new Uint8Array(await file.arrayBuffer());
    check(); need(bytes.byteLength === file.size, 'Local bundle size changed');
    const parsed = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
    const sha256 = await digest(bytes);
    check(); return {parsed, provenance:{bytes:bytes.byteLength, sha256}};
  }
  const original = await read(sourceFile), converted = await read(convertedFile);
  const audit = auditR4ToR5Evidence(original.parsed, converted.parsed, {sourceVersion});
  check();
  return {audit, provenance:{source:original.provenance, converted:converted.provenance}};
}
