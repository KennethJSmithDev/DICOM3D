import {Box3,Matrix4,Vector3} from 'three';
export const NRX_LIMITS=Object.freeze({vertices:1024,indices:6144,resolutions:[32,64]});
/** Pack existing triangles in owner-local coordinates. Exact positional welding only;
 * no decimation, relabeling, topology repair, reflection or source mutation. */
export function prepareReferenceOwner(bundles,selected){
 let owner=null,item=null;
 for(const candidate of bundles.values())candidate.scene.traverse(n=>{if(n.userData?.semanticId===selected){if(owner)throw Error('Ambiguous source owner');owner=n;item=candidate;}});
 if(!owner)throw Error('Selected reference structure is not loaded');
 owner.updateWorldMatrix(true,true);
 const inverse=new Matrix4().copy(owner.matrixWorld).invert(),positions=[],indices=[],unique=new Map(),v=new Vector3();
 owner.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry)return;
  if(mesh.isSkinnedMesh||mesh.morphTargetInfluences?.some(Boolean))throw Error('Deformed sources are not supported by the bounded NRX bridge');
  if(mesh!==owner&&mesh.userData?.semanticId&&mesh.userData.semanticId!==selected)throw Error('Nested independent owners require separate admission');
  const pos=mesh.geometry.getAttribute('position');if(!pos)throw Error('Missing source positions');
  const index=mesh.geometry.index, count=index?index.count:pos.count;
  if(count%3)throw Error('Source is not a triangle list');
  const matrix=new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
  for(let i=0;i<count;i++){
   const k=index?index.getX(i):i;v.fromBufferAttribute(pos,k).applyMatrix4(matrix);
   if(![v.x,v.y,v.z].every(Number.isFinite))throw Error('Nonfinite source position');
   const key=[v.x,v.y,v.z].join(',');let id=unique.get(key);
   if(id===undefined){id=positions.length/3;unique.set(key,id);positions.push(v.x,v.y,v.z);}indices.push(id);
   if(indices.length>NRX_LIMITS.indices||positions.length/3>NRX_LIMITS.vertices)throw Error(`Unchanged NRX ABI limit: at most ${NRX_LIMITS.vertices} vertices / ${NRX_LIMITS.indices/3} triangles; this owner requires a separate extension`);
  }
 });
 if(positions.length<12||indices.length<12)throw Error('Insufficient source geometry');
 const edges=new Map();let volume=0;
 for(let i=0;i<indices.length;i+=3){
  const ids=indices.slice(i,i+3);if(new Set(ids).size!==3)throw Error('Source has degenerate triangles');
  const a=ids.map(id=>new Vector3(...positions.slice(id*3,id*3+3)));
  const cross=new Vector3().subVectors(a[1],a[0]).cross(new Vector3().subVectors(a[2],a[0]));if(cross.lengthSq()===0)throw Error('Source has zero-area triangles');
  volume+=a[0].dot(new Vector3().copy(a[1]).cross(a[2]))/6;
  for(let j=0;j<3;j++){const x=ids[j],y=ids[(j+1)%3],key=[Math.min(x,y),Math.max(x,y)].join(',');const e=edges.get(key)||[0,0];e[0]++;e[1]+=x<y?1:-1;edges.set(key,e);}
 }
 if([...edges.values()].some(([count,orientation])=>count!==2||orientation!==0))throw Error('Source is open, nonmanifold or inconsistently wound; original retained');
 if(!(volume>0))throw Error('Source winding is nonpositive; no automatic flip');
 const bounds=new Box3();for(let i=0;i<positions.length;i+=3)bounds.expandByPoint(new Vector3(...positions.slice(i,i+3)));
 const center=bounds.getCenter(new Vector3()),size=bounds.getSize(new Vector3()),scale=Math.max(size.x,size.y,size.z)/2;
 if(!(scale>0&&Number.isFinite(scale)))throw Error('Invalid source bounds');
 const normalized=new Float32Array(positions.map((value,i)=>(value-center.getComponent(i%3))/scale)),ix=new Uint32Array(indices);
 const bytes=new Uint8Array(normalized.byteLength+ix.byteLength);bytes.set(new Uint8Array(normalized.buffer));bytes.set(new Uint8Array(ix.buffer),normalized.byteLength);
 return {owner,bytes,positions:new Float64Array(positions),indices:ix,center:center.toArray(),scale,positionCount:positions.length/3,indexCount:indices.length,sourceId:selected,sourceAssetSha256:item.manifest?.asset?.sha256??null,sourceVolumeLocal:volume};
}
