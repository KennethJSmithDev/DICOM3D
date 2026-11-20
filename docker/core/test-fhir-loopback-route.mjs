import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createLoopbackFhirRoute} from './fhir-loopback-route.mjs';

const path='/dicom3d/_interop/fhir/iris/ImagingStudy/study-1';
const source=version=>({id:'iris',baseUrl:'https://127.0.0.1:53445/fhir',fhirVersion:version,imagingStudyIds:['study-1']});
const statement=version=>({resourceType:'CapabilityStatement',kind:'instance',fhirVersion:version,rest:[]});
const study=()=>({resourceType:'ImagingStudy',id:'study-1',status:'available'});
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/fhir+json'}});
const basic=value=>'Basic '+Buffer.from(value).toString('base64');

function exchange(route, {url=path,method='GET',headers={},address='127.0.0.1'}={}) {
  const req=Object.assign(new EventEmitter(),{method,url,socket:{remoteAddress:address},headers:{host:'127.0.0.1:57980',
    'sec-fetch-site':'same-origin','x-dicom3d-request':'fhir-read-v1',authorization:basic('reader:synthetic-secret'),...headers}});
  const res=Object.assign(new EventEmitter(),{destroyed:false,writableEnded:false,
    writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;this.writableEnded=true;}});
  return {req,res,promise:route(req,res,new URL(url,'http://127.0.0.1:57980').pathname)};
}

for (const version of ['4.0.1','4.3.0','5.0.0']) test(`forwards only an authorized configured ${version} study and verifies metadata`,async()=>{
  const requests=[];
  const route=createLoopbackFhirRoute({sources:[source(version)],port:57980,fetchImpl:async(url,options)=>{
    requests.push({url,authorization:options.headers.Authorization,redirect:options.redirect,credentials:options.credentials});
    return json(url.endsWith('/metadata')?statement(version):study());
  }});
  const {res,promise}=exchange(route);await promise;
  assert.equal(res.status,200);const payload=JSON.parse(res.body);
  assert.equal(payload.fhirVersion,version);assert.equal(payload.resource.id,'study-1');
  assert.equal(requests.length,2);assert.ok(requests[0].url.endsWith('/ImagingStudy/study-1'));assert.ok(requests[1].url.endsWith('/metadata'));
  assert.ok(requests.every(item=>item.authorization===basic('reader:synthetic-secret')&&item.redirect==='error'&&item.credentials==='omit'));
  assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(+res.headers['Content-Length'],Buffer.byteLength(res.body));
  assert.doesNotMatch(res.body,/synthetic-secret|reader:/);
});

test('refuses credentials for a cleartext loopback source before any upstream request',async()=>{
  let calls=0;
  const route=createLoopbackFhirRoute({sources:[{...source('5.0.0'),baseUrl:'http://127.0.0.1:53445/fhir'}],port:57980,fetchImpl:async()=>{calls++;return json(study());}});
  const {res,promise}=exchange(route);await promise;
  assert.equal(res.status,426);
  assert.equal(JSON.parse(res.body).error,'UPSTREAM_SECURE_TRANSPORT_REQUIRED');
  assert.equal(calls,0);
});

test('rejects cross-origin, rebind, malformed, unconfigured and unauthenticated requests before upstream access',async()=>{
  let calls=0;const route=createLoopbackFhirRoute({sources:[source('5.0.0')],port:57980,fetchImpl:async()=>{calls++;return json(study());}});
  for(const item of [
    {headers:{host:'attacker.invalid:57980'}},{headers:{origin:'https://attacker.invalid'}},{headers:{'sec-fetch-site':'cross-site'}},
    {headers:{'sec-fetch-site':'same-site'}},{headers:{'x-dicom3d-request':undefined}},{address:'192.0.2.2'},
    {url:path+'?target=other'},{url:path.replace('study-1','study-2')},{url:path.replace('study-1','.')},
    {url:path.replace('study-1','..')},{url:path.replace('iris','unknown')},
    {headers:{authorization:undefined}},{headers:{authorization:'Basic !!!'}},{method:'POST'}
  ]) {const {res,promise}=exchange(route,item);await promise;assert.ok(res.status>=400);}
  assert.equal(calls,0);
  const absent=exchange(route,{url:path.replace('study-1','study-2')});await absent.promise;
  assert.equal(absent.res.status,403);assert.equal(JSON.parse(absent.res.body).error,'UPSTREAM_ACCESS_DENIED');
});

test('uses IRIS access control and refuses version mismatches without returning the resource',async()=>{
  for(const upstreamStatus of [401,403]){
    let calls=0;const route=createLoopbackFhirRoute({sources:[source('5.0.0')],port:57980,fetchImpl:async()=>{calls++;return new Response('sensitive upstream detail',{status:upstreamStatus});}});
    const {res,promise}=exchange(route);await promise;assert.equal(res.status,403);assert.equal(calls,1);assert.doesNotMatch(res.body,/sensitive/);
  }
  const route=createLoopbackFhirRoute({sources:[source('5.0.0')],port:57980,fetchImpl:async url=>json(url.endsWith('/metadata')?statement('4.0.1'):study())});
  const {res,promise}=exchange(route);await promise;assert.equal(res.status,502);assert.doesNotMatch(res.body,/study-1|ImagingStudy/);
});

test('does not share credentials or cancellation across concurrent requests',async()=>{
  const seen=[];const route=createLoopbackFhirRoute({sources:[source('5.0.0')],port:57980,fetchImpl:async(url,options)=>{
    seen.push(options.headers.Authorization);await new Promise(resolve=>setTimeout(resolve,5));return json(url.endsWith('/metadata')?statement('5.0.0'):study());
  }});
  const one=exchange(route,{headers:{authorization:basic('one:secret1')}}),two=exchange(route,{headers:{authorization:basic('two:secret2')}});
  await Promise.all([one.promise,two.promise]);assert.equal(one.res.status,200);assert.equal(two.res.status,200);
  assert.equal(seen.filter(value=>value===basic('one:secret1')).length,2);assert.equal(seen.filter(value=>value===basic('two:secret2')).length,2);
  const stalled=createLoopbackFhirRoute({sources:[source('5.0.0')],port:57980,fetchImpl:async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))});
  const cancelled=exchange(stalled);setTimeout(()=>cancelled.res.emit('close'),10);await cancelled.promise;assert.equal(cancelled.res.status,undefined);
});

test('rejects invalid configuration and refuses credentials in source definitions',()=>{
  for(const value of [{...source('5.0.0'),token:'secret'},{...source('5.0.0'),baseUrl:'http://192.0.2.1/fhir'},
    {...source('5.0.0'),baseUrl:'https://user:pass@example.invalid/fhir'},{...source('5.0.0'),imagingStudyIds:['.']},
    {...source('5.0.0'),imagingStudyIds:['..']},{...source('5.0.0'),fhirVersion:'4.2.0'}])
    assert.throws(()=>createLoopbackFhirRoute({sources:[value],port:57980}),{code:'INVALID_CONFIGURATION'});
});
