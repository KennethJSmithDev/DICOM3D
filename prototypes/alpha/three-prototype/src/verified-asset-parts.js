// Reuses the ordered lossless publication parts established by GLB-SIZE-FIX-001.
// All parts and the complete original asset must verify before a parser receives bytes.
export async function sha256(bytes) {
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function readFixedAsset(url,expected,signal,fetcher=fetch) {
 signal?.throwIfAborted();
 const response=await fetcher(url,{signal,cache:'no-store'});
 if(!response.ok)throw Error(`Reference asset unavailable: HTTP ${response.status}`);
 const declared=response.headers.get('content-length');
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)!==expected))throw Error('Reference asset unexpected length');
 if(!response.body)throw Error('Reference asset missing response body');
 const reader=response.body.getReader(),bytes=new Uint8Array(expected);let offset=0;
 try {
  while(true){signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;if(!(value instanceof Uint8Array)||value.length>expected-offset)throw Error('Reference asset size limit');bytes.set(value,offset);offset+=value.length;}
  if(offset!==expected)throw Error('Reference asset incomplete response');
  signal?.throwIfAborted();return bytes;
 }catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
}
export async function reconstructVerifiedAsset(base,descriptor,signal,fetcher=fetch) {
 const {bytes,sha256:expected,parts}=descriptor;
 if(!Number.isSafeInteger(bytes)||bytes<1||!Array.isArray(parts)||!parts.length||parts.reduce((n,p)=>n+p.bytes,0)!==bytes)throw Error('Invalid reference part inventory');
 const seen=new Set();for(const part of parts){if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part.name)||seen.has(part.name)||!Number.isSafeInteger(part.bytes)||part.bytes<1||part.bytes>67108864||! /^[a-f0-9]{64}$/.test(part.sha256))throw Error('Invalid reference part identity');seen.add(part.name)}
 if(!/^[a-f0-9]{64}$/.test(expected))throw Error('Invalid reference asset identity');
 const output=new Uint8Array(bytes);let offset=0;
 for(const part of parts){const data=await readFixedAsset(`${base}${part.name}`,part.bytes,signal,fetcher);if(await sha256(data)!==part.sha256)throw Error(`Reference part integrity mismatch: ${part.name}`);signal?.throwIfAborted();output.set(data,offset);offset+=data.length;}
 if(await sha256(output)!==expected)throw Error('Reference reconstructed asset integrity mismatch');
 signal?.throwIfAborted();return output;
}
export const FEMALE_PARTS=Object.freeze({bytes:187220140,sha256:'24abc4d8bd0a00bfc93ab45e227c1e9b157ffc0d21d1e5c22408fbe3933f60cb',parts:[
 {name:'hra-female.glb.part001',bytes:67108864,sha256:'a97a2b0602e10ebd6d6a7162627babcdfed85eec1ef482d13e40af6dd4053d19'},
 {name:'hra-female.glb.part002',bytes:67108864,sha256:'008abd7208f1849cea0cee2427f61e06c069101db48817507c54724558cd20d2'},
 {name:'hra-female.glb.part003',bytes:53002412,sha256:'33a7ea5afb5d934d48deed6e383ac747ba5b8ebaaba9506bf6da043ab545eca0'}
]});
