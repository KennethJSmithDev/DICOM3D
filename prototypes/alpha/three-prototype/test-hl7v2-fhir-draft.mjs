import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {draftOrganizationFromHeader, draftAdtFixture, readLocalHl7Draft} from '../viewer/src/hl7v2-fhir-draft.mjs';

// Synthetic header values from the retained ISAIAH 032 fixture; no patient data.
const control = 'isaiah017-032-r4b-final-normal';
const header = `MSH|^~\\&|ISAIAHDEVX|ISAIAH-FHIR-032|FHIR|ISAIAH-RECV-B|202611111200||ADT^A01|${control}|P|2.5\rEVN|A01|202611111200\r`;
const system = 'urn:isaiah:synthetic:facility';
const patientSystem = 'urn:dicom3d:synthetic:patient';
// DICOM3D-authored synthetic PID appended to the retained ISAIAH header.
const pid = 'PID|1||SYN-001||EXAMPLE^ALICE||20000229|F\r';

for (const targetVersion of ['4.0.1', '4.3.0', '5.0.0']) {
  test(`synthetic ISAIAH header produces a source-bound ${targetVersion} Organization draft`, async () => {
    const bytes = new TextEncoder().encode(header);
    const actual = await readLocalHl7Draft(new Blob([bytes]), {targetVersion, facilitySystem:system});
    assert.equal(actual.status, 'REVIEW_REQUIRED');
    assert.equal(actual.targetFhirVersion, targetVersion);
    assert.deepEqual(actual.resource, {resourceType:'Organization',name:'ISAIAH-FHIR-032',identifier:[{system,value:'ISAIAH-FHIR-032'}]});
    assert.equal(actual.source.controlId, control);
    assert.equal(actual.source.bytes, bytes.byteLength);
    assert.equal(actual.source.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal('id' in actual.resource, false);
    assert.equal('patient' in actual.resource, false);
  });
}

for (const targetVersion of ['4.0.1', '4.3.0', '5.0.0']) {
  test(`synthetic PID extends the ISAIAH header into review-only ${targetVersion} drafts`, async () => {
    const source=header+pid;
    const result=await readLocalHl7Draft(new Blob([source]),{targetVersion,facilitySystem:system,patientSystem});
    assert.equal(result.status,'REVIEW_REQUIRED');
    assert.equal(result.targetFhirVersion,targetVersion);
    assert.deepEqual(result.resources,[result.resource,{resourceType:'Patient',identifier:[{system:patientSystem,value:'SYN-001'}],name:[{family:'EXAMPLE',given:['ALICE']}],birthDate:'2000-02-29',gender:'female'}]);
    assert.deepEqual(result.source.mappedSegments,['MSH','EVN','PID']);
    assert.equal(result.source.administrativeSex,'F');
    assert.equal(result.source.sha256,createHash('sha256').update(source).digest('hex'));
    assert.equal('id' in result.resources[1],false);
  });
}

test('PID mapping requires explicit authority and refuses unrepresented content', () => {
  assert.throws(()=>draftAdtFixture(header+pid,{targetVersion:'4.0.1'}),/identifier system/);
  for(const changed of [
    pid.replace('SYN-001','SYN-001^^^issuer'),pid.replace('SYN-001','SYN-001~SYN-002'),pid.replace('SYN-001','""'),
    pid.replace('EXAMPLE^ALICE','EXAMPLE^ALICE^MIDDLE'),pid.replace('|1||','|2||'),
    pid.replace('|20000229|','|20000230|'),pid.replace('|20000229|','|200002|'),
    pid.replace('|F\r','|A\r'),pid.replace('|F\r','|O\r'),pid.replace('|F\r','|F|unmapped\r'),
    pid+'PV1|1\r',pid.replace('EXAMPLE','EXAM\\F\\PLE')
  ]) assert.throws(()=>draftAdtFixture(header+changed,{targetVersion:'4.3.0',patientSystem}));
});

test('PID optional fields are omitted instead of invented', () => {
  const result=draftAdtFixture(header+pid.replace('20000229|F','|'),{targetVersion:'5.0.0',patientSystem});
  assert.equal('birthDate' in result.resources[1],false);
  assert.equal('gender' in result.resources[1],false);
  assert.equal(result.source.administrativeSex,null);
});

test('a facility identifier is not invented when a system is absent', () => {
  const result = draftOrganizationFromHeader(header, {targetVersion:'4.3.0'});
  assert.deepEqual(result.resource, {resourceType:'Organization',name:'ISAIAH-FHIR-032'});
});

test('accepts CRLF transfer representation while retaining the original-byte digest', async () => {
  const wire = header.replaceAll('\r','\r\n');
  const result = await readLocalHl7Draft(new Blob([wire]), {targetVersion:'4.0.1'});
  assert.equal(result.source.sha256, createHash('sha256').update(wire).digest('hex'));
  assert.notEqual(result.source.sha256, createHash('sha256').update(header).digest('hex'));
});

test('refuses extra patient segments and unsupported message profiles', () => {
  for (const text of [header + 'PID|1||synthetic\r', header.replace('ADT^A01','ORU^R01'),
    header.replace('EVN|A01','EVN|A02'), header.replace('|2.5\r','|2.5.1\r'),
    header.replace('MSH|^~\\&','MSH|^~\\!')]) {
    assert.throws(() => draftOrganizationFromHeader(text,{targetVersion:'4.0.1'}));
  }
});

test('refuses missing or ambiguous source identity rather than guessing', () => {
  for (const text of [header.replace('ISAIAH-FHIR-032',''),header.replace(control,''),header.replace('ISAIAH-FHIR-032','""'),header.replace(control,'""'),
    header.replace('ISAIAH-FHIR-032','A^B'),header.replace(control,'a~b'),`\u000b${header}`]) {
    assert.throws(() => draftOrganizationFromHeader(text,{targetVersion:'5.0.0'}));
  }
});

test('refuses invalid version and facility identifier systems', () => {
  assert.throws(() => draftOrganizationFromHeader(header,{targetVersion:'4.2.0'}),/target version/);
  for (const facilitySystem of ['not-a-uri','ftp://example.org/system','https://u:p@example.org/system',0]) {
    assert.throws(() => draftOrganizationFromHeader(header,{targetVersion:'5.0.0',facilitySystem}),/identifier system/);
  }
});

test('rejects oversized, changed-length, and non-ASCII local input', async () => {
  await assert.rejects(readLocalHl7Draft(new Blob([new Uint8Array(64*1024+1)]), {targetVersion:'4.0.1'}),/size/);
  await assert.rejects(readLocalHl7Draft({size:20,arrayBuffer:async()=>new ArrayBuffer(19)}, {targetVersion:'4.0.1'}),/size changed/);
  await assert.rejects(readLocalHl7Draft(new Blob([header+'é']), {targetVersion:'4.0.1'}),/ASCII/);
});

test('a cancelled late file read cannot publish a draft', async () => {
  const data = new TextEncoder().encode(header), abort = new AbortController(); let finish;
  const pending = readLocalHl7Draft({size:data.length,arrayBuffer:()=>new Promise(resolve=>{finish=resolve;})}, {targetVersion:'4.3.0',signal:abort.signal});
  abort.abort(); finish(data.buffer);
  await assert.rejects(pending,/CANCELLED/);
});
