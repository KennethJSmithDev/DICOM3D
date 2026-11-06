// Private semantic-atlas transport. Verification precedes replacing a live scene.
const hashPattern=/^[0-9a-f]{64}$/;
const safeName=/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
// Pin the locally qualified index, which in turn pins each manifest and asset.
const INDEX_SHA256='8e3b71c6eb259a55532d8b3f45a58057eedbc587857ebb99c2efab4ca4c7faac';
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
function requireValue(ok,message){if(!ok)throw new Error('Semantic atlas: '+message);}
export function validateSemanticIndex(index){
 requireValue(index?.schema==='DICOM3D-semantic-atlas-1'&&Array.isArray(index.bundles)&&Array.isArray(index.structures),'unsupported index');
 const bundles=new Map(),owners=new Map();
 for(const b of index.bundles){requireValue(typeof b.id==='string'&&safeName.test(b.id)&&!bundles.has(b.id),'invalid bundle identity');requireValue(safeName.test(b.url)&&safeName.test(b.manifestUrl)&&hashPattern.test(b.sha256)&&hashPattern.test(b.manifestSha256)&&Number.isSafeInteger(b.byteLength)&&b.byteLength>0&&b.byteLength<100000000&&Array.isArray(b.structureIds)&&b.structureIds.length,'invalid bundle descriptor');bundles.set(b.id,b);for(const id of b.structureIds){requireValue(typeof id==='string'&&!owners.has(id),'duplicate owner '+id);owners.set(id,b.id);}}
 requireValue(index.structures.length===owners.size,'catalog/owner count mismatch');const seen=new Set();for(const s of index.structures){requireValue(typeof s.id==='string'&&!seen.has(s.id)&&owners.get(s.id)===s.bundleId,'catalog/owner mismatch');seen.add(s.id);}return index;
}
async function fetchBounded(url,limit,signal){const r=await fetch(url,{signal,cache:'no-store'});requireValue(r.ok,'unavailable '+url+' (HTTP '+r.status+')');const length=Number(r.headers.get('content-length'));if(length)requireValue(length<=limit,'response exceeds declared limit');const bytes=await r.arrayBuffer();requireValue(bytes.byteLength<=limit,'response exceeds declared limit');return bytes;}
export async function loadSemanticIndex(directory,signal){const bytes=await fetchBounded(new URL('index.json',directory),4*1024*1024,signal);requireValue(await digest(bytes)===INDEX_SHA256,'catalog integrity mismatch');return validateSemanticIndex(JSON.parse(new TextDecoder().decode(bytes)));}
export async function loadSemanticBundle(index,directory,id,signal){
 const b=index.bundles.find(x=>x.id===id);requireValue(b,'unknown bundle');
 const [manifestBytes,bytes]=await Promise.all([fetchBounded(new URL(b.manifestUrl,directory),8*1024*1024,signal),fetchBounded(new URL(b.url,directory),b.byteLength,signal)]);
 requireValue(await digest(manifestBytes)===b.manifestSha256,'bundle manifest integrity mismatch: '+id);
 requireValue(bytes.byteLength===b.byteLength&&await digest(bytes)===b.sha256,'bundle integrity mismatch: '+id);
 const manifest=JSON.parse(new TextDecoder().decode(manifestBytes)),ids=manifest.reference?.structures?.map(s=>s.id);
 requireValue(manifest.asset?.relative_filename===b.url&&manifest.asset?.sha256===b.sha256&&manifest.reference?.id===index.source.referenceId&&Array.isArray(ids)&&ids.length===b.structureIds.length&&ids.every((s,i)=>s===b.structureIds[i]),'bundle manifest mismatch: '+id);
 // The verified catalog supplies the global owner set; the renderer gets only
 // this bundle's resident descriptors while hierarchy aliases remain discoverable.
 manifest.reference.semanticProjection={schema:'DICOM3D-semantic-projection-1',catalogOwnerIds:index.structures.map(s=>s.id)};
 return {manifest,bytes,bundle:b};
}

// Merge only the pinned, simple GLB schema emitted by the semantic generator.
// Reject unsupported glTF features instead of guessing how to remap references.
export async function mergeSemanticBundles(index,loaded){
 requireValue(loaded.length===index.bundles.length,'full body requires every bundle');
 const out={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[],meshes:[],accessors:[],bufferViews:[],materials:[],buffers:[]},bins=[];let total=0;
 for(const item of loaded){
  const a=item.bytes,view=new DataView(a);requireValue(view.getUint32(0,true)===0x46546c67&&view.getUint32(4,true)===2&&view.getUint32(8,true)===a.byteLength,'invalid GLB');
  const jlen=view.getUint32(12,true);requireValue(view.getUint32(16,true)===0x4e4f534a,'missing GLB JSON');const d=JSON.parse(new TextDecoder().decode(new Uint8Array(a,20,jlen)));const off=20+jlen,blen=view.getUint32(off,true);requireValue(view.getUint32(off+4,true)===0x004e4942&&off+8+blen===a.byteLength,'invalid GLB BIN');
  requireValue(!d.extensionsUsed&&!d.extensionsRequired&&!d.animations&&!d.skins&&!d.textures&&!d.images&&d.scene===0&&d.scenes?.length===1&&d.scenes[0].nodes?.length===1&&d.scenes[0].nodes[0]===0&&d.buffers?.length===1,'unsupported GLB features');
  requireValue(d.nodes?.[0]?.name===item.manifest.structure.semantic_id&&d.nodes[0].children?.length===d.nodes.length-1&&d.nodes[0].children.every((v,i)=>v===i+1),'unexpected GLB hierarchy');
  const nodeBase=out.nodes.length?out.nodes.length-1:0,meshBase=out.meshes.length,accessorBase=out.accessors.length,viewBase=out.bufferViews.length,materialBase=out.materials.length;
  if(!out.nodes.length)out.nodes.push({...d.nodes[0],children:[]});
  for(const n of d.nodes.slice(1)){requireValue(!n.children&&!n.skin&&Number.isInteger(n.mesh),'unsupported node');out.nodes.push({...n,mesh:n.mesh+meshBase});}
  out.nodes[0].children.push(...d.nodes[0].children.map(n=>n+nodeBase));
  for(const mesh of d.meshes){const m=structuredClone(mesh);for(const p of m.primitives){requireValue(!p.targets&&!p.extensions&&Number.isInteger(p.indices)&&Number.isInteger(p.material),'unsupported primitive');for(const k of Object.keys(p.attributes))p.attributes[k]+=accessorBase;p.indices+=accessorBase;p.material+=materialBase;}out.meshes.push(m);}
  for(const a of d.accessors){requireValue(!a.sparse&&Number.isInteger(a.bufferView),'unsupported accessor');out.accessors.push({...a,bufferView:a.bufferView+viewBase});}
  for(const b of d.bufferViews){requireValue(b.buffer===0&&!b.extensions,'unsupported buffer view');out.bufferViews.push({...b,buffer:0,byteOffset:(b.byteOffset??0)+total});}
  out.materials.push(...d.materials);bins.push(new Uint8Array(a,off+8,blen));total+=blen;
 }
 out.buffers=[{byteLength:total}];const json=new TextEncoder().encode(JSON.stringify(out)),jsonSize=(json.length+3)&~3,binSize=(total+3)&~3,result=new Uint8Array(12+8+jsonSize+8+binSize),v=new DataView(result.buffer);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,result.length,true);v.setUint32(12,jsonSize,true);v.setUint32(16,0x4e4f534a,true);result.fill(32,20,20+jsonSize);result.set(json,20);const bo=20+jsonSize;v.setUint32(bo,binSize,true);v.setUint32(bo+4,0x004e4942,true);let at=bo+8;for(const b of bins){result.set(b,at);at+=b.byteLength;}
 const manifest=structuredClone(loaded[0].manifest);delete manifest.reference.semanticProjection;manifest.reference.structures=index.structures.map(({bundleId,...part})=>part);manifest.reference.hierarchy=index.hierarchy;manifest.asset.relative_filename='male-semantic-full.glb';manifest.asset.sha256=await digest(result);manifest.cost.geometry_buffer_bytes=total;manifest.cost.glb_bytes=result.byteLength;manifest.cost.semantic_structures=manifest.reference.structures.length;for(const field of ['vertices','triangles'])manifest.cost[field]=loaded.reduce((sum,item)=>sum+item.manifest.cost[field],0);
 return {manifest,bytes:result.buffer,bundle:{id:'full-body-from-bundles',url:manifest.asset.relative_filename,manifestUrl:'male-semantic-full.manifest.json',structureIds:manifest.reference.structures.map(p=>p.id)}};
}
