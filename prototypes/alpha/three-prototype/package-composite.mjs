import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const [prior,build,output]=process.argv.slice(2);
if(!prior||!build||!output)throw Error('Usage: node package-composite.mjs <prior public> <vite output> <new package directory>');
const local=dirname(fileURLToPath(import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const priorManifest=await readFile(join(prior,'demo-build-manifest.json'));
if(sha(priorManifest)!=='58041de7f3a71d91e036b1e12c3f16c20b1df2d46af5b71ced0ddb0ae9db047b')throw Error('Expected the verified alpha runtime manifest');
await mkdir(output);
const files={};
async function put(name,bytes){
 const path=join(output,name);
 await mkdir(dirname(path),{recursive:true});
 await writeFile(path,bytes,{flag:'wx'});
 files[name]={bytes:bytes.length,sha256:sha(bytes)};
}
for(const [name,record] of Object.entries(JSON.parse(priorManifest).files)){
 if(!/^(atlas|attribution|demo|nrx)\/[\w./-]+$/.test(name)||name.split('/').includes('..'))continue;
 const bytes=await readFile(join(prior,name));
 if(bytes.length!==record.bytes||sha(bytes)!==record.sha256)throw Error('Prior package integrity mismatch: '+name);
 await put(name,bytes);
}
for(const name of await readdir(join(local,'atlas-delta'))){
 if(name==='female-delta.json')continue;
 await put('female-delta/'+name,await readFile(join(local,'atlas-delta',name)));
}
await put('index.html',await readFile(join(build,'index.html')));
for(const name of await readdir(join(build,'assets')))await put('assets/'+name,await readFile(join(build,'assets',name)));
await writeFile(join(output,'demo-build-manifest.json'),JSON.stringify({schema:'dicom3d-three-local-package-1',entrypoint:'/',build:'0.7.0-alpha.1-composite',files},null,2)+'\n');
