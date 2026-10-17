import assert from 'node:assert/strict';
import {worldBounds,fitDistance} from '../viewer/src/camera-fit.mjs';
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const mesh={boundMin:[-1,-2,-3],boundMax:[1,2,3],worldMatrix:[...identity]};
mesh.worldMatrix[12]=100;mesh.worldMatrix[13]=-50;
const before=JSON.stringify(mesh),bounds=worldBounds([mesh]);
assert.deepEqual(bounds.center,[100,-50,0]);assert.equal(JSON.stringify(mesh),before);
assert.deepEqual(bounds.min,[99,-52,-3]);assert.deepEqual(bounds.max,[101,-48,3]);
const rotated={...mesh,worldMatrix:[0,1,0,0,-1,0,0,0,0,0,1,0,100,-50,0,1]};
assert.deepEqual(worldBounds([rotated]).min,[98,-51,-3]);
assert.equal(worldBounds([]),null);
for(const aspect of [.2,.46,1,2,5]) {
 const distance=fitDistance(bounds,.8,aspect),angle=Math.min(.4,Math.atan(Math.tan(.4)*aspect));
 assert(distance*Math.sin(angle)>bounds.radius,'entire bounding sphere fits both axes with margin');
}
assert(fitDistance(bounds,.8,.2)>fitDistance(bounds,.8,2),'portrait gets larger distance');
assert.throws(()=>fitDistance(bounds,.8,0));
assert.throws(()=>fitDistance(null,.8,1));
console.log('PASS camera: translated/rotated world bounds, non-origin center, aspect-aware sphere fit, no model mutation');
