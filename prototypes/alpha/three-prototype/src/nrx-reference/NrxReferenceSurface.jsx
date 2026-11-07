import React,{useEffect,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {loadNrxReferenceSurface} from './load-nrx-reference.js';
/** Source geometry is never hidden/mutated here. Parent controls comparison visibility.
 * `study` is an exclusion guard: acquired imaging must not enter a reference extractor.
 * onSurfaceReady receives the source owner/provenance for an explicit source/derived UI. */
export default function NrxReferenceSurface({study=null,bundles,sourceOwner=null,selected=sourceOwner?.userData?.semanticId,enabled=false,resolution=32,onStatus,onSurfaceReady,onSelect,opacity=1,color=null}){
 const [surface,setSurface]=useState(null),group=useRef(),callbacks=useRef({onStatus,onSurfaceReady});callbacks.current={onStatus,onSurfaceReady};
 useEffect(()=>{
  setSurface(null);if(!enabled||study||!selected)return;
  const ac=new AbortController();let retained=null;callbacks.current.onStatus?.({status:'generating',sourceId:selected,resolution});
  loadNrxReferenceSurface({bundles,sourceOwner,selected,resolution,signal:ac.signal}).then(value=>{if(ac.signal.aborted){value.dispose();return;}retained=value;setSurface(value);callbacks.current.onStatus?.({status:'ready',...value.provenance});callbacks.current.onSurfaceReady?.(value);}).catch(error=>{if(!ac.signal.aborted)callbacks.current.onStatus?.({status:'unavailable',sourceId:selected,error:error.message,sourceRetained:true});});
  return()=>{ac.abort();retained?.dispose();callbacks.current.onSurfaceReady?.(null);};
 },[enabled,study,bundles,sourceOwner,selected,resolution]);
 useFrame(()=>{if(group.current&&surface){surface.owner.updateWorldMatrix(true,false);group.current.matrix.copy(surface.owner.matrixWorld);group.current.matrixWorldNeedsUpdate=true;}});
 if(!enabled||study||!surface||surface.provenance.sourceId!==selected)return null;
 return <group ref={group} matrixAutoUpdate={false}><mesh geometry={surface.geometry} dispose={null} onPointerDown={e=>{e.stopPropagation();onSelect?.(selected);}}><meshStandardMaterial color={color??surface.sourceColor??'#c4b09b'} roughness={.5} transparent={opacity<1} opacity={opacity}/></mesh></group>;
}
