import assert from 'node:assert/strict';
import {readFile,readdir,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {PUBLIC_RESEARCH_ASSETS} from '../prototypes/alpha/viewer/src/public-source-binding.mjs';
const root=resolve(process.argv[2]??'UNSPECIFIED'),sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(join(root,'demo-build-manifest.json')));
assert.equal(manifest.schema,'dicom3d-alpha-distribution-1');assert.equal(manifest.profile,'three-r3f-alpha');assert.equal(manifest.release,'0.7.0-alpha.1');assert.equal(manifest.entrypoint,'/dicom3d/reference.html');assert.equal(manifest.containsPrivatePatientImaging,false);assert.equal(manifest.patientDerivedResearchData,true);assert.deepEqual(manifest.approvedPublicResearchFixtures,['H000']);
const actual=[];async function walk(at,relative=''){for(const e of await readdir(at,{withFileTypes:true})){const name=relative+e.name;assert(!e.isSymbolicLink());if(e.isDirectory())await walk(join(at,e.name),name+'/');else actual.push(name)}}await walk(root);
assert.deepEqual(actual.filter(x=>x!=='demo-build-manifest.json').sort(),Object.keys(manifest.files).sort());
for(const [name,expected]of Object.entries(manifest.files)){assert(/^[A-Za-z0-9_.\/-]+$/.test(name)&&!name.split('/').some(x=>x==='.'||x==='..'));const b=await readFile(join(root,name));assert(b.length<100000000);assert.deepEqual({bytes:b.length,sha256:sha(b)},expected,name)}
for(const asset of Object.values(PUBLIC_RESEARCH_ASSETS))assert.deepEqual(manifest.files['demo/h000/'+asset.filename],{bytes:asset.bytes,sha256:asset.sha256});
assert.deepEqual(await readFile(join(root,'reference.html')),await readFile(join(root,'index.html')));
for(const name of ['react','react-dom','three','react-three-fiber'])assert((await readFile(join(root,'third-party/alpha',name+'-LICENSE.txt'))).length>300);
assert.equal(manifest.atlasIndexSha256,manifest.files['atlas/index.json'].sha256);
console.log(JSON.stringify({status:'PASS',profile:manifest.profile,release:manifest.release,files:actual.length,exactPublicH000:true,legacyEntryIsSameAlpha:true,privatePatientData:false}));
