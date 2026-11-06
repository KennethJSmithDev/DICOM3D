import {accumulationWGSL} from './ct-accumulation.mjs';
import * as B from '@babylonjs/lite';
import {volumeSamplerWGSL,volumeUniformWGSL} from './ct-volume-core.mjs';
/** Bounded on-demand reuse of the accepted sampler, on the actual active 3D texture. */
export async function probeVolume(engine:any,texture:any,uniform:Float32Array,points:number[][]){
 if(points.length<1||points.length>128)throw Error('Probe is bounded to 1–128 source points');
 const count=points.length,inputData=new Float32Array(count*4);
 points.forEach((p,i)=>inputData.set([p[2],p[1],p[0],1],i*4));
 const input=B.createStorageBuffer(engine,inputData),matrices=B.createStorageBuffer(engine,uniform),output=B.createStorageBuffer(engine,count*16,{writable:true}),coverage=B.createStorageBuffer(engine,count*4,{writable:true});
 const shader=B.createComputeShader(engine,{name:'Integrated source mapping probe',computeSource:accumulationWGSL+volumeSamplerWGSL+`
 @group(0)@binding(1)var<storage,read> points:array<vec4<f32>>;
 @group(0)@binding(2)var<storage,read> matrices:array<vec4<f32>>;
 @group(0)@binding(3)var<storage,read_write> result:array<vec4<f32>>;
 @group(0)@binding(4)var<storage,read_write> retained:array<f32>;
 @compute @workgroup_size(1)fn main(@builtin(global_invocation_id)id:vec3<u32>){
 let p=points[id.x].xyz;let a=mat4x4<f32>(matrices[4],matrices[5],matrices[6],matrices[7]);let b=mat4x4<f32>(matrices[8],matrices[9],matrices[10],matrices[11]);
 let q=clamp(vec3<i32>(floor(p+vec3<f32>(.5))),vec3<i32>(0),vec3<i32>(511,511,102));
 retained[id.x]=select(0.0,1.0,p.z>=matrices[14].x&&accumulatedK(p.z,matrices[15]));
 result[id.x]=vec4<f32>(stored(q),interpolate(p),length((a*b*vec4<f32>(p,1)).xyz-p),textureLoad(volume,q,0).b);}`,
 bindings:[B.computeStorageBufferBinding('coverage',{group:0,binding:4,access:'read-write'}),B.computeTextureViewBinding('volume',{group:0,binding:0,viewDimension:'3d'}),B.computeStorageBufferBinding('points',{group:0,binding:1,access:'read'}),B.computeStorageBufferBinding('matrices',{group:0,binding:2,access:'read'}),B.computeStorageBufferBinding('result',{group:0,binding:3,access:'read-write'})]});
 let bindings:any,task:any;
 try{bindings=B.createComputeBindingSet(shader,{volume:await B.createComputeTextureViewResource(engine,texture,{viewDimension:'3d'}),points:input,matrices,result:output,coverage});task=B.createComputeTask(engine,'Bounded CT RG/SEG B readback');B.addComputeDispatch(task,B.createComputeDispatch(shader,bindings,{size:{x:count}}));await B.prepareComputeTask(task);task.record();B.submitComputeTasks([task]);return {retained:Array.from(new Float32Array(await B.readStorageBuffer(coverage))),points,values:Array.from(new Float32Array(await B.readStorageBuffer(output))),columns:['stored uint16','trilinear stored','world index roundtrip error','nearest SEG membership'],count};}
 finally{task?.dispose();if(bindings)B.disposeComputeBindingSet(bindings);B.disposeComputeShader(shader);for(const buffer of [input,matrices,output,coverage])B.disposeStorageBuffer(buffer);}
}
