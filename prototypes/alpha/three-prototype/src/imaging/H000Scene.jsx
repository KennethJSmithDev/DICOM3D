import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {DoubleSide,Mesh,Vector4} from 'three';
import {MeshStandardNodeMaterial} from 'three/webgpu';
import {uniform,vec4,positionWorld} from 'three/tsl';
import {accumulationVector} from '../../../viewer/src/ct-accumulation.mjs';
import {sourceKTransform,allowsAccumulatedPoint} from './study-accumulation.mjs';
import H000Plane from './H000Plane.jsx';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

// The fixture loader has already verified the GLB and source arrays against its pinned hashes.
// These objects are in source-derived DICOM3D Model Space, not atlas coordinates.
import {generateH000Surface} from './h000-smooth-surface.js';
import {generateNrxH000Surface} from '../nrx-seg/nrx-h000.js';
function disposeScene(scene) {
  scene?.userData.releaseAccumulation?.();
  const geometries = new Set(), materials = new Set(), textures = new Set();
  scene?.traverse(node => { if (node.geometry) geometries.add(node.geometry); for (const mat of (Array.isArray(node.material)?node.material:[node.material])) if (mat) { materials.add(mat); for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value); } });
  textures.forEach(t=>t.dispose()); materials.forEach(m=>m.dispose()); geometries.forEach(g=>g.dispose());
}
function clippedSourceMaterial(original,mask){
 const material=new MeshStandardNodeMaterial();
 for(const key of ['color','emissive','roughness','metalness','opacity','transparent','side','depthWrite','depthTest','map','normalMap','emissiveMap','roughnessMap','metalnessMap','alphaMap'])if(original?.[key]!==undefined)material[key]=original[key]?.isColor?original[key].clone():original[key];
 material.maskNode=mask;return material;
}
function attachAccumulation(scene,clip,state){
 const records=[];scene.traverse(mesh=>{if(!mesh.isMesh)return;const original=mesh.material,raycast=mesh.raycast;mesh.material=Array.isArray(original)?original.map(m=>clippedSourceMaterial(m,clip.mask)):clippedSourceMaterial(original,clip.mask);
  mesh.raycast=function(raycaster,hits){const candidates=[];raycast.call(this,raycaster,candidates);for(const hit of candidates)if(allowsAccumulatedPoint(hit.point,clip.inverse,state.current))hits.push(hit)};
  records.push({mesh,original,raycast,materials:Array.isArray(mesh.material)?mesh.material:[mesh.material]});
 });
 scene.userData.releaseAccumulation=()=>{for(const r of records){r.mesh.material=r.original;r.mesh.raycast=r.raycast;r.materials.forEach(m=>m.dispose())}records.length=0};
}
/** Private H000 source-linked scene; does not imply registration to generalized anatomy. */
export default function H000Scene({study, frame=71, showSeg=true, showPlane=true, accumulation=null, onSelect=()=>{}, onStatus=()=>{}, derivedMode=false, onDerived=()=>{}}) {
  const [lesion,setLesion]=useState(null);
  const [derived,setDerived]=useState(null);
  const accumulationRef=useRef(accumulation);accumulationRef.current=accumulation;
  const clip=useMemo(()=>{if(!study)return null;const inverse=sourceKTransform(study),range=uniform(new Vector4(0,-.5,102.5,1)),k=uniform(inverse).mul(vec4(positionWorld,1)).z.mul(103).add(51);const mask=range.x.lessThan(.5).or(range.w.greaterThan(.5).and(k.greaterThanEqual(range.y)).and(k.lessThanEqual(range.z)));const material=new MeshStandardNodeMaterial({color:'#38c9e9',roughness:.45,side:DoubleSide});material.maskNode=mask;return {inverse,range,mask,material}},[study]);
  useLayoutEffect(()=>{if(clip)clip.range.value.fromArray(accumulation?accumulationVector(accumulation):[0,-.5,102.5,1])},[clip,accumulation]);
  useEffect(()=>()=>clip?.material.dispose(),[clip]);
  const derivedRaycast=useMemo(()=>function(raycaster,hits){const candidates=[];Mesh.prototype.raycast.call(this,raycaster,candidates);for(const hit of candidates)if(clip&&allowsAccumulatedPoint(hit.point,clip.inverse,accumulationRef.current))hits.push(hit)},[clip]);
  useEffect(()=>{let live=true,result=null;const controller=new AbortController();setDerived(null);if(!derivedMode||!study){onDerived(null);return}const kind=derivedMode==='three'?'Three':'NRX/R002';onDerived({status:`Generating ${kind} display surface...`});const timer=setTimeout(async()=>{try{result=derivedMode==='three'?generateH000Surface(study):await generateNrxH000Surface(study,{signal:controller.signal});if(!live){result?.geometry.dispose();result=null;return}const digest=await crypto.subtle.digest('SHA-256',result.geometry.getAttribute('position').array);if(!live){result?.geometry.dispose();result=null;return}const positionSha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');setDerived({...result,study});onDerived({...result.provenance,positionSha256,status:'ready'});}catch(error){if(live){result?.geometry.dispose();result=null;onDerived({status:`Surface unavailable: ${error.message}; source lesion retained.`})}}},0);return()=>{live=false;clearTimeout(timer);controller.abort();result?.geometry.dispose();result=null}},[study,derivedMode,onDerived]);
  useEffect(()=>{
    let live=true, loaded=null;
    setLesion(null);
    if (!study?.glbBytes || study.binding?.semanticId!=='lesion.lung.mass.001') { onStatus('No verified H000 lesion'); return; }
    new GLTFLoader().parseAsync(study.glbBytes, '').then(gltf=>{
      if (!live) { disposeScene(gltf.scene); return; }
      let node=null; gltf.scene.traverse(item=>{if(item.userData?.semanticId===study.binding.semanticId) node=item});
      if (!node) { disposeScene(gltf.scene); onStatus('Verified lesion node unavailable'); return; }
      loaded=gltf.scene; loaded.traverse(n=>{if(n.isMesh&&n.material?.color)n.material.color.set('#22c8ec')});if(clip)attachAccumulation(loaded,clip,accumulationRef); setLesion(loaded); onStatus('Source-derived lesion and frame plane; 3D correspondence under review');
    }).catch(error=>{if(live)onStatus(`Lesion unavailable: ${String(error)}`)});
    return ()=>{live=false;disposeScene(loaded)};
  },[study,clip]);
  return <>
    {derivedMode && derived?.study===study && clip ? <mesh geometry={derived.geometry} material={clip.material} raycast={derivedRaycast} dispose={null} onPointerDown={event=>{event.stopPropagation();onSelect(study.binding.semanticId)}}/> : lesion && <primitive object={lesion} dispose={null} onPointerDown={event=>{event.stopPropagation();onSelect(study.binding.semanticId)}}/>}
    {showPlane && <H000Plane study={study} frame={frame} showSeg={showSeg}/>}
  </>;
}
