export const dicomRleLossless = '1.2.840.10008.1.2.5';
const maximumBytes = 8 * 1024 * 1024;
const extendedVr = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'SV', 'UC', 'UN', 'UR', 'UT', 'UV']);
const itemTag = 0xe000fffe;
const delimiterTag = 0xe0ddfffe;

function requireRle(condition) {
  if (!condition) throw new Error('Invalid or unsupported DICOM RLE pixel data');
}

function verifyTransferSyntax(data, pixelOffset) {
  requireRle(data.length >= 144 && data.toString('latin1', 128, 132) === 'DICM');
  requireRle(data.readUInt32LE(132) === 2 && data.toString('latin1', 136, 138) === 'UL' &&
    data.readUInt16LE(138) === 4);
  const end = 144 + data.readUInt32LE(140);
  requireRle(end <= pixelOffset && end <= 16 * 1024);
  let found = false;
  for (let offset = 144; offset < end;) {
    requireRle(offset + 8 <= end && data.readUInt16LE(offset) === 2);
    const element = data.readUInt16LE(offset + 2);
    const vr = data.toString('latin1', offset + 4, offset + 6);
    const long = extendedVr.has(vr);
    const start = offset + (long ? 12 : 8);
    requireRle(start <= end);
    const length = long ? data.readUInt32LE(offset + 8) : data.readUInt16LE(offset + 6);
    requireRle(length % 2 === 0 && start + length <= end);
    if (element === 0x10) {
      const uid = data.toString('latin1', start, start + length).replace(/\0$/, '');
      requireRle(!found && vr === 'UI' && uid === dicomRleLossless);
      found = true;
    }
    offset = start + length;
  }
  requireRle(found);
}

function nextItem(data, offset, expectedTag) {
  requireRle(offset + 8 <= data.length && data.readUInt32LE(offset) === expectedTag);
  const length = data.readUInt32LE(offset + 4);
  const start = offset + 8;
  const end = start + length;
  requireRle(length % 2 === 0 && end <= data.length);
  return { start, end, length };
}

function decodeSegment(data, pixels, byteOffset, step, rows, columns) {
  let offset = 0;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns;) {
      requireRle(offset < data.length);
      const control = data.readInt8(offset++);
      if (control === -128) continue;
      const count = control >= 0 ? control + 1 : 1 - control;
      const consumed = control >= 0 ? count : 1;
      requireRle(count <= columns - column && offset + consumed <= data.length);
      let destination = byteOffset + (row * columns + column) * step;
      for (let i = 0; i < count; i++, destination += step) {
        pixels[destination] = data[offset + (control >= 0 ? i : 0)];
      }
      offset += consumed;
      column += count;
    }
  }
  requireRle(offset === data.length || (offset + 1 === data.length && data[offset] === 0));
}

function decodeFrame(fragment, pixels, frameOffset, unit, rows, columns) {
  requireRle(fragment.length >= 64 && fragment.readUInt32LE(0) === unit &&
    fragment.readUInt32LE(4) === 64);
  for (let unused = unit + 1; unused < 16; unused++) {
    requireRle(fragment.readUInt32LE(unused * 4) === 0);
  }
  for (let segment = 0; segment < unit; segment++) {
    const start = fragment.readUInt32LE((segment + 1) * 4);
    const end = segment + 1 === unit ? fragment.length : fragment.readUInt32LE((segment + 2) * 4);
    requireRle(start >= 64 && end > start && end <= fragment.length && (end - start) % 2 === 0);
    // DICOM orders the most significant byte plane first; the viewer keeps little-endian samples.
    decodeSegment(fragment.subarray(start, end), pixels, frameOffset + unit - 1 - segment,
      unit, rows, columns);
  }
}

export function decodeRlePixels(original, pixelOffset, shape, dtype, storedBits) {
  requireRle(Array.isArray(shape) && shape.length === 4 &&
    shape.every(value => Number.isInteger(value) && value >= 1 && value <= 4096));
  const [frames, rows, columns, channels] = shape;
  const unit = dtype === '|u1' ? 1 : dtype === '<u2' || dtype === '<i2' ? 2 : 0;
  const frameBytes = rows * columns * unit;
  requireRle(channels === 1 && frames <= 256 && unit !== 0 && frames * frameBytes <= maximumBytes &&
    Number.isInteger(storedBits) && storedBits >= 1 && storedBits <= unit * 8 &&
    (storedBits === unit * 8 || dtype === '<u2'));
  requireRle(Buffer.isBuffer(original) && original.length <= maximumBytes &&
    Number.isInteger(pixelOffset) && pixelOffset >= 144 && pixelOffset + 12 <= original.length);
  verifyTransferSyntax(original, pixelOffset);
  requireRle(original.readUInt32LE(pixelOffset) === 0x00107fe0 &&
    original.toString('latin1', pixelOffset + 4, pixelOffset + 6) === 'OB' &&
    original.readUInt16LE(pixelOffset + 6) === 0 && original.readUInt32LE(pixelOffset + 8) === 0xffffffff);
  const offsets = nextItem(original, pixelOffset + 12, itemTag);
  requireRle(offsets.length === 0 || offsets.length === frames * 4);
  const pixels = Buffer.alloc(frames * frameBytes);
  let position = offsets.end;
  for (let frame = 0; frame < frames; frame++) {
    // RLE Lossless has one fragment per frame, allowing bounded admission even with an empty table.
    requireRle(offsets.length === 0 || original.readUInt32LE(offsets.start + frame * 4) === position - offsets.end);
    const fragment = nextItem(original, position, itemTag);
    decodeFrame(original.subarray(fragment.start, fragment.end), pixels, frame * frameBytes, unit, rows, columns);
    position = fragment.end;
  }
  requireRle(nextItem(original, position, delimiterTag).length === 0);
  if (storedBits < unit * 8) {
    const mask = (1 << storedBits) - 1;
    for (let i = 0; i < pixels.length; i += 2) pixels.writeUInt16LE(pixels.readUInt16LE(i) & mask, i);
  }
  return pixels;
}
