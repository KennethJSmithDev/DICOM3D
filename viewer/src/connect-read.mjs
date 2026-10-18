import {digest} from './ct-frame.mjs';
export const SMART_TEST='https://r4.smarthealthit.org/';
export const OHIF_TEST='https://d14fa38qiwhyfd.cloudfront.net/dicomweb/';
export function readFailure(status){return status===401||status===403?'ACCESS_DENIED':status===404?'NOT_FOUND':'HTTP_ERROR';}
// Optional anonymous public-test reader: no arbitrary endpoint, redirect,
// credentials, pagination, attachments, patient reads or write operations.
export function boundedTestReader(base,signal,fetcher=fetch){
 if(![SMART_TEST,OHIF_TEST].includes(base))throw Error('Unqualified test provider');
 let bytes=0,calls=0;const sources=[];
 async function read(path,cap=1024*1024){
  const valid=base===SMART_TEST?/^(metadata|ImagingStudy\?_count=1|DiagnosticReport\?_count=1|Observation\/[A-Za-z0-9.-]{1,64})$/.test(path):/^studies\?limit=1$/.test(path);
  if(!valid||++calls>4)throw Error('Read scope exceeded');
  const url=base+path;let response;
  const readSignal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(20000)]);
  try{response=await fetcher(url,{method:'GET',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:readSignal,headers:{Accept:base===SMART_TEST?'application/fhir+json':'application/dicom+json'}});}catch(e){if(signal?.aborted)throw Error('CANCELLED');if(readSignal.aborted)throw Error('TIMEOUT');throw Error('TRANSPORT_OR_CORS: '+String(e));}
  if(!response.ok)throw Error(readFailure(response.status)+' HTTP '+response.status);
  if(Number(response.headers.get('Content-Length'))>cap)throw Error('Response bound exceeded');
  const reader=response.body?.getReader();if(!reader)throw Error('Readable response required');
  const chunks=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;bytes+=part.value.byteLength;if(size>cap||bytes>2*1024*1024)throw Error('Response bound exceeded');chunks.push(part.value);}}
  catch(e){await reader.cancel();throw e;}
  const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
  const wire=new TextDecoder('utf-8',{fatal:true}).decode(body),data=JSON.parse(wire);
  const source={url,status:response.status,sha256:await digest(body),bytes:size,etag:response.headers.get('ETag'),retrievedAt:new Date().toISOString(),wire};sources.push(source);
  return {data,source};
 }
 return {read,sources,cost:()=>({calls,entityBytes:bytes,retainedWireBytes:sources.reduce((n,s)=>n+s.bytes,0)})};
}
export function firstTestResource(bundle,type){
 if(bundle?.resourceType!=='Bundle'||!Array.isArray(bundle.entry)||bundle.entry.length>100)throw Error('Expected bounded search Bundle');
 const resource=bundle.entry.map(e=>e.resource).find(r=>r?.resourceType===type);
 if(!resource||!/^[-A-Za-z0-9.]{1,64}$/.test(resource.id))throw Error('No suitable '+type+' test resource');
 return resource;
}
export function projectTestEvidence(study,report,observation){
 if(study?.resourceType!=='ImagingStudy'||report?.resourceType!=='DiagnosticReport'||(observation&&observation.resourceType!=='Observation'))throw Error('Resource type mismatch');
 const studyKey='ImagingStudy/'+study.id,observationKey=observation?'Observation/'+observation.id:null;
 const sameSubject=!!report.subject?.reference&&report.subject.reference===study.subject?.reference;
 const studyLink=sameSubject&&(report.imagingStudy||[]).some(x=>x.reference===studyKey)?'VERIFIED':'UNRESOLVED';
 const resultLink=observationKey&&(report.result||[]).some(x=>x.reference===observationKey)&&!!report.subject?.reference&&report.subject.reference===observation.subject?.reference?'VERIFIED':'UNRESOLVED';
 const common=r=>({key:r.resourceType+'/'+r.id,version:r.meta?.versionId??null,status:r.status??null,subject:r.subject?.reference??null,updated:r.meta?.lastUpdated??null});
 return {dataClass:'PUBLIC_TEST',study:{...common(study),dicomIdentifiers:(study.identifier||[]).filter(x=>x.system==='urn:dicom:uid'),seriesCount:(study.series||[]).length},
  report:{...common(report),title:report.code?.text||report.code?.coding?.[0]?.display||'Source report',effective:report.effectiveDateTime??report.effectivePeriod??null,issued:report.issued??null,interpreters:report.resultsInterpreter??[],performers:report.performer??[],organization:report.custodian??null,conclusion:report.conclusion??null,sourceResultReferences:report.result??[],studyLink},
  observation:observation?{...common(observation),title:observation.code?.text||observation.code?.coding?.[0]?.display||'Source observation',value:observation.valueQuantity??observation.valueString??observation.valueCodeableConcept??null,effective:observation.effectiveDateTime??null,reportLink:resultLink}:null,
  links:{reportToObservation:resultLink,reportToImagingStudy:studyLink,findingToFrame:'UNRESOLVED',semanticStructure:'UNRESOLVED'},
  explanation:'A verified edge means an explicit resource reference with matching subject identity. It does not establish a clinical interpretation, source-frame region, or anatomical registration. Reference anatomy and local H000 remain independent.'};
}
export async function retrievePublicTestEvidence(reader){
 const capability=await reader.read('metadata');
 if(capability.data.resourceType!=='CapabilityStatement'||!/^4\.0\./.test(capability.data.fhirVersion))throw Error('Expected FHIR R4 capability');
 const study=firstTestResource((await reader.read('ImagingStudy?_count=1',256*1024)).data,'ImagingStudy');
 const report=firstTestResource((await reader.read('DiagnosticReport?_count=1',256*1024)).data,'DiagnosticReport');
 const ref=(report.result||[]).find(x=>/^Observation\/[A-Za-z0-9.-]{1,64}$/.test(x.reference))?.reference;
 const observation=ref?(await reader.read(ref,256*1024)).data:null;
 if(observation&&'Observation/'+observation.id!==ref)throw Error('Resolved source identity mismatch');
 return {protocol:'FHIR '+capability.data.fhirVersion,software:capability.data.software??null,projection:projectTestEvidence(study,report,observation),sources:reader.sources,cost:reader.cost()};
}
