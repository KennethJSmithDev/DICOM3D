const timingTag = '00181063';
const vectorTag = '00181065';
const maximumDelay = 2_147_483_647;

function tagId(tag) {
  if (Number.isInteger(tag)) return tag.toString(16).padStart(8, '0');
  return typeof tag === 'string' ? tag.replace(/[\s(),]/g, '').toLowerCase() : null;
}

export function sourceCineTiming(bundle) {
  const source = bundle?.source;
  const frameCount = bundle?.pixels?.shape?.[0];
  if (source?.format !== 'DICOM' || !Number.isInteger(frameCount) || frameCount < 2 ||
      frameCount > 256 || bundle.frameIdentity?.frameNumbers?.length !== frameCount) return null;

  const {FrameTime, FrameTimeVector, FrameIncrementPointer} = source.identity ?? {};
  let tag;
  if (FrameIncrementPointer === undefined) {
    // Existing verified bundles may omit the pointer but preserve one timing tag.
    if ((FrameTime !== undefined) === (FrameTimeVector !== undefined)) return null;
    tag = FrameTimeVector === undefined ? timingTag : vectorTag;
  } else {
    const tags = [FrameIncrementPointer].flat();
    if (tags.length !== 1) return null;
    tag = tagId(tags[0]);
  }
  const validIncrement = value => Number.isFinite(value) && value > 0 && value <= maximumDelay;
  if (tag === timingTag && validIncrement(FrameTime)) {
    return Array.from({length:frameCount}, (_, index) => index * FrameTime);
  }
  // PS3.3 C.7.6.5: element i is the increment from the previous frame, with an initial zero.
  if (tag !== vectorTag || !Array.isArray(FrameTimeVector) || FrameTimeVector.length !== frameCount ||
      FrameTimeVector[0] !== 0 || !FrameTimeVector.slice(1).every(validIncrement)) return null;
  let elapsed = 0;
  return FrameTimeVector.map(increment => elapsed += increment);
}
