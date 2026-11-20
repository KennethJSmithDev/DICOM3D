import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {MAX_PROJECTED_REFERENCES, projectFhirEvidence, readLocalFhirEvidence, reportStudyReferences} from '../viewer/src/fhir-evidence-projection.mjs';
import {projectTestEvidence} from '../viewer/src/connect-read.mjs';

function fixture(version) {
  const legacy = version !== '5.0.0';
  const subject = {reference:'Patient/synthetic-person'};
  const study = {resourceType:'ImagingStudy', id:'synthetic-study', status:'available', subject,
    modality:legacy ? [{system:'http://dicom.nema.org/resources/ontology/DCM',code:'CT'}] : [{coding:[{system:'http://dicom.nema.org/resources/ontology/DCM',code:'CT'}]}]};
  const report = {resourceType:'DiagnosticReport', id:'synthetic-report', status:'final', subject,
    result:[{reference:'Observation/synthetic-observation'}],
    ...(legacy ? {imagingStudy:[{reference:'ImagingStudy/synthetic-study'}]} : {study:[{reference:'ImagingStudy/synthetic-study'}]})};
  const observation = {resourceType:'Observation', id:'synthetic-observation', status:'final', subject};
  const patient = {resourceType:'Patient', id:'synthetic-person'};
  const resources = [patient, study, report, observation];
  if (version === '5.0.0') resources.push({resourceType:'ImagingSelection', id:'synthetic-selection', status:'available', subject,
    derivedFrom:[{reference:'ImagingStudy/synthetic-study'}], instance:[{uid:'2.25.1003',subset:['1']}]});
  return {resourceType:'Bundle', type:'collection', entry:resources.map(resource => ({fullUrl:`https://fhir.synthetic.invalid/fhir/${resource.resourceType}/${resource.id}`,resource}))};
}

test('bounds the total references across resources for each FHIR release', async () => {
  for (const version of ['4.0.1', '4.3.0', '5.0.0']) {
    const refs = Array(1024).fill(null);
    const entry = Array.from({length: 4}, (_, i) => ({resource:{resourceType:'DiagnosticReport', id:`report-${i}`, result:refs}}));
    const bundle = {resourceType:'Bundle', type:'collection', entry};
    assert.equal(projectFhirEvidence(bundle, {fhirVersion:version}).links.length, MAX_PROJECTED_REFERENCES);
    bundle.entry.push({resource:{resourceType:'DiagnosticReport', id:'overflow', result:[null]}});
    assert.throws(() => projectFhirEvidence(bundle, {fhirVersion:version}), /aggregate FHIR reference count/);
    const local = new File([JSON.stringify(bundle)], 'synthetic.json', {type:'application/json'});
    await assert.rejects(readLocalFhirEvidence(local, {fhirVersion:version}), /aggregate FHIR reference count/);
  }
});

test('R4, R4B and R5 project their explicit report-study fields and modality codes', () => {
  for (const [version, field] of [['4.0.1','DiagnosticReport.imagingStudy'], ['4.3.0','DiagnosticReport.imagingStudy'], ['5.0.0','DiagnosticReport.study']]) {
    const bundle = fixture(version), before = JSON.stringify(bundle);
    const result = projectFhirEvidence(bundle, {fhirVersion:version});
    assert.equal(JSON.stringify(bundle), before);
    const study = result.resources.find(item => item.type === 'ImagingStudy');
    assert.deepEqual(study.modality, [{system:'http://dicom.nema.org/resources/ontology/DCM',code:'CT'}]);
    assert.deepEqual(result.links.find(item => item.field === field), {source:'DiagnosticReport/synthetic-report',field,target:'ImagingStudy/synthetic-study',status:'SAME_SUBJECT_REFERENCE'});
    assert.equal(result.links.find(item => item.field === 'DiagnosticReport.result').status, 'SAME_SUBJECT_REFERENCE');
    assert.equal(result.ignored.Patient, 1);
  }
});

test('series modality must use the selected release representation when supplied', () => {
  for (const version of ['4.0.1','4.3.0','5.0.0']) {
    const bundle=fixture(version),study=bundle.entry.find(item=>item.resource.resourceType==='ImagingStudy').resource;
    const coding={system:'http://dicom.nema.org/resources/ontology/DCM',code:'CT'};
    study.series=[{uid:'1.2.3',modality:version==='5.0.0'?{coding:[coding]}:coding}];
    assert.doesNotThrow(()=>projectFhirEvidence(bundle,{fhirVersion:version}));
    study.series[0].modality=version==='5.0.0'?coding:{coding:[coding]};
    assert.throws(()=>projectFhirEvidence(bundle,{fhirVersion:version}),/Modality shape/);
    study.series=null;
    assert.throws(()=>projectFhirEvidence(bundle,{fhirVersion:version}),/series list/);
  }
});

test('R5 selection retains its source instance and subset without treating it as a CT frame', () => {
  const result = projectFhirEvidence(fixture('5.0.0'), {fhirVersion:'5.0.0'});
  const selection = result.resources.find(item => item.type === 'ImagingSelection');
  assert.deepEqual(selection.selection, {instanceCount:1, subsets:[{instanceUid:'2.25.1003',sopClass:null,values:['1']}]});
  assert.equal(result.links.find(item => item.field === 'ImagingSelection.derivedFrom').status, 'SAME_SUBJECT_REFERENCE');
  assert.equal('frame' in selection.selection.subsets[0], false);
});

test('does not infer a study relationship from a shared subject or the wrong version field', () => {
  for (const version of ['4.0.1','4.3.0','5.0.0']) {
    const bundle = fixture(version), report = bundle.entry.find(item => item.resource.resourceType === 'DiagnosticReport').resource;
    delete report.imagingStudy; delete report.study;
    if (version !== '5.0.0') report.study = [{reference:'ImagingStudy/synthetic-study'}];
    else report.imagingStudy = [{reference:'ImagingStudy/synthetic-study'}];
    const result = projectFhirEvidence(bundle, {fhirVersion:version});
    assert.equal(result.links.some(item => /imagingStudy|\.study/.test(item.field)), false);
    assert.match(result.warnings[0], /was not used/);
  }
});

test('marks missing, different and absent subject references without inventing links', () => {
  const bundle = fixture('4.0.1'), report = bundle.entry.find(item => item.resource.resourceType === 'DiagnosticReport').resource;
  report.imagingStudy.push({reference:'ImagingStudy/not-in-bundle'});
  bundle.entry.find(item => item.resource.resourceType === 'ImagingStudy').resource.subject = {reference:'Patient/other'};
  let links = projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}).links;
  assert.equal(links[0].status, 'SUBJECT_REFERENCE_MISMATCH');
  assert.equal(links[1].status, 'TARGET_NOT_IN_BUNDLE');
  delete report.subject;
  links = projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}).links;
  assert.equal(links[0].status, 'SUBJECT_NOT_PROVIDED');
  report.imagingStudy.push({identifier:{value:'unresolved-identifier'}});
  links = projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}).links;
  assert.equal(links[2].status, 'REFERENCE_NOT_PROVIDED');
});

test('resolves only exact Bundle fullUrl aliases, never a foreign URL with a matching suffix', () => {
  const bundle = fixture('4.0.1'), study = bundle.entry.find(item => item.resource.resourceType === 'ImagingStudy');
  const reportEntry = bundle.entry.find(item => item.resource.resourceType === 'DiagnosticReport'), report = reportEntry.resource;
  study.fullUrl = 'https://example.invalid/fhir/ImagingStudy/synthetic-study';
  reportEntry.fullUrl = 'https://example.invalid/fhir/DiagnosticReport/synthetic-report';
  report.imagingStudy = [{reference:study.fullUrl}, {reference:'https://other.invalid/fhir/ImagingStudy/synthetic-study'}];
  const links = projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}).links;
  assert.equal(links[0].status, 'SAME_SUBJECT_REFERENCE');
  assert.equal(links[1].status, 'TARGET_NOT_IN_BUNDLE');
});

test('scopes relative references to their source server and does not equate same IDs on different servers', () => {
  const bundle = fixture('4.0.1'), study = bundle.entry.find(item => item.resource.resourceType === 'ImagingStudy');
  const report = bundle.entry.find(item => item.resource.resourceType === 'DiagnosticReport');
  study.fullUrl = 'https://a.example/fhir/ImagingStudy/synthetic-study';
  report.fullUrl = 'https://b.example/fhir/DiagnosticReport/synthetic-report';
  let links = projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}).links;
  assert.equal(links[0].status, 'TARGET_NOT_IN_BUNDLE');
  report.resource.imagingStudy = [{reference:study.fullUrl}];
  links = projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}).links;
  assert.equal(links[0].status, 'SUBJECT_REFERENCE_MISMATCH');
  report.fullUrl = 'https://a.example/fhir/DiagnosticReport/synthetic-report';
  report.resource.imagingStudy = [{reference:'ImagingStudy/synthetic-study'}];
  links = projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}).links;
  assert.equal(links[0].status, 'SAME_SUBJECT_REFERENCE');
});

test('does not equate relative contained or opaque-context subjects by spelling alone', () => {
  const bundle = fixture('4.0.1'), study = bundle.entry.find(item => item.resource.resourceType === 'ImagingStudy');
  const report = bundle.entry.find(item => item.resource.resourceType === 'DiagnosticReport');
  study.resource.subject = {reference:'#local'}; report.resource.subject = {reference:'#local'};
  assert.equal(projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}).links[0].status, 'SUBJECT_SCOPE_UNRESOLVED');
  study.fullUrl = 'urn:uuid:study'; report.fullUrl = 'urn:uuid:report';
  report.resource.imagingStudy = [{reference:study.fullUrl}];
  study.resource.subject = {reference:'Patient/synthetic-person'}; report.resource.subject = {reference:'Patient/synthetic-person'};
  assert.equal(projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}).links[0].status, 'SUBJECT_SCOPE_UNRESOLVED');
});

test('marks matching local keys as unscoped when a Bundle has no server base', () => {
  const bundle = fixture('4.0.1');
  for (const entry of bundle.entry) delete entry.fullUrl;
  const result = projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}), link = result.links[0];
  assert.equal(link.target, 'ImagingStudy/synthetic-study');
  assert.equal(link.status, 'UNSCOPED_LOCAL_KEY');
  assert.equal(link.subjectStatus, 'SAME_UNSCOPED_SUBJECT_REFERENCE');
  assert.match(result.warnings.join(' '), /no server base/);
});

test('rejects version-conflicting resource or modality shapes, duplicate identities and unknown modifiers', () => {
  const r5 = fixture('5.0.0');
  assert.throws(() => projectFhirEvidence(r5, {fhirVersion:'4.0.1'}), /Modality shape|ImagingSelection/);
  const bad = fixture('4.0.1'); bad.entry[1].resource.modality = [{coding:[{code:'CT'}]}];
  assert.throws(() => projectFhirEvidence(bad, {fhirVersion:'4.0.1'}), /Modality shape/);
  const duplicate = fixture('4.0.1'); duplicate.entry.push(structuredClone(duplicate.entry[1]));
  assert.throws(() => projectFhirEvidence(duplicate, {fhirVersion:'4.0.1'}), /Duplicate resource identity/);
  const modifier = fixture('4.0.1'); modifier.entry[1].resource.modifierExtension = [{url:'urn:unsupported',valueBoolean:true}];
  assert.throws(() => projectFhirEvidence(modifier, {fhirVersion:'4.0.1'}), /modifier/);
  const nestedModifier = fixture('5.0.0'); nestedModifier.entry.at(-1).resource.instance[0].modifierExtension = [{url:'urn:unsupported',valueBoolean:true}];
  assert.throws(() => projectFhirEvidence(nestedModifier, {fhirVersion:'5.0.0'}), /modifier/);
  const noId = fixture('4.0.1'); delete noId.entry[1].resource.id;
  assert.throws(() => projectFhirEvidence(noId, {fhirVersion:'4.0.1'}), /identity/);
  assert.throws(() => projectFhirEvidence(fixture('4.0.1'), {fhirVersion:'4.2.0'}), /R4, R4B or R5/);
  const r4bSelection = fixture('4.3.0');
  r4bSelection.entry.push({resource:{resourceType:'ImagingSelection',id:'not-in-r4b'}});
  assert.throws(() => projectFhirEvidence(r4bSelection, {fhirVersion:'4.3.0'}), /not an R4 or R4B resource/);
});

test('recognizes partial search pages and refuses excess entries', () => {
  const bundle = fixture('4.0.1'); bundle.link = [{relation:'next',url:'https://example.invalid/page2'}];
  assert.match(projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}).warnings[0], /not fetched/);
  assert.throws(() => projectFhirEvidence({resourceType:'Bundle',entry:Array(513).fill({})}, {fhirVersion:'4.0.1'}), /entry list/);
  bundle.entry.push({resource:{resourceType:'OperationOutcome'}});
  assert.match(projectFhirEvidence(bundle, {fhirVersion:'4.0.1'}).warnings.join(' '), /other resources lack a supported identity/);
});

test('reads a bounded local Bundle without changing or outputting the original payload', async () => {
  const bundle = fixture('4.0.1'); bundle.entry[0].resource.name = [{text:'PRIVATE-EXAMPLE-OMIT'}];
  const wire = JSON.stringify(bundle), result = await readLocalFhirEvidence(new Blob([wire]), {fhirVersion:'4.0.1'});
  assert.equal(result.provenance.bytes, new TextEncoder().encode(wire).length);
  assert.match(result.provenance.sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result).includes('PRIVATE-EXAMPLE-OMIT'), false);
  assert.equal('wire' in result, false);
  await assert.rejects(readLocalFhirEvidence(new Blob([new Uint8Array(1024*1024+1)]), {fhirVersion:'4.0.1'}), /size/);
  await assert.rejects(readLocalFhirEvidence(new Blob(['{']), {fhirVersion:'4.0.1'}));
});

test('a cancelled late local read cannot publish a projection', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(fixture('4.0.1'))), abort = new AbortController();
  let complete;
  const pending = readLocalFhirEvidence({size:bytes.length,arrayBuffer:() => new Promise(resolve => {complete=resolve;})}, {fhirVersion:'4.0.1',signal:abort.signal});
  abort.abort(); complete(bytes.buffer);
  await assert.rejects(pending, /CANCELLED/);
});

test('version-specific field helper does not reinterpret the other release', () => {
  const report = {imagingStudy:[{reference:'ImagingStudy/r4'}],study:[{reference:'ImagingStudy/r5'}]};
  assert.equal(reportStudyReferences(report, '4.0.1')[0].reference, 'ImagingStudy/r4');
  assert.equal(reportStudyReferences(report, '4.3.0')[0].reference, 'ImagingStudy/r4');
  assert.equal(reportStudyReferences(report, '5.0.0')[0].reference, 'ImagingStudy/r5');
});

test('existing public R4 projection keeps its prior explicit-reference behavior', () => {
  const bundle = fixture('4.0.1'), get = type => bundle.entry.find(item => item.resource.resourceType === type).resource;
  const study = get('ImagingStudy'), report = get('DiagnosticReport'), observation = get('Observation');
  const result = projectTestEvidence(study, report, observation);
  assert.equal(result.links.reportToImagingStudy, 'VERIFIED');
  assert.equal(result.links.reportToObservation, 'VERIFIED');
  const wrongField = {...report, imagingStudy:undefined, study:[{reference:'ImagingStudy/synthetic-study'}]};
  assert.equal(projectTestEvidence(study, wrongField, observation).links.reportToImagingStudy, 'UNRESOLVED');
  assert.equal(projectTestEvidence(study, {...report, imagingStudy:null}, observation).links.reportToImagingStudy, 'UNRESOLVED');
  assert.equal(projectTestEvidence(study, {...report, subject:{reference:'Patient/other'}}, observation).links.reportToImagingStudy, 'UNRESOLVED');
});

test('projects the retained public H000 R5 graph without inventing an R4 selection', {skip:!process.env.DICOM3D_PUBLIC_H000_R5_PACKAGE}, async () => {
  const packageData = JSON.parse(await readFile(process.env.DICOM3D_PUBLIC_H000_R5_PACKAGE, 'utf8'));
  const result = projectFhirEvidence(packageData.bundle, {fhirVersion:'5.0.0'});
  assert.equal(result.entryCount, 9);
  assert.equal(result.resources.filter(item => item.type === 'ImagingSelection').length, 2);
  assert.equal(result.links.filter(item => item.field === 'ImagingSelection.derivedFrom' && item.status === 'UNSCOPED_LOCAL_KEY').length, 2);
  const segment = result.resources.find(item => item.key === 'ImagingSelection/r5p-h000-segment-1');
  assert.deepEqual(segment.selection.subsets[0].values, ['1']);
  assert.throws(() => projectFhirEvidence(packageData.bundle, {fhirVersion:'4.0.1'}));
});
