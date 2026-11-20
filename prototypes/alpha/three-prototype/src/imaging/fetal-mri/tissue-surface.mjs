import {BufferAttribute, Matrix3, Matrix4} from 'three';

// Each outward quad is a boundary between two source voxel cells. Keep its source
// ID for picking even when all touching tissues share a single outer surface.
const faces = [
  [[-1,0,0],[0,4,6,2]], [[1,0,0],[1,3,7,5]],
  [[0,-1,0],[0,1,5,4]], [[0,1,0],[2,6,7,3]],
  [[0,0,-1],[0,2,3,1]], [[0,0,1],[4,5,7,6]],
];

export function tissueSurface(volume, tissueId = 0) {
  const {dims:[nx,ny,nz], spacingMm, originRasMm, labels, byId} = volume;
  if (tissueId && !byId.has(tissueId)) throw Error('Unknown tissue');
  const positions = [], colors = [], normals = [], indices = [], owners = [];
  const palette = new Map();
  for (const [id,{rgb}] of byId) palette.set(id, rgb.map(value => {
    const s = value/255;
    return s <= 0.04045 ? s/12.92 : ((s+0.055)/1.055)**2.4;
  }));
  for (let i=0; i<labels.length; i++) {
    const id = labels[i];
    if (!id || (tissueId && id!==tissueId)) continue;
    const x=i%nx, y=Math.floor(i/nx)%ny, z=Math.floor(i/(nx*ny));
    for (const [[dx,dy,dz],corners] of faces) {
      const xx=x+dx, yy=y+dy, zz=z+dz;
      if (xx>=0 && xx<nx && yy>=0 && yy<ny && zz>=0 && zz<nz) {
        const neighbor=labels[xx+nx*(yy+ny*zz)];
        if (tissueId ? neighbor===tissueId : neighbor!==0) continue;
      }
      const start=positions.length/3;
      for (const c of corners) {
        positions.push(x+(c&1)-.5,y+((c>>1)&1)-.5,z+((c>>2)&1)-.5);
        normals.push(dx,dy,dz);
        colors.push(...palette.get(id));
      }
      indices.push(start,start+1,start+2,start,start+2,start+3);
      owners.push(id);
    }
  }
  const ras = volume.affineRasMm ?? [
    [-spacingMm[0],0,0,originRasMm[0]],[0,-spacingMm[1],0,originRasMm[1]],[0,0,spacingMm[2],originRasMm[2]],
  ];
  // Patient RAS millimetres map to Three's right, up, back axes as R, S, -A.
  const world=new Matrix4().set(...ras[0],...ras[2],...ras[1].map(v=>-v),0,0,0,1);
  const points=new BufferAttribute(new Float32Array(positions),3).applyMatrix4(world);
  const directions=new BufferAttribute(new Float32Array(normals),3).applyNormalMatrix(new Matrix3().getNormalMatrix(world));
  if(world.determinant()<0) {
    for(let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  }
  return {positions:points.array,colors:new Float32Array(colors),normals:directions.array,
    indices:points.count>65535?new Uint32Array(indices):new Uint16Array(indices),owners:new Uint16Array(owners)};
}
