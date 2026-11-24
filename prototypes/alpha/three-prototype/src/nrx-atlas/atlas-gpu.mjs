import {tissueScale,tissueTextureBytes,uploadTissueMap} from './organ-materials.mjs';

const vertexBytes=24, objectFloats=40, frameFloats=20;
const linearTarget='rgba16float', depthTarget='depth24plus';
const atlasSamples=4;
const transparentBlend={
 color:{operation:'add',srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha'},
 alpha:{operation:'add',srcFactor:'one',dstFactor:'one-minus-src-alpha'},
};

const geometryShader=`
struct Frame {
 viewProjection:mat4x4<f32>,
 eye:vec4<f32>,
}
struct Object {
 model:mat4x4<f32>,
 normalX:vec4<f32>,
 normalY:vec4<f32>,
 normalZ:vec4<f32>,
 color:vec4<f32>,
 material:vec4<f32>,
 emissive:vec4<f32>,
}
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read> objects:array<Object>;
@group(0) @binding(2) var tissueMap:texture_2d_array<f32>;
@group(0) @binding(3) var tissueSampler:sampler;
struct Raster {
 @builtin(position) clip:vec4<f32>,
 @location(0) world:vec3<f32>,
 @location(1) normal:vec3<f32>,
 @location(2) tint:vec4<f32>,
 @location(3) @interpolate(flat) objectIndex:u32,
 @location(4) localPosition:vec3<f32>,
 @location(5) localNormal:vec3<f32>,
}
@vertex fn vs(@location(0) position:vec3<f32>,@location(1) normal:vec4<f32>,
 @location(2) tint:vec4<f32>,@builtin(instance_index) index:u32)->Raster{
 let object=objects[index];
 let world=object.model*vec4<f32>(position,1);
 let normalMatrix=mat3x3<f32>(object.normalX.xyz,object.normalY.xyz,object.normalZ.xyz);
 return Raster(frame.viewProjection*world,world.xyz,normalMatrix*normal.xyz,tint,index,position,normal.xyz);
}

fn tissueMaterial(p:vec3<f32>,dx:vec3<f32>,dy:vec3<f32>,normal:vec3<f32>,layer:i32)->vec4<f32>{
 let axes=max(abs(normal),vec3<f32>(.0001));
 let weighted=axes*axes*axes*axes;
 let weights=weighted/dot(weighted,vec3<f32>(1));
 return weights.x*textureSampleGrad(tissueMap,tissueSampler,p.yz,layer,dx.yz,dy.yz)+
        weights.y*textureSampleGrad(tissueMap,tissueSampler,p.zx,layer,dx.zx,dy.zx)+
        weights.z*textureSampleGrad(tissueMap,tissueSampler,p.xy,layer,dx.xy,dy.xy);
}

// The workbench uses white ambient, key and fill lights. Evaluate its standard
// diffuse and GGX response in linear light before compositing source opacity.
fn direct(light:vec3<f32>,intensity:f32,n:vec3<f32>,v:vec3<f32>,
 diffuse:vec3<f32>,f0:vec3<f32>,roughness:f32)->vec3<f32>{
 let nl=max(dot(n,light),0);
 let nv=max(dot(n,v),0);
 if(nl<=0){return vec3<f32>(0);}
 let halfRay=normalize(light+v);
 let nh=max(dot(n,halfRay),0);
 let vh=clamp(dot(v,halfRay),0,1);
 let alpha2=pow(roughness,4);
 let term=nh*nh*(alpha2-1)+1;
 let distribution=alpha2/(3.14159265*max(term*term,1e-7));
 let visibility=.5/max(nl*sqrt(nv*nv*(1-alpha2)+alpha2)+
                        nv*sqrt(nl*nl*(1-alpha2)+alpha2),1e-6);
 let fresnel=mix(f0,vec3<f32>(1),exp2((-5.55473*vh-6.98316)*vh));
 return (diffuse+fresnel*visibility*distribution)*(intensity*nl);
}
@fragment fn fs(input:Raster,@builtin(front_facing) front:bool)->@location(0) vec4<f32>{
 let object=objects[input.objectIndex];
 let tissueDx=dpdx(input.localPosition);
 let tissueDy=dpdy(input.localPosition);
 let vertexTint=select(vec4<f32>(1),input.tint,object.material.w>.5);
 var base=object.color.rgb*vertexTint.rgb;
 var opacity=object.color.a*vertexTint.a;
 if(object.emissive.w>0 && opacity<=object.emissive.w){discard;}
 // Like the source opaque materials, vary COLOR_0 alpha only when blending.
 if(object.normalX.w<.5){opacity=1;}else if(opacity<=0){discard;}
 if(object.material.z>.5){return vec4<f32>(base,opacity);}
 let n=normalize(select(-input.normal,input.normal,front));
 let v=normalize(frame.eye.xyz-input.world);
 var roughness=max(object.material.x,.0525);
 let tissueScale=object.normalZ.w;
 if(tissueScale>0){
  let layer=i32(object.normalY.w)-1;
  let tissue=tissueMaterial(input.localPosition*tissueScale,tissueDx*tissueScale,tissueDy*tissueScale,input.localNormal,layer);
  base*=tissue.rgb*1.33;
  roughness=tissue.a;
 }
 let metal=object.material.y;
 let diffuse=base*(1-metal)/3.14159265;
 let f0=mix(vec3<f32>(.04),base,metal);
 let lit=diffuse*1.1+direct(normalize(vec3<f32>(3,5,4)),2.2,n,v,diffuse,f0,roughness)+
         direct(normalize(vec3<f32>(-4,2,-3)),.9,n,v,diffuse,f0,roughness)+object.emissive.rgb;
 return vec4<f32>(lit,opacity);
}
`;

const presentationShader=`
@group(0) @binding(0) var scene:texture_2d<f32>;
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{
 let points=array<vec2<f32>,3>(vec2<f32>(-1,1),vec2<f32>(-1,-3),vec2<f32>(3,1));
 return vec4<f32>(points[i],0,1);
}
@fragment fn fs(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{
 let source=textureLoad(scene,vec2<i32>(p.xy),0);
 if(source.a<=0){return vec4<f32>(0);}
 // ACES filmic and sRGB output use the same convention as the Three viewer.
 let toAces=mat3x3<f32>(vec3<f32>(.59719,.07600,.02840),vec3<f32>(.35458,.90834,.13383),
                        vec3<f32>(.04823,.01566,.83777));
 let fromAces=mat3x3<f32>(vec3<f32>(1.60475,-.10208,-.00327),vec3<f32>(-.53108,1.10813,-.07276),
                          vec3<f32>(-.07367,-.00605,1.07602));
 let v=toAces*(source.rgb/(.6*source.a));
 let fitted=(v*(v+.0245786)-.000090537)/(v*(.983729*v+.4329510*.983729)+.238081);
 let mapped=clamp(fromAces*fitted,vec3<f32>(0),vec3<f32>(1));
 let encoded=select(1.055*pow(mapped,vec3<f32>(.41666))-.055,12.92*mapped,mapped<=vec3<f32>(.0031308));
 return vec4<f32>(encoded*source.a,source.a);
}
`;

function buildNormals(positions,indices) {
 const normals=new Float32Array(positions.length);
 const count=indices?.length??positions.length/3;
 for(let i=0;i+2<count;i+=3){
  const a=3*(indices?.[i]??i),b=3*(indices?.[i+1]??i+1),c=3*(indices?.[i+2]??i+2);
  const x=positions[b]-positions[a],y=positions[b+1]-positions[a+1],z=positions[b+2]-positions[a+2];
  const u=positions[c]-positions[a],v=positions[c+1]-positions[a+1],w=positions[c+2]-positions[a+2];
  const nx=y*w-z*v,ny=z*u-x*w,nz=x*v-y*u;
  for(const base of [a,b,c]){
   normals[base]+=nx;normals[base+1]+=ny;normals[base+2]+=nz;
  }
 }
 return normals;
}

function uploadGeometry(device,geometry,topology) {
 const {positions,colors,colorSize=3}=geometry;
 if(!positions?.length||positions.length%3)throw Error('NRX atlas geometry has invalid positions.');
 const count=positions.length/3;
 let {indices,normals}=geometry;
 if(indices&&!(indices instanceof Uint16Array||indices instanceof Uint32Array)){
  indices=count<=65536?Uint16Array.from(indices):Uint32Array.from(indices);
 }
 if(!normals&&topology!=='line-list')normals=buildNormals(positions,indices);
 if(normals&&normals.length!==positions.length)throw Error('NRX atlas normal count differs from the positions.');
 if(colors&&((colorSize!==3&&colorSize!==4)||colors.length!==count*colorSize)){
  throw Error('NRX atlas color count differs from the positions.');
 }
 const bytes=new ArrayBuffer(count*vertexBytes);
 const floats=new Float32Array(bytes), shorts=new Int16Array(bytes), colorBytes=new Uint8Array(bytes);
 for(let i=0;i<count;i++){
  const source=i*3, base=i*vertexBytes;
  const length=normals&&Math.hypot(normals[source],normals[source+1],normals[source+2]);
  for(let j=0;j<3;j++){
   floats[base/4+j]=positions[source+j];
   shorts[(base+12)/2+j]=Math.round(32767*(length?normals[source+j]/length:Number(j===2)));
  }
  for(let j=0;j<4;j++){
   colorBytes[base+20+j]=colors&&j<colorSize?Math.round(255*Math.min(1,Math.max(0,colors[i*colorSize+j]))):255;
  }
 }
 let vertices, index;
 try {
  vertices=device.createBuffer({size:bytes.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(vertices,0,bytes);
  const indexBytes=indices?Math.ceil(indices.byteLength/4)*4:0;
  if(indices){
   index=device.createBuffer({size:indexBytes,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST,mappedAtCreation:true});
   const mapped=new Uint8Array(index.getMappedRange());
   mapped.set(new Uint8Array(indices.buffer,indices.byteOffset,indices.byteLength));
   index.unmap();
  }
  return {vertices,index,format:indices instanceof Uint32Array?'uint32':'uint16',
   count:indices?.length??count,bytes:bytes.byteLength+indexBytes};
 }catch(error){
  vertices?.destroy();index?.destroy();
  throw error;
 }
}

function objectRecord(target,offset,item) {
 const m=item.modelMatrix;
 if(m?.length!==16)throw Error('NRX atlas object model matrix is invalid.');
 const xx=m[5]*m[10]-m[6]*m[9],xy=m[6]*m[8]-m[4]*m[10],xz=m[4]*m[9]-m[5]*m[8];
 const yx=m[9]*m[2]-m[10]*m[1],yy=m[10]*m[0]-m[8]*m[2],yz=m[8]*m[1]-m[9]*m[0];
 const zx=m[1]*m[6]-m[2]*m[5],zy=m[2]*m[4]-m[0]*m[6],zz=m[0]*m[5]-m[1]*m[4];
 const determinant=m[0]*xx+m[1]*xy+m[2]*xz;
 const sign=determinant<0?-1:1;
 target.set(m,offset);
 // Normalization in the fragment stage removes the determinant magnitude.
 const blended=item.transparent??(item.opacity<1);
 const tissueProfile=item.illustrativeTissue||0;
 target.set([xx*sign,xy*sign,xz*sign,Number(blended),yx*sign,yy*sign,yz*sign,tissueProfile,
  zx*sign,zy*sign,zz*sign,tissueScale(tissueProfile)],offset+16);
 target.set([...(item.color??[1,1,1]),Math.min(1,item.opacity??1)],offset+28);
 target.set([item.roughness??1,item.metalness??0,Number(item.unlit||item.topology==='line-list'),
  Number(item.vertexColors??Boolean(item.geometry.colors))],offset+32);
 target.set([...(item.emissive??[0,0,0]),item.alphaTest??0],offset+36);
 return sign<0;
}

function depthOf(item,matrix) {
 const m=item.modelMatrix;
 const [x,y,z]=item.center??[m[12],m[13],m[14]];
 return (matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14])/
        (matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15]);
}

async function checkedShader(device,code) {
 const module=device.createShaderModule({code});
 const result=await module.getCompilationInfo();
 const errors=result.messages.filter(message=>message.type==='error');
 if(errors.length)throw Error('NRX atlas shader failed: '+errors.map(message=>message.message).join('; '));
 return module;
}

export async function createAtlasGpu(canvas,{signal,onLost}={}) {
 if(!globalThis.navigator?.gpu)throw Error('NRX atlas requires WebGPU.');
 signal?.throwIfAborted();
 const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
 signal?.throwIfAborted();
 if(!adapter)throw Error('NRX atlas found no WebGPU adapter.');
 const device=await adapter.requestDevice();
 let context,frameBuffer,objectBuffer,target,multisampledColor,depth,tissueMap;
 let disposed=false,failure=null,resolveLost;
 const lost=new Promise(resolve=>{resolveLost=resolve;});
 const cache=new Map(), pipelines=new Map();
 const report={residentGeometries:0,residentBytes:0,materialTextureBytes:0,submissions:0,draws:0,width:0,height:0,samples:atlasSamples};
 const fail=reason=>{
  if(disposed||failure)return;
  failure=reason instanceof Error?reason:Error(String(reason));
  resolveLost(failure);
  onLost?.(failure);
 };
 const onError=event=>fail(event.error?.message??'Uncaptured NRX atlas GPU error.');
 device.addEventListener('uncapturederror',onError);
 device.lost.then(info=>{if(info.reason!=='destroyed')fail(info.message||'NRX atlas GPU device lost.');});
 function releaseGeometry(resource){
  resource.vertices.destroy();
  resource.index?.destroy();
  report.residentBytes-=resource.bytes;
 }
 function dispose(){
  if(disposed)return;
  disposed=true;
  device.removeEventListener('uncapturederror',onError);
  context?.unconfigure();
  target?.destroy();multisampledColor?.destroy();depth?.destroy();
  tissueMap?.destroy();
  frameBuffer?.destroy();objectBuffer?.destroy();
  for(const resource of cache.values())releaseGeometry(resource);
  cache.clear();
  pipelines.clear();
  report.residentGeometries=0;
  report.materialTextureBytes=0;
  device.destroy();
 }
 try {
  signal?.throwIfAborted();
  context=canvas.getContext('webgpu');
  if(!context)throw Error('NRX atlas could not acquire a WebGPU canvas.');
  const format=navigator.gpu.getPreferredCanvasFormat();
  context.configure({device,format,alphaMode:'premultiplied'});
  const [shader,present]=await Promise.all([checkedShader(device,geometryShader),checkedShader(device,presentationShader)]);
  signal?.throwIfAborted();
  const layout=device.createBindGroupLayout({entries:[
   {binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},
   {binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage'}},
   {binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float',viewDimension:'2d-array'}},
   {binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},
  ]});
  const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
  const postLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,
   texture:{sampleType:'unfilterable-float'}}]});
  const postPipeline=await device.createRenderPipelineAsync({
   layout:device.createPipelineLayout({bindGroupLayouts:[postLayout]}),
   vertex:{module:present,entryPoint:'vs'},fragment:{module:present,entryPoint:'fs',targets:[{format}]},
  });
  signal?.throwIfAborted();
  frameBuffer=device.createBuffer({size:frameFloats*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM});
  // The plain path never samples the array. Keep the binding shape without
  // preparing any material layers until a mapped draw actually needs them.
  tissueMap=device.createTexture({label:'NRX atlas material placeholder',size:[1,1],format:'rgba8unorm',
   usage:GPUTextureUsage.TEXTURE_BINDING});
  let tissueView=tissueMap.createView({dimension:'2d-array'});
  report.materialTextureBytes=4;
  const tissueSampler=device.createSampler({addressModeU:'repeat',addressModeV:'repeat',
   minFilter:'linear',magFilter:'linear',mipmapFilter:'linear'});
  let frameScratch=new Float32Array(frameFloats), objectScratch=new Float32Array(0);
  let bindGroup,postBind,resolveView,colorView,depthView,needRebind=true;

  function resources(width,height,draws,usesTissue) {
   if(usesTissue&&report.materialTextureBytes!==tissueTextureBytes){
    const previous=tissueMap;
    tissueMap=uploadTissueMap(device);
    previous.destroy();
    tissueView=tissueMap.createView();
    report.materialTextureBytes=tissueTextureBytes;
    needRebind=true;
   }
   if(width!==report.width||height!==report.height){
    target?.destroy();multisampledColor?.destroy();depth?.destroy();
    canvas.width=width;canvas.height=height;
    const size=[width,height];
    target=device.createTexture({size,format:linearTarget,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
    multisampledColor=device.createTexture({size,format:linearTarget,sampleCount:atlasSamples,usage:GPUTextureUsage.RENDER_ATTACHMENT});
    depth=device.createTexture({size,format:depthTarget,sampleCount:atlasSamples,usage:GPUTextureUsage.RENDER_ATTACHMENT});
    resolveView=target.createView();
    colorView=multisampledColor.createView();
    depthView=depth.createView();
    postBind=device.createBindGroup({layout:postLayout,entries:[{binding:0,resource:resolveView}]});
    report.width=width;report.height=height;
   }
   const length=Math.max(1,draws)*objectFloats;
   if(objectScratch.length<length){
    objectBuffer?.destroy();
    objectScratch=new Float32Array(Math.max(length,objectScratch.length*2));
    objectBuffer=device.createBuffer({size:objectScratch.byteLength,
     usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.STORAGE});
    needRebind=true;
   }
   if(needRebind){
    bindGroup=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:frameBuffer}},
     {binding:1,resource:{buffer:objectBuffer}},{binding:2,resource:tissueView},{binding:3,resource:tissueSampler}]});
    needRebind=false;
   }
  }

  function getPipeline(item, mirrored, side=item.side) {
   const topology=item.topology==='line-list'?'line-list':'triangle-list';
   const frontFace=mirrored?'cw':'ccw';
   const cullMode=topology==='line-list'||side==='double'?'none':side==='back'?'front':'back';
   const blended=item.transparent??(item.opacity<1);
   const depthWriteEnabled=item.depthWrite??!blended;
   const depthCompare=item.depthTest===false?'always':'less-equal';
   const key=[topology,frontFace,cullMode,blended,depthWriteEnabled,depthCompare].join('/');
   if(!pipelines.has(key)){
    const color={format:linearTarget};
    if(blended)color.blend=transparentBlend;
    pipelines.set(key,device.createRenderPipeline({
     label:'NRX atlas '+key,layout:pipelineLayout,
     vertex:{module:shader,entryPoint:'vs',buffers:[{arrayStride:vertexBytes,attributes:[
      {shaderLocation:0,offset:0,format:'float32x3'},
      {shaderLocation:1,offset:12,format:'snorm16x4'},
      {shaderLocation:2,offset:20,format:'unorm8x4'},
     ]}]},
     fragment:{module:shader,entryPoint:'fs',targets:[color]},
     multisample:{count:atlasSamples},
     primitive:{topology,frontFace,cullMode},depthStencil:{format:depthTarget,depthWriteEnabled,depthCompare},
    }));
   }
   return pipelines.get(key);
  }

  function render({viewProjection,cameraPosition,width=canvas.width,height=canvas.height,draws,
   background=[0,0,0,0],residentGeometries}) {
   if(disposed||failure)throw failure??Error('NRX atlas renderer is disposed.');
   if(!width||!height)return false;
   if(width>device.limits.maxTextureDimension2D||height>device.limits.maxTextureDimension2D){
    throw Error('NRX atlas viewport exceeds the WebGPU device limit.');
   }
   if(viewProjection?.length!==16||cameraPosition?.length!==3)throw Error('NRX atlas camera is invalid.');
   if(residentGeometries){
    for(const [key,value] of cache){
     if(!residentGeometries.has(key)){releaseGeometry(value);cache.delete(key);}
    }
   }
   const opaque=[], translucent=[];
   let usesTissue=false;
   for(const item of draws){
    if(item.visible===false||item.opacity<=0)continue;
    usesTissue||=item.illustrativeTissue>0;
    if(item.transparent??(item.opacity<1))translucent.push({item,depth:depthOf(item,viewProjection)});
    else opaque.push(item);
   }
   const compareOrder=(a,b)=>(a.renderOrder??0)-(b.renderOrder??0);
   opaque.sort(compareOrder);
   translucent.sort((a,b)=>compareOrder(a.item,b.item)||b.depth-a.depth);
   const list=opaque.concat(translucent.map(value=>value.item));
   resources(width,height,list.length,usesTissue);
   frameScratch.set(viewProjection,0);frameScratch.set(cameraPosition,16);
   device.queue.writeBuffer(frameBuffer,0,frameScratch);
   const commands=[];
   for(const [i,item] of list.entries()){
    const geometry=item.geometry;
    let resource=cache.get(geometry);
    if(!resource){
     resource=uploadGeometry(device,geometry,item.topology);
     cache.set(geometry,resource);
     report.residentBytes+=resource.bytes;
    }
    const mirroring=objectRecord(objectScratch,i*objectFloats,item);
    const draw={resource,first:item.start??0,count:item.count??resource.count-(item.start??0),instance:i};
    // Transparent double-sided anatomy uses the same back-then-front draw
    // order as Three. Reuse one per-object record across both commands.
    if((item.transparent??item.opacity<1)&&item.side==='double'&&item.forceSinglePass!==true){
     commands.push({...draw,pipeline:getPipeline(item,mirroring,'back')},
      {...draw,pipeline:getPipeline(item,mirroring,'front')});
    }else{
     commands.push({...draw,pipeline:getPipeline(item,mirroring)});
    }
   }
   if(list.length)device.queue.writeBuffer(objectBuffer,0,objectScratch,0,list.length*objectFloats);
   report.residentGeometries=cache.size;
   const [r,g,b,a=1]=background;
   const encoder=device.createCommandEncoder();
   // Resolve premultiplied linear coverage before tone mapping and presentation.
   const pass=encoder.beginRenderPass({colorAttachments:[{view:colorView,resolveTarget:resolveView,loadOp:'clear',storeOp:'discard',
    clearValue:{r:r*a,g:g*a,b:b*a,a}}],depthStencilAttachment:{view:depthView,
    depthLoadOp:'clear',depthStoreOp:'discard',depthClearValue:1}});
   let activePipeline,activeResource;
   pass.setBindGroup(0,bindGroup);
   commands.forEach(({resource,pipeline,first,count,instance})=>{
    if(pipeline!==activePipeline){pass.setPipeline(pipeline);activePipeline=pipeline;}
    if(resource!==activeResource){
     pass.setVertexBuffer(0,resource.vertices);
     if(resource.index)pass.setIndexBuffer(resource.index,resource.format);
     activeResource=resource;
    }
    if(resource.index)pass.drawIndexed(count,1,first,0,instance);
    else pass.draw(count,1,first,instance);
   });
   pass.end();
   const output=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),
    loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:0}}]});
   output.setPipeline(postPipeline);
   output.setBindGroup(0,postBind);
   output.draw(3);
   output.end();
   device.queue.submit([encoder.finish()]);
   report.submissions++;
   report.draws=commands.length;
   return true;
  }
  return {render,dispose,lost,stats:()=>({...report})};
 }catch(error){
  dispose();
  throw error;
 }
}
