import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {sourceRange} from './src/use-study-presentation.js';
import {accumulation,accumulationVector} from '../viewer/src/ct-accumulation.mjs';
import {sourceKTransform,pointSourceK,allowsAccumulatedPoint} from './src/imaging/study-accumulation.mjs';
import {indexToModel} from './src/imaging/h000-volume-core.mjs';
assert.ok(process.argv[2],'Pass the approved public H000 source-binding.json fixture path');
const metadata=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const matrices=metadata.spatial.matrices,before=JSON.stringify(matrices);
const study={pixels:new Uint16Array(103*512*512),manifest:{spatial:{matrices}},binding:{semanticId:'lesion.lung.mass.001',frames:metadata.frames},ctReceipt:{volume:{shape_k_row_column:[103,512,512]}}};
const inverse=sourceKTransform(study);let maxError=0;
for(let k=0;k<103;k++){const point=new Vector3(...indexToModel(matrices,[k,255.5,255.5]));maxError=Math.max(maxError,Math.abs(pointSourceK(point,inverse)-k));assert.equal(allowsAccumulatedPoint(point,inverse,accumulation(.5,[0,102])),k<=51);assert.equal(allowsAccumulatedPoint(point,inverse,accumulation(0,[0,102])),false);assert.equal(allowsAccumulatedPoint(point,inverse,accumulation(0,[0,102],false)),true)}
assert.ok(maxError<1e-10);assert.deepEqual(sourceRange(study,'acquired'),[0,102]);const lesion=sourceRange(study,'lesion');assert.deepEqual(lesion,[64,78]);assert.deepEqual([...accumulationVector(accumulation(0,lesion))],[1,63.5,63.5,0]);assert.equal(accumulation(1,lesion).planeK,78);assert.equal(accumulation(.5,lesion).count,8);assert.equal(JSON.stringify(matrices),before);
console.log(JSON.stringify({status:'PASS',frameCenters:103,maxSourceKError:maxError,fullRange:[0,102],lesionRange:lesion,emptyRejectsPicking:true,disabledRestoresAll:true,sourceTransformsUnchanged:true,shaderAndBrowser:'pending parent witness'}));
