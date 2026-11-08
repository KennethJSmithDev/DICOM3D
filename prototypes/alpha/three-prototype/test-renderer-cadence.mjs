import assert from 'node:assert/strict';
import {ownRendererCadence} from './src/renderer-cadence.js';
let stopped=0,updates=0,resets=0;
const renderer={_animation:{stop(){stopped++}},_nodes:{nodeFrame:{frameId:0,update(){updates++;this.frameId++}}},info:{autoReset:true,reset(){resets++}}};
const lease=ownRendererCadence(renderer);assert.equal(stopped,1);assert.equal(updates,0);assert.throws(()=>ownRendererCadence(renderer),/already owned/);
lease.beforeDraw();lease.beforeDraw();assert.equal(updates,2);assert.equal(resets,2);assert.equal(renderer.info.frame,2);lease.dispose();lease.dispose();lease.beforeDraw();assert.equal(stopped,2);assert.equal(updates,2);assert.throws(()=>ownRendererCadence({}),/Unsupported/);
console.log('PASS: pinned bookkeeping ownership, one update per requested draw, no idle update, idempotent disposal and incompatible API rejection');
