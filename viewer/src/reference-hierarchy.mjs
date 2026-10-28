// Anatomy-local source index. No camera, geometry or selection state is owned here.
// Parent nodes filter existing draw owners; they never add duplicate renderables.
export function anatomyIndex(manifest) {
  const parts=manifest.reference.structures;
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
    const owners=node.owner_ids??parts.filter(p=>below(id).has(p.id)).map(p=>p.id);
    if(owners.some(k=>!aliases.has(k)))throw Error('Unknown anatomy draw owner');
    owned.set(id,new Set(owners));
    for(const owner of owners)aliases.get(owner).push(id,node.label,node.source_annotation?.ontologyid??'');
  }
  const search=new Map([...aliases].map(([id,text])=>[id,text.join(' ').toLowerCase()]));
  const systems=[...new Set(parts.flatMap(p=>p.systems??[]))].sort();
  const matches=(p,{query='',region='',system='',parent=''}={})=>
    (!query||`${search.get(p.id)} ${p.source_concept??''} ${p.source_annotation?.ontologyid??''}`.toLowerCase().includes(query.toLowerCase()))&&
    (!region||p.region===region)&&(!system||(p.systems??[]).includes(system))&&(!parent||owned.get(parent)?.has(p.id));
  const count=id=>owned.get(id)?.size??0;
  return {nodes,systems,matches,count,owners:id=>[...(owned.get(id)??[])],parents:id=>nodes.get(id)?.parents??[],children:id=>nodes.get(id)?.children??[],label:id=>nodes.get(id)?.label??id};
}
