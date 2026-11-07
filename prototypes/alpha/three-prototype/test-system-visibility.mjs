import assert from 'node:assert/strict';
import {Group,Object3D} from 'three';
import {ownersForSystems} from './src/system-visibility.js';
import {createAtlasPresentation,defaultHiddenOwners} from './src/atlas-presentation.js';
const structures=[{id:'shared',systems:['a','b']},{id:'onlyA',systems:['a']},{id:'other',systems:[]},{id:'FMA7163',systems:['b']}];
const both=ownersForSystems(structures,['a','b']), b=ownersForSystems(structures,['b']);
assert.deepEqual([...both],['shared','onlyA','FMA7163']);assert.deepEqual([...b],['shared','FMA7163']);
const scene=new Group();for(const item of structures){const n=new Object3D();n.userData.semanticId=item.id;scene.add(n)}
const p=createAtlasPresentation(),bundles=new Map([['one',{scene}]]),hidden=defaultHiddenOwners();
p.apply(bundles,{hiddenIds:hidden,allowedIds:b});assert.deepEqual(scene.children.map(n=>n.visible),[true,false,false,false]);
p.apply(bundles,{hiddenIds:hidden,allowedIds:both,isolatedId:'onlyA'});assert.deepEqual(scene.children.map(n=>n.visible),[false,true,false,false]);
p.apply(bundles,{hiddenIds:hidden,isolatedId:'shared'});assert.deepEqual(scene.children.map(n=>n.visible),[true,false,false,false]);p.restoreAll();
console.log('PASS source membership union, overlap, hidden skin, isolation and restoration');
