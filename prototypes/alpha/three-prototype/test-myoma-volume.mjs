import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {loadMyoma,renderMyomaSlice,readMyomaPixel,myomaPlaneCorners} from './src/imaging/myoma/myoma-volume.mjs';

async function getAsset(url,size,hash){
  const bytes=await readFile(new URL(url));
  assert.equal(bytes.length,size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  return bytes;
}

test('UMD original grid, source values, labels and display planes agree',async()=>{
  const v=await loadMyoma({getAsset});
  assert.deepEqual(v.dims,[672,672,20]);
  assert.deepEqual(v.tissues.map(t=>t.count),[69765,4628,1296,90]);
  assert.equal(v.myomaCountsByK[4],1125);
  assert.equal(Math.max(...v.myomaCountsByK),1125);
  const center=v.centers;
  for(const [axis,d,h,j] of [['sagittal',2,0,1],['coronal',0,2,1],['axial',1,0,2]]){
    const index=center[d],x=center[h]-v.bounds[h][0],y=center[j]-v.bounds[j][0];
    const picked=readMyomaPixel(v,{axis,index,x,y});
    assert.deepEqual(picked,{ijk:center,id:3,value:125,name:'Myoma'});
    const gray=renderMyomaSlice(v,{axis,index,opacity:0});
    const slice=renderMyomaSlice(v,{axis,index,highlightId:3,opacity:1});
    const offset=4*(x+y*slice.width);
    assert.deepEqual([...slice.rgba.slice(offset,offset+4)],[255,132,62,255]);
    assert.deepEqual([...gray.rgba.slice(offset,offset+4)],[45,45,45,255]);
    assert.equal(slice.displayWidthMm,slice.width*v.spacingMm[h]);
    assert.equal(slice.displayHeightMm,slice.height*v.spacingMm[j]);
    const corners=myomaPlaneCorners(v,{axis,index});
    const distance=i=>Math.hypot(...[0,1,2].map(a=>corners[i+a]-corners[a]));
    assert.ok(Math.abs(distance(3)-slice.displayWidthMm)<0.00005);
    assert.ok(Math.abs(distance(6)-slice.displayHeightMm)<0.00005);
    // Barycentric position at the exact pixel center must agree with the oblique source qform.
    const ras=v.affineRasMm.map(r=>r[3]+r[0]*center[0]+r[1]*center[1]+r[2]*center[2]);
    for(const [a,c] of [ras[0],ras[2],-ras[1]].entries()){
      const point=corners[a]+(corners[3+a]-corners[a])*(x+.5)/slice.width+
        (corners[6+a]-corners[a])*(y+.5)/slice.height;
      assert.ok(Math.abs(point-c)<0.00005);
    }
  }
  assert.throws(()=>renderMyomaSlice(v,{axis:'sagittal',index:21}),RangeError);
  assert.throws(()=>readMyomaPixel(v,{axis:'axial',index:287,x:-1,y:0}),RangeError);
});

test('UMD rejects mismatched origin and cancelled loading',async()=>{
  await assert.rejects(loadMyoma({getAsset:async(url,size,hash)=>{
    const bytes=await getAsset(url,size,hash);
    if(!url.includes('_seg'))return bytes;
    const raw=gunzipSync(bytes);raw.writeFloatLE(19,268);
    return gzipSync(raw);
  }}),/transforms differ/);
  await assert.rejects(loadMyoma({signal:AbortSignal.abort(),getAsset:()=>assert.fail()}),{name:'AbortError'});
});
