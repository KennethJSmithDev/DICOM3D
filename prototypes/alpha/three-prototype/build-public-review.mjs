import {readFile,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {copyAdmittedFlat} from '../../../scripts/admitted-public-files.mjs';
import {PUBLIC_RESEARCH_ASSETS} from '../viewer/src/public-source-binding.mjs';

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
const deltaBytes=await readFile(join(here,'atlas-delta','female-delta.json'));
if(sha(deltaBytes)!=='a7ad06851a0f87a1f91673c9b91bf2a8e674a96744028b06d655085b8415cee4')throw Error('Female descriptor integrity mismatch');
const delta=JSON.parse(deltaBytes);
for(const [name,hash,length] of [[delta.url,delta.sha256,delta.byteLength],[delta.manifestUrl,delta.manifestSha256],[delta.sourceNative.url,delta.sourceNative.sha256,delta.sourceNative.byteLength]]){const bytes=await readFile(join(here,'atlas-delta',name));if(sha(bytes)!==hash||(length!==undefined&&bytes.length!==length))throw Error('Female integrity mismatch: '+name);}

for(const bundle of bundles){
 const [mesh,manifest]=await Promise.all([readFile(join(source,bundle.url)),readFile(join(source,bundle.manifestUrl))]);
 if(mesh.length!==bundle.byteLength||sha(mesh)!==bundle.sha256||sha(manifest)!==bundle.manifestSha256)throw Error('Bundle integrity mismatch: '+bundle.id);
}
const atlas={'index.json':{sha256:indexSha},'LICENSE.md':{sha256:'bab5d23320d2aaacbd72f9f5d62b082fb6319b3de434f75ad587c7e5dfdff024'},[sourceNative.url]:{sha256:sourceNative.sha256,bytes:sourceNative.byteLength}};
for(const bundle of bundles){atlas[bundle.url]={sha256:bundle.sha256,bytes:bundle.byteLength};atlas[bundle.manifestUrl]={sha256:bundle.manifestSha256};}
const female={
 'female-delta.json':{sha256:sha(deltaBytes)},'HRA-FEMALE-NOTICE.txt':{sha256:'cf715c70da92f480733fc6930caf3222bef53767c7840f1e643607612b1a5070'},
 'female-reproductive-delta.glb':{sha256:'8902e11a7487e021ef88c73201178b00d2dfac384a4d91f9737d3ca4f8eea812'},
 'female-reproductive-delta.manifest.json':{sha256:'9a5b53500ac94ea36349d1dd6f9c9408d06709bd4ecab1f74df0840126dfd1b7'},
 [delta.url]:{sha256:delta.sha256,bytes:delta.byteLength},[delta.manifestUrl]:{sha256:delta.manifestSha256},
 [delta.sourceNative.url]:{sha256:delta.sourceNative.sha256,bytes:delta.sourceNative.byteLength},
};
const h000=Object.fromEntries(Object.values(PUBLIC_RESEARCH_ASSETS).map(a=>[a.filename,{sha256:a.sha256,bytes:a.bytes}]));
await mkdir(output);
await copyAdmittedFlat(source,join(output,'atlas'),atlas);
await copyAdmittedFlat(join(published,'demo','h000'),join(output,'demo','h000'),h000);
await copyAdmittedFlat(join(here,'atlas-delta'),join(output,'female-delta'),female);
process.env.VITE_REVIEW_ATLAS_SHA=indexSha;
await build({root:here,build:{outDir:output,emptyOutDir:false}});
await mkdir(join(output,'attribution'));
await cp(join(output,'atlas','LICENSE.md'),join(output,'attribution','BODYParts3D-NOTICE.txt'));
console.log(JSON.stringify({owners:structures.length,chunks:bundles.length,indexSha256:indexSha}));
