import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {loadFetalBrain,renderBrainSlice,readBrainPixel} from './src/imaging/fetal-mri/fetal-brain.mjs';

import {sourcePlaneCorners} from './src/imaging/fetal-mri/source-plane.mjs';

async function source(url,size,hash) {
  const bytes=await readFile(new URL(url));
  assert.equal(bytes.length,size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  return bytes;
}

test('GA22 source grid, tissue key, three plane readback and presentation independence',async()=>{
  const brain=await loadFetalBrain({getAsset:source});
  assert.deepEqual(brain.bounds,[[36,103],[49,129],[55,119]]);
  assert.deepEqual(brain.centers,[70,89,87]);
  assert.equal(brain.tissues.length,32);
  assert.equal(brain.tissues.reduce((n,t)=>n+t.count,0),174514);
  assert.deepEqual(brain.byId.get(37),{id:37,name:'Hippocampus_L',rgb:[255,147,230],count:679});
  assert.ok(brain.signedSpacingRasMm[0]<0 && brain.signedSpacingRasMm[1]<0 && brain.signedSpacingRasMm[2]>0);
  const configs=[
    ['axial',87,68,81,34,40],
    ['sagittal',70,81,65,40,32],
    ['coronal',89,68,65,34,32],
  ];
  const center=70+135*(89+189*87);
  for (const [axis,index,width,height,x,y] of configs) {
    const spec={axis,index,x,y};
    const pixel=readBrainPixel(brain,spec);
    assert.deepEqual(pixel.ijk,[70,89,87]);
    assert.equal(pixel.id,brain.labels[center]);
    assert.equal(pixel.value,brain.values[center]);
    const gray=renderBrainSlice(brain,{axis,index,opacity:0});
    assert.deepEqual([gray.width,gray.height],[width,height]);
    const corners=sourcePlaneCorners(brain,axis,index,width,height);
    for (const [px,py] of [[0,0],[width-1,height-1],[x,y]]) {
      const ijk=readBrainPixel(brain,{axis,index,x:px,y:py}).ijk;
      const ras=ijk.map((v,i)=>brain.originRasMm[i]+brain.signedSpacingRasMm[i]*v);
      const expected=[ras[0],ras[2],-ras[1]];
      for(let i=0;i<3;i++){
        const world=corners[i]+(px+.5)/width*(corners[3+i]-corners[i])+(py+.5)/height*(corners[6+i]-corners[i]);
        assert.ok(Math.abs(world-expected[i])<.00001,axis+' source pixel center');
      }
    }
    const offset=(x+y*width)*4;
    const level=Math.min(255,Math.max(0,Math.round(pixel.value*255/100)));
    assert.deepEqual([...gray.rgba.slice(offset,offset+4)],[level,level,level,255]);
    const overlay=renderBrainSlice(brain,{axis,index,opacity:1,highlightId:pixel.id});
    assert.deepEqual([...overlay.rgba.slice(offset,offset+4)],[...brain.byId.get(pixel.id).rgb,255]);
    assert.deepEqual(readBrainPixel(brain,spec),pixel);
  }
  assert.throws(()=>renderBrainSlice(brain,{axis:'sagittal',index:-1}),RangeError);
  assert.throws(()=>renderBrainSlice(brain,{axis:'axial',index:87,highlightId:999}),RangeError);
  assert.throws(()=>readBrainPixel(brain,{axis:'coronal',index:89,x:-1,y:0}),RangeError);
});

test('shifted mask and cancelled source reads are rejected',async()=>{
  await assert.rejects(loadFetalBrain({getAsset:async(url,size,hash)=>{
    const result=await source(url,size,hash);
    if (!url.includes('tissue.nii')) return result;
    const bytes=gunzipSync(result);
    bytes.writeFloatLE(56,268);
    return gzipSync(bytes);
  }}),/spatial transform/);
  await assert.rejects(loadFetalBrain({signal:AbortSignal.abort(),getAsset:()=>assert.fail()}),{name:'AbortError'});
});
