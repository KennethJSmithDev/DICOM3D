import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Matrix4,WebGLCoordinateSystem} from 'three';
import {requestSceneFrames} from '../RenderCadence.jsx';

export const nrxH000Lifecycle={created:0,disposed:0,active:0,draws:0,lastFrame:null,lastError:null};
if(typeof window!=='undefined')window.__dicom3dH000Native=nrxH000Lifecycle;

// Keep the existing Three camera, pointer surface, and cadence. Once NRX
// submits, this positive-priority callback owns drawing for the main viewport.
export default function NrxH000Frame({canvasRef,study,ct,frame,showSeg,selected,onSelect,onStatus}) {
 const gl=useThree(state=>state.gl),renderer=useRef(null),staged=useRef(null);
 const inverse=useMemo(()=>new Matrix4(),[]);
 useEffect(()=>{
  let live=true,owned=null,failed=false;
  const abort=new AbortController();
  nrxH000Lifecycle.lastError=null;
  onStatus({status:'loading'});
  const fail=error=>{
   if(!live||failed)return;
   failed=true;
   nrxH000Lifecycle.lastError=String(error?.message??error??'Native renderer unavailable').slice(0,256);
   renderer.current=null;
   onStatus({status:'error'});
   requestSceneFrames();
  };
  staged.current={ready:false,fail};
  (async()=>{
   const canvas=canvasRef.current;
   const source=gl.domElement;
   canvas.width=Math.max(1,source.width);
   canvas.height=Math.max(1,source.height);
   const {createNrxStudyRenderer}=await import('../nrx-native/native-study.mjs');
   if(!live)return;
   owned=await createNrxStudyRenderer(canvas,{study,signal:abort.signal});
   nrxH000Lifecycle.created++;
   if(!live){owned.dispose();nrxH000Lifecycle.disposed++;return}
   nrxH000Lifecycle.active++;
   renderer.current=owned;
   owned.lost.then(fail,fail);
   requestSceneFrames();
  })().catch(fail);

  let press=null;
  const surface=gl.domElement;
  const onDown=event=>{
   press=event.isPrimary&&event.button===0?[event.pointerId,event.clientX,event.clientY]:null;
  };
  const onMove=event=>{
   if(press?.[0]===event.pointerId&&Math.hypot(event.clientX-press[1],event.clientY-press[2])>5)press=null;
  };
  const onCancel=()=>{press=null};
  const onUp=event=>{
   const start=press;
   press=null;
   if(!renderer.current||!staged.current?.ready||!start||start[0]!==event.pointerId||
      Math.hypot(event.clientX-start[1],event.clientY-start[2])>5)return;
   const bounds=surface.getBoundingClientRect();
   if(!bounds.width||!bounds.height)return;
   const x=(event.clientX-bounds.left)/bounds.width*2-1;
   const y=1-(event.clientY-bounds.top)/bounds.height*2;
   const active=renderer.current;
   Promise.resolve().then(()=>active.pick(x,y)).then(hit=>{
    if(hit&&live&&renderer.current===active)onSelect();
   }).catch(fail);
  };
  surface.addEventListener('pointerdown',onDown);
  surface.addEventListener('pointermove',onMove);
  surface.addEventListener('pointercancel',onCancel);
  surface.addEventListener('pointerup',onUp);
  return()=>{
   live=false;
   abort.abort();
   surface.removeEventListener('pointerdown',onDown);
   surface.removeEventListener('pointermove',onMove);
   surface.removeEventListener('pointercancel',onCancel);
   surface.removeEventListener('pointerup',onUp);
   renderer.current=null;
   staged.current=null;
   if(owned){owned.dispose();nrxH000Lifecycle.disposed++;nrxH000Lifecycle.active--}
   requestSceneFrames();
  };
 },[study,gl,canvasRef,onStatus,onSelect]);

 useFrame(({camera,scene})=>{
  const native=renderer.current;
  const canvas=canvasRef.current;
  if(native&&canvas?.isConnected){
   try{
    const {width,height}=gl.domElement;
    if(width&&height){
     if(canvas.width!==width)canvas.width=width;
     if(canvas.height!==height)canvas.height=height;
     camera.updateMatrixWorld();
     inverse.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).invert();
     const nearDepth=camera.coordinateSystem===WebGLCoordinateSystem?-1:0;
     const input={
      inverseViewProjection:inverse.elements,nearDepth,farDepth:1,
      level:ct.level,width:ct.width,gain:ct.gain,clipK:ct.clipK,
      frame,lesionSelected:selected,lesionVisible:true,volumeVisible:ct.enabled,
      planeVisible:ct.plane,planeOverlay:showSeg,
     };
     if(native.render(input)){
      nrxH000Lifecycle.draws++;
      nrxH000Lifecycle.lastFrame={frame,level:ct.level,width:ct.width,gain:ct.gain,clipK:ct.clipK,
       planeVisible:ct.plane,volumeVisible:ct.enabled,selected,camera:camera.matrixWorld.toArray(),size:[width,height]};
      if(!staged.current.ready){staged.current.ready=true;onStatus({status:'ready'})}
     }
     if(staged.current.ready)return;
    }
   }catch(error){staged.current?.fail(error)}
  }
  gl.render(scene,camera);
 },1);
 return null;
}
