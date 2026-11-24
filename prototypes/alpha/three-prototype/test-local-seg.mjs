import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {verifyVolume} from '../viewer/src/verified-volume.mjs';
import {readLocalSeg} from './src/imaging/local-seg.mjs';

const sha256 = bytes => createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const orientation = [1, 0, 0, 0, 1, 0];
const source = {modality:'CT', studyIdentity:'1.2.3', seriesIdentity:'1.2.4', frameOfReferenceIdentity:'1.2.5'};
const refs = [1,2].map(index => ({sopIdentity:'1.2.6.' + index, sourceFrame:1}));

async function verifiedCt() {
  const bytes = new Uint16Array(18).buffer;
  const frameHash = sha256(bytes.slice(0, 18));
  const affine = [[0,0,1,0], [0,1,0,0], [1,0,0,0], [0,0,0,1]];
  return verifyVolume({
    schema:'DICOM3D-verified-volume-1', shape:[2,3,3], source,
    storage:{dtype:'<u2', bitsStored:16, highBit:15, photometric:'MONOCHROME2'},
    calibration:{slope:1, intercept:0, center:4, width:8, voiFunction:'LINEAR_EXACT'},
    geometry:{imageOrientationPatient:orientation, pixelSpacingRowColumnMm:[1,1], matrices:{
      index_to_patient_mm:affine, patient_mm_to_index:affine,
      patient_mm_to_model_m:[[-.001,0,0,0],[0,0,.001,0],[0,.001,0,0],[0,0,0,1]],
      model_m_to_patient_mm:[[-1000,0,0,0],[0,0,1000,0],[0,1000,0,0],[0,0,0,1]],
    }},
    frames:refs.map((frame,k) => ({...frame, k, imagePositionPatient:[0,0,k], pixelSha256:frameHash, sourceFileSha256:frameHash})),
    payload:{bytes:bytes.byteLength, sha256:sha256(bytes)},
  }, bytes, {sourceEncoding:{sopClassUid:'1.2.840.10008.5.1.4.1.1.2', transferSyntaxUid:'1.2.840.10008.1.2.1', decoded:true}});
}

function seg() {
  const bytes = Buffer.from([0, 1, 2, 0]);
  return {
    schema:'DICOM3D-local-binary-seg-1', dimensions:[3,3],
    source:{segSopIdentity:'1.2.7', sha256:sha256(bytes), studyIdentity:source.studyIdentity,
      ctSeriesIdentity:source.seriesIdentity, frameOfReferenceIdentity:source.frameOfReferenceIdentity, references:structuredClone(refs)},
    segment:{number:1, label:'Synthetic segment'},
    frames:[1,0].map(k => ({position:[0,0,k], orientation:[...orientation], spacing:[1,1], reference:null})),
    payload:{bytes:bytes.length, sha256:sha256(bytes), base64:bytes.toString('base64')},
  };
}

function fractionalSeg(type, maximum, samples = [0, 1, 2, 3, 4, 0, 0, 0, 0]) {
  const bundle = seg();
  const bytes = Buffer.from([...samples, ...new Array(9).fill(0)]);
  return {...bundle, schema:'DICOM3D-local-fractional-seg-1', fractional:{type, maximum},
    payload:{bytes:bytes.length, sha256:sha256(bytes), base64:bytes.toString('base64')}};
}

test('maps shuffled SEG frames by exact source plane, preserving one-bit locations and CT source', async () => {
  const study = await verifiedCt();
  const loaded = await readLocalSeg(seg(), study);
  assert.equal(loaded.matchedFrames, 2);
  const rgba = new Uint8ClampedArray(36);
  assert.equal(loaded.apply(0, rgba), 1);
  assert.equal(rgba[5], 104);
  rgba.fill(0);
  assert.equal(loaded.apply(1, rgba), 1);
  assert.equal(rgba[33], 104);
  assert.equal(loaded.apply(2, rgba), null);
  assert.equal(await study.assertSourceUnchanged(), true);
});

test('rejects a real source SOP, plane, spacing, transform or mask mismatch without modifying CT', async () => {
  const study = await verifiedCt();
  for (const [mutate, expected] of [
    [value => { value.source.references[0].sopIdentity = '1.2.99'; }, /SOP instance/],
    [value => { value.source.frameOfReferenceIdentity = '1.2.99'; }, /frame of reference/],
    [value => { value.frames[0].position[2] = 0.75; }, /unique source CT plane/],
    [value => { value.frames[0].reference = refs[0]; }, /unique source CT plane/],
    [value => { value.frames[0].spacing[0] = 0.75; }, /pixel spacing/],
    [value => { value.payload.base64 = Buffer.from([3,1,2,0]).toString('base64'); }, /digest did not match/],
  ]) {
    const input = seg();
    mutate(input);
    await assert.rejects(readLocalSeg(input, study), expected);
  }
  await assert.rejects(readLocalSeg(seg(), {descriptor:study.descriptor}), /verified source CT/);
  assert.equal(await study.assertSourceUnchanged(), true);
});

test('preserves fractional probability and occupancy values through proportional display', async () => {
  const study = await verifiedCt();
  for (const [type, maximum, samples] of [
    ['PROBABILITY', 4, [0, 1, 2, 3, 4, 0, 0, 0, 0]],
    ['OCCUPANCY', 100, [0, 25, 50, 75, 100, 0, 0, 0, 0]],
  ]) {
    const overlay = await readLocalSeg(fractionalSeg(type, maximum, samples), study);
    assert.deepEqual(overlay.fractional, {type, maximum});
    const rgba = new Uint8ClampedArray(36);
    assert.equal(overlay.apply(0, rgba), 0);
    assert.equal(overlay.apply(1, rgba), 4);
    assert.deepEqual([1, 5, 9, 13, 17].map(channel => rgba[channel]), [0, 26, 52, 78, 104]);
  }
  assert.equal(await study.assertSourceUnchanged(), true);
});

test('rejects invalid fractional metadata and a validly hashed sample beyond the maximum', async () => {
  const study = await verifiedCt();
  await assert.rejects(readLocalSeg(fractionalSeg('UNKNOWN', 4), study), /type or maximum/);
  for (const maximum of [0, 4.5, 256]) {
    await assert.rejects(readLocalSeg(fractionalSeg('PROBABILITY', maximum), study), /type or maximum/);
  }
  await assert.rejects(readLocalSeg(fractionalSeg('PROBABILITY', 3), study), /sample exceeds/);
  await assert.rejects(readLocalSeg({...seg(), fractional:{type:'PROBABILITY', maximum:1}}, study), /Unexpected fractional/);
  assert.equal(await study.assertSourceUnchanged(), true);
});
