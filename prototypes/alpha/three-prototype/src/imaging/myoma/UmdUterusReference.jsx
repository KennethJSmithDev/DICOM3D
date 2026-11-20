import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {disposeScene,loadBundle} from '../../atlas.js';
import {requestSceneFrames} from '../../RenderCadence.jsx';
import delta from '../../../atlas-delta/female-delta.json';
import {placeUterusReference} from './umd-uterus-placement.mjs';

/** Mounted only when the operator enables unregistered female atlas context. */
export default function UmdUterusReference({volume,opacity=.28,onAtlasStatus}){
  const [reference,setReference]=useState(null);
  const status=useRef(onAtlasStatus);
  useLayoutEffect(()=>{status.current=onAtlasStatus;},[onAtlasStatus]);
  useEffect(()=>{
    const abort=new AbortController();
    let lease;
    setReference(null);
    status.current?.('loading');
    async function load(){
      try{
        const bundle=await loadBundle(delta,abort.signal,'female-delta');
        if(abort.signal.aborted){disposeScene(bundle.scene);return;}
        lease=bundle.scene;
        const object=placeUterusReference(lease,volume);
        setReference(object);
      }catch{
        if(lease){disposeScene(lease);lease=null;}
        if(!abort.signal.aborted)status.current?.('unavailable');
      }
    }
    load();
    return ()=>{abort.abort();if(lease)disposeScene(lease);requestSceneFrames();};
  },[volume]);
  useLayoutEffect(()=>{
    if(!reference)return;
    reference.traverse(node=>{
      if(!node.isMesh)return;
      for(const material of Array.isArray(node.material)?node.material:[node.material]){
        material.opacity=opacity;
        material.transparent=true;
        material.depthWrite=false;
        material.needsUpdate=true;
      }
    });
    requestSceneFrames();
  },[reference,opacity]);
  useLayoutEffect(()=>{if(reference)status.current?.('ready');},[reference]);
  return reference?<primitive object={reference} dispose={null}/>:null;
}
