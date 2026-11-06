// Presentation policy over admitted source owners. No geometry or inferred taxonomy.
export function createReferenceLayers(parts) {
  const ids=new Set(parts.map(p=>p.id));
  if(ids.size!==parts.length)throw Error('Duplicate source owner');
  const membership=new Map(parts.map(p=>[p.id,[...new Set((p.systems??[]).filter(s=>typeof s==='string'&&s.endsWith(' system')&&!s.startsWith('IS-A:')))]]));
  const systems=[...new Set([...membership.values()].flat())].sort();
  const rows=new Map(systems.map(name=>[name,{visible:true,locked:false,opacity:1}]));
  const skin=new Set(parts.filter(p=>p.skin===true).map(p=>p.id));
  let peeled=false;
  function set(name,patch){
    if(!rows.has(name))throw Error('Unknown source system');
    for(const [key,value] of Object.entries(patch)){
      if((key==='visible'||key==='locked')&&typeof value==='boolean')continue;
      if(key==='opacity'&&Number.isFinite(value)&&value>=0.05&&value<=1)continue;
      throw Error('Invalid layer setting');
    }
    Object.assign(rows.get(name),patch);
  }
  function effective(state){
    const hidden=new Set(state.hidden),opacity=new Map(state.opacity);
    for(const id of ids){
      const settings=membership.get(id).map(s=>rows.get(s));
      // Any source-system lock protects the owner from ALL layer operations.
      // Explicit single-owner hide/isolate/clip remain independent manual controls.
      if(settings.some(s=>s.locked))continue;
      if(settings.some(s=>!s.visible)||(peeled&&skin.has(id)))hidden.add(id);
      opacity.set(id,(opacity.get(id)??1)*Math.min(1,...settings.map(s=>s.opacity)));
    }
    return {...state,hidden,opacity};
  }
  function snapshot(){return {schema:'dicom3d.reference-layers.v1',peeled,skin:[...skin],unclassified:[...ids].filter(id=>!membership.get(id).length),overlapping:[...ids].filter(id=>membership.get(id).length>1),systems:systems.map(name=>({name,...rows.get(name),owners:[...ids].filter(id=>membership.get(id).includes(name))}))};}
  return {systems,set,effective,snapshot,peel(value){if(typeof value!=='boolean')throw Error('Invalid peel state');peeled=value;},restore(){peeled=false;for(const row of rows.values())Object.assign(row,{visible:true,locked:false,opacity:1});}};
}
