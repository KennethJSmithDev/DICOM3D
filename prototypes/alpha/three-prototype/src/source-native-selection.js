import {Box3,Vector3,MeshBasicMaterial} from 'three';

// WHY: a source concept can name exact subsets of several existing draw owners.
// BOUNDARY: reversible draw groups/materials only, never source buffers or IDs.
// INVARIANT: selection does not allocate or duplicate positions/indices, and restore
// precedes owner material disposal. An unavailable member rejects the whole view.
// HRA concept keys can equal component IDs. Selection kind must not change
// publisher identity or silently resolve a picked mesh to its compound.
export const nativeComponentKey=id=>`ELEMENT:${id}`;
// Catalog objects are immutable revisions. Do not cache mutable presentation state.
const catalogIndexes=new WeakMap();
function catalogIndex(catalog){
 if(!catalog)return null;
 let index=catalogIndexes.get(catalog);
 if(!index){
  const concepts=new Map(),atoms=new Map();
  for(const record of catalog.concepts??[])if(!concepts.has(record.key))concepts.set(record.key,record);
  (catalog.atoms??[]).forEach((record,order)=>{if(!atoms.has(record.id))atoms.set(record.id,{record,order});});
  index={concepts,atoms};catalogIndexes.set(catalog,index);
 }
 return index;
}
export function nativeRecord(catalog,key){
 const index=catalogIndex(catalog);if(!index)return undefined;
 return key?.startsWith('ELEMENT:')?index.atoms.get(key.slice(8))?.record:index.concepts.get(key)||index.atoms.get(key)?.record;
}
export function nativeAtoms(catalog,key){
 const record=nativeRecord(catalog,key);if(!record)return [];
 const index=catalogIndex(catalog);
 return [...new Set(record.atomIds||[record.id])].map(id=>index.atoms.get(id)).filter(Boolean).sort((a,b)=>a.order-b.order).map(entry=>entry.record);
}

export function nativeBundles(catalog,key){return [...new Set(nativeAtoms(catalog,key).map(x=>x.bundleId))];}
export function mergeRanges(ranges,limit){
 const sorted=ranges.map(([start,count])=>[start,start+count]).sort((a,b)=>a[0]-b[0]);const out=[];
 for(const [start,end] of sorted){if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>limit||start%3||end%3||end<=start)throw Error('Invalid source triangle span');const last=out.at(-1);if(last&&start<=last[1])last[1]=Math.max(last[1],end);else out.push([start,end]);}
 return out.map(([start,end])=>[start,end-start]);
}
function locateAtoms(bundles,atoms){
 const owners=new Map();for(const {scene} of bundles.values())scene.traverse(n=>{if(n.userData.semanticId)owners.set(n.userData.semanticId,n);});
 const meshes=new Map();
 for(const atom of atoms){const owner=owners.get(atom.ownerId);if(!owner)throw Error(`Source member not loaded: ${atom.ownerId}`);let mesh;
  if(atom.sourceNodeIndex!==undefined)owner.traverse(n=>{if(n.isMesh&&n.userData.sourceNodeIndex===atom.sourceNodeIndex)mesh=n;});
  else if(owner.isMesh)mesh=owner;
  if(!mesh)throw Error(`Source mesh unavailable: ${atom.id}`);
  const count=mesh.geometry.index?.count??mesh.geometry.attributes.position.count;
  const entry=meshes.get(mesh)||{atoms:[],ranges:[]};entry.atoms.push(atom);entry.ranges.push(atom.indexCount?[atom.indexStart,atom.indexCount]:[0,count]);meshes.set(mesh,entry);
 }
 for(const [mesh,entry] of meshes)entry.ranges=mergeRanges(entry.ranges,mesh.geometry.index?.count??mesh.geometry.attributes.position.count);
 return meshes;
}
export function sourceSelectionBounds(bundles,catalog,key){const bounds=new Box3();for(const [mesh,entry] of locateAtoms(bundles,nativeAtoms(catalog,key))){mesh.updateWorldMatrix(true,false);for(const atom of entry.atoms){let box;if(atom.boundsModel)box=new Box3(new Vector3(...atom.boundsModel[0]),new Vector3(...atom.boundsModel[1]));else{mesh.geometry.computeBoundingBox();box=mesh.geometry.boundingBox.clone();}bounds.union(box.applyMatrix4(mesh.matrixWorld));}}return bounds;}
export function sourceAtomAtHit(catalog,ownerId,node,faceIndex){if(!catalog||!Number.isInteger(faceIndex))return null;return catalog.atoms.find(a=>a.ownerId===ownerId&&(a.sourceNodeIndex!==undefined?a.sourceNodeIndex===node.userData.sourceNodeIndex:faceIndex*3>=a.indexStart&&faceIndex*3<a.indexStart+a.indexCount));}

export function createSourceSelectionProjection(){
 let saved=[],clones=[],info=null;
 function restore(){for(const r of saved){r.node.visible=r.visible;if(r.material!==undefined){r.node.material=r.material;r.node.geometry.groups=r.groups;r.node.geometry.setDrawRange(r.drawRange.start,r.drawRange.count);}}saved=[];for(const m of clones)m.dispose();clones=[];info=null;}
 function apply(bundles,{catalog,key,isolated=false,opacity=1,style='original'}={}){
  if(!catalog||!key){restore();return null;}
  const record=nativeRecord(catalog,key),atoms=nativeAtoms(catalog,key);
  if(!record||!atoms.length)return {status:'unavailable',key};
  if(record.atomIds&&new Set(record.atomIds).size!==atoms.length)return {status:'unavailable',key,error:'Source compound contains an unavailable member'};
  let meshes;try{meshes=locateAtoms(bundles,atoms);}catch(error){return {status:'waiting',key,error:error.message};}
  // Validate every referenced member before changing any visible state.
  const sliced=new Set();for(const [mesh,entry] of meshes){const material=saved.find(r=>r.node===mesh)?.material??mesh.material;if(Array.isArray(material)&&entry.ranges.some(([s,c])=>s!==0||c!==(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)))return {status:'unavailable',key,error:'Source primitive material groups require an explicit mapping'};if(sliced.has(mesh.geometry))return {status:'unavailable',key,error:'Shared primitive range needs instance-specific draw ownership'};sliced.add(mesh.geometry);}
  restore();
  const all=[];for(const {scene} of bundles.values())scene.traverse(node=>all.push(node));
  for(const node of all){saved.push({node,visible:node.visible});if(isolated&&node.isMesh)node.visible=false;}
  for(const [mesh,entry] of meshes){
   const state=saved.find(x=>x.node===mesh);Object.assign(state,{material:mesh.material,groups:mesh.geometry.groups.map(g=>({...g})),drawRange:{...mesh.geometry.drawRange}});
   const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   const altered=materials.map(m=>{const c=m.clone();c.opacity*=Math.min(1,Math.max(.05,opacity));if(style==='holographic'){c.color?.set('#48c9f0');c.emissive?.set('#075275');c.opacity*=.7;}c.transparent=c.transparent||c.opacity<1;if(c.transparent)c.depthWrite=false;clones.push(c);return c;});
   const limit=mesh.geometry.index?.count??mesh.geometry.attributes.position.count;
   if(Array.isArray(mesh.material)){mesh.material=altered;}
   else{mesh.material=[materials[0],altered[0]];mesh.geometry.clearGroups();let cursor=0;for(const [start,count] of entry.ranges){if(!isolated&&start>cursor)mesh.geometry.addGroup(cursor,start-cursor,0);mesh.geometry.addGroup(start,count,1);cursor=start+count;}if(!isolated&&cursor<limit)mesh.geometry.addGroup(cursor,limit-cursor,0);mesh.geometry.setDrawRange(0,limit);}
   if(isolated){for(let node=mesh;node;node=node.parent){node.visible=true;if(!meshes.has(node)&&node.isMesh){const state=saved.find(x=>x.node===node);if(state&&state.material===undefined){Object.assign(state,{material:node.material,groups:node.geometry.groups.map(g=>({...g})),drawRange:{...node.geometry.drawRange}});const mask=new MeshBasicMaterial({visible:false});clones.push(mask);node.material=mask;}}if(!all.includes(node.parent))break;}}
  }
  info={status:'ready',key,scope:record.scope??'EXACT_COMPONENT',atoms:atoms.length,drawMeshes:meshes.size,triangles:[...meshes.values()].reduce((n,e)=>n+e.ranges.reduce((s,r)=>s+r[1]/3,0),0),isolated,opacity};return info;
 }
 return {apply,restore,get info(){return info;}};
}

export function composeSourceCatalog(base,extra,removedOwners){
 const removed=new Set(removedOwners),atoms=base.atoms.filter(a=>!removed.has(a.ownerId));const available=new Set(atoms.map(a=>a.id));
 const concepts=base.concepts.map(c=>{const atomIds=c.atomIds.filter(id=>available.has(id));const omitted=c.atomIds.filter(id=>!available.has(id));return {...c,atomIds,ownerIds:c.ownerIds.filter(id=>!removed.has(id)),missingElements:[...(c.missingElements||[]),...omitted],scope:omitted.length?(atomIds.length?'PARTIAL':'CATALOG_ONLY'):c.scope};});
 return {...base,atoms:[...atoms,...(extra?.atoms||[])],concepts:[...concepts,...(extra?.concepts||[])],owners:[...(base.owners||[]).filter(o=>!removed.has(o.id)),...(extra?.owners||[])]};
}
