import {
  addToScene,
  attachControl,
  createDefaultCamera,
  createEngine,
  createGpuPicker,
  createSceneContext,
  getMeshTriangles,
  loadGltf,
  pickAsync,
  registerScene,
  resizeEngine,
  setSubtreeVisible,
  startEngine, stopEngine, disposeEngine, disposeScene, disposePicker,
} from '@babylonjs/lite';
import { createPresentation } from './presentation';
import { FIXTURE_ID, FIXTURE_SHA } from './slices.mjs';
import { prepareCamera } from './camera-ui';
import { STUDY_WORLD } from './ct-volume-core.mjs';
import { prepareExperience } from './experience';
import {assertRenderer,rendererRequest,type RendererId} from './renderer-contract';
import {requireVolumeRenderer,NATIVE_VOLUME_PROFILE} from './imaging-renderer-capabilities.mjs';
import {imagingCapabilities,requireClassicCt,isVerifiedVolume,verifyVolume,verifiedManifest} from './verified-volume.mjs';
import {installRendererSelector} from './renderer-development';

type Manifest = {
  structure: { semantic_id: string };
  asset: { relative_filename: string; sha256: string; model_space: string; units: string };
};

const experience = prepareExperience();
const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas')!;
const status = document.querySelector<HTMLElement>('#status')!;
const manifestInput = document.querySelector<HTMLInputElement>('#manifestFile')!;
const glbInput = document.querySelector<HTMLInputElement>('#glbFile')!;
const visibilityButton = document.querySelector<HTMLButtonElement>('#visibilityButton')!;
const clearButton = document.querySelector<HTMLButtonElement>('#clearButton')!;
const publicFileImportsDisabled=import.meta.env.MODE==='safe-reference-demo';
let generation = 0;
let verifiedImportGeneration=0;
let verifiedAdmissionAbort:AbortController|null=null;
let createdEngines=0,disposedEngines=0;
const privateVolumeDevelopment=import.meta.env.DICOM3D_PRIVATE_VOLUME_DEV===true;
const privateRendererDevelopment=import.meta.env.DICOM3D_PRIVATE_RENDERER_DEV===true;
let selectedRenderer:RendererId='babylon';
let replay:null|{manifestFile:File;glbFile?:File;options:any}=null;
let rendererLastAssessment:any=null;
const rendererTransitions:any[]=[];

let closeWorkspace: null | (()=>Promise<void>) = null;
let nativeSessionControl:any=null;
const ctOnly=document.createElement('button');ctOnly.id='openCtWorkspace';ctOnly.textContent='Open local CT workspace without GLB';glbInput.parentElement!.append(ctOnly);
// WHY: hidden controls still accept scripted change events. BOUNDARY: only the
// private entry binds local imports; public references/curated study use their
// pinned loader. INVARIANT: unload never re-enables these public inputs.
if(!publicFileImportsDisabled)ctOnly.onclick=async()=>{if(manifestInput.files?.[0])await loadFiles(manifestInput.files[0]);else status.textContent='Choose the accepted local study manifest first.';};
else {manifestInput.disabled=glbInput.disabled=ctOnly.disabled=true;ctOnly.hidden=true;}
const closeButton=document.createElement('button');closeButton.id='closeWorkspace';closeButton.textContent='Close local workspace';closeButton.hidden=true;ctOnly.after(closeButton);closeButton.onclick=unloadWorkspace;
export async function unloadWorkspace(options:any={}){generation++;verifiedImportGeneration++;verifiedAdmissionAbort?.abort();delete (window as any).__verifiedCt;if(!options.preserveReplay)replay=null;await nativeSessionControl?.dispose();nativeSessionControl=null;await closeWorkspace?.();closeWorkspace=null;manifestInput.value=glbInput.value='';manifestInput.disabled=glbInput.disabled=ctOnly.disabled=publicFileImportsDisabled;closeButton.hidden=true;visibilityButton.disabled=clearButton.disabled=true;status.textContent='Workspace closed; local rendering resources disposed.';document.dispatchEvent(new CustomEvent('dicom3d-workspace-change',{detail:{kind:'empty'}}));return {createdEngines,disposedEngines,activeEngines:createdEngines-disposedEngines};}

async function sha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function showError(error: unknown) {
  status.textContent = `Unable to load structure: ${String(error)}\nPresentation only; research software, not for clinical use.`;
}

async function loadSelectedFiles() {
  if (!manifestInput.files?.[0] || !glbInput.files?.[0]) {
    status.textContent = 'Choose a manifest and its matching GLB. No example medical data is bundled.';
    return;
  }
  await loadFiles(manifestInput.files[0], glbInput.files[0]);
}

// Shared input seam: the installable viewer supplies local files; the safe demo
// supplies only its explicitly admitted reference assets. Rendering is shared.
export async function loadFiles(manifestFile: File, glbFile?: File, options:any = {}) {
  const currentGeneration = ++generation;
  let constructionCleanup:null|(()=>Promise<void>)=null;
  visibilityButton.disabled = true;
  clearButton.disabled = true;

  try {
    status.textContent = 'Reading manifest…';
    const manifest = JSON.parse(await manifestFile.text()) as Manifest;
    const verifiedVolume=privateVolumeDevelopment&&isVerifiedVolume(options.verifiedVolume)?options.verifiedVolume:null;
    if(verifiedVolume&&JSON.stringify(manifest)!==JSON.stringify(verifiedManifest(verifiedVolume)))throw Error('Verified source/manifest mismatch');
    if (!manifest.structure?.semantic_id || (!verifiedVolume&&(!manifest.asset?.sha256 || !manifest.asset?.relative_filename))) {
      throw new Error('Manifest is missing structure identity or asset metadata.');
    }
    const publicVisualEnabled=import.meta.env.MODE==='safe-reference-demo';
    const publicStudy=publicVisualEnabled&&import.meta.env.DICOM3D_PUBLIC_STUDY?options.publicStudy:null;
    const hasCt=Boolean(verifiedVolume||publicStudy||((manifest as any).provenance?.B_evidence?.sha256 && (manifest as any).provenance?.B_volume?.sha256));
    if(!glbFile&&!hasCt)throw Error('CT-only workspace requires an accepted CT manifest.');
    if(hasCt)requireClassicCt();
    if(verifiedVolume)requireVolumeRenderer(verifiedVolume.descriptor,{backend:selectedRenderer,...(selectedRenderer==='native'?{profile:NATIVE_VOLUME_PROFILE}:{})});
    if (glbFile && glbFile.name !== manifest.asset.relative_filename) {
      throw new Error(`Expected ${manifest.asset.relative_filename}; selected ${glbFile.name}.`);
    }

    const glbBytes = glbFile ? await glbFile.arrayBuffer() : null;
    if (glbBytes && (await sha256(glbBytes)).toLowerCase() !== manifest.asset.sha256.toLowerCase()) {
      throw new Error('GLB SHA-256 does not match the manifest.');
    }
    if (currentGeneration !== generation) return;
    if(!verifiedVolume)experience.describeSource(manifest);else document.querySelector('#sourceMetadata')!.textContent='Verified acquired CT; source identities and matrices in acquired-frame inspector. Source mm; model metres. No segmentation admitted.';

    const rendererIntent=options.getRendererIntent?.()??{mode:'holographic'};
    status.textContent = 'Creating WebGPU scene…';
    await nativeSessionControl?.dispose();nativeSessionControl=null;
    await closeWorkspace?.();
    closeWorkspace=null;delete (window as any).__verifiedCt;
    // Verified source request crosses the renderer gate before any engine is constructed.
    if(privateRendererDevelopment){
      replay={manifestFile,glbFile,options};
      const request=verifiedVolume?Object.freeze({kind:'study' as const,presentation:rendererIntent.mode,semanticId:manifest.structure.semantic_id,sourceSha256:verifiedVolume.descriptor.payload.sha256,units:'metre',required:['responsive-main-canvas','owned-start-stop-dispose','verified-multi-sop-ct','signed-source-sampling','source-plane-window','physical-volume-mapping']}):rendererRequest(manifest,hasCt,rendererIntent.mode);
      rendererLastAssessment={selected:selectedRenderer,request};
      try{assertRenderer(selectedRenderer,request);rendererLastAssessment.supported=true;}
      catch(error){rendererLastAssessment.supported=false;rendererLastAssessment.error=String(error);throw error;}
    }
    if(privateRendererDevelopment&&selectedRenderer==='native'){
      let native:any;
      if(manifest.reference){native=await (await import('./native-reference-view')).createNativeReferenceView({canvas,manifest,glbBytes,workspace:currentGeneration,onIntent:options.onIntent});}
      else{if(!hasCt||rendererIntent.mode!=='scientific')throw Error('Native scientific CT request required');native=await (await import('./native-scientific-view')).createNativeScientificView({canvas,manifest,glbBytes,study:publicStudy??options.workstationStudy,verifiedVolume,intent:rendererIntent,workspace:currentGeneration,onSelect:(value:boolean)=>options.onSelect?.(value),onIntent:options.onIntent});}
      const cleanup=()=>native.dispose();constructionCleanup=cleanup;
      if(currentGeneration!==generation){await cleanup();return false;}nativeSessionControl=native;closeWorkspace=async()=>{await cleanup();options.onDispose?.();};
      visibilityButton.disabled=!glbBytes;clearButton.disabled=!glbBytes;if(native.controller)clearButton.onclick=()=>native.controller.clear();else{visibilityButton.onclick=()=>{const visible=!native.visual.snapshot().visible;native.visual.visible(visible);visibilityButton.textContent=visible?'Hide structure':'Show structure';};clearButton.onclick=()=>native.selectStudy(false);}
      ctOnly.disabled=true;manifestInput.disabled=glbInput.disabled=true;closeButton.hidden=false;
      document.dispatchEvent(new CustomEvent('dicom3d-workspace-change',{detail:{kind:manifest.reference?'reference':'study',semanticId:manifest.structure.semantic_id,referenceId:manifest.reference?.id??null,privateVerified:Boolean(verifiedVolume)}}));
      await options.onReady?.(native);return true;
    }
    const engine = await createEngine(canvas,hasCt||publicVisualEnabled?{maxDevicePixelRatio:1,msaaSamples:1}:undefined);
    createdEngines++;
    // Each acquired resource has a teardown before the next awaited boundary.
    // Failed or superseded construction disposes only this owner, never a newer scene.
    const teardown:(()=>any)[]=[()=>{disposeEngine(engine);disposedEngines++;}];
    let released=false;
    const cleanup=async()=>{if(released)return;released=true;stopEngine(engine);const failures=[];for(const dispose of teardown.reverse()){try{await dispose();}catch(e){failures.push(e);}}if(failures.length)console.error('Workspace disposal',failures);};
    constructionCleanup=cleanup;
    if(currentGeneration!==generation){await cleanup();return false;}
    const scene = createSceneContext(engine,hasCt?{defaultRenderTask:false}:undefined);
    teardown.push(()=>disposeScene(scene));
    scene.clearColor = { r: 0.035, g: 0.055, b: 0.075, a: 1 };
    const container = glbBytes ? await loadGltf(engine, glbBytes) : null;
    const nodes: any[] = [];
    const visit = (node: any) => {
      nodes.push(node);
      for (const child of node.children || []) visit(child);
    };
    container?.entities.forEach(visit);
    const semanticNode = nodes.find((node) => node.name === manifest.structure.semantic_id);
    if (glbBytes && !semanticNode) throw new Error(`GLB does not contain semantic node ${manifest.structure.semantic_id}.`);
    const semanticExtras = semanticNode?.metadata?.gltf?.extras;
    if (semanticExtras?.semanticId && semanticExtras.semanticId !== manifest.structure.semantic_id) {
      throw new Error('GLB semantic extras do not match the manifest.');
    }

    const meshes: any[] = [];
    const findMeshes = (node: any) => {
      if (getMeshTriangles(node)) meshes.push(node);
      for (const child of node.children || []) findMeshes(child);
    };
    if(semanticNode)findMeshes(semanticNode);
    if(container)addToScene(scene, container);
    const presentation = createPresentation(scene, ['BODY-DEFAULT-SYNTH-01','BODY-DEFAULT-BP3D-01','BODY-HRA-F-001'].includes((manifest as any).reference?.id));
    const sliceController = manifest.structure.semantic_id === FIXTURE_ID && manifest.asset.sha256 === FIXTURE_SHA
      ? await (await import('./slice-ui')).prepareSlices({engine,scene,sourceNode:semanticNode,sourceMeshes:meshes,glbBytes,canvas,status,visibilityButton,onOriginal:()=>display()})
      : null;
    const referenceController=['BODY-DEFAULT-SYNTH-01','BODY-DEFAULT-BP3D-01','BODY-HRA-F-001'].includes((manifest as any).reference?.id)
      ? (await import('./reference-ui')).prepareReference({scene,root:semanticNode,manifest,status,selectedMaterial:presentation.selectedMaterial,visibilityButton}) : null;
    teardown.push(()=>referenceController?.dispose());
    const camera = createDefaultCamera(scene);
    camera.alpha = -Math.PI / 2;
    camera.beta = Math.PI / 2.35;
    camera.radius *= 1.25;
    let ctController:any=null;
    const framing=prepareCamera({camera,canvas,sourceMeshes:meshes,sliceController:referenceController??sliceController,additionalBounds:()=>ctController?.bounds()??[],presentation:referenceController?.cameraPresentation,refitOnResize:!publicVisualEnabled});
    teardown.push(()=>framing.dispose());
    experience.connectControls();
    sliceController?.setFraming(framing);
    referenceController?.setFraming(framing);
    let resourceOutput:HTMLOutputElement|null=null;
    if(referenceController){resourceOutput=document.createElement('output');resourceOutput.id='workspaceResourceState';resourceOutput.hidden=true;canvas.after(resourceOutput);resourceOutput.textContent=JSON.stringify({createdEngines,disposedEngines,activeEngines:createdEngines-disposedEngines,geometryLogicalBytes:(manifest as any).cost.geometry_buffer_bytes});}
    teardown.push(()=>resourceOutput?.remove());
    const visual=publicVisualEnabled?(verifiedVolume?await (await import('./verified-study-visual')).createVerifiedStudyVisual({engine,scene,camera,canvas,manifest,verifiedVolume}):(referenceController
      ?(await import('./public-reference-visual')).createPublicReferenceVisual({engine,scene,camera,canvas,manifest,controller:referenceController})
      :import.meta.env.DICOM3D_PUBLIC_STUDY&&publicStudy?(await import('./public-study-visual')).createPublicStudyVisual({engine,scene,camera,canvas,meshes,semantic:semanticNode,manifest}):null)):null;
    teardown.push(()=>visual?.dispose());
    let input:any=null,resize:ResizeObserver|null=null,pickRevision=0;
    let detachCamera = publicVisualEnabled?()=>{}:attachControl(camera, canvas, scene);
    teardown.push(()=>detachCamera());
    let cameraEnabled = true;
    sliceController?.setCameraControls((enabled:boolean)=>{
      if(enabled===cameraEnabled)return;
      detachCamera();cameraEnabled=enabled;
      if(enabled)detachCamera=attachControl(camera,canvas,scene);
    });
    if(hasCt&&!publicStudy&&!publicVisualEnabled)ctController=(await import('./ct-ui')).prepareLocalCt(manifest,{verifiedVolume,engine,scene,camera,canvas,sourceMeshes:meshes,framing,studyWorld:meshes[0]??{worldMatrix:STUDY_WORLD},selectStructure:()=>{if(!semanticNode)return;selected=true;for(const mesh of meshes)mesh.material=presentation.selectedMaterial;display();}});
    teardown.push(()=>ctController?.dispose());
    if(currentGeneration!==generation){await cleanup();return false;}
    await registerScene(scene);
    visual?.activate();
    await ctController?.start();
    if(currentGeneration!==generation){await cleanup();return false;}
    if(verifiedVolume&&ctController)(window as any).__verifiedCt={descriptor:verifiedVolume.descriptor,pixels:verifiedVolume.pixels,assertSourceUnchanged:()=>verifiedVolume.assertSourceUnchanged(),diagnostic:()=>ctController.volume.diagnostic(),async captureSummary(){const s=await ctController.volume.capture();let nonBackground=0,alphaErrors=0;const first=Array.from(s.data.slice(0,3));for(let i=0;i<s.data.length;i+=4){if(Math.abs(s.data[i]-first[0])+Math.abs(s.data[i+1]-first[1])+Math.abs(s.data[i+2]-first[2])>3)nonBackground++;if(s.data[i+3]!==255)alphaErrors++;}return {width:s.width,height:s.height,nonBackground,alphaErrors,sha256:await sha256(s.data.buffer)};}};

    await startEngine(engine);

    let visible = true;
    let selected = false;
    const picker = createGpuPicker(scene);
    teardown.push(()=>disposePicker(picker));
    if(!referenceController&&!visual)for (const mesh of meshes) mesh.material = presentation.material;
    const display = () => {
      ctController?.selection(selected);
      visual?.select?.(selected);
      options.onSelect?.(selected);
      visibilityButton.textContent = visible ? 'Hide structure' : 'Show structure';
      if(!semanticNode){status.textContent=verifiedVolume?'Verified acquired CT workspace; no segmentation admitted. Original source values and coordinates preserved.':'Local CT workspace · no lesion GLB loaded. Choose the accepted CT receipt and volume.';return;}
      status.textContent = `${selected ? 'Selected' : 'Loaded'} · ${manifest.structure.semantic_id} · ${visible ? 'visible' : 'hidden'}\n${verifiedVolume?'source patient/model':manifest.asset.model_space} · ${verifiedVolume?'metre':manifest.asset.units} · Presentation only; no clinical meaning.`;
    };
    const pickClick=async (event:MouseEvent) => {
      const revision=++pickRevision;
      if(sliceController?.consumeDragClick())return;
      const rect = canvas.getBoundingClientRect();
      const request = () => pickAsync(picker, event.clientX - rect.left, event.clientY - rect.top, {
        filter: (mesh: any) => visual?visual.pickAllowed(mesh):referenceController ? referenceController.canPick(mesh) : sliceController?.active ? sliceController.canPick(mesh) : visible && meshes.includes(mesh),
        ...(visual?{discard:visual.pickDiscard()}:{}),
      });
      if(referenceController){await referenceController.pick(request);return;}
      const pick = await request();
      if(revision!==pickRevision||currentGeneration!==generation)return;
      if(sliceController?.active){sliceController.selectMesh(pick.hit?pick.pickedMesh:null);return;}
      selected = Boolean(pick.hit && meshes.includes(pick.pickedMesh));
      if(!visual)for (const mesh of meshes) mesh.material = selected ? presentation.selectedMaterial : presentation.material;
      display();
    };
    if(publicVisualEnabled){
      const {bindViewportControls}=await import('./viewport-controls.mjs');
      input=bindViewportControls({camera,canvas,scene,attachControl,onIntent:()=>{pickRevision++;referenceController?.invalidatePick();options.onIntent?.();},onTap:pickClick});
      resize=new ResizeObserver(()=>{resizeEngine(engine);input.resize();});resize.observe(canvas);
    }else canvas.addEventListener('click',pickClick);
    teardown.push(()=>{pickRevision++;input?.dispose();resize?.disconnect();canvas.removeEventListener('click',pickClick);options.onDispose?.();});
    if(currentGeneration!==generation){await cleanup();return false;}
    closeWorkspace=cleanup;
    if(!referenceController)visibilityButton.onclick = () => {
      pickRevision++;
      visible = !visible;
      setSubtreeVisible(semanticNode, visible);
      visual?.visible?.(visible);
      display();
    };
    clearButton.onclick = () => {
      pickRevision++;
      if(referenceController){referenceController.clear();return;}
      if(sliceController?.active){sliceController.clear();return;}
      selected = false;
      if(!visual)for (const mesh of meshes) mesh.material = presentation.material;
      display();
    };
    visibilityButton.disabled = !semanticNode;
    clearButton.disabled = !semanticNode;
    ctOnly.disabled=true;closeButton.hidden=!hasCt;
    manifestInput.disabled = true;
    glbInput.disabled = true;
    display();
    referenceController?.refresh();
    document.dispatchEvent(new CustomEvent('dicom3d-workspace-change',{detail:{kind:referenceController?'reference':'study',semanticId:manifest.structure.semantic_id,referenceId:(manifest as any).reference?.id??null}}));
    await options.onReady?.({visual,manifest,controller:referenceController,framing,study:publicStudy??options.workstationStudy,
      selectStudy(value:boolean){pickRevision++;selected=value;display();},
      invalidatePick(){pickRevision++;referenceController?.invalidatePick();},
      snapshot(){return {createdEngines,disposedEngines,activeEngines:createdEngines-disposedEngines,input:input?.snapshot(),visual:visual?.snapshot(),camera:{alpha:camera.alpha,beta:camera.beta,radius:camera.radius,target:[camera.target.x,camera.target.y,camera.target.z]},canvas:{width:canvas.width,height:canvas.height}};}
    });
    return true;

  } catch (error) {
    if(constructionCleanup){await constructionCleanup();if(closeWorkspace===constructionCleanup)closeWorkspace=null;}
    if (currentGeneration === generation) showError(error);
    return false;
  }
}

if(!publicFileImportsDisabled){
  manifestInput.addEventListener('change', loadSelectedFiles);
  glbInput.addEventListener('change', loadSelectedFiles);
}

// Private selector changes renderer ownership, never the source or existing panel UI.
installRendererSelector({enabled:privateRendererDevelopment,
 snapshot:()=>({selected:selectedRenderer,default:'babylon',createdEngines,disposedEngines,activeEngines:createdEngines-disposedEngines,nativeFactoryRegistered:false,assessment:rendererLastAssessment,transitions:rendererTransitions.slice(-8)}),
 async switchTo(id:RendererId){
  if(id===selectedRenderer)return {unchanged:true};
  const request=replay;const before={selected:selectedRenderer,createdEngines,disposedEngines};
  const disposed=await unloadWorkspace({preserveReplay:true});
  if(disposed.activeEngines!==0)throw Error('Previous renderer ownership did not close');
  selectedRenderer=id;rendererTransitions.push({from:before.selected,to:id,previousActiveAfterClose:disposed.activeEngines});
  const loaded=request?await loadFiles(request.manifestFile,request.glbFile,request.options):false;
  return {loaded,selected:selectedRenderer,createdEngines,disposedEngines,assessment:rendererLastAssessment};
 }});

// Development-only verified source ingress. Existing workstation canvas/controllers own rendering.
if(privateVolumeDevelopment&&!publicFileImportsDisabled){
 (window as any).__imagingAdmission=Object.freeze({apiVersion:1,capabilities:imagingCapabilities()});
 const panel=document.createElement('details');panel.id='verifiedVolumeImport';panel.open=true;panel.innerHTML='<summary>Verified CT volume · private development</summary><label>Verified descriptor <input id="verifiedDescriptor" type="file" accept=".json"></label><label>Decoded stored values <input id="verifiedPixels" type="file" accept=".bin"></label><button id="verifiedLoad" type="button">Open verified CT</button><output id="verifiedLoadState" hidden></output>';document.querySelector('#sourceMount')!.prepend(panel);
 const button=panel.querySelector<HTMLButtonElement>('#verifiedLoad')!,out=panel.querySelector('output')!;
 button.onclick=async()=>{const token=++verifiedImportGeneration;verifiedAdmissionAbort?.abort();const abort=verifiedAdmissionAbort=new AbortController();button.disabled=true;out.textContent='';try{const a=panel.querySelector<HTMLInputElement>('#verifiedDescriptor')!.files?.[0],b=panel.querySelector<HTMLInputElement>('#verifiedPixels')!.files?.[0];if(!a||!b||a.size>1024*1024||b.size>80*1024*1024)throw Error('Verified input bounds');const v=await verifyVolume(JSON.parse(await a.text()),await b.arrayBuffer(),{signal:abort.signal});if(token!==verifiedImportGeneration)return;const loaded=await loadFiles(new File([JSON.stringify(verifiedManifest(v))],'verified-volume.json'),undefined,{verifiedVolume:v});out.textContent=JSON.stringify({loaded:Boolean(loaded),shape:v.descriptor.shape});}catch(error){out.textContent=JSON.stringify({loaded:false,error:String(error),reason:(error as any)?.toJSON?.()??null});}finally{if(verifiedAdmissionAbort===abort)verifiedAdmissionAbort=null;button.disabled=false;}};
}

// Phase1 owning-socket qualification inside the actual Safe Demo. This does not register
// source rendering or bypass the existing native capability gate.
if(privateRendererDevelopment)(window as any).__dicom3dNativeSessionDevelopment={
 async create(){await unloadWorkspace();const {createNativeSession}=await import('./native-session');const ownerGeneration=generation,candidate=await createNativeSession({canvas,moduleUrl:new URL(import.meta.env.BASE_URL+'native/session.mjs',location.href),stamp:{workspace:ownerGeneration,source:null,view:0,extent:0}});if(ownerGeneration!==generation){await candidate.dispose();throw Object.assign(Error('STALE_NATIVE_OWNER'),{snapshot:candidate.snapshot()});}nativeSessionControl=candidate;status.textContent='Native Wasm64 supplied-canvas session control. Imaging/presentation operations unavailable until qualified.';return nativeSessionControl.snapshot();},
 closeWorkspace:()=>unloadWorkspace(),frame:()=>nativeSessionControl.renderFrame(),resize:(extent:any)=>nativeSessionControl.resize(extent),start:()=>nativeSessionControl.start(),stop:()=>nativeSessionControl.stop(),observeExtent:()=>nativeSessionControl.observeExtent(),snapshot:()=>nativeSessionControl?.snapshot()??null,
 stale:()=>nativeSessionControl.renderFrame({workspace:-1,source:null,view:0,extent:0}),unsupported:()=>nativeSessionControl.sourceFrame(),dispose(){return nativeSessionControl.dispose();}
};
