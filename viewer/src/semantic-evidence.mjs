// Project accepted SEG alignment evidence into navigation; never infer a new link.
export function bindSegEvidence(evidence,ct,manifest){
  const need=(ok,msg)=>{if(!ok)throw Error(msg);};
  const a=evidence?.accepted_inputs,s=manifest.source;
  need(evidence?.result==='PASS_H000_C'&&evidence.semantic_id===manifest.structure.semantic_id,'SEG receipt not accepted for this structure');
  need(a?.study_uid===s.source_study_uid&&a.ct_series_uid===s.ct_series_uid&&a.seg_sop_uid===s.segmentation_sop_uid&&a.frame_of_reference_uid===s.frame_of_reference_uid,'SEG source identity mismatch');
  need(a.ct_volume_sha256===ct.volume.npy_sha256&&a.h000_b_evidence_sha256===manifest.provenance.B_evidence.sha256&&evidence.mask?.npy_sha256===manifest.provenance.C_mask.sha256,'SEG derivation identity mismatch');
  need(evidence.source_reference_cross_check?.all_geometrically_mapped_sops_in_actual_source_context===true,'SEG source-reference check unresolved');
  const frames=evidence.frame_mapping;
  need(Array.isArray(frames)&&frames.length===ct.slice_mapping.length,'SEG frame coverage mismatch');
  const seen=new Set();let count=0;
  for(const f of frames){
    need(Number.isInteger(f.ct_k)&&!seen.has(f.ct_k)&&ct.slice_mapping[f.ct_k]?.sop_uid===f.ct_sop_uid,'SEG CT frame/SOP mismatch');
    need(Number.isInteger(f.seg_frame_number)&&f.seg_frame_number>=1&&f.seg_frame_number<=frames.length,'Invalid SEG frame');
    need(Number.isSafeInteger(f.nonzero_voxels)&&f.nonzero_voxels>=0&&f.nonzero_voxels<=512*512,'Invalid mask count');
    seen.add(f.ct_k);count+=f.nonzero_voxels;
  }
  need(new Set(frames.map(f=>f.seg_frame_number)).size===frames.length&&count===evidence.mask.nonzero_voxel_count,'SEG count/frame mismatch');
  const occupied=frames.filter(f=>f.nonzero_voxels>0).sort((a,b)=>a.ct_k-b.ct_k);
  need(occupied.length>0&&JSON.stringify(occupied.map(f=>f.ct_k))===JSON.stringify(evidence.mask.occupied_k),'SEG occupied frame mismatch');
  const [row,col]=ct.geometry.pixel_spacing_row_column_mm,z=ct.geometry.measured_slice_spacing_mm;
  need([row,col,z].every(v=>Number.isFinite(v)&&v>0),'Invalid source spacing');
  return {semanticId:evidence.semantic_id,segSop:a.seg_sop_uid,segment:evidence.segment_semantics.segment_number,
    label:evidence.segment_semantics.label,typeCodes:evidence.segment_semantics.type_codes,
    algorithm:evidence.segment_semantics.algorithm_name,frames,occupied,
    peak:occupied.reduce((a,b)=>b.nonzero_voxels>a.nonzero_voxels?b:a),
    count,voxelMm3:row*col*z,maskVolumeMm3:count*row*col*z,
    status:'VERIFIED',basis:'Accepted geometric frame mapping, cross-checked against shared DICOM source references; shared source list is not ordering authority',
    limitation:'Mask-derived volume, not external anatomical accuracy, diagnosis or whole-lung segmentation. No linked SR measurement is established.'};
}
