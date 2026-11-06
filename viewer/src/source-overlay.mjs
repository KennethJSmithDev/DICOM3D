import {point} from './ct-spatial.mjs';
// Thin browser adapter of the recorded comparison method: binary marching squares at .5,
// low-valued samples fully connected. Segments are not blindly closed or simplified.
export function readMaskNpy(buffer){
  const b=new Uint8Array(buffer),v=new DataView(buffer),offset=10+v.getUint16(8,true),header=new TextDecoder('latin1').decode(b.subarray(10,offset));
  if(b[0]!==147||String.fromCharCode(...b.subarray(1,6))!=='NUMPY'||b[6]!==1||b[7]!==0||offset!==128||!/'descr':\s*'\|b1'/.test(header)||!/'fortran_order':\s*False/.test(header)||!/'shape':\s*\(103,\s*512,\s*512\s*\)/.test(header)||buffer.byteLength!==27000960)throw Error('Unqualified SEG mask NPY');
  const mask=new Uint8Array(buffer,offset);if(mask.some(v=>v!==0&&v!==1))throw Error('Mask is not binary');return mask;
}
export function maskSegments(mask,k,rows=512,cols=512){
  if(!Number.isInteger(k)||k<0||k>=mask.length/(rows*cols))throw Error('Mask frame outside acquired range');
  const segments=[],base=k*rows*cols;
  // Bits: top-left, top-right, bottom-right, bottom-left. Ambiguities5/10 keep high islands separate.
  const lookup={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],10:[[0,1],[2,3]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[3,0]]};
  for(let row=0;row<rows-1;row++)for(let col=0;col<cols-1;col++){
    const index=base+row*cols+col,code=mask[index]+2*mask[index+1]+4*mask[index+cols+1]+8*mask[index+cols];
    const edges=lookup[code];if(!edges)continue;const pts=[[row,col+.5],[row+.5,col+1],[row+1,col+.5],[row+.5,col]];
    for(const [a,b] of edges)segments.push([pts[a],pts[b]]);
  }return segments;
}
export function sourceIndexVertices(parts,matrices){
  return parts.map(({positions,indices})=>({indices,positions:Float64Array.from(positions,(_,i)=>{const n=Math.floor(i/3)*3;return point(matrices.patient_mm_to_index,point(matrices.model_m_to_patient_mm,[positions[n],positions[n+1],positions[n+2]]))[i%3];})}));
}
export function meshPlaneSegments(parts,k){
  const result=[],coplanar=new Map(),seen=new Set(),eps=1e-7;
  // WHY: 1e-6 keys collapsed 28 finite subpixel k65 segments. Preserve intersections.
  // BOUNDARY: identity dedup only; no display simplification. EVIDENCE: qualification/cpu-A1 diagnostic.
  const key=p=>p.map(x=>Math.round(x*1e7)).join(','),edgeKey=(a,b)=>[key(a),key(b)].sort().join('|');
  const emit=(a,b)=>{const id=edgeKey(a,b);if(id.split('|')[0]===id.split('|')[1]||seen.has(id))return;seen.add(id);result.push([a,b]);};
  for(const {positions,indices} of parts)for(let n=0;n<indices.length;n+=3){
    const tri=Array.from(indices.slice(n,n+3),id=>Array.from(positions.slice(id*3,id*3+3)));
    if(tri.every(p=>Math.abs(p[0]-k)<eps)){
      for(let e=0;e<3;e++){const a=tri[e].slice(1),b=tri[(e+1)%3].slice(1),id=edgeKey(a,b),old=coplanar.get(id);coplanar.set(id,{a,b,count:(old?.count??0)+1});}continue;
    }
    const points=[];const add=p=>{if(!points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<eps))points.push(p);};
    for(let e=0;e<3;e++){const a=tri[e],b=tri[(e+1)%3],da=a[0]-k,db=b[0]-k;if(Math.abs(da)<eps)add(a.slice(1));if(Math.abs(db)<eps)add(b.slice(1));if(da*db<0){const t=da/(da-db);add([a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])]);}}
    if(points.length===2)emit(points[0],points[1]);
  }
  for(const edge of coplanar.values())if(edge.count===1)emit(edge.a,edge.b);
  return result;
}
export function contourStats(segments){
  const adj=new Map(),key=p=>p.map(x=>Math.round(x*1e6)).join(',');
  for(const [a,b]of segments){const ka=key(a),kb=key(b);if(!adj.has(ka))adj.set(ka,[]);if(!adj.has(kb))adj.set(kb,[]);adj.get(ka).push(kb);adj.get(kb).push(ka);}
  const seen=new Set();let components=0,openEnds=0;for(const [k,v]of adj){if(v.length===1)openEnds++;if(seen.has(k))continue;components++;const stack=[k];while(stack.length){const next=stack.pop();if(seen.has(next))continue;seen.add(next);stack.push(...adj.get(next));}}
  return {segments:segments.length,components,openEnds};
}
export const svgSegments=segments=>segments.map(([a,b])=>`M${a[1]+.5},${a[0]+.5}L${b[1]+.5},${b[0]+.5}`).join('');
