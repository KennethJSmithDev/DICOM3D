// Anatomy-local source index. No camera, geometry or selection state is owned here.
// Parent nodes filter existing draw owners; they never add duplicate renderables.
export function anatomyIndex(manifest, supplemental=null) {
  const parts=manifest.reference.structures;
  const projection=manifest.reference.semanticProjection;
  if(projection&&(projection.schema!=='DICOM3D-semantic-projection-1'||!Array.isArray(projection.catalogOwnerIds)||new Set(projection.catalogOwnerIds).size!==projection.catalogOwnerIds.length||parts.some(p=>!projection.catalogOwnerIds.includes(p.id))))throw Error('Invalid semantic atlas projection');
  const catalogOwners=projection?new Set(projection.catalogOwnerIds):null;
  function residentOwners(owners,error){for(const owner of owners)if(!aliases.has(owner)&&(!catalogOwners||!catalogOwners.has(owner)))throw Error(error);return owners.filter(owner=>aliases.has(owner));}
  const nodes=new Map((manifest.reference.hierarchy??[]).map(n=>[n.id,n]));
  for(const p of parts)if(!nodes.has(p.id))nodes.set(p.id,{id:p.id,label:p.label,parents:[],children:[]});
  const descendants=new Map();
  function below(id,visiting=new Set()) {
    if(descendants.has(id))return descendants.get(id);
    if(visiting.has(id))throw Error('Cyclic source anatomy hierarchy');
    const next=new Set(visiting);next.add(id);const found=new Set([id]);
    for(const child of nodes.get(id)?.children??[])for(const k of below(child,next))found.add(k);
    descendants.set(id,found);return found;
  }
  for(const id of nodes.keys())below(id);
  // Source descendants can already live inside an accepted merged draw. Resolve
  // that owner explicitly, rather than silently dropping the descendant or
  // pretending the draw can isolate just that subpart. No presentation state here.
  const owned=new Map(),aliases=new Map(parts.map(p=>[p.id,[p.label,p.id,...(p.source_elements??[])]]));
  for(const [id,node] of nodes){
    const owners=residentOwners(node.owner_ids??parts.filter(p=>below(id).has(p.id)).map(p=>p.id),'Unknown anatomy draw owner');
    owned.set(id,new Set(owners));
    for(const owner of owners)aliases.get(owner).push(id,node.label,node.source_annotation?.ontologyid??'');
  }
  // Cross-version entries address existing owners only. Identical source geometry
  // is evidence of shared payload, not proof of complete concept representation.
  if(supplemental){
    if(supplemental.schema!=='bp3d-4.3i-owner-evidence-1'||manifest.reference.id!=='BODY-DEFAULT-BP3D-01')throw Error('Invalid supplemental atlas evidence');
    for(const concept of supplemental.concepts){
      for(const owner of residentOwners(concept.owner_ids,'Unknown supplemental draw owner')){
        aliases.get(owner).push(concept.concept_id,...concept.labels,...concept.source_entries.filter(e=>e.owner_ids.includes(owner)).map(e=>e.file_id));
      }
    }
  }
  const search=new Map([...aliases].map(([id,text])=>[id,text.join(' ').toLowerCase()]));
  const systems=[...new Set(parts.flatMap(p=>p.systems??[]))].sort();
  const matches=(p,{query='',region='',system='',parent=''}={})=>
    (!query||`${search.get(p.id)} ${p.source_concept??''} ${p.source_annotation?.ontologyid??''}`.toLowerCase().includes(query.toLowerCase()))&&
    (!region||p.region===region)&&(!system||(p.systems??[]).includes(system))&&(!parent||owned.get(parent)?.has(p.id));
  const count=id=>owned.get(id)?.size??0;
  return {nodes,systems,matches,count,owners:id=>[...(owned.get(id)??[])],parents:id=>nodes.get(id)?.parents??[],children:id=>nodes.get(id)?.children??[],label:id=>nodes.get(id)?.label??id};
}

// Discovery only: these source records have no newly admitted draw geometry.
export function unadmittedSourceMatches(catalog,query,limit=20,admitted43=new Set()){
  const q=query.trim().toLowerCase();
  if(q.length<2)return {total:0,items:[]};
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid source result limit');
  const matches=(catalog?.unadmitted_concepts??[]).map(r=>({...r,source_file_ids:r.source_file_ids.filter(id=>!admitted43.has(id))})).filter(r=>r.source_file_ids.length&&[r.concept_id,...r.labels,...r.source_file_ids].some(v=>v.toLowerCase().includes(q))).map(r=>({...r,unadmitted_entries:r.source_file_ids.length}));
  return {total:matches.length,items:matches.slice(0,limit)};
}
