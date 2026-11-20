import assert from 'node:assert/strict';
import {introFrame,INTRO_DURATION_MS} from './src/materialization-state.mjs';
import {samplePublicReference,groupsWithinSampleBudget} from './src/live-reference-samples.mjs';
assert.equal(INTRO_DURATION_MS,8000);assert.ok(INTRO_DURATION_MS<=10000);
assert.equal(introFrame(0).phase,'assembling');assert.equal(introFrame(6400).phase,'holographic');assert.equal(introFrame(8000).phase,'scientific');assert.ok(introFrame(8000).particles<1e-12);assert.equal(introFrame(0,true).phase,'scientific');
let previous=0;for(let ms=0;ms<=8000;ms+=50){const f=introFrame(ms);assert.ok(f.reveal>=previous);previous=f.reveal}
const positions=new Float32Array([0,0,0,1,2,3,-1,1,0]),before=positions.slice(),world=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const groups=[{id:'source-owner',parts:[{world,bounds:{min:[-1,0,0],max:[1,2,3]},geometry:()=>({positions})}]}];
const a=samplePublicReference(groups,2048),b=samplePublicReference(groups,2048);assert.deepEqual(a.data,b.data);assert.deepEqual(positions,before);assert.equal(a.counts[0],2048);
const expanded=Array.from({length:655},(_,i)=>({id:`owner-${i}`,parts:groups[0].parts}));
const limited=groupsWithinSampleBudget(expanded,512);
assert.equal(limited.length,512);assert.equal(new Set(limited.map(g=>g.id)).size,512);
assert.equal(limited[0].id,'owner-0');assert.ok(Number(limited.at(-1).id.slice(6))>=653);
assert.deepEqual(limited,groupsWithinSampleBudget(expanded,512));
assert.equal(groupsWithinSampleBudget(groups,512),groups);
assert.throws(()=>groupsWithinSampleBudget(expanded,0),/Invalid reference sample budget/);
const low=samplePublicReference(limited,512);assert.equal(low.data.length,512*8);assert.equal(low.counts.reduce((x,y)=>x+y,0),512);
assert.deepEqual(positions,before);assert.equal(expanded.length,655);
console.log('PASS live deterministic sampler, unchanged source positions, monotonic layers, eight-second endpoint and reduced-motion endpoint');
