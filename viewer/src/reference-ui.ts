import {getMeshTriangles,enableMaterialPlugins,markMaterialUboDirty,onBeforeRender,getMaterialTextures,acquireTexture,releaseTexture} from '@babylonjs/lite';

import {ATLAS_CAMERA_PRESENTATION,HRA_FEMALE_CAMERA_PRESENTATION} from './reference-camera.mjs';
import {referenceLesson} from './reference-learning.mjs';
import {createPickGeneration} from './pick-generation.mjs';



// One presentation controller, shared by Basic/DICOM and the existing picker/camera.

export function prepareReference({scene,root,manifest,status,selectedMaterial,visibilityButton}:any) {

  const parts=manifest.reference.structures;const groups=new Map<string,any[]>();

  function visit(node:any,owner:string|null=null){if(parts.some((p:any)=>p.id===node.name))owner=node.name;if(owner&&getMeshTriangles(node)){if(!groups.has(owner))groups.set(owner,[]);groups.get(owner)!.push(node);}for(const child of node.children||[])visit(child,owner);}

  visit(root);

  if(groups.size!==parts.length)throw Error('Reference semantic structures do not match GLB');

  // Qualified reference skin remains renderable and explicitly selectable, but
  // does not intercept canvas picks of the anatomy visible beneath it.
  const skinMeshes=new Set(['FMA7163','VH_F_skin'].flatMap(id=>groups.get(id)||[]));

  const diagnosticAbort=new AbortController();
  // WHY: an older GPU hit/miss must not replace newer explicit user intent.
  // BOUNDARY: completion validity only; state below still owns selection.
  // INVARIANT: source geometry and valid serialized picks stay unchanged.
  // EVIDENCE: RC-FOUNDATION-002 ordering trace; UX-RACE-001 deferred/browser tests.
  // REGRESSION: invalidate at intent time, including before reference fetch/disposal.
  const picks=createPickGeneration();
  for(const [id,event] of [['referenceVariant','change'],['referenceReload','click'],['referenceUnload','click']])
    document.querySelector('#'+id)?.addEventListener(event,()=>picks.invalidate(),{capture:true,signal:diagnosticAbort.signal});

  const originals=new Map<any,any>();for(const list of groups.values())for(const mesh of list)originals.set(mesh,mesh.material);

  // Cached originals remain reusable after their last renderable swaps away.

  // Lite releases renderable-owned textures; our cache owns one explicit hold.

  const retainedTextures=[...new Set([...originals.values()].flatMap(m=>getMaterialTextures(m)))];

  for(const texture of retainedTextures)acquireTexture(texture);

  const clipMax=manifest.reference.presentation?.clip_max??1.9;
  const state={appearance:'source',context:true,selected:null as string|null,isolate:false,hidden:new Set<string>(),clip:clipMax,opacity:new Map<string,number>()};let framing:any=null;let projection:((detail:any)=>void)|null=null;

  // Lite's scene clip-plane state alone does not inject discard into stock PBR.

  // Use its public material-plugin socket; geometry stays frozen.

  const clipPlugin={name:'DICOM3DReferenceClipV1',getUniforms:()=>({ubo:[{name:'referenceClipY',type:'f32'}]}),getCustomCode:(type:string)=>type==='fragment'?{CUSTOM_FRAGMENT_MAIN_BEGIN:'if (input.worldPos.y > material.referenceClipY) { discard; }'}:null,writeUbo:(data:Float32Array,offsets:ReadonlyMap<string,number>)=>{data[offsets.get('referenceClipY')!/4]=state.clip;}};

  const materials=[...new Set([...originals.values(),selectedMaterial])];const initialAlpha=new Map(materials.map(m=>[m,m.alpha??1]));for(const material of materials){material.plugins=[clipPlugin];material.alphaBlend=true;}enableMaterialPlugins(scene);
  const sourceFactors=new Map(materials.map(m=>[m,{color:[...(m.baseColorFactor??[1,1,1,1])],roughness:m.roughnessFactor??1,metallic:m.metallicFactor??1}]));
  // Configure the public factor slots before scene registration: Lite's glTF
  // fast path otherwise compiles these constant factors into its textures.
  for(const [m,f] of sourceFactors){m.baseColorFactor=[...f.color];m.roughnessFactor=f.roughness;m.metallicFactor=f.metallic;}

  const panel=document.createElement('section');panel.className='section-body control-section';panel.id='referenceControls';

  panel.innerHTML=`<h2>Generalized anatomy · R&amp;D</h2><p>Approximate synthetic surfaces. Illustrative organ shapes, proportions and placement; no patient, DICOM or anatomical accuracy claim.</p><label>Major region <select id="referenceRegion"><option value="">All regions</option></select></label><label>Structure <select id="referenceSelect"><option value="">Choose a structure</option></select></label><div class="camera-actions"><button id="referenceHide">Hide selected</button><button id="referenceShow">Show selected</button><button id="referenceIsolate" aria-pressed="false">Isolate selected</button><button id="referenceRestore">Restore model</button></div><label>Presentation clip height <input id="referenceClip" type="range" min="0" max="1.9" step="0.01" value="1.9"></label><p>Clipping removes presentation fragments only; no cut cap or source geometry change. Smooth surfaces only; no acquired voxel volume.</p><output id="referenceState" hidden></output>`;

  document.querySelector('#sliceMount')!.append(panel);const get=(id:string)=>panel.querySelector('#'+id) as any;

  const explanation=panel.querySelector('p')!;explanation.textContent=manifest.provenance.description;

  const attribution=document.createElement('p');attribution.textContent=`${manifest.provenance.copyright??'Project-authored reference'} · ${manifest.provenance.license}`;panel.append(attribution);

  const opacity=document.createElement('label');opacity.innerHTML='Selected opacity gain <input id="referenceOpacity" type="range" min="0.05" max="1" step="0.05" value="1">';panel.querySelector('.camera-actions')!.before(opacity);
  const appearance=document.createElement('label');appearance.innerHTML='Surface presentation <select id="referenceAppearance"><option value="source">Source colors · studio light</option><option value="cyan">Cyan glass · illustrative palette</option></select>';opacity.before(appearance);
  const appearanceNote=document.createElement('p');appearanceNote.className='help-copy';appearanceNote.textContent='Lighting, tint and translucency are presentation only. They do not represent tissue properties or added anatomical evidence.';appearance.after(appearanceNote);
  const context=document.createElement('label');context.className='context-control';context.innerHTML='<input id="referenceContext" type="checkbox" checked> Soften context around selection';appearanceNote.after(context);
  get('referenceContext').onchange=()=>{state.context=get('referenceContext').checked;refresh();};
  function applyAppearance(){
    const cyan=state.appearance==='cyan';
    for(const [m,f] of sourceFactors){m.baseColorFactor=cyan&&m!==selectedMaterial?[.2,.78,.9,f.color[3]]:[...f.color];m.roughnessFactor=cyan ? .4 : f.roughness;m.metallicFactor=cyan ? .08 : f.metallic;markMaterialUboDirty(m);}
    refresh();
  }
  get('referenceAppearance').onchange=()=>{state.appearance=get('referenceAppearance').value;applyAppearance();};

  get('referenceClip').min=String(manifest.reference.presentation?.clip_min??-.1);get('referenceClip').max=String(clipMax);get('referenceClip').value=String(clipMax);

  const card=document.createElement('div');card.className='selection-card';card.id='referenceSelectionInfo';card.setAttribute('role','status');panel.querySelector('h2')!.after(card);

  const search=document.createElement('label');search.innerHTML='Find anatomy <input id="referenceSearch" type="search" placeholder="Heart, lung, FMA identity - " autocomplete="off">';get('referenceRegion').parentElement.before(search);

  const sourceDetails=document.createElement('details');sourceDetails.innerHTML='<summary>Reference source & limitations</summary>';sourceDetails.append(explanation,attribution);panel.append(sourceDetails);

  panel.querySelector('h2')!.textContent='Anatomy explorer';
  const learning=document.createElement('details');learning.id='referenceLearning';learning.innerHTML='<summary>Understand this view</summary><div class="learning-copy"></div>';card.after(learning);

  // UX-002: move existing controls, keeping their handlers and shared state.
  const selectionLabel=get('referenceSelect').parentElement;
  selectionLabel.firstChild.textContent='Select anatomy ';card.after(selectionLabel);
  const actions=panel.querySelector('.camera-actions')!;actions.id='referenceActions';
  actions.setAttribute('role','group');actions.setAttribute('aria-label','Selected anatomy actions');selectionLabel.after(actions);
  const interactionHint=document.createElement('p');interactionHint.id='referenceInteractionHint';interactionHint.className='help-copy';
  interactionHint.textContent='Choose from the list or click exposed anatomy. Skin uses the list. Isolation stays on until you turn it off or restore the model.';
  actions.after(interactionHint);get('referenceSelect').setAttribute('aria-describedby',interactionHint.id);get('referenceIsolate').setAttribute('aria-describedby',interactionHint.id);
  get('referenceRestore').textContent='Restore full model';get('referenceRestore').title='Show all structures and reset appearance, opacity, clipping and camera';




  for(const region of [...new Set(parts.map((p:any)=>p.region))])get('referenceRegion').add(new Option(String(region),String(region)));

  function options(){get('referenceSelect').replaceChildren(new Option('Choose a structure',''));for(const p of parts)if((!get('referenceRegion').value||p.region===get('referenceRegion').value)&&(!get('referenceSearch').value||`${p.label} ${p.id}`.toLowerCase().includes(get('referenceSearch').value.toLowerCase())))get('referenceSelect').add(new Option(p.label,p.id));get('referenceSelect').value=state.selected||'';}

  function refresh(){

    for(const [id,list] of groups)for(const m of list){m.visible=!state.hidden.has(id)&&(!state.isolate||id===state.selected);m.material=id===state.selected?selectedMaterial:originals.get(m);m.material.alpha=(initialAlpha.get(originals.get(m))??1)*(state.opacity.get(id)??1)*(state.context&&state.selected&&id!==state.selected&&!state.isolate ? .28 : 1);}

    // Optional visual projection follows existing semantic/material state; absent by default.
    // WHY: public reference effects reuse this controller, including female mesh groups.
    // INVARIANT: projection may change display only; original source/state ownership stays here.
    projection?.({state,groups,originals});
    const selectedPart=parts.find((p:any)=>p.id===state.selected);card.replaceChildren();const title=document.createElement('strong');title.textContent=selectedPart?.label||'Complete reference anatomy';const detail=document.createElement('small');detail.textContent=selectedPart?`${selectedPart.id}  -  ${selectedPart.region}  -  ${state.hidden.has(state.selected!)?'hidden':'visible'}`:`${parts.length} selectable structures  -  ${manifest.reference.id==='BODY-HRA-F-001'?'HRA female reference subset':manifest.reference.variant==='female'?'Synthetic fallback - not a female atlas':'BodyParts3D adult male reference'}`;card.append(title,detail);
    const lesson=referenceLesson(manifest,selectedPart,state);learning.querySelector('summary')!.textContent=lesson.title;const copy=learning.querySelector('div')!;copy.replaceChildren();for(const [name,text] of [['KNOWN',lesson.known],['PRESENTATION',lesson.presentation],['UNVERIFIED',lesson.unverified],['ATTRIBUTION',lesson.credit]]){const p=document.createElement('p');const label=document.createElement('strong');label.textContent=name+' ';p.append(label,document.createTextNode(text));copy.append(p);}if(lesson.source?.startsWith('https://')){const link=document.createElement('a');link.href=lesson.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent='View original source and attribution';copy.append(link);}


    get('referenceIsolate').setAttribute('aria-pressed',String(state.isolate));for(const id of ['referenceHide','referenceShow','referenceIsolate'])get(id).disabled=!state.selected;

    get('referenceSelect').value=state.selected||'';for(const material of materials)markMaterialUboDirty(material);framing?.sync();if(framing)(document.querySelector('#cameraFocus') as HTMLElement).textContent='Focus selected structure';

    get('referenceOpacity').disabled=!state.selected;get('referenceOpacity').value=state.selected?(state.opacity.get(state.selected)??1):1;

    visibilityButton.textContent=state.hidden.size===parts.length?'Show all structures':'Hide all structures';status.textContent=`Generalized adult ${manifest.reference.variant} · ${manifest.reference.id==='BODY-DEFAULT-BP3D-01'?'BodyParts3D reference anatomy':manifest.reference.id==='BODY-HRA-F-001'?'HRA female reference anatomy':'synthetic fallback'}\n${parts.find((p:any)=>p.id===state.selected)?.label||'Complete reference body'} · reference presentation, not patient anatomy`;

    get('referenceState').textContent=JSON.stringify({referenceId:manifest.reference.id,variant:manifest.reference.variant,appearance:state.appearance,context:state.context,selected:state.selected,isolate:state.isolate,hidden:[...state.hidden],clip:state.clip,opacity:Object.fromEntries(state.opacity),parts:parts.map((p:any)=>({id:p.id,visible:groups.get(p.id)!.every(m=>m.visible),canvasPickable:groups.get(p.id)!.some(m=>m.visible&&!skinMeshes.has(m)),worldMatrices:groups.get(p.id)!.map(m=>Array.from(m.worldMatrix))})),cost:manifest.cost});

  }

  // A display clip/visibility intent also supersedes an in-flight visual-mode pick.
  // The inherited controller path is unchanged when no projection is attached.
  for(const [id,event] of [['referenceHide','click'],['referenceShow','click'],['referenceIsolate','click'],['referenceClip','input']])
    get(id).addEventListener(event,()=>{if(projection)picks.invalidate();},{capture:true,signal:diagnosticAbort.signal});

  get('referenceSearch').oninput=options;get('referenceRegion').onchange=options;get('referenceSelect').onchange=()=>{picks.invalidate();state.selected=get('referenceSelect').value||null;if(!state.selected)state.isolate=false;refresh();};

  get('referenceHide').onclick=()=>{if(state.selected)state.hidden.add(state.selected);refresh();};get('referenceShow').onclick=()=>{if(state.selected)state.hidden.delete(state.selected);refresh();};

  get('referenceIsolate').onclick=()=>{state.isolate=!state.isolate;if(state.selected)state.hidden.delete(state.selected);refresh();};

  get('referenceClip').oninput=()=>{state.clip=Number(get('referenceClip').value);refresh();};

  get('referenceOpacity').oninput=()=>{if(state.selected)state.opacity.set(state.selected,Number(get('referenceOpacity').value));refresh();};

  get('referenceRestore').onclick=()=>{picks.invalidate();state.appearance='source';state.context=true;get('referenceContext').checked=true;get('referenceAppearance').value='source';applyAppearance();state.selected=null;state.hidden.clear();state.isolate=false;state.clip=clipMax;state.opacity.clear();get('referenceClip').value=String(clipMax);get('referenceRegion').value='';get('referenceSearch').value='';options();refresh();framing?.restore();visibilityButton.textContent='Hide all structures';};

  visibilityButton.textContent='Hide all structures';visibilityButton.onclick=()=>{if(projection)picks.invalidate();if(state.hidden.size===parts.length)state.hidden.clear();else for(const p of parts)state.hidden.add(p.id);state.isolate=false;visibilityButton.textContent=state.hidden.size?'Show all structures':'Hide all structures';refresh();};

  // WHY: release-generated background misses must not exit explicit isolation.
  // BOUNDARY/INVARIANT: only reference selection; geometry stays frozen.
  // EVIDENCE: UX-INTERACTION-001 receipt. REGRESSION: Clear/dropdown/Restore still exit.
  const api={active:true,groups:()=>new Map([...groups].map(([id,list])=>[id,[...list]])),originals:()=>new Map(originals),state:()=>({...state,hidden:new Set(state.hidden),opacity:new Map(state.opacity)}),setProjection(fn:((detail:any)=>void)|null){projection=fn;refresh();},setAppearance(value:string){if(!['source','cyan'].includes(value))throw Error('Unknown source appearance');state.appearance=value;get('referenceAppearance').value=value;applyAppearance();},invalidatePick:()=>picks.invalidate(),meshes:()=>[...originals.keys()],selectedMeshes:()=>state.selected?(groups.get(state.selected)||[]).filter(m=>m.visible):[],setFraming(f:any){framing=f;refresh();},canPick:(m:any)=>originals.has(m)&&m.visible&&!skinMeshes.has(m),pick:(request:()=>Promise<any>)=>picks.run(request,(pick:any)=>api.selectMesh(pick.hit?pick.pickedMesh:null)),selectMesh(m:any){if(!m&&state.isolate&&state.selected)return;state.selected=[...groups].find(([,list])=>list.includes(m))?.[0]||null;if(!state.selected)state.isolate=false;get('referenceRegion').value='';options();refresh();},clear(){picks.invalidate();state.selected=null;state.isolate=false;refresh();},dispose(){projection=null;picks.dispose();diagnosticAbort.abort();for(const texture of retainedTextures)releaseTexture(texture);panel.remove();},refresh};

  if(new URLSearchParams(location.search).has('diagnostics')){const output=document.createElement('output');output.id='referenceRenderState';output.hidden=true;panel.append(output);let frames=0;const errors:string[]=[];const engine=scene.surface.engine;const capture=()=>{const c=scene.camera;output.textContent=JSON.stringify({frames,drawCalls:engine.drawCallCount,retainedTextures:retainedTextures.length,renderables:scene._renderables.length,queuedSwaps:scene._materialSwapQueue.length,errors,camera:c?{alpha:c.alpha,beta:c.beta,radius:c.radius,target:[c.target.x,c.target.y,c.target.z],near:c.nearPlane,far:c.farPlane}:null,materials:[...groups].map(([id,list])=>({id,visible:list[0].visible,alpha:list[0].material.alpha,color:list[0].material.baseColorFactor,original:list[0].material===originals.get(list[0])}))});};onBeforeRender(scene,()=>{frames++;capture();});window.addEventListener('error',e=>{errors.length<8&&errors.push(String(e.error?.stack||e.message));capture();},{signal:diagnosticAbort.signal});engine._device.addEventListener('uncapturederror',(e:any)=>{errors.length<8&&errors.push(String(e.error?.message));capture();},{signal:diagnosticAbort.signal});}

  options();refresh();return {...api,cameraPresentation:manifest.reference.id==='BODY-DEFAULT-BP3D-01'?ATLAS_CAMERA_PRESENTATION:manifest.reference.id==='BODY-HRA-F-001'?HRA_FEMALE_CAMERA_PRESENTATION:null};

}

