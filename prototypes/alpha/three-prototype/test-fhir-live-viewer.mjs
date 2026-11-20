import test from 'node:test';
import assert from 'node:assert/strict';
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

test('does not transmit credentials outside loopback or for unsupported inputs',async()=>{
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
