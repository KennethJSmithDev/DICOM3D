import {Matrix4, Vector3} from 'three';

/** Camera-only perspective fit. Does not mutate bounds, scene geometry or transforms. */
export function fitPerspectiveBounds(camera, controls, bounds, direction, padding=1.14){
  if(!camera?.isPerspectiveCamera || !controls || !bounds || bounds.isEmpty() || !(camera.aspect>0) || !(camera.fov>0&&camera.fov<180) || !(padding>=1)) return false;
  const center=bounds.getCenter(new Vector3()), d=direction.clone();
  if(d.lengthSq()<1e-16)d.set(0,0,1);d.normalize();
  // lookAt uses the same up vector as the camera. Prevent degenerate side views.
  const up=camera.up.clone().normalize();if(Math.abs(d.dot(up))>.9999){const side=new Vector3(1,0,0);if(Math.abs(up.dot(side))>.9)side.set(0,0,1);side.addScaledVector(up,-side.dot(up)).normalize();d.addScaledVector(side,.015).normalize();}
  const rotation=new Matrix4().lookAt(d,new Vector3(),up),e=rotation.elements;
  const right=new Vector3(e[0],e[1],e[2]),vertical=new Vector3(e[4],e[5],e[6]);
  const tanY=Math.tan(camera.fov*Math.PI/360),tanX=tanY*camera.aspect;
  let distance=0,front=-Infinity,back=Infinity;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const p=new Vector3(x,y,z).sub(center),depth=p.dot(d);front=Math.max(front,depth);back=Math.min(back,depth);
    distance=Math.max(distance,depth+padding*Math.max(Math.abs(p.dot(right))/tanX,Math.abs(p.dot(vertical))/tanY));
  }
  const size=bounds.getSize(new Vector3()).length();distance=Math.max(distance,front+Math.max(size*.01,1e-5));
  camera.position.copy(center).addScaledVector(d,distance);controls.target.copy(center);
  const nearest=distance-front,farthest=distance-back;
  camera.near=Math.min(camera.near,Math.max(1e-6,nearest*.1));camera.far=Math.max(camera.far,farthest*2,1);
  camera.updateProjectionMatrix();controls.update();camera.updateMatrixWorld();return true;
}
