import {isVerifiedVolume} from './verified-volume.mjs';
import {parsePublicMetadata,PUBLIC_RESEARCH_ASSETS} from './public-source-binding.mjs';
import {freezeMetadata} from './imaging-contract.mjs';
import {digest} from './ct-frame.mjs';

export const R5_EVIDENCE_VERSION='DICOM3D-R5-evidence-1';
const ref=reference=>({reference});
const code=(system,code,display)=>({coding:[{system,code,display}]});
const DCM='http://dicom.nema.org/resources/ontology/DCM';
const LOCAL='urn:dicom3d:research:evidence';
const need=(condition,reason)=>{if(!condition)throw Object.assign(Error(reason),{code:reason});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().filter(k=>k!=='meta').map(k=>[k,canonical(x[k])])):x;

// WHY: R5 describes verified evidence; it does not own or reinterpret imaging.
// BOUNDARY: this first mapping admits only the exact existing public H000 binding.
// INVARIANT: original CT and SEG custody, SOP/frame identities and units stay distinct.
// EVIDENCE: scripts/test-interop-r5-evidence.mjs and owned R5P runtime receipt.
// REGRESSION: R4 modality shapes or SEG-frame numbers in subset corrupt R5 meaning.
export async function buildR5Evidence(verified,metadataBytes,options){
  need(isVerifiedVolume(verified),'UNVERIFIED_VOLUME');
  const {generation,currentGeneration,recorded,sourceEncoding}=options;
  const check=()=>need(Number.isSafeInteger(generation)&&generation>0&&currentGeneration()===generation,'STALE_GENERATION');
  check();const m=await parsePublicMetadata(metadataBytes),d=verified.descriptor;
  need(sourceEncoding?.transferSyntaxUid==='1.2.840.10008.1.2'&&sourceEncoding?.decoded===true&&d.storage.bitsStored===12&&d.storage.highBit===11,'UNQUALIFIED_SOURCE_ENCODING');
  need(d.payload.sha256==='3213cf01a7e846807293da57b2f8300f2de35f9f28f86996c14ee74b3eeeea34','SOURCE_PIXEL_IDENTITY_MISMATCH');
  const frameClosure=new TextEncoder().encode(JSON.stringify(d.frames.map(f=>[f.k,f.sourceFrame,f.sopIdentity,f.pixelSha256,f.sourceFileSha256,f.imagePositionPatient])));
  need(await digest(frameClosure)==='b751a14a46d7e63427250d81e554b4aa723d71f54fc5112755699d10515e2f3c','SOURCE_FRAME_CLOSURE_MISMATCH');
  need(d.source.studyIdentity===m.source.source_study_uid&&d.source.seriesIdentity===m.source.ct_series_uid&&d.source.frameOfReferenceIdentity===m.source.frame_of_reference_uid,'SOURCE_IDENTITY_MISMATCH');
  need(d.frames.length===103&&m.frames.length===103,'INCOMPLETE_SOURCE');
  for(let k=0;k<103;k++)need(d.frames[k].k===k&&d.frames[k].sourceFrame===1&&m.frames[k].ct_k===k&&d.frames[k].sopIdentity===m.frames[k].ct_sop_uid,'FRAME_IDENTITY_MISMATCH');
  need(same(d.shape,m.ct.shape_k_row_column),'SHAPE_MISMATCH');
  need(same(d.geometry.pixelSpacingRowColumnMm,m.ct.geometry.pixel_spacing_row_column_mm),'SPACING_MISMATCH');
  need(same(d.geometry.imageOrientationPatient,m.ct.geometry.image_orientation_patient),'ORIENTATION_MISMATCH');
  need(Number.isFinite(Date.parse(recorded)),'RECORDING_TIME_REQUIRED');
  const root='r5p-h000',subject=ref('Patient/'+root+'-context');
  const ctId=root+'-ct',segId=root+'-seg',selectCt=root+'-ct-context',selectSeg=root+'-segment-1';
  const ctSop='1.2.840.10008.5.1.4.1.1.2',segSop='1.2.840.10008.5.1.4.1.1.66.4';
  const sopCoding=uid=>({system:'urn:ietf:rfc:3986',code:'urn:oid:'+uid});
  const resources=[
    {resourceType:'Patient',id:root+'-context',active:true,identifier:[{system:LOCAL, value:'SYNTHETIC-ADMINISTRATIVE-CONTEXT-NOT-SOURCE-DEMOGRAPHICS'}]},
    {resourceType:'Device',id:root+'-software',status:'active',identifier:[{system:LOCAL,value:'DICOM3D0.6.5-R5P001'}]},
    {resourceType:'ImagingStudy',id:ctId,status:'available',subject,identifier:[{system:'urn:dicom:uid',value:'urn:oid:'+d.source.studyIdentity}],modality:[code(DCM,'CT','Computed Tomography')],numberOfSeries:1,numberOfInstances:103,description:'Selected103 original public H000 CT instances retrieved through native IRIS; no SEG retrieval claim.',series:[{uid:d.source.seriesIdentity,modality:code(DCM,'CT','Computed Tomography'),numberOfInstances:103,instance:d.frames.map(f=>({uid:f.sopIdentity,sopClass:sopCoding(ctSop)}))}]},
    {resourceType:'ImagingStudy',id:segId,status:'available',subject,identifier:[{system:'urn:dicom:uid',value:'urn:oid:'+m.source.source_study_uid}],modality:[code(DCM,'SEG','Segmentation')],numberOfSeries:1,numberOfInstances:1,description:'Previously qualified public H000 SEG source; independently preserved local source, not part of I001 CT-only retrieval.',series:[{uid:m.source.segmentation_series_uid,modality:code(DCM,'SEG','Segmentation'),numberOfInstances:1,instance:[{uid:m.source.segmentation_sop_uid,sopClass:sopCoding(segSop)}]}]},
    {resourceType:'ImagingSelection',id:selectCt,status:'available',subject,code:{text:'Original CT instances corresponding geometrically to occupied source SEG extent'},studyUid:d.source.studyIdentity,seriesUid:d.source.seriesIdentity,frameOfReferenceUid:d.source.frameOfReferenceIdentity,derivedFrom:[ref('ImagingStudy/'+ctId)],instance:m.frames.filter(f=>f.nonzero_voxels>0).map(f=>({uid:f.ct_sop_uid,sopClass:sopCoding(ctSop)}))},
    {resourceType:'ImagingSelection',id:selectSeg,status:'available',subject,code:{text:'Source-defined SEG segment1; historical source coding retained, not a diagnosis'},studyUid:m.source.source_study_uid,seriesUid:m.source.segmentation_series_uid,frameOfReferenceUid:m.source.frame_of_reference_uid,derivedFrom:[ref('ImagingStudy/'+segId)],instance:[{uid:m.source.segmentation_sop_uid,sopClass:sopCoding(segSop),subset:['1']}],identifier:[{system:LOCAL,value:m.structure.semantic_id}]},
    {resourceType:'Observation',id:root+'-mask-volume',status:'final',code:code(LOCAL,'source-mask-volume','Derived source SEG mask volume — nonclinical research measurement'),subject,focus:[ref('ImagingSelection/'+selectSeg)],derivedFrom:[ref('ImagingSelection/'+selectSeg),ref('ImagingSelection/'+selectCt)],valueQuantity:{value:m.mask.nonzero_voxel_count*m.ct.geometry.pixel_spacing_row_column_mm[0]*m.ct.geometry.pixel_spacing_row_column_mm[1]*m.ct.geometry.measured_slice_spacing_mm,unit:'mm³',system:'http://unitsofmeasure.org',code:'mm3'},component:[{code:{text:'Occupied original source-mask voxel count'},valueInteger:m.mask.nonzero_voxel_count}],method:{text:'Count of occupied source SEG voxels multiplied by accepted source voxel volume; no editing, inference or SR-reported measurement'},note:[{text:'Research derived quantity; not independent anatomical accuracy, diagnosis or patient-atlas registration.'}]},
    {resourceType:'DocumentReference',id:root+'-manifest',status:'current',subject,description:'Accepted public H000 source-binding manifest; SHA-256 identifier, not Attachment.hash (which means SHA-1).',identifier:[{system:'urn:dicom3d:sha256',value:PUBLIC_RESEARCH_ASSETS.metadata.sha256}],content:[{attachment:{contentType:'application/json',url:'urn:sha256:'+PUBLIC_RESEARCH_ASSETS.metadata.sha256,title:'Verified public source-binding manifest'}}]},
  ];
  resources.push({resourceType:'Provenance',id:root+'-mapping',target:resources.filter(r=>!['Patient','Device'].includes(r.resourceType)).map(r=>ref(r.resourceType+'/'+r.id)),recorded,activity:code(LOCAL,'source-evidence-projection',R5_EVIDENCE_VERSION),agent:[{who:ref('Device/'+root+'-software')}],entity:[{role:'source',what:ref('DocumentReference/'+root+'-manifest')} ]});
  const sourceMap={schema:R5_EVIDENCE_VERSION,generation,sourceSyntax:'1.2.840.10008.1.2',decodedStorage:d.storage,ctPayloadSha256:d.payload.sha256,publicBindingSha256:PUBLIC_RESEARCH_ASSETS.metadata.sha256,ctFrames:d.frames.map(f=>({k:f.k,sop:f.sopIdentity,sourceFrame:f.sourceFrame,pixelSha256:f.pixelSha256,objectSha256:f.sourceFileSha256})),segFrames:m.frames.map(f=>({segFrame:f.seg_frame_number,ctK:f.ct_k,ctSop:f.ct_sop_uid,nonzeroVoxels:f.nonzero_voxels})),historicalSourceCodes:m.structure.source.type_codes,clinicalInterpretation:null,sourceGeometry:d.geometry};
  check();return freezeMetadata({schema:R5_EVIDENCE_VERSION,generation,sourceMap,resources,bundle:{resourceType:'Bundle',type:'transaction',entry:resources.map(resource=>({resource,request:{method:'PUT',url:resource.resourceType+'/'+resource.id}}))}});
}

export function validateR5EvidenceGraph(resources,accepted,currentGeneration){
  need(currentGeneration===accepted.generation,'STALE_GENERATION');
  need(Array.isArray(resources)&&resources.length===accepted.resources.length,'INCOMPLETE_EVIDENCE_GRAPH');
  const actual=new Map(resources.map(r=>[r.resourceType+'/'+r.id,r]));
  need(actual.size===resources.length,'DUPLICATE_RESOURCE');
  for(const expected of accepted.resources){const key=expected.resourceType+'/'+expected.id;need(actual.has(key),'MISSING_RESOURCE');need(same(canonical(actual.get(key)),canonical(expected)),'SOURCE_EVIDENCE_MISMATCH');}
  return true;
}
