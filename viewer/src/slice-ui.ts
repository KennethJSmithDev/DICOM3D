import {addToScene,loadGltf,getMeshTriangles,setSubtreeVisible,createPbrMaterial,markMaterialUboDirty} from '@babylonjs/lite';
import {fixtureGeometry,deriveSlices,slicesGlb,createSliceState,updateSlice,setGap,resetSlice,resetAll,slicePose} from './slices.mjs';

export async function prepareSlices(options: any) {
  const {engine,scene,sourceNode,sourceMeshes,glbBytes,canvas,status,visibilityButton,onOriginal}=options;
  const geometry=fixtureGeometry(glbBytes),slices=deriveSlices(geometry.positions,geometry.indices);
  const derived=await loadGltf(engine,slicesGlb(slices));
  addToScene(scene,derived);
  const nodes:any[]=[];const visit=(n:any)=>{nodes.push(n);(n.children||[]).forEach(visit);};derived.entities.forEach(visit);
  const meshIds=new Map<any,string>(),roots=new Map<string,any>(),materials=new Map<string,any>();
  for(const slice of slices) {
    const node=nodes.find(n=>n.name===slice.id);if(!node)throw Error(`Missing derived identity ${slice.id}`);
    roots.set(slice.id,node);
    const material=createPbrMaterial({baseColorFactor:[.72,.32,.22,1],metallicFactor:0,roughnessFactor:.8,doubleSided:true,alphaBlend:true,alpha:1});
    materials.set(slice.id,material);
    const bind=(n:any)=>{if(getMeshTriangles(n)){meshIds.set(n,slice.id);n.material=material;}(n.children||[]).forEach(bind);};bind(node);
    setSubtreeVisible(node,false);
  }
  const state=createSliceState(slices);let active=false,originalVisible=true,dragMode=false,drag:any=null,skipClick=false,cameraControls=(enabled:boolean)=>{},framing:any=null;
  const panel=document.createElement('details');panel.id='slicePanel';panel.open=true;
  panel.innerHTML=`<summary>Synthetic presentation slices · not CT slices</summary>
  <button id="sliceMode" type="button">Enable derived slices</button>
  <div id="sliceControls" hidden>
    <p>Five open model-Y surface bands · no caps. Display changes never alter the source. Rotate about each band's model origin.</p>
    <div class="slice-grid">
      <label>Selected slice <select id="sliceSelect"><option value="">No slice selected</option>${slices.map(s=>`<option value="${s.id}">Band ${s.ordinal+1}</option>`).join('')}</select></label>
      <label>Canvas action <select id="sliceAction"><option value="orbit">Orbit camera</option><option value="translate">Drag selected in model X/Y</option></select></label>
      <label>Expansion gap (mm) <input id="sliceGap" type="range" min="0" max="50" step="1" value="0"><output id="sliceGapValue">0</output></label>
      ${['X','Y','Z'].map((axis,i)=>`<label>Selected ${axis} offset (mm) <input id="sliceOffset${i}" type="range" min="-100" max="100" step="1" value="0"><output id="sliceOffsetValue${i}">0</output></label>`).join('')}
      <label>Selected Z rotation (degrees) <input id="sliceRotation" type="range" min="-180" max="180" step="5" value="0"><output id="sliceRotationValue">0</output></label>
      <label>Selected opacity (%) <input id="sliceOpacity" type="range" min="15" max="100" step="5" value="100"><output id="sliceOpacityValue">100</output></label>
    </div>
    <div class="slice-actions"><button id="sliceVisibility" type="button">Hide selected slice</button><button id="sliceIsolate" type="button" aria-pressed="false">Isolate selected</button><button id="sliceReset" type="button">Reset selected</button><button id="sliceResetAll" type="button">Reset all and reassemble</button></div>
    <p id="sliceIdentity" role="status" aria-live="polite"></p>
  </div>`;
  const style=document.createElement('style');style.textContent=`#slicePanel{padding:10px 16px;border-bottom:1px solid #34414a;max-height:42dvh;overflow:auto;flex-shrink:0;font:14px system-ui}#slicePanel summary{cursor:pointer;padding:5px}#slicePanel p{margin:8px 0}.slice-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 20px}.slice-grid label{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.slice-grid input{width:140px;min-height:34px}.slice-grid select{max-width:100%;padding:8px}.slice-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}#slicePanel button{min-height:44px;margin:3px 0}#slicePanel :focus-visible{outline:2px solid #5edbff;outline-offset:2px}#sliceIdentity{overflow-wrap:anywhere}@media(max-width:600px){#slicePanel{padding:8px 12px;max-height:36dvh}.slice-grid{grid-template-columns:1fr}}`;
  document.head.append(style);canvas.before(panel);
  const get=(id:string)=>panel.querySelector(`#${id}`) as any;
  const item=()=>state.items.find(s=>s.id===state.selected);
  function refresh() {
    setSubtreeVisible(sourceNode,!active&&originalVisible);
    for(const slice of slices) {
      const pose=slicePose(slice,state),root=roots.get(slice.id),material=materials.get(slice.id);
      root.position.set(...pose.position);root.rotation.z=pose.rotation;
      setSubtreeVisible(root,active&&pose.visible);
      // The blended material path also receives zero alpha for hidden bands;
      // pick eligibility and canonical presentation opacity remain separate.
      material.alpha=active&&pose.visible?pose.opacity:0;
      material.baseColorFactor=state.selected===slice.id?[.12,.65,.9,1]:[.72,.32,.22,1];
      markMaterialUboDirty(material);
    }
    visibilityButton.disabled=active;cameraControls(!(active&&dragMode));
    framing?.sync();
    get('sliceControls').hidden=!active;get('sliceMode').textContent=active?'Show original fixture':'Enable derived slices';
    get('sliceSelect').value=state.selected||'';const current=item();
    for(let i=0;i<3;i++){get(`sliceOffset${i}`).disabled=!current;get(`sliceOffset${i}`).value=current?current.offset[i]*1000:0;get(`sliceOffsetValue${i}`).textContent=current?Math.round(current.offset[i]*1000):'—';}
    get('sliceRotation').disabled=get('sliceOpacity').disabled=get('sliceVisibility').disabled=get('sliceReset').disabled=get('sliceIsolate').disabled=!current;
    get('sliceRotation').value=current?current.rotation*180/Math.PI:0;get('sliceRotationValue').textContent=current?Math.round(current.rotation*180/Math.PI):'—';
    get('sliceOpacity').value=current?current.opacity*100:100;get('sliceOpacityValue').textContent=current?Math.round(current.opacity*100):'—';
    get('sliceGap').value=state.gap*1000;get('sliceGapValue').textContent=Math.round(state.gap*1000);
    get('sliceVisibility').textContent=current?.visible?'Hide selected slice':'Show selected slice';get('sliceIsolate').setAttribute('aria-pressed',String(state.isolate));
    if(active){get('sliceIdentity').textContent=`Selected: ${state.selected||'none'} · source: ${sourceNode.name} · ${current?.visible?'visible':'hidden/unselected'} · presentation only`;
      status.textContent=`Derived presentation slices · ${state.selected||'none'}\nExpansion ${Math.round(state.gap*1000)} mm · open surface bands, not acquired CT slices. Source geometry unchanged.`;}
  }
  get('sliceMode').onclick=()=>{if(!active)originalVisible=sourceNode.visible!==false;active=!active;refresh();if(active)framing?.fitAssembly();else{onOriginal();framing?.restore();}};
  get('sliceSelect').onchange=()=>{state.selected=get('sliceSelect').value||null;refresh();};
  get('sliceAction').onchange=()=>{dragMode=get('sliceAction').value==='translate';refresh();};
  get('sliceGap').oninput=()=>{setGap(state,Number(get('sliceGap').value)/1000);refresh();framing?.fitAssembly();};
  for(let i=0;i<3;i++)get(`sliceOffset${i}`).oninput=()=>{const current=item();if(current){const offset=[...current.offset];offset[i]=Number(get(`sliceOffset${i}`).value)/1000;updateSlice(state,current.id,{offset});refresh();}};
  get('sliceRotation').oninput=()=>{if(item())updateSlice(state,state.selected,{rotation:Number(get('sliceRotation').value)*Math.PI/180});refresh();};
  get('sliceOpacity').oninput=()=>{if(item())updateSlice(state,state.selected,{opacity:Number(get('sliceOpacity').value)/100});refresh();};
  get('sliceVisibility').onclick=()=>{if(item())updateSlice(state,state.selected,{visible:!item().visible});refresh();};
  get('sliceIsolate').onclick=()=>{state.isolate=!state.isolate;refresh();};
  get('sliceReset').onclick=()=>{if(item())resetSlice(state,state.selected);refresh();};
  get('sliceResetAll').onclick=()=>{resetAll(state);refresh();framing?.restore();};
  canvas.addEventListener('pointerdown',(event:PointerEvent)=>{if(active&&dragMode&&item()){drag={x:event.clientX,y:event.clientY,offset:[...item().offset],id:item().id,moved:false};canvas.setPointerCapture(event.pointerId);event.preventDefault();}});
  canvas.addEventListener('pointermove',(event:PointerEvent)=>{if(drag){const dx=(event.clientX-drag.x)*.00025,dy=(drag.y-event.clientY)*.00025;drag.moved=drag.moved||Math.abs(dx)+Math.abs(dy)>.0005;updateSlice(state,drag.id,{offset:[Math.max(-.1,Math.min(.1,drag.offset[0]+dx)),Math.max(-.1,Math.min(.1,drag.offset[1]+dy)),drag.offset[2]]});refresh();}});
  canvas.addEventListener('pointerup',()=>{if(drag){skipClick=drag.moved;drag=null;}});canvas.addEventListener('pointercancel',()=>{drag=null;});
  return {get active(){return active;},canPick:(mesh:any)=>{const id=meshIds.get(mesh);return Boolean(id&&slicePose(slices.find(s=>s.id===id),state).visible);},
    selectMesh:(mesh:any)=>{state.selected=meshIds.get(mesh)||null;if(!state.selected)state.isolate=false;refresh();},clear:()=>{state.selected=null;state.isolate=false;refresh();},
    consumeDragClick:()=>{const value=skipClick;skipClick=false;return value;},
    setCameraControls:(callback:any)=>{cameraControls=callback;},
    meshes:()=>[...meshIds.keys()],selectedMeshes:()=>[...meshIds].filter(([mesh,id])=>id===state.selected&&mesh.visible!==false).map(([mesh])=>mesh),
    setFraming:(value:any)=>{framing=value;framing.sync();},
  };
}
