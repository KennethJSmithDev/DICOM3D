import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { localIrisEndpoint, pinnedIrisFetch, retrieveIrisOriginal } from './live-h000-ct.mjs';

export const nativeImagePrefix = '/dicom3d/api/images/';
const supported = new Set(['CR', 'DX', 'MG', 'MR', 'US', 'PT', 'NM', 'SPECT', 'XA', 'RF']);
const sha256 = data => createHash('sha256').update(data).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/;
const maxBytes = 8 * 1024 * 1024;
const types = { '|u1': 1, '<u2': 2, '<i2': 2 };

function validStudy(study) {
  const { object, bundle, storedBits } = study;
  const shape = bundle?.pixels?.shape;
  if (!Array.isArray(shape) || shape.length !== 4 ||
      shape.some(size => !Number.isInteger(size) || size < 1 || size > 4096)) return false;
  const [frames, rows, columns, channels] = shape;
  const unit = types[bundle.pixels.dtype];
  const bytes = frames * rows * columns * unit;
  return supported.has(study.id) && typeof study.label === 'string' && study.label.length <= 60 &&
    frames <= 256 && channels === 1 && Number.isFinite(bytes) && bytes <= maxBytes &&
    (/^(?:[a-f0-9]{8}-){4}[a-f0-9]{8}$/).test(object?.id ?? '') &&
    Number.isInteger(object.bytes) && object.bytes <= maxBytes &&
    Number.isInteger(object.offset) && object.offset >= 132 && object.offset + bytes <= object.bytes &&
    bundle.schema === 'DICOM3D-local-image-1' && bundle.support?.decoded === true && bundle.source?.format === 'DICOM' &&
    hashPattern.test(object.sha256) && object.sha256 === bundle.source.sha256 &&
    hashPattern.test(bundle.pixels.sha256) && bundle.pixels.photometric === 'MONOCHROME2' &&
    bundle.pixels.base64 === undefined &&
    Number.isInteger(storedBits) && storedBits >= 1 && storedBits <= unit * 8 &&
    (storedBits === unit * 8 || bundle.pixels.dtype === '<u2');
}

export function nativePixels(original, study) {
  const { bundle, object, storedBits } = study;
  const bytes = bundle.pixels.shape.reduce((total, n) => total * n, types[bundle.pixels.dtype]);
  let pixels = original.subarray(object.offset, object.offset + bytes);
  // Preserve the meaningful stored bits of the admitted uncompressed sample.
  if (storedBits < types[bundle.pixels.dtype] * 8 && bundle.pixels.dtype === '<u2') {
    const mask = (1 << storedBits) - 1;
    pixels = Buffer.from(pixels);
    for (let i = 0; i < pixels.length; i += 2) pixels.writeUInt16LE(pixels.readUInt16LE(i) & mask, i);
  }
  if (sha256(pixels) !== bundle.pixels.sha256) throw new Error('Native pixel identity mismatch');
  return pixels;
}

export function loadLiveNativeImages(configPath, port) {
  if (!configPath) return null;
  const info = statSync(configPath);
  if (!info.isFile() || info.size > 256 * 1024) throw new Error('Invalid native image configuration');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const endpoint = localIrisEndpoint(config.endpoint, port);
  if (config.schema !== 'dicom3d-live-native-images-1' || !Array.isArray(config.studies) ||
      config.studies.length > supported.size || !config.studies.every(validStudy) ||
      new Set(config.studies.map(study => study.id)).size !== config.studies.length) {
    throw new Error('Invalid exact-image study inventory');
  }
  const fetchSource = pinnedIrisFetch(config);
  const studies = new Map(config.studies.map(study => [study.id, study]));
  const catalog = { studies: config.studies.map(study => ({
    id: study.id, label: study.label, frames: study.bundle.pixels.shape[0],
  })) };
  const host = '127.0.0.1:' + port;
  let inFlight = false;
  return async function nativeImages(req, res, requestPath) {
    const reply = (status, payload) => {
      if (res.destroyed || res.writableEnded) return;
      const data = Buffer.from(JSON.stringify(payload));
      res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': data.length,
        'Cache-Control': 'no-store', Vary: 'Authorization, Origin' });
      res.end(data);
    };
    if (req.method !== 'GET') return reply(405, { error: 'METHOD_NOT_ALLOWED' });
    if (req.url !== requestPath || req.headers.host !== host || req.headers['sec-fetch-site'] !== 'same-origin' ||
        (req.headers.origin && req.headers.origin !== 'http://' + host) ||
        req.headers['x-dicom3d-request'] !== 'live-image-v1' || req.headers['transfer-encoding'] ||
        (req.headers['content-length'] && req.headers['content-length'] !== '0')) {
      return reply(403, { error: 'REQUEST_NOT_ALLOWED' });
    }
    const id = requestPath.slice(nativeImagePrefix.length);
    if (id === 'catalog') return reply(200, catalog);
    const authorization = req.headers.authorization;
    if (!/^Basic [A-Za-z0-9+/]{4,2048}={0,2}$/.test(authorization ?? '')) {
      return reply(401, { error: 'AUTHENTICATION_REQUIRED' });
    }
    const study = studies.get(id);
    if (!study) return reply(404, { error: 'UNKNOWN_IMAGE' });
    if (inFlight) return reply(429, { error: 'IMAGE_RETRIEVAL_BUSY' });
    inFlight = true;
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnect);
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]);
      const original = await retrieveIrisOriginal(endpoint, study.object, authorization, signal, fetchSource);
      const pixels = nativePixels(original, study);
      reply(200, { ...study.bundle, pixels: { ...study.bundle.pixels, base64: pixels.toString('base64') } });
    } catch (error) {
      if (!controller.signal.aborted) {
        const status = error.status === 403 ? 403 : 502;
        reply(status, { error: status === 403 ? 'IMAGE_ACCESS_DENIED' : 'IMAGE_INCOMPLETE_OR_INVALID' });
      }
    } finally {
      res.removeListener('close', disconnect);
      inFlight = false;
    }
  };
}
