import React,{useEffect,useMemo,useState} from 'react';
import {useThree} from '@react-three/fiber';
import {Vector3} from 'three';
import manifest from './skeleton-parts.json';
import {copySourcePartGeometry,findSkeletonOwner,sourcePartBounds} from './skeleton-part-view.js';
import {fitPerspectiveBounds} from './fit-perspective-bounds.js';
export {sourcePartAtFace} from './skeleton-part-view.js';
export const skeletonParts=manifest.parts;
const noop=()=>{};

export function SkeletonPartScene({bundles,partId,isolated=false,onReady=noop,onSelect=noop,focusRequest=0,cameraBridge}){
 const {camera}=useThree();const [result,setResult]=useState(null);
 const part=useMemo(()=>skeletonParts.find(p=>p.id===partId),[partId]);
 useEffect(()=>{const owner=findSkeletonOwner(bundles);setResult(null);if(!owner||!part){onReady(null);return}let geometry,materials;try{geometry=copySourcePartGeometry(owner.geometry,part);materials=(Array.isArray(owner.material)?owner.material:[owner.material]).map(m=>m.clone());owner.updateWorldMatrix(true,false);const r={geometry,material:Array.isArray(owner.material)?materials:materials[0],owner,matrix:owner.matrixWorld.clone(),part};setResult(r);onReady({partId:part.id,triangles:part.indexCount/3,sourceSha256:part.sourceSha256})}catch(e){onReady({error:e.message,partId:part.id})}return()=>{geometry?.dispose();materials?.forEach(m=>m.dispose());onReady(null)}},[bundles,part,onReady]);
 useEffect(()=>{if(!result||!focusRequest)return;const bridge=cameraBridge?.current,controls=bridge?.controls;if(!controls)return;const direction=new Vector3().copy(camera.position).sub(controls.target).normalize();fitPerspectiveBounds(camera,controls,sourcePartBounds(result.owner,result.geometry),direction)},[focusRequest,result,camera,cameraBridge]);
 return result&&isolated?<mesh matrixAutoUpdate={false} matrix={result.matrix} geometry={result.geometry} material={result.material} dispose={null} onPointerDown={e=>{e.stopPropagation();onSelect(result.part.id)}}/>:null;
}

export function SkeletonPartInspector({bundles,partId,onSelect,onIsolate,onRestore,onFocus,isolated=false,ready=null}){
 const [query,setQuery]=useState('');const owner=findSkeletonOwner(bundles);const selected=skeletonParts.find(p=>p.id===partId);const matches=skeletonParts.filter(p=>`${p.label} ${p.elementId} ${p.conceptId}`.toLowerCase().includes(query.toLowerCase()));
 return <details className="panel"><summary>Source components of skeletal aggregate · {skeletonParts.length}</summary><p>Original admitted components, including some non-bone parts. Selecting a component preserves its original source identity; it does not admit held geometry.</p><label>Find aggregate component<input aria-label="Find skeletal aggregate component" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Atlas, rib, source ID…"/></label><select size={7} aria-label="Skeletal aggregate component" value={partId||''} onChange={e=>onSelect(e.target.value)}><option value="">Choose a source component</option>{matches.map(p=><option key={p.id} value={p.id}>{p.label} · {p.elementId}</option>)}</select>{selected&&<p>{selected.label} · {selected.conceptId} · {selected.elementId}<br/>{selected.indexCount/3} original triangles within FMA23881</p>}<div className="view-controls"><button disabled={!owner||!selected} onClick={onFocus}>Focus component</button><button disabled={!owner||!selected} onClick={onIsolate}>Isolate component</button><button disabled={!isolated&&!partId} onClick={onRestore}>Restore aggregate</button></div>{!owner&&<small>Load the skeletal bundle to explore its components.</small>}{ready?.error&&<p role="alert">{ready.error}; original aggregate retained</p>}<small>Component presentation uses exact copied source attributes; the aggregate asset remains unchanged.</small></details>;
}
