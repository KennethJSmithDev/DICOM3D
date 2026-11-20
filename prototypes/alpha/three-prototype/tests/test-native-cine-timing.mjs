import assert from 'node:assert/strict';
import test from 'node:test';
import {sourceCineTiming} from '../src/imaging/native-cine-timing.mjs';

function frames(count, identity = {}, format = 'DICOM') {
  return {
    source:{format, identity},
    pixels:{shape:[count, 1, 1, 1]},
    frameIdentity:{frameNumbers:Array.from({length:count}, (_, index) => index + 1)},
  };
}

test('uses the fixed interval recorded by admitted DICOM frame bundles', () => {
  assert.deepEqual(sourceCineTiming(frames(2, {FrameTime:250})), [0, 250]);
  const times = sourceCineTiming(frames(30, {FrameTime:33.333, FrameIncrementPointer:'(0018,1063)'}));
  assert.equal(times.length, 30);
  assert.equal(times[29], 29 * 33.333);
});

test('uses cumulative source time increments and follows an explicit timing pointer', () => {
  const identity = {FrameTimeVector:[0, 40, 80, 25], FrameTime:55};
  assert.deepEqual(sourceCineTiming(frames(4, {...identity, FrameIncrementPointer:0x00181065})), [0, 40, 120, 145]);
  assert.deepEqual(sourceCineTiming(frames(4, {...identity, FrameIncrementPointer:['00181063']})), [0, 55, 110, 165]);
  assert.equal(sourceCineTiming(frames(4, identity)), null);
});

test('preserves manual frame navigation for untimed or unsupported frame metadata', () => {
  const rejected = [
    frames(44, {FrameIncrementPointer:'(0054,0080)'}),
    frames(44, {FrameTime:30, FrameIncrementPointer:'(0054,0080)'}),
    frames(44, {RecommendedDisplayFrameRate:30}),
    frames(1, {FrameTime:30}),
    frames(2, {FrameTime:30}, 'NIfTI'),
    frames(2, {FrameTime:0}),
    frames(2, {FrameTime:Infinity}),
    frames(2, {FrameTime:2_147_483_648}),
    frames(3, {FrameTimeVector:[1, 30, 30]}),
    frames(3, {FrameTimeVector:[0, 0, 30]}),
    frames(3, {FrameTimeVector:[0, 30, -1]}),
    frames(3, {FrameTimeVector:[0, 30]}),
    frames(3, {FrameTime:30, FrameIncrementPointer:'(0018,1065)'}),
  ];
  for (const input of rejected) assert.equal(sourceCineTiming(input), null);
});
