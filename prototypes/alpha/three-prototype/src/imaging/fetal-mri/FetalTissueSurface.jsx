import React, {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Box3, Vector3, DataTexture, DoubleSide, SRGBColorSpace} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import RenderCadence, {requestSceneFrames} from '../../RenderCadence.jsx';
import ComparisonWipe from '../../ComparisonWipe.jsx';
import {synchronizeComparisonCamera} from '../../linked-comparison.js';
import './tissue-comparison.css';
import {fitPerspectiveBounds} from '../../fit-perspective-bounds.js';
import {sourcePlaneCorners} from './source-plane.mjs';
import {tissueSurface} from './tissue-surface.mjs';

const policy={fps:30};
const cameraStart={fov:34, near:.05, far:1000};
const directions={oblique:new Vector3(-.8,.45,-1),side:new Vector3(-1,0,0)};

const uvs=new Float32Array([0,0,1,0,0,1,1,1]);
const triangles=new Uint16Array([0,1,2,2,1,3]);

function SourcePlane({volume,axis,index,slice,planeCorners}) {
  const {width,height,rgba}=slice;
  const corners=useMemo(()=>planeCorners ?? sourcePlaneCorners(volume,axis,index,width,height),[volume,axis,index,width,height,planeCorners]);
  const texture=useMemo(()=>{
    const map=new DataTexture(rgba,width,height);
    map.colorSpace=SRGBColorSpace;
    map.needsUpdate=true;
    return map;
  },[rgba,width,height]);
  useLayoutEffect(()=>{requestSceneFrames();return ()=>texture.dispose();},[texture]);
  return <mesh raycast={()=>null} frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[corners,3]}/>
      <bufferAttribute attach="attributes-uv" args={[uvs,2]}/><bufferAttribute attach="index" args={[triangles,1]}/></bufferGeometry>
    <meshBasicMaterial map={texture} side={DoubleSide} toneMapped={false}/>
  </mesh>;
}

function TissueMesh({data,view,onSelect,opacity,cameraBridge,comparison,split,planeCorners}) {
  const camera=useThree(s=>s.camera), gl=useThree(s=>s.gl), size=useThree(s=>s.size), mesh=useRef();
  const currentCorners=useRef(planeCorners);
  currentCorners.current=planeCorners;
  useLayoutEffect(()=>{
    const controls=new OrbitControls(camera,gl.domElement);
    controls.addEventListener('change',requestSceneFrames);
    mesh.current.geometry.computeBoundingBox();
    mesh.current.geometry.computeBoundingSphere();
    const bounds=new Box3().setFromObject(mesh.current);
    if(comparison && currentCorners.current){
      const corner=new Vector3();
      for(let n=0;n<currentCorners.current.length;n+=3)bounds.expandByPoint(corner.fromArray(currentCorners.current,n));
    }
    cameraBridge.current=camera;
    fitPerspectiveBounds(camera,controls,bounds,directions[view.direction],1.35);
    requestSceneFrames();
    return ()=>{cameraBridge.current=null;controls.removeEventListener('change',requestSceneFrames);controls.dispose();};
  },[camera,gl,data,view,size.width,size.height,cameraBridge,comparison]);
  return <mesh ref={mesh} visible={opacity>0} onClick={event=>{
    if(comparison && event.pointer.x < split/50-1)return;
    if(event.delta<=4 && Number.isInteger(event.faceIndex)) onSelect?.(data.owners[Math.floor(event.faceIndex/2)]);
  }}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[data.positions,3]}/>
      <bufferAttribute attach="attributes-normal" args={[data.normals,3]}/>
      <bufferAttribute attach="attributes-color" args={[data.colors,3]}/>
      <bufferAttribute attach="index" args={[data.indices,1]}/>
    </bufferGeometry>
    <meshStandardMaterial vertexColors roughness={.82} transparent={opacity<1} opacity={opacity} depthWrite={opacity===1}/>
  </mesh>;
}

function FollowCamera({cameraBridge}) {
  const camera=useThree(s=>s.camera);
  useFrame(()=>synchronizeComparisonCamera(camera,cameraBridge.current));
  return null;
}

class DisplayBoundary extends React.Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p role="alert">3D display unavailable. Choose MRI slices to continue exploring.</p>:this.props.children;}
}

export default function FetalTissueSurface({volume,tissueId,CanvasComponent,createRenderer,onSelect,slice,sourceSlice,comparison=false,axis,index,opacity=1,planeCorners,ariaLabel='Fetal brain tissue surface'}) {
  const data=useMemo(()=>tissueSurface(volume,tissueId),[volume,tissueId]);
  const [view,setView]=useState({direction:'oblique'});
  const [split,setSplit]=useState(50);
  const cameraBridge=useRef(null);
  const selectionLabel=tissueId===3 && comparison ? 'Fibroid' : volume.byId.get(tissueId)?.name;
  return <section aria-label={ariaLabel}>
    <div className={comparison?'tissue-wipe-view':undefined} style={{position:'relative',height:'clamp(240px,43dvh,520px)',background:'#07121c',borderRadius:8,overflow:'hidden'}}>
      <DisplayBoundary><CanvasComponent gl={createRenderer} camera={cameraStart} dpr={1} frameloop="never">
        <RenderCadence name="fetal-tissue" policy={policy}/>
        <ambientLight intensity={1.5}/><directionalLight position={[-3,5,-4]} intensity={2}/>
        <TissueMesh data={data} view={view} onSelect={onSelect} opacity={opacity} cameraBridge={cameraBridge} comparison={comparison} split={split} planeCorners={planeCorners}/>
        {slice && <SourcePlane volume={volume} axis={axis} index={index} slice={slice} planeCorners={planeCorners}/>}
      </CanvasComponent></DisplayBoundary>
      {comparison && sourceSlice && <>
        <ComparisonWipe split={split} onSplit={setSplit} label={'Source MRI ↔ '+selectionLabel} rangeLabel="Fibroid comparison divider" side="left">
          <DisplayBoundary><CanvasComponent gl={createRenderer} camera={cameraStart} dpr={1} frameloop="never">
            <RenderCadence name="myoma-source" policy={policy}/>
            <FollowCamera cameraBridge={cameraBridge}/>
            <SourcePlane volume={volume} axis={axis} index={index} slice={sourceSlice} planeCorners={planeCorners}/>
          </CanvasComponent></DisplayBoundary>
        </ComparisonWipe>
        <div className="tissue-wipe-labels" aria-hidden="true"><span>Source MRI</span><span>{selectionLabel} segmentation</span></div>
      </>}
    </div>
    <div><button type="button" onClick={()=>setView({direction:'oblique'})}>Fit tissue</button>{' '}
      <button type="button" onClick={()=>setView({direction:'side'})}>Side view</button></div>
    <small>{comparison?'Drag either side to rotate both views. The MRI and its tissue labels share the same source coordinates.':'Drag to rotate. The surface follows the boundaries of the source tissue labels.'}</small>
  </section>;
}
