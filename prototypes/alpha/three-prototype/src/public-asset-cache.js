// Only pinned public atlas assets enter this cache. Study loaders never import it.
export function createPublicAssetCache({memoryLimit=32*1024*1024,storageLimit=128*1024*1024,fetcher=(...a)=>fetch(...a),storage=()=>globalThis.caches,lock=globalThis.navigator?.locks?task=>navigator.locks.request('dicom3d-public-atlas-v1-writes',task):null,hash=sha256}={}){
 const memory=new Map();let used=0,persistent=false,storageTail=Promise.resolve();
 const stats={networkRequests:0,networkBytes:0,memoryHits:0,storageHits:0,corruptions:0,storageFailures:0,memoryBytes:0,storageLimit,persistent:false};
 const cacheName='dicom3d-public-atlas-v1';
 const keyFor=(url,digest)=>{const key=new URL(url,globalThis.location?.href??'http://localhost/');key.searchParams.set('sha256',digest);return key.href};
 function forget(key){const b=memory.get(key);if(b){used-=b.byteLength;memory.delete(key);stats.memoryBytes=used}}
 function retain(key,bytes){forget(key);if(bytes.byteLength>memoryLimit)return;while(used+bytes.byteLength>memoryLimit)forget(memory.keys().next().value);memory.set(key,bytes.slice(0));used+=bytes.byteLength;stats.memoryBytes=used}
 async function valid(bytes,maximum,digest){return bytes.byteLength<=maximum&&await hash(bytes)===digest}
 async function disk(){if(!lock){stats.storageFailures++;return null}try{return await storage()?.open(cacheName)}catch{stats.storageFailures++;return null}}
 async function saveNow(cache,key,bytes){try{
  if(bytes.byteLength>storageLimit)return;
  await cache.delete(key);const keys=await cache.keys(),rows=[];let total=0;
  for(const request of keys){const response=await cache.match(request);const size=Number(response?.headers.get('content-length'))||0;total+=size;rows.push({request,size,time:Number(response?.headers.get('x-dicom3d-used'))||0})}
  rows.sort((a,b)=>a.time-b.time);for(const row of rows){if(total+bytes.byteLength<=storageLimit)break;await cache.delete(row.request);total-=row.size}
  await cache.put(key,new Response(bytes,{headers:{'content-length':String(bytes.byteLength),'x-dicom3d-used':String(Date.now())}}));
 }catch{stats.storageFailures++}}
 // One origin-wide write lock covers size inspection, eviction and put. The local
 // queue also bounds overlapping work; independent downloads remain concurrent.
 function save(cache,key,bytes){const result=storageTail.then(()=>lock(()=>saveNow(cache,key,bytes))).catch(()=>{stats.storageFailures++});storageTail=result;return result}
 async function get(url,maximum,digest,signal){
  if(!/^[a-f0-9]{64}$/.test(digest))throw Error('Pinned public asset identity required');
  signal?.throwIfAborted();const key=keyFor(url,digest),hit=memory.get(key);
  if(hit){forget(key);retain(key,hit);stats.memoryHits++;return hit.slice(0)}
  const cache=persistent?await disk():null;
  if(cache){try{const response=await cache.match(key);if(response){const bytes=await response.arrayBuffer();signal?.throwIfAborted();if(await valid(bytes,maximum,digest)){stats.storageHits++;retain(key,bytes);await save(cache,key,bytes);return bytes}stats.corruptions++;await cache.delete(key)}}catch(error){if(error.name==='AbortError')throw error;stats.storageFailures++}}
  // One normal HTTP-cache attempt, one cache-bypassing recovery at most.
  for(let attempt=0;attempt<2;attempt++){
   signal?.throwIfAborted();stats.networkRequests++;const response=await fetcher(key,{signal,cache:attempt?'reload':'default',credentials:'same-origin'});
   if(!response.ok)throw Error(`Public atlas asset: HTTP ${response.status}`);
   if(Number(response.headers.get('content-length'))>maximum)throw Error('Public atlas asset: size limit');
   const bytes=await response.arrayBuffer();stats.networkBytes+=bytes.byteLength;
   if(await valid(bytes,maximum,digest)){signal?.throwIfAborted();retain(key,bytes);if(cache)await save(cache,key,bytes);return bytes}
   stats.corruptions++;
  }
  throw Error('Public atlas asset integrity mismatch after bounded recovery');
 }
 return {get,stats,configure({persistent:enabled=false}={}){persistent=enabled;stats.persistent=enabled},clearMemory(){memory.clear();used=stats.memoryBytes=0},async clearStorage(){try{await storage()?.delete(cacheName)}catch{stats.storageFailures++}}};
}
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export const publicAtlasAssets=createPublicAssetCache();
