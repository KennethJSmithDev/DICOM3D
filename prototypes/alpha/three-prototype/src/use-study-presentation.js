import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {accumulation} from '../../viewer/src/ct-accumulation.mjs';
export const STUDY_DURATION_MS=8000;
export function sourceRange(study,kind){
 if(kind==='lesion'){const frames=study?.binding?.frames?.filter(f=>f.nonzero_voxels>0).map(f=>f.ct_k)??[];if(frames.length)return [Math.min(...frames),Math.max(...frames)]}
 return [0,(study?.ctReceipt?.volume?.shape_k_row_column?.[0]??103)-1];
}
export default function useStudyPresentation(study,{reduced=false,onFrame,active=true}={}){
 const [enabled,setEnabled]=useState(false),[progress,setProgress]=useState(1),[rangeKind,setRangeKind]=useState('acquired'),[playing,setPlaying]=useState(false);
 const timer=useRef(null),value=useRef(progress);value.current=progress;
 const range=useMemo(()=>sourceRange(study,rangeKind),[study,rangeKind]);
 const state=useMemo(()=>accumulation(progress,range,enabled),[progress,range,enabled]);
 const stop=useCallback(()=>{cancelAnimationFrame(timer.current);timer.current=null;setPlaying(false)},[]);
 const reset=useCallback(()=>{stop();setEnabled(false);setProgress(1)},[stop]);
 useEffect(()=>{reset();setRangeKind('acquired')},[study,reset]);
 useEffect(()=>()=>cancelAnimationFrame(timer.current),[]);
 useEffect(()=>{if(!active)stop()},[active,stop]);
 useEffect(()=>{if(reduced){stop();setProgress(1)}},[reduced,stop]);
 useEffect(()=>{if(study&&enabled&&active)onFrame?.(state.planeK)},[study,enabled,active,state.planeK,onFrame]);
 const play=useCallback(()=>{
  stop();if(!study)return;setEnabled(true);if(reduced){setProgress(1);return}
  const initial=value.current>=1?0:value.current;setProgress(initial);setPlaying(true);const start=performance.now();
  const tick=now=>{const p=Math.min(1,initial+(now-start)/STUDY_DURATION_MS);setProgress(p);if(p<1)timer.current=requestAnimationFrame(tick);else{timer.current=null;setPlaying(false)}};
  timer.current=requestAnimationFrame(tick);
 },[study,reduced,stop]);
 const scrub=useCallback(p=>{stop();setEnabled(true);setProgress(Math.max(0,Math.min(1,Number(p))))},[stop]);
 const changeRange=useCallback(kind=>{stop();setRangeKind(kind==='lesion'?'lesion':'acquired');setEnabled(true);setProgress(0)},[stop]);
 return {accumulation:state,enabled,progress,rangeKind,playing,reduced,play,pause:stop,reset,scrub,changeRange,available:!!study};
}
