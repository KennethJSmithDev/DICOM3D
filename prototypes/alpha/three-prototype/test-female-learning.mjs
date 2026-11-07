import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildFemaleCatalog,sourceAttributionManifest} from './src/female-catalog.mjs';
import {buildLearnContext} from './src/learn-context.mjs';
const base={structures:[{id:'heart',label:'Heart',bundleId:'thorax'},{id:'FMA9600',label:'Prostate',bundleId:'pelvis'}],bundles:[{id:'thorax'},{id:'pelvis'}],hierarchy:[{id:'source-compound',label:'Source compound',ownership_scope:'INDIRECT',owner_ids:['heart','FMA9600']}],held:[{id:'base-hold',hold:'Source unresolved'}]};
const supplement={reference:{id:'HRA supplement',structures:[{id:'uterus',label:'Uterus',systems:['reproductive system']}]},provenance:{copyright:'HRA fixture author',license:'fixture HRA terms'}};
const index=buildFemaleCatalog(base,supplement,{id:'female-delta'});
const sourceManifests=new Map([
 ['thorax',sourceAttributionManifest({reference:{id:'BodyParts3D base'},provenance:{copyright:'Base fixture author',license:'fixture BP terms'}})],
 ['female-delta',sourceAttributionManifest(supplement)],
]);
const context=selected=>buildLearnContext({femaleActive:true,femaleSelected:selected,femaleData:{index,sourceManifests,manifest:{reference:{id:'Composite'}}}});

test('Learn follows the selected base structure source rather than the active female mode',()=>{
 const c=context('heart');assert.equal(c.links[0].path,'attribution/BODYParts3D-NOTICE.txt');
 assert.equal(c.sourceRows.find(r=>r.label==='Source attribution').value,'Base fixture author');
 assert.equal(c.sourceRows.find(r=>r.label==='Source terms').value,'fixture BP terms');
});
test('Learn follows the supplement attribution when an HRA structure is selected',()=>{
 const c=context('uterus');assert.equal(c.links[0].path,'female-delta/HRA-FEMALE-NOTICE.txt');
 assert.equal(c.sourceRows.find(r=>r.label==='Source attribution').value,'HRA fixture author');
});
test('Learn labels partial relationships and unavailable inventories explicitly',()=>{
 const c=context('heart');assert.match(c.relationships[0].scope,/Partial/);
 assert.ok(c.cards.some(card=>card.body.includes('does not supply a hold inventory')));
});
test('attribution retains only the required small payload',()=>{
 const input={reference:{id:'source',structures:[{id:'large-array'}]},structure:{semantic_id:'owner'},provenance:{copyright:'author',license:'terms',source_url:'https://example.org',huge:'unused'},geometry:new Array(1000)};
 const m=sourceAttributionManifest(input);
 assert.deepEqual(m,{reference:{id:'source'},structure:{semantic_id:'owner'},provenance:{copyright:'author',license:'terms',source_url:'https://example.org'}});
 assert.equal(m.reference.structures,undefined);assert.equal(m.geometry,undefined);
});
