// Copyright 2026 KennethJSmithDev. Apache-2.0.
// Pure derived presentation for the DEMO-001 fixture, never a source rewrite.
export const FIXTURE_SHA = 'bbd9b6a90237b6f8e2d871e897a1b729d29ab476f9754309c60efc2c401ee31a';
export const FIXTURE_ID = 'synthetic.demo.icosahedron.001';
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub = (a,b) => a.map((v,i)=>v-b[i]);
export const triangleArea = (a,b,c) => Math.hypot(...cross(sub(b,a),sub(c,a)))/2;
function clip(poly, plane, above) {
  const result=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length];
    const ai=above?a[1]>=plane:a[1]<=plane,bi=above?b[1]>=plane:b[1]<=plane;
    if(ai) result.push(a);
    if(ai!==bi) { const t=(plane-a[1])/(b[1]-a[1]); result.push(a.map((v,k)=>k===1?plane:v+t*(b[k]-v))); }
  }
  return result;
}
export function fixtureGeometry(bytes) {
  const view=new DataView(bytes),length=view.getUint32(12,true);
  if(view.getUint32(0,true)!==0x46546c67) throw Error('Not a GLB');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
  const primitive=json.meshes[0].primitives[0],node=json.nodes[0];
  if(node.name!==FIXTURE_ID || node.translation || node.rotation || node.scale || node.matrix) throw Error('Only untransformed DEMO-001 fixture is qualified');
  const start=28+length;
  const read=(index,size,get)=>{ const a=json.accessors[index],b=json.bufferViews[a.bufferView]; return Array.from({length:a.count*size},(_,i)=>view[get](start+(b.byteOffset||0)+(a.byteOffset||0)+i*(get==='getFloat32'?4:2),true)); };
  return {positions:read(primitive.attributes.POSITION,3,'getFloat32'),indices:read(primitive.indices,1,'getUint16')};
}
export function deriveSlices(positions,indices) {
  const ys=positions.filter((_,i)=>i%3===1),lo=Math.min(...ys),hi=Math.max(...ys);
  return freeze(Array.from({length:5},(_,ordinal)=>{
    const lower=lo+(hi-lo)*ordinal/5,upper=lo+(hi-lo)*(ordinal+1)/5;
    const origin=[0,(lower+upper)/2,0],vertices=[],sourceTriangles=[];
    for(let i=0;i<indices.length;i+=3) {
      let poly=indices.slice(i,i+3).map(index=>positions.slice(index*3,index*3+3));
      poly=clip(clip(poly,lower,true),upper,false);
      for(let j=1;j+1<poly.length;j++) {
        const triangle=[poly[0],poly[j],poly[j+1]];
        if(triangleArea(...triangle)<1e-16) continue;
        triangle.forEach(p=>vertices.push(...p.map((v,k)=>v-origin[k])));
        sourceTriangles.push(i/3);
      }
    }
    return {id:`${FIXTURE_ID}/presentation/slice-${String(ordinal).padStart(2,'0')}`,ordinal,origin,lower,upper,positions:vertices,sourceTriangles};
  }));
}
export function slicesGlb(slices) {
  const blocks=[],views=[],accessors=[],nodes=[],meshes=[];let offset=0;
  for(const slice of slices) {
    const p=new Float32Array(slice.positions),indices=new Uint32Array(Array.from({length:p.length/3},(_,i)=>i));
    const base=views.length,accessor=accessors.length;
    views.push({buffer:0,byteOffset:offset,byteLength:p.byteLength,target:34962}); blocks.push(new Uint8Array(p.buffer));offset+=p.byteLength;
    views.push({buffer:0,byteOffset:offset,byteLength:indices.byteLength,target:34963});blocks.push(new Uint8Array(indices.buffer));offset+=indices.byteLength;
    accessors.push({bufferView:base,componentType:5126,count:p.length/3,type:'VEC3',min:[0,1,2].map(k=>Math.min(...Array.from(p).filter((_,i)=>i%3===k))),max:[0,1,2].map(k=>Math.max(...Array.from(p).filter((_,i)=>i%3===k)))});
    accessors.push({bufferView:base+1,componentType:5125,count:indices.length,type:'SCALAR'});
    nodes.push({name:slice.id,mesh:meshes.length,translation:slice.origin,extras:{semanticId:slice.id,sourceSemanticId:FIXTURE_ID,presentationOnly:true}});
    meshes.push({primitives:[{attributes:{POSITION:accessor},indices:accessor+1,mode:4}]});
  }
  const data={asset:{version:'2.0',generator:'DICOM3D H002 derived open presentation bands; no caps'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,buffers:[{byteLength:offset}],bufferViews:views,accessors};
  let text=JSON.stringify(data);text=text.padEnd(Math.ceil(new TextEncoder().encode(text).length/4)*4,' ');
  const json=new TextEncoder().encode(text),out=new Uint8Array(28+json.length+offset),v=new DataView(out.buffer);
  v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,out.length,true);v.setUint32(12,json.length,true);v.setUint32(16,0x4e4f534a,true);out.set(json,20);
  v.setUint32(20+json.length,offset,true);v.setUint32(24+json.length,0x004e4942,true);let cursor=28+json.length;for(const b of blocks){out.set(b,cursor);cursor+=b.length;}
  return out.buffer;
}
export function createSliceState(slices) {
  return {selected:slices[2].id,gap:0,isolate:false,items:slices.map(s=>({id:s.id,offset:[0,0,0],rotation:0,visible:true,opacity:1}))};
}
export function updateSlice(state,id,patch) {
  const item=state.items.find(s=>s.id===id);if(!item)throw Error('Unknown slice identity');
  if(patch.offset && (patch.offset.length!==3 || patch.offset.some(x=>!Number.isFinite(x)||Math.abs(x)>.1)))throw Error('Translation outside ±100 mm');
  if(patch.rotation!==undefined && (!Number.isFinite(patch.rotation)||Math.abs(patch.rotation)>Math.PI))throw Error('Rotation outside ±180°');
  if(patch.opacity!==undefined && (!Number.isFinite(patch.opacity)||patch.opacity<.15||patch.opacity>1))throw Error('Opacity outside 15–100%');
  for(const key of Object.keys(patch))if(!['offset','rotation','visible','opacity'].includes(key))throw Error('Unknown presentation field');
  Object.assign(item,patch,patch.offset?{offset:[...patch.offset]}:{});
}
export function setGap(state,value) {if(!Number.isFinite(value)||value<0||value>.05)throw Error('Expansion outside 0–50 mm');state.gap=value;}
export function resetSlice(state,id) {updateSlice(state,id,{offset:[0,0,0],rotation:0,visible:true,opacity:1});}
export function resetAll(state) {state.items.forEach(s=>resetSlice(state,s.id));state.gap=0;state.isolate=false;}
export function slicePose(slice,state) {
  const item=state.items.find(s=>s.id===slice.id);
  return {position:slice.origin.map((v,i)=>v+item.offset[i]+(i===1?(slice.ordinal-2)*state.gap:0)),rotation:item.rotation,opacity:item.opacity,visible:item.visible&&(!state.isolate||state.selected===slice.id)};
}
