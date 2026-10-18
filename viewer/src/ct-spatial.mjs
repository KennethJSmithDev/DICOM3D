// Acquired image coverage; source matrices are never modified. Column vectors.
export const point=(matrix,p)=>matrix.slice(0,3).map(row=>row[3]+p.reduce((s,x,i)=>s+row[i]*x,0));
export function validateSpatial(receipt,manifest) {
  const m=manifest.spatial?.matrices;
  if(!m||JSON.stringify(m.index_to_patient_mm)!==JSON.stringify(receipt.affine_voxel_k_row_column_to_patient_mm)||JSON.stringify(m.patient_mm_to_index)!==JSON.stringify(receipt.inverse_patient_mm_to_voxel_k_row_column))throw Error('CT spatial receipt differs from manifest');
  for(const name of ['index_to_patient_mm','patient_mm_to_index','patient_mm_to_model_m','model_m_to_patient_mm']) {
    const a=m[name];if(a?.length!==4||a.some(r=>r.length!==4||r.some(v=>!Number.isFinite(v)))||JSON.stringify(a[3])!=='[0,0,0,1]')throw Error('Invalid spatial matrix');
  }
  const g=receipt.geometry,spacing=g.pixel_spacing_row_column_mm,iop=g.image_orientation_patient;
  for(let d=0;d<3;d++)if(Math.abs(m.index_to_patient_mm[d][2]-iop[d]*spacing[1])>1e-10||Math.abs(m.index_to_patient_mm[d][1]-iop[d+3]*spacing[0])>1e-10)throw Error('CT orientation/spacing differs');
  for(const p of [[0,0,0],[102,511,511],[71,213.25,318.75]]) {
    const patient=point(m.index_to_patient_mm,p),back=point(m.patient_mm_to_index,patient),model=point(m.patient_mm_to_model_m,patient),round=point(m.model_m_to_patient_mm,model);
    if(back.some((v,i)=>Math.abs(v-p[i])>1e-9)||round.some((v,i)=>Math.abs(v-patient[i])>1e-9))throw Error('Spatial inverse mismatch');
  }
  return m;
}
export const edgeIndices=k=>[[k,-.5,-.5],[k,-.5,511.5],[k,511.5,511.5],[k,511.5,-.5]];
export function planeModel(m,k) {
  if(!Number.isInteger(k)||k<0||k>102)throw Error('Invalid acquired plane k');
  return edgeIndices(k).map(p=>point(m.patient_mm_to_model_m,point(m.index_to_patient_mm,p)));
}
export function uvToIndex(k,u,v){return [k,v*512-.5,u*512-.5];}
