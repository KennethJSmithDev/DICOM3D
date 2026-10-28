import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {
  APPROVED_REFERENCE_ASSETS, APPROVED_BRAND_ASSETS,
  inventory, verifyAdmittedPublicFiles, verifyH000AssetBytes, buildDemo,
} from './build-demo.mjs';
import {PUBLIC_STUDY_ENABLED,publicBuildProfile} from '../viewer/src/public-release.mjs';
import {APPROVED_H000_ASSETS,H000_PUBLIC_ADMISSION,EXCLUDED_STUDY_SCREENSHOT_SHA256} from '../viewer/src/public-h000-admission.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const base=option('--base')??'/DICOM3D/';
const profile=option('--profile')??'reference-only',selected=publicBuildProfile(profile);
assert(['/DICOM3D/','/dicom3d/'].includes(base));
assert(!selected.studyEnabled||base==='/DICOM3D/','Curated profile is not an installer admission');
const out=resolve(option('--out-dir')??resolve(root,'.demo-dist')),source=resolve(root,'reference/public');
const read=(dir,name)=>readFileSync(resolve(dir,name));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(read(out,'demo-build-manifest.json'));
for(const [key,value] of Object.entries(selected.release))assert.equal(manifest[key],value,key);
assert.equal(PUBLIC_STUDY_ENABLED,false,'Node/runtime defaults do not admit a study');
assert.equal(manifest.buildProfile,profile);
assert.equal(manifest.release,'0.6.5');
assert.equal(JSON.parse(read(root,'viewer/package.json')).version,manifest.release);
assert.equal(JSON.parse(read(root,'viewer/package-lock.json')).version,manifest.release);
assert.equal(JSON.parse(read(root,'viewer/package-lock.json')).packages[''].version,manifest.release);
assert.equal(manifest.product,'DICOM3D');
assert.equal(manifest.entrypoint,base);
assert.equal(manifest.entrySource,'viewer/reference.html');
assert.equal(manifest.defaultReference,'bp3d-male');
for(const [key,value] of Object.entries({
  connectedServices:false,patientDerivedResearchData:selected.studyEnabled,privatePatientData:false,
  arbitraryPatientAssets:false,rawDicomFiles:false,syntheticDemoAssets:false,
  patientReferenceRegistration:false,
}))assert.equal(manifest[key],value,key);
assert(!Object.hasOwn(manifest,'patientData'),'Do not replace qualified public data policy with a blanket assertion');
assert.equal(manifest.researchDataPublicationApproved,selected.studyEnabled);
assert.match(manifest.publicDataPolicy,/all other public data files denied/);

const admitted=[
  ...Object.keys(APPROVED_REFERENCE_ASSETS).map(x=>'reference/'+x),
  ...Object.keys(APPROVED_BRAND_ASSETS).map(x=>'brand/'+x),
  ...(selected.studyEnabled?Object.keys(APPROVED_H000_ASSETS).map(x=>'demo/h000/'+x):[]),
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
  assert.notEqual(hash(bytes),EXCLUDED_STUDY_SCREENSHOT_SHA256,'Excluded screenshot under renamed path: '+name);
  assert(!/\.(dcm|npy|npz)$/i.test(name),'Raw medical data file is not admitted: '+name);
}
await verifyAdmittedPublicFiles(source,{source:true,profile});
await verifyAdmittedPublicFiles(out,{profile});
for(const name of admitted)assert.deepEqual(read(source,name),read(out,name),'Source identity changed: '+name);

for(const [variant,count,notice] of [
  ['bp3d-male',386,'BODYParts3D-NOTICE.txt'],['hra-female',380,'HRA-FEMALE-NOTICE.txt'],
]){
  const metadata=JSON.parse(read(out,'reference/'+variant+'.manifest.json'));
  const bytes=read(out,'reference/'+metadata.asset.relative_filename);
  assert.equal(hash(bytes),metadata.asset.sha256);
  assert.equal(metadata.reference.structures.length,count);
  assert(metadata.reference.structures.some(x=>x.label==='Heart'));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.deepEqual(read(source,'reference/'+notice),read(out,'reference/'+notice));
}

if(selected.studyEnabled){
  assert.deepEqual(manifest.approvedPublicResearchFixtures,Object.fromEntries(Object.entries(APPROVED_H000_ASSETS).map(([name,value])=>['demo/h000/'+name,value])));
  assert.deepEqual(manifest.currentResearchAdmission,H000_PUBLIC_ADMISSION);
  assert(names.some(name=>/public-research-loader/.test(name)),'Curated loader chunk missing');
  assert(names.some(name=>/public-study-visual/.test(name)),'Curated visual chunk missing');
  for(const name of Object.keys(APPROVED_H000_ASSETS))verifyH000AssetBytes(name,read(out,'demo/h000/'+name));
  assert.equal(JSON.parse(read(out,'demo/h000/source-binding.json')).admission.publicationApproved,false,'Historical source decision changed');
}else{
  assert.deepEqual(manifest.approvedPublicResearchFixtures,{});
  assert.equal(manifest.currentResearchAdmission,null);
  assert(!names.some(name=>/demo\/h000|public-research-loader|public-study-visual|source-binding|\.npy|\.bin$|study-docked/i.test(name)),
    'Research payload or loading chunk entered reference-only output');
}
const admission=name=>fixedOutput.has(name)||/^assets\/[^/]+\.(js|css)$/.test(name);
for(const denied of ['demo/h000/private.bin','demo/h000/ct.npy','demo/h000/copy.glb','demo/h000/sub/NOTICE.md','demo/other/ct.npy.bin','docs/images/visual-060-study-docked.jpg','patient.dcm','brand/extra.svg','reference/unknown.glb','assets/private/data.bin']){
  assert(!admission(denied),'Unknown public file must be denied: '+denied);
}
if(!selected.studyEnabled)for(const name of Object.keys(APPROVED_H000_ASSETS))assert(!admission('demo/h000/'+name));
assert.throws(()=>publicBuildProfile('all-data'),/Unreviewed/);
await assert.rejects(buildDemo({base:'/dicom3d/',profile:'curated-h000'}),/Core\/native remain reference-only/);
for(const denied of ['../NOTICE.md','ct.npy.bin?download=1','copy.glb','__proto__','docs/images/visual-060-study-docked.jpg'])assert.throws(()=>verifyH000AssetBytes(denied,Buffer.alloc(0)),/Unadmitted/);
assert.throws(()=>verifyH000AssetBytes('NOTICE.md',Buffer.alloc(1)),/Unadmitted/);
assert.throws(()=>verifyH000AssetBytes('NOTICE.md',Buffer.alloc(APPROVED_H000_ASSETS['NOTICE.md'].bytes)),/Unadmitted/,'Same-size altered bytes denied');
assert.equal(read(root,'viewer/vite.reference.config.mjs').toString('utf8').includes("mode==='safe-reference-demo'?false:"),true,'PublicDir must be disabled');

assert.deepEqual(read(out,'index.html'),read(out,'reference.html'));
const html=read(out,'index.html').toString('utf8');
const entrySource=read(root,'viewer/reference.html').toString('utf8');
const title=text=>text.match(/<title>([^<]+)<\/title>/)?.[1];
assert.equal(title(html),title(entrySource));
assert.equal(title(html),'DICOM3D v0.6.5 RC — Visual Research Workstation');
assert(html.includes(base));
const bundles=names.filter(x=>x.endsWith('.js')).map(x=>read(out,x).toString('utf8')).join('\n');
for(const text of [
  'connectLive','connectDicom','Read public FHIR test evidence','SMART_TEST','hapi.fhir.org','server.fire.ly',
  'Choose the accepted local study manifest first.','Choose a manifest and its matching GLB.',
])assert(!bundles.includes(text),text+' must not be distributed');
for(const text of ['demo/h000/','loadPublicResearchFixture','source-binding.json','ct.npy.bin','mask.npy.bin']){
  assert.equal(bundles.includes(text),selected.studyEnabled,text+' must follow the selected profile');
}
if(selected.studyEnabled){
  for(const text of ['approximately 33.3 MB','Source credits & transformation notes','TCIA use policy','Historical candidate flags','10.7937/K9/TCIA.2015.1BUVFJR7'])assert(bundles.includes(text),'Current admission/credits missing: '+text);
  const styles=names.filter(x=>x.endsWith('.css')).map(x=>read(out,x).toString('utf8')).join('\n');
  assert(/#studyAdmissionNotice\{[^}]*display:block/.test(styles),'Pre-load study notice must override hidden library paragraphs');
}
for(const name of ['brand/favicon.svg','brand/semantic-cube.svg'])assert(bundles.includes(name),'Brand reference missing: '+name);
for(const name of notices)assert.deepEqual(read(root,name),read(out,name),'Notice changed: '+name);
assert(!names.some(x=>/reference\/(male|female)\.(glb|manifest\.json)$/.test(x)));
assert(!names.some(x=>/(^|\/)(sample|synthetic)(\/|[.-])/i.test(x)),'Synthetic test fixtures must not be distributed');

console.log(JSON.stringify({
  result:'PASS',scope:'Static build and exact asset admission; not browser or publication qualification',
  release:manifest.release,previousRelease:manifest.previousRelease,
  publicationApproved:manifest.publicationApproved,referenceStructures:[386,380],
  buildProfile:profile,referenceFiles:10,brandFiles:2,researchFiles:selected.studyEnabled?5:0,
  inventoriedFiles:names.length,totalBytes:Object.values(manifest.files).reduce((sum,file)=>sum+file.bytes,0),
  checks:['exact output set and hashes','exact source/output assets and notices','profile-bound study data and lazy loader',
    'unknown path, same-size hash, screenshot and installer-profile denial','current admission separate from historical metadata','reference semantic identities','release identity and Pages base',
    'no distributed Connect provider UI, legacy placeholders, raw DICOM or synthetic fixture'],
},null,2));
