import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {inspectPlacenta, placentaAsset, showPlacentaSelection} from './src/placenta/placenta-model.mjs';
import {ownScene, releaseScene, sceneOwnership} from './src/scene-ownership.js';
import {ultrasoundExamples} from './src/placenta/ultrasound-examples.mjs';
import {h001PelvicOwners} from './src/imaging/h001-pelvic-owners.mjs';

test('H001 reference navigation targets six distinct admitted reproductive owners', async()=>{
  const descriptor=JSON.parse(await readFile(new URL('./atlas-delta/female-delta.json',import.meta.url)));
  const manifest=JSON.parse(await readFile(new URL('./atlas-delta/'+descriptor.manifestUrl,import.meta.url)));
  assert.equal(new Set(h001PelvicOwners.map(([id])=>id)).size,6);
  for(const [id,label] of h001PelvicOwners){
    assert.ok(descriptor.structureIds.includes(id));
    assert.equal(manifest.reference.structures.find(part=>part.id===id)?.label,label);
  }
});

test('published ultrasound case links each caption to its original JPEG figure', async () => {
  const figures = {
    twins:'8b534c82a9b49fb19d642cb873a7fbb6c8d5df7aa67c5b7439e30ba4cc776892',
    fibroid:'95b10c2e1e16c5a92721c157f54144ac0150ae2c3e8593972a60393de7bab03c',
  };
  assert.deepEqual(ultrasoundExamples.map(item=>item.id), Object.keys(figures));
  for (const item of ultrasoundExamples) {
    const bytes = await readFile(new URL(item.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), figures[item.id]);
    assert.equal(item.source,'https://doi.org/10.7759/cureus.113224');
    assert.equal(item.licenseUrl,'https://creativecommons.org/licenses/by/4.0/');
    assert.ok(item.alt && item.caption && item.author);
  }
});

test('standalone HRA source hierarchy, isolation, restoration and disposal', async () => {
  const data = await readFile(new URL('./src/placenta/hra-full-term.glb', import.meta.url));
  assert.equal(data.length, placentaAsset.bytes);
  assert.equal(createHash('sha256').update(data).digest('hex'), placentaAsset.sha256);
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(data).buffer, '');
  const baseline = {...sceneOwnership};
  const scene = ownScene(gltf.scene);
  const parts = inspectPlacenta(scene);
  assert.equal(sceneOwnership.geometries - baseline.geometries, 8);
  const meshes = parts[0].members;
  for (const part of parts) {
    showPlacentaSelection(parts, part.id, true);
    const visible = meshes.filter(mesh => mesh.visible).map(mesh => mesh.userData.sourceKey);
    const expected = part.id === 'HRA:421' ? [422,423,424,425,427,428,429,430] :
      part.id === 'HRA:426' ? [427,428,429,430] : [Number(part.id.slice(4))];
    assert.deepEqual(visible, expected.map(number => 'HRA:'+number));
  }
  showPlacentaSelection(parts, 'HRA:429', false);
  assert.equal(meshes.filter(mesh => mesh.visible).length, 8);
  assert.throws(() => showPlacentaSelection(parts, 'HRA:999', true));
  assert.equal(releaseScene(scene), true);
  assert.deepEqual(sceneOwnership, baseline);
});
