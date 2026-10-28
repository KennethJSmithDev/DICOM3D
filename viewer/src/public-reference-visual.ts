import {addToScene,createMeshFromData,createShaderMaterial,createStorageBuffer,disposeMeshGpu,disposeStorageBuffer,enableThinInstanceDynamicDrawCount,getMeshTriangles,isGpuTimingSupported,onBeforeRender,onSceneDispose,removeFromScene,setGpuTimingEnabled,setShaderStorageBuffer,setShaderUniform,setThinInstanceCount,setThinInstances,updateStorageBuffer} from '@babylonjs/lite';
import {worldBounds} from './camera-fit.mjs';
import {samplePublicReference,referenceVisualRules} from './public-reference-samples.mjs';

const CAPACITY=8192,PALETTES:Record<string,number[]>={cyan:[.08,.75,1],ice:[.57,.86,1],amber:[1,.53,.13]};
// B04-05 display shaders only. World matrices, source positions and semantic owners stay unchanged.
const out=`struct VOut{@builtin(position) position:vec4<f32>,@location(0) worldPos:vec3<f32>,@location(1) normal:vec3<f32>};`;

const surfaceVertex=`${out}@vertex fn mainVertex(input:VertexInput)->VOut{var o:VOut;let w=shaderSystem.world*vec4<f32>(input.position,1);o.position=shaderSystem.worldViewProjection*vec4<f32>(input.position,1);o.worldPos=w.xyz;o.normal=normalize((shaderSystem.world*vec4<f32>(input.normal,0)).xyz);return o;}`;

const surfaceFragment=`${out}@fragment fn mainFragment(input:VOut)->@location(0) vec4<f32>{

 if(input.worldPos.y>shaderUniforms.clipY){discard;}let y=(input.worldPos.y-shaderUniforms.boundsY.x)/shaderUniforms.boundsY.y;

 if(shaderUniforms.reveal<1.0&&y>shaderUniforms.reveal){discard;}let rim=pow(1.0-abs(dot(normalize(input.normal),normalize(shaderSystem.cameraPosition-input.worldPos))),2.1);

 let band=(1.0-smoothstep(0.0,.012,abs(y-shaderUniforms.reveal)))*select(1.0,0.0,shaderUniforms.reveal>=1.0);

 let light=.22+.24*abs(dot(normalize(input.normal),normalize(vec3<f32>(.4,.8,-.5))))+rim*1.45+band*.7+shaderUniforms.selected*.2;

 return vec4<f32>(shaderUniforms.tint*light+vec3<f32>(rim*.1),(.22+.55*rim)*shaderUniforms.opacity);

}`;

const pout=`struct POut{@builtin(position) position:vec4<f32>,@location(0) light:f32};`;

const particleVertex=`${pout}@vertex fn mainVertex(input:VertexInput,@builtin(instance_index) id:u32)->POut{

 let surfaceSample=samples[id*2u];let start=samples[id*2u+1u];let group=groupState[u32(surfaceSample.w)];let p=shaderUniforms.progress;

 let size=shaderUniforms.size/24.0;let lattice=shaderUniforms.center+round((surfaceSample.xyz-shaderUniforms.center)/size)*size;

 let assembled=mix(mix(start.xyz,lattice,smoothstep(.12,.32,p)),surfaceSample.xyz,smoothstep(.3,.76,p));
 let silhouette=shaderUniforms.silhouette>.5;let pos=select(assembled,surfaceSample.xyz,silhouette);

 let y=(surfaceSample.y-shaderUniforms.boundsY.x)/shaderUniforms.boundsY.y;let emerged=smoothstep(start.w*.12,start.w*.12+.06,p);

 let layer=smoothstep(y*.7,y*.7+.1,p);let visible=group.x*select(1.0,0.0,surfaceSample.y>shaderUniforms.clipY);let lit=visible*select(emerged*select(1.0,layer,shaderUniforms.effect>.5),1.0,silhouette);

 var o:POut;o.position=shaderSystem.viewProjection*vec4<f32>(pos+input.position*shaderUniforms.radius*.0015*lit,1);o.light=lit*group.y*(.4+.6*start.w)*select(1.0-smoothstep(.8,1.0,p),.7,silhouette);return o;

}`;

const particleFragment=`${pout}@fragment fn mainFragment(input:POut)->@location(0) vec4<f32>{return vec4<f32>(shaderUniforms.tint*1.5,input.light);}`;

function quantiles(values:number[]){const a=values.slice().sort((x,y)=>x-y);return{samples:a.length,p50Ms:a.length?a[Math.floor(a.length*.5)]:null,p95Ms:a.length?a[Math.floor(a.length*.95)]:null,maxMs:a.at(-1)??null};}
function fingerprint(arrays:ArrayBufferView[]){let hash=2166136261;for(const a of arrays)for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength)){hash^=b;hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16).padStart(8,'0');}

/** Optional projection over the existing reference owner. Construct before registration;
 * activate immediately after registerScene. Never creates/starts an engine or moves a camera. */
export function createPublicReferenceVisual({engine,scene,camera,canvas,manifest,controller}:any){
 const began=performance.now(),ids:string[]=manifest.reference.structures.map((part:any)=>part.id),groups:Map<string,any[]>=controller.groups(),originals:Map<any,any>=controller.originals();
 if(new Set(ids).size!==ids.length||groups.size!==ids.length||ids.some(id=>!groups.get(id)?.length))throw Error('Reference visual semantic groups do not match admitted source');
 const sourceMeshes=ids.flatMap(id=>groups.get(id)!);if(new Set(sourceMeshes).size!==sourceMeshes.length)throw Error('Reference primitive has multiple semantic owners');
 const bounds:any=worldBounds(sourceMeshes);if(!bounds)throw Error('Reference source bounds unavailable');
 const descriptors=ids.map((id,group)=>({id,group,parts:groups.get(id)!.map(mesh=>({mesh,world:new Float32Array(mesh.worldMatrix),bounds:worldBounds([mesh]),geometry:()=>getMeshTriangles(mesh)!}))}));
 const meshOwners=new Map<any,{id:string,group:number}>(descriptors.flatMap(g=>g.parts.map(part=>[part.mesh,{id:g.id,group:g.group}] as [any,{id:string,group:number}])));
 const sourceAlpha=new Map<any,number>(sourceMeshes.map(mesh=>[mesh,originals.get(mesh)?.alpha??1]));
 const geometryRead=()=>{const started=performance.now(),parts=descriptors.flatMap(g=>g.parts.map((part,primitive)=>{const data=part.geometry();if(!data)throw Error('Source geometry is not retained');return{id:g.id,primitive,vertices:data.positions.length/3,triangles:data.indices.length/3,fingerprint:fingerprint([data.positions,data.indices,new Float32Array(part.mesh.worldMatrix)])};}));return{atMs:performance.now(),elapsedMs:performance.now()-started,parts,aggregateFingerprint:fingerprint([new TextEncoder().encode(parts.map(part=>part.id+':'+part.primitive+':'+part.fingerprint).join('|'))]),scope:'Explicit CPU retained source positions/indices and actual world matrices; not a continuous or GPU readback audit'};};
 const admitted=geometryRead();let audit:any={...admitted,unchanged:true};
 const sampleBegan=performance.now(),samples=samplePublicReference(descriptors,CAPACITY),sampleInitMs=performance.now()-sampleBegan;
 // Startup context uses the admitted skin surface, not invented anatomy. Interleave
 // skin samples with original semantic samples; keep original group visibility indices.
 const skinId=manifest.reference.structures.find((part:any)=>part.label==='Skin')?.id;
 const skin=descriptors.find(g=>g.id===skinId);let silhouetteSamples:Float32Array|null=null;
 if(skin){const skinSamples=samplePublicReference([{...skin,group:0}],CAPACITY/2).data;silhouetteSamples=samples.data.slice();
  for(let i=0;i<CAPACITY/2;i++){silhouetteSamples.set(skinSamples.subarray(i*8,i*8+8),i*16);silhouetteSamples[i*16+3]=skin.group;}}
 let currentMode='holographic',p=1,count=512,effect='layers',preset='cyan',reduced=false,active=false,disposed=false,startupSilhouette=false;
 let revealBounds=bounds,boundsY=[bounds.min[1],Math.max(1e-6,bounds.max[1]-bounds.min[1])],revealBoundsOwner='whole-body';
 let particles:any,sampleStorage:any,groupStorage:any,added=false,storageReleased=false;
 const groupData=new Float32Array(ids.length*4),materials=new Map<any,any>(),errors:{message:string,count:number}[]=[];
 const releaseStorage=()=>{if(storageReleased)return;storageReleased=true;if(sampleStorage)disposeStorageBuffer(sampleStorage);if(groupStorage)disposeStorageBuffer(groupStorage);};
 const gpuError=(event:any)=>{const message=String(event.error?.message??event.error),found=errors.find(e=>e.message===message);if(found)found.count++;else if(errors.length<20)errors.push({message,count:1});};
 try{
  for(const group of descriptors)for(const part of group.parts)materials.set(part.mesh,createShaderMaterial({name:`public-reference-holographic-${group.id}`,vertexSource:surfaceVertex,fragmentSource:surfaceFragment,attributes:['position','normal'],uniforms:['world','worldViewProjection','cameraPosition',{name:'boundsY',type:'vec2<f32>',defaultValue:boundsY},{name:'clipY',type:'f32',defaultValue:controller.state().clip},{name:'reveal',type:'f32',defaultValue:1},{name:'opacity',type:'f32',defaultValue:1},{name:'selected',type:'f32',defaultValue:0},{name:'tint',type:'vec3<f32>',defaultValue:PALETTES.cyan}],needAlphaBlending:true,backFaceCulling:false,depthWrite:false}));
  const cube=new Float32Array([-1,-1,-1,1,-1,-1,1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,1,1,-1,1,1]),indices=new Uint32Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
  particles=createMeshFromData(engine,'public-reference-presentation-samples',cube,cube.slice(),indices);sampleStorage=createStorageBuffer(engine,samples.data,'public-reference-fixed-source-samples');groupStorage=createStorageBuffer(engine,groupData,'public-reference-group-visibility');
  const particleMaterial=createShaderMaterial({name:'public-reference-bounded-assembly',vertexSource:particleVertex,fragmentSource:particleFragment,attributes:['position'],uniforms:['viewProjection',{name:'boundsY',type:'vec2<f32>',defaultValue:boundsY},{name:'clipY',type:'f32',defaultValue:controller.state().clip},{name:'center',type:'vec3<f32>',defaultValue:bounds.center},{name:'size',type:'vec3<f32>',defaultValue:bounds.max.map((v:number,k:number)=>Math.max(1e-6,v-bounds.min[k]))},{name:'radius',type:'f32',defaultValue:bounds.radius},{name:'progress',type:'f32',defaultValue:1},{name:'silhouette',type:'f32',defaultValue:0},{name:'effect',type:'f32',defaultValue:1},{name:'tint',type:'vec3<f32>',defaultValue:PALETTES.cyan}],storageBuffers:[{name:'samples',type:'array<vec4<f32>>'},{name:'groupState',type:'array<vec4<f32>>'}],needAlphaBlending:true,blendMode:'additive',backFaceCulling:false,depthWrite:false});
  setShaderStorageBuffer(particleMaterial,'samples',sampleStorage);setShaderStorageBuffer(particleMaterial,'groupState',groupStorage);particles.material=particleMaterial;
  const matrices=new Float32Array(CAPACITY*16);for(let i=0;i<CAPACITY;i++)for(const k of [0,5,10,15])matrices[i*16+k]=1;setThinInstances(particles,matrices,CAPACITY);enableThinInstanceDynamicDrawCount(particles);particles.boundMin=bounds.min.map((v:number)=>v-bounds.radius*.01);particles.boundMax=bounds.max.map((v:number)=>v+bounds.radius*.01);particles.visible=false;addToScene(scene,particles);added=true;setThinInstanceCount(particles,count);
  const requested=(id:string,s:any)=>!s.hidden.has(id)&&(!s.isolate||s.selected===id);
  function sync(){
   if(!active||disposed)return;const s=controller.state(),rules=referenceVisualRules(currentMode,p,effect,reduced),eligible=sourceMeshes.filter(mesh=>requested(meshOwners.get(mesh)!.id,s)),next=worldBounds(eligible);
   if(next){revealBounds=next;boundsY=[next.min[1],Math.max(1e-6,next.max[1]-next.min[1])];revealBoundsOwner=s.isolate&&s.selected?'isolated:'+s.selected:s.hidden.size?'visible-source-groups':'whole-body';}
   for(const [mesh,owner] of meshOwners){const h=materials.get(mesh);mesh.visible=requested(owner.id,s)&&rules.sourceVisible;
    setShaderUniform(h,'boundsY',boundsY);setShaderUniform(h,'clipY',s.clip);setShaderUniform(h,'reveal',rules.reveal);setShaderUniform(h,'opacity',rules.opacity*(sourceAlpha.get(mesh)??1)*(s.opacity.get(owner.id)??1)*(s.context&&s.selected&&s.selected!==owner.id&&!s.isolate ? .28 : 1));setShaderUniform(h,'selected',s.selected===owner.id?1:0);setShaderUniform(h,'tint',PALETTES[preset]);if(currentMode!=='scientific')mesh.material=h;
   }
   particles.visible=(rules.particlesVisible||startupSilhouette)&&eligible.length>0;setShaderUniform(particleMaterial,'silhouette',startupSilhouette?1:0);setShaderUniform(particleMaterial,'boundsY',boundsY);setShaderUniform(particleMaterial,'progress',rules.effective);setShaderUniform(particleMaterial,'effect',effect==='layers'?1:0);setShaderUniform(particleMaterial,'clipY',s.clip);setShaderUniform(particleMaterial,'tint',PALETTES[preset]);
  }
  const projection=()=>{if(!active||disposed)return;const s=controller.state();for(let i=0;i<ids.length;i++){groupData[i*4]=requested(ids[i],s)?1:0;groupData[i*4+1]=s.opacity.get(ids[i])??1;}updateStorageBuffer(engine,groupStorage,groupData);sync();};
  // Storage lives until scene teardown so an already-submitted frame cannot lose its SSBO.
  // Caller stops the engine, disposes this adapter, then controller/scene/engine in that order.
  onSceneDispose(scene,releaseStorage);engine._device.addEventListener('uncapturederror',gpuError);
  let frames=0,lastFrame=0;const intervals:number[]=[],gpuTimes:number[]=[],gpuTimingSupported=isGpuTimingSupported(engine);if(gpuTimingSupported)setGpuTimingEnabled(engine,true);
  onBeforeRender(scene,()=>{if(disposed)return;frames++;const now=performance.now();if(lastFrame){intervals.push(now-lastFrame);if(intervals.length>600)intervals.shift();}lastFrame=now;if(gpuTimingSupported&&engine.gpuFrameTimeMs>0){gpuTimes.push(engine.gpuFrameTimeMs);if(gpuTimes.length>600)gpuTimes.shift();}});
  const discard={key:'public-reference-clip-and-layer-v1',wgsl:`fn shouldDiscardPick(input:PickDiscardInput)->bool{let r=rules[0];return input.worldPos.y>r.x||(r.y<1.0&&(input.worldPos.y-r.z)/r.w>r.y);}`,storage:[{name:'rules',type:'array<vec4<f32>>',data:()=>new Float32Array([controller.state().clip,referenceVisualRules(currentMode,p,effect,reduced).reveal,...boundsY])}]};
  const bufferKeys=['positionBuffer','normalBuffer','uvBuffer','uv2Buffer','tangentBuffer','colorBuffer','indexBuffer'];
  const bufferSizes=(mesh:any)=>Object.fromEntries(bufferKeys.map(key=>[key,mesh._gpu?.[key]?.size??0]));
  const uniqueSourceBufferBytes=()=>[...new Set(sourceMeshes.flatMap(mesh=>bufferKeys.map(key=>mesh._gpu?.[key]).filter(Boolean)))].reduce((sum:number,buffer:any)=>sum+buffer.size,0);
  const pickAllowed=(mesh:any)=>!disposed&&active&&controller.canPick(mesh)&&referenceVisualRules(currentMode,p,effect,reduced).sourceVisible;
  const initializationMs=performance.now()-began;
  return {
   // Source custom-material swaps must occur after Lite has registered the scene.
   activate(){if(disposed)throw Error('Reference visual disposed');if(active)return;active=true;controller.setProjection(projection);},
   mode(value:string){referenceVisualRules(value,p,effect,reduced);currentMode=value;controller.invalidatePick();if(value==='scientific')controller.setAppearance('source');else controller.refresh();},
   progress(value:number){if(!Number.isFinite(value))throw Error('Invalid animation progress');p=Math.max(0,Math.min(1,value));sync();},
   density(value:number){if(![512,2048,8192].includes(value))throw Error('Unsupported particle budget');count=value;setThinInstanceCount(particles,count);},
   effect(value:string){referenceVisualRules(currentMode,p,value,reduced);effect=value;controller.invalidatePick();sync();},
   preset(value:string){if(!PALETTES[value])throw Error('Unknown visual preset');preset=value;sync();},
   reducedMotion(value:boolean){reduced=Boolean(value);sync();},
   // Startup-only display projection: reuse sampled source buffers, never change source geometry.
   silhouette(value:boolean){startupSilhouette=Boolean(value);updateStorageBuffer(engine,sampleStorage,startupSilhouette&&silhouetteSamples?silhouetteSamples:samples.data);sync();},
   pickAllowed,pickDiscard:()=>discard,
   resetMetrics(){intervals.length=gpuTimes.length=0;lastFrame=0;},
   auditGeometry(){audit=geometryRead();audit.unchanged=audit.aggregateFingerprint===admitted.aggregateFingerprint;return audit;},
   snapshot(){const s=controller.state(),rules=referenceVisualRules(currentMode,p,effect,reduced),particleBuffers=bufferSizes(particles);return{owner:'existing-reference-controller',referenceId:manifest.reference.id,sourceSha256:manifest.asset.sha256,mode:currentMode,startupSilhouette,progress:p,effectiveProgress:rules.effective,effect,preset,reducedMotion:reduced,active,disposed,particleCount:count,particleCapacity:CAPACITY,particlesVisible:particles.visible,sourceGroupCount:ids.length,sourcePrimitiveCount:sourceMeshes.length,sourceVertices:admitted.parts.reduce((n,part)=>n+part.vertices,0),sourceTriangles:admitted.parts.reduce((n,part)=>n+part.triangles,0),sourceGeometryFingerprint:admitted.aggregateFingerprint,geometryAudit:audit,sourceSurfaceUnclipped:rules.reveal>=1&&rules.sourceVisible&&s.clip>=bounds.max[1],revealBoundsOwner,revealBounds,clipY:s.clip,selection:s.selected,frames,initializationMs,sampleInitMs,frameIntervals:quantiles(intervals),gpuReportedEma:quantiles(gpuTimes),gpuTimestampSupported:gpuTimingSupported,gpuTimingScope:'Existing engine frame markers; asynchronous EMA .8 previous + .2 raw; sampled EMA percentiles, not raw GPU latency',selectedAdapterInfo:engine._device.adapterInfo?{vendor:engine._device.adapterInfo.vendor,architecture:engine._device.adapterInfo.architecture}:null,canvas:{width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight},camera:{alpha:camera.alpha,beta:camera.beta,radius:camera.radius,target:[camera.target.x,camera.target.y,camera.target.z]},parts:descriptors.map(g=>({id:g.id,primitiveCount:g.parts.length,requestedVisible:requested(g.id,s),visiblePrimitives:g.parts.filter(part=>part.mesh.visible).length,worldMatrices:g.parts.map(part=>Array.from(part.mesh.worldMatrix)),bounds:worldBounds(g.parts.map(part=>part.mesh))})),representation:{startupSampling:'alternating admitted skin and original semantic samples; original storage restored on exit',samplingMethod:samples.method,capacityCounts:Array.from(samples.counts),activeBudgetCounts:ids.map((_,i)=>Math.floor((count-1-i)/ids.length)+1),sampleStorageBytes:sampleStorage._buffer.size,groupStateBytes:groupStorage._buffer.size,instanceMatrixBytes:particles.thinInstances?._gpuBuffer?.size??0,particleGeometryBuffers:particleBuffers,indirectDrawBytes:particles.thinInstances?._drawArgsBuffer?.size??0,sourceGeometryGpuBytes:uniqueSourceBufferBytes(),sampleOutputBytes:samples.outputBytes,maxTemporaryCopyBytes:samples.maxTemporaryCopyBytes,totalCopiedBytes:samples.totalCopiedBytes,logicalSourceGeometryBytes:manifest.cost.geometry_buffer_bytes,totalGpuMemoryBytes:null,allocationScope:'Partial observed retained GPUBuffer.size (source buffers deduplicated by identity); excludes uniforms, targets, picker, driver, original source CPU arrays and deferred garbage collection'},errors:[...errors]};},
   dispose(){if(disposed)return;disposed=true;active=false;particles.visible=false;controller.setProjection(null);controller.invalidatePick();engine._device.removeEventListener('uncapturederror',gpuError);removeFromScene(scene,particles);}
  };
 }catch(error){engine._device.removeEventListener('uncapturederror',gpuError);if(particles){if(added)removeFromScene(scene,particles);else disposeMeshGpu(particles);}releaseStorage();throw error;}
}
