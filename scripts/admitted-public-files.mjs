// Copy only reviewed public inputs; never infer admission from a generated inventory.
import {readdir,readFile,mkdir,writeFile,lstat} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {readVerifiedFile} from './preview-verified-file.mjs';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const valid=name=>typeof name==='string'&&/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(name)&&name!=='.'&&name!=='..';
export async function copyAdmittedFlat(source,destination,records){
 const names=Object.keys(records).sort();
 if(!names.every(valid))throw Error('Invalid admitted public filename');
 const entries=await readdir(source,{withFileTypes:true});
 if(entries.some(e=>!e.isFile()||e.isSymbolicLink())||JSON.stringify(entries.map(e=>e.name).sort())!==JSON.stringify(names))throw Error('Unexpected or missing public input');
 // Read and check everything before writing any public file.
 const content=[];
 for(const name of names){
  const file=join(source,name),info=await lstat(file),expected=records[name];
  if(!info.isFile()||info.isSymbolicLink()||!expected||!/^[0-9a-f]{64}$/.test(expected.sha256))throw Error('Invalid admitted public input: '+name);
  let bytes;try{bytes=readVerifiedFile(file,{bytes:expected.bytes??info.size,sha256:expected.sha256});}
  catch{throw Error('Admitted public input changed: '+name);}
  content.push([name,bytes]);
 }
 await mkdir(destination,{recursive:true});
 for(const [name,bytes] of content)await writeFile(join(destination,name),bytes,{flag:'wx'});
}

// These are distribution notices, not a wildcard over the local directory.
export const THIRD_PARTY_NOTICES=Object.freeze([
 'alpha-runtime-NOTICE.txt','babylon-lite-1.32.0-LICENSE.txt','babylon-lite-1.32.0-NOTICE.txt',
 'rolldown-1.2.12-LICENSE.txt','rolldown-1.2.12-THIRD-PARTY-LICENSE.txt','vite-8.3.0-CORE-LICENSE.txt',
 'alpha/babel-runtime-7.29.7-LICENSE.txt','alpha/base64-js-1.5.1-LICENSE.txt','alpha/buffer-6.0.3-LICENSE.txt',
 'alpha/ieee754-1.2.1-LICENSE.txt','alpha/its-fine-2.0.0-LICENSE.txt','alpha/react-dom-LICENSE.txt',
 'alpha/react-LICENSE.txt','alpha/react-three-fiber-LICENSE.txt','alpha/react-use-measure-2.1.7-LICENSE.txt',
 'alpha/rolldown-1.2.13-LICENSE.txt','alpha/rolldown-1.2.13-THIRD-PARTY-LICENSE.txt',
 'alpha/rolldown-1.2.18-LICENSE.txt','alpha/rolldown-1.2.18-THIRD-PARTY-LICENSE.txt',
 'alpha/scheduler-0.27.0-LICENSE.txt','alpha/suspend-react-0.1.3-LICENSE.txt','alpha/three-LICENSE.txt',
 'alpha/use-sync-external-store-1.6.0-LICENSE.txt','alpha/vite-8.2.4-LICENSE.txt',
 'alpha/vite-8.3.7-LICENSE.txt','alpha/zustand-5.0.14-LICENSE.txt',
]);
export async function copyNotices(source,destination){
 const admitted=JSON.parse(await readFile(new URL('./admitted-notices.json',import.meta.url),'utf8'));
 if(JSON.stringify(Object.keys(admitted).sort())!==JSON.stringify([...THIRD_PARTY_NOTICES].sort()))throw Error('Invalid notice admission list');
 const dirs=[['',THIRD_PARTY_NOTICES.filter(n=>!n.includes('/'))],['alpha',THIRD_PARTY_NOTICES.filter(n=>n.startsWith('alpha/')).map(n=>n.slice(6))]];
 const top=await readdir(source,{withFileTypes:true});
 if(top.filter(e=>e.isDirectory()&&!e.isSymbolicLink()).map(e=>e.name).join()!=='alpha'||top.some(e=>e.isSymbolicLink()||(!e.isDirectory()&&!e.isFile())))throw Error('Unexpected notice directory');
 const records=[];
 for(const [sub,names] of dirs){
  const at=join(source,sub),entries=(await readdir(at,{withFileTypes:true})).filter(e=>sub||e.name!=='alpha');
  if(entries.some(e=>!e.isFile()||e.isSymbolicLink())||JSON.stringify(entries.map(e=>e.name).sort())!==JSON.stringify(names.slice().sort()))throw Error('Unexpected or missing notice input');
  for(const name of names){const path=join(at,name),key=sub?sub+'/'+name:name;if(!(await lstat(path)).isFile())throw Error('Invalid notice');records.push([join(destination,sub,name),readVerifiedFile(path,admitted[key])]);}
 }
 for(const [path,bytes] of records){await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'});}
}
