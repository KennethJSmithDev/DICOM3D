import {addToScene,getMeshTriangles,addMeshToTask,removeMeshFromTask,createMeshFromData,createTexture2DFromPixels,updateTexture2DFromPixels,updateMeshGeometry,createPbrMaterial,setPbrUnlit,setParent,setSubtreeVisible,createTexture3DFromPixels,createSurfaceRenderTargetTexture,onRenderTargetTextureResize,onBeforeRender,getFrameGraph,withSampledDepthTexture,createRenderTask,addTask,createEffectWrapper,setEffectTexture,setEffectUniforms,createEffectRenderer,registerEffectRenderer,createEffectRenderTask,disposeEffectRenderer,disposeEffectWrapper,disposeRenderTargetTexture,releaseTexture,waitForGpuResourceRetirements,waitForGpuIdle,getViewProjectionMatrix,invertMat4} from '@babylonjs/lite';
import {volumeMatrices,volumeSamplerWGSL,volumeUniformWGSL,volumeTransferWGSL} from './ct-volume-core.mjs';
import {planeModel,point,validateSpatial} from './ct-spatial.mjs';
import {packMaskedStored} from './masked-ct-core.mjs';
import {checkPlaneGpu} from './ct-plane-check';
import {probeVolume} from './volume-probe';

// Compose existing opaque-plane and VOL-B sampler foundations in Lite's existing frame graph.
const volumeShader=volumeSamplerWGSL+volumeUniformWGSL+volumeTransferWGSL+`
@group(0) @binding(2) var meshColor:texture_2d<f32>;@group(0) @binding(3) var meshDepth:texture_depth_2d;
fn world(p:vec2<f32>,depth:f32)->vec3<f32>{let q=ct.inverseViewProjection*vec4<f32>(p,depth,1);return q.xyz/q.w;}
@fragment fn effectFragment(@builtin(position) pixel:vec4<f32>)->@location(0) vec4<f32>{
let uv=pixel.xy/ct.screen.xy;let xy=vec2<i32>(uv*vec2<f32>(textureDimensions(meshColor)));let background=textureLoad(meshColor,xy,0).rgb;
if(ct.display.w<.5){return vec4<f32>(background,1);}let ndc=vec2<f32>(uv.x*2-1,1-uv.y*2);let origin=world(ndc,1);let direction=normalize(world(ndc,.0001)-origin);
let depth=textureLoad(meshDepth,xy,0);var stop=1e5;if(depth>0){stop=dot(world(ndc,depth)-origin,direction);}let o=(ct.worldToTexture*vec4<f32>(origin,1)).xyz;let d=(ct.worldToTexture*vec4<f32>(direction,0)).xyz;
let a=(vec3<f32>(-.5)-o)/d;let b=(vec3<f32>(511.5,511.5,102.5)-o)/d;let near=max(max(min(a,b).x,min(a,b).y),min(a,b).z);let far=min(min(max(a,b).x,max(a,b).y),max(a,b).z);
var rgb=0.0;var alpha=0.0;for(var i=0;i<512;i++){let t=max(near,0.0)+(f32(i)+.5)*ct.screen.z;if(t>far||t>stop||alpha>=.999){break;}let p=o+d*t;if(p.z<ct.clip.x){continue;}
if(ct.clip.y>.5){let texel=clamp(vec3<i32>(floor(p+vec3<f32>(.5))),vec3<i32>(0),vec3<i32>(511,511,102));if(textureLoad(volume,texel,0).b<.5){continue;}}
let sample=transfer(interpolate(p));rgb+=(1-alpha)*sample.y*sample.x;alpha+=(1-alpha)*sample.y;}
return vec4<f32>(vec3<f32>(rgb)+(1-alpha)*background,1);}`;
const presentShader=`@group(0)@binding(0)var composite:texture_2d<f32>;@fragment fn effectFragment(@builtin(position)p:vec4<f32>)->@location(0)vec4<f32>{return textureLoad(composite,vec2<i32>(p.xy),0);}`;

export function createIntegratedCt({engine,scene,camera,canvas,meshes,particles,guide,holographic,manifest}:any){
  const studyWorld=meshes[0],m=manifest.spatial.matrices,matrices=volumeMatrices(m,studyWorld.worldMatrix);
  const opaque=createSurfaceRenderTargetTexture(engine,{lbl:'lab opaque CT plane',format:'rgba8unorm',dFormat:'depth32float',samples:1,size:engine},withSampledDepthTexture);
  const composite=createSurfaceRenderTargetTexture(engine,{lbl:'lab CT composite',format:'rgba8unorm',samples:1,size:engine});
  const planeTask=createRenderTask({name:'Acquired plane opaque depth',rt:opaque.rt,sharedRt:true,clr:true,clrColor:scene.clearColor,autoMirror:false},engine,scene);addTask(scene,planeTask);
  const dummy=createTexture3DFromPixels(engine,new Uint8Array([0,0,0,255]),1,1,1,{srgb:false,filter:'nearest'});
  const effect=createEffectWrapper(engine,{name:'Reused dense CT with optional SEG membership',fragmentWGSL:volumeShader,bindings:[{name:'volume',binding:0,kind:'texture',viewDimension:'3d'},{name:'ct',binding:1,kind:'uniform',uniformByteLength:256},{name:'meshColor',binding:2,kind:'texture'},{name:'meshDepth',binding:3,kind:'texture',textureSampleType:'depth'}]});
  setEffectTexture(effect,'volume',dummy);setEffectTexture(effect,'meshColor',opaque.texture);setEffectTexture(effect,'meshDepth',opaque.depthTexture!);
  addTask(scene,createEffectRenderTask({name:'CT context before transparent anatomy',effect,target:composite.rt,clear:true},engine));
  const overlay=createRenderTask({name:'Hologram over acquired context',rt:composite.rt,depth:opaque.rt,sharedRt:true,clr:false,autoMirror:false},engine,scene);addTask(scene,overlay);
  for(const mesh of meshes)addMeshToTask(overlay,mesh,{material:holographic});addMeshToTask(overlay,particles);addMeshToTask(overlay,guide);
  const present=createEffectWrapper(engine,{name:'Integrated lab presentation',fragmentWGSL:presentShader,bindings:[{name:'composite',binding:0,kind:'texture'}]});setEffectTexture(present,'composite',composite.texture);
  const presentation=createEffectRenderer(engine,present,{clear:true,clearColor:scene.clearColor});
  let texture:any=null,epoch=0,frameRevision=0,disposed=false,loaded=false,volumeVisible=false,masked=false,planeVisible=false,level=-600,width=1500,gain=1,clipK=-.5,k=71,loads=0,releases=0,loadMs=0,overlayMaterial=holographic;
  const uniform=new Float32Array(64),normals=new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),indices=new Uint32Array([0,1,2,0,2,3]),uvs=new Float32Array([0,0,1,0,1,1,0,1]);
  const planeTexture=createTexture2DFromPixels(engine,new Uint8Array(1048576),512,512,{minFilter:'nearest',magFilter:'nearest',srgb:true});
  const planeMaterial=createPbrMaterial({baseColorTexture:planeTexture,baseColorFactor:[1,1,1,1],doubleSided:true});setPbrUnlit(planeMaterial);
  const plane=createMeshFromData(engine,'presentation.acquired-source-plane',new Float32Array(planeModel(m,k).flat()),normals,indices,uvs);plane.material=planeMaterial;
  setParent(plane,{get worldMatrix(){return studyWorld.worldMatrix;},get worldMatrixVersion(){return studyWorld.worldMatrixVersion;}} as any);
  // WHY: setParent preserves the previous world pose, cancelling the accepted root reflection.
  // BOUNDARY: reset only this derived plane's local TRS, as the existing CTX-002 adapter does.
  // INVARIANT: plane model vertices inherit the same study world transform as the unchanged GLB.
  // EVIDENCE: integrated/A2-gpu-mapping.json measured identity instead of the source reflection.
  // REGRESSION: compare actual retained positions/world and GPU-read corners, not metadata predictions.
  plane.position.set(0,0,0);plane.rotationQuaternion.set(0,0,0,1);plane.scaling.set(1,1,1);
  addToScene(scene,plane);setSubtreeVisible(plane,false);addMeshToTask(planeTask,plane);
  const update=()=>{if(disposed)return;const inv=invertMat4(getViewProjectionMatrix(camera,canvas.width/canvas.height));if(!inv)return;uniform.set(inv,0);uniform.set(matrices.worldToTexture,16);uniform.set(matrices.textureToWorld,32);uniform.set([level,width,gain,Number(Boolean(texture)&&volumeVisible)],48);uniform.set([canvas.width,canvas.height,.002,0],52);uniform.set([clipK,Number(masked),0,0],56);setEffectUniforms(effect,uniform);};
  onBeforeRender(scene,update);update();
  const resize1=onRenderTargetTextureResize(opaque,()=>{setEffectTexture(effect,'meshColor',opaque.texture);setEffectTexture(effect,'meshDepth',opaque.depthTexture!);});
  const resize2=onRenderTargetTextureResize(composite,()=>{setEffectTexture(present,'composite',composite.texture);registerEffectRenderer(presentation);});
  let lastW=canvas.width,lastH=canvas.height;onBeforeRender(scene,()=>{if(disposed)return;if(lastW!==canvas.width||lastH!==canvas.height){lastW=canvas.width;lastH=canvas.height;getFrameGraph(scene).build();}});
  function clearTexture(){setEffectTexture(effect,'volume',dummy);if(texture){releaseTexture(texture);texture=null;releases++;}}
  return {
    start(){registerEffectRenderer(presentation);},
    sourceFrame(receipt:any,image:ImageData,frame:number){frameRevision++;validateSpatial(receipt,manifest);k=frame;loaded=true;updateMeshGeometry(engine,plane,new Float32Array(planeModel(m,k).flat()),normals,indices,uvs);updateTexture2DFromPixels(engine,planeTexture,new Uint8Array(image.data.buffer));setSubtreeVisible(plane,planeVisible);},
    async loadVolume(source:Uint16Array,mask:Uint8Array){const token=++epoch,t=performance.now();clearTexture();const packed=packMaskedStored(source,mask);const candidate=createTexture3DFromPixels(engine,packed,512,512,103,{filter:'nearest',srgb:false});try{await waitForGpuIdle(engine);}catch(error){releaseTexture(candidate);throw error;}if(token!==epoch||disposed){releaseTexture(candidate);return false;}texture=candidate;loads++;loadMs=performance.now()-t;setEffectTexture(effect,'volume',candidate);update();return true;},
    settings(options:any){if(options.plane!==undefined)planeVisible=options.plane;if(options.volume!==undefined)volumeVisible=options.volume;if(options.masked!==undefined)masked=options.masked;if(options.gain!==undefined)gain=options.gain;if(options.clip!==undefined)clipK=options.clip;if(options.level!==undefined)level=options.level;if(options.width!==undefined)width=options.width;setSubtreeVisible(plane,loaded&&planeVisible);update();},
    overlayMaterial(material:any){if(material===overlayMaterial)return;overlayMaterial=material;for(const mesh of meshes){removeMeshFromTask(overlay,mesh);addMeshToTask(overlay,mesh,{material});}},
    worldToTexture:matrices.worldToTexture,
    pickOccluder(){return plane;},
    async verify(points:number[][]){if(!loaded||!texture)throw Error('Load CT and volume before mapping probe');update();const token=epoch,frame=k,revision=frameRevision,positions=getMeshTriangles(plane)!.positions,world=new Float32Array(plane.worldMatrix);const planeResult=await checkPlaneGpu(engine,planeTexture,positions,world);const volumeResult=await probeVolume(engine,texture,uniform,points);if(token!==epoch||frame!==k||revision!==frameRevision)throw Error('Source frame changed during probe');return {k:frame,epoch,frameRevision:revision,uploadedPositions:Array.from(positions),worldMatrix:Array.from(world),plane:planeResult,volume:volumeResult};},
    fit(){const corners=[];for(let i=0;i<8;i++){const p=[i&1?511.5:-.5,i&2?511.5:-.5,i&4?102.5:-.5];corners.push([0,1,2].map(d=>matrices.textureToWorld[d]*p[0]+matrices.textureToWorld[d+4]*p[1]+matrices.textureToWorld[d+8]*p[2]+matrices.textureToWorld[d+12]));}const min=[0,1,2].map(d=>Math.min(...corners.map(p=>p[d]))),max=[0,1,2].map(d=>Math.max(...corners.map(p=>p[d]))),center=min.map((v,d)=>(v+max[d])/2),radius=Math.hypot(...max.map((v,d)=>(v-min[d])/2));camera.target.set(...center);const half=Math.min(camera.fov/2,Math.atan(Math.tan(camera.fov/2)*canvas.width/canvas.height));camera.radius=radius*1.1/Math.sin(half);camera.nearPlane=radius*.001;camera.farPlane=camera.radius*100;},
    snapshot(){
      const uploadedPositions=Array.from(getMeshTriangles(plane)!.positions),worldMatrix=Array.from(plane.worldMatrix) as number[];
      const transform=(p:number[],a:ArrayLike<number>)=>[0,1,2].map(d=>a[d]*p[0]+a[d+4]*p[1]+a[d+8]*p[2]+a[d+12]);
      const modelCorners=[0,1,2,3].map(i=>uploadedPositions.slice(i*3,i*3+3) as number[]),worldCorners=modelCorners.map(p=>transform(p,worldMatrix));
      const patientCorners=worldCorners.map(p=>{const q=transform(p,matrices.worldToTexture);return point(m.index_to_patient_mm,[q[2],q[1],q[0]]);});
      const expectedModelCorners=planeModel(m,k),expectedWorldMatrix=Array.from(studyWorld.worldMatrix) as number[],expectedWorldCorners=expectedModelCorners.map((p:number[])=>transform(p,expectedWorldMatrix));
      return {loaded,volumeLoaded:Boolean(texture),volumeVisible,masked,planeVisible:plane.visible!==false,k,clipK,level,width,gain,epoch,frameRevision,loads,releases,loadMs,
        uploadedPositions,modelCorners,worldMatrix,worldCorners,patientCorners,localTransform:{position:[plane.position.x,plane.position.y,plane.position.z],rotationQuaternion:[plane.rotationQuaternion.x,plane.rotationQuaternion.y,plane.rotationQuaternion.z,plane.rotationQuaternion.w],scaling:[plane.scaling.x,plane.scaling.y,plane.scaling.z]},
        expectedMapping:{modelCorners:expectedModelCorners,worldMatrix:expectedWorldMatrix,worldCorners:expectedWorldCorners,patientCorners:expectedModelCorners.map((p:number[])=>point(m.model_m_to_patient_mm,p))},
        mappingObservation:{scope:'CPU retained plane positions and actual world matrix; independent GPU probe remains required',maxWorldCornerErrorM:Math.max(...worldCorners.flatMap((p:number[],i:number)=>p.map((v:number,d:number)=>Math.abs(v-expectedWorldCorners[i][d]))))},
        worldToTexture:Array.from(matrices.worldToTexture),textureToWorld:Array.from(matrices.textureToWorld),sourceShape:[103,512,512],planeTextureLogicalBytes:1048576,volumeTextureLogicalBytes:texture?108003328:0,screenTargetLogicalBytes:canvas.width*canvas.height*12,peakPackedTemporaryBytes:108003328,composition:'opaque source plane/depth → CT raymarch stopped by plane → transparent source geometry overlay using plane depth → present',maskSampling:'nearest membership in packed blue; original CT low/high bytes untouched',stepMm:2};
    },
    async clear(){epoch++;frameRevision++;clearTexture();loaded=false;planeVisible=volumeVisible=masked=false;setSubtreeVisible(plane,false);updateTexture2DFromPixels(engine,planeTexture,new Uint8Array(1048576));update();await waitForGpuResourceRetirements(engine);},
    dispose(){disposed=true;epoch++;clearTexture();resize1();resize2();disposeEffectRenderer(presentation);disposeEffectWrapper(present);disposeEffectWrapper(effect);disposeRenderTargetTexture(opaque);disposeRenderTargetTexture(composite);releaseTexture(dummy);},
  };
}
