import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Box3,BoxGeometry,InstancedMesh,MeshBasicMaterial,Matrix4,Vector3,Color,DoubleSide,AdditiveBlending} from 'three';
import {MeshBasicNodeMaterial} from 'three/webgpu';
import {uniform,positionWorld,normalWorld,cameraPosition,vec3,float,dot,abs,pow} from 'three/tsl';
import {samplePublicReference} from './live-reference-samples.mjs';
import {introFrame} from './materialization-state.mjs';
import {isVisibleOwner} from './atlas-presentation.js';
export const materializationLifecycle={created:0,disposed:0,active:0,samples:0};
// THIN_ADAPT of deployed v0.6.5 source sampling, cyan silhouette and Y-layer reveal.
// One existing R3F renderer; temporary materials and 2,048 source samples only.
// Original positions, owner IDs, camera and persistent visibility are unchanged.
export default function MaterializationEffect({bundles,clock,run,settings={count:2048,color:'#14bfff',effect:'layers'}}){
 const {scene}=useThree(),effect=useRef(null);
 useEffect(()=>{
  const groups=new Map(),surfaces=[],bounds=new Box3();
  for(const {scene:root} of bundles.values()){
   root.updateMatrixWorld(true);root.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry?.attributes?.position)return;
    let owner=mesh;while(owner&&!owner.userData?.semanticId)owner=owner.parent;if(!owner)return;
    const id=owner.userData.semanticId,skin=id==='FMA7163'||id==='VH_F_skin';if(!skin&&!isVisibleOwner(mesh))return;
    const b=new Box3().setFromObject(mesh);if(b.isEmpty())return;bounds.union(b);
    if(!groups.has(id))groups.set(id,{id,parts:[],skin});
    groups.get(id).parts.push({world:new Float32Array(mesh.matrixWorld.elements),bounds:{min:b.min.toArray(),max:b.max.toArray()},geometry:()=>({positions:mesh.geometry.attributes.position.array,indices:mesh.geometry.index?.array})});
    if(!skin)surfaces.push(mesh);
   });
  }
  if(!groups.size||bounds.isEmpty())return;
  const all=[...groups.values()],skin=all.find(g=>g.skin),count=[512,2048,8192].includes(settings.count)?settings.count:2048;
  const sampled=samplePublicReference(all,count).data;
  if(skin){const outline=samplePublicReference([skin],count/2).data;for(let i=0;i<count/2;i++)sampled.set(outline.subarray(i*8,i*8+8),i*16)}
  const size=bounds.getSize(new Vector3()),radius=size.length()/2,cut=uniform(bounds.min.y),gain=uniform(0),records=[];
  const rim=pow(float(1).sub(abs(dot(normalWorld.normalize(),cameraPosition.sub(positionWorld).normalize()))),2.1);
  for(const mesh of surfaces){
   const original=mesh.material,base=Array.isArray(original)?original[0]:original;
   const mat=new MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:DoubleSide});
   mat.colorNode=vec3(...new Color(settings.color).toArray()).mul(float(.38).add(rim.mul(1.45)));
   mat.opacityNode=float(.22).add(rim.mul(.55)).mul(gain).mul(base?.opacity??1);mat.maskNode=positionWorld.y.lessThanEqual(cut);
   mesh.material=mat;records.push({mesh,original,mat});
  }
  const geometry=new BoxGeometry(2,2,2),material=new MeshBasicMaterial({color:settings.color,transparent:true,opacity:.7,depthWrite:false,blending:AdditiveBlending});
  const particles=new InstancedMesh(geometry,material,count),m=new Matrix4();particles.frustumCulled=false;particles.raycast=()=>{};
  for(let i=0;i<count;i++){m.makeScale(radius*.0015,radius*.0015,radius*.0015);m.setPosition(sampled[i*8],sampled[i*8+1],sampled[i*8+2]);particles.setMatrixAt(i,m)}
  particles.instanceMatrix.needsUpdate=true;scene.add(particles);effect.current={cut,gain,min:bounds.min.y,height:size.y,material};
  materializationLifecycle.created++;materializationLifecycle.active++;materializationLifecycle.samples=count;
  return()=>{effect.current=null;scene.remove(particles);geometry.dispose();material.dispose();particles.dispose();for(const {mesh,original,mat} of records){if(mesh.material===mat)mesh.material=original;mat.dispose()}materializationLifecycle.disposed++;materializationLifecycle.active--;materializationLifecycle.samples=0;};
 },[bundles,scene,run,settings.count,settings.color,settings.effect]);
 useFrame(()=>{const e=effect.current;if(!e)return;const f=introFrame(clock.current.paused?clock.current.elapsedMs:performance.now()-clock.current.started);e.cut.value=e.min+e.height*(settings.effect==='particles'?1:f.reveal)+1e-5;e.gain.value=settings.effect==='particles'?f.forming:Math.min(1,f.forming/.12);e.material.opacity=.7*f.particles;});
 return null;
}
