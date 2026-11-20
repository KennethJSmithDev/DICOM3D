import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {before, test} from 'node:test';
import {verifyVolume} from '../viewer/src/verified-volume.mjs';
import {prepareResearchR5Evidence} from './src/imaging/research-r5-loader.mjs';

const packet = process.env.DICOM3D_PUBLIC_H000_PACKET;
const binding = process.env.DICOM3D_PUBLIC_H000_BINDING;
const historical = process.env.DICOM3D_PUBLIC_H000_R5_EXPECTED;
const enabled = Boolean(packet && binding && historical);
let request, pixels, metadata, accepted, study, recorded;
before(async () => {
  if (!enabled) return;
  request = JSON.parse(await readFile(`${packet}/source-admission-request.json`, 'utf8'));
  const raw = await readFile(`${packet}/volume.raw16`);
  pixels = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  metadata = new Uint8Array(await readFile(binding));
  accepted = JSON.parse(await readFile(historical, 'utf8'));
  recorded = accepted.find(resource => resource.resourceType === 'Provenance').recorded;
  study = await verifyVolume(request.descriptor, pixels, {sourceEncoding: request.sourceEncoding});
});

const pageUrl = 'http://127.0.0.1:57980/DICOM3D/';
const expectedUrl = `${pageUrl}demo/h000/source-binding.json`;
function response(bytes = metadata, url = expectedUrl, options = {}) {
  return {
    ok: options.ok ?? true, url,
    headers: new Headers({'content-length': String(bytes.byteLength), ...options.headers}),
    body: new ReadableStream({start(controller) { controller.enqueue(bytes); controller.close(); }}),
  };
}
function input(overrides = {}) {
  return {study, sourceEncoding: request.sourceEncoding, generation: 1, currentGeneration: () => 1,
    appBase: '/DICOM3D/', pageUrl, recorded, ...overrides};
}

test('reuses the historical R5 graph through a fixed same-origin public binding', {skip: !enabled}, async () => {
  let calls = 0;
  const graph = await prepareResearchR5Evidence(input({fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, expectedUrl);
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.redirect, 'error');
    return response();
  }}));
  assert.equal(calls, 1);
  assert.deepEqual(graph.resources, accepted);
  assert.equal(graph.sourceMap.ctFrames.length, 103);
  assert.equal(graph.sourceMap.segFrames[64].segFrame, 65);
  assert.deepEqual(graph.resources.find(item => item.id === 'r5p-h000-segment-1').instance[0].subset, ['1']);
});

test('rejects unrelated verified studies before making any network request', {skip: !enabled}, async () => {
  const descriptor = structuredClone(request.descriptor);
  descriptor.source.studyIdentity = '1.2.3';
  const other = await verifyVolume(descriptor, pixels.slice(0), {sourceEncoding: request.sourceEncoding});
  let calls = 0;
  await assert.rejects(prepareResearchR5Evidence(input({study: other, fetchImpl: async () => { calls++; return response(); }})), {code: 'UNSUPPORTED_RESEARCH_SOURCE'});
  assert.equal(calls, 0);
});

test('rejects missing encoding, unverified volume, foreign bases and redirects', {skip: !enabled}, async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return response(); };
  await assert.rejects(prepareResearchR5Evidence(input({sourceEncoding: null, fetchImpl})), {code: 'SOURCE_ENCODING_REQUIRED'});
  await assert.rejects(prepareResearchR5Evidence(input({sourceEncoding: {...request.sourceEncoding, sopClassUid:'1.2.3'}, fetchImpl})), {code: 'SOURCE_ENCODING_REQUIRED'});
  await assert.rejects(prepareResearchR5Evidence(input({study: {}, fetchImpl})), {code: 'UNVERIFIED_VOLUME'});
  await assert.rejects(prepareResearchR5Evidence(input({appBase: 'https://elsewhere.invalid/', fetchImpl})));
  assert.equal(calls, 0);
  await assert.rejects(prepareResearchR5Evidence(input({fetchImpl: async () => response(metadata, 'http://elsewhere.invalid/')})), {code: 'BINDING_UNAVAILABLE'});
});

test('rejects altered public metadata, stale generation and cancellation', {skip: !enabled}, async () => {
  const damaged = metadata.slice(); damaged[100] ^= 1;
  await assert.rejects(prepareResearchR5Evidence(input({fetchImpl: async () => response(damaged)})));
  let generation = 1;
  await assert.rejects(prepareResearchR5Evidence(input({currentGeneration: () => generation,
    fetchImpl: async () => { generation++; return response(); }})), {code: 'STALE_GENERATION'});
  const abort = new AbortController(); abort.abort();
  await assert.rejects(prepareResearchR5Evidence(input({signal: abort.signal, fetchImpl: async () => response()})), {code: 'CANCELLED'});
});

test('rejects a volume mutated after admission without fetching or publishing a graph', {skip: !enabled}, async () => {
  let calls = 0;
  const previous = study.pixels[0];
  try {
    study.pixels[0] = previous ^ 1;
    await assert.rejects(prepareResearchR5Evidence(input({fetchImpl: async () => { calls++; return response(); }})), {code: 'SOURCE_INVALID'});
    assert.equal(calls, 0);
  } finally { study.pixels[0] = previous; }
  assert.equal(await study.assertSourceUnchanged(), true);
});

test('rejects a volume mutated while its public binding is fetched', {skip: !enabled}, async () => {
  const previous = study.pixels[0];
  try {
    await assert.rejects(prepareResearchR5Evidence(input({fetchImpl: async () => {
      study.pixels[0] = previous ^ 1;
      return response();
    }})), {code: 'SOURCE_INVALID'});
  } finally { study.pixels[0] = previous; }
  assert.equal(await study.assertSourceUnchanged(), true);
});

test('propagates cancellation to an in-flight public binding request', {skip: !enabled}, async () => {
  const abort = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = prepareResearchR5Evidence(input({signal: abort.signal, fetchImpl: async (_url, options) => {
    started();
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), {once: true}));
  }}));
  await ready;
  abort.abort();
  await assert.rejects(pending, /aborted/);
});
