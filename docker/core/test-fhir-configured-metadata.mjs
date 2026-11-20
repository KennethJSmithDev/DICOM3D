import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createConfiguredFhirMetadataReader} from './fhir-configured-metadata.mjs';
import {MAX_CAPABILITY_BYTES} from '../../prototypes/alpha/viewer/src/fhir-capability-model.mjs';

const statement=version=>({resourceType:'CapabilityStatement',fhirVersion:version,kind:'instance',
  rest:[{mode:'server',resource:[{type:'ImagingStudy',interaction:[{code:'read'}]}]}]});
const options=(overrides={})=>({sources:[{id:'fixture',baseUrl:'https://fhir.example.invalid/r5',authorization:async()=> 'Bearer synthetic-secret'}],
  authorize:async({principal})=>principal==='allowed',...overrides});
const ok=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/fhir+json'}});

test('requires an explicit server-side authorization decision before any network read', async () => {
  let calls=0;
  const read=createConfiguredFhirMetadataReader(options({fetchImpl:async()=>{calls++;return ok(statement('5.0.0'));}}));
  await assert.rejects(read({sourceId:'fixture',principal:'denied'}), {code:'ACCESS_DENIED'});
  await assert.rejects(read({sourceId:'https://attacker.invalid/',principal:'allowed'}), {code:'SOURCE_UNAVAILABLE'});
  assert.equal(calls,0);
});

test('reads only configured R4/R4B/R5 metadata and never returns server credentials', async () => {
  for (const version of ['4.0.1','4.3.0','5.0.0']) {
    let calls=0;
    const read=createConfiguredFhirMetadataReader(options({fetchImpl:async(url,request)=>{
      calls++; assert.equal(url,'https://fhir.example.invalid/r5/metadata');
      assert.equal(request.method,'GET'); assert.equal(request.redirect,'error');
      assert.equal(request.credentials,'omit'); assert.equal(request.headers.Authorization,'Bearer synthetic-secret');
      return ok(statement(version));
    }}));
    const result=await read({sourceId:'fixture',principal:'allowed'});
    assert.equal(calls,1); assert.equal(result.capability.fhirVersion,version);
    assert.match(result.provenance.sha256,/^[a-f0-9]{64}$/);
    assert.doesNotMatch(JSON.stringify(result),/synthetic-secret|fhir\.example\.invalid/);
  }
});

test('allows large configured metadata without weakening source authorization', async () => {
  const large={...statement('4.3.0'),description:'x'.repeat(3*1024*1024)};
  let calls=0;
  const read=createConfiguredFhirMetadataReader(options({fetchImpl:async()=>{calls++;return ok(large);}}));
  await assert.rejects(read({sourceId:'fixture',principal:'denied'}),{code:'ACCESS_DENIED'});
  assert.equal(calls,0);
  const result=await read({sourceId:'fixture',principal:'allowed'});
  assert.equal(result.capability.fhirVersion,'4.3.0');
  assert.ok(result.provenance.bytes>2*1024*1024);
  assert.equal(calls,1);
});

test('rejects invalid URLs, embedded credentials, duplicates and untrusted cleartext hosts', () => {
  for (const baseUrl of ['http://remote.invalid/fhir','https://user:secret@example.invalid/','https://fhir.example.invalid/?x=1','file:///tmp/fhir'])
    assert.throws(()=>createConfiguredFhirMetadataReader(options({sources:[{id:'a',baseUrl}]})),{code:'INVALID_CONFIGURATION'});
  assert.throws(()=>createConfiguredFhirMetadataReader(options({sources:[{id:'same',baseUrl:'http://127.0.0.1:1234'},{id:'same',baseUrl:'http://127.0.0.1:1234'}]})),{code:'INVALID_CONFIGURATION'});
  assert.doesNotThrow(()=>createConfiguredFhirMetadataReader(options({sources:[{id:'local',baseUrl:'http://127.0.0.1:1234/fhir'}]})));
});

test('does not invoke credential providers or fetch for cleartext loopback sources', () => {
  let credentials=0, calls=0;
  const source={id:'local',baseUrl:'http://127.0.0.1:1234/fhir',authorization:async()=>{credentials++;return 'Bearer synthetic';}};
  assert.throws(()=>createConfiguredFhirMetadataReader(options({sources:[source],fetchImpl:async()=>{calls++;}})),{code:'UPSTREAM_SECURE_TRANSPORT_REQUIRED'});
  assert.equal(credentials,0);assert.equal(calls,0);
});

test('does not request or forward credentials when TLS verification is disabled', async () => {
  const previous=process.env.NODE_TLS_REJECT_UNAUTHORIZED;let credentials=0,calls=0;
  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
    const source={id:'fixture',baseUrl:'https://fhir.example.invalid',authorization:async()=>{credentials++;return 'Bearer synthetic';}};
    const read=createConfiguredFhirMetadataReader(options({sources:[source],fetchImpl:async()=>{calls++;return ok(statement('5.0.0'));}}));
    await assert.rejects(read({sourceId:'fixture',principal:'allowed'}),{code:'UPSTREAM_SECURE_TRANSPORT_REQUIRED'});
    assert.equal(credentials,0);assert.equal(calls,0);
  } finally {
    if(previous===undefined)delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;else process.env.NODE_TLS_REJECT_UNAUTHORIZED=previous;
  }
});

test('fails closed for upstream denial, invalid response, oversized body and redirects', async () => {
  const run=fetchImpl=>createConfiguredFhirMetadataReader(options({fetchImpl}))({sourceId:'fixture',principal:'allowed'});
  await assert.rejects(run(async()=>new Response('',{status:401})),{code:'UPSTREAM_ACCESS_DENIED'});
  await assert.rejects(run(async()=>new Response('',{status:302})),{code:'UPSTREAM_UNAVAILABLE'});
  await assert.rejects(run(async()=>new Response('not json',{headers:{'Content-Type':'text/plain'}})),{code:'UNSUPPORTED_RESPONSE'});
  await assert.rejects(run(async()=>new Response('{',{headers:{'Content-Type':'application/json'}})),{code:'UNSUPPORTED_RESPONSE'});
  await assert.rejects(run(async()=>new Response(new Uint8Array(MAX_CAPABILITY_BYTES+1),{headers:{'Content-Type':'application/json'}})),{code:'RESPONSE_TOO_LARGE'});
});

test('returns bounded timeout and cancellation even if an upstream dependency hangs', async () => {
  const read=createConfiguredFhirMetadataReader(options({timeoutMs:30,fetchImpl:async()=>new Promise(()=>{})}));
  await assert.rejects(read({sourceId:'fixture',principal:'allowed'}),{code:'TIMEOUT'});
  const abort=new AbortController(); abort.abort();
  await assert.rejects(read({sourceId:'fixture',principal:'allowed',signal:abort.signal}),{code:'CANCELLED'});
  const stuckAuthorization=createConfiguredFhirMetadataReader(options({timeoutMs:30,authorize:async()=>new Promise(()=>{})}));
  await assert.rejects(stuckAuthorization({sourceId:'fixture',principal:'allowed'}),{code:'TIMEOUT'});
});

test('redacts upstream failures and rejects invalid authorization headers', async () => {
  const denied=createConfiguredFhirMetadataReader(options({sources:[{id:'fixture',baseUrl:'https://fhir.example.invalid',authorization:async()=>{throw Error('secret-in-error');}}]}));
  await assert.rejects(denied({sourceId:'fixture',principal:'allowed'}), error=>error.code==='UPSTREAM_AUTH_UNAVAILABLE' && !error.message.includes('secret-in-error'));
  const bad=createConfiguredFhirMetadataReader(options({sources:[{id:'fixture',baseUrl:'https://fhir.example.invalid',authorization:async()=> 'Bearer bad\r\nInjected: yes'}]}));
  await assert.rejects(bad({sourceId:'fixture',principal:'allowed'}), {code:'UPSTREAM_AUTH_UNAVAILABLE'});
  const unavailable=createConfiguredFhirMetadataReader(options({fetchImpl:async()=>{throw Error('secret-in-network-error');}}));
  await assert.rejects(unavailable({sourceId:'fixture',principal:'allowed'}), error=>error.code==='UPSTREAM_UNAVAILABLE' && !error.message.includes('secret-in-network-error'));
});

test('times out stalled credential providers and response streams', async () => {
  const stalledCredential=createConfiguredFhirMetadataReader(options({timeoutMs:30,sources:[{id:'fixture',baseUrl:'https://fhir.example.invalid',authorization:async()=>new Promise(()=>{})}]}));
  await assert.rejects(stalledCredential({sourceId:'fixture',principal:'allowed'}),{code:'TIMEOUT'});
  const stalledBody=new Response(new ReadableStream({pull:()=>new Promise(()=>{})}),{headers:{'Content-Type':'application/json'}});
  const stalledRead=createConfiguredFhirMetadataReader(options({timeoutMs:30,fetchImpl:async()=>stalledBody}));
  await assert.rejects(stalledRead({sourceId:'fixture',principal:'allowed'}),{code:'TIMEOUT'});
});
