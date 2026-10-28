// Explicit compiled modules only. No discovery, downloads or executable patient input.
import {IMAGING_API_VERSION,REPRESENTATIONS,ImagingRejection,requireImaging,freezeMetadata,reject} from './imaging-contract.mjs';
import {verifySpatialSource,createPublicationOwner} from './imaging-core.mjs';
const CORE=Object.freeze([{capability:'imaging.spatial-source',version:1},{capability:'imaging.integrity',version:1}]);
const key=c=>`${c.capability}@${c.version}`;
export function createImagingRegistry(modules,{disabled=[]}={}){
 const ids=new Set(),disabledIds=new Set(disabled),operations=new WeakMap();
 const entries=modules.map(module=>{
  const d=freezeMetadata(JSON.parse(JSON.stringify(module.declaration)));
  requireImaging(d.apiVersion===IMAGING_API_VERSION&&typeof d.id==='string'&&/^[a-z][a-z0-9.-]+$/.test(d.id)&&!ids.has(d.id)&&/^\d+\.\d+\.\d+$/.test(d.version),'INVALID_MODULE_DECLARATION');ids.add(d.id);
  for(const field of ['provides','requires'])requireImaging(Array.isArray(d[field])&&d[field].every(c=>typeof c.capability==='string'&&Number.isInteger(c.version)&&c.version>=1&&(!c.representation||REPRESENTATIONS.includes(c.representation))),'INVALID_CAPABILITY');
  requireImaging(['recognize','convert','validate'].every(name=>typeof module[name]==='function'),'INVALID_MODULE_IMPLEMENTATION');
  return Object.freeze({declaration:d,recognize:module.recognize,convert:module.convert,validate:module.validate});
 }).sort((a,b)=>a.declaration.id.localeCompare(b.declaration.id,'en'));
 const enabled=entries.filter(e=>!disabledIds.has(e.declaration.id));
 const matches=(e,c)=>e.declaration.provides.some(p=>key(p)===key(c));
 function resolve(entry,visiting=new Set(),resolved=new Map()){
  const id=entry.declaration.id;if(visiting.has(id))reject('DEPENDENCY_CYCLE',{moduleId:id});if(resolved.has(id))return resolved;
  visiting.add(id);
  for(const requirement of entry.declaration.requires){
   if(CORE.some(c=>key(c)===key(requirement)))continue;
   const providers=enabled.filter(e=>matches(e,requirement));
   requireImaging(providers.length!==0,'DEPENDENCY_MISSING',{moduleId:id,reasons:[key(requirement)]});
   requireImaging(providers.length===1,'DEPENDENCY_AMBIGUOUS',{moduleId:id,reasons:[key(requirement)]});resolve(providers[0],visiting,resolved);
  }
  visiting.delete(id);resolved.set(id,entry);return resolved;
 }
 function requireCapability(capability,version=1){
  const requirement={capability,version};if(CORE.some(c=>key(c)===key(requirement)))return Object.freeze({capability,version,owner:'core'});
  const providers=enabled.filter(e=>matches(e,requirement));
  const unavailable=entries.some(e=>disabledIds.has(e.declaration.id)&&matches(e,requirement))?'CAPABILITY_DISABLED':'CAPABILITY_UNAVAILABLE';
  requireImaging(providers.length>0,unavailable,{reasons:[key(requirement)]});requireImaging(providers.length===1,'CAPABILITY_AMBIGUOUS',{reasons:[key(requirement)]});
  resolve(providers[0]);return Object.freeze({capability,version,owner:providers[0].declaration.id});
 }
 function select(raw){
  requireImaging(raw?.apiVersion===IMAGING_API_VERSION&&REPRESENTATIONS.includes(raw.representation),'UNSUPPORTED_REQUEST');
  const request=freezeMetadata(JSON.parse(JSON.stringify(raw))),recognized=[],reasons=[];
  for(const entry of enabled){
   if(!entry.declaration.provides.some(c=>c.representation===request.representation))continue;
   let result;try{result=entry.recognize(request);}catch{reject('RECOGNITION_FAILED',{moduleId:entry.declaration.id});}
   requireImaging(result&&typeof result.supported==='boolean'&&!result.then,'INVALID_RECOGNITION',{moduleId:entry.declaration.id});
   if(result.supported)recognized.push(entry);else reasons.push(...(result.reasons??[]));
  }
  requireImaging(recognized.length>0,'NO_HANDLER',{reasons:[...new Set(reasons)].sort()});requireImaging(recognized.length===1,'HANDLER_AMBIGUOUS',{reasons:recognized.map(e=>e.declaration.id)});
  const entry=recognized[0],plan=resolve(entry);return {entry,request,plan:[...plan.keys()]};
 }
 return Object.freeze({
  apiVersion:IMAGING_API_VERSION,
  declarations:freezeMetadata(entries.map(e=>({declaration:e.declaration,enabled:!disabledIds.has(e.declaration.id)}))),
  requireCapability,
  capabilities(){const caps=[...CORE];for(const entry of enabled){try{resolve(entry);caps.push(...entry.declaration.provides);}catch{}}return freezeMetadata([...new Map(caps.map(c=>[key(c),c])).values()].sort((a,b)=>key(a).localeCompare(key(b),'en')));},
  select(raw){const s=select(raw);return freezeMetadata({moduleId:s.entry.declaration.id,moduleVersion:s.entry.declaration.version,plan:s.plan});},
  operations(value){const result=operations.get(value);requireImaging(result,'UNADMITTED_MODULE_OUTPUT');return result;},
  async admit(raw,buffer,{owner=createPublicationOwner(),signal}={}){
   const stamp=owner.begin();let cancelled=false;
   const cancel=()=>{cancelled=true;owner.reject(stamp);};signal?.addEventListener('abort',cancel,{once:true});
   const guard=()=>{if(cancelled||signal?.aborted)reject('CANCELLED');owner.guard(stamp);};
   try{
    guard();const selected=select(raw);guard();
    const context=Object.freeze({signal,dependencyPlan:Object.freeze(selected.plan)});
    const converted=await selected.entry.convert(selected.request,buffer,context);guard();
    requireImaging(converted&&converted.descriptor&&converted.pixels,'INVALID_CONVERSION',{moduleId:selected.entry.declaration.id});
    requireImaging(await selected.entry.validate(converted,context)===true,'MODULE_VALIDATION_FAILED',{moduleId:selected.entry.declaration.id});guard();
    requireImaging(selected.request.representation==='spatial-volume','UNIMPLEMENTED_REPRESENTATION');
    const value=await verifySpatialSource(converted.descriptor,buffer,converted.pixels,{signal});guard();
    operations.set(value,Object.freeze({...converted.operations}));return owner.publish(value,stamp);
   }catch(error){owner.reject(stamp);if(error instanceof ImagingRejection)throw error;reject('MODULE_FAILED');}
   finally{signal?.removeEventListener('abort',cancel);}
  }
 });
}
