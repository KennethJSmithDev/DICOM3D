import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {disposeScene} from './atlas.js';
import {sha256,readFixedAsset,reconstructVerifiedAsset,FEMALE_PARTS} from './verified-asset-parts.js';

// Existing admitted HRA subset. The source identity and every byte are fixed;
// it is an independent generalized reference, not a registration to CT.
export const FEMALE_SKIN_ID='VH_F_skin';
export const FEMALE_MANIFEST_SHA='4f98280af464abee0f7ca78126cf2b8f7e09765077410e3409e3b047a3c2d1ce';
export const FEMALE_ASSET_SHA='24abc4d8bd0a00bfc93ab45e227c1e9b157ffc0d21d1e5c22408fbe3933f60cb';
const ASSET_BYTES=187220140;
const hash=sha256;
const readAsset=(name,expected,signal)=>readFixedAsset(`${import.meta.env.BASE_URL}female/${name}`,expected,signal);
export async function loadFemaleReference(signal){
 const metadata=await readAsset('hra-female.manifest.json',1106683,signal);
 if(await hash(metadata)!==FEMALE_MANIFEST_SHA)throw Error('Female reference manifest integrity mismatch');
 const manifest=JSON.parse(new TextDecoder().decode(metadata));
 if(manifest.reference?.id!=='BODY-HRA-F-001'||manifest.asset?.relative_filename!=='hra-female.glb'||manifest.asset?.sha256!==FEMALE_ASSET_SHA||!Array.isArray(manifest.reference.structures)||!Array.isArray(manifest.reference.hierarchy))throw Error('Unsupported female reference manifest');
 const structures=manifest.reference.structures,ids=new Set(structures.map(p=>p.id));
 if(ids.size!==structures.length||!ids.has(FEMALE_SKIN_ID))throw Error('Invalid female reference ownership');
 const bytes=await reconstructVerifiedAsset(`${import.meta.env.BASE_URL}female/`,FEMALE_PARTS,signal);
 if(bytes.byteLength!==ASSET_BYTES||await hash(bytes)!==FEMALE_ASSET_SHA)throw Error('Female reference asset integrity mismatch');
 signal?.throwIfAborted();let scene;
 try{
  scene=(await new GLTFLoader().parseAsync(bytes.buffer,'')).scene;signal?.throwIfAborted();
  const seen=new Set();scene.traverse(node=>{if(ids.has(node.name)){if(seen.has(node.name))throw Error(`Duplicate reference owner ${node.name}`);seen.add(node.name);node.userData.semanticId=node.name}});
  if(seen.size!==ids.size)throw Error('Incomplete female reference ownership');
  const index={structures:structures.map(p=>({...p,bundleId:'female-reference'})),hierarchy:manifest.reference.hierarchy.filter(p=>!p.hold),held:manifest.reference.hierarchy.filter(p=>p.hold),sourceRelationshipCount:manifest.reference.hierarchy.length,bundles:[{id:'female-reference'}]};
  return {scene,manifest,index,bytes:ASSET_BYTES};
 }catch(error){if(scene)disposeScene(scene);throw error}
}
