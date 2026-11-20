import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createConfiguredFhirImagingStudyReader} from './fhir-configured-metadata.mjs';

const study=(id='synthetic-1')=>({resourceType:'ImagingStudy',id,status:'available',subject:{reference:'Patient/synthetic'}});
const response=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/fhir+json'}});
const options=(overrides={})=>({sources:[{id:'fixture',baseUrl:'https://fhir.example.invalid/r5',fhirVersion:'5.0.0',imagingStudyIds:['synthetic-1'],authorization:async()=> 'Bearer synthetic-secret'}],
  authorize:async({principal,resourceType,resourceId})=>principal==='allowed' && resourceType==='ImagingStudy' && resourceId==='synthetic-1',...overrides});

test('authorizes each exact configured ImagingStudy before credentials or network', async()=>{
  let calls=0,credentials=0;
  const config=options({sources:[{id:'fixture',baseUrl:'https://fhir.example.invalid/r5',fhirVersion:'5.0.0',imagingStudyIds:['synthetic-1'],authorization:async()=>{credentials++;return 'Bearer synthetic-secret';}}],
    fetchImpl:async()=>{calls++;return response(study());}});
  const read=createConfiguredFhirImagingStudyReader(config);
  await assert.rejects(read({sourceId:'fixture',studyId:'synthetic-1',principal:'denied'}),{code:'ACCESS_DENIED'});
  await assert.rejects(read({sourceId:'fixture',studyId:'../other',principal:'allowed'}),{code:'ACCESS_DENIED'});
  assert.equal(calls,0);assert.equal(credentials,0);
});

for(const version of ['4.0.1','4.3.0','5.0.0'])test(`reads an allowlisted ${version} ImagingStudy without exposing credentials`,async()=>{
  let calls=0;
  const read=createConfiguredFhirImagingStudyReader(options({sources:[{id:'fixture',baseUrl:'https://fhir.example.invalid/fhir',fhirVersion:version,imagingStudyIds:['synthetic-1'],authorization:async()=> 'Bearer synthetic-secret'}],
    fetchImpl:async(url,request)=>{calls++;assert.equal(url,'https://fhir.example.invalid/fhir/ImagingStudy/synthetic-1');assert.equal(request.method,'GET');assert.equal(request.redirect,'error');assert.equal(request.credentials,'omit');return response(study());}}));
  const actual=await read({sourceId:'fixture',studyId:'synthetic-1',principal:'allowed'});
  assert.equal(calls,1);assert.equal(actual.configuredFhirVersion,version);assert.deepEqual(actual.resource,study());
  assert.equal(JSON.stringify(actual).includes('synthetic-secret'),false);
  assert.match(actual.provenance.sha256,/^[a-f0-9]{64}$/);
});

test('refuses unconfigured studies and malformed source configuration',async()=>{
  let calls=0;
  const read=createConfiguredFhirImagingStudyReader(options({authorize:async()=>true,fetchImpl:async()=>{calls++;return response(study());}}));
  for(const studyId of ['other','../other','a%2Fb','',null])await assert.rejects(read({sourceId:'fixture',studyId,principal:'allowed'}),{code:'SOURCE_UNAVAILABLE'});
  assert.equal(calls,0);
  for(const source of [
    {id:'x',baseUrl:'https://fhir.example.invalid',fhirVersion:'4.2.0',imagingStudyIds:['a']},
    {id:'x',baseUrl:'https://fhir.example.invalid',fhirVersion:'5.0.0',imagingStudyIds:[]},
    {id:'x',baseUrl:'https://fhir.example.invalid',fhirVersion:'5.0.0',imagingStudyIds:['a','a']},
    {id:'x',baseUrl:'http://remote.invalid/fhir',fhirVersion:'5.0.0',imagingStudyIds:['a']}
  ])assert.throws(()=>createConfiguredFhirImagingStudyReader(options({sources:[source]})),{code:'INVALID_CONFIGURATION'});
});

test('refuses upstream denial, redirects, oversized or wrong-identity content',async()=>{
  const run=fetchImpl=>createConfiguredFhirImagingStudyReader(options({fetchImpl}))({sourceId:'fixture',studyId:'synthetic-1',principal:'allowed'});
  await assert.rejects(run(async()=>new Response('',{status:403})),{code:'UPSTREAM_ACCESS_DENIED'});
  await assert.rejects(run(async()=>new Response('',{status:302})),{code:'UPSTREAM_UNAVAILABLE'});
  await assert.rejects(run(async()=>new Response(new Uint8Array(2*1024*1024+1),{headers:{'Content-Type':'application/json'}})),{code:'RESPONSE_TOO_LARGE'});
  await assert.rejects(run(async()=>response({resourceType:'Patient',id:'synthetic-1'})),{code:'UNSUPPORTED_RESPONSE'});
  await assert.rejects(run(async()=>response(study('another'))),{code:'UNSUPPORTED_RESPONSE'});
  await assert.rejects(run(async()=>new Response('{',{headers:{'Content-Type':'application/json'}})),{code:'UNSUPPORTED_RESPONSE'});
});

test('keeps concurrent requests and cancellation independent',async()=>{
  const config=options({sources:[{id:'fixture',baseUrl:'https://fhir.example.invalid/fhir',fhirVersion:'5.0.0',imagingStudyIds:['one','two']}],
    authorize:async()=>true,fetchImpl:async url=>response(study(url.endsWith('/one')?'one':'two'))});
  const read=createConfiguredFhirImagingStudyReader(config), abort=new AbortController();
  abort.abort();
  const [one,two]=await Promise.all([read({sourceId:'fixture',studyId:'one'}),read({sourceId:'fixture',studyId:'two'})]);
  assert.equal(one.resource.id,'one');assert.equal(two.resource.id,'two');
  await assert.rejects(read({sourceId:'fixture',studyId:'one',signal:abort.signal}),{code:'CANCELLED'});
});
