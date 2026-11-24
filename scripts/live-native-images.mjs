import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { localIrisEndpoint, pinnedIrisFetch, retrieveIrisOriginal } from './live-h000-ct.mjs';
import { dicomRleLossless, decodeRlePixels } from './live-rle.mjs';

export const nativeImagePrefix = '/dicom3d/api/images/';
const supported = new Set(['CR', 'DX', 'MG', 'MR', 'MR_VOLUME', 'MR_ENHANCED', 'MR_RLE', 'US', 'US_CINE', 'US_RLE', 'PT', 'NM', 'SPECT', 'XA', 'RF']);
const enhancedMrSop = '1.2.840.10008.5.1.4.1.1.4.1';
const sha256 = data => createHash('sha256').update(data).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/;
const instancePattern = /^(?:[a-f0-9]{8}-){4}[a-f0-9]{8}$/;
const maxBytes = 8 * 1024 * 1024;
const types = { '|u1': 1, '<u2': 2, '<i2': 2 };

function validObject(object, bytes, transferSyntax) {
  return instancePattern.test(object?.id ?? '') && object.transferSyntax === transferSyntax &&
    Number.isInteger(object.bytes) && object.bytes <= maxBytes &&
    Number.isInteger(object.offset) && object.offset >= 132 && object.offset + bytes <= object.bytes &&
    hashPattern.test(object.sha256);
}

function validEnhancedMr(bundle, frameCount) {
  const identity = bundle.source.identity;
  const frames = bundle.frameIdentity?.series?.frames;
  return identity?.Modality === 'MR' && identity.SOPClassUID === enhancedMrSop &&
    typeof identity.SOPInstanceUID === 'string' && identity.SOPInstanceUID.length > 0 &&
    frameCount >= 2 && Array.isArray(frames) && frames.length === frameCount &&
    new Set(frames.map(frame => frame?.sourceFrame)).size === frameCount &&
    frames.every(frame => frame?.sop === identity.SOPInstanceUID && Number.isInteger(frame.sourceFrame) &&
      frame.sourceFrame >= 1 && frame.sourceFrame <= frameCount && frame.sourceSha256 === bundle.source.sha256 &&
      hashPattern.test(frame.pixelSha256));
}

function validSeries(study, frames, frameBytes) {
  const { bundle, object, series } = study;
  const objects = series?.objects;
  const identities = bundle.frameIdentity?.series?.frames;
  return object === undefined && frames >= 2 && Array.isArray(objects) && objects.length === frames &&
    Array.isArray(identities) && identities.length === frames &&
    new Set(objects.map(entry => entry?.id)).size === frames &&
    new Set(objects.map(entry => entry?.sha256)).size === frames &&
    objects.every((entry, k) => validObject(entry, frameBytes) && entry.sha256 === identities[k]?.sourceSha256 &&
      hashPattern.test(identities[k].pixelSha256)) &&
    sha256(objects.map(entry => entry.sha256).join('')) === bundle.source.sha256;
}

function validStudy(study) {
  const { object, bundle, storedBits } = study;
  const shape = bundle?.pixels?.shape;
  if (!Array.isArray(shape) || shape.length !== 4 ||
      shape.some(size => !Number.isInteger(size) || size < 1 || size > 4096)) return false;
  const [frames, rows, columns, channels] = shape;
  const unit = types[bundle.pixels.dtype];
  const bytes = frames * rows * columns * unit;
  const common = supported.has(study.id) && typeof study.label === 'string' && study.label.length <= 60 &&
    frames <= 256 && channels === 1 && Number.isFinite(bytes) && bytes <= maxBytes &&
    bundle.schema === 'DICOM3D-local-image-1' && bundle.support?.decoded === true && bundle.source?.format === 'DICOM' &&
    hashPattern.test(bundle.pixels.sha256) && bundle.pixels.photometric === 'MONOCHROME2' &&
    bundle.pixels.base64 === undefined &&
    Number.isInteger(storedBits) && storedBits >= 1 && storedBits <= unit * 8 &&
    (storedBits === unit * 8 || bundle.pixels.dtype === '<u2');
  if (!common) return false;
  if (study.id === 'MR_VOLUME') return validSeries(study, frames, bytes / frames);
  const rle = study.id === 'MR_RLE' || study.id === 'US_RLE';
  if (study.series !== undefined || !validObject(object, rle ? 12 : bytes, rle ? dicomRleLossless : undefined) ||
      object.sha256 !== bundle.source.sha256) return false;
  if (rle && (bundle.source.identity?.TransferSyntaxUID !== dicomRleLossless ||
      bundle.source.identity.Modality !== study.id.slice(0, 2))) return false;
  if (study.id === 'MR_ENHANCED') return validEnhancedMr(bundle, frames);
  return bundle.frameIdentity?.series === undefined;
}

function pixelSpan(original, object, bytes, storedBits, dtype, expectedSha256) {
  let pixels = original.subarray(object.offset, object.offset + bytes);
  // Preserve the meaningful stored bits of the admitted uncompressed sample.
  if (storedBits < types[dtype] * 8 && dtype === '<u2') {
    const mask = (1 << storedBits) - 1;
    pixels = Buffer.from(pixels);
    for (let i = 0; i < pixels.length; i += 2) pixels.writeUInt16LE(pixels.readUInt16LE(i) & mask, i);
  }
  if (sha256(pixels) !== expectedSha256) throw new Error('Native pixel identity mismatch');
  return pixels;
}

export function nativePixels(original, study) {
  const { bundle, object, storedBits } = study;
  const bytes = bundle.pixels.shape.reduce((total, n) => total * n, types[bundle.pixels.dtype]);
  if (object.transferSyntax === dicomRleLossless) {
    const pixels = decodeRlePixels(original, object.offset, bundle.pixels.shape, bundle.pixels.dtype, storedBits);
    if (sha256(pixels) !== bundle.pixels.sha256) throw new Error('Decoded RLE pixel identity mismatch');
    return pixels;
  }
  if (study.id === 'MR_ENHANCED') {
    const frames = bundle.pixels.shape[0];
    if (!validEnhancedMr(bundle, frames)) throw new Error('Invalid Enhanced MR source frame inventory');
    const frameBytes = bytes / frames;
    const volume = Buffer.allocUnsafe(bytes);
    // Plane order is determined during admission. Keep the original DICOM
    // frame number as an explicit link even when physical order differs.
    for (const [index, frame] of bundle.frameIdentity.series.frames.entries()) {
      const span = { offset: object.offset + (frame.sourceFrame - 1) * frameBytes };
      pixelSpan(original, span, frameBytes, storedBits, bundle.pixels.dtype, frame.pixelSha256)
        .copy(volume, index * frameBytes);
    }
    if (sha256(volume) !== bundle.pixels.sha256) throw new Error('Enhanced MR volume identity mismatch');
    return volume;
  }
  return pixelSpan(original, object, bytes, storedBits, bundle.pixels.dtype, bundle.pixels.sha256);
}

async function retrieveStudy(study, retrieve) {
  if (!study.series) return nativePixels(await retrieve(study.object), study);
  const { bundle, series, storedBits } = study;
  const [frames, rows, columns, channels] = bundle.pixels.shape;
  const frameBytes = rows * columns * channels * types[bundle.pixels.dtype];
  const volume = Buffer.allocUnsafe(frames * frameBytes);
  // Never publish a partial series. Each admitted original and plane must match
  // its identity in physical slice order before the assembled volume is returned.
  for (const [k, object] of series.objects.entries()) {
    const original = await retrieve(object);
    const pixels = pixelSpan(original, object, frameBytes, storedBits, bundle.pixels.dtype,
      bundle.frameIdentity.series.frames[k].pixelSha256);
    pixels.copy(volume, k * frameBytes);
  }
  if (sha256(volume) !== bundle.pixels.sha256) throw new Error('Native volume identity mismatch');
  return volume;
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
      const pixels = await retrieveStudy(study, object => retrieveIrisOriginal(endpoint, object, authorization, signal, fetchSource));
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
