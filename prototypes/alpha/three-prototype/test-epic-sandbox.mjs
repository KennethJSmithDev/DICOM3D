import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {discoverEpicSandbox,prepareEpicSandboxLaunch,finishEpicSandboxCallback,searchEpicSandboxStudies,closeEpicSandboxSession,EPIC_SANDBOX_FHIR} from '../viewer/src/epic-sandbox.mjs';
import {captureEpicSandboxCallback,EPIC_SANDBOX_PENDING_KEY,EPIC_SANDBOX_REDIRECT} from '../viewer/src/epic-sandbox-callback.mjs';

const ISSUER='https://fhir.epic.com/interconnect-fhir-oauth/oauth2';
const CONFIG={issuer:ISSUER,authorization_endpoint:`${ISSUER}/authorize`,token_endpoint:`${ISSUER}/token`,
  code_challenge_methods_supported:['S256'],capabilities:['launch-standalone','client-public']};
const json=(value,type='application/json')=>new Response(JSON.stringify(value),{headers:{'content-type':type}});
class Storage{map=new Map();getItem(k){return this.map.get(k)??null}setItem(k,v){this.map.set(k,String(v))}removeItem(k){this.map.delete(k)}}
const history=()=>({state:{keep:true},url:null,replaceState(s,_t,u){this.state=s;this.url=u}});
const pageUrl=`${EPIC_SANDBOX_REDIRECT}?renderer=webgl#imaging`;
const configFetch=async()=>json(CONFIG);
const token={access_token:'synthetic-access-token',token_type:'Bearer',expires_in:300,scope:'patient/ImagingStudy.rs',patient:'synthetic-person'};
const study=(subject='Patient/synthetic-person')=>({resourceType:'ImagingStudy',id:'synthetic-study',status:'available',subject:{reference:subject}});
const bundle=(resource=study())=>({resourceType:'Bundle',type:'searchset',entry:[{fullUrl:`${EPIC_SANDBOX_FHIR}/ImagingStudy/${resource.id}`,resource}]});

async function launch({storage=new Storage(),now=()=>1000,fetchImpl=configFetch}={}){
  const start=await prepareEpicSandboxLaunch({clientId:'synthetic-client-id',pageUrl,storage,fetchImpl,now});
  const authorization=new URL(start.authorizationUrl),callback=new URL(EPIC_SANDBOX_REDIRECT);
  callback.searchParams.set('code','synthetic-code');callback.searchParams.set('state',authorization.searchParams.get('state'));
  const hist=history(),captured=captureEpicSandboxCallback({pageUrl:callback.href,history:hist,getStorage:()=>storage});
  return {start,authorization,callback,captured,storage,hist,now};
}
async function session(options={}){
  const start=await launch(options);
  const result=await finishEpicSandboxCallback(start.captured,{now:start.now,fetchImpl:async(_url,req)=>{
    assert.equal(req.method,'POST');assert.equal(req.redirect,'error');assert.equal(req.credentials,'omit');
    assert.equal(req.body.get('code'),'synthetic-code');assert.equal(req.body.get('grant_type'),'authorization_code');
    assert.equal(req.body.get('client_id'),'synthetic-client-id');assert.equal(req.body.get('redirect_uri'),EPIC_SANDBOX_REDIRECT);
    assert.equal(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(req.body.get('code_verifier'))).then(x=>Buffer.from(x).toString('base64url')),start.authorization.searchParams.get('code_challenge'));
    return json(token);
  }});
  return {...start,session:result};
}

test('viewer entry prevents referring authorization callback URLs to other requests', async()=>{
  const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
  assert.match(html,/<meta name="referrer" content="no-referrer">/);
});

test('discovery admits only the pinned sandbox issuer, endpoints, public client and S256',async()=>{
  let requests=0;
  const result=await discoverEpicSandbox({fetchImpl:async(url,options)=>{requests++;assert.equal(url,`${EPIC_SANDBOX_FHIR}/.well-known/smart-configuration`);
    assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');return json(CONFIG)}});
  assert.equal(result.fhirVersion,'4.0.1');assert.equal(requests,1);
  for(const bad of [{...CONFIG,issuer:'https://other.example/issuer'}, {...CONFIG,authorization_endpoint:'https://example.org/authorize'},
    {...CONFIG,token_endpoint:'https://example.org/token'},{...CONFIG,code_challenge_methods_supported:['plain']},
    {...CONFIG,capabilities:['client-public']}])await assert.rejects(discoverEpicSandbox({fetchImpl:async()=>json(bad)}),{code:'UNSUPPORTED_SANDBOX'});
});

test('standalone authorization uses exact sandbox audience, registered redirect, scoped state and PKCE',async()=>{
  const started=await launch();const params=started.authorization.searchParams;
  assert.equal(started.authorization.origin,'https://fhir.epic.com');
  assert.equal(params.get('response_type'),'code');assert.equal(params.get('aud'),EPIC_SANDBOX_FHIR);
  assert.equal(params.get('redirect_uri'),EPIC_SANDBOX_REDIRECT);assert.equal(params.get('code_challenge_method'),'S256');
  assert.equal(params.get('scope'),'launch/patient patient/ImagingStudy.rs');assert.equal(params.has('launch'),false);
  assert.match(params.get('state'),/^d3epic_[A-Za-z0-9_-]{43}$/);
  assert.equal(params.has('code_verifier'),false);assert.equal(params.has('client_secret'),false);
  assert.equal(started.storage.getItem(EPIC_SANDBOX_PENDING_KEY),null);
  assert.equal(new URL(started.hist.url).searchParams.has('code'),false);
  assert.equal(new URL(started.hist.url).searchParams.has('state'),false);
  assert.equal(new URL(started.hist.url).searchParams.get('renderer'),'webgl');
});

test('the same in-memory callback cannot be exchanged twice concurrently',async()=>{
  const started=await launch();let calls=0;
  const fetchImpl=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));return json(token)};
  const first=finishEpicSandboxCallback(started.captured,{now:()=>1000,fetchImpl});
  await assert.rejects(finishEpicSandboxCallback(started.captured,{now:()=>1000,fetchImpl}),{code:'INVALID_CALLBACK'});
  const s=await first;assert.equal(calls,1);closeEpicSandboxSession(s);
});

test('callback exchange creates a memory-only session and returns only scoped study metadata',async()=>{
  const {session:s,storage}=await session();assert.equal(s.mode,'epic-sandbox');assert.equal(s.hasPatient,true);assert.equal(s.canSearch,true);
  assert.equal(JSON.stringify(s).includes('synthetic-access-token'),false);
  assert.equal(JSON.stringify([...storage.map.values()]).includes('synthetic-access-token'),false);
  const result=await searchEpicSandboxStudies(s,{now:()=>1000,fetchImpl:async(url,options)=>{
    const parsed=new URL(url);assert.equal(parsed.origin,'https://fhir.epic.com');assert.equal(parsed.pathname,'/interconnect-fhir-oauth/api/FHIR/R4/ImagingStudy');
    assert.equal(parsed.searchParams.get('patient'),'synthetic-person');assert.equal(options.headers.Authorization,'Bearer synthetic-access-token');
    assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');return json(bundle(),'application/fhir+json');
  }});
  assert.deepEqual(result.studies,[{reference:'ImagingStudy/synthetic-study',status:'available'}]);
  assert.equal(JSON.stringify(result).includes('synthetic-access-token'),false);
  assert.equal(JSON.stringify(result).includes('synthetic-person'),false);
  assert.equal(closeEpicSandboxSession(s),true);
  await assert.rejects(searchEpicSandboxStudies(s,{now:()=>1000,fetchImpl:async()=>json(bundle())}),{code:'INVALID_SESSION'});
});

test('bad callback state, duplicates, issuer, redirect, expiry and replay cannot exchange a code',async()=>{
  for(const mutate of [
    c=>{c.state='d3epic_wrong';},c=>{c.issuer='https://other.example/oauth2';},
    c=>{c.redirectUri='http://127.0.0.1:57980/other/';},c=>{c.invalid=true;},c=>{c.pending='{}';},
  ]){
    const started=await launch();mutate(started.captured);let calls=0;
    await assert.rejects(finishEpicSandboxCallback(started.captured,{now:()=>1000,fetchImpl:async()=>{calls++;return json(token)}}));
    assert.equal(calls,0);
  }
  const expired=await launch();await assert.rejects(finishEpicSandboxCallback(expired.captured,{now:()=>301000,fetchImpl:async()=>json(token)}),{code:'INVALID_CALLBACK'});
  const duplicated=await launch();duplicated.callback.searchParams.append('code','second');
  // The original has already been consumed; tagged replay is scrubbed without a pending grant.
  const replay=captureEpicSandboxCallback({pageUrl:duplicated.callback.href,history:history(),getStorage:()=>duplicated.storage});
  assert.equal(replay.invalid,true);assert.equal(replay.pending,null);
  await assert.rejects(finishEpicSandboxCallback(replay,{now:()=>1000,fetchImpl:async()=>json(token)}));
});

test('unrelated OAuth URLs are not consumed; tagged malformed and denied responses are sanitized',async()=>{
  const storage=new Storage(),hist=history();
  assert.equal(captureEpicSandboxCallback({pageUrl:`${EPIC_SANDBOX_REDIRECT}?code=other&state=other`,history:hist,getStorage:()=>storage}),null);
  assert.equal(hist.url,null);
  const started=await launch();
  const denied=new URL(EPIC_SANDBOX_REDIRECT);denied.searchParams.set('error','access_denied');denied.searchParams.set('state',started.authorization.searchParams.get('state'));
  started.storage.setItem(EPIC_SANDBOX_PENDING_KEY,started.captured.pending);
  const captured=captureEpicSandboxCallback({pageUrl:denied.href,history:hist,getStorage:()=>started.storage});
  assert.equal(new URL(hist.url).searchParams.has('error'),false);
  await assert.rejects(finishEpicSandboxCallback(captured,{now:()=>1000,fetchImpl:async()=>json(token)}),{code:'ACCESS_DENIED'});
});

test('invalid origin, client, storage and configuration fail before authorization',async()=>{
  const storage=new Storage();let calls=0;const fetchImpl=async()=>{calls++;return json(CONFIG)};
  await assert.rejects(prepareEpicSandboxLaunch({clientId:'id',pageUrl:'https://real.example/',storage,fetchImpl}),{code:'INVALID_REDIRECT'});
  await assert.rejects(prepareEpicSandboxLaunch({clientId:'secret:bad',pageUrl,storage,fetchImpl}),{code:'INVALID_CLIENT_ID'});
  assert.equal(calls,0);
  const noStorage={setItem(){throw Error('denied')}};
  await assert.rejects(prepareEpicSandboxLaunch({clientId:'id',pageUrl,storage:noStorage,fetchImpl}),{code:'STORAGE_UNAVAILABLE'});
});

test('missing patient or patient-scoped search permission blocks study requests',async()=>{
  for(const changed of [{...token,patient:undefined},{...token,scope:'user/ImagingStudy.rs'}]){
    const started=await launch(),s=await finishEpicSandboxCallback(started.captured,{now:()=>1000,fetchImpl:async()=>json(changed)});let calls=0;
    await assert.rejects(searchEpicSandboxStudies(s,{now:()=>1000,fetchImpl:async()=>{calls++;return json(bundle())}}));
    assert.equal(calls,0);
  }
});

test('mismatched patient, foreign source, duplicate identities and malformed bundles fail closed',async()=>{
  for(const bad of [bundle(study('Patient/synthetic-other')),
    {...bundle(),entry:[{fullUrl:'https://other.invalid/ImagingStudy/synthetic-study',resource:study()}]},
    {...bundle(),entry:[...bundle().entry,...bundle().entry]},
    {resourceType:'Bundle',type:'collection',entry:[]},
  ]){
    const {session:s}=await session();
    await assert.rejects(searchEpicSandboxStudies(s,{now:()=>1000,fetchImpl:async()=>json(bad,'application/fhir+json')}));
  }
});

test('denial, malformed token, oversized responses and expired sessions do not expose token data',async()=>{
  const started=await launch();
  await assert.rejects(finishEpicSandboxCallback(started.captured,{now:()=>1000,fetchImpl:async()=>new Response('',{status:403})}),{code:'ACCESS_DENIED'});
  const next=await launch();await assert.rejects(finishEpicSandboxCallback(next.captured,{now:()=>1000,fetchImpl:async()=>json({...token,token_type:'invalid'})}),{code:'INVALID_TOKEN'});
  await assert.rejects(discoverEpicSandbox({fetchImpl:async()=>new Response(new Uint8Array(65537),{headers:{'content-type':'application/json'}})}),{code:'RESPONSE_TOO_LARGE'});
  const {session:s}=await session();await assert.rejects(searchEpicSandboxStudies(s,{now:()=>301000,fetchImpl:async()=>json(bundle())}),{code:'EXPIRED_SESSION'});
});

test('cancelled or closed in-flight searches cannot publish stale results',async()=>{
  const {session:s}=await session();let resolve;
  const pending=searchEpicSandboxStudies(s,{now:()=>1000,fetchImpl:()=>new Promise(r=>{resolve=r})});
  closeEpicSandboxSession(s);resolve(json(bundle(),'application/fhir+json'));
  await assert.rejects(pending,{code:'INVALID_SESSION'});
  const other=await session(),controller=new AbortController();controller.abort();
  await assert.rejects(searchEpicSandboxStudies(other.session,{now:()=>1000,signal:controller.signal,fetchImpl:async()=>json(bundle())}),{code:'CANCELLED'});
});
