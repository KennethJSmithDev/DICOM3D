import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {auditR4ToR5Evidence, readLocalConversionAudit} from '../viewer/src/fhir-conversion-audit.mjs';

function fixture() {
  const subject = {reference:'Patient/synthetic'};
  const study = {resourceType:'ImagingStudy',id:'s',status:'available',subject,
    identifier:[{system:'urn:dicom:uid',value:'urn:oid:1.2.3'}],
    modality:[{system:'urn:example',code:'CT'}],
    series:[{uid:'1.2.3.4',instance:[{uid:'1.2.3.4.5',sopClass:{code:'1.2.3'}}]}]};
  const report = {resourceType:'DiagnosticReport',id:'r',status:'final',subject,imagingStudy:[{reference:'ImagingStudy/s'}]};
  const entry = resource => ({fullUrl:`https://example.invalid/fhir/${resource.resourceType}/${resource.id}`,resource});
  const source = {resourceType:'Bundle',type:'collection',entry:[entry(study),entry(report)]};
  const converted = structuredClone(source);
  converted.entry[0].resource.modality = [{coding:[{system:'urn:example',code:'CT'}]}];
  converted.entry[1].resource.study = converted.entry[1].resource.imagingStudy;
  delete converted.entry[1].resource.imagingStudy;
  return {source,converted};
}

test('compares source identities and explicit R4/R5 report-study references without mutation', () => {
  const {source,converted}=fixture(), before=JSON.stringify([source,converted]);
  const result=auditR4ToR5Evidence(source,converted);
  assert.equal(result.checkedResources,2);
  assert.equal(result.result,'SELECTED_CHECKS_PASSED');
  assert.equal(result.findings.length,0);
  assert.match(result.limitations.join(' '),/does not establish lossless/);
  assert.equal(JSON.stringify([source,converted]),before);
});

test('checks explicitly selected R4B sources without relabeling or accepting other versions', async () => {
  const {source,converted}=fixture();
  const result=auditR4ToR5Evidence(source,converted,{sourceVersion:'4.3.0'});
  assert.equal(result.sourceVersion,'4.3.0');
  assert.equal(result.schema,'DICOM3D-FHIR-R4B-R5-audit-1');
  assert.equal(result.result,'SELECTED_CHECKS_PASSED');
  delete converted.entry[1].resource.study;
  assert.match(auditR4ToR5Evidence(source,converted,{sourceVersion:'4.3.0'}).findings[0].detail,/R4B imagingStudy/);
  assert.throws(()=>auditR4ToR5Evidence(source,converted,{sourceVersion:'5.0.0'}),/R4 or R4B/);
  const local=await readLocalConversionAudit(new Blob([JSON.stringify(source)]),new Blob([JSON.stringify(converted)]),{sourceVersion:'4.3.0'});
  assert.equal(local.audit.sourceVersion,'4.3.0');
  assert.equal(local.audit.result,'REVIEW_REQUIRED');
});

const r4bSource = process.env.DICOM3D_R4B_CONVERSION_SOURCE;
const r4bConverted = process.env.DICOM3D_R4B_CONVERSION_OUTPUT;
test('flags a lost study reference in the retained R4B-to-R5 converter witness', {skip:!r4bSource && !r4bConverted}, async () => {
  assert.ok(r4bSource && r4bConverted, 'Both explicit synthetic witness paths are required');
  const source=JSON.parse(await readFile(r4bSource,'utf8'));
  const converted=JSON.parse(await readFile(r4bConverted,'utf8'));
  const result=auditR4ToR5Evidence(source,converted,{sourceVersion:'4.3.0'});
  assert.equal(result.result,'REVIEW_REQUIRED');
  assert.ok(result.findings.some(item=>item.code==='REPORT_STUDY_REFERENCE_CHANGED'));
});

test('detects the actual HL7 converter failure pattern: missing DiagnosticReport.imagingStudy', () => {
  const {source,converted}=fixture(); delete converted.entry[1].resource.study;
  const result=auditR4ToR5Evidence(source,converted);
  assert.equal(result.result,'REVIEW_REQUIRED');
  assert.deepEqual(result.findings.map(item=>item.code),['REPORT_STUDY_REFERENCE_CHANGED']);
});

test('detects changed report references, source scope, study identity and source instances', () => {
  const {source,converted}=fixture();
  converted.entry[1].resource.study[0].reference='ImagingStudy/other';
  converted.entry[0].resource.identifier[0].value='urn:oid:1.2.999';
  converted.entry[0].resource.series[0].instance[0].uid='1.2.3.4.6';
  converted.entry[0].resource.modality[0].coding[0].code='MR';
  const codes=auditR4ToR5Evidence(source,converted).findings.map(item=>item.code);
  for (const expected of ['REPORT_STUDY_REFERENCE_CHANGED','STUDY_IDENTIFIER_CHANGED','STUDY_SERIES_OR_INSTANCE_CHANGED','STUDY_MODALITY_CHANGED']) assert.ok(codes.includes(expected));
  converted.entry[0].fullUrl='https://other.invalid/fhir/ImagingStudy/s';
  assert.ok(auditR4ToR5Evidence(source,converted).findings.some(item=>item.code==='SOURCE_SCOPE_CHANGED'));
});

test('detects removed and newly introduced imaging resources', () => {
  const {source,converted}=fixture(); converted.entry.shift();
  converted.entry.push({resource:{resourceType:'ImagingStudy',id:'new'}});
  const codes=auditR4ToR5Evidence(source,converted).findings.map(item=>item.code);
  assert.ok(codes.includes('RESOURCE_MISSING'));
  assert.ok(codes.includes('UNMATCHED_CONVERTED_RESOURCE'));
});

test('detects changed report result references and does not pass an empty comparison', () => {
  const {source,converted}=fixture();
  source.entry[1].resource.result=[{reference:'Observation/finding'}];
  assert.ok(auditR4ToR5Evidence(source,converted).findings.some(item=>item.code==='REPORT_RESULT_REFERENCE_CHANGED'));
  assert.equal(auditR4ToR5Evidence({resourceType:'Bundle'},{resourceType:'Bundle'}).result,'NO_COMPARABLE_IMAGING');
});

test('rejects duplicate identities, version conflicts and unsupported modifiers', () => {
  const {source,converted}=fixture();
  converted.entry.push(structuredClone(converted.entry[0]));
  assert.throws(()=>auditR4ToR5Evidence(source,converted),/Duplicate/);
  converted.entry.pop(); source.entry[0].resource.modifierExtension=[{url:'urn:unsupported',valueBoolean:true}];
  assert.throws(()=>auditR4ToR5Evidence(source,converted),/modifier/);
});

test('local file comparison is bounded, source-preserving and cancellation-aware', async () => {
  const {source,converted}=fixture();
  const result=await readLocalConversionAudit(new Blob([JSON.stringify(source)]),new Blob([JSON.stringify(converted)]));
  assert.equal(result.audit.result,'SELECTED_CHECKS_PASSED');
  assert.match(result.provenance.source.sha256,/^[a-f0-9]{64}$/);
  await assert.rejects(readLocalConversionAudit(new Blob([new Uint8Array(1024*1024+1)]),new Blob(['{}'])),/size/);
  await assert.rejects(readLocalConversionAudit(new Blob(['{']),new Blob(['{}'])));
  const abort=new AbortController(); let finish;
  const pending=readLocalConversionAudit({size:1,arrayBuffer:()=>new Promise(resolve=>{finish=resolve;})},new Blob(['{}']),{signal:abort.signal});
  abort.abort(); finish(new Uint8Array([123]).buffer);
  await assert.rejects(pending,/CANCELLED/);
});
