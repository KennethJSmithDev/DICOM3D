import {BufferAttribute,BufferGeometry} from 'three';
export const nrxSegLifecycle={created:0,terminated:0,active:0};
export function generateNrxH000Surface(study,{signal}={}){
 return new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(new DOMException('Cancelled','AbortError'));return}
 if(study?.binding?.semanticId!=='lesion.lung.mass.001'||study.binding.segment!==1||!(study.mask instanceof Uint8Array)){reject(Error('Admitted H000 SEG required'));return}
 let worker;try{worker=new Worker(new URL('./nrx-worker.js',import.meta.url),{type:'module'});}catch(e){reject(e);return}
 nrxSegLifecycle.created++;nrxSegLifecycle.active++;let done=false;
 const finish=()=>{if(done)return false;done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);worker.terminate();nrxSegLifecycle.terminated++;nrxSegLifecycle.active--;return true};
 const cancel=()=>{if(finish())reject(new DOMException('Cancelled','AbortError'))};const timer=setTimeout(()=>{if(finish())reject(Error('NRX surface exceeded 30-second deadline'))},30000);signal?.addEventListener('abort',cancel,{once:true});
 worker.onerror=e=>{if(finish())reject(Error(e.message||'NRX worker failed'))};
 worker.onmessage=({data})=>{if(!finish())return;if(data.error){reject(Error(data.error));return}let geometry;
 try{const positions=new Float32Array(data.positions);if(positions.length!==data.provenance.triangles*9||positions.some(v=>!Number.isFinite(v)))throw Error('Invalid NRX display coordinates');geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.computeVertexNormals();const normals=geometry.getAttribute('normal'),sums=new Map(),keys=[];for(let i=0;i<positions.length;i+=3){const key=[positions[i],positions[i+1],positions[i+2]].join(',');keys.push(key);const sum=sums.get(key)||[0,0,0];for(let a=0;a<3;a++)sum[a]+=normals.array[i+a];sums.set(key,sum)}for(let i=0;i<keys.length;i++){const v=sums.get(keys[i]),length=Math.hypot(...v)||1;normals.setXYZ(i,v[0]/length,v[1]/length,v[2]/length)}normals.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();const provenance={...data.provenance,segSop:study.binding.segSop,maskNpySha256:study.manifest.provenance.C_mask.sha256,ctNpySha256:study.manifest.provenance.B_volume.sha256};geometry.userData.provenance=provenance;resolve({geometry,provenance});}catch(e){geometry?.dispose();reject(e)}
 };
 try{const mask=study.mask.slice();worker.postMessage({mask:mask.buffer,count:study.binding.count,matrices:study.manifest.spatial.matrices},[mask.buffer]);}catch(error){if(finish())reject(error)}
 });
}
