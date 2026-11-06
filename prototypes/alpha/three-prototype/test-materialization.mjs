import assert from 'node:assert/strict';
import {introFrame,INTRO_DURATION_MS} from './src/materialization-state.mjs';
import {samplePublicReference} from './src/live-reference-samples.mjs';
assert.equal(INTRO_DURATION_MS,8000);assert.ok(INTRO_DURATION_MS<=10000);
assert.equal(introFrame(0).phase,'assembling');assert.equal(introFrame(6400).phase,'holographic');assert.equal(introFrame(8000).phase,'scientific');assert.ok(introFrame(8000).particles<1e-12);assert.equal(introFrame(0,true).phase,'scientific');
let previous=0;for(let ms=0;ms<=8000;ms+=50){const f=introFrame(ms);assert.ok(f.reveal>=previous);previous=f.reveal}
const positions=new Float32Array([0,0,0,1,2,3,-1,1,0]),before=positions.slice(),world=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const groups=[{id:'source-owner',parts:[{world,bounds:{min:[-1,0,0],max:[1,2,3]},geometry:()=>({positions})}]}];
const a=samplePublicReference(groups,2048),b=samplePublicReference(groups,2048);assert.deepEqual(a.data,b.data);assert.deepEqual(positions,before);assert.equal(a.counts[0],2048);
console.log('PASS live deterministic sampler, unchanged source positions, monotonic layers, eight-second endpoint and reduced-motion endpoint');
