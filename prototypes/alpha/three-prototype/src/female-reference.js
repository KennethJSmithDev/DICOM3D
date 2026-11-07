import {Group} from 'three';
import {disposeScene,loadBundle} from './atlas.js';
import delta from '../atlas-delta/female-delta.json';
import {FEMALE_EXCLUDED_OWNER_IDS,buildFemaleCatalog,sourceAttributionManifest} from './female-catalog.mjs';

export const FEMALE_SKIN_ID='FMA7163';
const replaced=new Set(FEMALE_EXCLUDED_OWNER_IDS);

export async function loadFemaleReference(base,signal){
 const scene=new Group();
 const sourceManifests=new Map();
 let bytes=0;
 try{
  for(const descriptor of base.bundles){
   const item=await loadBundle(descriptor,signal);
   scene.add(item.scene);
   sourceManifests.set(descriptor.id,sourceAttributionManifest(item.manifest));
   bytes+=item.bytes;
   const removed=[];
   item.scene.traverse(node=>{
    if(replaced.has(node.userData.semanticId)) removed.push(node);
   });
   for(const node of removed){node.visible=false;node.traverse(child=>{delete child.userData.semanticId;child.raycast=()=>{};});}
  }
  const overlay=await loadBundle(delta,signal,'female-delta');
  scene.add(overlay.scene);
  sourceManifests.set(delta.id,sourceAttributionManifest(overlay.manifest));
  bytes+=overlay.bytes;
  const index=buildFemaleCatalog(base,overlay.manifest,delta);
  return {scene,index,sourceManifests,manifest:{reference:{id:'BodyParts3D + HRA female composite'}},bytes};
 }catch(error){
  disposeScene(scene);
  throw error;
 }
}
