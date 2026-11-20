import {Group} from 'three';
import {composeSourceCatalog} from './source-native-selection.js';
import {disposeScene,loadBundle,loadBundleManifest,loadSourceCatalog} from './atlas.js';
import delta from '../atlas-delta/female-delta.json';
import {FEMALE_EXCLUDED_OWNER_IDS,buildFemaleCatalog,labelFemaleRecord,sourceAttributionManifest} from './female-catalog.mjs';

export const FEMALE_SKIN_ID='FMA7163';
const replaced=new Set(FEMALE_EXCLUDED_OWNER_IDS);

export async function loadFemaleReference(base,signal,{initialIds=base.bundles.map(b=>b.id),includeOverlay=true}={}){
 const scene=new Group();
 const sourceManifests=new Map();
 const resident=new Set();let disposed=false;
 const overlayManifest=await loadBundleManifest(delta,signal,'female-delta');
 const hra=await loadSourceCatalog(delta.sourceNative,signal,'female-delta');
 const extra={...hra,atoms:hra.atoms.map(labelFemaleRecord),concepts:hra.concepts.map(c=>({...labelFemaleRecord(c),relation:'HRA_PART_OF'}))};
 const index={...buildFemaleCatalog(base,overlayManifest,delta),sourceNative:composeSourceCatalog(base.sourceNative,extra,replaced)};
 const item={scene,index,sourceManifests,resident,manifest:{reference:{id:'BodyParts3D + HRA female composite'}},bytes:0};
 async function ensure(ids,requestSignal){
  const staged=[];
  try{
   for(const id of new Set(ids)){
    requestSignal?.throwIfAborted();if(disposed)throw new DOMException('Unloaded','AbortError');if(resident.has(id))continue;
    const descriptor=id===delta.id?delta:base.bundles.find(b=>b.id===id);if(!descriptor)throw Error(`Unknown female bundle ${id}`);
    const part=await loadBundle(descriptor,requestSignal,id===delta.id?'female-delta':'atlas');const entry={id,part};staged.push(entry);entry.notice=sourceAttributionManifest(part.manifest);
    part.scene.traverse(node=>{if(replaced.has(node.userData.semanticId)){node.visible=false;node.traverse(child=>{delete child.userData.semanticId;child.raycast=()=>{}})}});
   }
   requestSignal?.throwIfAborted();if(disposed)throw new DOMException('Unloaded','AbortError');
   // Publish a verified batch together. Cancellation must not expose unfiltered
   // partial anatomy or release the previous reference's independent leases.
   for(const {id,part,notice} of staged){scene.add(part.scene);sourceManifests.set(id,notice);resident.add(id);item.bytes+=part.bytes;}
   if(staged.length)scene.userData.atlasRevision=(scene.userData.atlasRevision??0)+1;
  }catch(error){for(const {part} of staged)disposeScene(part.scene);throw error;}
 }
 item.ensure=ensure;item.markDisposed=()=>{disposed=true};
 try{
  await ensure([...initialIds,...(includeOverlay?[delta.id]:[])],signal);
  return item;
 }catch(error){
  disposeScene(scene);
  throw error;
 }
}
