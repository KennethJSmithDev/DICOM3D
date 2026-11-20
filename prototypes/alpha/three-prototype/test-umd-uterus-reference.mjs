import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadMyoma} from './src/imaging/myoma/myoma-volume.mjs';
import {placeUterusReference} from './src/imaging/myoma/umd-uterus-placement.mjs';
import {ownScene,cloneOwnedScene,releaseScene,sceneOwnership} from './src/scene-ownership.js';

test('HRA uterine owner retains physical dimensions and placement across separate MRI and atlas leases',async()=>{
  const root=new URL('./atlas-delta/',import.meta.url);
  const descriptor=JSON.parse(await readFile(new URL('female-delta.json',root)));
  const blob=await readFile(new URL(descriptor.url,root));
  assert.equal(createHash('sha256').update(blob).digest('hex'),descriptor.sha256);
  const volume=await loadMyoma({getAsset:url=>readFile(new URL(url))});
  const {scene}=await new GLTFLoader().parseAsync(blob.buffer.slice(blob.byteOffset,blob.byteOffset+blob.byteLength),'');
  const baseline={...sceneOwnership};
  ownScene(scene);
  const lease=cloneOwnedScene(scene),other=cloneOwnedScene(scene);
  try{
    const group=placeUterusReference(lease,volume);
    const displayBox=new Box3().setFromObject(group,true);
    const srcBox=new Box3().setFromObject(lease.getObjectByName('VH_F_uterus'),true);
    assert.ok(displayBox.getSize(new Vector3()).distanceTo(srcBox.getSize(new Vector3()).multiplyScalar(1000))<1e-7);
    const expected=new Box3(),m=volume.affineRasMm;
    // Independent full-lattice walk, outside the UI crop and its nested traversal.
    for(let i=0;i<volume.labels.length;i++){
      if(volume.labels[i]!==1)continue;
      const x=i%672,y=Math.floor(i/672)%672,z=Math.floor(i/(672*672));
      const [r,a,s]=m.map(row=>row[0]*x+row[1]*y+row[2]*z+row[3]);
      expected.expandByPoint(new Vector3(r,s,-a));
    }
    assert.ok(displayBox.getCenter(new Vector3()).distanceTo(expected.getCenter(new Vector3()))<1e-7);
    const fundus=group.getObjectByName('VH_F_fundus_of_uterus');
    assert.ok(fundus && !group.getObjectByName('VH_F_left_ovary'));
    assert.equal(fundus.geometry,other.getObjectByName(fundus.name).geometry);
    assert.notEqual(fundus.material,other.getObjectByName(fundus.name).material);
    const old=other.getObjectByName(fundus.name).material.opacity;
    fundus.material.opacity=.15;
    assert.equal(other.getObjectByName(fundus.name).material.opacity,old);
    assert.equal(fundus.raycast(),null);
    const left=lease.getObjectByName('VH_F_left_ovary');
    left.name='missing-source-marker';
    assert.throws(()=>placeUterusReference(lease,volume),/landmark/);
  }finally{
    for(const item of [lease,other,scene])releaseScene(item);
  }
  assert.deepEqual(sceneOwnership,baseline);
});
