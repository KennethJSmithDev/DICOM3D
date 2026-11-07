import {MeshBasicNodeMaterial} from 'three/webgpu';
import {texture as textureNode} from 'three/tsl';
import {BufferAttribute, BufferGeometry, DataTexture, DoubleSide, LinearFilter, MeshBasicMaterial, NearestFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType} from 'three';
import {frameRgba} from '../../../viewer/src/ct-frame.mjs';
import {sourceFrameCorners} from './h000-spatial.mjs';
// Shared source-plane construction; no atlas transform or resampling.
export function createH000Plane(study,frame,showSeg=true){
    if (!study || !Number.isInteger(frame) || frame<0 || frame>=103) return null;
    const corners=sourceFrameCorners(study,frame), geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(new Float32Array(corners.flat()),3));
    geometry.setAttribute('uv',new BufferAttribute(new Float32Array([0,0,1,0,1,1,0,1]),2));
    geometry.setIndex([0,1,2,0,2,3]); geometry.computeVertexNormals();
    const rgba=new Uint8Array(512*512*4); frameRgba(study.pixels,frame,-600,1500,rgba);
    const mask=study.mask,offset=frame*512*512;
    for(let i=0;i<512*512;i++) if(showSeg&&mask[offset+i]) {const j=i*4; rgba[j]=Math.round(rgba[j]*.6); rgba[j+1]=Math.round(rgba[j+1]*.6+210*.4); rgba[j+2]=Math.round(rgba[j+2]*.6+255*.4);}
    const texture=new DataTexture(rgba,512,512,RGBAFormat,UnsignedByteType); texture.colorSpace=SRGBColorSpace; texture.minFilter=LinearFilter; texture.magFilter=NearestFilter; texture.needsUpdate=true;
    const material=new MeshBasicNodeMaterial({colorNode:textureNode(texture),side:DoubleSide,toneMapped:false});
    return {geometry,texture,material};
}
export function disposeH000Plane(plane){plane?.geometry.dispose();plane?.material.dispose();plane?.texture.dispose()}
