import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SYNTHETIC_PENDING_KEY,SYNTHETIC_SESSION_KEY,prepareSyntheticRedirect,resumeSyntheticRedirect,
  restoreSyntheticViewerSession,clearSyntheticViewerSession} from '../viewer/src/smart-synthetic-redirect.mjs';

class Storage {
  items = new Map();
  getItem(key) { return this.items.has(key) ? this.items.get(key) : null; }
  setItem(key,value) { this.items.set(key,String(value)); }
  removeItem(key) { this.items.delete(key); }
}
function history() { return {state:{unchanged:true},replaced:null,replaceState(state,_title,url){this.state=state;this.replaced=url;}}; }
const pageUrl = 'http://127.0.0.1:57980/dicom3d/?renderer=webgl#imaging';
const options = {tenantKey:'synthetic-a',persona:'patient',launchKind:'ehr',fhirVersion:'4.0.1'};

test('a synthetic transaction survives navigation, cleans its callback and restores the session after reload', async () => {
  const storage=new Storage(), hist=history(); storage.setItem('unrelated','keep');
  const start=await prepareSyntheticRedirect({storage,pageUrl,options});
  const url=new URL(start.url), pending=JSON.parse(storage.getItem(SYNTHETIC_PENDING_KEY));
  assert.equal(url.origin,'http://127.0.0.1:57980');
  assert.equal(pending.redirectUri,'http://127.0.0.1:57980/dicom3d/');
  assert.equal(pending.persona,'patient');
  assert.equal(url.searchParams.get('renderer'),'webgl');
  assert.equal(url.hash,'#imaging');
  assert.equal(url.href.includes('Patient/'),false);
  const result=await resumeSyntheticRedirect({storage,pageUrl:start.url,history:hist});
  assert.equal(result.session.mode,'synthetic-only');
  assert.equal(result.session.patientRef,'Patient/synthetic-person-a');
  assert.equal(storage.getItem(SYNTHETIC_PENDING_KEY),null);
  assert.ok(storage.getItem(SYNTHETIC_SESSION_KEY));
  assert.equal(hist.replaced,pageUrl);
  assert.deepEqual(hist.state,{unchanged:true});
  const restored=restoreSyntheticViewerSession({storage,pageUrl:hist.replaced});
  assert.equal(restored.session.persona,'patient');
  assert.equal(restored.session.fhirVersion,'4.0.1');
  assert.equal(storage.getItem('unrelated'),'keep');
  clearSyntheticViewerSession(storage);
  assert.equal(storage.getItem(SYNTHETIC_SESSION_KEY),null);
  assert.equal(storage.getItem('unrelated'),'keep');
});

test('patient and clinician redirects work for all three source versions and both launch styles', async () => {
  for (const fhirVersion of ['4.0.1','4.3.0','5.0.0']) for (const persona of ['patient','clinician']) for (const launchKind of ['ehr','standalone']) {
    const storage=new Storage(), hist=history();
    const start=await prepareSyntheticRedirect({storage,pageUrl,options:{...options,persona,launchKind,fhirVersion}});
    const result=await resumeSyntheticRedirect({storage,pageUrl:start.url,history:hist});
    assert.equal(result.session.fhirVersion,fhirVersion);
    assert.equal(result.session.persona,persona);
    assert.equal(result.session.launchKind,launchKind);
  }
});

test('callback replay, wrong state, issuer, code and duplicate parameters fail and are removed', async () => {
  for (const mutate of [
    url=>url.searchParams.set('d3synthetic_state','wrong'),
    url=>url.searchParams.set('d3synthetic_issuer','https://b.auth.synthetic.invalid'),
    url=>url.searchParams.set('d3synthetic_code','wrong'),
    url=>url.searchParams.append('d3synthetic_state','duplicate'),
  ]) {
    const storage=new Storage(), hist=history(), start=await prepareSyntheticRedirect({storage,pageUrl,options});
    const callback=new URL(start.url);mutate(callback);
    await assert.rejects(resumeSyntheticRedirect({storage,pageUrl:callback.href,history:hist}));
    assert.equal(storage.getItem(SYNTHETIC_PENDING_KEY),null);
    assert.equal(storage.getItem(SYNTHETIC_SESSION_KEY),null);
    assert.equal(new URL(hist.replaced).searchParams.has('d3synthetic_state'),false);
  }
  const storage=new Storage(), hist=history(), start=await prepareSyntheticRedirect({storage,pageUrl,options});
  await resumeSyntheticRedirect({storage,pageUrl:start.url,history:hist});
  await assert.rejects(resumeSyntheticRedirect({storage,pageUrl:start.url,history:hist}),{code:'INVALID_CALLBACK'});
  assert.equal(storage.getItem(SYNTHETIC_SESSION_KEY),null);
});

test('tampered verifier, changed tenant, altered path and non-synthetic subjects fail closed', async () => {
  for (const mutate of [
    item=>{item.verifier='A'.repeat(43);},
    item=>{item.tenantKey='synthetic-b';},
    item=>{item.patientRef='Patient/real-person';},
    item=>{item.redirectUri='http://127.0.0.1:57980/other/';},
    item=>{item.grantedScopes.push('user/*.cruds');},
  ]) {
    const storage=new Storage(), start=await prepareSyntheticRedirect({storage,pageUrl,options}), item=JSON.parse(storage.getItem(SYNTHETIC_PENDING_KEY));
    mutate(item);storage.setItem(SYNTHETIC_PENDING_KEY,JSON.stringify(item));
    await assert.rejects(resumeSyntheticRedirect({storage,pageUrl:start.url,history:history()}));
    assert.equal(storage.getItem(SYNTHETIC_PENDING_KEY),null);
    assert.equal(storage.getItem(SYNTHETIC_SESSION_KEY),null);
  }
});

test('expired, malformed, unavailable and different-tab state cannot create a session', async () => {
  let clock=1000; const now=()=>clock, storage=new Storage(), start=await prepareSyntheticRedirect({storage,pageUrl,options,now});
  clock+=300000;
  await assert.rejects(resumeSyntheticRedirect({storage,pageUrl:start.url,history:history(),now}));
  assert.equal(storage.getItem(SYNTHETIC_PENDING_KEY),null);
  clock=1000;
  const next=await prepareSyntheticRedirect({storage,pageUrl,options,now});
  await assert.rejects(resumeSyntheticRedirect({storage:new Storage(),pageUrl:next.url,history:history(),now}),{code:'INVALID_CALLBACK'});
  storage.setItem(SYNTHETIC_PENDING_KEY,'{');
  await assert.rejects(resumeSyntheticRedirect({storage,pageUrl:next.url,history:history(),now}),{code:'INVALID_CHECKPOINT'});
  const unavailable={setItem(){throw Error('disabled');},removeItem(){throw Error('disabled');}};
  await assert.rejects(prepareSyntheticRedirect({storage:unavailable,pageUrl,options,now}),{code:'STORAGE_UNAVAILABLE'});
});

test('stored sessions are scoped to the viewer path and expire without retaining a usable session', async () => {
  let clock=1000;const now=()=>clock,storage=new Storage(),hist=history();
  const start=await prepareSyntheticRedirect({storage,pageUrl,options,now});
  await resumeSyntheticRedirect({storage,pageUrl:start.url,history:hist,now});
  assert.throws(()=>restoreSyntheticViewerSession({storage,pageUrl:'http://127.0.0.1:57980/other/',now}),{code:'INVALID_SESSION'});
  assert.equal(storage.getItem(SYNTHETIC_SESSION_KEY),null);
  const again=await prepareSyntheticRedirect({storage,pageUrl,options,now});
  await resumeSyntheticRedirect({storage,pageUrl:again.url,history:hist,now});
  clock+=300000;
  assert.throws(()=>restoreSyntheticViewerSession({storage,pageUrl,now}),{code:'INVALID_SESSION'});
  assert.equal(storage.getItem(SYNTHETIC_SESSION_KEY),null);
});

test('preparation rejects nonlocal insecure callback URLs and never makes a network request', async () => {
  let calls=0;const original=globalThis.fetch;
  globalThis.fetch=()=>{calls++;throw Error('network');};
  try {
    await assert.rejects(prepareSyntheticRedirect({storage:new Storage(),pageUrl:'http://real.example.org/',options}),{code:'INVALID_REDIRECT'});
    const storage=new Storage(), start=await prepareSyntheticRedirect({storage,pageUrl,options});
    await resumeSyntheticRedirect({storage,pageUrl:start.url,history:history()});
    assert.equal(calls,0);
  } finally {globalThis.fetch=original;}
});
