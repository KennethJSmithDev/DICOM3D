import {isVerifiedVolume} from '../../../viewer/src/verified-volume.mjs';
import {digest} from '../../../viewer/src/imaging-primitives.mjs';

export const localSegFileLimit = 24 * 1024 * 1024;
const packedLimit = 16 * 1024 * 1024;
const MAX_FRAMES = 256;
const uid = value => typeof value === 'string' && value.length <= 64 && /^\d+(?:\.\d+)+$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const vector = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
const matches = (a, b, tolerance) => vector(a, b.length) && a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
const sourceKey = ({sopIdentity, sourceFrame}) => sopIdentity + '/' + sourceFrame;

function requireSeg(condition, reason) {
  if (!condition) throw new Error(reason);
}

function validReference(reference) {
  return uid(reference?.sopIdentity) && reference?.sourceFrame === 1;
}

export async function readLocalSeg(bundle, study) {
  requireSeg(isVerifiedVolume(study) && study.descriptor.source.modality === 'CT', 'Open the verified source CT first.');
  requireSeg(bundle?.schema === 'DICOM3D-local-binary-seg-1', 'Expected a prepared binary DICOM SEG.');
  const {source, segment, frames, dimensions, payload} = bundle;
  const descriptor = study.descriptor;
  const [, rows, columns] = descriptor.shape;
  requireSeg(Array.isArray(dimensions) && dimensions.length === 2 && dimensions[0] === rows && dimensions[1] === columns,
    'The SEG grid dimensions do not match the source CT.');
  requireSeg(uid(source?.segSopIdentity) && sha(source?.sha256) &&
    source.studyIdentity === descriptor.source.studyIdentity &&
    source.ctSeriesIdentity === descriptor.source.seriesIdentity &&
    source.frameOfReferenceIdentity === descriptor.source.frameOfReferenceIdentity,
  'The SEG study, referenced CT series or frame of reference does not match.');
  requireSeg(Number.isInteger(segment?.number) && segment.number >= 1 && segment.number <= 65535 &&
    typeof segment.label === 'string' && segment.label.trim() && segment.label.length <= 64, 'Invalid segment identity.');
  requireSeg(Array.isArray(frames) && frames.length > 0 && frames.length <= MAX_FRAMES, 'Unsupported SEG frame count.');
  const ctFrames = new Map(descriptor.frames.map(frame => [sourceKey(frame), frame]));
  requireSeg(Array.isArray(source.references) && source.references.length >= frames.length &&
    source.references.length <= MAX_FRAMES && source.references.every(validReference), 'Missing original CT references.');
  const references = new Set(source.references.map(sourceKey));
  requireSeg(references.size === source.references.length && [...references].every(key => ctFrames.has(key)),
    'A referenced SOP instance or frame is absent from the source CT.');
  const referenceFrames = [...references].map(key => ctFrames.get(key));
  const frameMap = new Map();
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];
    requireSeg(matches(frame?.spacing, descriptor.geometry.pixelSpacingRowColumnMm, 1e-7) &&
      matches(frame.orientation, descriptor.geometry.imageOrientationPatient, 1e-7) &&
      vector(frame.position, 3), 'SEG pixel spacing, orientation or position is invalid for the source CT.');
    let candidates;
    if (frame.reference !== null) {
      requireSeg(validReference(frame.reference) && references.has(sourceKey(frame.reference)), 'A SEG frame has an unknown CT reference.');
      candidates = [ctFrames.get(sourceKey(frame.reference))];
    } else {
      // Some SEG producers give a shared source-reference list. Exact plane
      // correspondence inside that declared list can identify an existing
      // source plane without resampling or inferring a registration.
      candidates = referenceFrames;
    }
    const equalPlanes = candidates.filter(candidate => matches(frame.position, candidate.imagePositionPatient, 1e-5));
    requireSeg(equalPlanes.length === 1 && !frameMap.has(equalPlanes[0].k), 'A SEG frame does not identify one unique source CT plane.');
    frameMap.set(equalPlanes[0].k, index);
  }
  const pixelCount = rows * columns;
  const frameBytes = Math.ceil(pixelCount / 8);
  const bytes = frameBytes * frames.length;
  requireSeg(Number.isSafeInteger(bytes) && bytes <= packedLimit && payload?.bytes === bytes && sha(payload.sha256) &&
    typeof payload.base64 === 'string' && payload.base64.length === 4 * Math.ceil(bytes / 3),
  'The SEG mask size or digest declaration is invalid.');
  const raw = atob(payload.base64);
  requireSeg(raw.length === bytes, 'The SEG mask is incomplete.');
  const packed = Uint8Array.from(raw, character => character.charCodeAt(0));
  requireSeg(await digest(packed) === payload.sha256, 'The SEG mask digest did not match.');
  if (pixelCount % 8) {
    const paddingMask = 255 ^ ((1 << (pixelCount % 8)) - 1);
    for (const index of frameMap.values()) {
      requireSeg((packed[(index + 1) * frameBytes - 1] & paddingMask) === 0, 'The SEG mask contains unused bits.');
    }
  }
  return Object.freeze({
    label:segment.label, segmentNumber:segment.number, sourceSha256:source.sha256,
    get matchedFrames() { return frameMap.size; },
    apply(frame, rgba) {
      const index = frameMap.get(frame);
      if (index === undefined) return null;
      requireSeg(rgba.length === pixelCount * 4, 'Overlay target dimensions are invalid.');
      const offset = index * frameBytes;
      let occupied = 0;
      for (let pixel = 0; pixel < pixelCount; pixel++) {
        if (!(packed[offset + (pixel >> 3)] & (1 << (pixel & 7)))) continue;
        occupied++;
        const channel = pixel * 4;
        rgba[channel] = Math.round(rgba[channel] * 0.55);
        rgba[channel + 1] = Math.round(rgba[channel + 1] * 0.55 + 230 * 0.45);
        rgba[channel + 2] = Math.round(rgba[channel + 2] * 0.55 + 255 * 0.45);
      }
      return occupied;
    },
  });
}
