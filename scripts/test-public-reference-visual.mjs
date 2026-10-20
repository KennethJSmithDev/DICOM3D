import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {samplePublicReference,referenceVisualRules,referenceFragmentVisible} from '../viewer/src/public-reference-samples.mjs';
import {worldBounds} from '../viewer/src/camera-fit.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const reflected=new Float32Array([-1,0,0,0,0,1,0,0,0,0,1,0,.25,.5,-.25,1]);
const receipt={scope:'CPU deterministic presentation sampling, source identity and pure reveal/pick rules; no GPU or visual qualification',syntheticCases:0,assets:[]};
function part(positions,world=identity){
  const min=[0,1,2].map(axis=>Math.min(...positions.filter((_,i)=>i%3===axis)));
  const max=[0,1,2].map(axis=>Math.max(...positions.filter((_,i)=>i%3===axis)));
  const source={positions:new Float32Array(positions),indices:new Uint32Array([0,1,2])};
  return {world,bounds:worldBounds([{boundMin:min,boundMax:max,worldMatrix:world}]),geometry:()=>({positions:source.positions.slice(),indices:source.indices.slice()}),source};
}
const synthetic=[
  {id:'group-a',parts:[part([0,0,0,1,0,0,0,1,0]),part([1,1,1,2,1,1,1,2,1],reflected)]},
  {id:'group-b',parts:[part([-1,0,0,0,-1,0,0,0,-1])]},
  {id:'group-c',parts:[part([3,0,0,4,0,0,3,1,0]),part([5,0,0,6,0,0,5,1,0]),part([7,0,0,8,0,0,7,1,0])]}
];
const beforeSynthetic=JSON.stringify(synthetic.map(g=>g.parts.map(p=>[Array.from(p.source.positions),Array.from(p.source.indices),Array.from(p.world)])));
function validateSamples(groups,result,capacity){
  assert.equal(result.data.length,capacity*8);
  assert.equal(result.counts.reduce((a,b)=>a+b,0),capacity);
  assert.ok(Math.max(...result.counts)-Math.min(...result.counts)<=1);
  const cache=new Map();
  for(let i=0;i<capacity;i++){
    const group=i%groups.length,primitive=Math.floor(i/groups.length)%groups[group].parts.length;
    assert.equal(result.data[i*8+3],group);
    assert.equal(result.primitives[i],primitive);
    const p=groups[group].parts[primitive],key=`${group}:${primitive}`;
    // This bounded test cache is test-only, not the production sampler's memory policy.
    if(!cache.has(key))cache.set(key,p.geometry().positions);
    const positions=cache.get(key),vertex=result.vertices[i],j=vertex*3,m=p.world;
    assert.ok(j+2<positions.length);
    for(let axis=0;axis<3;axis++){
      assert.equal(result.data[i*8+axis],Math.fround(m[axis]*positions[j]+m[4+axis]*positions[j+1]+m[8+axis]*positions[j+2]+m[12+axis]));
      assert.ok(result.data[i*8+4+axis]>=Math.fround(p.bounds.min[axis])-1e-7);
      assert.ok(result.data[i*8+4+axis]<=Math.fround(p.bounds.max[axis])+1e-7);
    }
    assert.ok(result.data[i*8+7]>=0&&result.data[i*8+7]<=1);
  }
}
function budgets(groups){
  const all=samplePublicReference(groups,8192);
  validateSamples(groups,all,8192);
  assert.deepEqual(all.data,samplePublicReference(groups,8192).data);
  for(const size of [512,2048]){
    const smaller=samplePublicReference(groups,size);
    validateSamples(groups,smaller,size);
    assert.deepEqual(smaller.data,all.data.slice(0,size*8));
    assert.deepEqual(smaller.vertices,all.vertices.slice(0,size));
    assert.deepEqual(smaller.primitives,all.primitives.slice(0,size));
    assert.ok(smaller.counts.every(n=>n>0));
  }
  return all;
}
budgets(synthetic);receipt.syntheticCases++;
assert.equal(JSON.stringify(synthetic.map(g=>g.parts.map(p=>[Array.from(p.source.positions),Array.from(p.source.indices),Array.from(p.world)]))),beforeSynthetic);receipt.syntheticCases++;
for(const bad of [0,8193,1.5])assert.throws(()=>samplePublicReference(synthetic,bad));
assert.throws(()=>samplePublicReference([],512));
assert.throws(()=>samplePublicReference([{id:'same',parts:synthetic[0].parts},{id:'same',parts:synthetic[1].parts}],512));
assert.throws(()=>samplePublicReference([{id:'empty',parts:[]}],512));
assert.throws(()=>samplePublicReference([{id:'bad',parts:[part([NaN,0,0,1,0,0,0,1,0])]}],512));
receipt.syntheticCases+=7;
for(const effect of ['assembly','layers']){
  const complete=referenceVisualRules('materialization',1,effect,false);
  assert.equal(complete.sourceVisible,true);assert.equal(complete.particlesVisible,false);assert.equal(complete.reveal,1);assert.equal(complete.opacity,1);
  assert.deepEqual(referenceVisualRules('materialization',.2,effect,true),complete);
  const threshold=referenceVisualRules('materialization',.06,effect,false);
  assert.equal(threshold.sourceVisible,false);assert.equal(threshold.opacity,0);
  const initial=referenceVisualRules('materialization',0,effect,false);
  assert.equal(initial.sourceVisible,false);assert.equal(initial.particlesVisible,false);
  receipt.syntheticCases+=3;
}
assert.throws(()=>referenceVisualRules('invented',1,'layers',false));
assert.throws(()=>referenceVisualRules('holographic',NaN,'layers',false));
assert.throws(()=>referenceVisualRules('holographic',1,'invented',false));
assert.equal(referenceFragmentVisible(1.5,2,[0,1],1),true,'Complete reveal does not clip vertices beyond nominal normalization');
assert.equal(referenceFragmentVisible(1.5,1,[0,2],1),false,'Explicit source clip remains');
assert.equal(referenceFragmentVisible(.5,2,[0,1],.4),false);
assert.equal(referenceFragmentVisible(.3,2,[0,1],.4),true);
receipt.syntheticCases+=7;

// Parse only the existing source GLBs. No regeneration, compression or source writes.
function sourceGroups(name,expectedGroups,expectedPrimitives,expectedSha){
  const dir=join(root,'reference/public/reference'),manifest=JSON.parse(readFileSync(join(dir,`${name}.manifest.json`),'utf8'));
  const bytes=readFileSync(join(dir,manifest.asset.relative_filename)),initialSha=sha(bytes);
  assert.equal(initialSha,expectedSha);assert.equal(initialSha,manifest.asset.sha256);
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  let json,bin;
  for(let offset=12;offset<bytes.length;){
    const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4),chunk=bytes.subarray(offset+8,offset+8+length);
    if(type===0x4e4f534a)json=JSON.parse(chunk.toString('utf8').trim());
    if(type===0x004e4942)bin=chunk;
    offset+=8+length;
  }
  assert.ok(json&&bin);
  const componentBytes={5123:2,5125:4,5126:4},components={SCALAR:1,VEC3:3};
  function accessor(index){
    const a=json.accessors[index],v=json.bufferViews[a.bufferView],width=componentBytes[a.componentType],n=components[a.type],stride=v.byteStride??width*n;
    assert.ok(width&&n&&!a.sparse);
    const out=a.componentType===5126?new Float32Array(a.count*n):new Uint32Array(a.count*n);
    for(let row=0;row<a.count;row++)for(let c=0;c<n;c++){
      const p=(v.byteOffset??0)+(a.byteOffset??0)+row*stride+c*width;
      out[row*n+c]=a.componentType===5126?bin.readFloatLE(p):a.componentType===5123?bin.readUInt16LE(p):bin.readUInt32LE(p);
    }
    return out;
  }
  const groups=manifest.reference.structures.map(s=>({id:s.id,parts:[]}));
  const groupMap=new Map(groups.map(g=>[g.id,g])),world=new Float32Array([-1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),seen=new Set();
  function visit(index,owner=null){
    assert.ok(!seen.has(index),'Source scene node repeated');seen.add(index);
    const node=json.nodes[index];assert.ok(!node.matrix&&!node.translation&&!node.rotation&&!node.scale,'Fixture transform assumption changed');
    if(groupMap.has(node.name))owner=node.name;
    if(node.mesh!==undefined){
      assert.ok(owner,`Unowned source mesh ${node.name}`);
      for(const primitive of json.meshes[node.mesh].primitives){
        const a=json.accessors[primitive.attributes.POSITION];
        assert.equal(primitive.mode??4,4);assert.ok(a.min&&a.max);
        groupMap.get(owner).parts.push({world,bounds:worldBounds([{boundMin:a.min,boundMax:a.max,worldMatrix:world}]),geometry:()=>({positions:accessor(primitive.attributes.POSITION),indices:accessor(primitive.indices)})});
      }
    }
    for(const child of node.children??[])visit(child,owner);
  }
  for(const index of json.scenes[json.scene??0].nodes)visit(index);
  assert.equal(groups.length,expectedGroups);assert.equal(groups.reduce((n,g)=>n+g.parts.length,0),expectedPrimitives);assert.ok(groups.every(g=>g.parts.length));
  const started=performance.now(),samples=budgets(groups),elapsedMs=performance.now()-started;
  assert.equal(sha(bytes),initialSha,'Source GLB bytes unchanged');
  const sampled=new Set(Array.from(samples.primitives,(primitive,i)=>`${i%groups.length}:${primitive}`));
  assert.equal(sampled.size,expectedPrimitives,'All source primitives represented within capacity');
  receipt.assets.push({name,sha256:initialSha,groups:groups.length,primitives:expectedPrimitives,budgets:[512,2048,8192],capacityOutputBytes:samples.outputBytes,maxTemporaryCopyBytes:samples.maxTemporaryCopyBytes,totalCopiedBytes:samples.totalCopiedBytes,allPrimitiveTargetsRepresentedAt8192:true,elapsedCpuTestMs:elapsedMs});
}
sourceGroups('bp3d-male',33,33,'dcef47dc21d252b93b288b649ac30795d9de73f733c27b285f8d1a43ae4fc055');
sourceGroups('hra-female',22,231,'a61a60841fd3c8308d332421385be03188c0babd58b78ae101adf2807a88473a');
console.log(JSON.stringify({result:'PASS',...receipt},null,2));
