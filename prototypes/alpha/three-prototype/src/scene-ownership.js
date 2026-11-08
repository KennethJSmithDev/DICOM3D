const leases=new WeakMap(),resources=new Map(),admittedBytes=new WeakMap();
// geometryBytes tallies admitted attribute/index views, not live GPU or total memory.
// Record once: render backends may add/convert derived attributes later.
export const sceneOwnership={scenes:0,geometries:0,textures:0,geometryBytes:0};
function bytes(geometry){const arrays=new Set(Object.values(geometry.attributes).map(a=>a.array));if(geometry.index)arrays.add(geometry.index.array);return [...arrays].reduce((n,a)=>n+a.byteLength,0)}
function retain(resource){const count=resources.get(resource)||0;resources.set(resource,count+1);if(!count){if(resource.isBufferGeometry){sceneOwnership.geometries++;const size=bytes(resource);admittedBytes.set(resource,size);sceneOwnership.geometryBytes+=size}else sceneOwnership.textures++}}
function release(resource){const count=resources.get(resource);if(count>1){resources.set(resource,count-1);return}resources.delete(resource);if(resource.isBufferGeometry){sceneOwnership.geometries--;sceneOwnership.geometryBytes-=admittedBytes.get(resource)??0;admittedBytes.delete(resource)}else sceneOwnership.textures--;resource.dispose()}
export function ownScene(scene){
 if(leases.has(scene))return scene;
 const shared=new Set(),materials=new Set();scene.traverse(n=>{if(n.geometry)shared.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:n.material?[n.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)shared.add(v)}});
 shared.forEach(retain);sceneOwnership.scenes++;leases.set(scene,()=>{materials.forEach(m=>m.dispose());shared.forEach(release);sceneOwnership.scenes--});return scene;
}
export function releaseScene(scene){const release=leases.get(scene);if(!release)return false;leases.delete(scene);release();return true}
export function cloneOwnedScene(scene){const clone=scene.clone(true),materials=new Map();clone.traverse(n=>{if(!n.material)return;const copy=m=>{if(!materials.has(m))materials.set(m,m.clone());return materials.get(m)};n.material=Array.isArray(n.material)?n.material.map(copy):copy(n.material)});return ownScene(clone)}
