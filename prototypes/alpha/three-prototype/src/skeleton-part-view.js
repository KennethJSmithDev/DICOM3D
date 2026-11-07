import {BufferGeometry,BufferAttribute,Box3} from 'three';

// Source-part ranges are verified against the unchanged admitted aggregate.
// Allocate independent attributes: disposing a part must never invalidate its source buffers.
export function copySourcePartGeometry(source,part){
 const p=source.getAttribute('position'),n=source.getAttribute('normal'),ix=source.getIndex();
 const {vertexStart:v,vertexCount:nv,indexStart:i,indexCount:ni}=part;
 if(![v,nv,i,ni].every(Number.isInteger)||v<0||i<0||nv<=0||ni<=0||ni%3||!p||!n||!ix||p.itemSize!==3||n.itemSize!==3||v+nv>p.count||v+nv>n.count||i+ni>ix.count)throw Error('Source part range does not match aggregate');
 const positions=p.array.slice(v*3,(v+nv)*3),normals=n.array.slice(v*3,(v+nv)*3),indices=new Uint32Array(ni);
 for(let k=0;k<ni;k++){const value=ix.array[i+k]-v;if(value<0||value>=nv)throw Error('Source part index escaped its range');indices[k]=value;}
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(positions,3));g.setAttribute('normal',new BufferAttribute(normals,3));g.setIndex(new BufferAttribute(indices,1));g.computeBoundingBox();g.computeBoundingSphere();g.userData={sourcePartId:part.id,sourceElement:part.elementId,sourceConcept:part.conceptId,aggregateOwner:part.ownerId,sourceSha256:part.sourceSha256};return g;
}
export function sourcePartAtFace(parts,faceIndex){
 if(!Number.isInteger(faceIndex)||faceIndex<0)return null;
 const offset=faceIndex*3;let lo=0,hi=parts.length-1;
 while(lo<=hi){const mid=(lo+hi)>>1,p=parts[mid];if(offset<p.indexStart)hi=mid-1;else if(offset>=p.indexStart+p.indexCount)lo=mid+1;else return p;}
 return null;
}
export function findSkeletonOwner(bundles){let owner=null;for(const {scene} of bundles.values())scene.traverse(n=>{if(n.isMesh&&n.userData.semanticId==='FMA23881')owner=n});return owner;}
export function sourcePartBounds(owner,geometry){owner.updateWorldMatrix(true,false);return new Box3().copy(geometry.boundingBox).applyMatrix4(owner.matrixWorld);}
