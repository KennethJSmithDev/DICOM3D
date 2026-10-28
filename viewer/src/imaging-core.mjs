// WHY: source identity, integrity and geometry must survive optional module removal.
// BOUNDARY: raw16 spatial-source contract v1 only; no modality, decoder or renderer dependency.
// INVARIANT: immutable source identities and original stored values; no reorientation/resampling.
import {digest} from './imaging-primitives.mjs';
import {ImagingRejection} from './imaging-contract.mjs';
import {point} from './ct-spatial.mjs';
const admitted=new WeakSet();
const need=(v,code)=>{if(!v)throw new ImagingRejection('SOURCE_INVALID',{reasons:[code]});};
const uid=v=>typeof v==='string'&&/^\d+(\.\d+)+$/.test(v)&&v.length<=64;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const near=(a,b,e=1e-7)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=e);
export const isVerifiedVolume=v=>admitted.has(v);
export async function verifySpatialSource(input,buffer,pixels,{signal}={}){
  const check=()=>{if(signal?.aborted)throw new ImagingRejection('CANCELLED');};check();
  // Copy only metadata. Payload ownership is transferred by the caller and rehashed on demand.
  const d=JSON.parse(JSON.stringify(input));
  need(d.schema==='DICOM3D-verified-volume-1','schema');
  const {shape,source,storage,calibration,geometry,frames,payload}=d;
  const keys=(v,allowed)=>need(v&&typeof v==='object'&&Object.keys(v).every(k=>allowed.includes(k)),'unrecognized/transport field');
  keys(d,['schema','shape','source','storage','calibration','geometry','frames','payload']);
  keys(source,['modality','studyIdentity','seriesIdentity','frameOfReferenceIdentity']);keys(storage,['dtype','bitsStored','highBit','photometric']);keys(calibration,['slope','intercept','rescaleType','center','width','voiFunction']);keys(geometry,['pixelSpacingRowColumnMm','imageOrientationPatient','matrices']);keys(payload,['bytes','sha256']);
  need(Array.isArray(frames),'frames');for(const f of frames)keys(f,['k','sourceFrame','sopIdentity','pixelSha256','sourceFileSha256','imagePositionPatient']);

  need(Array.isArray(shape)&&shape.length===3&&shape.every(v=>Number.isSafeInteger(v)&&v>=1),'shape');
  const [K,R,C]=shape,count=K*R*C;
  need(Number.isSafeInteger(count)&&buffer instanceof ArrayBuffer&&buffer.byteLength===count*2,'payload shape');
  need((pixels instanceof Int16Array||pixels instanceof Uint16Array)&&pixels.buffer===buffer&&pixels.byteOffset===0&&pixels.length===count,'stored view ownership');
  need(typeof source?.modality==='string'&&source.modality.length>0&&[source.studyIdentity,source.seriesIdentity,source.frameOfReferenceIdentity].every(uid),'source identities');
  need(hash(payload?.sha256)&&payload.bytes===buffer.byteLength&&await digest(buffer)===payload.sha256,'payload digest');
  need(new Uint8Array(new Uint16Array([1]).buffer)[0]===1,'host endian');
  const m=geometry?.matrices;keys(m,['index_to_patient_mm','patient_mm_to_index','patient_mm_to_model_m','model_m_to_patient_mm']);
  for(const name of ['index_to_patient_mm','patient_mm_to_index','patient_mm_to_model_m','model_m_to_patient_mm']){
    const a=m?.[name];need(a?.length===4&&a.every(r=>r.length===4&&r.every(Number.isFinite))&&near(a[3],[0,0,0,1],0),'affine');
  }
  // Existing model convention: patient mm to model metres, including declared axis mapping.
  need(near(m.patient_mm_to_model_m.flat(),[-.001,0,0,0,0,0,.001,0,0,.001,0,0,0,0,0,1],1e-12),'model units/convention');
  const iop=geometry.imageOrientationPatient,spacing=geometry.pixelSpacingRowColumnMm;
  need(iop?.length===6&&iop.every(Number.isFinite)&&spacing?.length===2&&spacing.every(v=>Number.isFinite(v)&&v>0),'orientation/spacing');
  const x=iop.slice(0,3),y=iop.slice(3),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),normal=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
  need(Math.abs(dot(x,x)-1)<1e-6&&Math.abs(dot(y,y)-1)<1e-6&&Math.abs(dot(x,y))<1e-6,'orthonormal axes');
  need(near(m.index_to_patient_mm.slice(0,3).map(r=>r[1]),y.map(v=>v*spacing[0]))&&near(m.index_to_patient_mm.slice(0,3).map(r=>r[2]),x.map(v=>v*spacing[1])),'pixel axes');
  const step=m.index_to_patient_mm.slice(0,3).map(r=>r[0]);need(dot(step,normal)>0,'slice order');
  need(frames?.length===K,'frame count');const ids=new Set();let last=-Infinity;
  for(let k=0;k<K;k++){check();
    const f=frames[k];need(f.k===k&&Number.isInteger(f.sourceFrame)&&f.sourceFrame>=1&&uid(f.sopIdentity)&&!ids.has(f.sopIdentity+'|'+f.sourceFrame)&&hash(f.pixelSha256)&&hash(f.sourceFileSha256),'frame identity');ids.add(f.sopIdentity+'|'+f.sourceFrame);
    need(f.imagePositionPatient?.length===3&&f.imagePositionPatient.every(Number.isFinite),'frame position');
    const projection=dot(f.imagePositionPatient,normal);need(projection>last,'strict source order');last=projection;
    need(near(point(m.index_to_patient_mm,[k,0,0]),f.imagePositionPatient,.001),'nonuniform origins');
    need(await digest(buffer.slice(k*R*C*2,(k+1)*R*C*2))===f.pixelSha256,'frame digest');
  }
  for(const p of [[0,0,0],[K-1,R-1,C-1],[(K-1)/2,(R-1)*.375,(C-1)*.625]]){
    const patient=point(m.index_to_patient_mm,p);need(near(point(m.patient_mm_to_index,patient),p,1e-6)&&near(point(m.model_m_to_patient_mm,point(m.patient_mm_to_model_m,patient)),patient,1e-7),'inverse');
  }
  // Renderer-facing metadata is an allowlist: no adapter name, URL, file path or credential.
  const descriptor=freeze({schema:d.schema,shape,source,storage,calibration,geometry,frames,payload});
  check();
  const verified=Object.freeze({descriptor,pixels,async assertSourceUnchanged(){need(await digest(buffer)===payload.sha256,'source mutation');return true;}});
  admitted.add(verified);return verified;
}

// Publication is core-owned and atomic. Rejection/cancellation cannot erase a newer generation.
export function createPublicationOwner(){
 let generation=0,current=null;
 return Object.freeze({begin(){current=null;return ++generation;},cancel(){generation++;current=null;},guard(stamp){if(stamp!==generation)throw new ImagingRejection('STALE_GENERATION');},publish(value,stamp){this.guard(stamp);if(!isVerifiedVolume(value))throw new ImagingRejection('UNVERIFIED_PUBLICATION');current=value;return value;},reject(stamp){if(stamp===generation)current=null;},snapshot(){return Object.freeze({generation,published:Boolean(current)});},get current(){return current;}});
}
