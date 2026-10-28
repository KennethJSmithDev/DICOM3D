import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReferenceLayers} from '../viewer/src/reference-layers.mjs';
const results=[];
for(const asset of ['bp3d-male','hra-female']){
 const manifest=JSON.parse(readFileSync(new URL(`../reference/public/reference/${asset}.manifest.json`,import.meta.url)));
 const parts=manifest.reference.structures,before=JSON.stringify(parts),layers=createReferenceLayers(parts),base={hidden:new Set(),opacity:new Map(),selected:null,isolate:false};
 const declared=layers.snapshot();let checks=0;
 // Independent expected membership comes directly from immutable manifest strings.
 for(const system of declared.systems){
  const expected=parts.filter(p=>(p.systems??[]).includes(system.name)).map(p=>p.id).sort();
  assert.deepEqual([...system.owners].sort(),expected);checks++;
  layers.set(system.name,{visible:false,opacity:.25});let actual=layers.effective(base);
  assert.deepEqual([...actual.hidden].sort(),expected);checks++;
  for(const p of parts){assert.equal(actual.opacity.get(p.id),expected.includes(p.id)?.25:1);checks++;}
  layers.set(system.name,{locked:true});assert.equal(layers.effective(base).hidden.size,0);checks++;
  for(const id of expected)assert.equal(layers.effective(base).opacity.get(id),undefined);
  layers.restore();
 }
 layers.peel(true);assert.deepEqual([...layers.effective(base).hidden].sort(),parts.filter(p=>p.skin===true).map(p=>p.id).sort());checks++;
 const skinSystem=declared.systems.find(s=>s.owners.includes(declared.skin[0]));
 if(skinSystem){layers.set(skinSystem.name,{locked:true});assert.equal(layers.effective(base).hidden.has(declared.skin[0]),false);checks++;}
 const independent={...base,hidden:new Set([parts[1].id]),opacity:new Map([[parts[1].id,.5]]),selected:parts[1].id,isolate:true};
 layers.restore();assert.deepEqual(layers.effective(independent).hidden,independent.hidden);assert.equal(layers.effective(independent).opacity.get(parts[1].id),.5);checks+=2;
 assert.throws(()=>layers.set('Invented system',{visible:false}));assert.throws(()=>layers.set(declared.systems[0].name,{opacity:NaN}));checks+=2;
 assert.equal(JSON.stringify(parts),before);assert.equal(parts.length,asset==='bp3d-male'?386:380);checks+=2;
 const ambiguous=declared.unclassified;for(const s of declared.systems)layers.set(s.name,{visible:false});for(const id of ambiguous){assert.equal(layers.effective(base).hidden.has(id),false);checks++;}
 results.push({asset,owners:parts.length,systems:declared.systems.length,unclassified:ambiguous.length,overlapping:declared.overlapping.length,checks});
}
// Shared-owner precedence is exercised separately from any particular atlas topology.
const overlap=createReferenceLayers([{id:'a',systems:['one system','two system'],skin:true}]);
overlap.set('one system',{visible:false,opacity:.2});overlap.set('two system',{locked:true});
assert.equal(overlap.effective({hidden:new Set(),opacity:new Map()}).hidden.size,0);
overlap.peel(true);assert.equal(overlap.effective({hidden:new Set(),opacity:new Map()}).hidden.size,0);
console.log(JSON.stringify({status:'PASS',results,scope:'Pure policy, exact manifest membership, immutable sources; browser separately qualified'},null,2));
