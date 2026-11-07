// Assemble the existing Three/R3F frontend for Core and native IPM FileCopy.
import {readFile,writeFile,cp,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {PUBLIC_RESEARCH_ASSETS} from '../prototypes/alpha/viewer/src/public-source-binding.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw Error('Usage: node scripts/build-alpha-distribution.mjs <fresh-output> [source-commit]');
const output=resolve(process.argv[2]),prototype=join(root,'prototypes/alpha/three-prototype');
const version=JSON.parse(await readFile(join(prototype,'package.json'))).version;
if(version!=='0.7.0-alpha.1')throw Error('Unreviewed alpha version');
const sha=b=>createHash('sha256').update(b).digest('hex');
const admitted={};
for(const asset of Object.values(PUBLIC_RESEARCH_ASSETS)){
 const bytes=await readFile(join(root,'reference/public/demo/h000',asset.filename));
 if(bytes.length!==asset.bytes||sha(bytes)!==asset.sha256)throw Error('Unadmitted public H000 asset: '+asset.filename);
 admitted[asset.filename]={bytes:asset.bytes,sha256:asset.sha256};
}
// The builder refuses an existing output; create only its possibly absent parent.
await mkdir(dirname(output),{recursive:true});
const built=spawnSync(process.execPath,[join(prototype,'build-public-review.mjs'),output],{stdio:'inherit',cwd:root});
if(built.status!==0)process.exit(built.status??1);
// Preserve existing installed bookmarks and the exact051 retirement guard.
// This is the SAME alpha HTML, not a second frontend implementation.
await cp(join(output,'index.html'),join(output,'reference.html'));
await mkdir(join(output,'reference'));
await cp(join(output,'attribution/BODYParts3D-NOTICE.txt'),join(output,'reference/BODYParts3D-NOTICE.txt'));
for(const name of ['LICENSE','NOTICE'])await cp(join(root,name),join(output,name));
await cp(join(root,'third-party'),join(output,'third-party'),{recursive:true});
await cp(join(root,'distribution-manifest.json'),join(output,'distribution-manifest.json'));
for(const name of ['react-LICENSE.txt','react-dom-LICENSE.txt','three-LICENSE.txt','react-three-fiber-LICENSE.txt'])await readFile(join(output,'third-party/alpha',name));
const files={};
async function walk(at,relative=''){for(const e of (await readdir(at,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=relative+e.name;if(e.isSymbolicLink())throw Error('Distribution symlink refused');if(e.isDirectory())await walk(join(at,e.name),name+'/');else{const bytes=await readFile(join(at,e.name));if(bytes.length>=100000000)throw Error('Distribution file exceeds GitHub limit: '+name);files[name]={bytes:bytes.length,sha256:sha(bytes)};}}}
await walk(output);
const sourceInputs={};
async function inputs(at,relative){for(const e of (await readdir(at,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=relative+'/'+e.name;if(e.isDirectory())await inputs(join(at,e.name),name);else if(e.isFile())sourceInputs[name]=sha(await readFile(join(at,e.name)));}}
await inputs(join(prototype,'src'),'prototypes/alpha/three-prototype/src');
await inputs(join(root,'prototypes/alpha/viewer/src'),'prototypes/alpha/viewer/src');
for(const name of ['package.json','package-lock.json','index.html','vite.config.js','build-public-review.mjs'])sourceInputs['prototypes/alpha/three-prototype/'+name]=sha(await readFile(join(prototype,name)));
const manifest={schema:'dicom3d-alpha-distribution-1',profile:'three-r3f-alpha',release:version,entrypoint:'/dicom3d/reference.html',containsPrivatePatientImaging:false,patientDerivedResearchData:true,approvedPublicResearchFixtures:['H000'],approvedPublicResearchAssets:admitted,sourceBase:process.argv[3]??'SEE-EXACT-INPUTS',sourceIdentity:'Exact application inputs below; staged package manifest binds the packaging commit.',sourceInputs,atlasIndexSha256:files['atlas/index.json'].sha256,files};
await writeFile(join(output,'demo-build-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({profile:manifest.profile,release:version,files:Object.keys(files).length,entrypoint:manifest.entrypoint,atlasIndexSha256:manifest.atlasIndexSha256}));
