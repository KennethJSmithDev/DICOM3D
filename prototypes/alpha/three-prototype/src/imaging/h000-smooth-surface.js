import {BufferAttribute, BufferGeometry, MeshBasicMaterial} from 'three';
import {MarchingCubes} from 'three/examples/jsm/objects/MarchingCubes.js';
import {point} from '../../../viewer/src/ct-spatial.mjs';

/** Display derivative of a verified binary mask. k/row/column sample centers are authoritative. */
export function generateH000Surface(study) {
  const mask=study?.mask, matrices=study?.manifest?.spatial?.matrices;
  if (!(mask instanceof Uint8Array) || mask.length!==103*512*512 || study?.binding?.semanticId!=='lesion.lung.mass.001' || study.binding.segment!==1 || !matrices?.index_to_patient_mm || !matrices?.patient_mm_to_model_m) throw Error('Unsupported or malformed H000 source');
  for(const name of ['index_to_patient_mm','patient_mm_to_model_m']){const m=matrices[name];if(!Array.isArray(m)||m.length!==4||m.some(row=>!Array.isArray(row)||row.length!==4||row.some(v=>!Number.isFinite(v)))||m[3].some((v,i)=>v!==(i===3?1:0)))throw Error('Invalid source transform')}
  const start=performance.now(), lo=[103,512,512],hi=[-1,-1,-1];let count=0;
  for(let i=0;i<mask.length;i++){const v=mask[i];if(v!==0&&v!==1)throw Error('Non-binary SEG mask');if(!v)continue;const k=Math.floor(i/262144),row=Math.floor(i/512)%512,col=i%512;const p=[k,row,col];for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],p[a]);hi[a]=Math.max(hi[a],p[a])}count++}
  if(!count)throw Error('Empty SEG mask');
  if(count!==study.binding.count)throw Error('SEG count differs from verified source binding');
  const padding=3,origin=lo.map(v=>v-padding), size=Math.max(...lo.map((v,i)=>hi[i]-v+1))+2*padding;
  if(size>128)throw Error('SEG region exceeds bounded surface grid');
  const material=new MeshBasicMaterial(),surface=new MarchingCubes(size,material,false,false,250000),n=size,n2=n*n;
  try {
    const raw=new Float32Array(n*n*n),tmp=new Float32Array(raw.length),tmp2=new Float32Array(raw.length);
    for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){const k=origin[0]+z,row=origin[1]+y,col=origin[2]+x;if(k>=0&&k<103&&row>=0&&row<512&&col>=0&&col<512)raw[z*n2+y*n+x]=mask[k*262144+row*512+col]}
    // One separable [1,2,1]/4 pass per axis, in source index space (anisotropic in mm).
    for(let z=1;z<n-1;z++)for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=z*n2+y*n+x;tmp[i]=(raw[i-1]+2*raw[i]+raw[i+1])/4}
    for(let z=1;z<n-1;z++)for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=z*n2+y*n+x;tmp2[i]=(tmp[i-n]+2*tmp[i]+tmp[i+n])/4}
    for(let z=1;z<n-1;z++)for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=z*n2+y*n+x;surface.field[i]=(tmp2[i-n2]+2*tmp2[i]+tmp2[i+n2])/4}
    surface.isolation=.5;surface.update();if(!surface.count || surface.count>750000)throw Error('Surface is empty or exceeds bounded output');
    const src=surface.geometry.getAttribute('position').array, rawPositions=new Float32Array(surface.count*3);
    for(let i=0;i<surface.count;i++){const j=i*3, col=origin[2]+(src[j]+1)*n/2,row=origin[1]+(src[j+1]+1)*n/2,k=origin[0]+(src[j+2]+1)*n/2;const model=point(matrices.patient_mm_to_model_m,point(matrices.index_to_patient_mm,[k,row,col]));if(model.some(v=>!Number.isFinite(v)))throw Error('Invalid derived position');rawPositions.set(model,j)}
    // MarchingCubes can emit repeated-vertex faces at exact isovalues. Remove
    // only zero-area display triangles after Float32 conversion; never move the
    // remaining vertices or change the authoritative mask and transform.
    let used=0,removedDegenerateTriangles=0;
    for(let i=0;i<rawPositions.length;i+=9){const ax=rawPositions[i+3]-rawPositions[i],ay=rawPositions[i+4]-rawPositions[i+1],az=rawPositions[i+5]-rawPositions[i+2],bx=rawPositions[i+6]-rawPositions[i],by=rawPositions[i+7]-rawPositions[i+1],bz=rawPositions[i+8]-rawPositions[i+2];if(ay*bz-az*by===0&&az*bx-ax*bz===0&&ax*by-ay*bx===0){removedDegenerateTriangles++;continue}rawPositions.copyWithin(used,i,i+9);used+=9}
    if(!used)throw Error('Surface contains no non-degenerate display triangles');
    const positions=rawPositions.slice(0,used);
    const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.computeVertexNormals();
    // Share display normals at coincident positions without welding or changing geometry.
    const normals=geometry.getAttribute('normal'), sums=new Map(), keys=[];
    for(let i=0;i<positions.length;i+=3){const key=[positions[i],positions[i+1],positions[i+2]].map(v=>Math.round(v*1e7)).join(',');keys.push(key);const sum=sums.get(key)||[0,0,0];for(let a=0;a<3;a++)sum[a]+=normals.array[i+a];sums.set(key,sum)}
    for(let i=0;i<keys.length;i++){const v=sums.get(keys[i]),length=Math.hypot(...v)||1;normals.setXYZ(i,v[0]/length,v[1]/length,v[2]/length)}normals.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const provenance={semanticId:study.binding.semanticId,segment:study.binding.segment,segSop:study.binding.segSop,study:study.manifest.source,maskSha256:study.manifest.provenance.C_mask.sha256,method:'Three.js MarchingCubes, binary SEG smoothed with separable [1,2,1]/4 in source index space, isovalue 0.5; exact zero-area display faces omitted',gridSize:n,originKRowColumn:origin,sourceBoundsKRowColumn:{min:lo,max:hi},sourceVoxels:count,triangles:positions.length/9,removedDegenerateTriangles,generationMs:performance.now()-start,limitation:'Display derivative; anisotropic smoothing may remove thin detail; not source mask or measurement geometry.'};
    geometry.userData.provenance=provenance;return {geometry,provenance};
  } finally {surface.geometry.dispose();material.dispose()}
}
