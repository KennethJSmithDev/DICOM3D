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

// Perspective fit in the current ArcRotate basis. Only the presentation camera
// moves; width may limit the requested vertical occupancy on very narrow views.
export function presentationDistance(bounds,fov,aspect,alpha,beta,verticalFill=.8,horizontalFill=.9) {
  if(!bounds||!(fov>0&&fov<Math.PI)||!(aspect>0)||!(verticalFill>0&&verticalFill<1)||!(horizontalFill>0&&horizontalFill<1))throw Error('Invalid presentation camera fit');
  const eye=[Math.cos(alpha)*Math.sin(beta),Math.cos(beta),Math.sin(alpha)*Math.sin(beta)];
  const right=[-Math.sin(alpha),0,Math.cos(alpha)];
  const up=[-Math.cos(alpha)*Math.cos(beta),Math.sin(beta),-Math.sin(alpha)*Math.cos(beta)];
  const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);let distance=1e-6;const tan=Math.tan(fov/2);
  for(let mask=0;mask<8;mask++) {
    const q=[0,1,2].map(k=>((mask&(1<<k))?bounds.max[k]:bounds.min[k])-bounds.center[k]);
    const depth=dot(q,eye);
    distance=Math.max(distance,depth+Math.abs(dot(q,up))/(verticalFill*tan),depth+Math.abs(dot(q,right))/(horizontalFill*tan*aspect));
  }
  return distance;
}
