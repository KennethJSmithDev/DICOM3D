import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {readVerifiedFile} from './preview-verified-file.mjs';
import {createResponseGate} from './preview-verified-file.mjs';
import {EventEmitter,once} from 'node:events';
const dir=process.env.DICOM3D_SECURITY_TEST_DIR;
if(!dir)throw Error('Set DICOM3D_SECURITY_TEST_DIR to the owned qualification directory');
mkdirSync(dir,{recursive:true});
const file=join(dir,'preview-verification-fixture.txt'),source=Buffer.from('public sample');
const record={bytes:source.length,sha256:createHash('sha256').update(source).digest('hex')};
test('responds only with the exact admitted bytes',()=>{
 writeFileSync(file,source);const snapshot=readVerifiedFile(file,record);assert.deepEqual(snapshot,source);
 writeFileSync(file,'other sample!');assert.throws(()=>readVerifiedFile(file,record));assert.deepEqual(snapshot,source);
 writeFileSync(file,'short');assert.throws(()=>readVerifiedFile(file,record));
 assert.throws(()=>readVerifiedFile(file,{bytes:100000000,sha256:record.sha256}));
});
test('slow responses are bounded, queued and released',async()=>{
 const gate=createResponseGate(1,1),a=new EventEmitter(),b=new EventEmitter(),c=new EventEmitter();
 assert.equal(await gate(a),true);
 const pending=gate(b);assert.equal(await gate(c),false);
 a.emit('finish');assert.equal(await pending,true);b.emit('close');
 assert.equal(await gate(c),true);c.emit('finish');
});

function startPreview(t,config){
 const fixture=mkdtempSync(join(dir,'preview-origin-'));
 const root=join(fixture,'public'),configFile=join(fixture,'fhir.json'),state=join(fixture,'state.json');
 mkdirSync(root);
 writeFileSync(join(root,'demo-build-manifest.json'),JSON.stringify({
  schema:'dicom3d-alpha-distribution-1',profile:'three-r3f-alpha',entrypoint:'/dicom3d/reference.html',release:'fixture',files:{}
 }));
 writeFileSync(configFile,JSON.stringify(config));
 const script=fileURLToPath(new URL('./preview-static.mjs',import.meta.url));
 const child=spawn(process.execPath,[script,'--root',root,'--port','0','--state',state],{
  env:{...process.env,DICOM3D_LIVE_FHIR_CONFIG:configFile},stdio:['ignore','pipe','pipe']
 });
 const closed=once(child,'close');
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null)child.kill();await closed;});
 return {child,closed,state};
}

test('a configured preview uses its OS-assigned port as its exact FHIR origin',{timeout:10000},async t=>{
 const {child,closed,state}=startPreview(t,{schema:'dicom3d-loopback-fhir-1',sources:[
  {id:'fixture',baseUrl:'https://fixture.invalid/fhir',fhirVersion:'5.0.0',imagingStudyIds:['study-1']}
 ]});
 const output=createInterface({input:child.stdout});
 const [line]=await Promise.race([once(output,'line'),closed.then(()=>{throw Error('Preview closed before reporting readiness');})]);
 const ready=JSON.parse(line),url=new URL(ready.url);
 assert.equal(ready.requestedPort,0);
 assert.equal(url.hostname,'127.0.0.1');
 assert.ok(Number(url.port)>0);
 assert.ok(existsSync(state));
 assert.equal((await fetch(new URL('/healthz',url))).status,200);
 const study=new URL('/dicom3d/_interop/fhir/fixture/ImagingStudy/study-1',url);
 const headers={'sec-fetch-site':'same-origin','x-dicom3d-request':'fhir-read-v1',origin:url.origin};
 assert.equal((await fetch(study,{headers})).status,401);
 assert.equal((await fetch(study,{headers:{...headers,origin:'http://127.0.0.1:0'}})).status,403);
 assert.equal((await fetch(study,{headers:{...headers,origin:'https://other.invalid'}})).status,403);
});

test('invalid FHIR configuration exits before announcing a usable preview',{timeout:10000},async t=>{
 const {child,closed,state}=startPreview(t,{schema:'dicom3d-loopback-fhir-1',sources:[]});
 let output='',diagnostic='';
 child.stdout.on('data',part=>{output+=part;});
 child.stderr.on('data',part=>{diagnostic+=part;});
 const [code]=await closed;
 assert.equal(code,1);
 assert.equal(output,'');
 assert.match(diagnostic,/Invalid live FHIR configuration/);
 assert.equal(existsSync(state),false);
});
