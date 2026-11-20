import {createConfiguredFhirImagingStudyReader, createConfiguredFhirMetadataReader} from './fhir-configured-metadata.mjs';

const PREFIX = '/dicom3d/_interop/fhir/';
const idPattern = /^[A-Za-z0-9_-]{1,64}$/;
const studyPattern = /^[A-Za-z0-9.-]{1,64}$/;
const releases = new Set(['4.0.1', '4.3.0', '5.0.0']);
const fail = code => Object.assign(new Error(code), {code});
const need = (condition, code) => { if (!condition) throw fail(code); };

function credentials(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const decoded = Buffer.from(match[1], 'base64');
  if (decoded.toString('base64') !== match[1] || decoded.length > 2048) return false;
  const text = decoded.toString('latin1'), separator = text.indexOf(':');
  return separator > 0 && separator < text.length - 1 && /^[\x20-\x7e]+$/.test(text);
}

// Optional preview-only bridge. Every request carries the user's own upstream
// credentials; no configured service account or browser-supplied URL is used.
export function createLoopbackFhirRoute({sources, port, fetchImpl = globalThis.fetch, timeoutMs = 15000} = {}) {
  need(Number.isInteger(port) && port > 0 && port <= 65535, 'INVALID_CONFIGURATION');
  need(Array.isArray(sources) && sources.length > 0 && sources.length <= 32, 'INVALID_CONFIGURATION');
  const configured = new Map();
  for (const input of sources) {
    need(input && Object.keys(input).every(key => ['id','baseUrl','fhirVersion','imagingStudyIds'].includes(key)), 'INVALID_CONFIGURATION');
    need(idPattern.test(input.id ?? '') && !configured.has(input.id) && releases.has(input.fhirVersion) &&
      Array.isArray(input.imagingStudyIds) && input.imagingStudyIds.length > 0 && input.imagingStudyIds.length <= 64 &&
      input.imagingStudyIds.every(id => studyPattern.test(id)) && new Set(input.imagingStudyIds).size === input.imagingStudyIds.length, 'INVALID_CONFIGURATION');
    let address;
    try { address = new URL(input.baseUrl); } catch { throw fail('INVALID_CONFIGURATION'); }
    need(address.protocol === 'https:' || (address.protocol === 'http:' && ['127.0.0.1','[::1]'].includes(address.hostname)), 'INVALID_CONFIGURATION');
    const source = {id:input.id, baseUrl:input.baseUrl, fhirVersion:input.fhirVersion, imagingStudyIds:[...input.imagingStudyIds]};
    // Reuse the underlying reader's URL/configuration validation at startup.
    createConfiguredFhirImagingStudyReader({sources:[source], authorize:async()=>false, fetchImpl, timeoutMs});
    configured.set(source.id, source);
  }
  const expectedHost = `127.0.0.1:${port}`, expectedOrigin = `http://${expectedHost}`;

  return async function handle(req, res, path) {
    const reply = (status, data) => {
      if (res.destroyed || res.writableEnded) return;
      const body = JSON.stringify(data);
      res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
        'Content-Length':Buffer.byteLength(body),'X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer','Vary':'Authorization, Origin'});
      res.end(body);
    };
    if (req.method !== 'GET') return reply(405, {error:'METHOD_NOT_ALLOWED'});
    const local = ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress);
    const sameOrigin = req.headers.host === expectedHost && req.headers['sec-fetch-site'] === 'same-origin' &&
      (!req.headers.origin || req.headers.origin === expectedOrigin) && req.headers['x-dicom3d-request'] === 'fhir-read-v1';
    if (!local || !sameOrigin || req.headers['transfer-encoding'] || (req.headers['content-length'] && req.headers['content-length'] !== '0'))
      return reply(403, {error:'REQUEST_NOT_ALLOWED'});
    const match = /^\/dicom3d\/_interop\/fhir\/([A-Za-z0-9_-]{1,64})\/ImagingStudy\/([A-Za-z0-9.-]{1,64})$/.exec(path);
    if (!match || req.url !== path) return reply(404, {error:'SOURCE_UNAVAILABLE'});
    const authorization = req.headers.authorization;
    if (!credentials(authorization)) return reply(401, {error:'AUTHENTICATION_REQUIRED'});
    const source = configured.get(match[1]), studyId = match[2];
    if (!source || !source.imagingStudyIds.includes(studyId)) return reply(403, {error:'UPSTREAM_ACCESS_DENIED'});
    if (new URL(source.baseUrl).protocol !== 'https:') return reply(426, {error:'UPSTREAM_SECURE_TRANSPORT_REQUIRED'});
    const controller = new AbortController();
    const cancel = () => controller.abort();
    const close = () => { if (!res.writableEnded) cancel(); };
    req.once('aborted', cancel); res.once('close', close);
    try {
      const withCredential = {...source, authorization:async()=>authorization};
      // This callback limits local transport scope. The configured upstream is
      // responsible for authenticating and authorizing the study request.
      const authorize = async ({principal,sourceId,resourceType,resourceId}) => principal === 'explicit-loopback-credential' &&
        sourceId === source.id && (!resourceType || (resourceType === 'ImagingStudy' && resourceId === studyId));
      const options = {sources:[withCredential],authorize,fetchImpl,timeoutMs};
      const principal = 'explicit-loopback-credential';
      const study = await createConfiguredFhirImagingStudyReader(options)({sourceId:source.id,studyId,principal,signal:controller.signal});
      const metadata = await createConfiguredFhirMetadataReader(options)({sourceId:source.id,principal,signal:controller.signal});
      need(metadata.capability.fhirVersion === source.fhirVersion, 'SOURCE_VERSION_MISMATCH');
      const payload = {sourceId:source.id, fhirVersion:metadata.capability.fhirVersion, resource:study.resource,
        provenance:{study:study.provenance, metadata:metadata.provenance}};
      need(Buffer.byteLength(JSON.stringify(payload)) <= 4 * 1024 * 1024, 'RESPONSE_TOO_LARGE');
      reply(200,payload);
    } catch (error) {
      if (controller.signal.aborted) return;
      const status = error?.code === 'UPSTREAM_SECURE_TRANSPORT_REQUIRED' ? 426 : error?.code === 'UPSTREAM_ACCESS_DENIED' ? 403 : error?.code === 'SOURCE_UNAVAILABLE' ? 404 :
        error?.code === 'TIMEOUT' ? 504 : 502;
      reply(status,{error:status===426?'UPSTREAM_SECURE_TRANSPORT_REQUIRED':status===403?'UPSTREAM_ACCESS_DENIED':status===404?'SOURCE_UNAVAILABLE':
        status===504?'UPSTREAM_TIMEOUT':'UPSTREAM_UNAVAILABLE_OR_INVALID'});
    } finally {
      req.removeListener('aborted',cancel); res.removeListener('close',close); controller.abort();
    }
  };
}

export const LOOPBACK_FHIR_PREFIX = PREFIX;
