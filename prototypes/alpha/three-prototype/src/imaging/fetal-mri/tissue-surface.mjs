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
        // Source axes advance toward left, posterior, superior. World uses R, S, -A.
        positions.push(originRasMm[0]-(x+(c&1)-.5)*spacingMm[0],
          originRasMm[2]+(z+((c>>2)&1)-.5)*spacingMm[2],
          -originRasMm[1]+(y+((c>>1)&1)-.5)*spacingMm[1]);
        normals.push(-dx,dz,dy);
        colors.push(...palette.get(id));
      }
      indices.push(start,start+1,start+2,start,start+2,start+3);
      owners.push(id);
    }
  }
  return {positions:new Float32Array(positions),colors:new Float32Array(colors),
    normals:new Float32Array(normals),indices:positions.length/3>65535?new Uint32Array(indices):new Uint16Array(indices),
    owners:new Uint16Array(owners)};
}
