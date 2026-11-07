import {useCallback,useEffect,useRef,useState} from 'react';
import {introFrame,INTRO_DURATION_MS} from './materialization-state.mjs';
export const MOTION_KEY='dicom3d.motion.reduced.v1';
export function motionDecision(explicitReduced=false,preflightReason=''){
 return explicitReduced?'manual-reduced-motion':preflightReason?`preflight: ${preflightReason}`:null;
}
// Presentation time and source readiness are independent. Skip never admits data.
// Ambient motion preferences recommend a choice; they do not silently set it.
export function useReferenceIntro(ready,enabled,setAppearance,setAssembly,{preflightReason=''}={}){
 const played=useRef(false),timer=useRef(null),lastUi=useRef(0);
 const [phase,setPhase]=useState('waiting'),[run,setRun]=useState(0),[progress,setProgress]=useState(0);
 const [reduced,setReducedState]=useState(()=>{try{return localStorage.getItem(MOTION_KEY)==='true'}catch{return false}});
 const clock=useRef({active:false,started:0,elapsedMs:0,durationMs:INTRO_DURATION_MS,reason:'waiting',paused:false});
 const finish=useCallback((reason='completed')=>{cancelAnimationFrame(timer.current);timer.current=null;played.current=true;clock.current={...clock.current,active:false,elapsedMs:clock.current.active&&!clock.current.paused?Math.min(INTRO_DURATION_MS,performance.now()-clock.current.started):clock.current.elapsedMs,reason:typeof reason==='string'?reason:'manual-skip',paused:false};setProgress(1);setAssembly(0);setAppearance('original');setPhase('scientific')},[setAppearance,setAssembly]);
 const play=useCallback(()=>{
  cancelAnimationFrame(timer.current);played.current=true;
  const reason=motionDecision(reduced,preflightReason);if(reason){finish(reason);return}
  setPhase('assembling');setProgress(0);setAppearance('holographic');setAssembly(0);setRun(v=>v+1);
  const started=performance.now();lastUi.current=0;let last='assembling';
  clock.current={active:true,started,elapsedMs:0,durationMs:INTRO_DURATION_MS,reason:'running',paused:false};
  const tick=now=>{const elapsed=now-started,frame=introFrame(elapsed);clock.current.elapsedMs=elapsed;if(frame.done){finish();return}if(frame.phase!==last){last=frame.phase;setPhase(frame.phase)}if(now-lastUi.current>100){lastUi.current=now;setProgress(frame.progress)}timer.current=requestAnimationFrame(tick)};
  timer.current=requestAnimationFrame(tick);
 },[finish,setAppearance,setAssembly,reduced,preflightReason]);
 const scrub=useCallback(value=>{const p=Math.max(0,Math.min(1,Number(value)));if(!Number.isFinite(p))return;cancelAnimationFrame(timer.current);timer.current=null;played.current=true;if(p===1){finish('manual-progress');return}setAppearance('holographic');setAssembly(0);setPhase('assembling');setProgress(p);setRun(v=>v+1);clock.current={active:true,started:performance.now()-p*INTRO_DURATION_MS,elapsedMs:p*INTRO_DURATION_MS,durationMs:INTRO_DURATION_MS,reason:'manual-progress',paused:true};},[finish,setAppearance,setAssembly]);
 const setReduced=useCallback(value=>{setReducedState(value);try{localStorage.setItem(MOTION_KEY,String(value))}catch{}if(value)finish('manual-reduced-motion')},[finish]);
 useEffect(()=>{if(enabled&&!played.current)play();if(!enabled){if(clock.current.active)finish('workspace-change');played.current=false}},[enabled,play,finish]);
 useEffect(()=>()=>cancelAnimationFrame(timer.current),[]);
 return {phase,run,clock,play,finish,scrub,progress,reduced,setReduced,ready,active:phase==='assembling'||phase==='holographic'};
}
