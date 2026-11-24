import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {requestSceneFrames} from '../RenderCadence.jsx';
import {createAtlasDrawList} from './atlas-draw-list.mjs';

export const nrxAtlasLifecycle={created:0,disposed:0,active:0,draws:0,lastFrame:null,lastError:null};
if(typeof window!=='undefined')window.__dicom3dAtlasNative=nrxAtlasLifecycle;

// The existing Three canvas keeps camera input, R3F event dispatch and ray
// intersections. Native pixels are drawn on the pointer-transparent canvas.
export default function NrxAtlasFrame({canvasRef,onStatus,showIllustrativeTissue=false}){
 const gl=useThree(state=>state.gl);
 const drawList=useMemo(createAtlasDrawList,[]);
 const runtime=useRef(null);
 const handoff=useRef(null);

 useEffect(()=>{requestSceneFrames()},[showIllustrativeTissue]);

 useEffect(()=>{
  let live=true,owned=null,failed=false;
  const abort=new AbortController();
  const surface=gl.domElement;
  const initialOpacity=surface.style.opacity;
  const restoreSurface=()=>{surface.style.opacity=initialOpacity;};
  nrxAtlasLifecycle.lastError=null;
  onStatus({status:'loading'});
  const fail=error=>{
   if(!live||failed)return;
   failed=true;
   nrxAtlasLifecycle.lastError=String(error?.message??error??'NRX atlas renderer unavailable').slice(0,256);
   runtime.current=null;
   restoreSurface();
   onStatus({status:'error',error:nrxAtlasLifecycle.lastError});
   requestSceneFrames();
  };
  const transition={ready:false,fail,hideThree:()=>{surface.style.opacity='0';}};
  handoff.current=transition;
  (async()=>{
   const canvas=canvasRef.current;
   if(!canvas?.isConnected)throw Error('The atlas viewport has no connected canvas');
   const {createAtlasGpu}=await import('./atlas-gpu.mjs');
   if(!live)return;
   owned=await createAtlasGpu(canvas,{signal:abort.signal});
   nrxAtlasLifecycle.created++;
   if(!live){owned.dispose();nrxAtlasLifecycle.disposed++;return;}
   nrxAtlasLifecycle.active++;
   runtime.current=owned;
   owned.lost?.then(fail,fail);
   requestSceneFrames();
  })().catch(fail);

  return()=>{
   live=false;
   abort.abort();
   restoreSurface();
   runtime.current=null;
   handoff.current=null;
   if(owned){
    owned.dispose();
    nrxAtlasLifecycle.disposed++;
    nrxAtlasLifecycle.active--;
   }
   requestSceneFrames();
  };
 },[canvasRef,gl,onStatus]);

 useFrame(({camera,scene})=>{
  const native=runtime.current,canvas=canvasRef.current,transition=handoff.current;
  if(native&&canvas?.isConnected&&transition){
   try{
    const {width,height}=gl.domElement;
    if(width&&height){
     const objects=drawList.collect(scene,camera,{showIllustrativeTissue});
     const submitted=native.render({...objects,width,height});
     if(submitted!==false){
      const visibleOwners=new Set();
      const illustrativeOwners=new Map();
      let minOpacity=1,maxOpacity=0;
      for(const draw of objects.draws){
       if(!draw.owner)continue;
       visibleOwners.add(draw.owner);
       if(draw.illustrativeTissue)illustrativeOwners.set(draw.owner,draw.illustrativeTissue);
       minOpacity=Math.min(minOpacity,draw.opacity);
       maxOpacity=Math.max(maxOpacity,draw.opacity);
      }
      nrxAtlasLifecycle.draws++;
      nrxAtlasLifecycle.lastFrame={
       visibleOwners:visibleOwners.size,
       visibleOwnerIds:[...visibleOwners],
       illustrativeOwnerIds:[...illustrativeOwners.keys()],
       illustrativeProfiles:Object.fromEntries(illustrativeOwners),
       drawCount:objects.draws.length,
       opacityRange:visibleOwners.size?[minOpacity,maxOpacity]:null,
       size:[width,height],
       resources:native.stats?.(),
      };
      if(!transition.ready){
       transition.ready=true;
       transition.hideThree();
       onStatus({status:'ready'});
      }
     }
     if(transition.ready)return;
    }
   }catch(error){transition.fail(error);}
  }
  gl.render(scene,camera);
 },1);
 return null;
}
