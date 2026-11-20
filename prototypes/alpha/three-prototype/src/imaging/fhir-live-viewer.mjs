import {projectFhirEvidence} from '../../../viewer/src/fhir-evidence-projection.mjs';
import {boundedStreamBytes} from '../../../viewer/src/public-source-binding.mjs';

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

// Only a locally configured same-origin bridge is addressed. The supplied
// credentials remain in memory for this request and are never written to storage.
export async function readLiveFhirStudy({sourceId,studyId,username,password,appBase,pageUrl,signal,fetchImpl=globalThis.fetch} = {}) {
  need(sourceIdPattern.test(sourceId ?? '') && studyIdPattern.test(studyId ?? ''), 'INVALID_SOURCE');
  need(typeof username === 'string' && typeof password === 'string' && username.length > 0 && password.length > 0 &&
    username.length <= 256 && password.length <= 1024 && !username.includes(':') && /^[\x20-\x7e]+$/.test(username) && /^[\x20-\x7e]+$/.test(password), 'INVALID_CREDENTIALS');
  let page,base;
  try { page = new URL(pageUrl); base = new URL(appBase,page); } catch { throw Object.assign(new Error('INVALID_HOST'),{code:'INVALID_HOST'}); }
  need(page.protocol === 'http:' && page.hostname === '127.0.0.1' && page.port && !page.username && !page.password && base.origin === page.origin && base.pathname === '/dicom3d/' && !base.search && !base.hash, 'INVALID_HOST');
  need(typeof fetchImpl === 'function', 'UNAVAILABLE');
  if (signal?.aborted) throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
  const url = new URL(`_interop/fhir/${sourceId}/ImagingStudy/${studyId}`,base).href;
  const controller = new AbortController(), cancel = () => controller.abort();
  signal?.addEventListener('abort',cancel,{once:true});
  if (signal?.aborted) cancel();
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},35000);
  try {
    let response;
    try {
      response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal,
        headers:{Accept:'application/json',Authorization:`Basic ${btoa(`${username}:${password}`)}`,'X-DICOM3D-Request':'fhir-read-v1'}});
    } catch { throw Object.assign(new Error(signal?.aborted?'CANCELLED':timedOut?'TIMEOUT':'UNAVAILABLE'),{code:signal?.aborted?'CANCELLED':timedOut?'TIMEOUT':'UNAVAILABLE'}); }
    if (signal?.aborted) throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
    need(response && (!response.url || response.url===url), 'UNAVAILABLE');
    if (response.status===401 || response.status===403) throw Object.assign(new Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});
    if (response.status===426) throw Object.assign(new Error('UPSTREAM_SECURE_TRANSPORT_REQUIRED'),{code:'UPSTREAM_SECURE_TRANSPORT_REQUIRED'});
    if (response.status===404 || response.status===503) throw Object.assign(new Error('SOURCE_UNAVAILABLE'),{code:'SOURCE_UNAVAILABLE'});
    need(response.ok, 'UNAVAILABLE');
    const contentType=(response.headers.get('content-type')??'').split(';',1)[0].trim().toLowerCase();
    const length=response.headers.get('content-length');
    need(contentType==='application/json' && /^\d+$/.test(length??'') && Number(length)>0 && Number(length)<=limit, 'INVALID_RESPONSE');
    const bytes=await boundedStreamBytes(response.body,Number(length),'Live FHIR response');
    if (signal?.aborted) throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
    let payload;
    try { payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); } catch { throw Object.assign(new Error('INVALID_RESPONSE'),{code:'INVALID_RESPONSE'}); }
    need(payload?.sourceId===sourceId && versions.has(payload.fhirVersion) && payload.resource?.resourceType==='ImagingStudy' && payload.resource.id===studyId, 'INVALID_RESPONSE');
    const projection=projectFhirEvidence({resourceType:'Bundle',type:'collection',entry:[{resource:payload.resource}]},{fhirVersion:payload.fhirVersion});
    return {sourceId,version:payload.fhirVersion,resource:payload.resource,projection,provenance:payload.provenance};
  } finally { clearTimeout(timer); signal?.removeEventListener('abort',cancel); controller.abort(); }
}
