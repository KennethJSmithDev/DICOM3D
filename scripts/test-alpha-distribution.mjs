import assert from 'node:assert/strict';
import {readFile,readdir,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {PUBLIC_RESEARCH_ASSETS} from '../prototypes/alpha/viewer/src/public-source-binding.mjs';
const root=resolve(process.argv[2]??'UNSPECIFIED'),sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(join(root,'demo-build-manifest.json')));
const version=JSON.parse(await readFile(new URL('../prototypes/alpha/three-prototype/package.json',import.meta.url))).version;
assert(['0.7.0-alpha.1','0.7.0-alpha.2','0.7.0'].includes(version));
assert.equal(manifest.schema,'dicom3d-alpha-distribution-1');assert.equal(manifest.profile,'three-r3f-alpha');assert.equal(manifest.release,version);assert.equal(manifest.entrypoint,'/dicom3d/reference.html');assert.equal(manifest.containsPrivatePatientImaging,false);assert.equal(manifest.patientDerivedResearchData,true);assert.deepEqual(manifest.approvedPublicResearchFixtures,['H000','H001']);
assert.equal(JSON.parse(await readFile(join(root,'distribution-manifest.json'))).version,version);
const actual=[];async function walk(at,relative=''){for(const e of await readdir(at,{withFileTypes:true})){const name=relative+e.name;assert(!e.isSymbolicLink());if(e.isDirectory())await walk(join(at,e.name),name+'/');else actual.push(name)}}await walk(root);
assert.deepEqual(actual.filter(x=>x!=='demo-build-manifest.json').sort(),Object.keys(manifest.files).sort());
for(const [name,expected]of Object.entries(manifest.files)){assert(/^[A-Za-z0-9_.\/-]+$/.test(name)&&!name.split('/').some(x=>x==='.'||x==='..'));const b=await readFile(join(root,name));assert(b.length<100000000);assert.deepEqual({bytes:b.length,sha256:sha(b)},expected,name)}
for(const asset of Object.values(PUBLIC_RESEARCH_ASSETS))assert.deepEqual(manifest.files['demo/h000/'+asset.filename],{bytes:asset.bytes,sha256:asset.sha256});
assert.deepEqual(Object.keys(manifest.files).filter(name=>name.startsWith('demo/h000/')).sort(),Object.values(PUBLIC_RESEARCH_ASSETS).map(asset=>'demo/h000/'+asset.filename).sort());
assert.deepEqual(await readFile(join(root,'reference.html')),await readFile(join(root,'index.html')));
for(const name of ['react','react-dom','three','react-three-fiber'])assert((await readFile(join(root,'third-party/alpha',name+'-LICENSE.txt'))).length>300);
const teaching = JSON.parse(await readFile(join(root,'distribution-manifest.json'))).publishedUltrasoundFigures;
assert.equal(teaching.study,'H001');
assert.deepEqual(Object.keys(teaching.figures).sort(),['1','2']);
for (const expected of Object.values(teaching.figures)) {
 const matching=Object.entries(manifest.files).filter(([name,r]) => name.endsWith('.jpg') && r.sha256===expected.sha256 && r.bytes===expected.bytes);
 assert.equal(matching.length,1,'Expected one packaged JPEG per H001 figure');
}
const brain = JSON.parse(await readFile(join(root,'distribution-manifest.json'))).fetalBrainReference;
assert.equal(brain.doi,'10.7910/DVN/QOO75G');
assert.equal(brain.version,'4.1');
for (const [source, asset] of Object.entries(brain.assets)) {
  const matches=Object.values(manifest.files).filter(record => record.bytes===asset.bytes && record.sha256===asset.sha256);
  assert.equal(matches.length,1,'Missing or duplicated fetal reference asset: '+source);
}
assert.equal(manifest.atlasIndexSha256,manifest.files['atlas/index.json'].sha256);
console.log(JSON.stringify({status:'PASS',profile:manifest.profile,release:manifest.release,files:actual.length,exactPublicH000:true,legacyEntryIsSameAlpha:true,privatePatientData:false}));
