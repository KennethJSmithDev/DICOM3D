import React, {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import {Box3, Vector3} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import RenderCadence, {requestSceneFrames} from '../../RenderCadence.jsx';
import {fitPerspectiveBounds} from '../../fit-perspective-bounds.js';
import {tissueSurface} from './tissue-surface.mjs';

const policy={fps:30};
const cameraStart={fov:34, near:.05, far:1000};
const directions={oblique:new Vector3(-.8,.45,-1),side:new Vector3(-1,0,0)};

function TissueMesh({data,view,onSelect}) {
  const camera=useThree(s=>s.camera), gl=useThree(s=>s.gl), size=useThree(s=>s.size), mesh=useRef();
  useLayoutEffect(()=>{
    const controls=new OrbitControls(camera,gl.domElement);
    controls.addEventListener('change',requestSceneFrames);
    mesh.current.geometry.computeBoundingBox();
    mesh.current.geometry.computeBoundingSphere();
    fitPerspectiveBounds(camera,controls,new Box3().setFromObject(mesh.current),directions[view.direction],1.35);
    requestSceneFrames();
    return ()=>{controls.removeEventListener('change',requestSceneFrames);controls.dispose();};
  },[camera,gl,data,view,size.width,size.height]);
  return <mesh ref={mesh} onClick={event=>{
    if(event.delta<=4 && Number.isInteger(event.faceIndex)) onSelect?.(data.owners[Math.floor(event.faceIndex/2)]);
  }}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[data.positions,3]}/>
      <bufferAttribute attach="attributes-normal" args={[data.normals,3]}/>
      <bufferAttribute attach="attributes-color" args={[data.colors,3]}/>
      <bufferAttribute attach="index" args={[data.indices,1]}/>
    </bufferGeometry>
    <meshStandardMaterial vertexColors roughness={.82}/>
  </mesh>;
}

class DisplayBoundary extends React.Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p role="alert">3D display unavailable. Choose MRI slices to continue exploring.</p>:this.props.children;}
}

export default function FetalTissueSurface({volume,tissueId,CanvasComponent,createRenderer,onSelect}) {
  const data=useMemo(()=>tissueSurface(volume,tissueId),[volume,tissueId]);
  const [view,setView]=useState({direction:'oblique'});
  return <section aria-label="Fetal brain tissue surface">
    <div style={{height:'clamp(240px,43dvh,520px)',background:'#07121c',borderRadius:8,overflow:'hidden'}}>
      <DisplayBoundary><CanvasComponent gl={createRenderer} camera={cameraStart} dpr={1} frameloop="never">
        <RenderCadence name="fetal-tissue" policy={policy}/>
        <ambientLight intensity={1.5}/><directionalLight position={[-3,5,-4]} intensity={2}/>
        <TissueMesh data={data} view={view} onSelect={onSelect}/>
      </CanvasComponent></DisplayBoundary>
    </div>
    <div><button type="button" onClick={()=>setView({direction:'oblique'})}>Fit tissue</button>{' '}
      <button type="button" onClick={()=>setView({direction:'side'})}>Side view</button></div>
    <small>Drag to rotate. The surface follows the boundaries of the atlas’s labeled voxels.</small>
  </section>;
}
