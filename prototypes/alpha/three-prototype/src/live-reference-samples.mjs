// Presentation-only original-vertex samples. Semantic groups retain one global budget.
// WHY: HRA female has 231 primitives in 22 groups; a primitive is not an organ/budget.
// INVARIANT: no geometry writes; O(capacity) output plus one copied source primitive.
// EVIDENCE: B04-05 lab vertex sampler; test-public-reference-visual.mjs adds multi-primitive cases.
export function samplePublicReference(groups, capacity=8192, seed=0x52454631) {
  if(!Number.isInteger(capacity)||capacity<1||capacity>8192||!groups.length||groups.length>capacity)throw Error('Invalid reference sample budget');
  if(new Set(groups.map(g=>g.id)).size!==groups.length)throw Error('Duplicate reference group identity');
  const data=new Float32Array(capacity*8),vertices=new Uint32Array(capacity),primitives=new Uint32Array(capacity),counts=new Uint32Array(groups.length);
  let maxTemporaryCopyBytes=0,totalCopiedBytes=0;
  for(let group=0;group<groups.length;group++) {
    const parts=groups[group].parts;
    if(!parts?.length)throw Error('Empty reference group');
    for(let primitive=0;primitive<parts.length;primitive++) {
      const first=group+primitive*groups.length;if(first>=capacity)continue;
      const part=parts[primitive],geometry=part.geometry(),positions=geometry.positions,m=part.world,b=part.bounds,count=positions.length/3;
      if(!Number.isInteger(count)||count<1||m.length!==16||!Array.from(m).every(Number.isFinite)||!b.min.every(Number.isFinite)||!b.max.every(Number.isFinite)||b.min.some((v,k)=>v>b.max[k]))throw Error('Invalid reference primitive');
      const copied=positions.byteLength+(geometry.indices?.byteLength??0);maxTemporaryCopyBytes=Math.max(maxTemporaryCopyBytes,copied);totalCopiedBytes+=copied;
      for(let i=first;i<capacity;i+=parts.length*groups.length) {
        // Per-sample seed makes every smaller budget an exact prefix of capacity.
        let state=(seed^Math.imul(i+1,0x9e3779b9))>>>0;
        const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
        const vertex=Math.floor(random()*count),j=vertex*3;vertices[i]=vertex;primitives[i]=primitive;counts[group]++;
        for(let axis=0;axis<3;axis++) {
          const v=m[axis]*positions[j]+m[4+axis]*positions[j+1]+m[8+axis]*positions[j+2]+m[12+axis];
          if(!Number.isFinite(v))throw Error('Nonfinite source target');
          data[i*8+axis]=v;data[i*8+4+axis]=b.min[axis]+random()*(b.max[axis]-b.min[axis]);
        }
        data[i*8+3]=group;data[i*8+7]=random();
      }
    }
  }
  return {data,vertices,primitives,counts,maxTemporaryCopyBytes,totalCopiedBytes,outputBytes:data.byteLength+vertices.byteLength+primitives.byteLength+counts.byteLength,method:'equal semantic-group round-robin; round-robin source primitives and deterministic original vertices; not area-uniform or medical voxels'};
}

export function referenceVisualRules(mode,progress,effect,reduced) {
  if(!['scientific','holographic','materialization'].includes(mode)||!['assembly','layers'].includes(effect)||!Number.isFinite(progress))throw Error('Invalid reference presentation');
  const effective=reduced?1:Math.max(0,Math.min(1,progress)),forming=mode==='materialization';
  return {effective,forming,reveal:forming&&effect==='layers'?Math.min(1,.12+.88*Math.max(0,(effective-.06)/.94)):1,opacity:forming?Math.min(1,Math.max(0,(effective-.06)/.06)):1,sourceVisible:!forming||effective>.06,particlesVisible:forming&&effective>0&&effective<1};
}

export function referenceFragmentVisible(worldY,clipY,boundsY,reveal) {
  return Number.isFinite(worldY)&&worldY<=clipY&&(reveal>=1||(worldY-boundsY[0])/boundsY[1]<=reveal);
}
