import {publicAtlasAssets} from '../../public-asset-cache.js';

export const fetalSourceNotice = new URL('./CRL-SOURCE-NOTICE.txt?no-inline', import.meta.url).href;

// These are the publisher's original gzip streams, ITK-SNAP key, and grid for GA22.
const assets = [
  [new URL('./t2w_GA22_atlas.nii.gz', import.meta.url), 675662, '506d9cd61a3d5ee816283ae87945b4d466171e4e1ee50ba0a11fd2c7a6291ad1'],
  [new URL('./t2w_GA22_tissue.nii.gz', import.meta.url), 43301, 'dbcf9a93669a4942f995d9e2e20ad68c4d5e995cbfa489ced7d06186cb3aecac'],
  [new URL('./T2WAtlas_labelkey-tissue.txt?no-inline', import.meta.url), 2591, '678f7df75ba0d594aaf17eaf49897daf063a2ac2711886feb1b012fb5df3a323'],
];
const dims = [135,189,155];
const gridSpacing = Math.fround(0.7999989986419678);
const origin = [53.59993362426758,75.19990539550781,-61.59992218017578];
const voxelCount = dims[0]*dims[1]*dims[2];
const axisLayout = {sagittal:[0,1,2], coronal:[1,0,2], axial:[2,0,1]};

async function decodeVolume(compressed, isMask, signal) {
  const itemSize = isMask ? 2 : 4;
  const bytes = await new Response(new Blob([compressed]).stream().pipeThrough(
    new DecompressionStream('gzip'), {signal})).arrayBuffer();
  if (bytes.byteLength !== 352 + voxelCount * itemSize) throw Error('Unexpected GA22 volume size');
  const h = new DataView(bytes);
  const i16 = i => h.getInt16(i,true), f32 = i => h.getFloat32(i,true);
  if (h.getInt32(0,true)!==348 || h.getUint32(344,false)!==0x6e2b3100 ||
      i16(40)!==(isMask?3:4) || i16(48)!==1 || dims.some((n,i)=>n!==i16(42+i*2)) ||
      i16(70)!==(isMask?512:16) || i16(72)!==itemSize*8 ||
      f32(108)!==352 || f32(112)!==1 || f32(116)!==0 || (h.getUint8(123)&7)!==2)
    throw Error('Unsupported GA22 NIfTI representation');
  // The T2 volume supplies a qform only. The mask also supplies its equivalent sform.
  const expectedSform = [-gridSpacing,0,0,origin[0],0,-gridSpacing,0,origin[1],0,0,gridSpacing,origin[2]];
  if (i16(252)!==1 || i16(254)!==(isMask?1:0) || f32(76)!==1 ||
      [80,84,88].some(i=>f32(i)!==gridSpacing) || [0,0,1,...origin].some((v,i)=>v!==f32(256+4*i)) ||
      (isMask && expectedSform.some((v,i)=>v!==f32(280+4*i))))
    throw Error('Unexpected GA22 spatial transform');
  const ArrayType = isMask ? Uint16Array : Float32Array;
  if (new Uint8Array(new Uint16Array([1]).buffer)[0]===1) return new ArrayType(bytes,352,voxelCount);
  return ArrayType.from({length:voxelCount}, (_,i)=>isMask?h.getUint16(352+2*i,true):h.getFloat32(352+4*i,true));
}

function tissueKey(text) {
  const byId = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+[\d.]+\s+[01]\s+[01]\s+"([^"]+)"\s*$/.exec(line);
    if (!match || byId.has(+match[1])) throw Error('Invalid GA22 tissue key');
    const [,id,r,g,b,name] = match;
    byId.set(+id,{id:+id,name,rgb:[+r,+g,+b],count:0});
  }
  return byId;
}

export async function loadFetalBrain({signal, getAsset=(...args)=>publicAtlasAssets.get(...args)} = {}) {
  signal?.throwIfAborted();
  const [t2,seg,key] = await Promise.all(assets.map(([url,size,hash])=>getAsset(url.href,size,hash,signal)));
  const [values,labels] = await Promise.all([decodeVolume(t2,false,signal),decodeVolume(seg,true,signal)]);
  signal?.throwIfAborted();
  const byId = tissueKey(new TextDecoder().decode(key));
  const bounds = dims.map(n=>[n,-1]);
  for (let i=0; i<labels.length; i++) {
    const id=labels[i];
    if (!id) continue;
    const tissue=byId.get(id);
    if (!tissue) throw Error('Voxel absent from GA22 tissue key');
    tissue.count++;
    const x=i%dims[0], y=Math.floor(i/dims[0])%dims[1], z=Math.floor(i/(dims[0]*dims[1]));
    bounds[0][0]=Math.min(x,bounds[0][0]); bounds[0][1]=Math.max(x,bounds[0][1]);
    bounds[1][0]=Math.min(y,bounds[1][0]); bounds[1][1]=Math.max(y,bounds[1][1]);
    bounds[2][0]=Math.min(z,bounds[2][0]); bounds[2][1]=Math.max(z,bounds[2][1]);
  }
  const tissues=[...byId.values()].filter(t=>t.count);
  if (tissues.length!==32) throw Error('Unexpected GA22 populated tissue count');
  return {dims:[...dims],spacingMm:[gridSpacing,gridSpacing,gridSpacing],
    originRasMm:[...origin],signedSpacingRasMm:[-gridSpacing,-gridSpacing,gridSpacing],bounds,centers:[70,89,87],
    values,labels,byId,tissues};
}

function plane(brain,axis,index) {
  if (!Object.hasOwn(axisLayout,axis)) throw RangeError('Unknown slice axis');
  const [depth,h,v]=axisLayout[axis], range=brain.bounds[depth];
  if (!Number.isInteger(index)||index<range[0]||index>range[1]) throw RangeError('Slice outside tissue bounds');
  const hs=brain.bounds[h],vs=brain.bounds[v],flipV=v===2;
  const stride=[1,dims[0],dims[0]*dims[1]];
  return {width:hs[1]-hs[0]+1,height:vs[1]-vs[0]+1,
    first:index*stride[depth]+hs[0]*stride[h]+vs[flipV?1:0]*stride[v],
    stepX:stride[h],stepY:(flipV?-1:1)*stride[v]};
}

export function renderBrainSlice(brain,{axis,index,opacity=.5,highlightId=0}) {
  const {width,height,first,stepX,stepY}=plane(brain,axis,index);
  if (!Number.isFinite(opacity)||opacity<0||opacity>1) throw RangeError('Invalid overlay opacity');
  if (highlightId!==0 && !brain.byId.get(highlightId)?.count) throw RangeError('Unknown tissue');
  const rgba=new Uint8ClampedArray(width*height*4);
  let offset=0;
  for (let y=0; y<height; y++) {
    for (let x=0; x<width; x++) {
      const i=first+y*stepY+x*stepX, id=brain.labels[i];
      // Shared display window 0–100. Retained T2 float values are available for picking.
      const gray=Math.max(0,Math.min(255,Math.round(brain.values[i]*255/100)));
      const rgb=id && opacity && (!highlightId || id===highlightId) ? brain.byId.get(id).rgb : null;
      for(let c=0;c<3;c++) rgba[offset++]=rgb ? gray*(1-opacity)+rgb[c]*opacity : gray;
      rgba[offset++]=255;
    }
  }
  return {width,height,rgba};
}

export function readBrainPixel(brain,{axis,index,x,y}) {
  const {width,height,first,stepX,stepY}=plane(brain,axis,index);
  if (!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=width||y<0||y>=height)
    throw RangeError('Pixel outside slice');
  const i=first+y*stepY+x*stepX, id=brain.labels[i];
  return {ijk:[i%dims[0],Math.floor(i/dims[0])%dims[1],Math.floor(i/(dims[0]*dims[1]))],
    value:brain.values[i],id,name:brain.byId.get(id).name};
}
