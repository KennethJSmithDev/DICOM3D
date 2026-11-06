import React,{useEffect,useMemo} from 'react';
import {BufferAttribute,BufferGeometry,DataTexture,DoubleSide,LinearFilter,MeshBasicMaterial,RGBAFormat,SRGBColorSpace,UnsignedByteType} from 'three';
import {verifiedFrameRgba} from '../../../viewer/src/verified-volume.mjs';
import {localFrameCorners} from './LocalStudyScene.jsx';
import {sampledFrameIndices} from './local-stack-indices.mjs';

// Bounded visualization of actual admitted source frames; these planes are neither
// segmented anatomy nor a continuous ray-cast volume. A separate source plane can
// remain interactive. No source coordinates or stored values are changed.
export default function LocalStudyStack({study,count=16,opacity=.09}){
 const resources=useMemo(()=>{
  if(!study)return [];
  const [frames,rows,cols]=study.descriptor.shape,c=study.descriptor.calibration;
  return sampledFrameIndices(frames,count).map(k=>{
   const geom=new BufferGeometry();geom.setAttribute('position',new BufferAttribute(new Float32Array(localFrameCorners(study,k).flat()),3));
   geom.setAttribute('uv',new BufferAttribute(new Float32Array([0,0,1,0,1,1,0,1]),2));geom.setIndex([0,1,2,0,2,3]);geom.computeVertexNormals();
   const rgba=new Uint8Array(rows*cols*4);verifiedFrameRgba(study,k,c.center,c.width,rgba);
   const texture=new DataTexture(rgba,cols,rows,RGBAFormat,UnsignedByteType);texture.colorSpace=SRGBColorSpace;texture.minFilter=LinearFilter;texture.magFilter=LinearFilter;texture.needsUpdate=true;
   const material=new MeshBasicMaterial({map:texture,side:DoubleSide,toneMapped:false,transparent:true,opacity:Math.max(.01,Math.min(.25,opacity)),depthWrite:false});
   return {k,geom,texture,material};
  });
 },[study,count]);
 useEffect(()=>{for(const item of resources)item.material.opacity=Math.max(.01,Math.min(.25,opacity));},[resources,opacity]);
 useEffect(()=>()=>{for(const item of resources){item.geom.dispose();item.texture.dispose();item.material.dispose();}},[resources]);
 return <>{resources.map(item=><mesh key={item.k} geometry={item.geom} material={item.material} raycast={()=>null} dispose={null}/>)}</>;
}
