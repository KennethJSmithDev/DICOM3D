const sha256 = /^[0-9a-f]{64}$/;
const uid = /^(?:[0-9]+\.)+[0-9]+$/;
const sopFamilies = new Map([
  ['1.2.840.10008.5.1.4.1.1.88.11', 'SR'],
  ['1.2.840.10008.5.1.4.1.1.88.22', 'SR'],
  ['1.2.840.10008.5.1.4.1.1.88.33', 'SR'],
  ['1.2.840.10008.5.1.4.1.1.88.34', 'SR'],
  ['1.2.840.10008.5.1.4.1.1.481.5', 'RTPLAN'],
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
