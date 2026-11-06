import React,{useEffect,useMemo} from 'react';
import {BufferAttribute,BufferGeometry,DataTexture,DoubleSide,LinearFilter,MeshBasicMaterial,NearestFilter,RGBAFormat,SRGBColorSpace,UnsignedByteType} from 'three';
import {verifiedFrameRgba} from '../../../viewer/src/verified-volume.mjs';

// Source geometry uses the admitted producer's matrices. It is never aligned
// to the atlas without a separate, explicit registration contract.
function apply(m,p){return m.slice(0,3).map(row=>row[0]*p[0]+row[1]*p[1]+row[2]*p[2]+row[3]);}
export function localFrameCorners(study,frame){
 const [,rows,cols]=study.descriptor.shape,m=study.descriptor.geometry.matrices;
 return [[-.5,-.5],[-.5,cols-.5],[rows-.5,cols-.5],[rows-.5,-.5]].map(([r,c])=>apply(m.patient_mm_to_model_m,apply(m.index_to_patient_mm,[frame,r,c])));
}
// A source plane is a single direct acquired slice, not a volume or a segmented surface.
export default function LocalStudyScene({study,frame=0}){
 const plane=useMemo(()=>{
  if(!study||!Number.isInteger(frame)||frame<0||frame>=study.descriptor.shape[0])return null;
  const [,rows,cols]=study.descriptor.shape,c=study.descriptor.calibration;
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(localFrameCorners(study,frame).flat()),3));
  geometry.setAttribute('uv',new BufferAttribute(new Float32Array([0,0,1,0,1,1,0,1]),2));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
  const rgba=new Uint8Array(rows*cols*4);verifiedFrameRgba(study,frame,c.center,c.width,rgba);
  const texture=new DataTexture(rgba,cols,rows,RGBAFormat,UnsignedByteType);texture.colorSpace=SRGBColorSpace;texture.minFilter=LinearFilter;texture.magFilter=NearestFilter;texture.needsUpdate=true;
  return {geometry,texture,material:new MeshBasicMaterial({map:texture,side:DoubleSide,toneMapped:false})};
 },[study,frame]);
 useEffect(()=>()=>{plane?.geometry.dispose();plane?.material.dispose();plane?.texture.dispose();},[plane]);
 return plane?<mesh geometry={plane.geometry} material={plane.material} dispose={null}/>:null;
}
