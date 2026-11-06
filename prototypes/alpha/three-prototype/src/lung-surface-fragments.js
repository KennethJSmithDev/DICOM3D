import {Box3, BufferAttribute, Group, Mesh, Vector3} from 'three';
import {setIndexAwareBounds} from './indexed-fragment-bounds.js';

/**
 * A reversible presentation projection of one admitted indexed lung surface.
 * Triangles are assigned by centroid to eight coarse spatial buckets; triangles
 * are not cut, interpolated, closed or classified. These are NOT tissue pieces,
 * segments, patient anatomy or registered imaging geometry. The original indexed
 * surface, materials, identity and coordinates remain untouched.
 */
export function createSurfaceFragments(owner) {
  if (!owner?.isMesh || !['FMA7309','FMA7310'].includes(owner.userData?.semanticId) || !owner.parent)
    throw new Error('An attached admitted source lung owner is required');
  const source=owner.geometry, pos=source?.getAttribute('position'), indices=source?.getIndex();
  if (!pos || pos.itemSize!==3 || !indices || indices.count%3 || Array.isArray(owner.material) || source.morphAttributes?.position?.length || owner.isSkinnedMesh)
    throw new Error('Unsupported source lung geometry');
  if (source.groups.length>1 || source.drawRange.start!==0 || source.drawRange.count!==Infinity)
    throw new Error('Unsupported source draw range');
  const sourceBounds=new Box3().setFromBufferAttribute(pos); const center=sourceBounds.getCenter(new Vector3());
  const extent=sourceBounds.getSize(new Vector3()); const buckets=Array.from({length:8},()=>[]);
  for(let t=0;t<indices.count;t+=3){
    const a=indices.getX(t),b=indices.getX(t+1),c=indices.getX(t+2);
    if([a,b,c].some(i=>!Number.isSafeInteger(i)||i<0||i>=pos.count)) throw new Error('Invalid source index');
    const x=(pos.getX(a)+pos.getX(b)+pos.getX(c))/3;
    const y=(pos.getY(a)+pos.getY(b)+pos.getY(c))/3;
    const z=(pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3;
    const k=(x>=center.x?1:0)|(y>=center.y?2:0)|(z>=center.z?4:0);
    buckets[k].push(a,b,c);
  }
  const group=new Group(); group.name='Derived open-surface fragments';
  group.position.copy(owner.position); group.quaternion.copy(owner.quaternion); group.scale.copy(owner.scale);
  const fragments=[];
  for(let i=0;i<8;i++){
    if(!buckets[i].length)continue;
    // clone() duplicates attributes, so disposing derived buffers cannot dispose
    // source geometry or invalidate another owner that shares its material.
    const geometry=source.clone(); geometry.clearGroups();
    const IndexArray=pos.count>65535?Uint32Array:Uint16Array;
    geometry.setIndex(new BufferAttribute(new IndexArray(buckets[i]),1));
    setIndexAwareBounds(geometry);
    const mesh=new Mesh(geometry,owner.material);mesh.name=`${owner.userData.semanticId}:surface-bin-${i}`;
    mesh.userData={semanticId:owner.userData.semanticId,fragmentBucket:i,classification:'derived spatial surface bucket; not anatomy'};
    mesh.castShadow=owner.castShadow;mesh.receiveShadow=owner.receiveShadow;
    const direction=new Vector3((i&1)?1:-1,(i&2)?1:-1,(i&4)?1:-1).normalize();
    const magnitude=Math.max(extent.x,extent.y,extent.z)*.20;
    group.add(mesh);fragments.push({mesh,bucket:i,direction,magnitude,triangleCount:buckets[i].length/3});
  }
  let desiredVisible=owner.visible, disposed=false;
  owner.parent.add(group);
  function sync(amount=0, sourceVisible=desiredVisible){
    if(disposed)throw new Error('Fragments disposed');
    desiredVisible=!!sourceVisible;group.visible=desiredVisible;owner.visible=false;
    group.position.copy(owner.position);group.quaternion.copy(owner.quaternion);group.scale.copy(owner.scale);
    const t=Math.max(0,Math.min(1,Number.isFinite(amount)?amount:0));
    for(const f of fragments) f.mesh.position.copy(f.direction).multiplyScalar(f.magnitude*t);
  }
  function dispose(){
    if(disposed)return;disposed=true;owner.visible=desiredVisible;group.removeFromParent();
    for(const f of fragments) f.mesh.geometry.dispose();
  }
  return {group,fragments,sync,dispose,sourceId:owner.userData.semanticId,
    sourceTriangles:indices.count/3,qualification:'visual triangle buckets; open surfaces; no anatomical meaning'};
}
