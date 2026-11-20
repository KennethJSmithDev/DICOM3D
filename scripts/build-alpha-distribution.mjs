// Assemble the existing Three/R3F frontend for Core and native IPM FileCopy.
import {readFile,writeFile,cp,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {PUBLIC_RESEARCH_ASSETS} from '../prototypes/alpha/viewer/src/public-source-binding.mjs';
import {copyNotices} from './admitted-public-files.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw Error('Usage: node scripts/build-alpha-distribution.mjs <fresh-output> [source-commit]');
const output=resolve(process.argv[2]),prototype=join(root,'prototypes/alpha/three-prototype');
const sourceBase=process.argv[3]??'SEE-EXACT-INPUTS';
if(/^[0-9a-f]{40}$/.test(sourceBase)){
 const head=spawnSync('git',['rev-parse','--verify','HEAD^{commit}'],{cwd:root,encoding:'utf8'});
 const status=spawnSync('git',['status','--porcelain=v1','--untracked-files=all'],{cwd:root,encoding:'utf8'});
 if(head.status!==0||head.stdout.trim()!==sourceBase||status.status!==0||status.stdout.trim())throw Error('Claimed source commit does not match a clean checkout');
}else if(!['SEE-EXACT-INPUTS','UNCOMMITTED-PACKAGING-CANDIDATE'].includes(sourceBase))throw Error('Invalid source identity');
const packageInfo=JSON.parse(await readFile(join(prototype,'package.json')));
const lock=JSON.parse(await readFile(join(prototype,'package-lock.json')));
const version=packageInfo.version;
if(!['0.7.0-alpha.1','0.7.0-alpha.2'].includes(version))throw Error('Unreviewed alpha version');
const descriptor=JSON.parse(await readFile(join(root,'distribution-manifest.json'),'utf8'));
if(descriptor.version!==version||descriptor.frontendProfile!=='three-r3f-alpha')throw Error('Source and distribution versions differ');
const sha=b=>createHash('sha256').update(b).digest('hex');
async function captureSourceInputs(){
 const inputs={};
 async function walk(at,relative){for(const e of (await readdir(at,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const name=relative+'/'+e.name;if(e.isSymbolicLink())throw Error('Linked build input refused: '+name);
  if(e.isDirectory())await walk(join(at,e.name),name);else if(e.isFile())inputs[name]=sha(await readFile(join(at,e.name)));else throw Error('Unexpected build input: '+name);
 }}
 await walk(join(prototype,'src'),'prototypes/alpha/three-prototype/src');
 await walk(join(root,'prototypes/alpha/viewer/src'),'prototypes/alpha/viewer/src');
 for(const name of ['package.json','package-lock.json','index.html','vite.config.js','build-public-review.mjs'])inputs['prototypes/alpha/three-prototype/'+name]=sha(await readFile(join(prototype,name)));
 for(const name of ['scripts/build-alpha-distribution.mjs','scripts/admitted-public-files.mjs','scripts/admitted-notices.json','scripts/preview-verified-file.mjs','distribution-manifest.json','LICENSE','NOTICE'])inputs[name]=sha(await readFile(join(root,name)));
 return inputs;
}
const sourceBefore=await captureSourceInputs();
if(/^[0-9a-f]{40}$/.test(sourceBase)){
 const listed=spawnSync('git',['ls-files','--stage','-z'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
 if(listed.status!==0)throw Error('Cannot inspect staged source identities');
 const staged=new Map(listed.stdout.split('\0').filter(Boolean).map(row=>{const tab=row.indexOf('\t'),[mode,oid,stage]=row.slice(0,tab).split(' ');return [row.slice(tab+1),{mode,oid,stage}]}));
 for(const name of Object.keys(sourceBefore)){
  const record=staged.get(name);
  if(!record||record.stage!=='0'||!['100644','100755'].includes(record.mode))throw Error('Untracked or nonregular build input: '+name);
  const data=await readFile(join(root,name));
  const actual=spawnSync('git',['hash-object','--path='+name,'--stdin'],{cwd:root,input:data,encoding:'utf8'});
  if(actual.status!==0||actual.stdout.trim()!==record.oid)throw Error('Build input differs from staged source: '+name);
 }
}
async function installedTreeIdentity(){
 const hash=createHash('sha256');let count=0,bytes=0;
 async function walk(at,prefix=''){
  for(const item of (await readdir(at,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
   const name=prefix+item.name,path=join(at,item.name);
   if(item.isSymbolicLink())throw Error('Linked installed dependency refused: '+name);
   if(item.isDirectory())await walk(path,name+'/');
   else if(item.isFile()){const data=await readFile(path);count++;bytes+=data.length;hash.update(name+'\0'+data.length+'\0'+sha(data)+'\n');}
   else throw Error('Unexpected installed dependency: '+name);
  }
 }
 await walk(join(prototype,'node_modules'));
 return {sha256:hash.digest('hex'),files:count,bytes,node:process.version,platform:process.platform,arch:process.arch};
}
const installedBefore=await installedTreeIdentity();
// The build imports installed modules, so a lockfile alone cannot establish
// which compiler ran. Refuse known version drift before producing any output.
const fromBuilder=createRequire(join(prototype,'build-public-review.mjs'));
const vitePath=fromBuilder.resolve('vite/package.json');
const fromVite=createRequire(vitePath);
const toolchain={};
for(const [name,path] of [['vite',vitePath],['rolldown',fromVite.resolve('rolldown/package.json')]]){
 const installed=JSON.parse(await readFile(path));
 const locked=lock.packages?.['node_modules/'+name];
 if(!locked||installed.name!==name||installed.version!==locked.version)throw Error('Installed '+name+' does not match the alpha lockfile');
 if(name==='vite'&&packageInfo.devDependencies?.vite!==locked.version)throw Error('Vite manifest does not match the alpha lockfile');
 toolchain[name]={version:installed.version,lockIntegrity:locked.integrity};
}
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
await copyNotices(join(root,'third-party'),join(output,'third-party'));
await cp(join(root,'distribution-manifest.json'),join(output,'distribution-manifest.json'));
for(const name of ['react-LICENSE.txt','react-dom-LICENSE.txt','three-LICENSE.txt','react-three-fiber-LICENSE.txt'])await readFile(join(output,'third-party/alpha',name));
const files={};
async function walk(at,relative=''){for(const e of (await readdir(at,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=relative+e.name;if(e.isSymbolicLink())throw Error('Distribution symlink refused');if(e.isDirectory())await walk(join(at,e.name),name+'/');else{const bytes=await readFile(join(at,e.name));if(bytes.length>=100000000)throw Error('Distribution file exceeds GitHub limit: '+name);files[name]={bytes:bytes.length,sha256:sha(bytes)};}}}
await walk(output);
const sourceInputs=await captureSourceInputs();
if(JSON.stringify(sourceInputs)!==JSON.stringify(sourceBefore))throw Error('Application build inputs changed during build');
const installedAfter=await installedTreeIdentity();
if(JSON.stringify(installedBefore)!==JSON.stringify(installedAfter))throw Error('Installed build inputs changed during build');
const manifest={schema:'dicom3d-alpha-distribution-1',profile:'three-r3f-alpha',release:version,entrypoint:'/dicom3d/reference.html',containsPrivatePatientImaging:false,patientDerivedResearchData:true,approvedPublicResearchFixtures:['H000'],approvedPublicResearchAssets:admitted,sourceBase,sourceIdentity:'Source commit is separate from the recorded actual installed build dependency tree; tree hash is not proof of upstream package integrity.',sourceInputs,buildToolchain:{...toolchain,installedTree:installedAfter},atlasIndexSha256:files['atlas/index.json'].sha256,files};
await writeFile(join(output,'demo-build-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({profile:manifest.profile,release:version,files:Object.keys(files).length,entrypoint:manifest.entrypoint,atlasIndexSha256:manifest.atlasIndexSha256}));
