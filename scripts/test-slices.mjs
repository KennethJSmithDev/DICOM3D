import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fixtureGeometry,deriveSlices,slicesGlb,triangleArea,FIXTURE_SHA,createSliceState,updateSlice,setGap,resetSlice,resetAll,slicePose} from '../viewer/src/slices.mjs';
const data=readFileSync(new URL('../demo/public/sample/study.glb',import.meta.url));
const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.length),hash=()=>createHash('sha256').update(data).digest('hex');
assert.equal(hash(),FIXTURE_SHA);
const {positions,indices}=fixtureGeometry(bytes),before=JSON.stringify({positions,indices}),slices=deriveSlices(positions,indices);
assert.equal(slices.length,5);assert.equal(new Set(slices.map(s=>s.id)).size,5);
assert.deepEqual(slices,deriveSlices(positions,indices));
const areaByTriangle=new Array(20).fill(0);
for(const s of slices)for(let i=0;i<s.positions.length;i+=9){
 const p=[0,1,2].map(j=>s.positions.slice(i+j*3,i+j*3+3).map((v,k)=>v+s.origin[k]));
 p.forEach(v=>assert(v[1]>=s.lower-1e-12&&v[1]<=s.upper+1e-12));
 areaByTriangle[s.sourceTriangles[i/9]]+=triangleArea(...p);
 const original=indices.slice(s.sourceTriangles[i/9]*3,s.sourceTriangles[i/9]*3+3).map(j=>positions.slice(j*3,j*3+3));
 const normal=t=>{const a=t[1].map((v,k)=>v-t[0][k]),b=t[2].map((v,k)=>v-t[0][k]);return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];};
 assert(normal(p).reduce((sum,v,k)=>sum+v*normal(original)[k],0)>0,'winding preserved');
}
for(let i=0;i<20;i++){const p=indices.slice(i*3,i*3+3).map(j=>positions.slice(j*3,j*3+3));assert(Math.abs(areaByTriangle[i]-triangleArea(...p))<1e-12);}
assert.equal(JSON.stringify({positions,indices}),before);assert.equal(hash(),FIXTURE_SHA);
assert.deepEqual(new Uint8Array(slicesGlb(slices)),new Uint8Array(slicesGlb(slices)));
const state=createSliceState(slices),baseline=JSON.stringify(state),id=slices[2].id,other=JSON.stringify(state.items[1]);
updateSlice(state,id,{offset:[.01,.02,-.01],rotation:Math.PI/2,visible:false,opacity:.3});
assert.equal(JSON.stringify(state.items[1]),other);assert.equal(slicePose(slices[2],state).visible,false);
resetSlice(state,id);assert.equal(JSON.stringify(state),baseline);
for(let i=0;i<1000;i++){setGap(state,.05);setGap(state,0);}assert.equal(JSON.stringify(state),baseline);
setGap(state,.02);updateSlice(state,id,{offset:[.01,.02,0]});assert.equal(slicePose(slices[2],state).position[1],slices[2].origin[1]+.02);
assert(slicePose(slices[0],state).position[1]<slicePose(slices[4],state).position[1]);
state.isolate=true;assert.equal(slicePose(slices[0],state).visible,false);assert.equal(slicePose(slices[2],state).visible,true);
assert.throws(()=>setGap(state,Infinity));assert.throws(()=>updateSlice(state,'unknown',{}));assert.throws(()=>updateSlice(state,id,{offset:[1,0,0]}));
assert.throws(()=>updateSlice(state,id,{opacity:0}));resetAll(state);assert.equal(JSON.stringify(state),baseline);
const cost={sourceVertices:12,sourceTriangles:20,slices:5,derivedVertices:slices.reduce((a,s)=>a+s.positions.length/3,0),derivedTriangles:slices.reduce((a,s)=>a+s.positions.length/9,0),derivedGlbBytes:slicesGlb(slices).byteLength,sourceHash:hash()};
console.log('PASS B/C/D: deterministic partition/area/source integrity; independent state; reversible composition',JSON.stringify(cost));
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(cost,null,2));
