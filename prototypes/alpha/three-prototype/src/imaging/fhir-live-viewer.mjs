import {projectFhirEvidence} from '../../../viewer/src/fhir-evidence-projection.mjs';
import {digest} from '../../../viewer/src/ct-frame.mjs';
import {summarizeCapabilityStatement, MAX_CAPABILITY_BYTES} from '../../../viewer/src/fhir-capability-model.mjs';

const need = (value, code) => { if (!value) throw Object.assign(new Error(code), {code}); };
const sourceIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
const studyIdPattern = /^[A-Za-z0-9.-]{1,64}$/;
const versions = new Set(['4.0.1','4.3.0','5.0.0']);
const limit = 4 * 1024 * 1024;

// Identity comparison is deliberately narrower than registration or patient matching.
export function compareOpenCtIdentity(resource, study) {
  if (!study?.manifest?.source || !Array.isArray(study?.ctReceipt?.slice_mapping)) return 'NO_OPEN_CT';
  const source = study.manifest.source;
  if (!Array.isArray(resource?.identifier) || !Array.isArray(resource?.series)) return 'NOT_MATCHED';
  const ids = resource.identifier.filter(item => item?.system === 'urn:dicom:uid' && typeof item.value === 'string' && item.value.startsWith('urn:oid:'));
  const matchingSeries = resource.series.filter(item => item?.uid === source.ct_series_uid);
  if (resource?.status !== 'available' || ids.length !== 1 || ids[0].value !== `urn:oid:${source.source_study_uid}` || matchingSeries.length !== 1) return 'NOT_MATCHED';
  if (!Array.isArray(matchingSeries[0].instance)) return 'NOT_MATCHED';
  const expected = study.ctReceipt.slice_mapping.map(item => item?.sop_uid);
  const actual = matchingSeries[0].instance.map(item => item?.uid);
  if (!expected.length || expected.some(uid => typeof uid !== 'string') || actual.some(uid => typeof uid !== 'string') ||
      new Set(expected).size !== expected.length || new Set(actual).size !== actual.length || expected.length !== actual.length) return 'NOT_MATCHED';
  const present = new Set(actual);
  return expected.every(uid => present.has(uid)) ? 'MATCHED_IDENTITIES' : 'NOT_MATCHED';
}

async function readJson(url, options, budget, fetchImpl, {exactLength = false, fingerprint = false} = {}) {
  const response = await fetchImpl(url, options);
  need(response && !response.redirected && (!response.url || response.url === url), 'UNAVAILABLE');
  need(response.status !== 401 && response.status !== 403, 'ACCESS_DENIED');
  need(response.status !== 426, 'UPSTREAM_SECURE_TRANSPORT_REQUIRED');
  need(response.status !== 404 && response.status !== 503, 'SOURCE_UNAVAILABLE');
  need(response.ok, 'UNAVAILABLE');
  const type = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
  need(type === 'application/json' || (!exactLength && type === 'application/fhir+json'), 'INVALID_RESPONSE');
  const length = response.headers.get('content-length');
  need((length === null && !exactLength) || (/^\d+$/.test(length) && Number(length) > 0 && Number(length) <= budget), 'INVALID_RESPONSE');

  // Gateways may compress or stream FHIR JSON. Bound the decoded bytes independently of the wire length.
  const reader = response.body?.getReader();
  need(reader, 'INVALID_RESPONSE');
  let bytes = new Uint8Array(exactLength ? Number(length) : Math.min(Number(length) || 8192, budget));
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      const end = size + value.byteLength;
      need(end <= (exactLength ? bytes.length : budget), 'INVALID_RESPONSE');
      if (end > bytes.length) {
        const expanded = new Uint8Array(Math.min(budget, Math.max(end, 2 * bytes.length)));
        expanded.set(bytes);
        bytes = expanded;
      }
      bytes.set(value, size);
      size = end;
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  need(size > 0 && (!exactLength || size === Number(length)), 'INVALID_RESPONSE');
  const entity = bytes.subarray(0, size);
  let json;
  try { json = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(entity)); }
  catch { need(false, 'INVALID_RESPONSE'); }
  return {json, provenance: fingerprint ? {bytes:size, sha256:await digest(entity), retrievedAt:new Date().toISOString()} : undefined};
}

async function readInstalled({origin, sourceId, studyId, username, options, authorized, fetchImpl}) {
  const binding = (await readJson(
    origin + '/dicom3d/DICOM3D.Entry.cls?fhirSource=' + sourceId + '&fhirStudy=' + studyId,
    {...options, credentials:'same-origin', headers:{Accept:'application/json'}},
    4096, fetchImpl,
  )).json;
  need(binding?.sourceId === sourceId && binding.studyId === studyId && versions.has(binding.fhirVersion), 'INVALID_RESPONSE');
  need(typeof binding.reader === 'string' && binding.reader.toUpperCase() === username.toUpperCase(), 'ACCESS_DENIED');
  const path = binding.path;
  need(typeof path === 'string' && path.length <= 256 && /^(\/[A-Za-z0-9_-]+)*\/fhir(\/(r4|r4b|r5))?$/.test(path) &&
    !/[\r\n]/.test(path), 'INVALID_RESPONSE');
  const metadata = await readJson(origin + path + '/metadata', authorized, MAX_CAPABILITY_BYTES, fetchImpl, {fingerprint:true});
  let version;
  try { version = summarizeCapabilityStatement(metadata.json).fhirVersion; }
  catch { need(false, 'INVALID_RESPONSE'); }
  need(version === binding.fhirVersion, 'SOURCE_VERSION_MISMATCH');
  const study = await readJson(origin + path + '/ImagingStudy/' + studyId, authorized, 2 * 1024 * 1024, fetchImpl, {fingerprint:true});
  return {sourceId, fhirVersion:version, resource:study.json, provenance:{metadata:metadata.provenance, study:study.provenance}};
}

export async function readLiveFhirStudy({sourceId,studyId,username,password,appBase,pageUrl,signal,fetchImpl=globalThis.fetch} = {}) {
  need(typeof sourceId === 'string' && sourceIdPattern.test(sourceId) && typeof studyId === 'string' && studyIdPattern.test(studyId) &&
    !/[\r\n]/.test(sourceId + studyId) && studyId !== '.' && studyId !== '..', 'INVALID_SOURCE');
  need(typeof username === 'string' && typeof password === 'string' && username.length > 0 && password.length > 0 &&
    username.length <= 256 && password.length <= 1024 && !username.includes(':') &&
    !/[^\x20-\x7e]/.test(username + password), 'INVALID_CREDENTIALS');
  let page, base;
  try { page = new URL(pageUrl); base = new URL(appBase, page); }
  catch { need(false, 'INVALID_HOST'); }
  const loopback = page.protocol === 'http:' && page.hostname === '127.0.0.1' && Boolean(page.port);
  need((loopback || page.protocol === 'https:') && !page.username && !page.password && page.pathname.startsWith('/dicom3d/') &&
    base.origin === page.origin && base.pathname === '/dicom3d/' && !base.username && !base.password && !base.search && !base.hash, 'INVALID_HOST');
  need(typeof fetchImpl === 'function', 'UNAVAILABLE');
  need(!signal?.aborted, 'CANCELLED');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, {once:true});
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 35000);
  const options = {method:'GET', mode:'same-origin', credentials:'omit', redirect:'error', cache:'no-store', referrerPolicy:'no-referrer', signal:controller.signal};
  const authorized = {...options, headers:{Accept:'application/fhir+json, application/json', Authorization:'Basic ' + btoa(username + ':' + password)}};
  try {
    let payload;
    if (loopback) {
      const url = new URL('_interop/fhir/' + sourceId + '/ImagingStudy/' + studyId, base).href;
      const request = {...authorized, headers:{...authorized.headers, Accept:'application/json', 'X-DICOM3D-Request':'fhir-read-v1'}};
      payload = (await readJson(url, request, limit, fetchImpl, {exactLength:true})).json;
    } else {
      payload = await readInstalled({origin:page.origin, sourceId, studyId, username, options, authorized, fetchImpl});
    }
    need(!signal?.aborted, 'CANCELLED');
    need(payload?.sourceId === sourceId && versions.has(payload.fhirVersion) &&
      payload.resource?.resourceType === 'ImagingStudy' && payload.resource.id === studyId, 'INVALID_RESPONSE');
    const projection = projectFhirEvidence({resourceType:'Bundle',type:'collection',entry:[{resource:payload.resource}]},{fhirVersion:payload.fhirVersion});
    return {sourceId, version:payload.fhirVersion, resource:payload.resource, projection, provenance:payload.provenance};
  } catch (error) {
    need(!signal?.aborted, 'CANCELLED');
    need(!timedOut, 'TIMEOUT');
    if (typeof error?.code === 'string') throw error;
    need(false, 'UNAVAILABLE');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.abort();
  }
}
