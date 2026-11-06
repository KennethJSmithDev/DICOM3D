// On-demand qualification only; samples the real display texture and applies the
// real mesh world matrix to retained mesh positions on the same GPU device.
import {createComputeShader,computeStorageBufferBinding,computeTextureBinding,createStorageBuffer,createComputeBindingSet,createComputeDispatch,createComputeTask,prepareComputeTask,addComputeDispatch,submitComputeTasks,createComputeTextureResource,readStorageBuffer,disposeStorageBuffer,disposeComputeShader,disposeComputeBindingSet} from '@babylonjs/lite';
export async function checkPlaneGpu(engine:any,texture:any,positions:any,world:any) {
  const data=new Float32Array(32);data.set(world,0);for(let i=0;i<4;i++){data.set(positions.slice(i*3,i*3+3),16+i*4);data[19+i*4]=1;}
  const input=createStorageBuffer(engine,data),output=createStorageBuffer(engine,112,{writable:true});
  const shader=createComputeShader(engine,{name:'CTX-002-B diagnostic',computeSource:`
  @group(0) @binding(0) var<storage,read> src:array<vec4<f32>>;
  @group(0) @binding(1) var<storage,read_write> dst:array<vec4<f32>>;
  @group(0) @binding(2) var image:texture_2d<f32>;
  @compute @workgroup_size(1) fn main(){
    let m=mat4x4<f32>(src[0],src[1],src[2],src[3]);
    for(var i=0u;i<4u;i++){dst[i]=m*src[4u+i];}
    dst[4]=textureLoad(image,vec2<i32>(0,0),0);
    dst[5]=textureLoad(image,min(vec2<i32>(287,193),vec2<i32>(textureDimensions(image))-vec2<i32>(1)),0);
    dst[6]=textureLoad(image,vec2<i32>(textureDimensions(image))-vec2<i32>(1),0);
  }`,bindings:[computeStorageBufferBinding('src',{group:0,binding:0,access:'read'}),computeStorageBufferBinding('dst',{group:0,binding:1,access:'read-write'}),computeTextureBinding('image',{group:0,binding:2})]});
  let bindings:any,task:any;
  try{
    bindings=createComputeBindingSet(shader,{src:input,dst:output,image:await createComputeTextureResource(engine,texture)});
    task=createComputeTask(engine,'CTX-002-B one diagnostic');addComputeDispatch(task,createComputeDispatch(shader,bindings,{size:{x:1}}));await prepareComputeTask(task);task.record();submitComputeTasks([task]);
    return Array.from(new Float32Array(await readStorageBuffer(output)));
  }finally{task?.dispose();if(bindings)disposeComputeBindingSet(bindings);disposeComputeShader(shader);disposeStorageBuffer(input);disposeStorageBuffer(output);}
}
