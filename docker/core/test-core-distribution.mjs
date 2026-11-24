import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createCoreServer} from './server.mjs';

const studyRoute = '/dicom3d/_interop/fhir/synthetic/ImagingStudy/study-1';
function fixture(t) {
  const temp = mkdtempSync(join(tmpdir(), 'dicom3d-test-core-'));
  t.after(() => rmSync(temp, {recursive:true, force:true}));
  const root = join(temp,'public');
  mkdirSync(root);
  writeFileSync(join(root, 'distribution-manifest.json'), JSON.stringify({version:'fixture'}));
  writeFileSync(join(root, 'reference.html'), 'Public viewer shell');
  return root;
}

async function request(host, url, {headers={}, remoteAddress='127.0.0.1', method='GET'}={}) {
  const req = Object.assign(new EventEmitter(), {method, url, socket:{remoteAddress}, headers:{
    host:'127.0.0.1:8080', 'sec-fetch-site':'same-origin', 'x-dicom3d-request':'fhir-read-v1', ...headers
  }});
  const res = Object.assign(new EventEmitter(), {
    headers:{}, setHeader(key, value) { this.headers[key] = value; },
    writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); },
    end(body) { this.body = body; this.writableEnded = true; },
  });
  await host.server.listeners('request')[0](req, res);
  return res;
}

test('default Core serves the viewer with FHIR disabled', async t => {
  const host = createCoreServer({publicRoot:fixture(t)});
  assert.equal(host.hostname, '0.0.0.0');
  assert.equal((await request(host, '/')).headers.Location, '/dicom3d/reference.html');
  assert.equal((await request(host, '/dicom3d/reference.html', {method:'HEAD'})).status, 200);
  assert.equal(JSON.parse((await request(host, '/healthz')).body).version, 'fixture');
  const response = await request(host, studyRoute);
  assert.equal(response.status, 503);
  assert.equal(JSON.parse(response.body).error, 'LIVE_FHIR_NOT_CONFIGURED');
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('portable Core listens on loopback and reports optional live imaging as unavailable', async t => {
  const host = createCoreServer({publicRoot:fixture(t), port:0, loopback:true});
  assert.equal(host.hostname, '127.0.0.1');
  assert.equal(host.port, 0);
  assert.equal((await request(host, '/dicom3d/reference.html', {method:'HEAD'})).status, 200);
  for (const route of ['/dicom3d/api/ct/h000/descriptor','/dicom3d/api/images/catalog']) {
    const res = await request(host, route);
    assert.equal(res.status, 503);
    assert.equal(JSON.parse(res.body).error, 'LIVE_IMAGING_PREVIEW_ONLY');
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
});

test('configured Core binds to loopback and authenticates the allowlisted study', async t => {
  const publicRoot = fixture(t);
  const configPath = join(publicRoot, '..', 'inputs.json');
  const source = {id:'synthetic', baseUrl:'https://fixture.invalid/fhir', fhirVersion:'5.0.0', imagingStudyIds:['study-1']};
  writeFileSync(configPath, JSON.stringify({schema:'dicom3d-loopback-fhir-1', sources:[source]}));
  assert.throws(() => createCoreServer({publicRoot, configPath:join(publicRoot,'distribution-manifest.json')}), /outside the served directory/);
  const calls = [];
  const host = createCoreServer({publicRoot, configPath, fetchImpl:async (url, options) => {
    calls.push({url, authorization:options.headers.Authorization});
    const value = url.endsWith('/metadata')
      ? {resourceType:'CapabilityStatement', kind:'instance', fhirVersion:'5.0.0', rest:[]}
      : {resourceType:'ImagingStudy', id:'study-1', status:'available'};
    return Response.json(value, {headers:{'content-type':'application/fhir+json'}});
  }});
  assert.equal(host.hostname, '127.0.0.1');
  assert.equal((await request(host, studyRoute)).status, 401);
  const authorization = 'Basic '+Buffer.from('fixture:example').toString('base64');
  const headers = {authorization};
  assert.equal((await request(host, studyRoute, {headers, remoteAddress:'192.0.2.1'})).status, 403);
  assert.equal((await request(host, studyRoute, {headers:{...headers, origin:'https://other.invalid'}})).status, 403);
  assert.deepEqual(calls, []);
  const result = await request(host, studyRoute, {headers});
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body).resource.id, 'study-1');
  assert.deepEqual(calls, ['ImagingStudy/study-1','metadata'].map(path => ({url:source.baseUrl+'/'+path, authorization})));
  writeFileSync(configPath, JSON.stringify({schema:'unknown', sources:[source]}));
  assert.throws(() => createCoreServer({publicRoot, configPath}), {code:'INVALID_CONFIGURATION'});
});

test('both Core build recipes admit the required build and runtime sources', () => {
  const root = new URL('../../', import.meta.url);
  const read = path => readFileSync(new URL(path, root), 'utf8');
  const admitted = read('.dockerignore').split(/\r?\n/);
  const exact = [
    'scripts/build-alpha-distribution.mjs','scripts/test-alpha-distribution.mjs','scripts/admitted-public-files.mjs',
    'scripts/admitted-notices.json','scripts/preview-verified-file.mjs','scripts/preview-static.mjs',
    'scripts/live-h000-ct.mjs','scripts/live-native-images.mjs','scripts/live-rle.mjs','docker/core/server.mjs',
    'docker/core/fhir-loopback-route.mjs','docker/core/fhir-configured-metadata.mjs'
  ];
  for (const name of ['Dockerfile.core', 'Dockerfile.core.offline']) {
    const recipe = read(name);
    for (const path of exact) {
      assert.ok(admitted.includes('!'+path), path+' excluded from context');
      assert.ok(recipe.split(/\r?\n/).some(line => line.startsWith('COPY ') && line.split(/\s+/).includes(path)), name+' lacks '+path);
      assert.ok(read(path).length > 0);
    }
    assert.ok(recipe.includes('COPY prototypes/alpha/viewer/src/fhir-capability-model.mjs ./prototypes/alpha/viewer/src/'));
    assert.ok(recipe.includes('CMD ["node", "docker/core/server.mjs"]'));
    const runtime = recipe.slice(recipe.lastIndexOf('\nFROM '));
    for (const file of ['scripts/preview-static.mjs','scripts/live-h000-ct.mjs','scripts/live-native-images.mjs','scripts/live-rle.mjs']) {
      assert.ok(!runtime.includes(file), name+' includes preview source in the final image');
    }
  }
});
