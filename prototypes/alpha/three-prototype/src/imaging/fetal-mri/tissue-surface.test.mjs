import assert from 'node:assert/strict';
import test from 'node:test';
import {tissueSurface} from './tissue-surface.mjs';

test('touching labels share the outer boundary; isolation restores the hidden interface',()=>{
  const volume={dims:[2,1,1],spacingMm:[2,2,2],originRasMm:[8,12,20],
    labels:new Uint16Array([112,113]),byId:new Map([[112,{rgb:[255,0,0]}],[113,{rgb:[0,0,255]}]])};
  const both=tissueSurface(volume),left=tissueSurface(volume,112);
  assert.equal(both.owners.length,10);
  assert.equal(left.owners.length,6);
  assert.deepEqual([...new Set(left.owners)],[112]);
  assert.deepEqual([...new Set(both.owners)],[112,113]);
  const xs=left.positions.filter((_,i)=>i%3===0);
  assert.deepEqual([Math.min(...xs),Math.max(...xs)],[7,9]);
  for (let i=0;i<both.indices.length;i+=3) {
    const pts=Array.from(both.indices.slice(i,i+3),j=>both.positions.slice(j*3,j*3+3));
    const a=pts[1].map((v,k)=>v-pts[0][k]),b=pts[2].map((v,k)=>v-pts[0][k]);
    const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const n=both.normals.slice(both.indices[i]*3,both.indices[i]*3+3);
    assert.ok(cross.reduce((s,v,k)=>s+v*n[k],0)>0);
  }
});
