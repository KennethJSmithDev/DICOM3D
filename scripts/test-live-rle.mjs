import assert from 'node:assert/strict';
import test from 'node:test';
import {decodeRlePixels, dicomRleLossless} from './live-rle.mjs';

function item(element, value) {
  const header = Buffer.alloc(8);
  header.writeUInt16LE(0xfffe, 0);
  header.writeUInt16LE(element, 2);
  header.writeUInt32LE(value.length, 4);
  return Buffer.concat([header, value]);
}

const segment = bytes => Buffer.from(bytes);

function fragment(segments) {
  const header = Buffer.alloc(64);
  header.writeUInt32LE(segments.length);
  let offset = header.length;
  for (let i = 0; i < segments.length; i++) {
    header.writeUInt32LE(offset, (i + 1) * 4);
    offset += segments[i].length;
  }
  return item(0xe000, Buffer.concat([header, ...segments]));
}

function dicom(fragments, withOffsets = true) {
  const meta = Buffer.alloc(144);
  meta.write('DICM', 128);
  meta.writeUInt32LE(2, 132);
  meta.write('UL', 136);
  meta.writeUInt16LE(4, 138);
  const uid = Buffer.from(dicomRleLossless + '\0');
  const syntax = Buffer.alloc(8 + uid.length);
  syntax.writeUInt16LE(2, 0);
  syntax.writeUInt16LE(0x10, 2);
  syntax.write('UI', 4);
  syntax.writeUInt16LE(uid.length, 6);
  uid.copy(syntax, 8);
  meta.writeUInt32LE(syntax.length, 140);
  const pixelHeader = Buffer.from('e07f10004f420000ffffffff', 'hex');
  const offsets = Buffer.alloc(withOffsets ? fragments.length * 4 : 0);
  let cursor = 0;
  if (withOffsets) {
    for (const [index, frame] of fragments.entries()) {
      offsets.writeUInt32LE(cursor, index * 4);
      cursor += frame.length;
    }
  }
  const pixelOffset = meta.length + syntax.length;
  const firstFragment = pixelOffset + pixelHeader.length + 8 + offsets.length;
  const original = Buffer.concat([meta, syntax, pixelHeader, item(0xe000, offsets),
    ...fragments, item(0xe0dd, Buffer.alloc(0))]);
  return {original, pixelOffset, firstFragment};
}

const planeA = segment([2, 9, 200, 254, 254, 70]);
const planeB = segment([254, 4, 2, 7, 8, 9]);
const shape = [2, 2, 3, 1];

test('decodes literal and repeat runs in frame order with either permitted Basic Offset Table', () => {
  for (const withOffsets of [true, false]) {
    const {original, pixelOffset} = dicom([fragment([planeA]), fragment([planeB])], withOffsets);
    const pixels = decodeRlePixels(original, pixelOffset, shape, '|u1', 8);
    assert.deepEqual([...pixels], [9, 200, 254, 70, 70, 70, 4, 4, 4, 7, 8, 9]);
  }
});

test('combines little-endian words and preserves only the declared stored bits', () => {
  const {original, pixelOffset} = dicom([fragment([planeA, planeB])]);
  const pixels = decodeRlePixels(original, pixelOffset, [1, 2, 3, 1], '<u2', 12);
  assert.deepEqual([...pixels], [4, 9, 4, 8, 4, 14, 7, 6, 8, 6, 9, 6]);
});

test('rejects bad offset tables, frame layouts and incomplete streams', () => {
  const {original, pixelOffset, firstFragment} = dicom([fragment([planeA]), fragment([planeB])]);
  const invalid = (data, dimensions = shape) =>
    assert.throws(() => decodeRlePixels(data, pixelOffset, dimensions, '|u1', 8), /DICOM RLE/);
  invalid(original.subarray(0, -1));
  invalid(original, [1, 2, 3, 1]);
  invalid(original, [256, 4096, 4096, 1]);
  const wrongOffset = Buffer.from(original);
  wrongOffset.writeUInt32LE(9, firstFragment - 4);
  invalid(wrongOffset);
  const badRun = Buffer.from(original);
  badRun[firstFragment + 8 + 64] = 3;
  invalid(badRun);
  const badSegment = Buffer.from(original);
  badSegment.writeUInt32LE(0xfffffff0, firstFragment + 8 + 4);
  invalid(badSegment);
  const wrongSyntax = Buffer.from(original);
  wrongSyntax[152] = 0;
  invalid(wrongSyntax);
});
