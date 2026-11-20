import {boundedTestReader, SMART_TEST} from '../../../viewer/src/connect-read.mjs';
import {digest} from '../../../viewer/src/ct-frame.mjs';
import {MAX_CAPABILITY_BYTES, summarizeCapabilityStatement} from '../../../viewer/src/fhir-capability-model.mjs';
export {summarizeCapabilityStatement} from '../../../viewer/src/fhir-capability-model.mjs';

const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
// Reuse the existing allowlisted, anonymous and response-bounded reader. Only
// public /metadata is requested; the original response stays with the reader.
export async function readPublicFhirCapabilities({signal, fetchImpl} = {}) {
  const reader = boundedTestReader(SMART_TEST, signal, fetchImpl, {totalCap:MAX_CAPABILITY_BYTES});
  const {data, source} = await reader.read('metadata', MAX_CAPABILITY_BYTES);
  const capability = summarizeCapabilityStatement(data);
  requireValue(/^4\.0\./.test(capability.fhirVersion), 'The public test endpoint did not declare FHIR R4');
  return {capability, provenance: {kind: 'public-test', url: source.url, bytes: source.bytes, sha256: source.sha256, retrievedAt: source.retrievedAt}};
}

// A locally supplied statement is read only in this browser. The source file is
// never uploaded or persisted, and late reads cannot publish after cancellation.
async function readLocalStatement(file, signal) {
  const check = () => { if (signal?.aborted) throw new Error('CANCELLED'); };
  check();
  requireValue(file && Number.isSafeInteger(file.size) && file.size > 0 && file.size <= MAX_CAPABILITY_BYTES && typeof file.arrayBuffer === 'function', 'Unsupported local statement size');
  const bytes = new Uint8Array(await file.arrayBuffer());
  check();
  requireValue(bytes.byteLength === file.size, 'Local statement size changed');
  const statement = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
  const sha256 = await digest(bytes);
  check();
  return {statement, provenance: {kind:'local-file', bytes:bytes.byteLength, sha256, retrievedAt:new Date().toISOString()}};
}

export async function readLocalFhirCapabilities(file, {signal} = {}) {
  const {statement, provenance} = await readLocalStatement(file, signal);
  return {capability: summarizeCapabilityStatement(statement), provenance};
}

export async function readLocalFhirOpenApi(file, {signal} = {}) {
  const {statement, provenance} = await readLocalStatement(file, signal);
  const {createReadOnlyOpenApi} = await import('../../../viewer/src/fhir-readonly-openapi.mjs');
  if (signal?.aborted) throw new Error('CANCELLED');
  return createReadOnlyOpenApi({statement, sourceSha256: provenance.sha256});
}
