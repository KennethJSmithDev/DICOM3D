import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createReadOnlyOpenApi } from './fhir-readonly-openapi.mjs';
import { MAX_CAPABILITY_BYTES } from '../prototypes/alpha/viewer/src/fhir-capability-model.mjs';

const exec = promisify(execFile), hash = 'a'.repeat(64);
const statement = (version = '4.0.1') => ({ resourceType: 'CapabilityStatement', kind: 'instance',
  fhirVersion: version, rest: [{ mode: 'server', resource: [
    { type: 'ImagingStudy', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }] },
    { type: 'DiagnosticReport', interaction: [{ code: 'vread' }] }
  ] }] });

for (const version of ['4.0.1', '4.3.0', '5.0.0']) {
  test(`${version} projection describes only declared read-style interactions`, () => {
    const input = statement(version), before = JSON.stringify(input);
    const result = createReadOnlyOpenApi({ statement: input, sourceSha256: hash });
    assert.equal(JSON.stringify(input), before);
    assert.equal(result.openapi, '3.0.3');
    assert.equal(result['x-dicom3d-projection'].fhirVersion, version);
    assert.deepEqual(Object.keys(result.paths).sort(), ['/DiagnosticReport/{id}/_history/{vid}', '/ImagingStudy', '/ImagingStudy/_search', '/ImagingStudy/{id}'].sort());
    assert.deepEqual(Object.keys(result.paths['/ImagingStudy']), ['get']);
    assert.deepEqual(Object.keys(result.paths['/ImagingStudy/_search']), ['post']);
    assert.deepEqual(result['x-dicom3d-projection'].declaredResourceInteractionsOmitted, ['ImagingStudy:create']);
    assert.match(result.servers[0].url, /example\.invalid/);
    assert.equal(result.paths['/DiagnosticReport/{id}/_history/{vid}'].get.parameters.length, 2);
  });
}

test('declared history interactions project separate type and instance routes', () => {
  for (const version of ['4.0.1', '4.3.0', '5.0.0']) {
    const input = statement(version);
    input.rest[0].resource[0].interaction.push({code:'history-type'}, {code:'history-instance'});
    const result = createReadOnlyOpenApi({statement:input, sourceSha256:hash});
    assert.equal(result.paths['/ImagingStudy/_history'].get.operationId, 'historyTypeImagingStudy');
    assert.equal(result.paths['/ImagingStudy/{id}/_history'].get.parameters[0].name, 'id');
    assert.equal(result.paths['/DiagnosticReport/_history'], undefined);
  }
});

test('client declarations and system interactions are not server operations', () => {
  const input = statement();
  input.rest[0].interaction = [{ code: 'transaction' }];
  input.rest.push({ mode: 'client', resource: [{ type: 'Patient', interaction: [{ code: 'read' }] }] });
  const result = createReadOnlyOpenApi({ statement: input, sourceSha256: hash });
  assert.equal(result.paths['/Patient/{id}'], undefined);
  assert.equal(result.paths['/'], undefined);
  assert.deepEqual(result['x-dicom3d-projection'].declaredSystemInteractionsOmitted, ['transaction']);
});

test('system history is emitted only for an explicit server declaration', () => {
  const input = statement('4.3.0');
  input.rest[0].interaction = [{code:'history-system'}, {code:'transaction'}];
  const result = createReadOnlyOpenApi({statement:input, sourceSha256:hash});
  assert.equal(result.paths['/_history'].get.operationId, 'historySystem');
  assert.deepEqual(result['x-dicom3d-projection'].declaredSystemInteractionsOmitted, ['transaction']);
});

test('ambiguous, unsupported, malformed and unsafe input fails closed', () => {
  for (const mutate of [
    x => x.rest.push({ mode: 'server' }),
    x => x.rest[0].resource.push({ ...x.rest[0].resource[0] }),
    x => { x.rest[0].resource[0].type = '../Patient'; },
    x => { x.fhirVersion = '4.2.0'; },
    x => { x.rest[0].resource[0].modifierExtension = []; },
    x => { x.implicitRules = 'https://example.org/rule'; }
  ]) {
    const input = statement(); mutate(input);
    assert.throws(() => createReadOnlyOpenApi({ statement: input, sourceSha256: hash }));
  }
  assert.throws(() => createReadOnlyOpenApi({ statement: statement(), sourceSha256: 'not-a-digest' }));
});

test('base URL requires secure or loopback authority and no secrets', () => {
  const create = baseUrl => createReadOnlyOpenApi({ statement: statement(), sourceSha256: hash, baseUrl });
  assert.equal(create('https://fhir.example.test/base/').servers[0].url, 'https://fhir.example.test/base');
  assert.equal(create('http://127.0.0.1:1234/fhir').servers[0].url, 'http://127.0.0.1:1234/fhir');
  for (const value of ['http://remote.example/fhir', 'https://user:password@example.com/fhir',
    'https://example.com/fhir?token=secret', 'https://example.com/fhir#secret', 'file:///tmp/foo']) {
    assert.throws(() => create(value));
  }
});

test('CLI hashes exact local bytes and refuses overwrites and malformed input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dicom3d-fhir-export-test-'));
  try {
    const input = join(dir, 'input.json'), output = join(dir, 'output.json');
    const bytes = Buffer.from(JSON.stringify(statement('5.0.0')));
    await writeFile(input, bytes);
    const run = () => exec(process.execPath, ['scripts/export-fhir-readonly-openapi.mjs', '--input', input, '--output', output]);
    const { stdout } = await run();
    const receipt = JSON.parse(stdout), generated = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(receipt.sourceSha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(generated['x-dicom3d-projection'].sourceSha256, receipt.sourceSha256);
    assert.equal(receipt.networkRequests, 0);
    await assert.rejects(run());
    assert.deepEqual(await readFile(input), bytes);
    assert.equal(JSON.parse(await readFile(output, 'utf8')).openapi, '3.0.3');
    const invalid = join(dir, 'invalid.json'), missingOutput = join(dir, 'not-created.json');
    await writeFile(invalid, 'private data not json');
    await assert.rejects(exec(process.execPath, ['scripts/export-fhir-readonly-openapi.mjs', '--input', invalid, '--output', missingOutput]),
      error => !String(error.stderr).includes('private data'));
    await assert.rejects(readFile(missingOutput));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CLI rejects files above its bounded input size without an output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dicom3d-fhir-limit-test-'));
  try {
    const input = join(dir, 'large.json'), output = join(dir, 'out.json');
    await writeFile(input, Buffer.alloc(MAX_CAPABILITY_BYTES + 1));
    await assert.rejects(exec(process.execPath, ['scripts/export-fhir-readonly-openapi.mjs', '--input', input, '--output', output]));
    await assert.rejects(readFile(output));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
