import {BackSide,DoubleSide,Frustum,Matrix4,Vector3,WebGLCoordinateSystem,WebGPUCoordinateSystem} from 'three';
import {organTissueProfile} from './organ-tissue-profiles.mjs';

const webGlToWebGpu=new Matrix4().set(1,0,0,0, 0,1,0,0, 0,0,.5,.5, 0,0,0,1);
const noBackground=[0,0,0,0];
const materialMapKeys=['map','alphaMap','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap','bumpMap','lightMap','displacementMap','envMap'];
const rgb=(color,multiplier=1)=>color?[color.r*multiplier,color.g*multiplier,color.b*multiplier]:[0,0,0];

function unpack(attribute,size=3) {
 if(!attribute)return undefined;
 if(!attribute.isInterleavedBufferAttribute&&attribute.array instanceof Float32Array&&attribute.itemSize===size&&!attribute.normalized)return attribute.array;
 const values=new Float32Array(attribute.count*size);
 for(let i=0;i<attribute.count;i++){
  const j=i*size;
  values[j]=attribute.getX(i);values[j+1]=attribute.getY(i);values[j+2]=attribute.getZ(i);
  if(size===4)values[j+3]=attribute.getW(i);
 }
 return values;
}

function indicesOf(attribute) {
 if(!attribute)return undefined;
 if(attribute.array instanceof Uint32Array||attribute.array instanceof Uint16Array)return attribute.array;
 return Uint16Array.from(attribute.array);
}

const attributeVersion=attribute=>attribute?.version??attribute?.data?.version??0;

// Three remains the scene and picking owner. The direct GPU backend reads
// the exact current draw ranges, so source component isolation stays aligned
// with the raycaster even for shared-buffer and cloned presentation geometry.
export function createAtlasDrawList(){
 const cache=new WeakMap();
 const viewProjection=new Matrix4();
 const frustum=new Frustum();
 const center=new Vector3();
 const eye=new Vector3();

 function resource(geometry,line,visible){
  const current=cache.get(geometry);
  if(!visible)return current?.descriptor;
  const {position,normal,color}=geometry.attributes;
  const attributes=[position,normal,color,geometry.index];
  const versions=attributes.map(attributeVersion);
  if(current&&attributes.every((attribute,index)=>attribute===current.attributes[index]&&versions[index]===current.versions[index])){
   return current.descriptor;
  }
  if(!position||position.itemSize<3)throw Error('Atlas vertex positions are unavailable');
  // BoxHelper refreshes its eight positions on every camera frame. Reuse the
  // upload when that refresh did not actually move the selection bounds.
  if(line&&current&&position.array?.every((value,i)=>value===current.descriptor.positions[i])){
   current.versions=versions;
   return current.descriptor;
  }
  const positions=unpack(position);
  const colorSize=color?.itemSize===4?4:3;
  const descriptor={
   positions:line?Float32Array.from(positions):positions,
   normals:unpack(normal),colors:unpack(color,colorSize),colorSize,indices:indicesOf(geometry.index),
  };
  cache.set(geometry,{attributes,versions,descriptor});
  return descriptor;
 }

 function add(draws,geometry,node,material,rangeStart,rangeCount,line,owner,illustrativeTissue){
  if(!material?.visible||material.opacity<=0)return;
  if(materialMapKeys.some(key=>material[key]))throw Error('This textured atlas material requires the Three.js backend');
  const source=node.geometry;
  const count=source.index?.count??source.attributes.position.count;
  const start=Math.max(rangeStart,source.drawRange.start);
  const end=Math.min(count,rangeStart+rangeCount,source.drawRange.start+source.drawRange.count);
  if(end<=start)return;
  const unit=line?2:3;
  if(start%unit||(end-start)%unit)throw Error('Atlas draw range is not aligned to its source primitive');
  if(!source.boundingSphere)source.computeBoundingSphere();
  center.copy(source.boundingSphere.center).applyMatrix4(node.matrixWorld);
  draws.push({
   owner,geometry,start,count:end-start,modelMatrix:node.matrixWorld.elements,illustrativeTissue,
   center:center.toArray(),color:rgb(material.color),opacity:material.opacity,
   emissive:rgb(material.emissive,material.emissiveIntensity??1),
   roughness:material.roughness,metalness:material.metalness,
   vertexColors:material.vertexColors,unlit:line||material.isMeshBasicMaterial,
   transparent:material.transparent,alphaTest:material.alphaTest,
   forceSinglePass:material.forceSinglePass,renderOrder:node.renderOrder,
   side:material.side===DoubleSide?'double':material.side===BackSide?'back':'front',
   depthWrite:material.depthWrite,depthTest:material.depthTest,
   topology:line?'line-list':'triangle-list',
  });
 }

 function collect(scene,camera,{showIllustrativeTissue=false}={}){
  const draws=[],residentGeometries=new Set();
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  if(camera.coordinateSystem===WebGLCoordinateSystem)viewProjection.premultiply(webGlToWebGpu);
  frustum.setFromProjectionMatrix(viewProjection,WebGPUCoordinateSystem);
  eye.setFromMatrixPosition(camera.matrixWorld);

  function visit(node,parentVisible,parentOwner){
   const visible=parentVisible&&node.visible;
   const owner=node.userData.semanticId??parentOwner;
   // The helper is a Three-generated selection outline, never a catalog mesh.
   const line=node.type==='BoxHelper';
   if((node.isMesh&&owner||line)&&node.geometry){
    const drawVisible=visible&&node.layers.test(camera.layers)&&(!node.frustumCulled||frustum.intersectsObject(node));
    const geometry=resource(node.geometry,line,drawVisible);
    if(geometry)residentGeometries.add(geometry);
    if(drawVisible&&geometry){
     if(node.isInstancedMesh||node.isSkinnedMesh)throw Error('This animated atlas primitive requires the Three.js backend');
     const materials=node.material;
     const illustrativeTissue=showIllustrativeTissue&&!line?organTissueProfile(owner):0;
     if(Array.isArray(materials)){
      for(const group of node.geometry.groups)add(draws,geometry,node,materials[group.materialIndex],group.start,group.count,line,owner,illustrativeTissue);
     }else{
      add(draws,geometry,node,materials,0,Infinity,line,owner,illustrativeTissue);
     }
    }
   }
   for(const child of node.children)visit(child,visible,owner);
  }
  visit(scene,true,null);
  const background=scene.background?.isColor?[...rgb(scene.background),1]:noBackground;
  return {draws,residentGeometries,viewProjection:viewProjection.elements,cameraPosition:eye.toArray(),background};
 }
 return {collect};
}
