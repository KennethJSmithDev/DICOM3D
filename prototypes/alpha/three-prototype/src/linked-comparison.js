import {Box3,Euler,Matrix4,Quaternion,Vector3} from 'three';
export const identityAlignment=()=>({translationMm:[0,0,0],rotationDegrees:[0,0,0],scale:1,axisScale:[1,1,1],method:'unaligned'});
// A reversible display transform only: never mutates atlas buffers or source transforms.
export function alignmentMatrix(value){
 if(!value||!['translationMm','rotationDegrees'].every(k=>Array.isArray(value[k])&&value[k].length===3&&value[k].every(Number.isFinite))||!Number.isFinite(value.scale)||value.scale<.1||value.scale>10)throw Error('Finite XYZ values and uniform scale 0.1–10 required');
 const axes=value.axisScale??[1,1,1];if(!Array.isArray(axes)||axes.length!==3||axes.some(v=>!Number.isFinite(v)||v<.1||v>10))throw Error('Each dimension scale must be 0.1–10');
 if(value.translationMm.some(v=>Math.abs(v)>10000)||value.rotationDegrees.some(v=>Math.abs(v)>360))throw Error('Display alignment exceeds bounded controls');
 return new Matrix4().compose(new Vector3(...value.translationMm).multiplyScalar(.001),new Quaternion().setFromEuler(new Euler(...value.rotationDegrees.map(v=>v*Math.PI/180),'XYZ')),new Vector3(...axes).multiplyScalar(value.scale));
}
export function centerReference(bounds,targetBounds,value=identityAlignment(),basis=new Matrix4()){
 if(bounds.isEmpty()||targetBounds.isEmpty())throw Error('Reference and scan bounds required');
 const noTranslation={...value,translationMm:[0,0,0]},transformed=bounds.clone().applyMatrix4(alignmentMatrix(noTranslation).multiply(basis));
 const delta=targetBounds.getCenter(new Vector3()).sub(transformed.getCenter(new Vector3())).multiplyScalar(1000);
 const result={...noTranslation,translationMm:delta.toArray(),method:'bounds-centred approximation'};alignmentMatrix(result);return result;
}
export function synchronizeComparisonCamera(target,source){
 if(!source?.isPerspectiveCamera)return false;
 target.position.copy(source.position);target.quaternion.copy(source.quaternion);target.up.copy(source.up);
 for(const key of ['fov','aspect','near','far','zoom','focus','filmGauge','filmOffset'])target[key]=source[key];
 target.projectionMatrix.copy(source.projectionMatrix);target.projectionMatrixInverse.copy(source.projectionMatrixInverse);target.updateMatrixWorld(true);return true;
}
export function cameraDifference(a,b){return !a||!b?null:Math.max(...a.matrixWorld.elements.map((v,i)=>Math.abs(v-b.matrixWorld.elements[i])),...a.projectionMatrix.elements.map((v,i)=>Math.abs(v-b.projectionMatrix.elements[i])))}
export function visibleSnapshotBounds(snapshots){const bounds=new Box3();for(const scene of snapshots){scene.updateMatrixWorld(true);scene.traverse(n=>{let visible=true;for(let p=n;p;p=p.parent)if(!p.visible)visible=false;if(n.isMesh&&visible)bounds.expandByObject(n)})}return bounds}
export function referenceBasis(atlasKey){return atlasKey==='male'?new Matrix4().makeRotationY(Math.PI):new Matrix4()}

// Match display bounds to a source-bound estimate, not a patient organ surface.
export function fitReferenceBounds(bounds,targetBounds,basis=new Matrix4()){
 if(bounds.isEmpty()||targetBounds.isEmpty())throw Error('Nonempty extent evidence required');
 const sourceSize=bounds.clone().applyMatrix4(basis).getSize(new Vector3()),targetSize=targetBounds.getSize(new Vector3());
 if(sourceSize.toArray().some(v=>v<=0))throw Error('Degenerate reference extent');
 const value={...identityAlignment(),axisScale:targetSize.divide(sourceSize).toArray()};alignmentMatrix(value);
 return {...centerReference(bounds,targetBounds,value,basis),method:'CT-derived extent fit (approximate)'};
}
