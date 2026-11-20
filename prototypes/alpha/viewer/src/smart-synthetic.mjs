import {projectFhirEvidence} from './fhir-evidence-projection.mjs';
import {isVerifiedVolume} from './imaging-core.mjs';
import {randomSmartValue,pkceS256} from './smart-pkce.mjs';

// This is an offline witness, not a SMART client or an authorization server.
// Its fixed .invalid issuers and in-memory grants cannot contact real systems.
const TENANTS = Object.freeze({
  'synthetic-a': Object.freeze({fhirBase:'https://a.fhir.synthetic.invalid/fhir', issuer:'https://a.auth.synthetic.invalid', redirect:'https://viewer.synthetic.invalid/callback/a'}),
  'synthetic-b': Object.freeze({fhirBase:'https://b.fhir.synthetic.invalid/fhir', issuer:'https://b.auth.synthetic.invalid', redirect:'https://viewer.synthetic.invalid/callback/b'}),
});
const CLIENT = 'dicom3d-synthetic';
const VERSION = new Set(['4.0.1', '4.3.0', '5.0.0']);
const ID = /^synthetic-[a-z0-9-]{1,48}$/;
const UID = /^\d+(\.\d+)+$/;
const TTL = 5 * 60 * 1000;
const MAX_PENDING = 16;

function requireValue(value, code) {
  if (!value) throw Object.assign(new Error(code), {code});
}
const randomValue = randomSmartValue;
export const syntheticPkceS256 = pkceS256;
function contextReference(value, resourceType) {
  const prefix = `${resourceType}/`;
  return value === null || (typeof value === 'string' && value.startsWith(prefix) && ID.test(value.slice(prefix.length)));
}
function redirectLocation(value) {
  let url;
  try { url = new URL(value); } catch { throw Object.assign(new Error('INVALID_REDIRECT'), {code:'INVALID_REDIRECT'}); }
  const loopback = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  requireValue((loopback && ['http:','https:'].includes(url.protocol) || url.protocol === 'https:' && url.hostname.endsWith('.invalid')) &&
    !url.username && !url.password && !url.search && !url.hash && url.href === value, 'INVALID_REDIRECT');
  return url.href;
}
function allowedScopes(launchKind, requestEncounter) {
  const scopes = [launchKind === 'ehr' ? 'launch' : 'launch/patient', 'patient/ImagingStudy.rs', 'patient/DiagnosticReport.rs'];
  if (launchKind === 'standalone' && requestEncounter) scopes.push('launch/encounter');
  return scopes;
}
function validScopes(scopes, allowed) {
  return Array.isArray(scopes) && scopes.length <= allowed.length && new Set(scopes).size === scopes.length && scopes.every(value => allowed.includes(value));
}
function studyUid(resource) {
  const ids = resource.identifier ?? [];
  requireValue(Array.isArray(ids) && ids.length <= 64, 'INVALID_STUDY');
  const matches = ids.filter(item => item?.system === 'urn:dicom:uid');
  requireValue(matches.length <= 1, 'INVALID_STUDY');
  if (!matches.length) return null;
  const value = matches[0]?.value;
  requireValue(typeof value === 'string' && value.startsWith('urn:oid:'), 'INVALID_STUDY');
  const uid = value.slice(8);
  requireValue(uid.length <= 64 && UID.test(uid), 'INVALID_STUDY');
  return uid;
}

// Checkpoints contain synthetic verifier/code state and are only for per-tab
// demonstration storage. They do not authenticate a real authorization server.
export function createSyntheticSmartHarness({now = () => Date.now(), viewerRedirectUri = null} = {}) {
  requireValue(typeof now === 'function', 'INVALID_CLOCK');
  const suppliedRedirect = viewerRedirectUri === null ? null : redirectLocation(viewerRedirectUri);
  const pending = new Map(), codes = new Map(), sessions = new WeakMap(), references = new WeakMap();
  let epoch = 0;
  function time() {
    const value = now();
    requireValue(Number.isSafeInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER - TTL, 'INVALID_CLOCK');
    return value;
  }
  function sessionRecord(session) {
    const item = sessions.get(session);
    requireValue(item && item.active && item.epoch === epoch, 'INVALID_SESSION');
    requireValue(time() < item.expiresAt, 'EXPIRED_SESSION');
    return item;
  }
  function prune() {
    const current = time();
    for (const [state, item] of pending) if (current >= item.expiresAt || item.cancelled) {
      item.cancelled = true; pending.delete(state);
      if (item.code) codes.delete(item.code);
    }
  }
  function discovery(tenantKey) {
    const tenant = Object.hasOwn(TENANTS, tenantKey) ? TENANTS[tenantKey] : null;
    requireValue(tenant, 'INVALID_LAUNCH');
    return Object.freeze({mode:'synthetic-only', fhirBase:tenant.fhirBase,
      configurationUrl:`${tenant.fhirBase}/.well-known/smart-configuration`,
      authorizationServerIssuer:tenant.issuer, authorizationEndpoint:`${tenant.issuer}/authorize`,
      tokenEndpoint:`${tenant.issuer}/token`, codeChallengeMethods:Object.freeze(['S256'])});
  }
  async function begin({tenantKey, persona, launchKind, fhirVersion, requestEncounter = false} = {}) {
    const tenant = Object.hasOwn(TENANTS, tenantKey) ? TENANTS[tenantKey] : null;
    requireValue(tenant && ['patient','clinician'].includes(persona) && ['ehr','standalone'].includes(launchKind) && VERSION.has(fhirVersion) && typeof requestEncounter === 'boolean', 'INVALID_LAUNCH');
    prune(); requireValue(pending.size < MAX_PENDING, 'TOO_MANY_LAUNCHES');
    const startedEpoch = epoch, state = randomValue(), verifier = randomValue();
    const codeChallenge = await syntheticPkceS256(verifier);
    requireValue(startedEpoch === epoch, 'CANCELLED');
    prune(); requireValue(pending.size < MAX_PENDING && !pending.has(state), 'TOO_MANY_LAUNCHES');
    const scopes = allowedScopes(launchKind, requestEncounter), redirectUri = suppliedRedirect ?? tenant.redirect;
    const url = new URL(discovery(tenantKey).authorizationEndpoint);
    for (const [key, value] of Object.entries({response_type:'code', client_id:CLIENT, redirect_uri:redirectUri,
      scope:scopes.join(' '), state, aud:tenant.fhirBase, code_challenge:codeChallenge, code_challenge_method:'S256'})) url.searchParams.set(key,value);
    if (launchKind === 'ehr') url.searchParams.set('launch','synthetic-launch');
    const request = url.href, expiresAt = time() + TTL;
    pending.set(state, {state, verifier, codeChallenge, request, tenantKey, tenant, persona, launchKind, fhirVersion,
      requestEncounter, redirectUri, scopes, expiresAt, epoch, cancelled:false, status:'pending', code:null});
    return Object.freeze({mode:'synthetic-only', authorizationRequest:request});
  }
  // The simulated issuer accepts only the exact request just created above.
  // Its grant is a test fixture and conveys no real identity or permission.
  function issueSyntheticCode(request, {patient = 'Patient/synthetic-person-a', encounter = null, grantedScopes} = {}) {
    let url;
    try { url = new URL(request); } catch { throw Object.assign(new Error('INVALID_REQUEST'), {code:'INVALID_REQUEST'}); }
    const item = pending.get(url.searchParams.get('state'));
    requireValue(item && item.request === request && item.status === 'pending' && !item.cancelled && !item.code && item.epoch === epoch, 'INVALID_REQUEST');
    requireValue(time() < item.expiresAt, 'EXPIRED_LAUNCH');
    const scopes = grantedScopes === undefined ? item.scopes : grantedScopes;
    requireValue(validScopes(scopes, item.scopes), 'INVALID_GRANT');
    requireValue(contextReference(patient, 'Patient') && contextReference(encounter, 'Encounter'), 'INVALID_GRANT');
    const code = randomValue();
    requireValue(!codes.has(code), 'INVALID_GRANT');
    const contextScope = item.launchKind === 'ehr' ? 'launch' : 'launch/patient';
    const patientRef = scopes.includes(contextScope) ? patient : null;
    const encounterScope = item.launchKind === 'ehr' ? 'launch' : 'launch/encounter';
    const encounterRef = scopes.includes(encounterScope) ? encounter : null;
    codes.set(code, {state:item.state, tenantKey:item.tenantKey, codeChallenge:item.codeChallenge, scopes:[...scopes], patientRef, encounterRef, epoch});
    item.code = code;
    return Object.freeze({state:item.state, code, issuer:item.tenant.issuer, redirectUri:item.redirectUri});
  }
  async function complete(callback) {
    requireValue(callback && typeof callback.state === 'string' && typeof callback.code === 'string' &&
      typeof callback.issuer === 'string' && typeof callback.redirectUri === 'string', 'INVALID_CALLBACK');
    const item = pending.get(callback.state);
    requireValue(item && item.status === 'pending' && !item.cancelled && item.epoch === epoch, 'INVALID_CALLBACK');
    item.status = 'completing';
    try {
      requireValue(time() < item.expiresAt, 'EXPIRED_LAUNCH');
      requireValue(callback.issuer === item.tenant.issuer && callback.redirectUri === item.redirectUri && callback.code === item.code, 'INVALID_CALLBACK');
      const grant = codes.get(callback.code);
      codes.delete(callback.code);
      requireValue(grant && grant.state === item.state && grant.tenantKey === item.tenantKey && grant.epoch === epoch, 'INVALID_CALLBACK');
      const computed = await syntheticPkceS256(item.verifier);
      requireValue(!item.cancelled && item.epoch === epoch, 'CANCELLED');
      requireValue(time() < item.expiresAt && computed === grant.codeChallenge, 'INVALID_CALLBACK');
      const expiresAt = time() + TTL;
      const session = Object.freeze({mode:'synthetic-only', tenantKey:item.tenantKey, fhirBase:item.tenant.fhirBase,
        fhirVersion:item.fhirVersion, persona:item.persona, launchKind:item.launchKind, patientRef:grant.patientRef, encounterRef:grant.encounterRef,
        grantedScopes:Object.freeze([...grant.scopes]), expiresAt});
      sessions.set(session, {active:true, epoch, expiresAt});
      return session;
    } finally {
      if (pending.get(item.state) === item) pending.delete(item.state);
      if (item.code) codes.delete(item.code);
    }
  }
  function checkpoint(callback) {
    const item = pending.get(callback?.state), grant = codes.get(callback?.code);
    requireValue(item && grant && item.status === 'pending' && !item.cancelled && item.epoch === epoch && time() < item.expiresAt &&
      item.code === callback.code && grant.state === item.state && callback.issuer === item.tenant.issuer && callback.redirectUri === item.redirectUri, 'INVALID_CHECKPOINT');
    return Object.freeze({schema:'DICOM3D-synthetic-smart-pending-1', tenantKey:item.tenantKey, persona:item.persona,
      launchKind:item.launchKind, fhirVersion:item.fhirVersion, requestEncounter:item.requestEncounter, redirectUri:item.redirectUri,
      state:item.state, verifier:item.verifier, codeChallenge:item.codeChallenge, code:item.code,
      grantedScopes:Object.freeze([...grant.scopes]), patientRef:grant.patientRef, encounterRef:grant.encounterRef, expiresAt:item.expiresAt});
  }
  async function restoreCheckpoint(value) {
    const keys = ['schema','tenantKey','persona','launchKind','fhirVersion','requestEncounter','redirectUri','state','verifier','codeChallenge','code','grantedScopes','patientRef','encounterRef','expiresAt'];
    requireValue(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key)) &&
      value.schema === 'DICOM3D-synthetic-smart-pending-1', 'INVALID_CHECKPOINT');
    const tenant = Object.hasOwn(TENANTS, value.tenantKey) ? TENANTS[value.tenantKey] : null;
    requireValue(tenant && ['patient','clinician'].includes(value.persona) && ['ehr','standalone'].includes(value.launchKind) && VERSION.has(value.fhirVersion) &&
      typeof value.requestEncounter === 'boolean' && value.redirectUri === (suppliedRedirect ?? tenant.redirect) &&
      ['state','verifier','codeChallenge','code'].every(key => typeof value[key] === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value[key])) &&
      validScopes(value.grantedScopes, allowedScopes(value.launchKind,value.requestEncounter)) && contextReference(value.patientRef,'Patient') &&
      contextReference(value.encounterRef,'Encounter'), 'INVALID_CHECKPOINT');
    const contextScope = value.launchKind === 'ehr' ? 'launch' : 'launch/patient';
    const encounterScope = value.launchKind === 'ehr' ? 'launch' : 'launch/encounter';
    requireValue((value.patientRef === null || value.grantedScopes.includes(contextScope)) &&
      (value.encounterRef === null || value.grantedScopes.includes(encounterScope)) && Number.isSafeInteger(value.expiresAt) &&
      value.expiresAt > time() && value.expiresAt <= time() + TTL, 'INVALID_CHECKPOINT');
    prune(); requireValue(pending.size < MAX_PENDING && !pending.has(value.state) && !codes.has(value.code), 'INVALID_CHECKPOINT');
    const startedEpoch = epoch, computed = await syntheticPkceS256(value.verifier);
    requireValue(startedEpoch === epoch && computed === value.codeChallenge && value.expiresAt > time() &&
      pending.size < MAX_PENDING && !pending.has(value.state) && !codes.has(value.code), 'INVALID_CHECKPOINT');
    const item = {state:value.state, verifier:value.verifier, codeChallenge:value.codeChallenge, request:null,
      tenantKey:value.tenantKey, tenant, persona:value.persona, launchKind:value.launchKind, fhirVersion:value.fhirVersion,
      requestEncounter:value.requestEncounter, redirectUri:value.redirectUri, scopes:allowedScopes(value.launchKind,value.requestEncounter),
      expiresAt:value.expiresAt, epoch, cancelled:false, status:'pending', code:value.code};
    pending.set(value.state,item);
    codes.set(value.code,{state:value.state,tenantKey:value.tenantKey,codeChallenge:value.codeChallenge,scopes:[...value.grantedScopes],
      patientRef:value.patientRef,encounterRef:value.encounterRef,epoch});
    return Object.freeze({state:value.state,code:value.code,issuer:tenant.issuer,redirectUri:value.redirectUri});
  }
  function sessionCheckpoint(session) {
    sessionRecord(session);
    return Object.freeze({schema:'DICOM3D-synthetic-smart-session-1', session});
  }
  function restoreSession(value) {
    requireValue(value && typeof value === 'object' && Object.keys(value).length === 2 && value.schema === 'DICOM3D-synthetic-smart-session-1' && value.session, 'INVALID_SESSION');
    const item = value.session, keys = ['mode','tenantKey','fhirBase','fhirVersion','persona','launchKind','patientRef','encounterRef','grantedScopes','expiresAt'];
    const tenant = Object.hasOwn(TENANTS,item.tenantKey) ? TENANTS[item.tenantKey] : null;
    requireValue(typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === keys.length && keys.every(key => Object.hasOwn(item,key)) &&
      tenant && item.mode === 'synthetic-only' && item.fhirBase === tenant.fhirBase && VERSION.has(item.fhirVersion) &&
      ['patient','clinician'].includes(item.persona) && ['ehr','standalone'].includes(item.launchKind) &&
      validScopes(item.grantedScopes,allowedScopes(item.launchKind,true)) && contextReference(item.patientRef,'Patient') &&
      contextReference(item.encounterRef,'Encounter') && Number.isSafeInteger(item.expiresAt) && item.expiresAt > time() && item.expiresAt <= time() + TTL, 'INVALID_SESSION');
    const contextScope = item.launchKind === 'ehr' ? 'launch' : 'launch/patient';
    const encounterScope = item.launchKind === 'ehr' ? 'launch' : 'launch/encounter';
    requireValue((item.patientRef === null || item.grantedScopes.includes(contextScope)) &&
      (item.encounterRef === null || item.grantedScopes.includes(encounterScope)), 'INVALID_SESSION');
    const session = Object.freeze({...item,grantedScopes:Object.freeze([...item.grantedScopes])});
    sessions.set(session,{active:true,epoch,expiresAt:item.expiresAt});
    return session;
  }
  function cancelLaunch(state) {
    const item = pending.get(state);
    if (!item) return false;
    item.cancelled = true; pending.delete(state);
    if (item.code) codes.delete(item.code);
    return true;
  }
  function closeSession(session) {
    const item = sessions.get(session);
    if (!item || !item.active) return false;
    item.active = false; return true;
  }
  function clear() {
    epoch++;
    for (const item of pending.values()) item.cancelled = true;
    pending.clear(); codes.clear();
  }
  function clinicalStudyReference(session, bundle, studyId) {
    sessionRecord(session);
    requireValue(session.grantedScopes.includes('patient/ImagingStudy.rs'), 'INSUFFICIENT_SCOPE');
    requireValue(session.patientRef !== null, 'PATIENT_CONTEXT_REQUIRED');
    requireValue(ID.test(studyId ?? '') && bundle?.resourceType === 'Bundle' && Array.isArray(bundle.entry) && bundle.entry.length <= 512, 'INVALID_STUDY');
    for (const entry of bundle.entry) {
      const resource = entry?.resource;
      const scope = resource?.resourceType === 'ImagingStudy' ? 'patient/ImagingStudy.rs' :
        resource?.resourceType === 'DiagnosticReport' ? 'patient/DiagnosticReport.rs' : null;
      requireValue(scope && session.grantedScopes.includes(scope) && ID.test(resource.id ?? '') &&
        entry.fullUrl === `${session.fhirBase}/${resource.resourceType}/${resource.id}`, 'INVALID_SOURCE');
    }
    const projection = projectFhirEvidence(bundle, {fhirVersion:session.fhirVersion});
    const matches = bundle.entry.filter(entry => entry.resource.resourceType === 'ImagingStudy' && entry.resource.id === studyId);
    requireValue(matches.length === 1, 'INVALID_STUDY');
    const resource = matches[0].resource;
    requireValue(resource.subject?.reference === session.patientRef, 'SUBJECT_MISMATCH');
    const resourceVersion = resource.meta?.versionId ?? null;
    requireValue(resourceVersion === null || (typeof resourceVersion === 'string' && /^[A-Za-z0-9.-]{1,64}$/.test(resourceVersion)), 'INVALID_STUDY');
    const links = projection.links.filter(link => link.target === `ImagingStudy/${studyId}`).map(link => Object.freeze({...link}));
    // These are unresolved at the Bundle level; they are not asserted to refer to this study.
    const unresolvedReportLinks = projection.links.filter(link => !link.target && /^(DiagnosticReport\.study|DiagnosticReport\.imagingStudy)$/.test(link.field))
      .map(link => Object.freeze({...link}));
    const reference = Object.freeze({schema:'DICOM3D-synthetic-clinical-study-reference-1', mode:'synthetic-only', tenantKey:session.tenantKey,
      fhirBase:session.fhirBase, fhirVersion:session.fhirVersion, resource:`ImagingStudy/${studyId}`, resourceVersion,
      patientRef:session.patientRef, dicomStudyUid:studyUid(resource), status:resource.status ?? null,
      links:Object.freeze(links), unresolvedReportLinks:Object.freeze(unresolvedReportLinks),
      warnings:Object.freeze([...projection.warnings]), provenance:'synthetic-bundle', pixelAccess:'not-established'});
    references.set(reference, session);
    return reference;
  }
  function viewerStudyInput(session, reference, volume) {
    sessionRecord(session);
    requireValue(references.get(reference) === session, 'INVALID_REFERENCE');
    if (volume === undefined) return Object.freeze({kind:'metadata-only', reference, pixelAccess:'not-established'});
    requireValue(isVerifiedVolume(volume) && reference.dicomStudyUid && volume.descriptor.source.studyIdentity === reference.dicomStudyUid, 'UNVERIFIED_VOLUME');
    // An identical synthetic study UID does not prove patient identity or registration.
    return Object.freeze({kind:'verified-volume', volume, linkage:'synthetic-study-uid-only', patientMatch:'not-established', atlasRegistration:'not-established'});
  }
  return Object.freeze({discovery, begin, issueSyntheticCode, complete, checkpoint, restoreCheckpoint, sessionCheckpoint, restoreSession,
    cancelLaunch, closeSession, clear, clinicalStudyReference, viewerStudyInput});
}
