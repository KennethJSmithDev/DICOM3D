import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {prepareReferenceOwner} from './nrx-reference-input.js';
globalThis.ProgressEvent??=class extends Event{};
const bytes=await readFile(process.env.DICOM3D_ABDOMEN_FIXTURE);
const scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
scene.traverse(n=>{if(n.name.startsWith('FMA'))n.userData.semanticId=n.name;});
const bundles=new Map([['abdomen',{scene}]]),rows=[];
for(const id of ['FMA7148','FMA7204','FMA7205']){
 try{const result=prepareReferenceOwner(bundles,id);rows.push({id,accepted:true,vertices:result.positionCount,triangles:result.indexCount/3,center:result.center,scale:result.scale,volume:result.sourceVolumeLocal});assert.equal(id,'FMA7148');}
 catch(error){rows.push({id,accepted:false,error:error.message});if(id==='FMA7148')throw error;assert.match(error.message,/ABI limit/);}
}
console.log(JSON.stringify(rows,null,2));await writeFile(new URL('./packing-result.json',import.meta.url),JSON.stringify(rows,null,2));
