import {digest} from './ct-frame.mjs';
import {bindSegEvidence} from './semantic-evidence.mjs';
import {segmentationLesson} from './evidence-learning.mjs';
import {evidenceLearning} from './evidence-learning-ui';
export function prepareSemanticEvidence({mount,manifest,getCt,navigate,selectStructure}:any){
  const panel=document.createElement('details');panel.id='semanticEvidence';
  panel.innerHTML=`<summary>SEG · source-linked evidence</summary><div class="section-body"><p>Load the accepted local H000-C alignment receipt. No source pixels or anatomy are changed.</p><label>Accepted SEG alignment receipt <input id="segEvidenceFile" type="file" accept=".json"></label><button id="segEvidenceLoad">Verify source links</button><p id="segEvidenceStatus" role="status">Load CT first; source links unresolved.</p><div id="segEvidenceControls" hidden><label>Occupied source frame <select id="segEvidenceFrame"></select></label><button id="segEvidenceNavigate">Select lesion & show source frame</button><button id="segEvidencePeak">Show largest mask cross-section</button><p id="segEvidenceSummary"></p><pre id="segEvidenceIdentity"></pre></div><output id="semanticEvidenceState" hidden></output></div>`;
  mount.append(panel);const get=(id:string)=>panel.querySelector('#'+id) as any;
  const learning=evidenceLearning('semanticLearning',get('segEvidenceControls'));
  let binding:any=null,generation=0,selected=false,k=0;
  function refresh(){
    const frame=binding?.frames.find((f:any)=>f.ct_k===k);
    get('semanticEvidenceState').textContent=JSON.stringify({loaded:!!binding,selected,k,status:binding?'VERIFIED':'UNRESOLVED',semanticId:binding?.semanticId,sourceSop:frame?.ct_sop_uid,segFrame:frame?.seg_frame_number,maskVoxels:frame?.nonzero_voxels,maskVolumeMm3:binding?.maskVolumeMm3});
    if(binding){get('segEvidenceSummary').textContent=`${binding.semanticId} · segment ${binding.segment} (${binding.label}) · ${binding.count.toLocaleString()} mask voxels · ${binding.maskVolumeMm3.toFixed(3)} mm³ mask-derived volume. Current CT k=${k}: ${frame?.nonzero_voxels??0} mask voxels. ${selected?'Lesion selected.':'Lesion not selected.'} ${binding.limitation}`;
      learning.show(segmentationLesson(binding,k));
      get('segEvidenceIdentity').textContent=`VERIFIED within accepted H000 evidence\nSEG SOP: ${binding.segSop}\nCT SOP: ${frame?.ct_sop_uid}\nSEG frame: ${frame?.seg_frame_number}; CT k: ${k}; CT source frame: 1\n${binding.basis}`;}
  }
  function clear(){generation++;binding=null;get('segEvidenceControls').hidden=true;get('segEvidenceFrame').replaceChildren();get('segEvidenceSummary').textContent='';get('segEvidenceIdentity').textContent='';learning.clear();get('segEvidenceStatus').textContent='Source links unresolved. Load CT and its accepted SEG alignment receipt.';refresh();}
  get('segEvidenceLoad').onclick=async()=>{
    clear();const token=generation;
    try{const ct=getCt(),file=get('segEvidenceFile').files?.[0];if(!ct||!file)throw Error('Load CT and choose the accepted SEG receipt');if(file.size>1024*1024)throw Error('Receipt exceeds 1 MiB');
      const bytes=await file.arrayBuffer();if(await digest(bytes)!==manifest.provenance?.C_evidence?.sha256)throw Error('SEG alignment receipt SHA-256 mismatch');
      const candidate=bindSegEvidence(JSON.parse(new TextDecoder().decode(bytes)),ct,manifest);if(token!==generation||ct!==getCt())return;
      binding=candidate;for(const f of binding.occupied)get('segEvidenceFrame').add(new Option(`CT k=${f.ct_k} · SEG frame ${f.seg_frame_number} · ${f.nonzero_voxels} mask voxels`,String(f.ct_k)));
      get('segEvidenceControls').hidden=false;get('segEvidenceStatus').textContent='Source links VERIFIED against accepted receipt and loaded CT identity; no SR finding/diagnosis inferred.';refresh();
    }catch(e){if(token===generation)get('segEvidenceStatus').textContent=`Unresolved: ${String(e)}`;}
  };
  const go=(frame:number)=>{if(binding&&getCt()){selectStructure();navigate(frame);get('segEvidenceFrame').value=String(frame);}};
  get('segEvidenceNavigate').onclick=()=>go(Number(get('segEvidenceFrame').value));get('segEvidencePeak').onclick=()=>binding&&go(binding.peak.ct_k);
  clear();return {frame(value:number){k=value;refresh();},selection(value:boolean){selected=value;refresh();},clear,dispose(){clear();panel.remove();}};
}
