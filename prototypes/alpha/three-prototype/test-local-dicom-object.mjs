import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {readLocalDicomObject} from './src/imaging/local-dicom-object.mjs';

function envelope(value) {
  const payload = JSON.stringify(value);
  return {schema: 'DICOM3D-local-object-1', payload,
    payloadSha256: createHash('sha256').update(payload).digest('hex')};
}

const source = {
  family: 'SR', sha256: 'a'.repeat(64), sopClassUID: '1.2.840.10008.5.1.4.1.1.88.33',
  sopInstanceUID: '2.25.12345', transferSyntaxUID: '1.2.840.10008.1.2.1',
};
const content = {
  type: 'CONTAINER', relationship: '', concepts: [], values: {}, references: [],
  children: [{
    type: 'NUM', relationship: 'CONTAINS', concepts: [], values: {}, children: [],
    measurements: [{values: {NumericValue: '2.05'}, units: [{CodeValue: 'mm', CodingSchemeDesignator: 'UCUM'}]}],
    references: [{
      sequence: 'ReferencedSOPSequence',
      values: {ReferencedSOPInstanceUID: '2.25.12346'},
      references: [],
    }],
  }],
};

test('reads numeric values and source references without interpretation', async () => {
  assert.deepEqual(await readLocalDicomObject(envelope({source, content})), {source, content});
});

test('rejects altered projection bytes and invalid object family', async () => {
  const valid = envelope({source, content});
  await assert.rejects(readLocalDicomObject({...valid, payload: valid.payload.replace('2.05', '5.02')}), /integrity/);
  await assert.rejects(readLocalDicomObject(envelope({source: {...source, sopClassUID: '2.25.999'}, content})), /identity/);
});

test('rejects malformed report children even with a valid payload hash', async () => {
  await assert.rejects(readLocalDicomObject(envelope({source, content: {...content, children: {}}})), /bounds/);
});

test('preserves recorded beam, fraction and referenced object metadata', async () => {
  const planSource = {...source, family: 'RTPLAN', sopClassUID: '1.2.840.10008.5.1.4.1.1.481.5'};
  const plan = {
    fields: {RTPlanLabel: 'Analytic'},
    beams: [{BeamNumber: '1'}],
    fractions: [{fields: {FractionGroupNumber: '1'}, references: []}],
    references: [{sequence: 'ReferencedStructureSetSequence', values: {ReferencedSOPInstanceUID: '2.25.9'}, references: []}],
  };
  assert.deepEqual(await readLocalDicomObject(envelope({source: planSource, content: plan})), {source: planSource, content: plan});
});
