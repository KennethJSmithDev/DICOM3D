import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {webcrypto,createHash} from 'node:crypto';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {composeSourceCatalog,createSourceSelectionProjection,nativeAtoms,nativeComponentKey,mergeRanges} from '../src/source-native-selection.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),started=performance.now();
const hash=b=>createHash('sha256').update(b).digest('hex');
let fault='',requests=[];
const context=vm.createContext({crypto:webcrypto,TextDecoder,DOMException,console,fetch:async url=>{
 requests.push(url);let file=resolve(root,url.startsWith('atlas/')?'expanded-atlas/'+url.slice(6):'atlas-delta/'+url.slice(13));
 if(fault==='missing'&&url.endsWith('male-source43-recoveries.glb'))return {ok:false,status:404};
 let b=await readFile(file);if(fault==='corrupt'&&url.endsWith('male-source43-recoveries.glb')){b=Buffer.from(b);b[b.length-8]^=1;}
 return {ok:true,headers:{get:()=>String(b.length)},arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)};
}});
const module=new vm.SourceTextModule(await readFile(resolve(root,'src/atlas.js'),'utf8'),{context,initializeImportMeta(meta){meta.env={BASE_URL:''}}});
await module.link(()=>new vm.SyntheticModule(['GLTFLoader'],function(){this.setExport('GLTFLoader',GLTFLoader)},{context}));await module.evaluate();const api=module.namespace;
const signal=new AbortController().signal,index=await api.loadIndex(signal),cat=index.sourceNative,recovery=cat.sourceRecoveries[0];
assert.equal(index.structures.length,1205);assert.equal(cat.atoms.length,2299);assert.equal(cat.heldSourceEntries.length,416);assert.equal(recovery.remainingResidualHoldFiles,18);
assert.equal(requests.filter(x=>x.endsWith('.glb')).length,0);
const descriptor=index.bundles.find(b=>b.id==='source43-recoveries');assert(descriptor);assert(descriptor.byteLength<100000000);
for(const kind of ['missing','corrupt']){fault=kind;await assert.rejects(()=>api.loadBundle(descriptor,signal),kind==='missing'?/HTTP 404/:/geometry integrity mismatch/);}fault='';
const abort=new AbortController();abort.abort();await assert.rejects(()=>api.loadBundle(descriptor,abort.signal),/Cancelled/);
const bundles=new Map(),owners=new Map();
for(const b of index.bundles){const item=await api.loadBundle(b,signal);bundles.set(b.id,item);item.scene.traverse(n=>{if(n.userData.semanticId)owners.set(n.userData.semanticId,n)});}
assert.equal(bundles.size,17);assert.equal(owners.size,1205);const atomMap=new Map(cat.atoms.map(x=>[x.id,x]));
const aliases=recovery.newAtomIds.map(id=>atomMap.get(id)).filter(a=>a.geometryAliasOf);
assert.equal(aliases.length,16);
for(const a of aliases){const original=atomMap.get(a.geometryAliasOf);assert(original);for(const k of ['ownerId','bundleId','vertexStart','vertexCount','indexStart','indexCount','physicalSpanId'])assert.equal(a[k],original[k]);assert.equal(a.version,'4.3i');assert.equal(original.version,'4.0');}
const delta=JSON.parse(await readFile(resolve(root,'atlas-delta/female-delta.json')));const extra=await api.loadSourceCatalog(delta.sourceNative,signal,'female-delta');extra.concepts=extra.concepts.map(c=>({...c,relation:'HRA_PART_OF'}));
const replaced=['FMA15900','FMA9600','FMA19667','FMA7211','FMA7212','FMA21385','FMA21386','FMA20818','FMA20819'];const female=composeSourceCatalog(cat,extra,replaced);
assert.equal(female.owners.length,1235);assert.equal(female.atoms.length,2347);
let tests=0;
const baseline=new Map([...owners.values()].map(n=>[n,{visible:n.visible,material:n.material,geometry:n.geometry,groups:n.geometry.groups.map(g=>({...g})),drawRange:{...n.geometry.drawRange},position:n.position.toArray(),quaternion:n.quaternion.toArray(),scale:n.scale.toArray(),positionArray:n.geometry.attributes.position.array,indexArray:n.geometry.index.array}]));
const projection=createSourceSelectionProjection();
for(const catalog of [cat,female])for(const key of [...recovery.changedConceptKeys,...recovery.newAtomIds.map(nativeComponentKey)]){
 const atoms=nativeAtoms(catalog,key),expected=new Map();assert(atoms.length);
 for(const a of atoms){const mesh=owners.get(a.ownerId);assert(mesh);const ranges=expected.get(mesh)||[];ranges.push([a.indexStart,a.indexCount]);expected.set(mesh,ranges);}
 for(const [mesh,ranges]of expected)expected.set(mesh,mergeRanges(ranges,mesh.geometry.index.count));
 const result=projection.apply(bundles,{catalog,key,isolated:true,opacity:.4,style:'holographic'});assert.equal(result.status,'ready',key);assert.equal(result.drawMeshes,expected.size);
 for(const mesh of owners.values()){
  assert.equal(mesh.visible,expected.has(mesh),key+' unrelated geometry isolation');
  if(expected.has(mesh)){assert.deepEqual(mesh.geometry.groups.map(g=>[g.start,g.count]),expected.get(mesh));assert(mesh.material.some(m=>m.opacity<=.4));}
 }
 projection.restore();
 for(const [mesh,b]of baseline){assert.equal(mesh.visible,b.visible);assert.equal(mesh.material,b.material);assert.equal(mesh.geometry,b.geometry);assert.deepEqual(mesh.geometry.groups,b.groups);assert.deepEqual(mesh.geometry.drawRange,b.drawRange);assert.deepEqual(mesh.position.toArray(),b.position);assert.deepEqual(mesh.quaternion.toArray(),b.quaternion);assert.deepEqual(mesh.scale.toArray(),b.scale);assert.equal(mesh.geometry.attributes.position.array,b.positionArray);assert.equal(mesh.geometry.index.array,b.indexArray);}
 tests++;
}
const concept=cat.concepts.find(c=>c.key===recovery.changedConceptKeys[0]);const absent=new Map(bundles);absent.delete(descriptor.id);const rejection=projection.apply(absent,{catalog:cat,key:concept.key,isolated:true});assert.equal(rejection.status,'waiting');assert.equal(projection.info,null);
let disposed=0;for(const item of bundles.values()){item.scene.traverse(n=>{if(n.geometry)n.geometry.addEventListener('dispose',()=>disposed++)});api.disposeScene(item.scene);}assert.equal(disposed,1205);
const report={status:'PASS',indexSha256:hash(await readFile(resolve(root,'expanded-atlas/index.json'))),maleOwners:1205,femaleOwners:1235,maleSourceOccurrences:2299,femaleSourceOccurrences:2347,maleExactPartOf:cat.concepts.filter(c=>c.relation==='PART_OF'&&c.scope==='EXACT_COMPOUND').length,femaleExactPartOf:female.concepts.filter(c=>c.relation==='PART_OF'&&c.scope==='EXACT_COMPOUND').length,newGeometrySpans:17,exactReusedAliases:16,recoveredSourceConcepts:13,projectionCases:tests,negativePaths:['missing bundle','corrupt bundle','cancelled loading','missing resident member rejects whole selection'],disposedGeometries:disposed,elapsedMs:performance.now()-started,memory:process.memoryUsage(),resourceUsage:process.resourceUsage(),limitations:['Node Three.js loader and real projection logic; no browser, GPU rendering, or clinical claim.','No inferred 4.3i system hierarchy; original version distinctions remain visible.']};
assert(report.memory.rss<4*1024**3);if(process.env.ATLAS_RECOVERY_REPORT)await writeFile(process.env.ATLAS_RECOVERY_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
