import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ecgLead, readLocalEcg} from './src/imaging/local-ecg.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture() {
  const channels = Array.from({length:12}, (_, i) => ({
    label:'Lead ' + i, unit:'uV', gain: i === 11 ? 1.25 : 2, baseline:i === 11 ? -3 : 4,
  }));
  const samples = 3;
  const raw = Buffer.alloc(samples * channels.length * 2);
  for (let sample = 0; sample < samples; sample++) {
    for (let channel = 0; channel < channels.length; channel++) {
      raw.writeInt16LE(sample * 500 - channel * 9 - 256, (sample * channels.length + channel) * 2);
    }
  }
  return {schema:'DICOM3D-local-ecg-1', source:{
    sopClass:'1.2.840.10008.5.1.4.1.1.9.1.1', transferSyntax:'1.2.840.10008.1.2.1', sha256:hash(raw),
  }, groups:[{
    label:'RHYTHM', originality:'ORIGINAL', frequency:1000, samples, channels,
    sampleSha256:hash(raw), base64:raw.toString('base64'),
  }]};
}

test('reads little-endian signed multiplexed samples in original lead order and applies µV calibration', async () => {
  const {groups:[group]} = await readLocalEcg(fixture());
  assert.equal(group.frequency, 1000);
  assert.equal(group.originality, 'ORIGINAL');
  assert.deepEqual([...ecgLead(group, 0)], [-508, 492, 1492]);
  assert.deepEqual([...ecgLead(group, 11)], [-446.75, 178.25, 803.25]);
  assert.throws(() => ecgLead(group, 12), /Unknown waveform lead/);
});

test('fails closed on truncated data, wrong hashes, invalid units and unsupported SOP class', async () => {
  const short = fixture();
  short.groups[0].base64 = short.groups[0].base64.slice(0, -4);
  await assert.rejects(readLocalEcg(short), /byte count/);
  const mismatched = fixture();
  mismatched.groups[0].sampleSha256 = '0'.repeat(64);
  await assert.rejects(readLocalEcg(mismatched), /SHA-256 mismatch/);
  const unit = fixture();
  unit.groups[0].channels[0].unit = 'mV';
  await assert.rejects(readLocalEcg(unit), /calibration/);
  const source = fixture();
  source.source.sopClass = '1.2.3';
  await assert.rejects(readLocalEcg(source), /12-lead ECG/);
});
