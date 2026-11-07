import {readFile,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

const here=dirname(fileURLToPath(import.meta.url));
const published=resolve(here,'../../../reference/public');
if(!process.argv[2])throw Error('Usage: node build-public-review.mjs <new output directory>');
const output=resolve(process.argv[2]);
const source=join(here,'expanded-atlas');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const catalog=await readFile(join(source,'index.json'));
const indexSha=sha(catalog);
if(indexSha!=='574feef9e1e659a644cf51a51042e8c65b6433455b95070b7ae89aa681357478')throw Error('Expanded catalog integrity mismatch');
const {structures,bundles,sourceNative}=JSON.parse(catalog);
const nativeBytes=await readFile(join(source,sourceNative.url));if(nativeBytes.length!==sourceNative.byteLength||sha(nativeBytes)!==sourceNative.sha256)throw Error('Source catalog integrity mismatch');
const delta=JSON.parse(await readFile(join(here,'atlas-delta','female-delta.json')));
for(const [name,hash,length] of [[delta.url,delta.sha256,delta.byteLength],[delta.manifestUrl,delta.manifestSha256],[delta.sourceNative.url,delta.sourceNative.sha256,delta.sourceNative.byteLength]]){const bytes=await readFile(join(here,'atlas-delta',name));if(sha(bytes)!==hash||(length!==undefined&&bytes.length!==length))throw Error('Female integrity mismatch: '+name);}

for(const bundle of bundles){
 const [mesh,manifest]=await Promise.all([readFile(join(source,bundle.url)),readFile(join(source,bundle.manifestUrl))]);
 if(mesh.length!==bundle.byteLength||sha(mesh)!==bundle.sha256||sha(manifest)!==bundle.manifestSha256)throw Error('Bundle integrity mismatch: '+bundle.id);
}
await mkdir(output);
await cp(source,join(output,'atlas'),{recursive:true});
process.env.VITE_REVIEW_ATLAS_SHA=indexSha;
await build({root:here,build:{outDir:output,emptyOutDir:false}});
await cp(join(published,'demo','h000'),join(output,'demo','h000'),{recursive:true});
await mkdir(join(output,'attribution'));
await cp(join(source,'LICENSE.md'),join(output,'attribution','BODYParts3D-NOTICE.txt'));
await cp(join(here,'atlas-delta'),join(output,'female-delta'),{recursive:true});
console.log(JSON.stringify({owners:structures.length,chunks:bundles.length,indexSha256:indexSha}));
