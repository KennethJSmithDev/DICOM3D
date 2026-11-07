// Exact separable occupancy sampling reused from the existing Three H000 generator.
// Local index-space smoothing is anisotropic in physical space and loses thin features.
export function prepareField(mask,expectedCount){
 if(!(mask instanceof Uint8Array)||mask.length!==103*512*512)throw Error('Unsupported H000 SEG grid');
 const lo=[103,512,512],hi=[-1,-1,-1];let count=0;
 for(let i=0;i<mask.length;i++){const v=mask[i];if(v!==0&&v!==1)throw Error('Non-binary source SEG');if(!v)continue;const p=[Math.floor(i/262144),Math.floor(i/512)%512,i%512];for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],p[a]);hi[a]=Math.max(hi[a],p[a])}count++}
 if(!count)throw Error('Empty source SEG');if(count!==expectedCount)throw Error('Source SEG count mismatch');
 const origin=lo.map(v=>v-3),size=Math.max(...lo.map((v,i)=>hi[i]-v+1))+6;if(size>87)throw Error('NRX adapter grid exceeds qualified bound');
 const n=size,n2=n*n,raw=new Float32Array(n*n*n),tmp=new Float32Array(raw.length),tmp2=new Float32Array(raw.length),field=new Float32Array(raw.length);
 for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){const k=origin[0]+z,row=origin[1]+y,col=origin[2]+x;if(k>=0&&k<103&&row>=0&&row<512&&col>=0&&col<512)raw[z*n2+y*n+x]=mask[k*262144+row*512+col]}
 for(let z=1;z<n-1;z++)for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=z*n2+y*n+x;tmp[i]=(raw[i-1]+2*raw[i]+raw[i+1])/4}
 for(let z=1;z<n-1;z++)for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=z*n2+y*n+x;tmp2[i]=(tmp[i-n]+2*tmp[i]+tmp[i+n])/4}
 for(let z=1;z<n-1;z++)for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=z*n2+y*n+x;field[i]=(tmp2[i-n2]+2*tmp2[i]+tmp2[i+n2])/4}
 return {field,size,origin,count};
}
const point=(m,p)=>m.slice(0,3).map(r=>r[3]+p.reduce((sum,v,i)=>sum+v*r[i],0));
export function recordsToModel(records,matrices){
 for(const key of ['index_to_patient_mm','patient_mm_to_model_m']){const m=matrices?.[key];if(m?.length!==4||m.some(r=>r?.length!==4||r.some(v=>!Number.isFinite(v)))||m[3].some((v,i)=>v!==(i===3?1:0)))throw Error('Invalid source affine')}
 const data=new DataView(records.buffer,records.byteOffset,records.byteLength),count=Number(data.getBigUint64(0,true));if(count<=0||count>250000||records.length!==8+count*84)throw Error('Empty or invalid NRX surface');
 const positions=new Float32Array(count*9);let signedBefore=0,signedAfter=0;
 for(let t=0;t<count;t++){const vertices=[];for(let j=0;j<3;j++){const off=8+(t*3+j)*28;const p=[16,20,24].map(o=>data.getFloat32(off+o,true));vertices.push(point(matrices.patient_mm_to_model_m,point(matrices.index_to_patient_mm,p)))}
 // Explicit orientation correction established by same-H000-field comparison; no coordinate mutation.
 for(let j=0;j<3;j++)positions.set(vertices[[0,2,1][j]],t*9+j*3);
 const [a,b,c]=vertices;signedBefore+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
 }
 signedAfter=-signedBefore;if(!(signedBefore<0&&signedAfter>0))throw Error('NRX orientation differs from qualified H000 convention');
 return {positions,triangles:count,signedBefore,signedAfter};
}
