// Dedicated CPU-only host for unchanged hash-verified C002 Wasm. The frozen web
// glue declares DOM targets, but no NRX GPU/DOM function is invoked in this worker.
// Unsupported DOM use fails explicitly. Termination cancels synchronous extraction.
self.window=self;
self.document={currentScript:null,querySelector(){throw Error('NRX CPU worker cannot access DOM');},getElementById(){throw Error('NRX CPU worker cannot access DOM');}};
self.onmessage=async ({data})=>{
 let runtimeUrl;
 try{
  const ready=new Promise((resolve,reject)=>{self.Module={noInitialRun:true,wasmBinary:new Uint8Array(data.wasm),onRuntimeInitialized:resolve,onAbort:reason=>reject(Error(String(reason)))};});
  runtimeUrl=URL.createObjectURL(new Blob([data.js],{type:'text/javascript'}));importScripts(runtimeUrl);await ready;
  const m=self.Module,memory=self.wasmMemory;if(!(memory instanceof WebAssembly.Memory))throw Error('Wasm memory unavailable');
  const pointer=Number(m._source_ptr());if(!Number.isSafeInteger(pointer)||pointer<0||pointer+data.payload.byteLength>memory.buffer.byteLength)throw Error('NRX input span invalid');
  new Uint8Array(memory.buffer,pointer,data.payload.byteLength).set(new Uint8Array(data.payload));
  if(m._source_commit(data.vertices,data.indices)!==1)throw Error('NRX rejected source');
  if(m._field_generate(data.resolution)!==1)throw Error('NRX field rejected source');
  const output=Number(m._field_render_ptr()),size=m._field_render_bytes(),report=self.fieldReport;
  if(!Number.isSafeInteger(output)||output<0||!Number.isInteger(size)||size<=0||size%96||output+size>memory.buffer.byteLength||report?.n!==data.resolution)throw Error('NRX output span invalid');
  const floats=new Float32Array(memory.buffer,output,size/4).slice();m._field_clear();
  self.postMessage({ok:true,output:floats.buffer,report},[floats.buffer]);
 }catch(error){self.postMessage({ok:false,error:String(error?.message??error)});}
 finally{if(runtimeUrl)URL.revokeObjectURL(runtimeUrl);}
};
