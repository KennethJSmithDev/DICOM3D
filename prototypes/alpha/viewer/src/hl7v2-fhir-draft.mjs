import {digest} from './ct-frame.mjs';

const MAX_MESSAGE_BYTES = 64 * 1024;
const targets = new Set(['4.0.1', '4.3.0', '5.0.0']);
const need = (ok, message) => { if (!ok) throw new Error(message); };

function identifierSystem(value) {
  if (value === undefined || value === null || value === '') return null;
  need(typeof value === 'string' && value.length <= 512 && !/\s/.test(value), 'Invalid identifier system');
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Invalid identifier system'); }
  need(['urn:', 'https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password, 'Invalid identifier system');
  return value;
}

// A deliberately narrow local fixture profile, not a general HL7 parser.
// It never turns the source message control ID into an inferred FHIR ID.
export function draftOrganizationFromHeader(text, {targetVersion, facilitySystem} = {}) {
  need(targets.has(targetVersion), 'Unsupported FHIR target version');
  need(typeof text === 'string' && text.length > 0 && text.length <= MAX_MESSAGE_BYTES, 'Unsupported HL7 message size');
  need(/^[\x20-\x7e\r\n]+$/.test(text), 'Only plain ASCII fixture messages are supported');
  const segments = text.split(/\r\n|\r|\n/);
  while (segments.at(-1) === '') segments.pop();
  need(segments.length === 2 && segments[0].startsWith('MSH|') && segments[1].startsWith('EVN|'), 'Expected a header-only MSH/EVN fixture');
  const msh = segments[0].split('|'), evn = segments[1].split('|');
  need(msh.length >= 12 && msh[1] === '^~\\&' && msh[8] === 'ADT^A01' && msh[11] === '2.5' && evn[1] === 'A01', 'Unsupported HL7 fixture profile');
  const facility = msh[3], controlId = msh[9];
  need(typeof facility === 'string' && facility.length > 0 && facility !== '""' && facility.length <= 128 && !/[\^~\\&]/.test(facility), 'Unsupported or missing sending facility');
  need(typeof controlId === 'string' && controlId.length > 0 && controlId !== '""' && controlId.length <= 128 && !/[\^~\\&]/.test(controlId), 'Unsupported or missing message control ID');
  const system = identifierSystem(facilitySystem);
  const resource = {resourceType:'Organization', name:facility};
  if (system) resource.identifier = [{system, value:facility}];
  return {targetFhirVersion:targetVersion, status:'REVIEW_REQUIRED', source:{hl7Version:'2.5', messageType:'ADT^A01', controlId}, resource};
}

function fullBirthDate(value) {
  need(/^\d{8}$/.test(value), 'Only complete PID birth dates are supported');
  const year=Number(value.slice(0,4)), month=Number(value.slice(4,6)), day=Number(value.slice(6,8));
  const leap=year%4===0 && (year%100!==0 || year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  need(year>0 && month>=1 && month<=12 && day>=1 && day<=days[month-1], 'Invalid PID birth date');
  return `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
}

// This is a bounded synthetic ADT profile, not a general HL7 parser. Unknown
// PID fields are refused instead of silently discarding patient information.
export function draftAdtFixture(text, {targetVersion, facilitySystem, patientSystem} = {}) {
  need(typeof text==='string' && text.length>0 && text.length<=MAX_MESSAGE_BYTES, 'Unsupported HL7 message size');
  need(/^[\x20-\x7e\r\n]+$/.test(text), 'Only plain ASCII fixture messages are supported');
  const segments=text.split(/\r\n|\r|\n/);
  while(segments.at(-1)==='')segments.pop();
  if(segments.length===2)return draftOrganizationFromHeader(text,{targetVersion,facilitySystem});
  need(segments.length===3 && segments[2].startsWith('PID|'), 'Expected MSH/EVN and one supported PID');
  const header=draftOrganizationFromHeader(segments.slice(0,2).join('\r')+'\r',{targetVersion,facilitySystem});
  const pid=segments[2].split('|');
  need(pid[1]==='1' && !pid[2] && !pid[4] && !pid[6] && pid.slice(9).every(value=>!value), 'Unsupported PID fields');
  const plain=(value,max)=>typeof value==='string' && value.length>0 && value!=='""' && value.length<=max && value.trim()===value && !/[|^~\\&]/.test(value);
  need(plain(pid[3],128), 'Unsupported or missing PID identifier');
  const system=identifierSystem(patientSystem);
  need(system, 'Explicit patient identifier system is required');
  const names=(pid[5]??'').split('^');
  need(names.length>=2 && plain(names[0],128) && plain(names[1],128) && names.slice(2).every(value=>!value), 'Unsupported or missing PID name');
  const patient={resourceType:'Patient',identifier:[{system,value:pid[3]}],name:[{family:names[0],given:[names[1]]}]};
  if(pid[7])patient.birthDate=fullBirthDate(pid[7]);
  const administrativeSex=pid[8]??'';
  if(administrativeSex){
    const mapping={M:'male',F:'female',U:'unknown'};
    need(Object.hasOwn(mapping,administrativeSex),'Unsupported PID administrative sex');
    patient.gender=mapping[administrativeSex];
  }
  return {...header,source:{...header.source,mappedSegments:['MSH','EVN','PID'],administrativeSex:administrativeSex||null},
    resources:[header.resource,patient]};
}

// Input is read once and stays on-device. A failed or cancelled read never
// produces a draft; source bytes are fingerprinted without being rewritten.
export async function readLocalHl7Draft(file, {targetVersion, facilitySystem, patientSystem, signal} = {}) {
  const check = () => { if (signal?.aborted) throw new Error('CANCELLED'); };
  check();
  need(file && Number.isSafeInteger(file.size) && file.size > 0 && file.size <= MAX_MESSAGE_BYTES && typeof file.arrayBuffer === 'function', 'Unsupported local HL7 message size');
  const bytes = new Uint8Array(await file.arrayBuffer());
  check(); need(bytes.byteLength === file.size, 'Local HL7 message size changed');
  const text = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
  const draft = draftAdtFixture(text, {targetVersion, facilitySystem, patientSystem});
  const sha256 = await digest(bytes);
  check();
  return {...draft, source:{...draft.source, bytes:bytes.byteLength, sha256}};
}
