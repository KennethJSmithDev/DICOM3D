import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const folder = new URL('./src/placenta/development/', import.meta.url);

test('NIH Carnegie stage 20 GLB contains one unmodified specimen surface', async () => {
  const file = await readFile(new URL('carnegie-stage20.glb', folder));
  assert.equal(file.length, 8693412);
  assert.equal(createHash('sha256').update(file).digest('hex'), 'db01df5a04b16fe6fa175d1e3605d883a0ab5cb8113592e96b6b8fc0bb58a6dc');
  const {scene} = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const meshes = [];
  scene.traverse(node => { if (node.isMesh) meshes.push(node); });
  assert.equal(meshes.length, 1);
  assert.equal(meshes[0].geometry.index.count, 103500 * 3);
  meshes[0].geometry.dispose();
  meshes[0].material.dispose();
});

test('fetal illustration retains its independent NIH source pixels', async () => {
  const file = await readFile(new URL('fetus-in-uterus.png', folder));
  assert.equal(createHash('sha256').update(file).digest('hex'), 'a079aa76aa413be67d189fbbc9a930286742668c50d32f45be51264946c27cf3');
  assert.deepEqual([file.readUInt32BE(16), file.readUInt32BE(20)], [1240,1933]);
});
