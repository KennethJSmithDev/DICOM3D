/** Presentation normals only: exact Float32 position keys, no position/index edit.
 * Equal-weight incident corner normals; preserves the native field/extraction output. */
export function smoothCoincidentNormals(positions,normals){
 if(!(positions instanceof Float32Array)||!(normals instanceof Float32Array)||positions.length!==normals.length||positions.length%3)throw Error('Invalid normal smoothing input');
 const bits=new Uint32Array(positions.buffer,positions.byteOffset,positions.length),sums=new Map(),keys=[];
 for(let i=0;i<positions.length;i+=3){
  const key=`${bits[i]},${bits[i+1]},${bits[i+2]}`;keys.push(key);const sum=sums.get(key)||[0,0,0];
  for(let axis=0;axis<3;axis++){if(!Number.isFinite(positions[i+axis])||!Number.isFinite(normals[i+axis]))throw Error('Nonfinite normal smoothing input');sum[axis]+=normals[i+axis];}sums.set(key,sum);
 }
 const output=new Float32Array(normals.length);
 for(let i=0;i<output.length;i+=3){let n=sums.get(keys[i/3]),length=Math.hypot(...n);if(length<1e-12){n=[normals[i],normals[i+1],normals[i+2]];length=Math.hypot(...n);}if(length<1e-12)throw Error('Zero native normal');for(let axis=0;axis<3;axis++)output[i+axis]=n[axis]/length;}
 return output;
}
