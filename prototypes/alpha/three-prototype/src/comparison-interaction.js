import {Raycaster,Vector2} from 'three';

export function referenceOwner(node){for(let n=node;n;n=n.parent)if(n.userData?.semanticId)return n.userData.semanticId;return null}
export function referenceVisible(node){for(let n=node;n;n=n.parent)if(!n.visible)return false;return true}
// Mesh buffers and transforms stay shared with immutable source; only cloned materials change.
export function applyReferenceOpacity(scene,allOpacity,overrides={}){
 if(!Number.isFinite(allOpacity)||allOpacity<0||allOpacity>1)throw Error('Reference opacity must be between zero and one');
 scene.traverse(n=>{if(!n.isMesh)return;const factor=overrides[referenceOwner(n)]??1;
 if(!Number.isFinite(factor)||factor<0||factor>1)throw Error('Piece opacity must be between zero and one');
 for(const material of Array.isArray(n.material)?n.material:[n.material]){
  const base=material.userData.comparisonBaseOpacity??material.opacity;
  material.userData.comparisonBaseOpacity=base;material.opacity=base*allOpacity*factor;
  material.transparent=material.opacity<1;material.depthWrite=material.opacity>=1;material.needsUpdate=true;
 }
 });
}
export function pickReferenceAt(scenes,camera,rect,x,y){
 if(rect.width<=0||rect.height<=0)return null;
 const ray=new Raycaster();ray.setFromCamera(new Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);
 for(const hit of ray.intersectObjects(scenes,true))if(referenceVisible(hit.object)){const id=referenceOwner(hit.object);if(id)return id}
 return null;
}
