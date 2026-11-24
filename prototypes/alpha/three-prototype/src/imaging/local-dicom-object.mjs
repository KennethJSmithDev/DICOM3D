const sha256 = /^[0-9a-f]{64}$/;
const uid = /^(?:[0-9]+\.)+[0-9]+$/;
export const ionPlanSopClass = '1.2.840.10008.5.1.4.1.1.481.8';
const sopFamilies = new Map([
  ['1.2.840.10008.5.1.4.1.1.88.11', 'SR'],
  ['1.2.840.10008.5.1.4.1.1.88.22', 'SR'],
  ['1.2.840.10008.5.1.4.1.1.88.33', 'SR'],
  ['1.2.840.10008.5.1.4.1.1.88.34', 'SR'],
  ['1.2.840.10008.5.1.4.1.1.481.5', 'RTPLAN'],
  [ionPlanSopClass, 'RTPLAN'],
  ['1.2.840.10008.5.1.4.1.1.481.3', 'RTSTRUCT'],
]);

export const localObjectFileLimit = 2 * 1024 * 1024;

function need(condition, reason) {
  if (!condition) throw new Error(reason);
}

function fields(record) {
  need(record && typeof record === 'object' && !Array.isArray(record), 'Expected source fields');
  need(Object.values(record).every(value => typeof value === 'string'), 'Invalid source field value');
}

function array(items, visit) {
  need(Array.isArray(items) && items.length <= 1000, 'Source items outside supported bounds');
  items.forEach(visit);
}

function checkReferences(items, depth = 0) {
  need(depth <= 20, 'Source references outside supported depth');
  array(items, reference => {
    need(typeof reference.sequence === 'string', 'Expected source reference sequence');
    fields(reference.values);
    checkReferences(reference.references, depth + 1);
  });
}

function checkReport(item, depth = 0) {
  need(depth <= 20 && typeof item.type === 'string' && typeof item.relationship === 'string',
    'Invalid structured report item');
  fields(item.values);
  for (const key of ['concepts', 'codedValues', 'qualifiers']) {
    if (key === 'concepts' || item[key] !== undefined) array(item[key], fields);
  }
  if (item.measurements !== undefined) array(item.measurements, measurement => {
    fields(measurement.values);
    array(measurement.units, fields);
  });
  checkReferences(item.references);
  array(item.children, child => checkReport(child, depth + 1));
}

function regionNumber(value) {
  if (!/^[+-]?\d+$/.test(value ?? '')) return NaN;
  const number = Number(value);
  return number >= -2147483648 && number <= 2147483647 ? number : NaN;
}

function checkStructure(content) {
  fields(content.fields);
  if (content.studyIdentity != null) {
    need(typeof content.studyIdentity === 'string' && content.studyIdentity.length <= 64 && uid.test(content.studyIdentity),
      'Invalid structure set study identity');
  }
  const regions = new Set();
  array(content.regions, region => {
    fields(region);
    const number = regionNumber(region.ROINumber);
    need(Number.isFinite(number) && !regions.has(number), 'Missing or duplicate ROI number');
    regions.add(number);
  });
  array(content.contours, group => {
    fields(group.fields);
    need(regions.has(regionNumber(group.fields.ReferencedROINumber)), 'Contour references an absent ROI');
    array(group.items, contour => {
      fields(contour.fields);
      checkReferences(contour.references);
      if (contour.coordinatesMm !== undefined) {
        const count = regionNumber(contour.fields.NumberOfContourPoints);
        need(count > 0 && count <= 4000 && Array.isArray(contour.coordinatesMm) &&
          contour.coordinatesMm.length === count * 3 && contour.coordinatesMm.every(Number.isFinite),
          'Invalid contour coordinates');
      }
    });
  });
  array(content.observations, observation => {
    fields(observation);
    need(regions.has(regionNumber(observation.ReferencedROINumber)), 'Observation references an absent ROI');
  });
  checkReferences(content.references);
}

export async function readLocalDicomObject(envelope) {
  need(envelope?.schema === 'DICOM3D-local-object-1' && typeof envelope.payload === 'string' &&
    sha256.test(envelope.payloadSha256), 'Invalid prepared DICOM object');
  const bytes = new TextEncoder().encode(envelope.payload);
  need(bytes.byteLength <= 512 * 1024, 'Inspection payload exceeds size limit');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
  need(hash === envelope.payloadSha256, 'Inspection payload integrity mismatch');
  const value = JSON.parse(envelope.payload);
  const source = value.source;
  need(source && sha256.test(source.sha256) && typeof source.sopInstanceUID === 'string' &&
    source.sopInstanceUID.length <= 64 && uid.test(source.sopInstanceUID) &&
    sopFamilies.has(source.sopClassUID) && sopFamilies.get(source.sopClassUID) === source.family &&
    ['1.2.840.10008.1.2', '1.2.840.10008.1.2.1'].includes(source.transferSyntaxUID),
  'Invalid source DICOM identity');
  if (source.family === 'SR') checkReport(value.content);
  else if (source.family === 'RTSTRUCT') checkStructure(value.content);
  else {
    fields(value.content.fields);
    array(value.content.beams, fields);
    array(value.content.fractions, fraction => {
      fields(fraction.fields);
      checkReferences(fraction.references);
    });
    checkReferences(value.content.references);
  }
  return value;
}
