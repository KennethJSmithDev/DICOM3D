import {digest} from './ct-frame.mjs';
// Offline synthetic contract exercise, not an authentication or FHIR validator.
export async function inspectClinicalReferences(wire,context){
 const need=(ok,msg)=>{if(!ok)throw Error(msg);};
 need(typeof wire==='string'&&new TextEncoder().encode(wire).byteLength<=256*1024,'Connect fixture exceeds 256 KiB');
 need(context?.dataClass==='SYNTHETIC'&&context.fhirVersion==='4.0.1'&&context.readScope==='local-synthetic-test','Only explicit local synthetic R4 test scope is supported');
 const sourceHash=await digest(new TextEncoder().encode(wire));
 need(sourceHash===context.sha256,'Original clinical fixture hash mismatch');
 const b=JSON.parse(wire);need(b.resourceType==='Bundle'&&b.type==='collection'&&Array.isArray(b.entry)&&b.entry.length<=100,'Expected bounded collection Bundle');
 const map=new Map();
 for(const e of b.entry){const r=e.resource;need(r&&['ImagingStudy','DiagnosticReport','DocumentReference'].includes(r.resourceType)&&/^synthetic-[A-Za-z0-9.-]+$/.test(r.id),'Unsupported/non-synthetic resource');const key=r.resourceType+'/'+r.id;need(!map.has(key),'Duplicate resource identity');map.set(key,r);}
 const subject=context.subjectReference;
 need(typeof subject==='string'&&/^Patient\/synthetic-/.test(subject),'Synthetic subject required');
 function studyMatch(r){
  if(r?.resourceType!=='ImagingStudy'||r.subject?.reference!==subject)return false;
  const uid=(r.identifier||[]).filter(x=>x.system==='urn:dicom:uid').map(x=>x.value);
  return uid.length===1&&uid[0]==='urn:oid:'+context.studyUid&&(r.series||[]).some(s=>s.uid===context.seriesUid&&(s.instance||[]).some(i=>i.uid===context.sopUid));
 }
 const records=[];
 for(const [key,r] of map){
  const refs=r.resourceType==='DiagnosticReport'?(r.imagingStudy||[]).map(x=>x.reference):r.resourceType==='DocumentReference'?(r.context?.related||[]).map(x=>x.reference):[key];
  const matched=r.subject?.reference===subject&&refs.some(ref=>studyMatch(map.get(ref)));
  records.push({key,type:r.resourceType,sourceStatus:r.status??null,documentStatus:r.docStatus??null,versionId:r.meta?.versionId??null,
    subject:r.subject?.reference??null,authors:r.author??[],interpreters:r.resultsInterpreter??[],organization:r.custodian??null,
    amendments:r.relatesTo??[],sourceReferences:refs,studyLink:matched?'VERIFIED':'UNRESOLVED',
    qualification:'Explicit identity relationship in synthetic local fixture only; no real patient/access validation',
    findingToFrame:'UNRESOLVED',semanticStructure:'UNRESOLVED',reason:matched?'Explicit resource reference, matching subject, DICOM study/series/instance identifiers':'Missing or conflicting explicit identity/reference'});
 }
 return {schema:'DICOM3D-connect-projection-1',dataClass:'SYNTHETIC',provider:context.provider,protocol:'FHIR R4 4.0.1',sourceHash,readScope:context.readScope,records,
  limitations:['Original wire artifact is authoritative; projection does not rewrite it.','No FHIR/PACS/IRIS service called, no write API, no production authorization implied.','Study identity alone does not link a report finding to a frame, region or anatomy.']};
}
export async function syntheticClinicalFixture(){
 const studyUid='2.25.1001',seriesUid='2.25.1002',sopUid='2.25.1003',subjectReference='Patient/synthetic-person';
 const resources=[
  {resourceType:'ImagingStudy',id:'synthetic-imaging',status:'available',subject:{reference:subjectReference},identifier:[{system:'urn:dicom:uid',value:'urn:oid:'+studyUid}],series:[{uid:seriesUid,modality:{system:'http://dicom.nema.org/resources/ontology/DCM',code:'CT'},instance:[{uid:sopUid,sopClass:{system:'urn:ietf:rfc:3986',code:'urn:oid:1.2.840.10008.5.1.4.1.1.2'}}]}]},
  {resourceType:'DiagnosticReport',id:'synthetic-report',meta:{versionId:'2'},status:'amended',code:{text:'Synthetic reference-link exercise'},subject:{reference:subjectReference},imagingStudy:[{reference:'ImagingStudy/synthetic-imaging'}],resultsInterpreter:[{reference:'Practitioner/synthetic-reader'}]},
  {resourceType:'DocumentReference',id:'synthetic-note',meta:{versionId:'1'},status:'current',subject:{reference:subjectReference},type:{text:'Synthetic technologist-note fixture; role supplied by test'},author:[{reference:'Practitioner/synthetic-technologist'}],content:[{attachment:{contentType:'text/plain',title:'Synthetic note identity only; no attached clinical text'}}],context:{related:[{reference:'ImagingStudy/synthetic-imaging'}]}}
 ];
 const wire=JSON.stringify({resourceType:'Bundle',type:'collection',entry:resources.map(resource=>({resource}))});
 return {wire,context:{dataClass:'SYNTHETIC',fhirVersion:'4.0.1',readScope:'local-synthetic-test',provider:'synthetic-offline-fixture',studyUid,seriesUid,sopUid,subjectReference,sha256:await digest(new TextEncoder().encode(wire))}};
}
