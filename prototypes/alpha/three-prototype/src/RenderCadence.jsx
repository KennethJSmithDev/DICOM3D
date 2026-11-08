import {useEffect,useLayoutEffect,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import {createDrawingCadence} from './render-cadence.js';
import {ownRendererCadence} from './renderer-cadence.js';

const roots=new Set();
export const drawingDiagnostics={roots:{}};
if(typeof window!=='undefined')window.__dicom3dDrawing=drawingDiagnostics;
export function requestSceneFrames(){for(const root of roots)root.request();}

export default function RenderCadence({name,policy,animate=false}){
 const get=useThree(s=>s.get),set=useThree(s=>s.set),scheduler=useRef(null);
 useLayoutEffect(()=>{
  const state=get(),original=state.invalidate,rendererCadence=ownRendererCadence(state.gl);
  const cadence=createDrawingCadence(time=>{rendererCadence.beforeDraw();get().advance(time,false);const matrix=get().camera.matrixWorld.toArray();const changed=!cadence.stats.camera||matrix.some((v,i)=>v!==cadence.stats.camera[i]);cadence.stats.camera=matrix;if(name==='main'&&changed)for(const peer of roots)if(peer!==cadence)peer.request();cadence.stats.canvas=[get().gl.domElement.width,get().gl.domElement.height];cadence.stats.allocations={geometries:get().gl.info?.memory?.geometries??null,textures:get().gl.info?.memory?.textures??null};},{fps:policy.fps});
  scheduler.current=cadence;roots.add(cadence);drawingDiagnostics.roots[name]=cadence.stats;
  set({invalidate:cadence.request});
  const resize=()=>cadence.request();
  const observer=new ResizeObserver(resize);observer.observe(state.gl.domElement);
  const visibility=()=>cadence.visibility();document.addEventListener('visibilitychange',visibility);
  cadence.request();
  return()=>{roots.delete(cadence);cadence.dispose();rendererCadence.dispose();observer.disconnect();document.removeEventListener('visibilitychange',visibility);if(get().invalidate===cadence.request)set({invalidate:original});scheduler.current=null;};
 },[get,set,name]);
 useLayoutEffect(()=>{scheduler.current?.setFps(policy.fps);scheduler.current?.setContinuous(animate);scheduler.current?.request();},[policy,animate]);
 // Scene effects restore materials/visibility after the layout-phase request.
 // Request again after passive commits so the final Scientific frame is published.
 useEffect(()=>{scheduler.current?.request();});
 // React scene commits can mutate objects without changing the R3F store.
 useLayoutEffect(()=>{scheduler.current?.request();});
 return null;
}
