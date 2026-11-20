import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {webcrypto,createHash} from 'node:crypto';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {labelFemaleRecord} from '../src/female-catalog.mjs';
import {sourceAtomAtHit,nativeComponentKey,createSourceSelectionProjection} from '../src/source-native-selection.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const indexBytes=await readFile(resolve(root,'expanded-atlas/index.json'));
const pin=createHash('sha256').update(indexBytes).digest('hex');
const index=JSON.parse(indexBytes),delta=JSON.parse(await readFile(resolve(root,'atlas-delta/female-delta.json')));
let fault='',requests=[];
const context=vm.createContext({crypto:webcrypto,TextDecoder,DOMException,AbortController,URL,Response,console,fetch:async url=>{
 url=new URL(url).pathname.slice(1);
 requests.push(url);const file=resolve(root,url.startsWith('atlas/')?'expanded-atlas/'+url.slice(6):url.startsWith('female-delta/')?'atlas-delta/'+url.slice(13):'INVALID');
 if((fault==='missing'&&url.endsWith('source-native.json'))||(fault==='missing-repair'&&url.endsWith('male-source-table-repairs.glb')))return {ok:false,status:404};
 let bytes=await readFile(file);if((fault==='corrupt'&&url.endsWith('source-native.json'))||(fault==='corrupt-repair'&&url.endsWith('male-source-table-repairs.glb'))){bytes=Buffer.from(bytes);bytes[bytes.length-2]^=1;}
 return {ok:true,status:200,headers:{get:()=>String(bytes.length)},arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
}});
const modules=new Map();
async function moduleFor(path){
 if(modules.has(path))return modules.get(path);
 const module=new vm.SourceTextModule(await readFile(path,'utf8'),{context,identifier:path,initializeImportMeta(meta){meta.env={VITE_REVIEW_ATLAS_SHA:pin,BASE_URL:'http://localhost/'}}});modules.set(path,module);
 await module.link(async(specifier,referencing)=>{
  if(specifier.startsWith('.'))return moduleFor(resolve(dirname(referencing.identifier),specifier));
  const exports=await import(specifier);const external=new vm.SyntheticModule(Object.keys(exports),function(){for(const key of Object.keys(exports))this.setExport(key,exports[key])},{context});return external;
 });return module;
}
const mod=await moduleFor(resolve(root,'src/atlas.js'));await mod.evaluate();const api=mod.namespace;
const clearCache=()=>modules.get(resolve(root,'src/public-asset-cache.js')).namespace.publicAtlasAssets.clearMemory();
const ac=new AbortController(),loaded=await api.loadIndex(ac.signal);
assert.equal(loaded.structures.length,1205);assert.equal(loaded.sourceNative.atoms.length,2299);
assert.equal(loaded.sourceNative.heldSourceEntries.length,416);
assert.equal(loaded.sourceNative.sourceRecoveries[0].remainingResidualHoldFiles,18);
assert.equal(loaded.sourceNative.sourceRecoveries[0].newElementIds.length,17);
assert.equal(requests.filter(x=>x.endsWith('.glb')).length,0,'Catalog discovery must not request geometry');
const restored=loaded.structures.filter(p=>p.systems?.some(s=>s.startsWith('IS-A:')));assert.ok(restored.length>=477);
for(const kind of ['missing','corrupt']){fault=kind;clearCache();await assert.rejects(()=>api.loadIndex(ac.signal),kind==='missing'?/HTTP 404/:/integrity mismatch/)}fault='';
const repair=loaded.bundles.find(b=>b.id==='source-table-repairs');assert(repair);
const repaired=await api.loadBundle(repair,ac.signal);const repairOwners=[];repaired.scene.traverse(n=>{if(n.userData.semanticId)repairOwners.push(n.userData.semanticId)});
assert.deepEqual(repairOwners.sort(),['BP3D40_FJ1450','BP3D40_FJ1656']);api.disposeScene(repaired.scene);
for(const kind of ['missing-repair','corrupt-repair']){fault=kind;clearCache();await assert.rejects(()=>api.loadBundle(repair,ac.signal),kind==='missing-repair'?/HTTP 404/:/integrity mismatch/)}fault='';
const affected=loaded.sourceNative.concepts.filter(c=>c.relation==='PART_OF'&&c.atomIds.some(id=>['BP3D40:FJ1450','BP3D40:FJ1656'].includes(id)));
assert.equal(affected.length,27);for(const c of affected){assert.equal(c.scope,'EXACT_COMPOUND');assert.equal(c.missingElements.length,0);}
const female=await api.loadSourceCatalog(delta.sourceNative,ac.signal,'female-delta');assert.equal(female.atoms.length,60);assert.equal(female.concepts.length,1073);
const item=await api.loadBundle(delta,ac.signal,'female-delta');let owners=0;item.scene.traverse(n=>{if(n.userData.semanticId)owners++});assert.equal(owners,39);
const catalog={...female,atoms:female.atoms.map(labelFemaleRecord)};
const pair=[453,454].map((sourceNodeIndex,i)=>{
 const atom=catalog.atoms.find(record=>record.sourceNodeIndex===sourceNodeIndex);
 assert.equal(atom.label,['Right cardinal ligament','Left cardinal ligament'][i]);
 assert.equal(atom.sourceLabel,'Cardinal ligament');
 let mesh;item.scene.traverse(node=>{if(node.isMesh&&node.userData.sourceNodeIndex===sourceNodeIndex)mesh=node});
 assert.ok(mesh);
 return {mesh,atom};
});
const projection=createSourceSelectionProjection(),residents=new Map([[delta.id,item]]);
for(const member of pair){
 const mate=pair.find(record=>record!==member);
 const picked=sourceAtomAtHit(catalog,member.atom.ownerId,member.mesh,0);
 assert.equal(picked.id,member.atom.id);
 assert.equal(sourceAtomAtHit(catalog,mate.atom.ownerId,member.mesh,0),undefined);
 assert.equal(projection.apply(residents,{catalog,key:nativeComponentKey(picked.id),isolated:true,opacity:.4}).drawMeshes,1);
 assert.equal(member.mesh.visible,true);assert.equal(mate.mesh.visible,false);
}
projection.restore();assert.ok(pair.every(({mesh})=>mesh.visible));api.disposeScene(item.scene);
const invalid={...delta,sha256:'0'.repeat(64)};await assert.rejects(()=>api.loadBundle(invalid,ac.signal,'female-delta'),/integrity mismatch/);
const aborted=new AbortController();aborted.abort();await assert.rejects(()=>api.loadBundle(delta,aborted.signal,'female-delta'),{name:'AbortError'});
console.log(JSON.stringify({status:'PASS',indexSha256:pin,maleOwners:1205,maleAtoms:2299,historicalHeld:416,residualUnresolved:18,femaleSupplementOwners:39,femaleSupplementAtoms:60,catalogWithoutGeometry:true,repairedCompounds:affected.length,repairOwners,repairNegativePaths:['missing repair bundle','corrupt repair bundle'],negativePaths:['missing catalog','corrupted catalog','corrupted geometry','cancelled publication'],rssBytes:process.memoryUsage().rss,maxRssKiB:process.resourceUsage().maxRSS}));
