import createModule from './nrx-runtime.mjs';
export const NRX_WASM_SHA256='ed4e5444ec1374168fd2f9e7866b8790d0e82372acaaa1cea864419e0749227a';
export async function createRuntime(bytes){
 const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(actual!==NRX_WASM_SHA256)throw Error('NRX adapter integrity mismatch');
 const compiled=await WebAssembly.compile(bytes);let memory;
 const module=await createModule({instantiateWasm(imports,receive){const instance=new WebAssembly.Instance(compiled,imports);memory=instance.exports.memory;receive(instance,compiled);return instance.exports;}});
 return {extract(field,size,origin){const ptr=module._malloc(field.byteLength);if(!ptr)throw Error('NRX scalar allocation failed');try{new Float32Array(memory.buffer,ptr,field.length).set(field);const count=module._nrx_extract(ptr,size,...origin);if(count<0)throw Error(module.UTF8ToString(module._nrx_error()));const records=new Uint8Array(memory.buffer,module._nrx_pointer(),module._nrx_bytes()).slice();return {count,records,wasmCapacityBytes:memory.buffer.byteLength};}finally{module._free(ptr);module._nrx_release()}}};
}
