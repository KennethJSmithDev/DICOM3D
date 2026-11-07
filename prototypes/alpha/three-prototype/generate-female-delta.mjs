import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {Box3,Group,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';

// GLTFExporter uses the browser FileReader interface for binary output.
globalThis.FileReader=class {
 async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend();}
};
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node generate-female-delta.mjs <verified package public directory> <new output directory>');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const loader=new GLTFLoader();
const parse=async bytes=>(await loader.parseAsync(Uint8Array.from(bytes).buffer,'')).scene;
const source=Buffer.concat(await Promise.all([1,2,3].map(i=>readFile(join(input,'female','hra-female.glb.part00'+i)))));
const sourceSha=sha(source);
if(sourceSha!=='24abc4d8bd0a00bfc93ab45e227c1e9b157ffc0d21d1e5c22408fbe3933f60cb')throw Error('Unexpected HRA geometry');
const metadata=await readFile(join(input,'female','hra-female.manifest.json'));
if(sha(metadata)!=='4f98280af464abee0f7ca78126cf2b8f7e09765077410e3409e3b047a3c2d1ce')throw Error('Unexpected HRA metadata');
const {reference}=JSON.parse(metadata);
const scene=await parse(source);
scene.updateMatrixWorld(true);
const ids=['VH_F_urinary_bladder','VH_F_uterus','VH_F_left_ovary','VH_F_right_ovary','VH_F_fallopian_tube_L','VH_F_fallopian_tube_R','VH_F_vagina'];
const center=node=>new Box3().setFromObject(node).getCenter(new Vector3());
const bladder=scene.getObjectByName(ids[0]);
if(center(scene.getObjectByName(ids[2])).x<=center(scene.getObjectByName(ids[3])).x)throw Error('Unexpected HRA laterality');
// Published shared-base coordinates use metres, Y up, and positive X on the left.
// Align the bladder bounding-box center with translation only. This is a visual fit.
const anchor=new Vector3(-0.000761399045586586,0.809860497713089,0.0923826526850462);
const offset=anchor.clone().sub(center(bladder));
const group=new Group();
for(const id of ids){
 const node=scene.getObjectByName(id);
 if(!node)throw Error('Missing source owner '+id);
 const mesh=node.clone(true);
 mesh.matrix.copy(node.matrixWorld);
 mesh.matrix.setPosition(new Vector3().setFromMatrixPosition(mesh.matrix).add(offset));
 mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);
 group.add(mesh);
}
const bytes=Buffer.from(await new GLTFExporter().parseAsync(group,{binary:true}));
if(bytes.length>=100_000_000)throw Error('Delta exceeds asset ceiling');
const check=await parse(bytes);
for(const id of ids)if(!check.getObjectByName(id))throw Error('Missing exported owner '+id);
const structures=ids.map(id=>reference.structures.find(part=>part.id===id));
const url='female-reproductive-delta.glb';
const manifest={asset:{relative_filename:url,sha256:sha(bytes)},reference:{id:'HRA-FEMALE-DELTA-1',structures},provenance:{sourceSha256:sourceSha,anchor:'Bladder bounding-box center',translationMetres:offset.toArray(),fit:'Approximate translation only'}};
const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
const descriptor={id:'female-reproductive-delta',url,sha256:sha(bytes),byteLength:bytes.length,manifestUrl:'female-reproductive-delta.manifest.json',manifestSha256:sha(manifestBytes),structureIds:ids};
await mkdir(output,{recursive:true});
await writeFile(join(output,url),bytes,{flag:'wx'});
await writeFile(join(output,descriptor.manifestUrl),manifestBytes,{flag:'wx'});
await writeFile(join(output,'female-delta.json'),JSON.stringify(descriptor,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({descriptor,offset:offset.toArray()}));
