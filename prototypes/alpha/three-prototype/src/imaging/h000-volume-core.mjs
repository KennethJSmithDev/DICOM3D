import {point} from '../../../viewer/src/ct-spatial.mjs';
import {packStored, opacityValues, opacityPerMm} from '../../../viewer/src/ct-volume-core.mjs';
export {packStored, opacityValues, opacityPerMm};
export const H000_SHAPE=Object.freeze([103,512,512]);
export function validateVolume(study) {
 if(!(study?.pixels instanceof Uint16Array)||study.pixels.length!==103*512*512||study.binding?.semanticId!=='lesion.lung.mass.001')throw Error('Whole-volume bridge requires the admitted H000 grid');
 const matrices=study.manifest?.spatial?.matrices;
 for(const key of ['index_to_patient_mm','patient_mm_to_model_m']){const m=matrices?.[key];if(m?.length!==4||m.some(row=>row?.length!==4||row.some(v=>!Number.isFinite(v)))||m[3].some((v,i)=>v!==(i===3?1:0)))throw Error('Invalid source volume transform')}
 return matrices;
}
export const indexToModel=(matrices,p)=>point(matrices.patient_mm_to_model_m,point(matrices.index_to_patient_mm,p));
// Proxy local coordinates are [-.5,.5]^3, axes [column,row,k]. No presentation reflection.
// This is the same model space used by H000Scene/sourceFrameCorners, not Babylon's separate reflected scene.
export function volumeTransform(matrices) {
 const center=indexToModel(matrices,[51,255.5,255.5]);
 const endpoints=[[51,255.5,767.5],[51,767.5,255.5],[154,255.5,255.5]].map(p=>indexToModel(matrices,p));
 const columns=endpoints.map(p=>p.map((v,i)=>v-center[i]));
 return [columns[0][0],columns[0][1],columns[0][2],0,columns[1][0],columns[1][1],columns[1][2],0,columns[2][0],columns[2][1],columns[2][2],0,...center,1];
}
export function volumeCorners(matrices){return Array.from({length:8},(_,i)=>indexToModel(matrices,[i&4?102.5:-.5,i&2?511.5:-.5,i&1?511.5:-.5]));}
export function unpackAt(bytes,k,row,col,shape=H000_SHAPE){const i=((Math.max(0,Math.min(shape[0]-1,k))*shape[1]+Math.max(0,Math.min(shape[1]-1,row)))*shape[2]+Math.max(0,Math.min(shape[2]-1,col)))*4;return bytes[i]+bytes[i+1]*256;}
export function interpolatePacked(bytes,k,row,col,shape=H000_SHAPE){const p=[k,row,col],lo=p.map(Math.floor),f=p.map((v,i)=>v-lo[i]);let value=0;for(let i=0;i<8;i++){let weight=1;const q=lo.map((v,a)=>{const hi=!!(i&(1<<a));weight*=hi?f[a]:1-f[a];return v+(hi?1:0)});value+=weight*unpackAt(bytes,...q,shape)}return value;}

export function volumeBounds(study){const points=volumeCorners(validateVolume(study));return {min:[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))),max:[0,1,2].map(a=>Math.max(...points.map(p=>p[a])))};}

export function interpolateSource(pixels,k,row,col,shape=H000_SHAPE){const p=[k,row,col],lo=p.map(Math.floor),f=p.map((v,i)=>v-lo[i]);let value=0;for(let i=0;i<8;i++){let weight=1;const q=lo.map((v,a)=>{const hi=!!(i&(1<<a));weight*=hi?f[a]:1-f[a];return Math.max(0,Math.min(shape[a]-1,v+(hi?1:0)))});value+=weight*pixels[(q[0]*shape[1]+q[1])*shape[2]+q[2]]}return value;}
