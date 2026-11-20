// The H000 fixture is the only admitted source. Each original DICOM object is
// hashed before its pinned, uncompressed pixel span is read.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { request as requestHttps } from 'node:https';
import { Readable } from 'node:stream';

export const liveH000Prefix = '/dicom3d/api/ct/h000/';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sha = /^[a-f0-9]{64}$/;
const instanceId = /^(?:[a-f0-9]{8}-){4}[a-f0-9]{8}$/;
const expectedPayload = '3213cf01a7e846807293da57b2f8300f2de35f9f28f86996c14ee74b3eeeea34';
const frameBytes = 512 * 512 * 2;
const frameCount = 103;
const validBasic = /^Basic [A-Za-z0-9+/]{4,2048}={0,2}$/;
const irisRoutes = new Set(['/csp/user/DICOM3DI001.Api.cls', '/dicom3d-i001/DICOM3DI001.Api.cls']);

function reject(status, code) {
  throw Object.assign(new Error(code), { status });
}

export async function exactResponse(response, bytes) {
  if (!response.body) reject(502, 'INCOMPLETE_CT_TRANSFER');
  const reader = response.body.getReader();
  const data = Buffer.allocUnsafe(bytes);
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > bytes) reject(502, 'INCOMPLETE_CT_TRANSFER');
      data.set(value, offset);
      offset += value.byteLength;
    }
    if (offset !== bytes) reject(502, 'INCOMPLETE_CT_TRANSFER');
    return data;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function pinnedIrisFetch(config) {
  const ca = readFileSync(config.certificateFile);
  if (ca.length > 16 * 1024 || sha256(ca) !== config.certificateSha256) throw new Error('H000 upstream certificate pin mismatch');
  return (url, { headers, signal }) => new Promise((resolve, reject) => {
    const request = requestHttps(url, { headers, signal, ca, agent: false }, response => {
      resolve({
        status: response.statusCode,
        ok: response.statusCode >= 200 && response.statusCode < 300,
        headers: new Headers(response.headers),
        body: Readable.toWeb(response),
      });
    });
    request.once('error', reject);
    request.end();
  });
}

export function localIrisEndpoint(value, port) {
  const endpoint = new URL(value);
  if (endpoint.protocol !== 'https:' ||
      endpoint.hostname !== '127.0.0.1' || !endpoint.port || Number(endpoint.port) === port ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      !irisRoutes.has(endpoint.pathname)) {
    throw new Error('Invalid pinned loopback IRIS H000 endpoint');
  }
  return endpoint;
}

export function loadLiveH000Route(configPath, port) {
  if (!configPath) return null;
  const info = statSync(configPath);
  if (!info.isFile() || info.size > 256 * 1024) throw new Error('Invalid H000 configuration file');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  return createLiveH000Route(config, port, pinnedIrisFetch(config));
}

export async function retrieveIrisOriginal(endpoint, object, authorization, signal, fetchSource) {
  const url = new URL(endpoint);
  const correlation = randomUUID();
  url.search = new URLSearchParams({ id: object.id, correlation, generation: '1' });
  const response = await fetchSource(url, {
    headers: { authorization, accept: 'application/dicom' }, redirect: 'manual', cache: 'no-store', signal,
  });
  if (response.status === 401 || response.status === 403 || response.status === 302 ||
      (response.ok && response.headers.get('content-type')?.startsWith('text/html'))) {
    await response.body?.cancel();
    reject(403, 'CT_ACCESS_DENIED');
  }
  if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/dicom' ||
      response.headers.get('x-i001-correlation') !== correlation) {
    await response.body?.cancel();
    reject(502, 'INCOMPLETE_CT_TRANSFER');
  }
  const data = await exactResponse(response, object.bytes);
  if (sha256(data) !== object.sha256) reject(502, 'CT_OBJECT_IDENTITY_MISMATCH');
  return data;
}

export function createLiveH000Route(config, port, fetchSource) {
  if (config.schema !== 'dicom3d-live-h000-1') throw new Error('Invalid H000 configuration schema');
  const endpoint = localIrisEndpoint(config.endpoint, port);
  const { packet, objects } = config;
  const { descriptor } = packet;
  if (descriptor?.schema !== 'DICOM3D-verified-volume-1' || descriptor.shape?.join(',') !== '103,512,512' ||
      descriptor?.payload?.sha256 !== expectedPayload || descriptor.payload.bytes !== frameCount * frameBytes ||
      packet.sourceEncoding?.transferSyntaxUid !== '1.2.840.10008.1.2' ||
      objects?.length !== frameCount || descriptor.frames?.length !== frameCount ||
      new Set(objects.map(object => object.id)).size !== frameCount ||
      !objects.every((object, k) => instanceId.test(object.id) && Number.isInteger(object.bytes) &&
        object.bytes <= 1024 * 1024 && Number.isInteger(object.offset) &&
        object.offset >= 132 && object.offset + frameBytes <= object.bytes &&
        object.sha256 === descriptor.frames[k].sourceFileSha256 && sha.test(object.sha256) && sha.test(descriptor.frames[k].pixelSha256))) {
    throw new Error('Invalid pinned H000 source inventory');
  }
  const descriptorBytes = Buffer.from(JSON.stringify(packet));
  const host = `127.0.0.1:${port}`;
  let activeVolume = false;

  async function retrieve(object, authorization, signal) {
    const data = await retrieveIrisOriginal(endpoint, object, authorization, signal, fetchSource);
    return data.subarray(object.offset, object.offset + frameBytes);
  }

  return async (req, res, requestPath) => {
    function reply(status, type, body) {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': 'no-store', Vary: 'Authorization, Origin' });
      res.end(body);
    }
    const error = (status, code) => reply(status, 'application/json', Buffer.from(JSON.stringify({ error: code })));
    if (req.method !== 'GET') return error(405, 'METHOD_NOT_ALLOWED');
    if (req.url !== requestPath || req.headers.host !== host || req.headers['sec-fetch-site'] !== 'same-origin' ||
        (req.headers.origin && req.headers.origin !== `http://${host}`) ||
        req.headers['x-dicom3d-request'] !== 'live-ct-v1' ||
        req.headers['transfer-encoding'] || (req.headers['content-length'] && req.headers['content-length'] !== '0')) {
      return error(403, 'REQUEST_NOT_ALLOWED');
    }
    const authorization = req.headers.authorization;
    if (!validBasic.test(authorization ?? '')) return error(401, 'AUTHENTICATION_REQUIRED');
    const part = requestPath.slice(liveH000Prefix.length);
    if (part !== 'pixels' && part !== 'descriptor') return error(404, 'UNKNOWN_CT_RESOURCE');
    const loadPixels = part === 'pixels';
    if (loadPixels && activeVolume) return error(429, 'CT_RETRIEVAL_BUSY');
    if (loadPixels) activeVolume = true;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(loadPixels ? 90000 : 15000)]);
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnect);
    try {
      const first = await retrieve(objects[0], authorization, signal);
      if (!loadPixels) return reply(200, 'application/json', descriptorBytes);
      const volume = Buffer.allocUnsafe(descriptor.payload.bytes);
      for (let k = 0; k < objects.length; k++) {
        const pixels = k === 0 ? first : await retrieve(objects[k], authorization, signal);
        if (sha256(pixels) !== descriptor.frames[k].pixelSha256) reject(502, 'CT_FRAME_IDENTITY_MISMATCH');
        pixels.copy(volume, k * frameBytes);
      }
      if (sha256(volume) !== expectedPayload) reject(502, 'CT_VOLUME_IDENTITY_MISMATCH');
      reply(200, 'application/octet-stream', volume);
    } catch (failure) {
      if (!controller.signal.aborted) error(failure.status ?? (signal.aborted ? 504 : 502), failure.status ? failure.message : 'CT_UPSTREAM_UNAVAILABLE_OR_INCOMPLETE');
    } finally {
      if (loadPixels) activeVolume = false;
      res.removeListener('close', disconnect);
    }
  };
}
