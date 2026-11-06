import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {smoothCoincidentNormals} from './smooth-display-normals.js';
const positions=new Float32Array([0,0,0,1,0,0,0,1,0, 0,0,0,0,0,1,1,0,0]);
const nativeNormals=new Float32Array([0,0,1,0,0,1,0,0,1, 0,1,0,0,1,0,0,1,0]);
const hash=values=>createHash('sha256').update(new Uint8Array(values.buffer,values.byteOffset,values.byteLength)).digest('hex');
const positionHash=hash(positions),nativeHash=hash(nativeNormals),smoothed=smoothCoincidentNormals(positions,nativeNormals);
assert.equal(hash(positions),positionHash);assert.equal(hash(nativeNormals),nativeHash);assert.equal(smoothed.length,nativeNormals.length);
for(let i=0;i<smoothed.length;i+=3)assert(Math.abs(Math.hypot(...smoothed.slice(i,i+3))-1)<1e-6);
assert.deepEqual([...smoothed.slice(0,3)],[...smoothed.slice(9,12)]);assert(Math.abs(smoothed[1]-Math.SQRT1_2)<1e-6);assert(Math.abs(smoothed[2]-Math.SQRT1_2)<1e-6);
// Distinct representable positions must not be merged by a rounded spatial key.
const near=new Float32Array([1,0,0,1+2**-23,0,0]),different=new Float32Array([1,0,0,0,1,0]);assert.deepEqual([...smoothCoincidentNormals(near,different)],[...different]);
console.log(JSON.stringify({pass:true,positionSha256:positionHash,vertices:positions.length/3,checks:['position hash unchanged','native normals unchanged','vertex count unchanged','unit display normals','exact coincidence averaging','distinct Float32 positions retained']}));
