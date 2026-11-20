import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {compareOpenCtIdentity,readLiveFhirStudy} from './src/imaging/fhir-live-viewer.mjs';

const input={sourceId:'iris',studyId:'study-1',username:'reader',password:'synthetic-secret',appBase:'./',pageUrl:'http://127.0.0.1:57980/dicom3d/#imaging'};
const resource=()=>({resourceType:'ImagingStudy',id:'study-1',status:'available',identifier:[{system:'urn:dicom:uid',value:'urn:oid:1.2.3'}],
  series:[{uid:'1.2.4',instance:[{uid:'1.2.5'},{uid:'1.2.6'}]}]});
const openStudy=()=>({manifest:{source:{source_study_uid:'1.2.3',ct_series_uid:'1.2.4'}},ctReceipt:{slice_mapping:[{sop_uid:'1.2.5'},{sop_uid:'1.2.6'}]}});
const response=payload=>{const text=JSON.stringify(payload);return new Response(text,{headers:{'content-type':'application/json','content-length':String(Buffer.byteLength(text))}})};

for(const version of ['4.0.1','4.3.0','5.0.0'])test(`projects live ${version} study metadata without persistence`,async()=>{
  let calls=0;const result=await readLiveFhirStudy({...input,fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'http://127.0.0.1:57980/dicom3d/_interop/fhir/iris/ImagingStudy/study-1');
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
    assert.equal(options.headers['X-DICOM3D-Request'],'fhir-read-v1');assert.equal(options.headers.Authorization,'Basic '+Buffer.from('reader:synthetic-secret').toString('base64'));
    return response({sourceId:'iris',fhirVersion:version,resource:resource(),provenance:{}});
  }});
  assert.equal(calls,1);assert.equal(result.version,version);assert.equal(result.projection.resources[0].key,'ImagingStudy/study-1');
  assert.doesNotMatch(JSON.stringify(result),/synthetic-secret|Basic /);
});

test('compares complete study, series and instance identities without inferring registration',()=>{
  const expected=openStudy(), found=resource();
  assert.equal(compareOpenCtIdentity(found,null),'NO_OPEN_CT');
  assert.equal(compareOpenCtIdentity(found,expected),'MATCHED_IDENTITIES');
  assert.equal(compareOpenCtIdentity({...found,status:'entered-in-error'},expected),'NOT_MATCHED');
  assert.equal(compareOpenCtIdentity({...found,identifier:[{system:'urn:dicom:uid',value:'urn:oid:9.9'}]},expected),'NOT_MATCHED');
  assert.equal(compareOpenCtIdentity({...found,series:[{uid:'1.2.4',instance:[{uid:'1.2.5'},{uid:'1.2.5'}]}]},expected),'NOT_MATCHED');
  assert.equal(compareOpenCtIdentity({...found,series:[{uid:'1.2.4',instance:[{uid:'1.2.5'}]}]},expected),'NOT_MATCHED');
  assert.equal(compareOpenCtIdentity({...found,series:[{uid:'1.2.4',instance:[null,{uid:'1.2.6'}]}]},expected),'NOT_MATCHED');
  assert.equal(compareOpenCtIdentity(found,{...expected,ctReceipt:{slice_mapping:[null]}}),'NOT_MATCHED');
  assert.equal(compareOpenCtIdentity({...found,series:{}},expected),'NOT_MATCHED');
});

test('does not transmit credentials from unsupported hosts or for invalid inputs',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return response({});};
  for(const patch of [{pageUrl:'https://example.invalid/dicomd/'},{pageUrl:'http://localhost:57980/dicomd/'},
    {appBase:'https://remote.invalid/dicomd/'},{studyId:'../Patient/one'},{username:'x:y'},{password:'é'}])
    await assert.rejects(readLiveFhirStudy({...input,...patch,fetchImpl}));
  assert.equal(calls,0);
});

test('rejects denied, malformed, unbounded and cancelled responses',async()=>{
  const run=fetchImpl=>readLiveFhirStudy({...input,fetchImpl});
  await assert.rejects(run(async()=>new Response('',{status:403})),{code:'ACCESS_DENIED'});
  await assert.rejects(run(async()=>new Response('',{status:503})),{code:'SOURCE_UNAVAILABLE'});
  await assert.rejects(run(async()=>new Response('',{status:426})),{code:'UPSTREAM_SECURE_TRANSPORT_REQUIRED'});
  await assert.rejects(run(async()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'99999999'}})),{code:'INVALID_RESPONSE'});
  await assert.rejects(run(async()=>response({sourceId:'other',fhirVersion:'5.0.0',resource:resource()})),{code:'INVALID_RESPONSE'});
  const abort=new AbortController();abort.abort();await assert.rejects(readLiveFhirStudy({...input,signal:abort.signal}),{code:'CANCELLED'});
});

test('application favicon is the existing branded SVG, embedded in the entry',async()=>{
  const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
  const icon=await readFile(new URL('../../../reference/public/brand/favicon.svg',import.meta.url));
  const match=/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml;base64,([^\"]+)">/.exec(html);
  assert.ok(match);assert.deepEqual(Buffer.from(match[1],'base64'),icon);
});

const installed = {...input, pageUrl:'https://iris.example.invalid/dicom3d/reference.html'};
const binding = version => ({reader:'READER', sourceId:input.sourceId, studyId:input.studyId, path:'/synthetic/fhir/r5', fhirVersion:version});
const capability = version => ({resourceType:'CapabilityStatement', kind:'instance', fhirVersion:version, rest:[{mode:'server'}]});

for (const version of ['4.0.1', '4.3.0', '5.0.0']) test('installed HTTPS binding verifies both source fingerprints for ' + version, async () => {
  const requests = [];
  const repository = '/synthetic/fhir/' + ({'4.0.1':'r4','4.3.0':'r4b','5.0.0':'r5'})[version];
  const fixtures = [{...binding(version),path:repository}, capability(version), resource()];
  const result = await readLiveFhirStudy({...installed, fetchImpl:async (url, options) => {
    const index = requests.length;
    const address = new URL(url);
    requests.push(address.pathname + address.search);
    assert.equal(new URL(url).origin, 'https://iris.example.invalid');
    assert.equal(options.method, 'GET');
    assert.equal(options.mode, 'same-origin');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    if (index === 0) {
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.headers.Authorization, undefined);
      assert.deepEqual(options.headers, {Accept:'application/json'});
      return response(fixtures[index]);
    }
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('reader:synthetic-secret').toString('base64'));
    return new Response(JSON.stringify(fixtures[index]), {headers:{'content-type':'application/fhir+json'}});
  }});
  assert.deepEqual(requests, ['/dicom3d/DICOM3D.Entry.cls?fhirSource=iris&fhirStudy=study-1', repository + '/metadata', repository + '/ImagingStudy/study-1']);
  assert.equal(result.projection.resources[0].key, 'ImagingStudy/study-1');
  assert.equal(result.version, version);
  for (const [key, index] of [['metadata',1],['study',2]]) {
    const bytes = JSON.stringify(fixtures[index]);
    assert.equal(result.provenance[key].bytes, Buffer.byteLength(bytes));
    assert.equal(result.provenance[key].sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  assert.doesNotMatch(JSON.stringify(result), /synthetic-secret|Basic /);
});

test('binding fails closed before sending repository credentials', async () => {
  const good = binding('5.0.0');
  const responses = [
    [new Response(null, {status:403}), 'ACCESS_DENIED'],
    [new Response(null, {status:404}), 'SOURCE_UNAVAILABLE'],
    [response({...good, reader:'another-reader'}), 'ACCESS_DENIED'],
    [response({...good, sourceId:'a-different-source'}), 'INVALID_RESPONSE'],
    [response({...good, studyId:'a-different-study'}), 'INVALID_RESPONSE'],
    [response({...good, path:'https://elsewhere.invalid/fhir'}), 'INVALID_RESPONSE'],
    [response({...good, path:'//elsewhere.invalid/fhir'}), 'INVALID_RESPONSE'],
    [response({...good, path:'/other/../fhir'}), 'INVALID_RESPONSE'],
    [response({...good, path:'/clinical/fhir?override=1'}), 'INVALID_RESPONSE'],
    [new Response('{}', {headers:{'content-type':'text/html'}}), 'INVALID_RESPONSE'],
    [new Response(' '.repeat(4097), {headers:{'content-type':'application/json'}}), 'INVALID_RESPONSE'],
  ];
  for (const [bindingResponse, code] of responses) {
    let calls = 0;
    await assert.rejects(readLiveFhirStudy({...installed, fetchImpl:async (_, options) => {
      calls++;
      assert.equal(options.headers.Authorization, undefined);
      return bindingResponse;
    }}), {code});
    assert.equal(calls, 1);
  }
});

test('invalid source, wrong version, denied repository and wrong returned resource stay distinct', async () => {
  for (const invalid of ['.', '..', 'study\n']) {
    await assert.rejects(readLiveFhirStudy({...installed, studyId:invalid, fetchImpl:() => assert.fail('unexpected request')}), {code:'INVALID_SOURCE'});
  }
  for (const [responses, code] of [
    [[response(binding('4.3.0')), response(capability('5.0.0'))], 'SOURCE_VERSION_MISMATCH'],
    [[response(binding('5.0.0')), new Response(null, {status:401})], 'ACCESS_DENIED'],
    [[response(binding('5.0.0')), response(capability('5.0.0')), new Response(null, {status:403})], 'ACCESS_DENIED'],
    [[response(binding('5.0.0')), response(capability('5.0.0')), response({...resource(),id:'another-study'})], 'INVALID_RESPONSE'],
    [[response(binding('5.0.0')), response(capability('5.0.0')), new Response(null, {status:404})], 'SOURCE_UNAVAILABLE'],
  ]) {
    await assert.rejects(readLiveFhirStudy({...installed, fetchImpl:async () => responses.shift()}), {code});
    assert.equal(responses.length, 0);
  }
});
