import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {
  PUBLIC_RESEARCH_ASSETS, PUBLIC_RESEARCH_FILES, PUBLIC_RESEARCH_SEMANTIC_ID,
  assertPublicMetadataStructure, verifyPublicBytes, parsePublicMetadata,
  publicAssetUrl, boundedStreamBytes, decodePublicGzip, projectPublicResearch,
} from '../viewer/src/public-source-binding.mjs';
import {digest, frameRgba, validateReceipt} from '../viewer/src/ct-frame.mjs';
import {validateSpatial} from '../viewer/src/ct-spatial.mjs';
import {loadPublicResearchFixture} from '../viewer/src/public-research-loader.ts';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=resolve(root,'reference/public/demo/h000');
const rows=[],started=performance.now();
const test=async(name,fn)=>{
  const t=performance.now();
  try {const detail=await fn();rows.push({name,status:'PASS',ms:performance.now()-t,...(detail??{})});}
  catch(error){rows.push({name,status:'FAIL',ms:performance.now()-t,error:String(error),stack:error.stack});}
};
const buffers=Object.fromEntries(await Promise.all(Object.entries(PUBLIC_RESEARCH_ASSETS)
  .map(async([key,a])=>[key,new Uint8Array(await readFile(resolve(directory,a.filename)))])));
let metadata,ct,mask,fixture;

await test('Only five exact payload files',async()=>{
  assert.deepEqual((await readdir(directory)).sort(),[...PUBLIC_RESEARCH_FILES].sort());
});
await test('All five frozen byte identities',async()=>{
  for(const[key,asset]of Object.entries(PUBLIC_RESEARCH_ASSETS))await verifyPublicBytes(buffers[key],asset,key);
});
await test('Metadata exact bytes plus recursively closed schema',async()=>{
  metadata=await parsePublicMetadata(buffers.metadata);
  assert.equal(metadata.admission.status,'LOCAL_PUBLICATION_CANDIDATE');
  assert.equal(metadata.admission.publicationApproved,false);
  assert(Object.isFrozen(metadata.frames[0]));
});
for(const[path,mutate]of [
  ['root',x=>x.unapproved=true],
  ['source',x=>x.source.PatientName='unapproved'],
  ['frame',x=>x.frames[17].accession='unapproved'],
  ['asset',x=>x.assets.ct.fallback='unapproved'],
  ['semantic code',x=>x.structure.source.type_codes[0].other='unapproved'],
  ['credit',x=>x.legal.credits.ct.other='unapproved'],
  ['admission',x=>x.admission.other='unapproved'],
  ['prototype key',x=>Object.defineProperty(x.source,'__proto__',{value:{},enumerable:true})],
])await test(`Reject unknown key: ${path}`,()=>{
  const bad=structuredClone(metadata);mutate(bad);assert.throws(()=>assertPublicMetadataStructure(bad),/Unknown or missing key/);
});
for(const[name,mutate]of [
  ['publication flag',x=>x.admission.publicationApproved=true],
  ['source identity',x=>x.source.ct_series_uid='1.2.3'],
  ['semantic identity',x=>x.structure.semantic_id='lung.whole'],
  ['asset path',x=>x.assets.ct.proposed_relative_url='../../data/private.npy'],
  ['duplicate CT SOP',x=>x.frames[1].ct_sop_uid=x.frames[0].ct_sop_uid],
  ['duplicate SEG frame',x=>x.frames[1].seg_frame_number=x.frames[0].seg_frame_number],
  ['frame order',x=>x.frames[1].ct_k=0],
  ['mask count',x=>x.frames[0].nonzero_voxels=1],
  ['matrix',x=>x.spatial.matrices.index_to_patient_mm[0][3]+=1],
  ['missing notice',x=>delete x.assets.notice],
])await test(`Reject changed ${name}`,()=>{
  const bad=structuredClone(metadata);mutate(bad);assert.throws(()=>assertPublicMetadataStructure(bad));
});
await test('Reject metadata hash mismatch at unchanged byte length',async()=>{
  const bad=buffers.metadata.slice();bad[32]^=1;await assert.rejects(parsePublicMetadata(bad),/SHA-256/);
});
await test('Reject metadata wrong byte length',async()=>{
  await assert.rejects(parsePublicMetadata(buffers.metadata.subarray(1)),/byte length/);
});
await test('Valid same-origin application base',()=>{
  assert.equal(publicAssetUrl('/DICOM3D/','ct.npy.bin','https://example.test/DICOM3D/'),
    'https://example.test/DICOM3D/demo/h000/ct.npy.bin');
});
for(const base of ['https://other.test/','file:///private/','../','/safe/../','/safe/%2e%2e/','/safe\\private/','/safe/?x=/','https://user:pass@example.test/']) {
  await test(`Reject unsafe base ${base}`,()=>assert.throws(()=>publicAssetUrl(base,'ct.npy.bin','https://example.test/DICOM3D/')));
}
for(const filename of ['receipt.json','../ct.npy.bin','ct.npy.bin?x=1','/ct.npy.bin','%63t.npy.bin','ct.npy.gz','mask.npy.gz']) {
  await test(`Reject filename ${filename}`,()=>assert.throws(()=>publicAssetUrl('/DICOM3D/',filename,'https://example.test/DICOM3D/')));
}
await test('Native gzip required',async()=>{
  await assert.rejects(decodePublicGzip(buffers.mask,'mask',null),/decompression is unavailable/);
});
await test('Reject compressed hash corruption',async()=>{
  const bad=buffers.mask.slice();bad[100]^=1;await assert.rejects(decodePublicGzip(bad,'mask'),/SHA-256/);
});
await test('Bounded stream overflow cancels reader',async()=>{
  let canceled=false;
  const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(9));},cancel(){canceled=true;}});
  await assert.rejects(boundedStreamBytes(stream,8,'test'),/exceeds/);
  assert.equal(canceled,true);
});
await test('Bounded stream rejects truncation',async()=>{
  const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(7));c.close();}});
  await assert.rejects(boundedStreamBytes(stream,8,'test'),/incomplete/);
});
await test('Decoder rejects oversized decompressed output',async()=>{
  class Oversized {
    constructor(){return new TransformStream({transform(_chunk,c){c.enqueue(new Uint8Array(PUBLIC_RESEARCH_ASSETS.mask.decodedBytes+1));}});}
  }
  await assert.rejects(decodePublicGzip(buffers.mask,'mask',Oversized),/exceeds/);
});
await test('Native gzip round trip: full CT and mask',async()=>{
  ct=await decodePublicGzip(buffers.ct,'ct');mask=await decodePublicGzip(buffers.mask,'mask');
  return {ctDecodedBytes:ct.byteLength,maskDecodedBytes:mask.byteLength};
});
await test('Project all 103 frame bindings against exact binary mask',async()=>{
  fixture=await projectPublicResearch(metadata,ct,mask,buffers.mesh);
  assert.equal(fixture.binding.count,32588);
  assert.equal(fixture.binding.frames.length,103);
  assert.deepEqual(fixture.binding.occupied.map(f=>f.ct_k),Array.from({length:15},(_,i)=>64+i));
  assert.equal(fixture.binding.semanticId,PUBLIC_RESEARCH_SEMANTIC_ID);
  assert.equal(fixture.manifest.structure.semantic_id,PUBLIC_RESEARCH_SEMANTIC_ID);
  assert.equal(fixture.ctReceipt.result,undefined);
  assert.equal(fixture.ctReceipt.public_projection.publicationApproved,false);
  assert.throws(()=>validateReceipt(fixture.ctReceipt,fixture.manifest),/not an accepted H000-B receipt/);
  validateSpatial(fixture.ctReceipt,fixture.manifest);
  return {frameBindings:103,foregroundVoxels:32588,peakK:fixture.binding.peak.ct_k};
});
await test('Unverified frozen projection object cannot bypass metadata identity',async()=>{
  await assert.rejects(projectPublicResearch(Object.freeze(structuredClone(metadata)),ct,mask,buffers.mesh),/Verified frozen/);
});
await test('All 103 native display hashes match the independent accepted oracle aggregate',async()=>{
  const hashes=[],rgba=new Uint8ClampedArray(512*512*4);
  for(let k=0;k<103;k++){frameRgba(fixture.pixels,k,-600,1500,rgba);hashes.push(await digest(rgba));}
  const aggregate=await digest(new TextEncoder().encode(hashes.join('\n')+'\n'));
  assert.equal(aggregate,'cbd508f4711b67d67f4ebf8e2c140208ba52795748e063ee71ae0244bc023226');
  return {frames:103,rgbaHashAggregate:aggregate,oracle:'Independent A3 H000 oracle; ordered SHA-256 lines plus final newline'};
});

// Exercise the actual explicit loader without browser/network or production writes.
const originalFetch=globalThis.fetch;
const originalLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
Object.defineProperty(globalThis,'location',{configurable:true,value:{href:'https://example.test/DICOM3D/'}});
let requests=[];
const mockFetch=async(url,options)=>{
  requests.push({url,options});
  const key=Object.keys(PUBLIC_RESEARCH_ASSETS).find(key=>url===`https://example.test/DICOM3D/demo/h000/${PUBLIC_RESEARCH_ASSETS[key].filename}`);
  assert(key,'Nonallowlisted fetch');
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  const result=new Response(buffers[key],{headers:{'content-length':String(buffers[key].byteLength)}});
  Object.defineProperty(result,'url',{value:url});
  return result;
};
try {
  globalThis.fetch=mockFetch;
  await test('Explicit loader fetches only five verified objects and returns public projections',async()=>{
    requests=[];const loaded=await loadPublicResearchFixture('/DICOM3D/');
    assert.equal(requests.length,5);
    assert.equal(loaded.binding.count,32588);
    assert.equal(loaded.glbBytes.byteLength,263976);
    assert.equal(loaded.noticeUrl,'https://example.test/DICOM3D/demo/h000/NOTICE.md');
    assert.equal(loaded.metrics.publicationApproved,false);
    assert.equal(loaded.metrics.retainedDecodedNpyBytes,81002752);
    return {requests:requests.length,loadAndVerifyMs:loaded.metrics.loadAndVerifyMs};
  });
  await test('Invalid base fails before requests',async()=>{
    requests=[];await assert.rejects(loadPublicResearchFixture('https://other.test/'));
    assert.equal(requests.length,0);
  });
  await test('Loader missing gzip support fails before requests',async()=>{
    const original=globalThis.DecompressionStream;
    try {globalThis.DecompressionStream=undefined;requests=[];await assert.rejects(loadPublicResearchFixture('/DICOM3D/'),/decompression support/);assert.equal(requests.length,0);}
    finally {globalThis.DecompressionStream=original;}
  });
  await test('Loader accepts transport-decoded gzip/br/deflate with exact admitted file bytes',async()=>{
    globalThis.fetch=async(url,options)=>{
      const r=await mockFetch(url,options);
      const encoding=url.endsWith('NOTICE.md')?'br':url.endsWith('lesion.glb')?'deflate':'gzip';
      r.headers.set('content-encoding',encoding);
      r.headers.set('content-length','123'); // Wire length differs from the browser-decoded file.
      return r;
    };
    requests=[];const loaded=await loadPublicResearchFixture('/DICOM3D/');
    assert.equal(requests.length,5);
    assert.equal(loaded.binding.count,32588);
    assert.equal(loaded.metrics.files.metadata.transportEncoding,'gzip');
    assert.equal(loaded.metrics.files.notice.transportEncoding,'br');
    assert.equal(loaded.metrics.files.mesh.transportEncoding,'deflate');
    assert.equal(loaded.metrics.files.ct.bytes,PUBLIC_RESEARCH_ASSETS.ct.bytes);
    return {requests:requests.length,transport:['gzip','br','deflate'],bodyIdentity:'Five exact admitted files'};
  });
  await test('Loader rejects unknown transport encoding',async()=>{
    globalThis.fetch=async(url,options)=>{const r=await mockFetch(url,options);r.headers.set('content-encoding','unknown');return r;};
    await assert.rejects(loadPublicResearchFixture('/DICOM3D/'),/Content-Encoding/);
  });
  await test('Loader still rejects wrong identity Content-Length',async()=>{
    globalThis.fetch=async(url,options)=>{const r=await mockFetch(url,options);r.headers.set('content-length','123');return r;};
    await assert.rejects(loadPublicResearchFixture('/DICOM3D/'),/Content-Length/);
  });
  await test('Loader rejects hash corruption after browser transport decoding',async()=>{
    globalThis.fetch=async(url,options)=>{
      await mockFetch(url,options);
      const bad=buffers.metadata.slice();bad[32]^=1;
      const r=new Response(bad,{headers:{'content-encoding':'gzip','content-length':'123'}});
      Object.defineProperty(r,'url',{value:url});return r;
    };
    await assert.rejects(loadPublicResearchFixture('/DICOM3D/'),/SHA-256/);
  });
  await test('Loader rejects mistaken HTTP auto-decode of the admitted NPY gzip container',async()=>{
    globalThis.fetch=async(url,options)=>{
      const normal=await mockFetch(url,options);
      if(!url.endsWith('ct.npy.bin'))return normal;
      // A misconfigured host consumed the file's gzip container instead of only its transport encoding.
      const r=new Response(ct,{headers:{'content-encoding':'gzip','content-length':String(buffers.ct.byteLength)}});
      Object.defineProperty(r,'url',{value:url});return r;
    };
    await assert.rejects(loadPublicResearchFixture('/DICOM3D/'),/output exceeds admitted byte limit/);
  });
} finally {
  globalThis.fetch=originalFetch;
  if(originalLocation)Object.defineProperty(globalThis,'location',originalLocation);else delete globalThis.location;
}
const failures=rows.filter(row=>row.status==='FAIL');
console.log(JSON.stringify({status:failures.length?'FAIL':'PASS',tests:rows.length,passed:rows.length-failures.length,
  failed:failures.length,elapsedMs:performance.now()-started,publicationApproved:false,rows},null,2));
if(failures.length)process.exitCode=1;
