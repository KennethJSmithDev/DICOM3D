// Classic CT admission for the existing decoded descriptor, not a new DICOM parser.
// BDP-001: qualified decoded ImplicitVRLE unsigned12 shares the uint16 carrier.
// Original syntax and meaningful12/11 facts stay truthful; no decoder or rescale here.
// Original transfer decoding/authorization remain adapter-owned. No GPU work in this module.
import {requireImaging} from './imaging-contract.mjs';
const need=(v,c)=>requireImaging(v,'CT_UNSUPPORTED',{moduleId:'dicom.ct-classic',reasons:[c]});
export const CLASSIC_CT_IMPLEMENTATION='DICOM3D_CLASSIC_CT_MODULE_V1';
export const classicCt=Object.freeze({
 declaration:Object.freeze({apiVersion:1,id:'dicom.ct-classic',version:'1.0.1',provides:Object.freeze([{capability:'dicom.ct.classic.volume',version:1,representation:'spatial-volume'}]),requires:Object.freeze([{capability:'imaging.spatial-source',version:1}])}),
 recognize(request){
  const d=request.descriptor,e=request.sourceEncoding;
  if(request.representation!=='spatial-volume'||d?.schema!=='DICOM3D-verified-volume-1'||d.source?.modality!=='CT')return {supported:false,reasons:['NOT_CLASSIC_CT_DESCRIPTOR']};
  if(e&&(e.sopClassUid!=='1.2.840.10008.5.1.4.1.1.2'||!['1.2.840.10008.1.2.1','1.2.840.10008.1.2'].includes(e.transferSyntaxUid)||e.decoded!==true))return {supported:false,reasons:['UNQUALIFIED_SOURCE_ENCODING']};
  return {supported:true,reasons:[]};
 },
 convert(request,buffer){
  const d=request.descriptor,storage=d.storage;
  need(['<i2','<u2'].includes(storage?.dtype)&&((storage.bitsStored===16&&storage.highBit===15)||(storage.dtype==='<u2'&&storage.bitsStored===12&&storage.highBit===11))&&storage.photometric==='MONOCHROME2','stored representation');
  need(buffer instanceof ArrayBuffer&&buffer.byteLength%2===0,'stored buffer');
  return {descriptor:d,pixels:storage.dtype==='<i2'?new Int16Array(buffer):new Uint16Array(buffer),operations:Object.freeze({frameRgba})};
 },
 validate(candidate){
  const d=candidate.descriptor,c=d.calibration;
  need(d.shape?.length===3&&d.shape.every(v=>Number.isSafeInteger(v)&&v>=2),'volume eligibility');
  need(Number.isFinite(c?.slope)&&c.slope!==0&&Number.isFinite(c.intercept),'calibration');
  need(['LINEAR','LINEAR_EXACT'].includes(c.voiFunction)&&Number.isFinite(c.center)&&Number.isFinite(c.width)&&c.width>=1,'VOI');
  const ids=new Set();need(Array.isArray(d.frames)&&d.frames.length===d.shape[0],'frames');
  for(const f of d.frames){need(f.sourceFrame===1&&!ids.has(f.sopIdentity),'one acquired image per SOP');ids.add(f.sopIdentity);}
  return true;
 }
});
function frameRgba(v,k,center,width,rgba){
  const d=v.descriptor,[K,R,C]=d.shape,c=d.calibration;
  need(Number.isInteger(k)&&k>=0&&k<K&&Number.isFinite(center)&&Number.isFinite(width)&&width>=1&&width<=65536&&rgba.length===R*C*4,'display arguments');
  for(let i=0;i<R*C;i++){
    const value=v.pixels[k*R*C+i]*c.slope+c.intercept;
    const normalized=c.voiFunction==='LINEAR'?(width===1?(value>center-.5?1:0):(value-(center-.5))/(width-1)+.5):(value-center)/width+.5;
    const gray=Math.floor(Math.max(0,Math.min(1,normalized))*255+.5),j=4*i;rgba[j]=rgba[j+1]=rgba[j+2]=gray;rgba[j+3]=255;
  }return rgba;
}
