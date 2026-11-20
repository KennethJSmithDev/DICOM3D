import { summarizeCapabilityStatement } from './fhir-capability-model.mjs';

// Protocol paths are based on HL7 FHIR R4/R4B/R5 REST and OpenAPI 3.0.3.
// This projection is not a validation of server behavior or authorization.
const LIMIT = 100_000;
const SUPPORTED = new Set(['read', 'vread', 'search-type', 'history-instance', 'history-type']);

function checkUninterpretedRules(value) {
  const stack = [value], seen = new WeakSet();
  let count = 0;
  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== 'object') continue;
    if (seen.has(item)) throw new Error('Cyclic or shared objects are not supported');
    seen.add(item);
    if (++count > LIMIT) throw new Error('CapabilityStatement is too complex');
    if (Object.hasOwn(item, 'modifierExtension') || Object.hasOwn(item, 'implicitRules')) {
      throw new Error('CapabilityStatement contains rules this projection cannot interpret');
    }
    for (const child of Object.values(item)) stack.push(child);
  }
}

function serverUrl(value) {
  if (value === undefined) return 'https://example.invalid/fhir';
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid FHIR base URL'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
  if ((!loopback && url.protocol !== 'https:') || (loopback && !['http:', 'https:'].includes(url.protocol)) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Use HTTPS or loopback HTTP without credentials, query or fragment');
  }
  return url.toString().replace(/\/$/, '');
}

const idParameter = name => ({ name, in: 'path', required: true, schema: { type: 'string' } });
const response = { description: 'FHIR JSON response; server behavior and access are not verified',
  content: { 'application/fhir+json': { schema: { type: 'object', additionalProperties: true } } } };

function operation(type, name, parameters = []) {
  return {
    operationId: `${name}${type}`,
    summary: `${name} ${type}`,
    description: 'Protocol template derived from a declaration; access and actual server behavior remain unverified.',
    ...(parameters.length ? { parameters } : {}),
    responses: { 200: response }
  };
}

/** Project a bounded R4/R4B/R5 CapabilityStatement into a read-only protocol template. */
export function createReadOnlyOpenApi({ statement, sourceSha256, baseUrl }) {
  if (!/^[0-9a-f]{64}$/.test(sourceSha256 ?? '')) throw new Error('Expected SHA-256 of the source bytes');
  checkUninterpretedRules(statement);
  const summary = summarizeCapabilityStatement(statement);
  if (summary.systems.filter(item => item.mode === 'server').length !== 1) {
    throw new Error('Exactly one server REST declaration is required');
  }
  const resources = summary.resources.filter(item => item.mode === 'server');
  const seen = new Set(), paths = {}, omitted = [];
  const systemOmitted = [];
  for (const code of summary.systems.find(item => item.mode === 'server').interactions) {
    if (code === 'history-system') paths['/_history'] = {get: operation('System', 'history')};
    else systemOmitted.push(code);
  }
  for (const item of resources) {
    if (seen.has(item.type)) throw new Error('Duplicate server resource declaration');
    seen.add(item.type);
    const type = item.type, list = `/${type}`, instance = `${list}/{id}`;
    for (const code of item.interactions) {
      if (!SUPPORTED.has(code)) { omitted.push(`${type}:${code}`); continue; }
      if (code === 'read') paths[instance] = { ...(paths[instance] ?? {}), get: operation(type, 'read', [idParameter('id')]) };
      if (code === 'vread') paths[`${instance}/_history/{vid}`] = { get: operation(type, 'vread', [idParameter('id'), idParameter('vid')]) };
      if (code === 'history-instance') paths[`${instance}/_history`] = { get: operation(type, 'historyInstance', [idParameter('id')]) };
      if (code === 'history-type') paths[`${list}/_history`] = { get: operation(type, 'historyType') };
      if (code === 'search-type') {
        const description = 'Search is declared; the server may reject either HTTP method. Search parameters are not projected.';
        paths[list] = { ...(paths[list] ?? {}), get: { ...operation(type, 'searchGet'), description } };
        paths[`${list}/_search`] = { post: {
          ...operation(type, 'searchPost'), description,
          requestBody: { required: false, content: { 'application/x-www-form-urlencoded': {
            schema: { type: 'object', additionalProperties: { type: 'string' } }
          } } }
        } };
      }
    }
  }
  return {
    openapi: '3.0.3',
    info: { title: 'DICOM3D read-only FHIR protocol template', version: '0.1.0',
      description: 'Generated offline from declared capabilities. Authentication, authorization, endpoint availability, search parameters and FHIR profiles are not validated or completely described. Configure security before use.' },
    servers: [{ url: serverUrl(baseUrl), description: baseUrl === undefined ? 'Non-routable placeholder; replace with an authorized server.' : 'Operator-supplied base URL; unverified.' }],
    paths,
    'x-dicom3d-projection': {
      sourceSha256, fhirVersion: summary.fhirVersion, statementKind: summary.kind,
      readOnly: true, declaredResourceInteractionsOmitted: omitted.sort(),
      declaredSystemInteractionsOmitted: systemOmitted.sort(),
      limitations: ['This is not a complete FHIR or OpenAPI contract.', 'Some system interactions, write operations, profiles, search parameter definitions and security requirements are omitted.',
        'An omitted security scheme does not mean authentication is unnecessary.', 'FHIR resource declarations do not establish access or actual server behavior.']
    }
  };
}
