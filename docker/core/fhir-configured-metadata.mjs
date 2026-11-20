import {createHash} from 'node:crypto';
import {MAX_CAPABILITY_BYTES, summarizeCapabilityStatement} from '../../prototypes/alpha/viewer/src/fhir-capability-model.mjs';

const CAP = MAX_CAPABILITY_BYTES;
const STUDY_CAP = 2 * 1024 * 1024;
const RELEASES = new Set(['4.0.1','4.3.0','5.0.0']);
const validFhirId = value => typeof value === 'string' && /^[A-Za-z0-9.-]{1,64}$/.test(value);
const failure = code => Object.assign(new Error(code), {code});
const need = (condition, code) => { if (!condition) throw failure(code); };

function metadataUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw failure('INVALID_CONFIGURATION'); }
  const loopback = ['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  need((url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) &&
    !url.username && !url.password && !url.search && !url.hash, 'INVALID_CONFIGURATION');
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/metadata`;
  return url.href;
}

// This is an optional server-side socket, not an HTTP endpoint. The embedding
// host must provide a trusted principal and authorization decision; the public
// static Core server does not mount it. Only configured metadata is readable.
function createConfiguredFhirJsonReader({sources, authorize, fetchImpl=globalThis.fetch, timeoutMs=15000} = {}, kind) {
  need(Array.isArray(sources) && sources.length > 0 && sources.length <= 32 &&
    typeof authorize === 'function' && typeof fetchImpl === 'function' &&
    Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 30000, 'INVALID_CONFIGURATION');
  const configured = new Map();
  for (const source of sources) {
    need(source && typeof source.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(source.id) &&
      !configured.has(source.id) && (source.authorization === undefined || typeof source.authorization === 'function'), 'INVALID_CONFIGURATION');
    const url=metadataUrl(source.baseUrl);
    // Credentials require an authenticated server, including on loopback.
    need(source.authorization === undefined || new URL(url).protocol === 'https:', 'UPSTREAM_SECURE_TRANSPORT_REQUIRED');
    if(kind==='imaging'){
      need(RELEASES.has(source.fhirVersion) && Array.isArray(source.imagingStudyIds) &&
        source.imagingStudyIds.length>0 && source.imagingStudyIds.length<=64 &&
        source.imagingStudyIds.every(validFhirId) && new Set(source.imagingStudyIds).size===source.imagingStudyIds.length, 'INVALID_CONFIGURATION');
    }
    configured.set(source.id, {url, authorization:source.authorization, fhirVersion:source.fhirVersion,
      imagingStudyIds:kind==='imaging'?new Set(source.imagingStudyIds):null});
  }

  return async function readConfigured({sourceId, principal, studyId, signal} = {}) {
    if (signal?.aborted) throw failure('CANCELLED');
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, {once:true});
    if (signal?.aborted) abort();
    const timer = setTimeout(() => { timedOut=true; controller.abort(); }, timeoutMs);
    const interruption = () => failure(signal?.aborted ? 'CANCELLED' : 'TIMEOUT');
    const bounded = promise => new Promise((resolve,reject) => {
      const stop = () => { controller.signal.removeEventListener('abort',stop); reject(interruption()); };
      if (controller.signal.aborted) return stop();
      controller.signal.addEventListener('abort',stop,{once:true});
      Promise.resolve(promise).then(value => { controller.signal.removeEventListener('abort',stop); resolve(value); },
        error => { controller.signal.removeEventListener('abort',stop); reject(error); });
    });
    try {
      let permitted = false;
      const requestScope=kind==='imaging'?{resourceType:'ImagingStudy',resourceId:studyId}:{};
      try { permitted = await bounded(Promise.resolve().then(() => authorize({principal,sourceId,...requestScope,signal:controller.signal}))); }
      catch (error) { if (error?.code === 'CANCELLED' || error?.code === 'TIMEOUT') throw error; }
      need(permitted === true, 'ACCESS_DENIED');
      need(typeof sourceId === 'string' && configured.has(sourceId), 'SOURCE_UNAVAILABLE');
      const source = configured.get(sourceId);
      if(kind==='imaging')need(validFhirId(studyId) && source.imagingStudyIds.has(studyId), 'SOURCE_UNAVAILABLE');
      const url=kind==='imaging'?source.url.replace(/\/metadata$/, '/ImagingStudy/'+studyId):source.url;
      const cap=kind==='imaging'?STUDY_CAP:CAP;
      const headers = {Accept:'application/fhir+json, application/json'};
      if (source.authorization) {
        need(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'UPSTREAM_SECURE_TRANSPORT_REQUIRED');
        let authorization;
        try { authorization = await bounded(Promise.resolve().then(() => source.authorization({signal:controller.signal}))); }
        catch (error) {
          if (error?.code === 'CANCELLED' || error?.code === 'TIMEOUT') throw error;
          throw failure('UPSTREAM_AUTH_UNAVAILABLE');
        }
        need(typeof authorization === 'string' && authorization.length > 0 && authorization.length <= 4096 && !/[\r\n]/.test(authorization), 'UPSTREAM_AUTH_UNAVAILABLE');
        headers.Authorization = authorization;
      }
      if (source.authorization) need(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'UPSTREAM_SECURE_TRANSPORT_REQUIRED');
      if (controller.signal.aborted) throw failure(signal?.aborted ? 'CANCELLED' : 'TIMEOUT');
      let response;
      try { response = await bounded(Promise.resolve().then(() => fetchImpl(url, {method:'GET',headers,signal:controller.signal,redirect:'error',credentials:'omit'}))); }
      catch { throw failure(signal?.aborted ? 'CANCELLED' : timedOut ? 'TIMEOUT' : 'UPSTREAM_UNAVAILABLE'); }
      if (signal?.aborted) throw failure('CANCELLED');
      if (timedOut) throw failure('TIMEOUT');
      need(response && typeof response.status === 'number' && response.headers && typeof response.headers.get === 'function', 'UPSTREAM_UNAVAILABLE');
      if (response.status === 401 || response.status === 403) throw failure('UPSTREAM_ACCESS_DENIED');
      need(response.ok && (!response.url || response.url === url), 'UPSTREAM_UNAVAILABLE');
      const contentType=(response.headers.get('content-type') ?? '').split(';',1)[0].trim().toLowerCase();
      need(['application/fhir+json','application/json'].includes(contentType), 'UNSUPPORTED_RESPONSE');
      const length=response.headers.get('content-length');
      need(length === null || (/^\d+$/.test(length) && Number(length) <= cap), 'RESPONSE_TOO_LARGE');
      const reader=response.body?.getReader(); need(reader, 'UNSUPPORTED_RESPONSE');
      const chunks=[]; let size=0;
      try {
        for (;;) {
          const part=await bounded(reader.read());
          if (signal?.aborted) throw failure('CANCELLED');
          if (timedOut) throw failure('TIMEOUT');
          if (part.done) break;
          size+=part.value.byteLength; need(size <= cap, 'RESPONSE_TOO_LARGE');
          chunks.push(part.value);
        }
      } catch (error) {
        try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* preserve the original failure */ }
        if (error?.code) throw error;
        throw failure(signal?.aborted ? 'CANCELLED' : timedOut ? 'TIMEOUT' : 'UPSTREAM_UNAVAILABLE');
      }
      const bytes=Buffer.concat(chunks.map(chunk => Buffer.from(chunk)),size);
      let parsed;
      try { parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
      catch { throw failure('UNSUPPORTED_RESPONSE'); }
      const provenance={bytes:size,sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString()};
      if(kind==='metadata'){
        let capability;
        try { capability=summarizeCapabilityStatement(parsed); } catch { throw failure('UNSUPPORTED_RESPONSE'); }
        return {sourceId,capability,provenance};
      }
      need(parsed && parsed.resourceType==='ImagingStudy' && parsed.id===studyId, 'UNSUPPORTED_RESPONSE');
      return {sourceId,configuredFhirVersion:source.fhirVersion,resource:parsed,provenance};
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); controller.abort();
    }
  };
}

export function createConfiguredFhirMetadataReader(options) {
  return createConfiguredFhirJsonReader(options,'metadata');
}

// The host must authorize each exact study and independently verify the source
// version. This socket is not mounted by the unauthenticated static Core host.
export function createConfiguredFhirImagingStudyReader(options) {
  return createConfiguredFhirJsonReader(options,'imaging');
}
