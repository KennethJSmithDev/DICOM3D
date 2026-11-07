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
if(indexSha!=='8e3b71c6eb259a55532d8b3f45a58057eedbc587857ebb99c2efab4ca4c7faac')throw Error('Expanded catalog integrity mismatch');
const {structures,bundles}=JSON.parse(catalog);
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
