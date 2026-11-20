import {Vector3} from 'three';

export function sourceCameraBasis(corners) {
  const origin=new Vector3().fromArray(corners);
  const right=new Vector3().fromArray(corners,3).sub(origin).normalize();
  const up=origin.clone().sub(new Vector3().fromArray(corners,6)).normalize();
  // DataTexture row zero starts at corner zero. Preserve its top-left orientation.
  const facing=right.clone().cross(up).normalize().addScaledVector(right,.09).normalize();
  return {facing,up,right};
}
