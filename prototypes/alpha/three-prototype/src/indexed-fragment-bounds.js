import {Box3, Sphere, Vector3} from 'three';

// A subset-indexed geometry can retain unused source vertices. Three's generic
// computeBoundingBox sees all positions, so derive bounds from drawn indices.
// Only metadata changes; no positions, normals or triangle ownership are edited.
export function setIndexAwareBounds(geometry) {
  const positions=geometry.getAttribute('position'),indices=geometry.getIndex();
  if(!positions||positions.itemSize!==3||!indices||indices.count===0) throw new Error('Expected nonempty indexed triangle geometry');
  const box=new Box3(), point=new Vector3(); box.makeEmpty();
  for(let i=0;i<indices.count;i++) {const n=indices.getX(i);if(!Number.isSafeInteger(n)||n<0||n>=positions.count)throw new Error('Invalid vertex index');point.fromBufferAttribute(positions,n);if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.z))throw new Error('Nonfinite vertex');box.expandByPoint(point);}
  const center=box.getCenter(new Vector3());let radius2=0;
  for(let i=0;i<indices.count;i++){point.fromBufferAttribute(positions,indices.getX(i));radius2=Math.max(radius2,point.distanceToSquared(center));}
  geometry.boundingBox=box;geometry.boundingSphere=new Sphere(center,Math.sqrt(radius2));return geometry;
}
