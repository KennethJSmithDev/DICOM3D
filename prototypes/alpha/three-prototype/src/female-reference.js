import {Group} from 'three';
import {composeSourceCatalog} from './source-native-selection.js';
import {disposeScene,loadBundle,loadSourceCatalog} from './atlas.js';
import delta from '../atlas-delta/female-delta.json';

export const FEMALE_SKIN_ID='FMA7163';
const replaced=new Set([
 'FMA15900', // HRA bladder, aligned with the source bladder center.
 'FMA9600','FMA19667', // Prostate and male urethra.
 'FMA7211','FMA7212', // Testes.
 'FMA21385','FMA21386','FMA20818','FMA20819', // Penile vessels.
]);

export async function loadFemaleReference(base,signal){
 const scene=new Group();
 let bytes=0;
 try{
  for(const descriptor of base.bundles){
   const item=await loadBundle(descriptor,signal);
   scene.add(item.scene);
   bytes+=item.bytes;
   const removed=[];
   item.scene.traverse(node=>{
    if(replaced.has(node.userData.semanticId)){
     removed.push(node);
    }
   });
   for(const node of removed){node.visible=false;node.traverse(child=>{delete child.userData.semanticId;child.raycast=()=>{};});}
  }
  const overlay=await loadBundle(delta,signal,'female-delta');
  scene.add(overlay.scene);
  bytes+=overlay.bytes;
  const structures=[
   ...base.structures.filter(part=>!replaced.has(part.id)).map(part=>({...part,source:'BodyParts3D'})),
   ...overlay.manifest.reference.structures.map(part=>({...part,bundleId:delta.id,source:'HRA'})),
  ];
  const extra=await loadSourceCatalog(delta.sourceNative,signal,'female-delta');extra.concepts=extra.concepts.map(c=>({...c,relation:'HRA_PART_OF'}));const index={structures,hierarchy:base.hierarchy??[],held:base.held??[],bundles:[...base.bundles,delta],sourceNative:composeSourceCatalog(base.sourceNative,extra,replaced)};
  return {scene,index,manifest:{reference:{id:'BodyParts3D + HRA female composite'}},bytes};
 }catch(error){
  disposeScene(scene);
  throw error;
 }
}
