import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {anatomyIndex} from '../viewer/src/reference-hierarchy.mjs';
const fixture=name=>JSON.parse(readFileSync(new URL(`../reference/public/reference/${name}.manifest.json`,import.meta.url)));
for(const [name,count,parent,member] of [['bp3d-male',386,'FMA7159','FMA15571'],['hra-female',380,'VH_F_urinary_system','VH_F_renal_papilla_L_a']]){
 const m=fixture(name),before=JSON.stringify(m),index=anatomyIndex(m),parts=m.reference.structures;
 assert.equal(parts.length,count);assert.equal(new Set(parts.map(p=>p.id)).size,count);
 assert(index.count(parent)>0);assert(index.matches(parts.find(p=>p.id===member),{parent}));
 assert(index.matches(parts.find(p=>p.id===member),{query:member.toLowerCase()}));
 for(const system of index.systems)assert.deepEqual(parts.filter(p=>index.matches(p,{system})).map(p=>p.id),parts.filter(p=>p.systems.includes(system)).map(p=>p.id));
 assert.equal(index.matches(parts[0],{query:'not-a-source-structure-xyz'}),false);
 assert.equal(index.matches(parts[0],{region:'not-a-source-region'}),false);
 assert.equal(JSON.stringify(m),before,'Index/filter must not mutate source or presentation state');
}
const legacy={reference:{structures:[{id:'skin',label:'Skin',region:'Body envelope'},{id:'heart',label:'Heart',region:'Thorax'}]}};
const index=anatomyIndex(legacy);assert.deepEqual(index.systems,[]);assert.equal(index.count('heart'),1);assert(index.matches(legacy.reference.structures[1],{parent:'heart'}));
assert.throws(()=>anatomyIndex({reference:{structures:[],hierarchy:[{id:'a',children:['b']},{id:'b',children:['a']}]}}),/Cyclic/);
// Real source children may have one indivisible existing draw owner. Search and
// hierarchy must expose that owner without creating a duplicate selectable ID.
const male=fixture('bp3d-male'),mi=anatomyIndex(male),heart=male.reference.structures.find(p=>p.id==='FMA7088');
assert(mi.owners('FMA7096').includes('FMA7088'),'Right atrium resolves to accepted Heart owner');
assert(mi.matches(heart,{query:'right atrium'}));
assert(mi.matches(male.reference.structures.find(p=>p.id==='FMA13325'),{query:'FJ2272'}));
assert(male.reference.structures.every(p=>!p.systems.includes('Unassigned source system')));
const mapping=JSON.parse(readFileSync(new URL('../reference/public/reference/anatomy-owner-map.json',import.meta.url)));
for(const [variant,recordsKey,expected] of [['bp3d-male','source_elements',1258],['hra-female','source_nodes',1073]]){
 const m=fixture(variant),index=anatomyIndex(m),ids=new Set(m.reference.structures.map(p=>p.id)),records=mapping.variants[variant][recordsKey];
 assert.equal(records.length,expected);assert.equal(new Set(records.map(r=>r.source_id)).size,expected);
 for(const r of records){assert(r.status);for(const owner of r.owner_ids)assert(ids.has(owner));if(r.status==='HOLD')assert(r.hold);}
 for(const node of m.reference.hierarchy)assert.deepEqual(index.owners(node.id),node.owner_ids);
}
assert.equal(mapping.variants['bp3d-male'].source_elements.filter(r=>r.status==='HOLD').length,2);
assert.throws(()=>anatomyIndex({reference:{structures:[],hierarchy:[{id:'source',owner_ids:['invented']}]}}),/Unknown anatomy draw owner/);
console.log('PASS source hierarchy membership, systems, search, region, immutability, legacy schema and cycle refusal');
