import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {
  APPROVED_REFERENCE_ASSETS, APPROVED_BRAND_ASSETS, RELEASE_METADATA,
  inventory, verifyAdmittedPublicFiles,
} from './build-demo.mjs';
import {PUBLIC_STUDY_ENABLED} from '../viewer/src/public-release.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'.demo-dist'),source=resolve(root,'reference/public');
const read=(dir,name)=>readFileSync(resolve(dir,name));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(read(out,'demo-build-manifest.json'));
for(const [key,value] of Object.entries(RELEASE_METADATA))assert.equal(manifest[key],value,key);
assert.equal(PUBLIC_STUDY_ENABLED,false,'Separate research data admission is pending');
assert.equal(manifest.release,'0.6.0');
assert.equal(JSON.parse(read(root,'viewer/package.json')).version,manifest.release);
assert.equal(JSON.parse(read(root,'viewer/package-lock.json')).version,manifest.release);
assert.equal(JSON.parse(read(root,'viewer/package-lock.json')).packages[''].version,manifest.release);
assert.equal(manifest.product,'DICOM3D');
assert.equal(manifest.entrypoint,'/DICOM3D/');
assert.equal(manifest.entrySource,'viewer/reference.html');
assert.equal(manifest.defaultReference,'bp3d-male');
for(const [key,value] of Object.entries({
  connectedServices:false,patientDerivedResearchData:false,privatePatientData:false,
  arbitraryPatientAssets:false,rawDicomFiles:false,syntheticDemoAssets:false,
  patientReferenceRegistration:false,
}))assert.equal(manifest[key],value,key);
assert(!Object.hasOwn(manifest,'patientData'),'Do not replace qualified public data policy with a blanket assertion');
assert.equal(manifest.researchDataPublicationApproved,false);
assert.match(manifest.publicDataPolicy,/all other public data files denied/);

const admitted=[
  ...Object.keys(APPROVED_REFERENCE_ASSETS).map(x=>'reference/'+x),
  ...Object.keys(APPROVED_BRAND_ASSETS).map(x=>'brand/'+x),
];
const notices=['LICENSE','NOTICE',...inventory(resolve(root,'third-party')).map(x=>'third-party/'+x)];
const fixedOutput=new Set(['index.html','reference.html',...admitted,...notices]);
const names=inventory(out).filter(x=>x!=='demo-build-manifest.json').sort();
assert.deepEqual(names,Object.keys(manifest.files).sort(),'Every built file must be inventoried; no unknown files');
for(const [name,value] of Object.entries(manifest.files)){
  assert(!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').includes('..'),'Invalid output path: '+name);
  assert(fixedOutput.has(name)||/^assets\/[^/]+\.(js|css)$/.test(name),'Unadmitted output: '+name);
  const bytes=read(out,name);
  assert.equal(bytes.length,value.bytes,name+' byte length');
  assert.equal(hash(bytes),value.sha256,name+' hash');
  assert(!/\.(dcm|npy|npz)$/i.test(name),'Raw medical data file is not admitted: '+name);
}
await verifyAdmittedPublicFiles(source,{source:true});
await verifyAdmittedPublicFiles(out);
for(const name of admitted)assert.deepEqual(read(source,name),read(out,name),'Source identity changed: '+name);

for(const [variant,count,notice] of [
  ['bp3d-male',33,'BODYParts3D-NOTICE.txt'],['hra-female',22,'HRA-FEMALE-NOTICE.txt'],
]){
  const metadata=JSON.parse(read(out,'reference/'+variant+'.manifest.json'));
  const bytes=read(out,'reference/'+metadata.asset.relative_filename);
  assert.equal(hash(bytes),metadata.asset.sha256);
  assert.equal(metadata.reference.structures.length,count);
  assert(metadata.reference.structures.some(x=>x.label==='Heart'));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.deepEqual(read(source,'reference/'+notice),read(out,'reference/'+notice));
}

assert.deepEqual(manifest.approvedPublicResearchFixtures,{});
assert(!names.some(name=>/demo\/h000|public-research-loader|public-study-visual|source-binding|\.npy|\.bin$|study-docked/i.test(name)),
  'Unapproved research payload or loading chunk entered the release');
const admission=name=>fixedOutput.has(name)||/^assets\/[^/]+\.(js|css)$/.test(name);
for(const denied of ['demo/h000/ct.npy.bin','demo/h000/source-binding.json','patient.dcm','brand/extra.svg','reference/unknown.glb','assets/private/data.bin']){
  assert(!admission(denied),'Unknown public file must be denied: '+denied);
}
assert.equal(read(root,'viewer/vite.reference.config.mjs').toString('utf8').includes("mode==='safe-reference-demo'?false:"),true,'PublicDir must be disabled');

assert.deepEqual(read(out,'index.html'),read(out,'reference.html'));
const html=read(out,'index.html').toString('utf8');
const entrySource=read(root,'viewer/reference.html').toString('utf8');
const title=text=>text.match(/<title>([^<]+)<\/title>/)?.[1];
assert.equal(title(html),title(entrySource));
assert.equal(title(html),'DICOM3D v0.6.0 — Visual Research Workstation');
assert(html.includes('/DICOM3D/'));
const bundles=names.filter(x=>x.endsWith('.js')).map(x=>read(out,x).toString('utf8')).join('\n');
for(const text of [
  'connectLive','connectDicom','Read public FHIR test evidence','SMART_TEST','hapi.fhir.org','server.fire.ly',
  'demo/h000/','loadPublicResearchFixture','source-binding.json','ct.npy.bin','mask.npy.bin',
])assert(!bundles.includes(text),text+' must not be distributed');
for(const name of ['brand/favicon.svg','brand/semantic-cube.svg'])assert(bundles.includes(name),'Brand reference missing: '+name);
for(const name of notices)assert.deepEqual(read(root,name),read(out,name),'Notice changed: '+name);
assert(!names.some(x=>/reference\/(male|female)\.(glb|manifest\.json)$/.test(x)));
assert(!names.some(x=>/(^|\/)(sample|synthetic)(\/|[.-])/i.test(x)),'Synthetic test fixtures must not be distributed');

console.log(JSON.stringify({
  result:'PASS',scope:'Static build and exact asset admission; not browser or publication qualification',
  release:manifest.release,previousRelease:manifest.previousRelease,
  publicationApproved:manifest.publicationApproved,referenceStructures:[33,22],
  referenceFiles:7,brandFiles:2,researchFiles:0,
  inventoriedFiles:names.length,totalBytes:Object.values(manifest.files).reduce((sum,file)=>sum+file.bytes,0),
  checks:['exact output set and hashes','exact source/output assets and notices','unapproved data and loader exclusion',
    'unknown public-file denial','separate research admission remains pending','reference semantic identities','release identity and Pages base',
    'no distributed Connect provider UI, legacy placeholders, raw DICOM or synthetic fixture'],
},null,2));
