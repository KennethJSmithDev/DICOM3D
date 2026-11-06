import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Group,Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {build} from 'vite';

globalThis.FileReader=class {
 async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend();}
};
const here=dirname(fileURLToPath(import.meta.url));
const published=resolve(here,'../../../reference/public');
if(!process.argv[2])throw Error('Usage: node build-public-review.mjs <new output directory>');
const output=resolve(process.argv[2]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const baseFile='bp3d-male.glb';
const source=await readFile(join(published,'reference',baseFile));
if(sha(source)!=='c44f884861550d92e54bae4beb8ebfd5b4927d61c37034e5f6a61f7b4b41d4d4')throw Error('Unexpected published BodyParts3D geometry');
const manifest=JSON.parse(await readFile(join(published,'reference','bp3d-male.manifest.json')));
const scene=(await new GLTFLoader().parseAsync(Uint8Array.from(source).buffer,'')).scene;
scene.updateMatrixWorld(true);
const center=new Box3().setFromObject(scene.getObjectByName('FMA15900')).getCenter(new Vector3());
if(center.distanceTo(new Vector3(-0.000761399045586586,0.809860497713089,0.0923826526850462))>0.00001)throw Error('Published bladder differs from the verified delta anchor');
const groups=new Map(),structures=[],bundles=[];
for(const part of manifest.reference.structures){
 const id='classified-'+part.region.toLowerCase().replaceAll(' ','-');
 if(!groups.has(id))groups.set(id,[]);
 groups.get(id).push({...part,bundleId:id});
}
await mkdir(output);
await mkdir(join(output,'atlas'));
for(const [id,parts] of groups){
 const group=new Group();
 for(const part of parts){
  const node=scene.getObjectByName(part.id);
  if(!node)throw Error('Missing published owner '+part.id);
  const child=node.clone(true);
  node.matrixWorld.decompose(child.position,child.quaternion,child.scale);
  group.add(child);
 }
 const bytes=Buffer.from(await new GLTFExporter().parseAsync(group,{binary:true}));
 if(bytes.length>=100_000_000)throw Error('Chunk is oversized: '+id);
 const url=id+'.glb',manifestUrl=id+'.manifest.json';
 const meta=JSON.stringify({...manifest,asset:{...manifest.asset,relative_filename:url,sha256:sha(bytes)},reference:{...manifest.reference,structures:parts,hierarchy:[]}});
 await writeFile(join(output,'atlas',url),bytes);
 await writeFile(join(output,'atlas',manifestUrl),meta);
 bundles.push({id,url,manifestUrl,byteLength:bytes.length,sha256:sha(bytes),manifestSha256:sha(meta),structureIds:parts.map(part=>part.id)});
 structures.push(...parts);
}
const catalog=JSON.stringify({schema:'DICOM3D-semantic-atlas-1',structures,bundles,held:[]});
await writeFile(join(output,'atlas','index.json'),catalog);
process.env.VITE_REVIEW_ATLAS_SHA=sha(catalog);
await build({root:here,build:{outDir:output,emptyOutDir:false}});
await cp(join(published,'demo','h000'),join(output,'demo','h000'),{recursive:true});
await mkdir(join(output,'attribution'));
await cp(join(published,'reference','BODYParts3D-NOTICE.txt'),join(output,'attribution','BODYParts3D-NOTICE.txt'));
await cp(join(here,'atlas-delta'),join(output,'female-delta'),{recursive:true});
console.log(JSON.stringify({owners:structures.length,chunks:bundles.length,largestChunk:Math.max(...bundles.map(x=>x.byteLength)),indexSha256:sha(catalog)}));
