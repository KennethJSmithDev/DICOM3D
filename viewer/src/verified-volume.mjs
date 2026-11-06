// Compatibility facade; all CT admission now crosses the optional registry.
import {moduleRegistry} from './imaging-modules.mjs';
import {isVerifiedVolume,createPublicationOwner} from './imaging-core.mjs';
import {freezeMetadata as freeze,requireImaging} from './imaging-contract.mjs';
export {isVerifiedVolume,createPublicationOwner};
const need=(v,c)=>requireImaging(v,'SOURCE_INVALID',{reasons:[c]});
export const imagingCapabilities=()=>moduleRegistry.capabilities();
export const requireClassicCt=()=>moduleRegistry.requireCapability('dicom.ct.classic.volume',1);
export async function verifyVolume(input,buffer,options={}){return moduleRegistry.admit({apiVersion:1,representation:'spatial-volume',descriptor:input,sourceEncoding:options.sourceEncoding},buffer,{owner:options.owner??createPublicationOwner(),signal:options.signal});}
export function verifiedManifest(v){
  need(isVerifiedVolume(v),'unadmitted object');const d=v.descriptor;
  return {structure:{semantic_id:'imaging.acquired.volume',display_name:'Acquired CT volume'},source:{source_study_uid:d.source.studyIdentity,ct_series_uid:d.source.seriesIdentity,frame_of_reference_uid:d.source.frameOfReferenceIdentity},spatial:{matrices:d.geometry.matrices},verifiedVolume:{schema:d.schema,payloadSha256:d.payload.sha256}};
}
// Compatibility projection for existing CT controllers, never an H000 acceptance receipt.
export function verifiedPresentationReceipt(v){
  need(isVerifiedVolume(v),'unadmitted object');const d=v.descriptor,m=d.geometry.matrices;
  return freeze({result:'VERIFIED_MULTI_SOP_CT',volume:{npy_sha256:d.payload.sha256,shape_k_row_column:d.shape},accepted_input:{study_uid:d.source.studyIdentity,ct_series_uid:d.source.seriesIdentity,frame_of_reference_uid:d.source.frameOfReferenceIdentity},geometry:{pixel_spacing_row_column_mm:d.geometry.pixelSpacingRowColumnMm,image_orientation_patient:d.geometry.imageOrientationPatient,measured_slice_spacing_mm:Math.hypot(...m.index_to_patient_mm.slice(0,3).map(r=>r[0]))},affine_voxel_k_row_column_to_patient_mm:m.index_to_patient_mm,inverse_patient_mm_to_voxel_k_row_column:m.patient_mm_to_index,slice_mapping:d.frames.map(f=>({k:f.k,sop_uid:f.sopIdentity,source_frame:f.sourceFrame}))});
}
export function verifiedFrameRgba(v,k,center,width,rgba){return moduleRegistry.operations(v).frameRgba(v,k,center,width,rgba);}
