import {BufferAttribute,BufferGeometry} from 'three';
import {prepareReferenceOwner,NRX_LIMITS} from './nrx-reference-input.js';
import {smoothCoincidentNormals} from './smooth-display-normals.js';
export const nrxReferenceLifecycle={created:0,terminated:0,active:0};
const FILES=Object.freeze({'native.js':'c2798c8edaa60d7768c6db448de2ee3f908e5529c36c07028f36cbee6d7aeb1c','native.wasm':'34c3d466ed3b8c3c4c7863ea178cd40463d2fd08cde0afcbad1750aab0aa0b19'});
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function verified(name,signal){const response=await fetch(`${import.meta.env.BASE_URL}nrx/${name}`,{signal});if(!response.ok)throw Error(`NRX ${name}: HTTP ${response.status}`);const bytes=await response.arrayBuffer();if(await sha256(bytes)!==FILES[name])throw Error(`NRX integrity mismatch: ${name}`);return bytes;}
let active=null;
export async function loadNrxReferenceSurface({bundles,sourceOwner,selected=sourceOwner?.userData?.semanticId,resolution=32,signal,timeoutMs=90000}){
 if(!NRX_LIMITS.resolutions.includes(resolution))throw Error('Only bounded N32/N64 are supported');
 if(active)throw Error('Another reference NRX extraction is active');const token={};active=token;
 let worker,terminated=false;const terminateWorker=()=>{if(worker&&!terminated){terminated=true;worker.terminate();nrxReferenceLifecycle.terminated++;nrxReferenceLifecycle.active--;}};const releaseOnAbort=()=>{terminateWorker();if(active===token)active=null;};signal?.addEventListener('abort',releaseOnAbort,{once:true});
 try{
  signal?.throwIfAborted();const input=prepareReferenceOwner(sourceOwner?new Map([['selected',{scene:sourceOwner}]]):bundles,selected);
  const [js,wasm,payloadSha,sourcePositionsSha]=await Promise.all([verified('native.js',signal),verified('native.wasm',signal),sha256(input.bytes),sha256(input.positions)]);
  signal?.throwIfAborted();worker=new Worker(new URL('./nrx-reference-worker.js',import.meta.url));nrxReferenceLifecycle.created++;nrxReferenceLifecycle.active++;
  const result=await new Promise((resolve,reject)=>{
   const finish=(error,value)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
   const abort=()=>{terminateWorker();finish(new DOMException('Cancelled','AbortError'));};
   const timer=setTimeout(()=>{terminateWorker();finish(Error('Bounded NRX extraction timed out; source retained'));},timeoutMs);
   signal?.addEventListener('abort',abort,{once:true});
   worker.onerror=e=>finish(Error(e.message||'NRX worker failed'));
   worker.onmessage=({data})=>data.ok?finish(null,data):finish(Error(data.error));
   worker.postMessage({js,wasm,payload:input.bytes.buffer,vertices:input.positionCount,indices:input.indexCount,resolution},[js,wasm,input.bytes.buffer]);
  });
  signal?.throwIfAborted();const data=new Float32Array(result.output),count=data.length/8,positions=new Float32Array(count*3),normals=new Float32Array(count*3);
  for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++){const p=data[i*8+axis],n=data[i*8+4+axis];if(!Number.isFinite(p)||!Number.isFinite(n))throw Error('Nonfinite derived geometry');positions[i*3+axis]=p*input.scale+input.center[axis];normals[i*3+axis]=n;}
  let sourceColor=null;input.owner.traverse(node=>{const material=Array.isArray(node.material)?node.material[0]:node.material;if(!sourceColor&&material?.color)sourceColor='#'+material.color.getHexString();});
  const displayNormals=smoothCoincidentNormals(positions,normals);const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setAttribute('normal',new BufferAttribute(displayNormals,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const provenance={sourceId:selected,sourceAssetSha256:input.sourceAssetSha256,sourcePositionsSha256:sourcePositionsSha,normalizedPayloadSha256:payloadSha,wasmSha256:FILES['native.wasm'],resolution,normalPresentation:'Averaged incident normals at exact Float32 position matches; extracted positions unchanged',sourceMaterialColor:sourceColor,triangleCount:count/3,fieldReport:result.report,centerLocal:input.center,scaleLocal:input.scale,sourceTransform:'owner-local geometry; display follows owner world matrix',classification:'Approximate generalized reference derivative; not patient imaging or segmentation',globalAccuracy:'Unverified; native sampled bounds and topology apply only if generation passes'};geometry.userData.provenance=provenance;
  return {geometry,owner:input.owner,sourceColor,provenance,dispose(){geometry.dispose();}};
 }finally{terminateWorker();signal?.removeEventListener('abort',releaseOnAbort);if(active===token)active=null;}
}
