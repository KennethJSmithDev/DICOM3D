import {publicAtlasAssets} from '../../public-asset-cache.js';

export const myomaSourceNotice=new URL('./UMD-NOTICE.txt?no-inline',import.meta.url).href;
const assets=[
  [new URL('./UMD_221129_001_t2.nii.gz',import.meta.url),7117826,'1b120daa7e86e8bffda8017007aa2363005cd9ba5d5462bf63e772b2a0e4bae1'],
  [new URL('./UMD_221129_001_seg.nii.gz',import.meta.url),22332,'779f34c85bd1cf3e32e5e700db559cb13f5427cfe8623a3c24a115551da5b573'],
];
const dims=[672,672,20], voxelCount=dims[0]*dims[1]*dims[2];
const spacing=[0.4464285671710968,0.4464285671710968,6.599996566772461];
const names=['Background','Uterine wall','Uterine cavity','Myoma','Nabothian cyst'];
const colors=[[0,0,0],[42,185,177],[112,176,254],[255,132,62],[211,126,230]];
const expectedCounts=[8955901,69765,4628,1296,90];
const axes={sagittal:[2,0,1],coronal:[0,2,1],axial:[1,0,2]};

// NIfTI qform maps the native oblique grid directly into RAS millimetres.
function qform(header) {
  const f=i=>header.getFloat32(i,true), [b,c,d]=[256,260,264].map(f);
  const a=Math.sqrt(1-b*b-c*c-d*d);
  const rotation=[
    [a*a+b*b-c*c-d*d,2*(b*c-a*d),2*(b*d+a*c)],
    [2*(b*c+a*d),a*a+c*c-b*b-d*d,2*(c*d-a*b)],
    [2*(b*d-a*c),2*(c*d+a*b),a*a+d*d-c*c-b*b],
  ];
  return rotation.map((row,r)=>[...row.map((v,i)=>v*spacing[i]),f(268+r*4)]);
}

async function decode(compressed,mask,signal) {
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'),{signal})).arrayBuffer();
  if(raw.byteLength!==352+voxelCount*2) throw Error('Unexpected UMD volume size');
  const h=new DataView(raw), short=i=>h.getInt16(i,true), float=i=>h.getFloat32(i,true);
  if(h.getInt32(0,true)!==348||h.getUint32(344,false)!==0x6e2b3100||short(40)!==3||
    dims.some((n,i)=>short(42+2*i)!==n)||short(70)!==(mask?512:4)||short(72)!==16||
    float(108)!==352||float(112)!==1||float(116)!==0||h.getUint8(123)!==2||
    short(252)!==1||short(254)!==0||float(76)!==1||spacing.some((n,i)=>n!==float(80+i*4)))
    throw Error('Unexpected UMD NIfTI grid or scalar representation');
  const Type=mask?Uint16Array:Int16Array;
  const voxels=new Uint8Array(new Uint16Array([1]).buffer)[0]===1
    ? new Type(raw,352,voxelCount)
    : Type.from({length:voxelCount},(_,i)=>mask?h.getUint16(352+i*2,true):h.getInt16(352+i*2,true));
  return {voxels,affine:qform(h)};
}

export async function loadMyoma({signal,getAsset=(...args)=>publicAtlasAssets.get(...args)}={}) {
  signal?.throwIfAborted();
  const [mri,mask]=await Promise.all(assets.map(async ([url,max,sha],i)=>
    decode(await getAsset(url.href,max,sha,signal),i===1,signal)));
  signal?.throwIfAborted();
  if(!mri.affine.every((r,i)=>r.every((v,j)=>Number.isFinite(v)&&v===mask.affine[i][j])))
    throw Error('UMD MRI and tissue spatial transforms differ');
  const counts=new Uint32Array(5),myomaCountsByK=new Uint32Array(dims[2]);
  for(let i=0;i<mask.voxels.length;i++){
    const id=mask.voxels[i];
    if(id>4)throw Error('Unrecognized UMD annotation');
    counts[id]++;
    if(id===3)myomaCountsByK[Math.floor(i/(dims[0]*dims[1]))]++;
  }
  if(expectedCounts.some((expected,id)=>counts[id]!==expected)) throw Error('UMD tissue occupancy differs from source');
  const all=names.map((name,id)=>({id,name,rgb:colors[id],count:counts[id]}));
  // Ten millimetres of context around the union of labels, clamped to the
  // original grid. These are source indices. No resampled volume is retained.
  return {dims:[...dims],spacingMm:[...spacing],affineRasMm:mri.affine,originRasMm:mri.affine.map(r=>r[3]),
    bounds:[[294,469],[186,413],[1,14]],centers:[356,287,4],
    values:mri.voxels,labels:mask.voxels,myomaCountsByK,tissues:all.slice(1),byId:new Map(all.map(t=>[t.id,t]))};
}

function plane(volume,axis,index){
  if(!Object.hasOwn(axes,axis))throw RangeError('Unknown UMD slice axis');
  const [d,h,v]=axes[axis],bounds=volume.bounds;
  if(!Number.isInteger(index)||index<bounds[d][0]||index>bounds[d][1])throw RangeError('UMD slice outside review region');
  const width=bounds[h][1]-bounds[h][0]+1,height=bounds[v][1]-bounds[v][0]+1;
  const base=[0,0,0];base[d]=index;base[h]=bounds[h][0];base[v]=bounds[v][0];
  const strides=[1,dims[0],dims[0]*dims[1]];
  return {h,v,width,height,base,start:base.reduce((sum,n,i)=>sum+n*strides[i],0),dx:strides[h],dy:strides[v]};
}

export function renderMyomaSlice(volume,{axis,index,opacity=.5,highlightId=0}) {
  if(!Number.isFinite(opacity)||opacity<0||opacity>1||!volume.byId.has(highlightId))throw RangeError('Invalid UMD overlay');
  const {h,v,width,height,start,dx,dy}=plane(volume,axis,index),rgba=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=start+x*dx+y*dy, id=volume.labels[i], offset=(y*width+x)*4;
    const gray=Math.min(255,Math.max(0,Math.round(255*(volume.values[i]-73)/(366-73))));
    const alpha=id&&(!highlightId||highlightId===id)?opacity:0;
    for(let c=0;c<3;c++)rgba[offset+c]=(1-alpha)*gray+alpha*colors[id][c];
    rgba[offset+3]=255;
  }
  return {width,height,displayWidthMm:width*spacing[h],displayHeightMm:height*spacing[v],rgba};
}

export function readMyomaPixel(volume,{axis,index,x,y}){
  const {h,v,width,height,base,start,dx,dy}=plane(volume,axis,index);
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)throw RangeError('Pixel outside UMD slice');
  const i=start+x*dx+y*dy,id=volume.labels[i],ijk=base.slice();
  ijk[h]+=x;ijk[v]+=y;
  return {ijk,id,value:volume.values[i],name:names[id]};
}

export function myomaPlaneCorners(volume,{axis,index}){
  const {h,v,width,height,base}=plane(volume,axis,index),corners=[];
  // First texture pixel center is base. Texture edges span the outer half-cells.
  for(const [u,w] of [[0,0],[1,0],[0,1],[1,1]]){
    const p=base.slice();p[h]+=u*width-.5;p[v]+=w*height-.5;
    const [r,a,s]=volume.affineRasMm.map(row=>row[3]+row[0]*p[0]+row[1]*p[1]+row[2]*p[2]);
    corners.push(r,s,-a);
  }
  return new Float32Array(corners);
}
