// Presentation bounds only: transform the eight local AABB corners, never vertices.
export function worldBounds(meshes) {
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const mesh of meshes) {
    if(!mesh.boundMin||!mesh.boundMax)continue;
    const m=mesh.worldMatrix;
    for(let mask=0;mask<8;mask++) {
      const p=[0,1,2].map(k=>(mask&(1<<k))?mesh.boundMax[k]:mesh.boundMin[k]);
      for(let k=0;k<3;k++) {
        const v=m[k]*p[0]+m[4+k]*p[1]+m[8+k]*p[2]+m[12+k];
        min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);
      }
    }
  }
  if(!min.every(Number.isFinite)||!max.every(Number.isFinite))return null;
  const center=min.map((v,k)=>(v+max[k])/2);
  return {min,max,center,radius:Math.hypot(...max.map((v,k)=>(v-min[k])/2))};
}

export function fitDistance(bounds,fov,aspect) {
  if(!bounds||!(fov>0&&fov<Math.PI)||!(aspect>0))throw Error('Invalid camera fit bounds or projection');
  const halfAngle=Math.min(fov/2,Math.atan(Math.tan(fov/2)*aspect));
  return Math.max(bounds.radius,1e-6)*1.15/Math.sin(halfAngle);
}
