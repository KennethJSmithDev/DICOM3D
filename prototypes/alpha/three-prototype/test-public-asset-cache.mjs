import assert from 'node:assert/strict';
import {createPublicAssetCache,sha256} from './src/public-asset-cache.js';
const bytes=new Uint8Array([1,2,3,4]).buffer,hash=await sha256(bytes);let calls=0;
const unavailable=()=>{throw Error('Storage blocked')};
const cache=createPublicAssetCache({lock:task=>task(),memoryLimit:4,storageLimit:8,storage:unavailable,fetcher:async()=>{calls++;return new Response(bytes)}});cache.configure({persistent:true});
const first=await cache.get('http://localhost/a',4,hash);new Uint8Array(first)[0]=9;const second=await cache.get('http://localhost/a',4,hash);assert.equal(new Uint8Array(second)[0],1);assert.equal(calls,1);assert.equal(cache.stats.storageFailures,1);
await cache.get('http://localhost/b',4,hash);await cache.get('http://localhost/a',4,hash);assert.equal(calls,3);assert.equal(cache.stats.memoryBytes,4);
const entries=new Map();const disk={async match(key){return entries.get(String(key))?.clone()},async keys(){return [...entries.keys()]},async put(key,response){entries.set(String(key),response)},async delete(key){return entries.delete(String(key))}};
const persistent=createPublicAssetCache({lock:task=>task(),memoryLimit:0,storageLimit:8,storage:()=>({open:async()=>disk}),fetcher:async()=>new Response(bytes)});persistent.configure({persistent:true});
for(const path of ['a','b','c'])await persistent.get('http://localhost/'+path,4,hash);assert.equal(entries.size,2);assert(![...entries.keys()].some(k=>new URL(k).pathname==='/a'));
entries.set('http://localhost/c?sha256='+hash,new Response(new Uint8Array([9,9,9,9])));await persistent.get('http://localhost/c',4,hash);assert.equal(persistent.stats.corruptions,1);
let badCalls=0;const corrupt=createPublicAssetCache({lock:task=>task(),memoryLimit:0,fetcher:async()=>{badCalls++;return new Response(new Uint8Array([9]))}});await assert.rejects(corrupt.get('http://localhost/c',4,hash),/integrity mismatch/);assert.equal(badCalls,2);
const full=createPublicAssetCache({lock:task=>task(),memoryLimit:0,storage:()=>({open:async()=>({...disk,put:async()=>{throw Error('QuotaExceededError')}})}),fetcher:async()=>new Response(bytes)});full.configure({persistent:true});assert.deepEqual(await full.get('http://localhost/quota',4,hash),bytes);assert.equal(full.stats.storageFailures,1);
console.log('PASS: bounded memory/LRU disk eviction, immutable returns, unavailable/full storage fallback and bounded corruption recovery');

// Concurrent responses and two page-like cache instances must share the storage lock.
entries.clear();let tail=Promise.resolve(),downloads=0,peakDownloads=0;
const sharedLock=task=>{const next=tail.then(task);tail=next.catch(()=>{});return next};
const parallel=()=>createPublicAssetCache({memoryLimit:0,storageLimit:8,lock:sharedLock,storage:()=>({open:async()=>disk}),fetcher:async()=>{peakDownloads=Math.max(peakDownloads,++downloads);await new Promise(r=>setTimeout(r,5));downloads--;return new Response(bytes)}});
const tabA=parallel(),tabB=parallel();tabA.configure({persistent:true});tabB.configure({persistent:true});
await Promise.all(Array.from({length:12},(_,i)=>(i%2?tabA:tabB).get('http://localhost/concurrent'+i,4,hash)));
assert(entries.size*4<=8);assert(peakDownloads>1);
const noLock=createPublicAssetCache({lock:null,memoryLimit:0,fetcher:async()=>new Response(bytes)});noLock.configure({persistent:true});assert.deepEqual(await noLock.get('http://localhost/no-lock',4,hash),bytes);assert.equal(noLock.stats.storageFailures,1);
console.log('PASS: concurrent/tab-shared bounded writes, independent downloads and lock-unavailable fallback');
