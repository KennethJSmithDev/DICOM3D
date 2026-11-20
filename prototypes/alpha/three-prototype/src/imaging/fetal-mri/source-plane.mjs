import {readBrainPixel} from './fetal-brain.mjs';

// UV (0,0) samples the top-left pixel in our unflipped DataTexture. The quad ends
// half a sample beyond each outer pixel center, in the tissue mesh's R, S, -A frame.
export function sourcePlaneCorners(volume,axis,index,width,height) {
  const at=(x,y)=>readBrainPixel(volume,{axis,index,x,y}).ijk;
  const origin=at(0,0), right=at(1,0), down=at(0,1);
  const corners=[];
  for(const [u,v] of [[-.5,-.5],[width-.5,-.5],[-.5,height-.5],[width-.5,height-.5]]) {
    const ras=origin.map((value,k)=>volume.originRasMm[k]+volume.signedSpacingRasMm[k]*
      (value+u*(right[k]-value)+v*(down[k]-value)));
    corners.push(ras[0],ras[2],-ras[1]);
  }
  return new Float32Array(corners);
}
