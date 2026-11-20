import {randomSmartValue,pkceS256} from './smart-pkce.mjs';
import {projectFhirEvidence} from './fhir-evidence-projection.mjs';
import {EPIC_SANDBOX_PENDING_KEY,EPIC_SANDBOX_REDIRECT,EPIC_STATE_PREFIX} from './epic-sandbox-callback.mjs';

// Fixed non-production endpoints; no organization or production issuer is accepted.
export const EPIC_SANDBOX_FHIR='https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';
const ISSUER='https://fhir.epic.com/interconnect-fhir-oauth/oauth2';
const AUTHORIZE=`${ISSUER}/authorize`, TOKEN=`${ISSUER}/token`;
const CONFIG=`${EPIC_SANDBOX_FHIR}/.well-known/smart-configuration`;
const SCOPES='launch/patient patient/ImagingStudy.rs';
const TTL=300000, MAX_JSON=2*1024*1024, MAX_TOKEN=65536;
const sessions=new WeakMap();
const consumedCallbacks=new WeakSet();
const need=(value,code)=>{if(!value)throw Object.assign(new Error(code),{code});};
const cleanId=value=>typeof value==='string'&&/^[A-Za-z0-9.-]{1,64}$/.test(value);
const current=now=>{const t=now();need(Number.isSafeInteger(t)&&t>=0&&t<=Number.MAX_SAFE_INTEGER-3600000,'INVALID_CLOCK');return t;};

async function jsonRequest(url,{method='GET',body,headers={},signal,fetchImpl=globalThis.fetch,limit=MAX_JSON}={}) {
  need(typeof fetchImpl==='function','UNAVAILABLE');
  if(signal?.aborted)throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
  const controller=new AbortController();let timeout=false;
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
  const timer=setTimeout(()=>{timeout=true;controller.abort();},15000);
  try {
    const response=await fetchImpl(url,{method,body,headers,signal:controller.signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
    need(response&&(!response.url||response.url===url),'INVALID_RESPONSE');
    if(response.status===401||response.status===403)throw Object.assign(new Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});
    need(response.ok,'UNAVAILABLE');
    const contentType=(response.headers.get('content-type')??'').split(';',1)[0].trim().toLowerCase();
    need(contentType==='application/json'||contentType==='application/fhir+json','INVALID_RESPONSE');
    const length=response.headers.get('content-length');
    need(length===null||(/^\d+$/.test(length)&&Number(length)<=limit),'RESPONSE_TOO_LARGE');
    need(response.body&&typeof response.body.getReader==='function','INVALID_RESPONSE');
    const reader=response.body.getReader(),chunks=[];let total=0;
    try {
      for(;;){const {done,value}=await reader.read();if(done)break;need(value instanceof Uint8Array,'INVALID_RESPONSE');total+=value.length;need(total<=limit,'RESPONSE_TOO_LARGE');chunks.push(value);}
    } catch(error) {await reader.cancel().catch(()=>{});throw error;}
    need(total>0,'INVALID_RESPONSE');
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    if(signal?.aborted)throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
    if(timeout)throw Object.assign(new Error('TIMEOUT'),{code:'TIMEOUT'});
    try {return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Object.assign(new Error('INVALID_RESPONSE'),{code:'INVALID_RESPONSE'});}
  } catch(error) {
    if(signal?.aborted)throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
    if(timeout)throw Object.assign(new Error('TIMEOUT'),{code:'TIMEOUT'});
    if(error?.code)throw error;
    throw Object.assign(new Error('UNAVAILABLE'),{code:'UNAVAILABLE'});
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort();}
}

export async function discoverEpicSandbox(options={}) {
  const config=await jsonRequest(CONFIG,{...options,headers:{Accept:'application/json'},limit:65536});
  need(config&&config.authorization_endpoint===AUTHORIZE&&config.token_endpoint===TOKEN&&
    (config.issuer===undefined||config.issuer===ISSUER)&&Array.isArray(config.code_challenge_methods_supported)&&
    config.code_challenge_methods_supported.includes('S256')&&Array.isArray(config.capabilities)&&
    config.capabilities.includes('launch-standalone')&&config.capabilities.includes('client-public'),'UNSUPPORTED_SANDBOX');
  return Object.freeze({fhirBase:EPIC_SANDBOX_FHIR,authorizationEndpoint:AUTHORIZE,tokenEndpoint:TOKEN,fhirVersion:'4.0.1'});
}

export async function prepareEpicSandboxLaunch({clientId,pageUrl,storage,fetchImpl,signal,now=()=>Date.now()}={}) {
  let url;try{url=new URL(pageUrl);}catch{throw Object.assign(new Error('INVALID_REDIRECT'),{code:'INVALID_REDIRECT'});}
  need(`${url.origin}${url.pathname}`===EPIC_SANDBOX_REDIRECT&&!url.username&&!url.password,'INVALID_REDIRECT');
  need(typeof clientId==='string'&&/^[A-Za-z0-9._-]{1,128}$/.test(clientId),'INVALID_CLIENT_ID');
  const config=await discoverEpicSandbox({fetchImpl,signal});
  if(signal?.aborted)throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
  const state=EPIC_STATE_PREFIX+randomSmartValue(),verifier=randomSmartValue(),challenge=await pkceS256(verifier);
  if(signal?.aborted)throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
  const started=current(now),pending={schema:'DICOM3D-epic-sandbox-pending-1',clientId,redirectUri:EPIC_SANDBOX_REDIRECT,
    state,verifier,expiresAt:started+TTL,renderer:url.searchParams.get('renderer')==='webgl'?'webgl':null};
  try {storage.setItem(EPIC_SANDBOX_PENDING_KEY,JSON.stringify(pending));}
  catch{throw Object.assign(new Error('STORAGE_UNAVAILABLE'),{code:'STORAGE_UNAVAILABLE'});}
  const authorize=new URL(config.authorizationEndpoint);
  for(const [key,value] of Object.entries({response_type:'code',client_id:clientId,redirect_uri:EPIC_SANDBOX_REDIRECT,
    scope:SCOPES,state,aud:EPIC_SANDBOX_FHIR,code_challenge:challenge,code_challenge_method:'S256'}))authorize.searchParams.set(key,value);
  return Object.freeze({authorizationUrl:authorize.href});
}

export async function finishEpicSandboxCallback(callback,{fetchImpl,signal,now=()=>Date.now()}={}) {
  need(callback&&typeof callback==='object','INVALID_CALLBACK');
  need(!consumedCallbacks.has(callback),'INVALID_CALLBACK');
  consumedCallbacks.add(callback);
  need(!callback.storageError,'STORAGE_UNAVAILABLE');
  need(!callback.invalid,'INVALID_CALLBACK');
  if(callback.denied)throw Object.assign(new Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});
  need(typeof callback.pending==='string'&&callback.pending.length<=4096,'INVALID_CALLBACK');
  let pending;try{pending=JSON.parse(callback.pending);}catch{throw Object.assign(new Error('INVALID_CALLBACK'),{code:'INVALID_CALLBACK'});}
  const keys=['schema','clientId','redirectUri','state','verifier','expiresAt','renderer'];
  need(pending&&typeof pending==='object'&&!Array.isArray(pending)&&Object.keys(pending).length===keys.length&&keys.every(k=>Object.hasOwn(pending,k))&&
    pending.schema==='DICOM3D-epic-sandbox-pending-1'&&pending.redirectUri===EPIC_SANDBOX_REDIRECT&&
    typeof pending.clientId==='string'&&/^[A-Za-z0-9._-]{1,128}$/.test(pending.clientId)&&
    typeof pending.state==='string'&&/^d3epic_[A-Za-z0-9_-]{43}$/.test(pending.state)&&callback.state===pending.state&&
    typeof pending.verifier==='string'&&/^[A-Za-z0-9_-]{43}$/.test(pending.verifier)&&
    (pending.renderer===null||pending.renderer==='webgl')&&Number.isSafeInteger(pending.expiresAt)&&
    pending.expiresAt>current(now)&&pending.expiresAt<=current(now)+TTL,'INVALID_CALLBACK');
  need(callback.redirectUri===EPIC_SANDBOX_REDIRECT&&(callback.issuer===null||callback.issuer===ISSUER)&&typeof callback.code==='string'&&/^[\x21-\x7e]{1,4096}$/.test(callback.code),'INVALID_CALLBACK');
  const body=new URLSearchParams({grant_type:'authorization_code',code:callback.code,redirect_uri:EPIC_SANDBOX_REDIRECT,
    client_id:pending.clientId,code_verifier:pending.verifier});
  const token=await jsonRequest(TOKEN,{method:'POST',body,headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},fetchImpl,signal,limit:MAX_TOKEN});
  need(token&&typeof token.access_token==='string'&&/^[\x21-\x7e]{1,16384}$/.test(token.access_token)&&
    typeof token.token_type==='string'&&token.token_type.toLowerCase()==='bearer'&&Number.isSafeInteger(token.expires_in)&&token.expires_in>0&&token.expires_in<=86400&&
    (token.patient===undefined||cleanId(token.patient))&&(token.scope===undefined||typeof token.scope==='string'&&token.scope.length<=4096),'INVALID_TOKEN');
  const scopes=(token.scope??SCOPES).split(/\s+/).filter(Boolean);
  const canSearch=scopes.some(value=>value==='patient/ImagingStudy.read'||/^patient\/ImagingStudy\.[cruds]*s[cruds]*$/.test(value));
  const expiresAt=current(now)+Math.min(token.expires_in,3600)*1000;
  const session=Object.freeze({mode:'epic-sandbox',fhirVersion:'4.0.1',hasPatient:typeof token.patient==='string',canSearch,expiresAt});
  sessions.set(session,{accessToken:token.access_token,patientId:token.patient??null,expiresAt,active:true});
  return session;
}

export function closeEpicSandboxSession(session) {
  const item=sessions.get(session);if(!item)return false;
  item.active=false;item.accessToken='';item.patientId=null;sessions.delete(session);return true;
}

export async function searchEpicSandboxStudies(session,{fetchImpl,signal,now=()=>Date.now()}={}) {
  const item=sessions.get(session);need(item&&item.active,'INVALID_SESSION');
  if(current(now)>=item.expiresAt){closeEpicSandboxSession(session);throw Object.assign(new Error('EXPIRED_SESSION'),{code:'EXPIRED_SESSION'});}
  need(item.patientId,'NO_PATIENT_CONTEXT');need(session.canSearch,'SCOPE_NOT_GRANTED');
  const patientId=item.patientId,url=new URL(`${EPIC_SANDBOX_FHIR}/ImagingStudy`);
  url.searchParams.set('patient',patientId);url.searchParams.set('_count','10');
  const bundle=await jsonRequest(url.href,{headers:{Accept:'application/fhir+json',Authorization:`Bearer ${item.accessToken}`},fetchImpl,signal});
  if(signal?.aborted)throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
  need(sessions.get(session)===item&&item.active&&current(now)<item.expiresAt,'INVALID_SESSION');
  need(bundle&&bundle.resourceType==='Bundle'&&bundle.type==='searchset'&&Array.isArray(bundle.entry)&&bundle.entry.length<=128,'INVALID_RESPONSE');
  const selected=[];
  for(const entry of bundle.entry){
    const resource=entry?.resource;if(resource?.resourceType!=='ImagingStudy')continue;
    need(cleanId(resource.id),'INVALID_RESPONSE');
    need(resource.subject?.reference===`Patient/${patientId}`||resource.subject?.reference===`${EPIC_SANDBOX_FHIR}/Patient/${patientId}`,'PATIENT_MISMATCH');
    need(entry.fullUrl===undefined||entry.fullUrl===`${EPIC_SANDBOX_FHIR}/ImagingStudy/${resource.id}`,'INVALID_RESPONSE');
    selected.push({...(entry.fullUrl?{fullUrl:entry.fullUrl}:{}),resource});
  }
  const projection=projectFhirEvidence({resourceType:'Bundle',type:'collection',entry:selected},{fhirVersion:'4.0.1'});
  return Object.freeze({source:'Epic public sandbox',fhirVersion:'4.0.1',studies:Object.freeze(projection.resources.map(row=>Object.freeze({reference:row.key,status:row.status}))),
    moreAvailable:Array.isArray(bundle.link)&&bundle.link.some(link=>link?.relation==='next')});
}
