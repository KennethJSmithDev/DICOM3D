// This contract carries source waveform samples and display metadata without
// carrying identifying DICOM header fields or clinical annotations.
export const waveformSourceLimit = 8 * 1024 * 1024;
const identity = /^[a-f0-9]{64}$/;
const sop = '1.2.840.10008.5.1.4.1.1.9.1.1';
const littleEndianSyntax = new Set(['1.2.840.10008.1.2', '1.2.840.10008.1.2.1']);
const safeText = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;

function requireValue(ok, message) {
  if (!ok) throw new Error(message);
}

async function sha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function readLocalEcg(packet) {
  const source = packet?.source;
  requireValue(packet?.schema === 'DICOM3D-local-ecg-1' && source?.sopClass === sop &&
    identity.test(source?.sha256 ?? '') && littleEndianSyntax.has(source?.transferSyntax),
  'Expected a supported 12-lead ECG waveform bundle.');
  requireValue(Array.isArray(packet.groups) && packet.groups.length >= 1 && packet.groups.length <= 8,
    'Invalid waveform group count.');
  let receivedBytes = 0;
  const groups = [];
  for (const entry of packet.groups) {
    const {label, originality, frequency, samples, channels, sampleSha256, base64} = entry;
    requireValue(safeText(label, 64) && ['ORIGINAL', 'DERIVED'].includes(originality) &&
      Number.isFinite(frequency) && frequency >= 1 && frequency <= 20000 &&
      Number.isInteger(samples) && samples >= 2 && samples <= 120000 &&
      Array.isArray(channels) && channels.length === 12, 'Invalid waveform group metadata.');
    const names = new Set();
    for (const channel of channels) {
      requireValue(safeText(channel.label, 80) && !names.has(channel.label) &&
        channel.unit === 'uV' && Number.isFinite(channel.gain) && channel.gain > 0 && channel.gain <= 1e6 &&
        Number.isFinite(channel.baseline) && Math.abs(channel.baseline) <= 1e9, 'Invalid lead calibration.');
      names.add(channel.label);
    }
    const bytes = samples * channels.length * 2;
    receivedBytes += bytes;
    requireValue(receivedBytes <= 4 * 1024 * 1024 && identity.test(sampleSha256 ?? '') &&
      typeof base64 === 'string' && base64.length === 4 * Math.ceil(bytes / 3), 'Invalid waveform byte count.');
    const binary = atob(base64);
    requireValue(binary.length === bytes, 'Waveform byte count mismatch.');
    const raw = Uint8Array.from(binary, char => char.charCodeAt(0));
    requireValue(await sha256(raw) === sampleSha256, 'Waveform SHA-256 mismatch.');
    groups.push({label, originality, frequency, samples, channels, sampleSha256, wire: new DataView(raw.buffer)});
  }
  return {source, groups};
}

export function ecgLead(group, index) {
  const lead = group.channels[index];
  requireValue(lead && Number.isInteger(index), 'Unknown waveform lead.');
  const values = new Float64Array(group.samples);
  for (let sample = 0; sample < values.length; sample++) {
    const offset = (sample * group.channels.length + index) * 2;
    values[sample] = group.wire.getInt16(offset, true) * lead.gain + lead.baseline;
  }
  return values;
}
