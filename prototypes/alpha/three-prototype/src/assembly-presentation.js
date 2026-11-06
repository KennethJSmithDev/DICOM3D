import {Box3,Vector3} from 'three';

// WHY: reversible exploded reference anatomy without editing source positions/geometry.
// BOUNDARY: layout offsets are explanatory, not anatomical movement or tissue cuts.
// INVARIANT: offsets depend on original world bounds and stable ID, never loading order.
export function assemblyOffset(node, id) {
  node.updateWorldMatrix(true,true);
  const center=new Box3().setFromObject(node).getCenter(new Vector3());
  let direction=new Vector3(center.x, (center.y-.9)*.25, center.z);
  if(direction.lengthSq()<1e-8) {
    const hash=[...id].reduce((a,c)=>(Math.imul(a,31)+c.charCodeAt(0))>>>0,0);
    direction.set(Math.cos(hash),.25,Math.sin(hash));
  }
  direction.normalize().multiplyScalar(.24);
  if(node.parent) {
    const origin=node.parent.worldToLocal(new Vector3(0,0,0));
    direction.copy(node.parent.worldToLocal(direction.clone()).sub(origin));
  }
  return direction;
}
