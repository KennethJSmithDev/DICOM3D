import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Mesh,BufferGeometry,Float32BufferAttribute,MeshBasicMaterial,Group} from 'three';
import {nativeComponentKey,nativeRecord,nativeAtoms,sourceAtomAtHit,createSourceSelectionProjection,composeSourceCatalog} from '../src/source-native-selection.js';
const male=JSON.parse(await readFile(new URL('../expanded-atlas/source-native.json',import.meta.url)));
const hra=JSON.parse(await readFile(new URL('../atlas-delta/female-source-native.json',import.meta.url)));
const female=composeSourceCatalog(male,hra,new Set(['FMA15900','FMA9600','FMA19667','FMA7211','FMA7212','FMA21385','FMA21386','FMA20818','FMA20819']));
let checks=0;
for(const catalog of [male,female]){
 assert.equal(new Set(catalog.atoms.map(a=>a.id)).size,catalog.atoms.length);
 for(const key of [...catalog.concepts.map(c=>c.key),...catalog.atoms.map(a=>nativeComponentKey(a.id)),'MISSING']){
  const expected=key.startsWith('ELEMENT:')?catalog.atoms.find(a=>a.id===key.slice(8)):catalog.concepts.find(c=>c.key===key)||catalog.atoms.find(a=>a.id===key);
  assert.equal(nativeRecord(catalog,key),expected);
  const ids=new Set(expected?.atomIds||[expected?.id]);
  const actual=nativeAtoms(catalog,key),ordered=catalog.atoms.filter(a=>ids.has(a.id));
  assert.deepEqual(actual,ordered);actual.forEach((a,i)=>assert.equal(a,ordered[i]));
  actual.length=0;assert.deepEqual(nativeAtoms(catalog,key),ordered,'Caller cannot mutate cached membership');checks++;
 }
}
const collisions=hra.atoms.filter(a=>hra.concepts.some(c=>c.key===a.id));assert(collisions.length>0);
for(const atom of hra.atoms){
 const node={userData:{sourceNodeIndex:atom.sourceNodeIndex}};
 assert.equal(sourceAtomAtHit(female,atom.ownerId,node,0),atom);
 assert.equal(nativeRecord(female,nativeComponentKey(atom.id)),atom);
 assert.deepEqual(nativeAtoms(female,nativeComponentKey(atom.id)),[atom]);checks++;
}
// A collision with a genuinely wider compound must not select its other mesh.
const atom={id:'HRA:1',ownerId:'ovary',sourceNodeIndex:1};
const other={id:'HRA:2',ownerId:'ovary',sourceNodeIndex:2};
const catalog={atoms:[atom,other],concepts:[{key:'HRA:1',id:'compound',scope:'EXACT_COMPOUND',atomIds:[atom.id,other.id]}]};
const scene=new Group(),owner=new Group();owner.userData.semanticId='ovary';scene.add(owner);
for(const a of catalog.atoms){const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));const mesh=new Mesh(geo,new MeshBasicMaterial());mesh.userData.sourceNodeIndex=a.sourceNodeIndex;owner.add(mesh);}
const bundles=new Map([['hra',{scene}]]),projection=createSourceSelectionProjection();
assert.equal(projection.apply(bundles,{catalog,key:'HRA:1',isolated:true}).drawMeshes,2);
const hit=sourceAtomAtHit(catalog,'ovary',owner.children[0],0);
const selected=projection.apply(bundles,{catalog,key:nativeComponentKey(hit.id),isolated:true,opacity:.35});
assert.equal(selected.scope,'EXACT_COMPONENT');assert.equal(selected.drawMeshes,1);assert.equal(selected.opacity,.35);
assert.equal(owner.children[0].visible,true);assert.equal(owner.children[1].visible,false);
projection.restore();assert(owner.children.every(n=>n.visible));owner.children.forEach(n=>{n.geometry.dispose();n.material.dispose()});
const revised={atoms:[{...atom,label:'replacement'}],concepts:[]};assert.equal(nativeRecord(revised,nativeComponentKey(atom.id)).label,'replacement');
console.log(JSON.stringify({status:'PASS',orderedLookupCases:checks,hraComponents:hra.atoms.length,hraCollisions:collisions.length,collisionIsolation:true,originalIdsPreserved:true,catalogReplacement:true,maxRssKiB:process.resourceUsage().maxRSS}));
