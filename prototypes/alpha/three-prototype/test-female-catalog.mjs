import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildFemaleCatalog, compositeCoverageText, referenceSourceLinks, relationshipScope} from './src/female-catalog.mjs';

function fixture() {
  return {
    base: {
      structures: [
        {id:'heart', label:'Heart', bundleId:'thorax', systems:['cardiovascular system']},
        {id:'left', label:'Left example', bundleId:'limbs', systems:[]},
        {id:'right', label:'Right example', bundleId:'limbs', systems:[]},
        {id:'FMA9600', label:'Prostate', bundleId:'pelvis', systems:['genital system']},
        {id:'FMA15900', label:'Urinary bladder', bundleId:'pelvis', systems:['urinary system']},
      ],
      bundles: [{id:'thorax'}, {id:'limbs'}, {id:'pelvis'}],
      hierarchy: [
        {id:'direct', label:'Heart', ownership_scope:'DIRECT', owner_ids:['heart']},
        {id:'compound', label:'Source compound', ownership_scope:'SHARED', owner_ids:['heart','FMA9600']},
        {id:'bladder', label:'Source bladder', ownership_scope:'DIRECT', owner_ids:['FMA15900']},
        {id:'unknown', label:'Unresolved relation', ownership_scope:'SHARED', owner_ids:['missing']},
        {id:'empty', label:'Unmapped relation', ownership_scope:'SHARED', owner_ids:[]},
      ],
      held: [{id:'held-1', label:'Retained source hold', hold:'unresolved source'}],
    },
    supplement: {reference:{structures:[
      {id:'hra-bladder', label:'Urinary bladder', systems:['urinary system']},
      {id:'hra-uterus', label:'Uterus', systems:['reproductive system']},
    ]}},
    bundle: {id:'female-delta'},
  };
}
const compose = ({base,supplement,bundle}) => buildFemaleCatalog(base,supplement,bundle);
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

test('retains admitted owners and supplied classifications without inferring new systems', () => {
  const f=fixture(), index=compose(f);
  assert.deepEqual(index.structures.map(p=>p.id),['heart','left','right','hra-bladder','hra-uterus']);
  assert.deepEqual(index.structures[0].systems,['cardiovascular system']);
  assert.deepEqual(index.structures[1].systems,[]);
  assert.equal(index.structures[0].source,'BodyParts3D');
  assert.equal(index.structures[3].source,'HRA');
  assert.equal(index.structures[3].bundleId,'female-delta');
});

test('does not mutate the base, its records or the supplement', () => {
  const f=freeze(fixture()), before=JSON.stringify(f); compose(f);
  assert.equal(JSON.stringify(f),before);
});

test('preserves direct relationships with their exact source owner IDs', () => {
  const r=compose(fixture()).hierarchy.find(r=>r.id==='direct');
  assert.deepEqual(r.owner_ids,['heart']); assert.deepEqual(r.source_owner_ids,['heart']);
  assert.equal(r.availability,'represented'); assert.equal(r.ownership_scope,'DIRECT');
});

test('discloses partial compound membership instead of promoting the remainder to exact anatomy', () => {
  const r=compose(fixture()).hierarchy.find(r=>r.id==='compound');
  assert.deepEqual(r.owner_ids,['heart']); assert.deepEqual(r.source_owner_ids,['heart','FMA9600']);
  assert.deepEqual(r.excluded_owner_ids,['FMA9600']); assert.equal(r.availability,'partial');
  assert.match(relationshipScope(r),/^Partial/);
});

test('does not remap the BodyParts3D bladder to the approximately fitted HRA bladder', () => {
  const r=compose(fixture()).hierarchy.find(r=>r.id==='bladder');
  assert.deepEqual(r.owner_ids,[]); assert.deepEqual(r.source_owner_ids,['FMA15900']);
  assert.equal(r.availability,'unavailable'); assert.match(relationshipScope(r),/No selectable owner/);
});

test('distinguishes unresolved owners from intended exclusions', () => {
  const r=compose(fixture()).hierarchy.find(r=>r.id==='unknown');
  assert.deepEqual(r.excluded_owner_ids,[]); assert.deepEqual(r.unresolved_owner_ids,['missing']);
});

test('empty source owner mappings remain explicitly unmapped', () => {
  const r=compose(fixture()).hierarchy.find(r=>r.id==='empty');
  assert.equal(r.availability,'unmapped'); assert.match(relationshipScope(r),/no supplied owner/);
});

test('retains base holds and records unknown supplement coverage', () => {
  const index=compose(fixture());
  assert.equal(index.held.length,1); assert.equal(index.held[0].source,'BodyParts3D');
  assert.equal(index.coverage.supplementHoldsSupplied,false);
  assert.match(compositeCoverageText(index),/does not supply a hold inventory/);
});

test('missing inventories are not reported as verified empty inventories', () => {
  const f=fixture(); delete f.base.held; delete f.base.hierarchy;
  const index=compose(f); assert.equal(index.coverage.baseHoldsSupplied,false);
  assert.equal(index.coverage.baseHierarchySupplied,false);
  assert.match(compositeCoverageText(index),/holds were not supplied/);
  assert.match(compositeCoverageText({}),/does not establish complete coverage/);
});

test('preserves explicitly supplied supplement relationships and holds separately', () => {
  const f=fixture(); f.supplement.reference.hierarchy=[{id:'hra-rel',ownership_scope:'DIRECT',owner_ids:['hra-uterus']}];
  f.supplement.reference.held=[{id:'hra-held',hold:'source hold'}];
  const index=compose(f); assert.equal(index.hierarchy.at(-1).source,'HRA');
  assert.equal(index.held.at(-1).source,'HRA'); assert.equal(index.coverage.supplementHoldsSupplied,true);
});

test('rejects owner collisions rather than silently overwriting identity', () => {
  const f=fixture(); f.supplement.reference.structures.push({id:'heart'});
  assert.throws(()=>compose(f),/duplicate owner ID/);
});

test('rejects malformed relationship records', () => {
  const f=fixture(); f.base.hierarchy[0].owner_ids=null;
  assert.throws(()=>compose(f),/invalid relationship ownership/);
});

test('shared structures link to BodyParts3D even when the female composite is active', () => {
  assert.deepEqual(referenceSourceLinks(true,{source:'BodyParts3D'}).map(l=>l.path),['attribution/BODYParts3D-NOTICE.txt']);
});

test('HRA selections link to the HRA supplement notice', () => {
  assert.deepEqual(referenceSourceLinks(true,{source:'HRA'}).map(l=>l.path),['female-delta/HRA-FEMALE-NOTICE.txt']);
});

test('unselected and unknown composite sources expose both notices without guessing', () => {
  assert.equal(referenceSourceLinks(true).length,2);
  assert.equal(referenceSourceLinks(true,{source:'Unknown'}).length,2);
  assert.equal(referenceSourceLinks(true,{source:'constructor'}).length,2);
});

test('male source attribution and left/right identities remain unchanged', () => {
  assert.equal(referenceSourceLinks(false)[0].path,'attribution/BODYParts3D-NOTICE.txt');
  const index=compose(fixture());
  assert.equal(index.structures.find(p=>p.id==='left').label,'Left example');
  assert.equal(index.structures.find(p=>p.id==='right').label,'Right example');
});
