import {
  addToScene, attachControl, createDefaultCamera, createDirectionalLight, createEngine,
  createGpuPicker, createHemisphericLight, createMeshFromData, createPbrMaterial, createSceneContext,
  createShaderMaterial, createStorageBuffer, disposeEngine, disposePicker, disposeScene, disposeStorageBuffer,
  enableThinInstanceDynamicDrawCount, getMeshTriangles, isGpuTimingSupported, loadGltf,
  onBeforeRender, pickAsync, registerScene, resizeEngine, setGpuTimingEnabled, setShaderStorageBuffer,
  setShaderUniform, setSubtreeVisible, setThinInstanceCount, setThinInstances,
  startEngine, stopEngine, captureScreenshot,
} from '@babylonjs/lite';
import {createParticleSamples, byteFingerprint} from './particle-samples.mjs';
import {createIntegratedCt} from './integrated-ct';
import {sourceIndexVertices} from './source-overlay.mjs';

const CAPACITY = 8192;
const SEMANTIC_ID = 'lesion.lung.mass.001';
const PALETTES:Record<string,number[]> = {cyan:[.08,.75,1],ice:[.57,.86,1],amber:[1,.53,.13]};
const vertexOut = `struct VOut { @builtin(position) position:vec4<f32>, @location(0) worldPos:vec3<f32>, @location(1) normal:vec3<f32>, };`;
const surfaceVertex = `${vertexOut}
@vertex fn mainVertex(input:VertexInput)->VOut {
  var out:VOut; let wp=shaderSystem.world*vec4<f32>(input.position,1.0);
  out.position=shaderSystem.worldViewProjection*vec4<f32>(input.position,1.0); out.worldPos=wp.xyz;
  out.normal=normalize((shaderSystem.world*vec4<f32>(input.normal,0.0)).xyz); return out;
}`;
const surfaceFragment = `${vertexOut}
@fragment fn mainFragment(input:VOut)->@location(0) vec4<f32> {
  let sourceK=(shaderUniforms.worldToTexture*vec4<f32>(input.worldPos,1.0)).z;
  if(shaderUniforms.clipK>=0.0 && sourceK>shaderUniforms.clipK){discard;}
  let normalizedY=(sourceK-shaderUniforms.sourceBounds.x)/shaderUniforms.sourceBounds.y;
  if (shaderUniforms.reveal<1.0 && normalizedY>shaderUniforms.reveal) { discard; }
  let n=normalize(input.normal); let view=normalize(shaderSystem.cameraPosition-input.worldPos);
  let rim=pow(1.0-abs(dot(n,view)),2.15);
  let diffuse=.2+.28*abs(dot(n,normalize(vec3<f32>(.4,.8,-.5))));
  let scan=.035*(.5+.5*sin(normalizedY*280.0));
  let edgeBand=(1.0-smoothstep(.0,.018,abs(normalizedY-shaderUniforms.reveal)))*select(1.0,0.0,shaderUniforms.reveal>=1.0);
  let brightness=diffuse+rim*1.45+scan+edgeBand*.8+shaderUniforms.selected*.16;
  let color=shaderUniforms.tint*brightness+vec3<f32>(rim*.16);
  let alpha=(.22+.56*rim+edgeBand*.2)*shaderUniforms.opacity;
  return vec4<f32>(color,alpha);
}`;
const particleOut = `struct POut { @builtin(position) position:vec4<f32>, @location(0) light:f32, };`;
const particleVertex = `${particleOut}
@vertex fn mainVertex(input:VertexInput,@builtin(instance_index) id:u32)->POut {
  let surfaceSample=samples[id*2u]; let start=samples[id*2u+1u]; let p=shaderUniforms.progress;
  let stepSize=shaderUniforms.size/16.0;
  let lattice=clamp(shaderUniforms.center+round((surfaceSample.xyz-shaderUniforms.center)/stepSize)*stepSize,shaderUniforms.center-shaderUniforms.size*.5,shaderUniforms.center+shaderUniforms.size*.5);
  let emergence=smoothstep(surfaceSample.w*.16,surfaceSample.w*.16+.08,p);
  let activate=smoothstep(.14,.36,p);
  let converge=smoothstep(.32,.76,p);
  var pos=mix(mix(start.xyz,lattice,activate),surfaceSample.xyz,converge);
  let layer=((shaderUniforms.worldToTexture*vec4<f32>(surfaceSample.xyz,1.0)).z-shaderUniforms.sourceBounds.x)/shaderUniforms.sourceBounds.y;
  let layerVisibility=smoothstep(layer*.72,layer*.72+.12,p);
  let lit=emergence*select(1.0,layerVisibility,shaderUniforms.effect>.5);
  let scale=shaderUniforms.radius*(.005+.005*start.w)*lit;
  var out:POut;out.position=shaderSystem.viewProjection*vec4<f32>(pos+input.position*scale,1.0);
  out.light=(.48+.52*start.w)*lit*(1.0-smoothstep(.82,1.0,p)); return out;
}`;
const particleFragment = `${particleOut}
@fragment fn mainFragment(input:POut)->@location(0) vec4<f32> {
 return vec4<f32>(shaderUniforms.tint*1.45+vec3<f32>(.08),input.light);
}`;
const lineOut=`struct LOut{@builtin(position) position:vec4<f32>};`;

function quantiles(values:number[]) {
  if (!values.length) return {samples:0,p50Ms:null,p95Ms:null,maxMs:null};
  const sorted=[...values].sort((a,b)=>a-b), at=(q:number)=>sorted[Math.min(sorted.length-1,Math.floor(q*sorted.length))];
  return {samples:values.length,p50Ms:at(.5),p95Ms:at(.95),maxMs:sorted.at(-1)};
}

/** B04 FX/composition adapter. main.ts owns the existing engine, scene, camera and source.
 * Source arrays and source transforms are retained. activate follows registerScene.
 */
export function createPublicStudyVisual({engine,scene,camera,canvas,meshes,semantic,manifest}:any) {
  if(meshes.length!==1 || manifest.structure.semantic_id!==SEMANTIC_ID)throw Error('Unadmitted study structure');
  const began=performance.now(),errors:{message:string,count:number}[]=[];
  const gpuError=(event:any)=>{const message=String(event.error?.message??event);const found=errors.find(e=>e.message===message);if(found)found.count++;else if(errors.length<20)errors.push({message,count:1});};
  engine._device.addEventListener('uncapturederror',gpuError);
  const originalParts=meshes.map(mesh=>({...getMeshTriangles(mesh)!,world:new Float32Array(mesh.worldMatrix)}));
  const originalFingerprint=byteFingerprint(originalParts.flatMap(p=>[p.positions,p.indices,p.world]));
  // Source-k bounds include the half-voxel mesh extent. Final reveal=1 bypasses FX clipping.
  // This is presentation state; original GLB arrays, semantic IDs and transforms stay unchanged.
  const indexParts=sourceIndexVertices(originalParts,manifest.spatial.matrices);
  let sourceKMin=Infinity,sourceKMax=-Infinity;
  for(const part of indexParts)for(let i=0;i<part.positions.length;i+=3){sourceKMin=Math.min(sourceKMin,part.positions[i]);sourceKMax=Math.max(sourceKMax,part.positions[i]);}
  const sourceBounds=[sourceKMin,sourceKMax-sourceKMin];
  const samplingBegan=performance.now();
  const sampled=createParticleSamples(originalParts,CAPACITY);
  const sampleInitMs=performance.now()-samplingBegan;
  const {bounds}=sampled;const r=bounds.radius;
  const scientific=createPbrMaterial({baseColorFactor:[.72,.32,.22,1],metallicFactor:0,roughnessFactor:.8,doubleSided:true});
  const scientificSelected=createPbrMaterial({baseColorFactor:[.12,.65,.9,1],metallicFactor:0,roughnessFactor:.8,doubleSided:true});
  const holographic=createShaderMaterial({name:'lab-holographic-source-surface',vertexSource:surfaceVertex,fragmentSource:surfaceFragment,attributes:['position','normal'],
    uniforms:['world','worldViewProjection','cameraPosition',{name:'tint',type:'vec3<f32>',defaultValue:PALETTES.cyan},{name:'opacity',type:'f32',defaultValue:1},{name:'selected',type:'f32',defaultValue:0},{name:'reveal',type:'f32',defaultValue:1},{name:'worldToTexture',type:'mat4x4<f32>'},{name:'clipK',type:'f32',defaultValue:-1},{name:'sourceBounds',type:'vec2<f32>',defaultValue:sourceBounds}],needAlphaBlending:true,backFaceCulling:false,depthWrite:false});
  const positions=new Float32Array([-1,-1,-1,1,-1,-1,1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,1,1,-1,1,1]);
  const indices=new Uint32Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
  const particles=createMeshFromData(engine,'presentation-only-surface-samples',positions,positions.slice(),indices);
  const particleMaterial=createShaderMaterial({name:'lab-static-sample-assembly',vertexSource:particleVertex,fragmentSource:particleFragment,attributes:['position'],
    uniforms:['viewProjection',{name:'tint',type:'vec3<f32>',defaultValue:PALETTES.cyan},{name:'progress',type:'f32',defaultValue:1},{name:'effect',type:'f32',defaultValue:0},{name:'center',type:'vec3<f32>',defaultValue:bounds.center},{name:'size',type:'vec3<f32>',defaultValue:bounds.size},{name:'radius',type:'f32',defaultValue:r},{name:'worldToTexture',type:'mat4x4<f32>'},{name:'sourceBounds',type:'vec2<f32>',defaultValue:sourceBounds}],
    storageBuffers:[{name:'samples',type:'array<vec4<f32>>'}],needAlphaBlending:true,blendMode:'additive',backFaceCulling:false,depthWrite:false});
  const storage=createStorageBuffer(engine,sampled.data,'lab-fixed-surface-samples');setShaderStorageBuffer(particleMaterial,'samples',storage);
  const matrices=new Float32Array(CAPACITY*16);for(let n=0;n<CAPACITY;n++){const offset=n*16;matrices[offset]=matrices[offset+5]=matrices[offset+10]=matrices[offset+15]=1;}
  particles.material=particleMaterial;setThinInstances(particles,matrices,CAPACITY);enableThinInstanceDynamicDrawCount(particles);
  // Shader-displaced FX need conservative bounds. These bounds belong only to the new presentation mesh.
  particles.boundMin=bounds.center.map((v:number,k:number)=>v-bounds.size[k]);particles.boundMax=bounds.center.map((v:number,k:number)=>v+bounds.size[k]);
  addToScene(scene,particles);
  const linePositions:number[]=[];const segment=(a:number[],b:number[])=>linePositions.push(...a,...b);
  const floor=bounds.min[1]-r*.18, span=r*1.8;
  for(let n=-8;n<=8;n++){const offset=n*span/8;segment([bounds.center[0]-span,floor,bounds.center[2]+offset],[bounds.center[0]+span,floor,bounds.center[2]+offset]);segment([bounds.center[0]+offset,floor,bounds.center[2]-span],[bounds.center[0]+offset,floor,bounds.center[2]+span]);}
  // A sparse containment frame is a presentation guide, not a segmentation or measurement.
  const low=bounds.min.map((v:number)=>v-r*.1),high=bounds.max.map((v:number)=>v+r*.1);
  for(let mask=0;mask<8;mask++)for(let axis=0;axis<3;axis++)if(!(mask&(1<<axis))){
    const a=[0,1,2].map(k=>(mask&(1<<k))?high[k]:low[k]),b=[...a];b[axis]=high[axis];segment(a,b);
  }
  const guide=createMeshFromData(engine,'presentation-only-spatial-guide',new Float32Array(linePositions),new Float32Array(linePositions.length),Uint32Array.from({length:linePositions.length/3},(_,i)=>i));
  guide.material=createShaderMaterial({name:'lab-guide',vertexSource:`${lineOut}@vertex fn mainVertex(input:VertexInput)->LOut {var out:LOut;out.position=shaderSystem.worldViewProjection*vec4<f32>(input.position,1.0);return out;}`,fragmentSource:`${lineOut}@fragment fn mainFragment(input:LOut)->@location(0)vec4<f32>{return vec4<f32>(.05,.39,.57,.24);}`,attributes:['position'],uniforms:['worldViewProjection'],topology:'line-list',needAlphaBlending:true,blendMode:'additive',depthWrite:false});addToScene(scene,guide);
  const ct=createIntegratedCt({engine,scene,camera,canvas,meshes,particles,guide,holographic,manifest});
  setShaderUniform(holographic,'worldToTexture',ct.worldToTexture);
  setShaderUniform(particleMaterial,'worldToTexture',ct.worldToTexture);
  let currentMode='holographic',p=1,count=512,preset='cyan',effect='layers',reduced=false,visible=true,selected=false,sceneRegistered=false,linked=false,sourceK=71,cutaway=false;
  let disposed=false,initializationMs=0;
  let lastFrame=0,frames=0,firstFrameMs:number|null=null;
  const intervals:number[]=[],gpuTimes:number[]=[];
  const gpuTimingSupported=isGpuTimingSupported(engine);if(gpuTimingSupported)setGpuTimingEnabled(engine,true);
  // Read only the device already owned by Lite. A new adapter request could identify a different GPU.
  const adapterInfo=engine._device?.adapterInfo;
  const selectedAdapterInfo=adapterInfo?Object.fromEntries(['vendor','architecture','device','description','subgroupMinSize','subgroupMaxSize'].map(key=>[key,adapterInfo[key]??null])):null;
  const sync=()=>{
    const effectiveProgress=reduced?1:p,materializing=currentMode==='materialization';
    const surfaceVisible=visible&&(!materializing||effectiveProgress>=.06);
    setSubtreeVisible(semantic,surfaceVisible);setSubtreeVisible(particles,visible&&materializing&&effectiveProgress>0&&effectiveProgress<1);
    setSubtreeVisible(guide,currentMode!=='scientific');
    const material=currentMode==='scientific'?(selected?scientificSelected:scientific):holographic;
    if(sceneRegistered){for(const mesh of meshes)mesh.material=material;ct.overlayMaterial(material);}
    setShaderUniform(holographic,'opacity',materializing?Math.min(1,Math.max(0,(effectiveProgress-.06)/.06)):1);
    setShaderUniform(holographic,'reveal',materializing&&effect==='layers'&&!linked?Math.min(1,.12+.88*Math.max(0,(effectiveProgress-.06)/.94)):1);
    setShaderUniform(holographic,'clipK',linked&&cutaway?sourceK:-1);
    setShaderUniform(holographic,'selected',selected?1:0);
    setShaderUniform(particleMaterial,'progress',effectiveProgress);
    setShaderUniform(particleMaterial,'effect',effect==='layers'?1:0);
  };
  sync();setThinInstanceCount(particles,count);
  onBeforeRender(scene,()=>{const now=performance.now();if(firstFrameMs===null)firstFrameMs=now-began;if(lastFrame){intervals.push(now-lastFrame);if(intervals.length>600)intervals.shift();}lastFrame=now;frames++;if(gpuTimingSupported&&engine.gpuFrameTimeMs>0){gpuTimes.push(engine.gpuFrameTimeMs);if(gpuTimes.length>600)gpuTimes.shift();}});
  const pickDiscard={key:'lab-source-fragment-and-plane-v1',wgsl:`fn shouldDiscardPick(input:PickDiscardInput)->bool{
    if(pickState[5].x>.5){return false;}if(pickState[5].y<=0.0){return true;}
    let m=mat4x4<f32>(pickState[0],pickState[1],pickState[2],pickState[3]);let k=(m*vec4<f32>(input.worldPos,1)).z;let rule=pickState[4];
    if(rule.x>=0.0 && k>rule.x){return true;}return rule.y<1.0 && (k-rule.z)/rule.w>rule.y;
  }`,storage:[{name:'pickState',type:'array<vec4<f32>>',data:(mesh:any)=>{
    const effective=reduced?1:p,materializing=currentMode==='materialization',scientificMode=currentMode==='scientific';
    const opacity=materializing?Math.min(1,Math.max(0,(effective-.06)/.06)):1,reveal=materializing&&effect==='layers'&&!linked?Math.min(1,.12+.88*Math.max(0,(effective-.06)/.94)):1;
    return new Float32Array([...ct.worldToTexture,linked&&cutaway&&!scientificMode?sourceK:-1,scientificMode?1:reveal,...sourceBounds,Number(mesh===ct.pickOccluder()),opacity,0,0]);
  }}]};
  return {
    activate(){sceneRegistered=true;sync();ct.start();initializationMs=performance.now()-began;},
    pickAllowed(mesh:any){return mesh.visible!==false&&((visible&&meshes.includes(mesh))||mesh===ct.pickOccluder());},
    pickDiscard(){return pickDiscard;},
    mode(value:string){if(!['scientific','holographic','materialization'].includes(value))throw Error('Unknown presentation');currentMode=value;sync();},
    progress(value:number){p=Math.max(0,Math.min(1,value));sync();},
    density(value:number){if(![512,2048,8192].includes(value))throw Error('Unsupported particle budget');count=value;setThinInstanceCount(particles,count);},
    preset(value:string){if(!PALETTES[value])throw Error('Unknown material preset');preset=value;setShaderUniform(holographic,'tint',PALETTES[value]);setShaderUniform(particleMaterial,'tint',PALETTES[value]);},
    effect(value:string){if(!['assembly','layers'].includes(value))throw Error('Unknown effect');effect=value;sync();},
    reducedMotion(value:boolean){reduced=value;sync();},visible(value:boolean){visible=value;sync();},select(value:boolean){selected=value;sync();},
    resetMetrics(){intervals.length=gpuTimes.length=0;lastFrame=0;},
    sourceIndexGeometry(){return indexParts;},
    sourceFrame(receipt:any,image:ImageData,k:number){ct.sourceFrame(receipt,image,k);},
    loadVolume(source:Uint16Array,mask:Uint8Array){return ct.loadVolume(source,mask);},
    ctSettings(options:any){ct.settings(options);},
    linkSource(k:number,value:boolean,clip:boolean){sourceK=k;linked=value;cutaway=clip;sync();},
    fitContext(){ct.fit();},
    clearCt(){linked=false;cutaway=false;sync();return ct.clear();},
    verifySource(points:number[][]){return ct.verify(points);},
    capture(){return captureScreenshot(engine);},
    snapshot(){
      const currentParts=meshes.map(mesh=>({...getMeshTriangles(mesh)!,world:new Float32Array(mesh.worldMatrix)}));
      const currentFingerprint=byteFingerprint(currentParts.flatMap(part=>[part.positions,part.indices,part.world]));
      const rect=canvas.getBoundingClientRect();
      // Diagnostics only: read existing owned GPUBuffer sizes, including Lite's default unused UV streams.
      // This intentionally excludes source/engine/picker resources and is not a total process-GPU-memory claim.
      const meshBufferSizes=(mesh:any)=>Object.fromEntries(['positionBuffer','normalBuffer','uvBuffer','uv2Buffer','tangentBuffer','colorBuffer','indexBuffer'].map(key=>[key,mesh._gpu?.[key]?.size??0]));
      const particleGeometryGpuBytes=meshBufferSizes(particles),guideGeometryGpuBytes=meshBufferSizes(guide);
      const ownedGpuBuffers={particleGeometry:particleGeometryGpuBytes,guideGeometry:guideGeometryGpuBytes,sampleStorageBytes:(storage as any)._buffer?.size??0,instanceMatricesBytes:(particles as any).thinInstances?._gpuBuffer?.size??0,indirectDrawBytes:(particles as any).thinInstances?._drawArgsBuffer?.size??0};
      const observedOwnedGpuBufferBytes=[...Object.values(particleGeometryGpuBytes),...Object.values(guideGeometryGpuBytes),ownedGpuBuffers.sampleStorageBytes,ownedGpuBuffers.instanceMatricesBytes,ownedGpuBuffers.indirectDrawBytes].reduce((a:any,b:any)=>a+b,0);
      return {owner:'acquired-study',renderer:'Babylon Lite 1.32.0 / WebGPU',semanticId:SEMANTIC_ID,mode:currentMode,progress:p,effectiveProgress:reduced?1:p,particleCount:count,particleCapacity:CAPACITY,preset,effect,reducedMotion:reduced,visible,selected,linked,sourceK,cutaway,sourceKBounds:[sourceKMin,sourceKMax],sourceSurfaceUnclipped:(currentMode!=='materialization'||reduced||p===1)&&(!linked||!cutaway||currentMode==='scientific'),pickPolicy:'Visible source fragments with identical source-k clip/reveal; acquired opaque plane occludes; particles and grid are not selectable. Pointer intent pauses cinematic playback.',ct:ct.snapshot(),
        authoritativeMeshVisible:semantic.visible!==false,particlesVisible:particles.visible!==false,guideVisible:guide.visible!==false,errors,renderDiagnostics:{drawCalls:engine.drawCallCount,particleBounds:{min:particles.boundMin,max:particles.boundMax},particleMaterial:particles.material?.name,guideMaterial:guide.material?.name,particleInstanceCount:(particles as any).thinInstances?.count,particleDrawArgs:(particles as any).thinInstances?._drawArgsData?Array.from((particles as any).thinInstances._drawArgsData):null,sceneMeshes:scene.meshes?.map((mesh:any)=>({name:mesh.name,visible:mesh.visible!==false,material:mesh.material?.name??'pbr'})),sceneRenderableCount:scene._renderables?.length},originalGeometryUnchanged:originalFingerprint===currentFingerprint,sourceGeometryFingerprint:originalFingerprint,currentGeometryFingerprint:currentFingerprint,
        sourceVertices:sampled.vertexCount,sourceTriangles:sampled.triangleCount,sourceWorldMatrices:currentParts.map(part=>Array.from(part.world)),bounds,frames,firstFrameMs,initializationMs,sampleInitMs,
        frameIntervals:quantiles(intervals),gpuTimestampSupported:gpuTimingSupported,gpuReportedEma:quantiles(gpuTimes),gpuTimestampScope:'Existing Lite frame markers; asynchronous EMA .8 previous + .2 raw; sampled EMA percentiles, not raw GPU latency',selectedAdapterInfo,adapterInfoSource:selectedAdapterInfo?'existing Lite GPUDevice.adapterInfo':'not exposed on existing Lite GPUDevice; no second adapter requested',
        representation:{particleStorageBytes:sampled.data.byteLength,instanceMatrixBytes:matrices.byteLength,particleMeshLogicalBytes:positions.byteLength*2+indices.byteLength,guideMeshLogicalBytes:linePositions.length*8+linePositions.length/3*4,activeParticleTriangles:count*12,capacityFixed:true,ownedGpuBuffers,observedOwnedGpuBufferBytes,observedAllocationScope:'Existing GPUBuffer.size for FX sample storage, matrix/indirect buffers and particle/guide geometry including unused UV buffers. Excludes uniforms, source mesh, engine, render targets, picker and timestamp resources.',totalGpuMemoryBytes:null,totalGpuMemoryReason:'WebGPU does not expose reliable total adapter/process memory; observed owned buffers are a partial allocation inventory only'},
        canvas:{cssWidth:rect.width,cssHeight:rect.height,width:canvas.width,height:canvas.height,devicePixelRatio:devicePixelRatio},camera:{alpha:camera.alpha,beta:camera.beta,radius:camera.radius,nearPlane:camera.nearPlane,farPlane:camera.farPlane,target:[camera.target.x,camera.target.y,camera.target.z]}};
    },
    dispose(){disposed=true;engine._device.removeEventListener('uncapturederror',gpuError);ct.dispose();disposeStorageBuffer(storage);},
  };
}
