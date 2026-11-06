import assert from 'node:assert/strict';
import {createPickGeneration} from '../viewer/src/pick-generation.mjs';

const rows=[];
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
for(const result of [{hit:true,pickedMesh:'Skeleton'},{hit:false,pickedMesh:null}]) {
  const name=result.hit?'hit':'miss';
  {
    const gate=createPickGeneration(),d=deferred(),commits=[];
    const pending=gate.run(()=>d.promise,x=>commits.push(x));d.resolve(result);
    assert.equal(await pending,true);assert.deepEqual(commits,[result]);rows.push('valid '+name);
  }
  for(const intent of ['dropdown','clear','restore','switch','reload','unload']) {
    const gate=createPickGeneration(),d=deferred();let selected='initial';
    const pending=gate.run(()=>d.promise,x=>selected=x.hit?x.pickedMesh:null);
    gate.invalidate();selected=intent;d.resolve(result);
    assert.equal(await pending,false);assert.equal(selected,intent);rows.push(intent+' supersedes '+name);
  }
  {
    const gate=createPickGeneration(),d=deferred();let commits=0;
    const pending=gate.run(()=>d.promise,()=>commits++);gate.dispose();d.resolve(result);
    assert.equal(await pending,false);assert.equal(await gate.run(async()=>result,()=>commits++),false);
    assert.equal(commits,0);rows.push('teardown supersedes '+name);
  }
}
for(const order of ['older-first','newer-first'])for(const olderHit of [true,false])for(const newerHit of [true,false]) {
  const gate=createPickGeneration(),a=deferred(),b=deferred(),commits=[];
  const old={hit:olderHit,pickedMesh:olderHit?'Skeleton':null},latest={hit:newerHit,pickedMesh:newerHit?'Heart':null};
  const pa=gate.run(()=>a.promise,x=>commits.push(x)),pb=gate.run(()=>b.promise,x=>commits.push(x));
  if(order==='older-first'){a.resolve(old);assert.equal(await pa,false);b.resolve(latest);assert.equal(await pb,true);}
  else{b.resolve(latest);assert.equal(await pb,true);a.resolve(old);assert.equal(await pa,false);}
  assert.deepEqual(commits,[latest]);rows.push(`${order} oldHit=${olderHit} newHit=${newerHit}`);
}
// A committed pick followed by later explicit intent also retains normal ordering.
{
  const gate=createPickGeneration();let selected=null;
  assert.equal(await gate.run(async()=>({hit:true,pickedMesh:'Heart'}),x=>selected=x.pickedMesh),true);
  gate.invalidate();selected='dropdown';assert.equal(selected,'dropdown');rows.push('serialized pick then explicit intent');
}
for(const invalidation of ['none','invalidate','dispose']) {
  const gate=createPickGeneration();let reject;
  const pending=gate.run(()=>new Promise((_,r)=>reject=r),()=>assert.fail('Rejected pick committed'));
  if(invalidation!=='none')gate[invalidation]();
  const failure=new Error('readback rejected');reject(failure);
  if(invalidation==='none')await assert.rejects(pending,e=>e===failure);
  else assert.equal(await pending,false);
  rows.push('request rejection: '+invalidation);
}
console.log(JSON.stringify({status:'PASS',cases:rows.length,tests:rows,resources:'One numeric revision and disposed flag; no timers, source data, or selection copy.'}));
