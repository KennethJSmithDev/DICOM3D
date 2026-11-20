import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readLocalFhirCapabilities, readPublicFhirCapabilities, summarizeCapabilityStatement} from './src/imaging/fhir-capabilities.mjs';
import {MAX_CAPABILITY_BYTES} from '../viewer/src/fhir-capability-model.mjs';
import {boundedTestReader, SMART_TEST} from '../viewer/src/connect-read.mjs';

const source = {
  resourceType: 'CapabilityStatement', fhirVersion: '4.0.1', kind: 'instance',
  rest: [
    {mode: 'server', interaction: [{code: 'transaction'}], resource: [
      {type: 'ImagingStudy', interaction: [{code: 'search-type'}, {code: 'read'}, {code: 'read'}]},
      {type: 'DiagnosticReport'},
    ]},
    {mode: 'client', resource: [{type: 'Observation', interaction: [{code: 'read'}]}]},
  ],
  description: 'Synthetic metadata; no patient information.',
};

test('projects declared resource and system interactions without inventing capabilities', () => {
  const before = JSON.stringify(source);
  const result = summarizeCapabilityStatement(source);
  assert.deepEqual(result, {fhirVersion: '4.0.1', kind: 'instance',
    systems: [{mode: 'server', interactions: ['transaction']}, {mode: 'client', interactions: []}],
    resources: [{mode: 'server', type: 'ImagingStudy', interactions: ['read', 'search-type']},
      {mode: 'server', type: 'DiagnosticReport', interactions: []},
      {mode: 'client', type: 'Observation', interactions: ['read']}]});
  assert.equal(JSON.stringify(source), before);
  assert.equal('description' in result, false);
});

test('supports R4B and R5 without relabeling, including empty optional REST data', () => {
  for (const version of ['4.3.0', '5.0.0']) assert.deepEqual(summarizeCapabilityStatement({resourceType: 'CapabilityStatement', fhirVersion: version, kind: 'requirements'}),
    {fhirVersion: version, kind: 'requirements', systems: [], resources: []});
});

test('rejects invalid resource, versions, statement kinds and modes', () => {
  for (const statement of [null, {}, {...source, resourceType:'Patient'}, {...source, fhirVersion:'4.2.0'},
    {...source, kind:'unknown'}, {...source, rest:[{mode:'invalid'}]},
    {...source, rest:[{mode:'server', resource:[{type:'../Patient'}]}]},
    {...source, rest:[{mode:'server', resource:[{type:'Patient', interaction:[{code:'<script>'}]}]}]}]) {
    assert.throws(() => summarizeCapabilityStatement(statement));
  }
});

test('rejects oversized structural lists instead of silently truncating them', () => {
  assert.throws(() => summarizeCapabilityStatement({...source, rest:Array(17).fill({mode:'server'})}));
  assert.throws(() => summarizeCapabilityStatement({...source, rest:[{mode:'server', resource:Array(2049).fill({type:'Patient'})}]}));
  assert.throws(() => summarizeCapabilityStatement({...source, rest:[{mode:'server', interaction:Array(65).fill({code:'read'})}]}));
});

test('makes one anonymous fixed metadata request and returns only bounded provenance', async () => {
  let calls = 0;
  const result = await readPublicFhirCapabilities({fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://r4.smarthealthit.org/metadata');
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.referrerPolicy, 'no-referrer');
    return new Response(JSON.stringify(source));
  }});
  assert.equal(calls, 1);
  assert.equal(result.capability.resources.length, 3);
  assert.match(result.provenance.sha256, /^[a-f0-9]{64}$/);
  assert.equal('wire' in result.provenance, false);
  assert.equal(JSON.stringify(result).includes('Synthetic metadata; no patient information.'), false);
});

test('larger metadata is accepted without raising the generic reader budget', async () => {
  const large = JSON.stringify({...source, description:'x'.repeat(3 * 1024 * 1024)});
  const fetchImpl = async () => new Response(large);
  const result = await readPublicFhirCapabilities({fetchImpl});
  assert.ok(result.provenance.bytes > 2 * 1024 * 1024);
  const reader = boundedTestReader(SMART_TEST, undefined, fetchImpl);
  await assert.rejects(reader.read('metadata', MAX_CAPABILITY_BYTES), /bound exceeded/i);
});

test('refuses denied, oversized, malformed and unexpected R5 public responses', async () => {
  await assert.rejects(readPublicFhirCapabilities({fetchImpl: async () => new Response('', {status:403})}), /ACCESS_DENIED/);
  await assert.rejects(readPublicFhirCapabilities({fetchImpl: async () => new Response('', {headers:{'Content-Length':String(MAX_CAPABILITY_BYTES+1)}})}), /Response bound exceeded/);
  await assert.rejects(readPublicFhirCapabilities({fetchImpl: async () => new Response(new Uint8Array(MAX_CAPABILITY_BYTES+1))}), /Response bound exceeded/);
  await assert.rejects(readPublicFhirCapabilities({fetchImpl: async () => new Response('{')}));
  await assert.rejects(readPublicFhirCapabilities({fetchImpl: async () => new Response(JSON.stringify({...source, fhirVersion:'5.0.0'}))}), /did not declare FHIR R4/);
});

test('cancellation propagates to the existing bounded reader', async () => {
  const abort = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = readPublicFhirCapabilities({signal:abort.signal, fetchImpl:async (_url, options) => {
    started();
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), {once:true}));
  }});
  await ready; abort.abort();
  await assert.rejects(pending, /CANCELLED/);
});

test('inspects a local R5 statement without a network request or exposing its raw content', async () => {
  const local = JSON.stringify({...source, fhirVersion:'5.0.0', description:'Do not copy this into the projection'});
  const result = await readLocalFhirCapabilities(new Blob([local]));
  assert.equal(result.capability.fhirVersion, '5.0.0');
  assert.equal(result.provenance.kind, 'local-file');
  assert.match(result.provenance.sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result).includes('Do not copy'), false);
});

test('rejects oversized, malformed, and changed-length local statements', async () => {
  await assert.rejects(readLocalFhirCapabilities(new Blob([new Uint8Array(MAX_CAPABILITY_BYTES + 1)])), /size/);
  await assert.rejects(readLocalFhirCapabilities(new Blob(['{'])));
  await assert.rejects(readLocalFhirCapabilities({size:20, arrayBuffer:async () => new ArrayBuffer(19)}), /size changed/);
});

test('allows metadata through the exact 8 MiB boundary and retains source fingerprint', async () => {
  const content = JSON.stringify({...source, fhirVersion:'4.3.0'});
  const file = new Blob([content, ' '.repeat(MAX_CAPABILITY_BYTES - content.length)]);
  const result = await readLocalFhirCapabilities(file);
  assert.equal(result.capability.fhirVersion, '4.3.0');
  assert.equal(result.provenance.bytes, MAX_CAPABILITY_BYTES);
  assert.match(result.provenance.sha256, /^[a-f0-9]{64}$/);
});

test('rejects late local file reads after cancellation', async () => {
  const abort = new AbortController();
  let finish;
  const bytes = new TextEncoder().encode(JSON.stringify(source));
  const pending = readLocalFhirCapabilities({size:bytes.byteLength, arrayBuffer:() => new Promise(resolve => { finish = resolve; })}, {signal:abort.signal});
  abort.abort(); finish(bytes.buffer);
  await assert.rejects(pending, /CANCELLED/);
});
