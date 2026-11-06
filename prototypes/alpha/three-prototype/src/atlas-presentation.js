import {createSourceSelectionProjection} from './source-native-selection.js';
import {assemblyOffset} from './assembly-presentation.js';
/** Reversible presentation of admitted atlas owners. Source geometry and catalog are unchanged.
 * Call restoreScene(scene) before disposeScene(scene); call restoreAll before full teardown.
 * Visibility affects resident owners only and does not load, relabel, or classify anatomy.
 */
export const BODY_ENVELOPE_ID = 'FMA7163';
export const defaultHiddenOwners = () => new Set([BODY_ENVELOPE_ID]);

// Three's raycaster can report invisible objects; do not let a hidden owner consume a pointer event.
export function isVisibleOwner(node) {
  for (let n = node; n; n = n.parent) if (!n.visible) return false;
  return true;
}

export function createAtlasPresentation() {
  const records = new Map(),sourceProjection=createSourceSelectionProjection();
  function capture(scene) {
    let r = records.get(scene);
    if (r) return r;
    r = {owners: new Map(), materials: new Map(), overrides: new Map()};
    scene.traverse(n => {
      if (n.userData?.semanticId) r.owners.set(n.userData.semanticId, {node:n, visible:n.visible, position:n.position.clone(), offset:assemblyOffset(n,n.userData.semanticId)});
      if (!n.isMesh) return;
      for (const m of (Array.isArray(n.material) ? n.material : [n.material])) {
        if (!m || r.materials.has(m)) continue;
        r.materials.set(m, {opacity:m.opacity, transparent:m.transparent, depthWrite:m.depthWrite,
          color:m.color?.clone(), emissive:m.emissive?.clone(), emissiveIntensity:m.emissiveIntensity});
      }
    });
    records.set(scene, r);
    return r;
  }
  function apply(bundles, options = {}) {
    sourceProjection.restore();
    const hidden = options.hiddenIds instanceof Set ? options.hiddenIds : new Set(options.hiddenIds || []);
    const allowed = options.allowedIds instanceof Set ? options.allowedIds : null;
    const isolate = options.isolatedId || '';
    const opacity = Math.max(0.05, Math.min(1, Number.isFinite(options.opacity) ? options.opacity : 1));
    const explode = Math.max(0, Math.min(1, Number.isFinite(options.explode) ? options.explode : 0));
    const holographic = options.style === 'holographic';
    for (const {scene} of bundles.values()) {
      const r = capture(scene);
      for (const [id, owner] of r.owners) {
        owner.node.visible = owner.visible && !hidden.has(id) && (!allowed || allowed.has(id)) && (!isolate || id === isolate);
        owner.node.position.copy(owner.position);
        owner.node.position.addScaledVector(owner.offset, Math.max(0,Math.min(1,options.assemblyAmount || 0)));
        // Only the two named source surfaces are offset. This is not a tissue segmentation.
        if (id === 'FMA7309' || id === 'FMA7310') owner.node.position.x += (id === 'FMA7309' ? -1 : 1) * explode * .18;
      }
      // Restore per-owner clones before applying global appearance; shared materials
      // remain shared for unmodified owners, overrides never leak to a neighbour.
      for (const [node, override] of r.overrides) {
        node.material=override.original;
        for(const mat of override.clones) mat.dispose();
      }
      r.overrides.clear();
      for (const [mat, base] of r.materials) {
        const nextOpacity = base.opacity * opacity * (holographic ? .7 : 1);
        const transparent = base.transparent || nextOpacity < 1;
        if (mat.transparent !== transparent || mat.depthWrite !== (transparent ? false : base.depthWrite)) mat.needsUpdate = true;
        mat.opacity = nextOpacity; mat.transparent = transparent;
        mat.depthWrite = transparent ? false : base.depthWrite;
        if (base.color && mat.color) holographic ? mat.color.set('#48c9f0') : mat.color.copy(base.color);
        if (base.emissive && mat.emissive) holographic ? mat.emissive.set('#075275') : mat.emissive.copy(base.emissive);
        if (base.emissiveIntensity !== undefined) mat.emissiveIntensity = holographic ? .55 : base.emissiveIntensity;
      }
      for(const [id,owner] of r.owners) {
        const override=options.ownerOverrides?.get(id);
        if(!override)continue;
        owner.node.traverse(node=>{
          if(!node.isMesh)return;
          const original=node.material, source=Array.isArray(original)?original:[original];
          const clones=source.map(mat=>{
            const copy=mat.clone();
            copy.opacity*=Math.max(.05,Math.min(1,override.opacity??1));
            if(override.style==='holographic') {
              copy.color?.set('#48c9f0');copy.emissive?.set('#075275');
              if(copy.emissiveIntensity!==undefined)copy.emissiveIntensity=.55;
              copy.opacity*=.7;
            }
            copy.transparent=copy.transparent||copy.opacity<1;
            if(copy.transparent)copy.depthWrite=false;
            return copy;
          });
          node.material=Array.isArray(original)?clones:clones[0];
          r.overrides.set(node,{original,clones});
        });
      }
    }
    sourceProjection.apply(bundles,options.sourceSelection);
  }
  function restoreScene(scene) {
    sourceProjection.restore();
    const r = records.get(scene); if (!r) return;
    for(const [node,override] of r.overrides){node.material=override.original;override.clones.forEach(m=>m.dispose());}r.overrides.clear();
    for (const {node,visible,position} of r.owners.values()) {node.visible=visible; node.position.copy(position);}
    for (const [mat,base] of r.materials) {
      mat.opacity=base.opacity; mat.transparent=base.transparent; mat.depthWrite=base.depthWrite;
      if (base.color && mat.color) mat.color.copy(base.color);
      if (base.emissive && mat.emissive) mat.emissive.copy(base.emissive);
      if (base.emissiveIntensity !== undefined) mat.emissiveIntensity=base.emissiveIntensity;
      mat.needsUpdate=true;
    }
    records.delete(scene);
  }
  function restoreAll() {for (const scene of [...records.keys()]) restoreScene(scene);}
  function cloneSourceScene(scene) {
    const r=capture(scene), clone=scene.clone(true), originals=[],copies=[];
    scene.traverse(n=>originals.push(n));clone.traverse(n=>copies.push(n));
    for(let i=0;i<originals.length;i++) {
      const original=originals[i],copy=copies[i],owner=r.owners.get(original.userData?.semanticId);
      if(owner){copy.position.copy(owner.position);copy.visible=owner.visible&&!['FMA7163','VH_F_skin'].includes(original.userData.semanticId);}
      if(original.userData.fragmentBucket!==undefined)copy.visible=false;
      if(!original.isMesh)continue;
      const mats=r.overrides.get(original)?.original??original.material;
      const cloneMaterial=m=>{const c=m.clone(),base=r.materials.get(m);if(base){c.opacity=base.opacity;c.transparent=base.transparent;c.depthWrite=base.depthWrite;if(base.color)c.color?.copy(base.color);if(base.emissive)c.emissive?.copy(base.emissive);if(base.emissiveIntensity!==undefined)c.emissiveIntensity=base.emissiveIntensity;}return c};
      copy.material=Array.isArray(mats)?mats.map(cloneMaterial):cloneMaterial(mats);
    }
    clone.updateMatrixWorld(true);return clone;
  }
  return {apply, restoreScene, restoreAll,cloneSourceScene,clearSourceSelection:sourceProjection.restore,get sourceInfo(){return sourceProjection.info;}};
}
