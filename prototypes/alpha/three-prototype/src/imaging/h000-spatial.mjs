// Reuse the source-frame mapping already qualified for the H000 viewer.
import {planeModel} from '../../../viewer/src/ct-spatial.mjs';
export function sourceFrameCorners(study, frame) {
  return planeModel(study.manifest.spatial.matrices,frame);
}
