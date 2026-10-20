// Copyright 2026 KennethJSmithDev. Apache-2.0.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, copyFileSync, cpSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {PUBLIC_RELEASE, PUBLIC_STUDY_ENABLED} from '../viewer/src/public-release.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const identity=(bytes)=>({bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
export const APPROVED_REFERENCE_ASSETS=Object.freeze({
  'bp3d-male.glb':[{bytes:47348364,sha256:'dcef47dc21d252b93b288b649ac30795d9de73f733c27b285f8d1a43ae4fc055'}],
  'bp3d-male.manifest.json':[{bytes:6471,sha256:'5dbb1b39ad0bd8d12bd40d7fed78a159696c5acf317f766acbaa9f10d21d2ad8'}],
  'bp3d-source-members.json':[{bytes:543729,sha256:'645168d598d5d38410191f62674b8406a6f2fae33736996026530e3c936c2c68'}],
  // Existing Git LF and Windows checkout CRLF versions; output must equal the actual source.
  'BODYParts3D-NOTICE.txt':[{bytes:1604,sha256:'c051a4ef9961fdf0681f6c4f9e22c97c63f9d19d0d06c1150ab3349432aa7c54'},{bytes:1621,sha256:'9b84c07ab570f582685decc97e8b6e16e9c5d57210d6365fa8d56c2bfb45a804'}],
  'hra-female.glb':[{bytes:67539748,sha256:'a61a60841fd3c8308d332421385be03188c0babd58b78ae101adf2807a88473a'}],
  'hra-female.manifest.json':[{bytes:6133,sha256:'aa949648208e72ba1bf212e323ac8133005594ae6538c985680134c9aa723eed'}],
  'HRA-FEMALE-NOTICE.txt':[{bytes:1530,sha256:'cf715c70da92f480733fc6930caf3222bef53767c7840f1e643607612b1a5070'}],
});
export const APPROVED_BRAND_ASSETS=Object.freeze({
  'favicon.svg':{bytes:324,sha256:'0a8d80b1b6c700d10589dc5de6d827e714c416d2cbdcc4f324b5e0ef64e6f7d5'},
  'semantic-cube.svg':{bytes:593,sha256:'c96129b740649d1b4ac3a14459fcf61c5bb197bd908af52178ba3e7e88302544'},
});
export const RELEASE_METADATA=PUBLIC_RELEASE;
const excludedLegacy=['male.glb','male.manifest.json','female.glb','female.manifest.json'];
export function inventory(dir,prefix=''){
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    if(entry.isSymbolicLink())throw Error(`Symbolic link is not admitted: ${prefix+entry.name}`);
    if(entry.isDirectory())return inventory(resolve(dir,entry.name),prefix+entry.name+'/');
    if(!entry.isFile())throw Error(`Unexpected filesystem object: ${prefix+entry.name}`);
    return [prefix+entry.name];
  });
}
function exactNames(actual,expected,label){
  if(JSON.stringify([...actual].sort())!==JSON.stringify([...expected].sort()))throw Error(`${label}: unexpected or missing files`);
}
function checkReferenceBytes(bytes,name){
  const actual=identity(bytes);
  if(!APPROVED_REFERENCE_ASSETS[name]?.some(x=>x.bytes===actual.bytes&&x.sha256===actual.sha256))throw Error(`Unadmitted reference bytes: ${name}`);
}
export async function verifyAdmittedPublicFiles(publicRoot,{source=false}={}){
  if(PUBLIC_STUDY_ENABLED)throw Error('Study publication needs a separate reviewed data-admission change');
  exactNames(inventory(resolve(publicRoot,'brand')),Object.keys(APPROVED_BRAND_ASSETS),'Brand payload');
  exactNames(inventory(resolve(publicRoot,'reference')),[...Object.keys(APPROVED_REFERENCE_ASSETS),...(source?excludedLegacy:[])],'Reference payload');
  for(const name of Object.keys(APPROVED_REFERENCE_ASSETS))checkReferenceBytes(readFileSync(resolve(publicRoot,'reference',name)),name);
  for(const[name,expected]of Object.entries(APPROVED_BRAND_ASSETS)){
    const actual=identity(readFileSync(resolve(publicRoot,'brand',name)));
    if(actual.bytes!==expected.bytes||actual.sha256!==expected.sha256)throw Error('Unadmitted brand bytes: '+name);
  }
}

// Retain the old unit-test fixture only as an explicit local utility.
function writeSyntheticTestFixture(){
const sample = resolve(root, 'demo/public/sample');
mkdirSync(sample, { recursive: true });
const t = (1 + Math.sqrt(5)) / 2;
const vertices = [-1,t,0,1,t,0,-1,-t,0,1,-t,0,0,-1,t,0,1,t,0,-1,-t,0,1,-t,t,0,-1,t,0,1,-t,0,-1,-t,0,1];
const positions = new Float32Array(vertices.map((v,i) => v * [0.035,0.045,0.025][i%3]));
const indices = new Uint16Array([0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1]);
const binary = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(indices.buffer)]);
const id = 'synthetic.demo.icosahedron.001';
const gltf = {
  asset:{version:'2.0',generator:'DICOM3D DEMO-001 deterministic mathematical fixture'},
  scene:0,scenes:[{nodes:[0]}],nodes:[{name:id,mesh:0,extras:{semanticId:id}}],
  meshes:[{primitives:[{attributes:{POSITION:0},indices:1,mode:4}]}],
  buffers:[{byteLength:binary.length}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.byteLength,target:34962},{buffer:0,byteOffset:positions.byteLength,byteLength:indices.byteLength,target:34963}],
  accessors:[{bufferView:0,componentType:5126,count:12,type:'VEC3',min:[-t*.035,-t*.045,-t*.025],max:[t*.035,t*.045,t*.025]},{bufferView:1,componentType:5123,count:60,type:'SCALAR'}],
};
const jsonText = JSON.stringify(gltf);
const json = Buffer.from(jsonText.padEnd(Math.ceil(Buffer.byteLength(jsonText)/4)*4,' '));
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);
const chunk = (length,type) => { const b=Buffer.alloc(8);b.writeUInt32LE(length,0);b.writeUInt32LE(type,4);return b; };
const glb = Buffer.concat([header,chunk(json.length,0x4e4f534a),json,chunk(binary.length,0x004e4942),binary]);
writeFileSync(resolve(sample,'study.glb'),glb);
writeFileSync(resolve(sample,'study.manifest.json'),JSON.stringify({
  structure:{semantic_id:id},
  asset:{relative_filename:'study.glb',sha256:createHash('sha256').update(glb).digest('hex'),model_space:'Synthetic demo space · independent mathematical fixture',units:'metres'},
  provenance:{description:'12-vertex / 20-triangle mathematical icosahedron generated by scripts/build-demo.mjs; no imaging source',copyright:'Copyright 2026 KennethJSmithDev (personal)',license:'Apache-2.0',patient_data:false,anatomical:false},
},null,2)+'\n');
}

export async function buildDemo(){
if(process.argv.includes('--sample-only')){writeSyntheticTestFixture();return;}
const publicRoot=resolve(root,'reference/public');
await verifyAdmittedPublicFiles(publicRoot,{source:true});
// Static Pages adapter over the qualified reference viewer; no second renderer.
execFileSync(process.execPath,[resolve(root,'viewer/node_modules/vite/bin/vite.js'),'build','--config',resolve(root,'viewer/vite.reference.config.mjs'),'--base','/DICOM3D/','--mode','safe-reference-demo','--outDir',resolve(root,'.demo-dist'),'--emptyOutDir'],{stdio:'inherit',cwd:resolve(root,'viewer')});
const output=resolve(root,'.demo-dist');
// WHY: the unapproved local study must never enter a Pages artifact.
// BOUNDARY: Vite publicDir is disabled for this mode; copy only exact named assets.
// INVARIANT: no recursive copy from reference/public and no runtime admission override.
// EVIDENCE: scripts/test-demo.mjs verifies the complete output set and hashes.
// REGRESSION: returning to Vite's automatic copy would ship ignored local payloads.
for(const [folder,names]of [['reference',Object.keys(APPROVED_REFERENCE_ASSETS)],['brand',Object.keys(APPROVED_BRAND_ASSETS)]]){
  mkdirSync(resolve(output,folder),{recursive:true});
  for(const name of names)copyFileSync(resolve(publicRoot,folder,name),resolve(output,folder,name));
}
copyFileSync(resolve(output,'reference.html'),resolve(output,'index.html'));
for(const name of ['LICENSE','NOTICE'])copyFileSync(resolve(root,name),resolve(output,name));
cpSync(resolve(root,'third-party'),resolve(output,'third-party'),{recursive:true});
// Remove only the four known obsolete placeholders from this fixed build output.
for(const name of excludedLegacy){
  const target=resolve(output,'reference',name);
  if(!target.startsWith(output+'\\')&&!target.startsWith(output+'/'))throw Error('Output path escaped build directory');
  rmSync(target,{force:true});
}
await verifyAdmittedPublicFiles(output);
for(const name of [...Object.keys(APPROVED_REFERENCE_ASSETS).map(x=>'reference/'+x),...Object.keys(APPROVED_BRAND_ASSETS).map(x=>'brand/'+x)]){
  if(!readFileSync(resolve(output,name)).equals(readFileSync(resolve(publicRoot,name))))throw Error('Built public bytes differ: '+name);
}
if(!readFileSync(resolve(output,'index.html'),'utf8').includes('/DICOM3D/'))throw Error('Wrong Pages base');
const files=Object.fromEntries(inventory(output).sort().map(name=>[name,identity(readFileSync(resolve(output,name)))]));
const fixedOutput=new Set(['index.html','reference.html','LICENSE','NOTICE',
  ...inventory(resolve(root,'third-party')).map(x=>'third-party/'+x),
  ...Object.keys(APPROVED_REFERENCE_ASSETS).map(x=>'reference/'+x),
  ...Object.keys(APPROVED_BRAND_ASSETS).map(x=>'brand/'+x)]);
for(const name of Object.keys(files))if(!fixedOutput.has(name)&&!/^assets\/[^/]+\.(js|css)$/.test(name))throw Error('Unadmitted build output: '+name);
const approvedPublicResearchFixtures={};
writeFileSync(resolve(output,'demo-build-manifest.json'),JSON.stringify({
  product:'DICOM3D',...RELEASE_METADATA,entrypoint:'/DICOM3D/',entrySource:'viewer/reference.html',
  defaultReference:'bp3d-male',connectedServices:false,patientDerivedResearchData:false,privatePatientData:false,
  arbitraryPatientAssets:false,rawDicomFiles:false,syntheticDemoAssets:false,patientReferenceRegistration:false,
  publicDataPolicy:'Exact admitted generalized reference and brand files only; all other public data files denied. H000 data release is pending.',
  approvedPublicResearchFixtures,files,
},null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildDemo();
