// Research renderer policy, not intrinsic imaging validity. No GPU creation here.
import {point} from './ct-spatial.mjs';
import {ImagingRejection,freezeMetadata} from './imaging-contract.mjs';
export const BABYLON_VOLUME_PROFILE=freezeMetadata({id:'babylon-packed16-volume',version:1,textureFormat:'rgba8unorm',maxAxis:1024,maxVolumeLogicalBytes:160*1024*1024,rayStepMm:2,raySteps:512,maxRayCoverageMm:1000});
export const NATIVE_VOLUME_PROFILE=freezeMetadata({id:'native-r16uint-scientific',version:1,textureFormat:'r16uint',maxAxis:1024,maxVolumeLogicalBytes:80*1024*1024,rayStepMm:2,raySteps:512,maxRayCoverageMm:1000});
export function assessVolumeRenderer(descriptor,{backend='babylon',profile=BABYLON_VOLUME_PROFILE}={}){
 const reasons=[];
 if(backend!=='babylon'&&!(backend==='native'&&profile.id===NATIVE_VOLUME_PROFILE.id))reasons.push('NATIVE_WORKSTATION_ADAPTER_UNAVAILABLE');
 const {shape,storage,calibration:c,geometry}=descriptor??{};
 if(!Array.isArray(shape)||shape.length!==3||shape.some(v=>!Number.isInteger(v)||v<2||v>profile.maxAxis))reasons.push('TEXTURE_EXTENT_UNSUPPORTED');
 const bytes=shape?.reduce((a,b)=>a*b,profile.textureFormat==='r16uint'?2:4);if(!Number.isSafeInteger(bytes)||bytes>profile.maxVolumeLogicalBytes)reasons.push('GPU_VOLUME_ALLOCATION_BUDGET');
 if(!['<i2','<u2'].includes(storage?.dtype)||!((storage?.bitsStored===16&&storage?.highBit===15)||(storage?.dtype==='<u2'&&storage?.bitsStored===12&&storage?.highBit===11))||storage?.photometric!=='MONOCHROME2')reasons.push('PACKED16_FORMAT_UNSUPPORTED');
 if(!c||Math.fround(c.slope)!==c.slope||Math.fround(c.intercept)!==c.intercept||Math.abs(c.slope)>1e6||Math.abs(c.intercept)>1e9||c.width>65536)reasons.push('UNIFORM_DISPLAY_PRECISION_UNSUPPORTED');
 let longestDiagonalMm=null;
 if(shape?.length===3&&geometry?.matrices?.index_to_patient_mm){const [K,R,C]=shape,m=geometry.matrices.index_to_patient_mm,corners=Array.from({length:8},(_,i)=>point(m,[i&1?K:0,i&2?R:0,i&4?C:0]));longestDiagonalMm=Math.max(...corners.flatMap(a=>corners.map(b=>Math.hypot(...a.map((v,i)=>v-b[i])))));if(!Number.isFinite(longestDiagonalMm)||longestDiagonalMm>profile.maxRayCoverageMm)reasons.push('RAY_COVERAGE_BUDGET');}else reasons.push('MISSING_SPATIAL_DESCRIPTOR');
 return freezeMetadata({apiVersion:1,backend,profile:profile.id,profileVersion:profile.version,supported:reasons.length===0,reasons,volumeLogicalBytes:bytes,longestDiagonalMm});
}
export function requireVolumeRenderer(descriptor,options){const result=assessVolumeRenderer(descriptor,options);if(!result.supported)throw new ImagingRejection('RENDERER_UNSUPPORTED',{reasons:result.reasons});return result;}
