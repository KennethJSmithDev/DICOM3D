import {digest,validateReceipt,readStoredNpy,frameRgba} from './ct-frame.mjs';
import {prepareCtPlane} from './ct-plane';
import {validateSpatial} from './ct-spatial.mjs';
import {prepareCtVolume} from './ct-volume';
import {prepareSemanticEvidence} from './semantic-evidence-ui';
export function prepareLocalCt(manifest:any,sceneOptions:any) {
  const mount=document.querySelector('#sourceMount')!;
  const controls=document.createElement('details');controls.id='ctPanel';
  controls.innerHTML=`<summary>Local acquired CT · optional</summary><div class="section-body">
    <p class="help-copy">Uses accepted local NPY pixels and their H000-B receipt. Acquired frames, complete CT volume context and optional source-positioned plane. No new registration or segmentation.</p>
    <label>CT frame receipt <input id="ctReceiptFile" type="file" accept=".json"></label>
    <label>Stored CT volume <input id="ctVolumeFile" type="file" accept=".npy"></label>
    <button id="ctLoad" type="button">Load local CT</button>
    <p id="ctStatus" role="status" aria-live="polite">Choose both files. They stay in this browser.</p>
    <div id="ctControls" hidden>
      <label>Acquired frame k <input id="ctFrame" type="range" min="0" max="102" step="1" value="0"></label>
      <div class="controls"><button id="ctPrevious" type="button">Previous frame</button><button id="ctNext" type="button">Next frame</button></div>
      <label>Display level <input id="ctLevel" type="range" min="-1024" max="3071" step="1" value="-600"></label>
      <label>Display width <input id="ctWidth" type="range" min="1" max="4096" step="1" value="1500"></label>
      <p class="help-copy">Display only · slope 1 / intercept −1024. No calibrated HU claim. Native row/column order; no resampled views.</p>
      <button id="ctReset" type="button">Reset CT frame and display</button> <button id="ctUnload" type="button">Unload CT</button>
      <details><summary>Exact source identity</summary><pre id="ctIdentity" class="metadata"></pre></details>
      <p id="ctTechnical" data-advanced class="metadata"></p><output id="ctMetrics" hidden></output>
    </div></div>`;
  mount.append(controls);
  const pane=document.createElement('section');pane.id='ctPane';pane.className='viewport';pane.hidden=true;
  pane.setAttribute('aria-label','Acquired CT image, separate from 3D');
  pane.innerHTML='<div class="viewport-heading"><strong id="ctCaption">Acquired axial CT</strong><span>Research display only</span></div><canvas id="ctPixels" width="512" height="512" role="img" aria-label="Acquired CT pixels"></canvas>';
  const workspace=document.querySelector('.workspace')!;workspace.append(pane);
  const get=(id:string)=>controls.querySelector(`#${id}`) as any;
  const plane=prepareCtPlane(sceneOptions,manifest);
  const volume=prepareCtVolume(sceneOptions,manifest);
  controls.querySelector<HTMLButtonElement>('#ctVolumeFit')!.onclick=()=>sceneOptions.framing.fitAssembly();
  const canvas=pane.querySelector<HTMLCanvasElement>('canvas')!,ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  let source:Uint16Array|null=null,receipt:any=null,image:ImageData|null=null,generation=0,loadMs=0;
  const semantic=prepareSemanticEvidence({mount:document.querySelector('#sliceMount')??controls.querySelector('.section-body'),manifest,getCt:()=>receipt,navigate:(k:number)=>{get('ctFrame').value=String(k);render();},selectStructure:()=>sceneOptions.selectStructure?.()});
  async function clear() {source=null;receipt=null;image=null;semantic.clear();plane.clear();ctx.clearRect(0,0,512,512);pane.hidden=true;workspace.classList.remove('has-ct');get('ctControls').hidden=true;get('ctIdentity').textContent='';get('ctMetrics').textContent='';await volume.clear();}
  function render() {
    if(!source||!image)return;
    const k=Number(get('ctFrame').value),level=Number(get('ctLevel').value),width=Number(get('ctWidth').value),start=performance.now();
    frameRgba(source,k,level,width,image.data);ctx.putImageData(image,0,0);
    plane.update(receipt,image,k);
    volume.display(level,width);
    get('ctPrevious').disabled=k===0;get('ctNext').disabled=k===102;
    const f=receipt.slice_mapping[k];
    semantic.frame(k);
    get('ctIdentity').textContent=`CT k=${k} · image ${k+1}/103\nSOP Instance UID: ${f.sop_uid}\nOne acquired image per SOP; k is stack index, not a multi-frame number.\nSeries: ${receipt.accepted_input.ct_series_uid}\nVolume SHA-256: ${receipt.volume.npy_sha256}`;
    get('ctTechnical').textContent=`Native 512×512; row/column ${receipt.geometry.pixel_spacing_row_column_mm.join('/')} mm; k spacing ${receipt.geometry.measured_slice_spacing_mm} mm. IOP ${receipt.geometry.image_orientation_patient.join(',')}. Plane uses accepted source transforms; display world is presentation state.`;
    pane.querySelector('#ctCaption')!.textContent=`Acquired CT · k=${k} (${k+1}/103)`;
    canvas.setAttribute('aria-label',`Acquired CT k ${k}; SOP ${f.sop_uid}`);
    get('ctStatus').textContent=`k=${k} · level ${level} / width ${width} · display only`;
    get('ctMetrics').textContent=JSON.stringify({k,level,width,loadMs,convertAndPutMs:performance.now()-start,sourceBytes:source.byteLength,rgbaBytes:image.data.byteLength,sop:f.sop_uid});
  }
  get('ctLoad').onclick=async()=>{
    const token=++generation;await clear();
    try {
      const metadata=get('ctReceiptFile').files?.[0],volumeFile=get('ctVolumeFile').files?.[0];
      if(!metadata||!volumeFile)throw Error('Choose both local files');
      if(metadata.size>1024*1024||volumeFile.size!==54001792)throw Error('Unexpected input size');
      const start=performance.now();get('ctStatus').textContent='Verifying local CT inputs…';
      const meta=await metadata.arrayBuffer();
      if(await digest(meta)!==manifest.provenance.B_evidence.sha256)throw Error('CT receipt SHA-256 mismatch');
      const checked=validateReceipt(JSON.parse(new TextDecoder().decode(meta)),manifest);
      validateSpatial(checked,manifest);
      const buffer=await volumeFile.arrayBuffer();
      if(await digest(buffer)!==checked.volume.npy_sha256)throw Error('CT volume SHA-256 mismatch');
      const pixels=readStoredNpy(buffer);if(token!==generation)return;
      if(!await volume.load(pixels,checked)||token!==generation)return;
      source=pixels;receipt=checked;image=ctx.createImageData(512,512);loadMs=performance.now()-start;
      get('ctFrame').value=0;get('ctLevel').value=-600;get('ctWidth').value=1500;
      pane.hidden=false;workspace.classList.add('has-ct');get('ctControls').hidden=false;render();sceneOptions.framing.fitAssembly();
    }catch(error){if(token===generation){await clear();get('ctStatus').textContent=`CT unavailable: ${String(error)}. Acquired source files are unchanged.`;}}
  };
  for(const id of ['ctFrame','ctLevel','ctWidth'])get(id).oninput=render;
  get('ctPrevious').onclick=()=>{get('ctFrame').value=Math.max(0,Number(get('ctFrame').value)-1);render();};
  get('ctNext').onclick=()=>{get('ctFrame').value=Math.min(102,Number(get('ctFrame').value)+1);render();};
  get('ctReset').onclick=()=>{get('ctFrame').value=0;get('ctLevel').value=-600;get('ctWidth').value=1500;render();controls.querySelector<HTMLButtonElement>('#ctVolumeReset')!.click();sceneOptions.framing.restore();};
  get('ctUnload').onclick=async()=>{generation++;await clear();get('ctReceiptFile').value=get('ctVolumeFile').value='';get('ctStatus').textContent='CT unloaded; full-volume GPU resource released. Local source files are unchanged.';};
  get('ctLoad').disabled=true;
  return {start(){volume.start();get('ctLoad').disabled=false;},selection:(value:boolean)=>semantic.selection(value),bounds:()=>volume.bounds(),async dispose(){generation++;await clear();semantic.dispose();await volume.dispose();controls.remove();pane.remove();},volume};
}
