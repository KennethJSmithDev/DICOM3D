import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {point} from '../viewer/src/ct-spatial.mjs';
import {createPublicationOwner, verifiedFrameRgba, verifyVolume} from '../viewer/src/verified-volume.mjs';

const shape = [3, 9, 9];
const [slices, rows, columns] = shape;
const sampleCount = slices * rows * columns;
const affineRow = [0, 0, 0, 1];
const swap = [[0, 0, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0], affineRow];
const sourceEncoding = {
  sopClassUid: '1.2.840.10008.5.1.4.1.1.2',
  transferSyntaxUid: '1.2.840.10008.1.2',
  decoded: true,
};
const sha256 = bytes => createHash('sha256').update(new Uint8Array(bytes)).digest('hex');

function packet({pixels = new Uint16Array(sampleCount), bitsStored = 16, geometry = {}} = {}) {
  const buffer = pixels.buffer;
  const matrices = {
    index_to_patient_mm: swap,
    patient_mm_to_index: swap,
    patient_mm_to_model_m: [[-.001, 0, 0, 0], [0, 0, .001, 0], [0, .001, 0, 0], affineRow],
    model_m_to_patient_mm: [[-1000, 0, 0, 0], [0, 0, 1000, 0], [0, 1000, 0, 0], affineRow],
    ...geometry.matrices,
  };
  const frameBytes = rows * columns * 2;
  const descriptor = {
    schema: 'DICOM3D-verified-volume-1',
    shape,
    source: {modality: 'CT', studyIdentity: '1.2.3', seriesIdentity: '1.2.4', frameOfReferenceIdentity: '1.2.5'},
    storage: {dtype: pixels instanceof Int16Array ? '<i2' : '<u2', bitsStored, highBit: bitsStored - 1, photometric: 'MONOCHROME2'},
    calibration: {slope: 1, intercept: 0, center: 2047.5, width: 4095, voiFunction: 'LINEAR_EXACT'},
    geometry: {pixelSpacingRowColumnMm: [1, 1], imageOrientationPatient: [1, 0, 0, 0, 1, 0], ...geometry, matrices},
    frames: Array.from({length: slices}, (_, k) => {
      const pixelSha256 = sha256(buffer.slice(k * frameBytes, (k + 1) * frameBytes));
      return {
        k, sourceFrame: 1, sopIdentity: '1.2.6.' + (k + 1),
        pixelSha256, sourceFileSha256: pixelSha256,
        imagePositionPatient: point(matrices.index_to_patient_mm, [k, 0, 0]),
      };
    }),
    payload: {bytes: buffer.byteLength, sha256: sha256(buffer)},
  };
  return {descriptor, buffer};
}

function verify({descriptor, buffer}, owner) {
  return verifyVolume(descriptor, buffer, {sourceEncoding, owner});
}

test('admits a rotated, translated, anisotropic volume with a tilted slice step', async () => {
  const fixture = packet({geometry: {
    pixelSpacingRowColumnMm: [.5, .25],
    imageOrientationPatient: [0, 1, 0, -1, 0, 0],
    matrices: {
      index_to_patient_mm: [[.25, -.5, 0, 16], [-.125, 0, .25, -8], [2.5, 0, 0, 5], affineRow],
      patient_mm_to_index: [[0, 0, .4, -2], [-2, 0, .2, 31], [0, 4, .2, 31], affineRow],
    },
  }});
  const volume = await verify(fixture);
  const {index_to_patient_mm, patient_mm_to_index} = volume.descriptor.geometry.matrices;
  const index = [2, 3, 7];
  const patient = [15, -6.5, 10];
  assert.deepEqual(point(index_to_patient_mm, index), patient);
  assert.deepEqual(point(patient_mm_to_index, patient), index);
  assert.equal(await volume.assertSourceUnchanged(), true);
});

test('rejects a skewed patient-to-index inverse that passed the old coplanar probes', async () => {
  const fixture = packet({geometry: {matrices: {
    patient_mm_to_index: [[1, 1, -7, 0], swap[1], swap[2], affineRow],
  }}});
  const owner = createPublicationOwner();
  await assert.rejects(verify(fixture, owner), {code: 'SOURCE_INVALID', reasons: ['inverse']});
  assert.equal(owner.current, null);
});

test('rejects a skewed model-to-patient inverse that passed the old coplanar probes', async () => {
  const fixture = packet({geometry: {matrices: {
    model_m_to_patient_mm: [[-2000, -8000, 1000, 0], [0, 0, 1000, 0], [0, 1000, 0, 0], affineRow],
  }}});
  await assert.rejects(verify(fixture), {code: 'SOURCE_INVALID', reasons: ['inverse']});
});

test('preserves and renders the valid unsigned 12-bit endpoints', async () => {
  const pixels = new Uint16Array(sampleCount);
  pixels[1] = 4095;
  const volume = await verify(packet({pixels, bitsStored: 12}));
  assert.deepEqual(volume.pixels, pixels);
  const rgba = verifiedFrameRgba(volume, 0, 2047.5, 4095, new Uint8ClampedArray(rows * columns * 4));
  assert.deepEqual([...rgba.slice(0, 8)], [0, 0, 0, 255, 255, 255, 255, 255]);
});

for (const invalid of [4096, 65535]) {
  test('rejects stored value ' + invalid + ' in an unsigned 12-bit volume with matching hashes', async () => {
    const pixels = new Uint16Array(sampleCount);
    pixels[pixels.length - 1] = invalid;
    const owner = createPublicationOwner();
    await assert.rejects(verify(packet({pixels, bitsStored: 12}), owner), {
      code: 'CT_UNSUPPORTED', reasons: ['unsigned 12-bit stored pixel range'],
    });
    assert.equal(owner.current, null);
  });
}

test('preserves the full signed and unsigned 16-bit ranges', async () => {
  const unsigned = new Uint16Array(sampleCount);
  const signed = new Int16Array(sampleCount);
  unsigned[0] = 65535;
  signed[0] = -32768;
  signed[signed.length - 1] = 32767;
  for (const pixels of [unsigned, signed]) {
    assert.deepEqual((await verify(packet({pixels}))).pixels, pixels);
  }
});
