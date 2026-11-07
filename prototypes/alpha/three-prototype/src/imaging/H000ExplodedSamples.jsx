import React, {useEffect, useMemo} from 'react';
import {BufferAttribute, BufferGeometry, DataTexture, DoubleSide, LinearFilter, MeshBasicMaterial, RGBAFormat, SRGBColorSpace, UnsignedByteType} from 'three';
import {frameRgba} from '../../../viewer/src/ct-frame.mjs';
import {point} from '../../../viewer/src/ct-spatial.mjs';
import {h000ExplosionLayout, h000SampleCorners} from './h000-explosion.mjs';

// Illustration of sampled acquired CT planes around the source SEG. Group
// translation is display-only; source pixels and coordinate matrices stay fixed.
export default function H000ExplodedSamples({study, amount, onSelect}) {
  const result = useMemo(() => {
    const layout = h000ExplosionLayout(study);
    if (!layout) return null;
    const textures = new Map(), geometries = [], material = new MeshBasicMaterial({side:DoubleSide,
      transparent:true, opacity:.32, depthWrite:false, toneMapped:false});
    for (const frame of new Set(layout.blocks.flatMap(block => block.frames))) {
      const data = new Uint8Array(512 * 512 * 4);
      frameRgba(study.pixels, frame, -600, 1500, data);
      const texture = new DataTexture(data, 512, 512, RGBAFormat, UnsignedByteType);
      texture.colorSpace=SRGBColorSpace; texture.minFilter=LinearFilter; texture.magFilter=LinearFilter; texture.needsUpdate=true;
      textures.set(frame, texture);
    }
    const matrices=study.manifest.spatial.matrices;
    const blocks=layout.blocks.map(block => ({...block, planes:block.frames.map(frame => {
      const corners=h000SampleCorners(matrices,frame,block.rows,block.cols,point);
      const geometry=new BufferGeometry();
      geometry.setAttribute('position',new BufferAttribute(new Float32Array(corners.flat()),3));
      const [r0,r1]=block.rows, [c0,c1]=block.cols;
      geometry.setAttribute('uv',new BufferAttribute(new Float32Array([c0/512,r0/512,c1/512,r0/512,c1/512,r1/512,c0/512,r1/512]),2));
      geometry.setIndex([0,1,2,0,2,3]); geometries.push(geometry);
      const mat=material.clone(); mat.map=textures.get(frame);
      return {frame, geometry, material:mat};
    })}));
    return {blocks, geometries, textures, material};
  },[study]);
  useEffect(() => () => {
    if (!result) return;
    for (const geometry of result.geometries) geometry.dispose();
    for (const texture of result.textures.values()) texture.dispose();
    for (const block of result.blocks) for (const plane of block.planes) plane.material.dispose();
    result.material.dispose();
  },[result]);
  if (!result) return null;
  const t=Math.max(0,Math.min(1,Number.isFinite(amount)?amount:0));
  return <>{result.blocks.map(block=><group key={block.id} position={block.direction.map(v=>v*t*.045)}>
    {block.planes.map(plane=><mesh key={plane.frame} geometry={plane.geometry} material={plane.material} dispose={null}
      onPointerDown={event=>{event.stopPropagation();onSelect(block)}}/>)}
  </group>)}</>;
}
