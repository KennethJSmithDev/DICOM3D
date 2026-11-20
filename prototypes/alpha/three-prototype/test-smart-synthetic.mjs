import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {createSyntheticSmartHarness, syntheticPkceS256} from '../viewer/src/smart-synthetic.mjs';
import {verifyVolume} from '../viewer/src/verified-volume.mjs';

const VERSION = ['4.0.1', '4.3.0', '5.0.0'];
const launchOptions = {tenantKey:'synthetic-a', persona:'patient', launchKind:'ehr', fhirVersion:'4.0.1'};

async function launch(harness, options = {}, grant = {}) {
  const request = await harness.begin({...launchOptions, ...options});
  const callback = harness.issueSyntheticCode(request.authorizationRequest, grant);
  const session = await harness.complete(callback);
  return {request, callback, session};
}

function bundle(session, {patient = session.patientRef, uid = '1.2.3'} = {}) {
  const study = {resourceType:'ImagingStudy', id:'synthetic-study-a', status:'available', subject:{reference:patient},
    ...(uid === null ? {} : {identifier:[{system:'urn:dicom:uid', value:`urn:oid:${uid}`}]})};
  const report = {resourceType:'DiagnosticReport', id:'synthetic-report-a', status:'final', subject:{reference:patient},
    ...(session.fhirVersion === '5.0.0' ? {study:[{reference:'ImagingStudy/synthetic-study-a'}]} :
      {imagingStudy:[{reference:'ImagingStudy/synthetic-study-a'}]})};
  return {resourceType:'Bundle', type:'collection', entry:[study, report].map(resource =>
    ({fullUrl:`${session.fhirBase}/${resource.resourceType}/${resource.id}`, resource}))};
}

async function syntheticVolume(studyUid = '1.2.3') {
  const pixels = new Uint16Array([42,42,42,42,42,42,42,42]), bytes = pixels.buffer;
  const hash = createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
  const frameHash = createHash('sha256').update(new Uint8Array(bytes,0,8)).digest('hex');
  const swap = [[0,0,1,0],[0,1,0,0],[1,0,0,0],[0,0,0,1]];
  const descriptor = {schema:'DICOM3D-verified-volume-1', shape:[2,2,2],
    source:{modality:'CT',studyIdentity:studyUid,seriesIdentity:'1.2.4',frameOfReferenceIdentity:'1.2.5'},
    storage:{dtype:'<u2',bitsStored:16,highBit:15,photometric:'MONOCHROME2'},
    calibration:{slope:1,intercept:0,center:42,width:100,voiFunction:'LINEAR_EXACT'},
    geometry:{pixelSpacingRowColumnMm:[1,1],imageOrientationPatient:[1,0,0,0,1,0],matrices:{
      index_to_patient_mm:swap,patient_mm_to_index:swap,
      patient_mm_to_model_m:[[-.001,0,0,0],[0,0,.001,0],[0,.001,0,0],[0,0,0,1]],
      model_m_to_patient_mm:[[-1000,0,0,0],[0,0,1000,0],[0,1000,0,0],[0,0,0,1]]}},
    frames:[0,1].map(k=>({k,sourceFrame:1,sopIdentity:`1.2.6.${k + 1}`,pixelSha256:frameHash,sourceFileSha256:frameHash,imagePositionPatient:[0,0,k]})),
    payload:{bytes:bytes.byteLength,sha256:hash}};
  return verifyVolume(descriptor, bytes, {sourceEncoding:{sopClassUid:'1.2.840.10008.5.1.4.1.1.2',
    transferSyntaxUid:'1.2.840.10008.1.2',decoded:true}});
}

test('PKCE S256 matches the published RFC 7636 test vector and rejects invalid verifiers', async () => {
  assert.equal(await syntheticPkceS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  await assert.rejects(syntheticPkceS256('too-short'), {code:'INVALID_VERIFIER'});
  await assert.rejects(syntheticPkceS256('x'.repeat(129)), {code:'INVALID_VERIFIER'});
  await assert.rejects(syntheticPkceS256('x'.repeat(42) + '!'), {code:'INVALID_VERIFIER'});
});

test('patient and clinician share EHR and standalone synthetic launch for R4, R4B and R5', async () => {
  for (const fhirVersion of VERSION) for (const persona of ['patient','clinician']) for (const launchKind of ['ehr','standalone']) {
    const harness = createSyntheticSmartHarness();
    const {request,session} = await launch(harness, {persona,launchKind,fhirVersion});
    const url = new URL(request.authorizationRequest);
    assert.equal(url.hostname, 'a.auth.synthetic.invalid');
    assert.equal(url.searchParams.get('aud'), 'https://a.fhir.synthetic.invalid/fhir');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.match(url.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
    assert.equal(url.searchParams.has('code_verifier'), false);
    assert.equal(url.searchParams.has('launch'), launchKind === 'ehr');
    assert.ok(session.grantedScopes.includes(launchKind === 'ehr' ? 'launch' : 'launch/patient'));
    assert.equal(session.fhirVersion, fhirVersion);
    assert.equal(session.persona, persona);
    assert.equal(session.mode, 'synthetic-only');
    assert.equal('accessToken' in session, false);
    assert.equal('codeVerifier' in session, false);
    const ref = harness.clinicalStudyReference(session, bundle(session), 'synthetic-study-a');
    assert.equal(ref.links[0].status, 'SAME_SUBJECT_REFERENCE');
    assert.equal(ref.links[0].field, fhirVersion === '5.0.0' ? 'DiagnosticReport.study' : 'DiagnosticReport.imagingStudy');
    assert.equal(harness.viewerStudyInput(session, ref).kind, 'metadata-only');
  }
});

test('synthetic launch is network-free and rejects real, altered or unconfigured issuers', async () => {
  const harness = createSyntheticSmartHarness();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error('unexpected network'); };
  try {
    const discovery = harness.discovery('synthetic-a');
    assert.equal(discovery.configurationUrl, 'https://a.fhir.synthetic.invalid/fhir/.well-known/smart-configuration');
    assert.equal(discovery.authorizationServerIssuer, 'https://a.auth.synthetic.invalid');
    assert.equal(discovery.tokenEndpoint, 'https://a.auth.synthetic.invalid/token');
    assert.deepEqual(discovery.codeChallengeMethods, ['S256']);
    assert.throws(() => harness.discovery('ehr.example.org'), {code:'INVALID_LAUNCH'});
    const request = await harness.begin(launchOptions);
    assert.throws(() => harness.issueSyntheticCode('https://ehr.example.org/authorize'), {code:'INVALID_REQUEST'});
    const altered = new URL(request.authorizationRequest); altered.searchParams.set('aud', 'https://ehr.example.org/fhir');
    assert.throws(() => harness.issueSyntheticCode(altered.href), {code:'INVALID_REQUEST'});
    const changedChallenge = new URL(request.authorizationRequest); changedChallenge.searchParams.set('code_challenge', 'A'.repeat(43));
    assert.throws(() => harness.issueSyntheticCode(changedChallenge.href), {code:'INVALID_REQUEST'});
    const callback = harness.issueSyntheticCode(request.authorizationRequest);
    await harness.complete(callback);
    await assert.rejects(harness.begin({...launchOptions,tenantKey:'https://ehr.example.org/fhir'}), {code:'INVALID_LAUNCH'});
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('encounter context is synthetic and follows the launch context grant', async () => {
  for (const launchKind of ['ehr','standalone']) {
    const harness = createSyntheticSmartHarness();
    const {session,request} = await launch(harness, {launchKind,requestEncounter:true}, {encounter:'Encounter/synthetic-encounter-a'});
    assert.equal(session.encounterRef, 'Encounter/synthetic-encounter-a');
    if (launchKind === 'standalone') assert.ok(new URL(request.authorizationRequest).searchParams.get('scope').split(' ').includes('launch/encounter'));
    const withoutGrant = await launch(harness, {launchKind}, {encounter:'Encounter/synthetic-encounter-a'});
    assert.equal(withoutGrant.session.encounterRef, launchKind === 'ehr' ? 'Encounter/synthetic-encounter-a' : null);
    const request2 = await harness.begin({...launchOptions,launchKind});
    assert.throws(() => harness.issueSyntheticCode(request2.authorizationRequest,{encounter:'Encounter/real-id'}), {code:'INVALID_GRANT'});
  }
});

test('state, issuer, redirect, code and replay are bound to one transaction', async () => {
  for (const mutate of [
    cb => ({...cb,state:'wrong-state'}),
    cb => ({...cb,issuer:'https://b.auth.synthetic.invalid'}),
    cb => ({...cb,redirectUri:'https://viewer.synthetic.invalid/callback/b'}),
    cb => ({...cb,code:'wrong-code'}),
  ]) {
    const harness = createSyntheticSmartHarness(), request = await harness.begin(launchOptions);
    const cb = harness.issueSyntheticCode(request.authorizationRequest);
    await assert.rejects(harness.complete(mutate(cb)), {code:'INVALID_CALLBACK'});
    if (mutate(cb).state === cb.state) await assert.rejects(harness.complete(cb), {code:'INVALID_CALLBACK'});
    else assert.equal((await harness.complete(cb)).mode, 'synthetic-only');
    await assert.rejects(harness.complete(cb), {code:'INVALID_CALLBACK'});
  }
  const harness = createSyntheticSmartHarness();
  const a = await harness.begin(launchOptions), b = await harness.begin({...launchOptions,tenantKey:'synthetic-b'});
  const ca = harness.issueSyntheticCode(a.authorizationRequest), cb = harness.issueSyntheticCode(b.authorizationRequest);
  await assert.rejects(harness.complete({...ca,code:cb.code}), {code:'INVALID_CALLBACK'});
  assert.equal((await harness.complete(cb)).tenantKey, 'synthetic-b');
});

test('granted scopes and patient context constrain study access for both profiles', async () => {
  for (const persona of ['patient','clinician']) {
    const harness = createSyntheticSmartHarness();
    const {session} = await launch(harness, {persona}, {grantedScopes:['launch','patient/DiagnosticReport.rs']});
    assert.throws(() => harness.clinicalStudyReference(session, bundle(session), 'synthetic-study-a'), {code:'INSUFFICIENT_SCOPE'});
    const noContext = await launch(harness, {persona}, {patient:null});
    assert.throws(() => harness.clinicalStudyReference(noContext.session, bundle(noContext.session), 'synthetic-study-a'), {code:'PATIENT_CONTEXT_REQUIRED'});
    const noReportScope = await launch(harness, {persona}, {grantedScopes:['launch','patient/ImagingStudy.rs']});
    assert.throws(() => harness.clinicalStudyReference(noReportScope.session, bundle(noReportScope.session), 'synthetic-study-a'), {code:'INVALID_SOURCE'});
    const limited = bundle(noReportScope.session); limited.entry.pop();
    assert.equal(harness.clinicalStudyReference(noReportScope.session, limited, 'synthetic-study-a').pixelAccess, 'not-established');
  }
});

test('context negotiation cannot introduce unrequested scopes or non-synthetic subjects', async () => {
  const harness = createSyntheticSmartHarness();
  const request = await harness.begin(launchOptions);
  assert.throws(() => harness.issueSyntheticCode(request.authorizationRequest, {patient:'Patient/real-id'}), {code:'INVALID_GRANT'});
  assert.throws(() => harness.issueSyntheticCode(request.authorizationRequest, {grantedScopes:['user/*.cruds']}), {code:'INVALID_GRANT'});
  const cb = harness.issueSyntheticCode(request.authorizationRequest, {grantedScopes:['patient/ImagingStudy.rs']});
  const session = await harness.complete(cb);
  assert.equal(session.patientRef, null);
  assert.throws(() => harness.clinicalStudyReference(session, bundle(session), 'synthetic-study-a'), {code:'PATIENT_CONTEXT_REQUIRED'});
});

test('source, patient, version, and exact study identity survive projection', async () => {
  const harness = createSyntheticSmartHarness();
  for (const fhirVersion of VERSION) {
    const {session} = await launch(harness, {fhirVersion});
    const source = bundle(session), before = JSON.stringify(source);
    const reference = harness.clinicalStudyReference(session, source, 'synthetic-study-a');
    assert.equal(JSON.stringify(source), before);
    assert.equal(reference.tenantKey, 'synthetic-a');
    assert.equal(reference.fhirBase, session.fhirBase);
    assert.equal(reference.fhirVersion, fhirVersion);
    assert.equal(reference.resource, 'ImagingStudy/synthetic-study-a');
    assert.equal(reference.patientRef, 'Patient/synthetic-person-a');
    assert.equal(reference.dicomStudyUid, '1.2.3');
    assert.equal(reference.pixelAccess, 'not-established');
    assert.equal('entry' in reference, false);
    assert.ok(Object.isFrozen(reference));
    assert.ok(Object.isFrozen(reference.links));
  }
});

test('foreign sources, wrong subjects, duplicate identities and ambiguous UIDs fail closed', async () => {
  const harness = createSyntheticSmartHarness(), {session} = await launch(harness);
  let source = bundle(session); source.entry[0].fullUrl = source.entry[0].fullUrl.replace('a.fhir', 'b.fhir');
  assert.throws(() => harness.clinicalStudyReference(session, source, 'synthetic-study-a'), {code:'INVALID_SOURCE'});
  source = bundle(session,{patient:'Patient/synthetic-person-b'});
  assert.throws(() => harness.clinicalStudyReference(session, source, 'synthetic-study-a'), {code:'SUBJECT_MISMATCH'});
  source = bundle(session); source.entry.push(structuredClone(source.entry[0]));
  assert.throws(() => harness.clinicalStudyReference(session, source, 'synthetic-study-a'), /Duplicate resource identity/);
  source = bundle(session); source.entry[0].resource.identifier.push({system:'urn:dicom:uid',value:'urn:oid:1.2.4'});
  assert.throws(() => harness.clinicalStudyReference(session, source, 'synthetic-study-a'), {code:'INVALID_STUDY'});
  source = bundle(session); source.entry[0].resource.identifier[0].value = '1.2.3';
  assert.throws(() => harness.clinicalStudyReference(session, source, 'synthetic-study-a'), {code:'INVALID_STUDY'});
});

test('mismatched report subjects stay marked rather than becoming trusted links', async () => {
  const harness = createSyntheticSmartHarness(), {session} = await launch(harness);
  const source = bundle(session);
  source.entry[1].resource.subject.reference = 'Patient/synthetic-person-b';
  const reference = harness.clinicalStudyReference(session, source, 'synthetic-study-a');
  assert.equal(reference.links[0].status, 'SUBJECT_REFERENCE_MISMATCH');
});

test('unresolved and wrong-version report references remain visible without inventing a study link', async () => {
  const harness = createSyntheticSmartHarness(), {session} = await launch(harness);
  let source = bundle(session);
  source.entry[1].resource.imagingStudy = [{reference:'ImagingStudy/synthetic-not-in-bundle'}];
  let reference = harness.clinicalStudyReference(session, source, 'synthetic-study-a');
  assert.equal(reference.links.length, 0);
  assert.equal(reference.unresolvedReportLinks[0].status, 'TARGET_NOT_IN_BUNDLE');
  source = bundle(session);
  delete source.entry[1].resource.imagingStudy;
  source.entry[1].resource.study = [{reference:'ImagingStudy/synthetic-study-a'}];
  reference = harness.clinicalStudyReference(session, source, 'synthetic-study-a');
  assert.equal(reference.links.length, 0);
  assert.match(reference.warnings.join(' '), /was not used/);
});

test('only an admitted matching synthetic volume can enter the viewer-input contract', async () => {
  const harness = createSyntheticSmartHarness(), {session} = await launch(harness);
  const ref = harness.clinicalStudyReference(session, bundle(session), 'synthetic-study-a');
  const volume = await syntheticVolume();
  assert.throws(() => harness.viewerStudyInput(session, ref, {descriptor:volume.descriptor}), {code:'UNVERIFIED_VOLUME'});
  const wrong = await syntheticVolume('1.2.99');
  assert.throws(() => harness.viewerStudyInput(session, ref, wrong), {code:'UNVERIFIED_VOLUME'});
  const input = harness.viewerStudyInput(session, ref, volume);
  assert.equal(input.volume, volume);
  assert.equal(input.linkage, 'synthetic-study-uid-only');
  assert.equal(input.patientMatch, 'not-established');
  assert.equal(input.atlasRegistration, 'not-established');
  assert.equal(await volume.assertSourceUnchanged(), true);
  const withoutUid = harness.clinicalStudyReference(session, bundle(session,{uid:null}), 'synthetic-study-a');
  assert.throws(() => harness.viewerStudyInput(session, withoutUid, volume), {code:'UNVERIFIED_VOLUME'});
});

test('sessions and references cannot cross tenants, patients, harnesses or expiry', async () => {
  let current = 1000;
  const harness = createSyntheticSmartHarness({now:()=>current});
  const a = await launch(harness), b = await launch(harness,{tenantKey:'synthetic-b'},{patient:'Patient/synthetic-person-b'});
  const ref = harness.clinicalStudyReference(a.session, bundle(a.session), 'synthetic-study-a');
  const sameTenantOtherPatient = await launch(harness, {}, {patient:'Patient/synthetic-person-b'});
  assert.throws(() => harness.clinicalStudyReference(sameTenantOtherPatient.session, bundle(a.session), 'synthetic-study-a'), {code:'SUBJECT_MISMATCH'});
  assert.throws(() => harness.viewerStudyInput(sameTenantOtherPatient.session, ref), {code:'INVALID_REFERENCE'});
  assert.throws(() => harness.viewerStudyInput(b.session, ref), {code:'INVALID_REFERENCE'});
  assert.throws(() => harness.clinicalStudyReference({...a.session}, bundle(a.session), 'synthetic-study-a'), {code:'INVALID_SESSION'});
  assert.throws(() => createSyntheticSmartHarness().viewerStudyInput(a.session, ref), {code:'INVALID_SESSION'});
  assert.equal(harness.closeSession(a.session), true);
  assert.throws(() => harness.viewerStudyInput(a.session, ref), {code:'INVALID_SESSION'});
  assert.equal(harness.clinicalStudyReference(b.session, bundle(b.session), 'synthetic-study-a').patientRef, 'Patient/synthetic-person-b');
  current += 300000;
  assert.throws(() => harness.clinicalStudyReference(b.session, bundle(b.session), 'synthetic-study-a'), {code:'EXPIRED_SESSION'});
});

test('expired, cancelled, concurrent and reset transactions cannot publish a session', async () => {
  let current = 1000;
  const harness = createSyntheticSmartHarness({now:()=>current});
  let request = await harness.begin(launchOptions), cb = harness.issueSyntheticCode(request.authorizationRequest);
  current += 300000;
  await assert.rejects(harness.complete(cb), {code:'EXPIRED_LAUNCH'});
  request = await harness.begin(launchOptions); cb = harness.issueSyntheticCode(request.authorizationRequest);
  const pending = harness.complete(cb);
  assert.equal(harness.cancelLaunch(cb.state), true);
  await assert.rejects(pending, {code:'CANCELLED'});
  request = await harness.begin(launchOptions); cb = harness.issueSyntheticCode(request.authorizationRequest);
  const first = harness.complete(cb);
  await assert.rejects(harness.complete(cb), {code:'INVALID_CALLBACK'});
  harness.clear();
  await assert.rejects(first, {code:'CANCELLED'});
  const {session} = await launch(harness);
  harness.clear();
  assert.throws(() => harness.clinicalStudyReference(session, bundle(session), 'synthetic-study-a'), {code:'INVALID_SESSION'});
});

test('pending launches are bounded and cancelling one restores capacity', async () => {
  const harness = createSyntheticSmartHarness(), requests = [];
  for (let i = 0; i < 16; i++) requests.push(await harness.begin(launchOptions));
  await assert.rejects(harness.begin(launchOptions), {code:'TOO_MANY_LAUNCHES'});
  const state = new URL(requests[0].authorizationRequest).searchParams.get('state');
  assert.equal(harness.cancelLaunch(state), true);
  assert.equal(harness.cancelLaunch(state), false);
  assert.equal((await harness.begin(launchOptions)).mode, 'synthetic-only');
});
