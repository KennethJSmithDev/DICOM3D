import {storedWGSL,interpolateWGSL} from './h000-volume-material.mjs';
import {interpolateSource} from './h000-volume-core.mjs';
/** Bounded readback of the exact texture used by the WebGPU volume material. No new renderer/device. */
export async function probeH000Volume(renderer,resource,study){
 const backend=renderer.backend,device=backend?.device;if(!backend?.isWebGPUBackend||!device)throw Error('Actual WebGPU backend required');
 await renderer.initTextureAsync(resource.texture);
 const gpuTexture=backend.get(resource.texture).texture;if(!gpuTexture)throw Error('Rendered volume texture is unavailable');
 const points=[[0,0,0],[102,511,511],[51,255,255],[64,220,325],[71,217,342],[78,210,330],[71.25,213.5,318.75],[.5,.5,.5],[101.75,510.25,510.5],[-.5,-.5,-.5],[102.5,511.5,511.5]];
 const inputs=new Float32Array(points.length*4);points.forEach((p,i)=>inputs.set([p[2],p[1],p[0],0],i*4));
 const created=[];const buffer=options=>{const value=device.createBuffer(options);created.push(value);return value};
 try{
 const input=buffer({size:inputs.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),output=buffer({size:points.length*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),readback=buffer({size:points.length*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});device.queue.writeBuffer(input,0,inputs);
 const module=device.createShaderModule({code:storedWGSL+'\n'+interpolateWGSL+`\n@group(0) @binding(0) var tex:texture_3d<f32>;@group(0) @binding(1) var<storage,read> points:array<vec4<f32>>;@group(0) @binding(2) var<storage,read_write> results:array<f32>;@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){if(id.x<${points.length}u){results[id.x]=ctInterpolate(tex,points[id.x].xyz);}}`});
 const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');if(errors.length)throw Error(errors.map(e=>e.message).join('; '));
 const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}),group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:gpuTexture.createView({dimension:'3d'})},{binding:1,resource:{buffer:input}},{binding:2,resource:{buffer:output}}]});
 const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(points.length);pass.end();encoder.copyBufferToBuffer(output,0,readback,0,points.length*4);device.queue.submit([encoder.finish()]);await readback.mapAsync(GPUMapMode.READ);const values=new Float32Array(readback.getMappedRange()).slice();readback.unmap();
 const samples=points.map((p,i)=>{const expected=interpolateSource(study.pixels,...p);return {kRowColumn:p,expected,gpu:values[i],absoluteError:Math.abs(values[i]-expected)}}),maxError=Math.max(...samples.map(s=>s.absoluteError));
 return {status:maxError<=.001?'PASS':'FAIL',maxError,tolerance:.001,samples,scope:'11 original-source versus exact-volume GPU packed-byte/interpolation samples; not global image or surface accuracy',sourceSha256:study.manifest.provenance.B_volume.sha256};
 }finally{for(const value of created)value.destroy()}
}
