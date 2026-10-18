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
  setSubtreeVisible,
  startEngine, stopEngine, disposeEngine, disposeScene, disposePicker,
} from '@babylonjs/lite';
import { createPresentation } from './presentation';
import { FIXTURE_ID, FIXTURE_SHA } from './slices.mjs';
import { prepareCamera } from './camera-ui';
import { STUDY_WORLD } from './ct-volume-core.mjs';
import { prepareExperience } from './experience';

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
let generation = 0;
let createdEngines=0,disposedEngines=0;
let closeWorkspace: null | (()=>Promise<void>) = null;
const ctOnly=document.createElement('button');ctOnly.id='openCtWorkspace';ctOnly.textContent='Open local CT workspace without GLB';glbInput.parentElement!.append(ctOnly);
ctOnly.onclick=async()=>{if(manifestInput.files?.[0])await loadFiles(manifestInput.files[0]);else status.textContent='Choose the accepted local study manifest first.';};
const closeButton=document.createElement('button');closeButton.id='closeWorkspace';closeButton.textContent='Close local workspace';closeButton.hidden=true;ctOnly.after(closeButton);closeButton.onclick=unloadWorkspace;
export async function unloadWorkspace(){generation++;await closeWorkspace?.();closeWorkspace=null;manifestInput.value=glbInput.value='';manifestInput.disabled=glbInput.disabled=ctOnly.disabled=false;closeButton.hidden=true;visibilityButton.disabled=clearButton.disabled=true;status.textContent='Workspace closed; local rendering resources disposed.';document.dispatchEvent(new CustomEvent('dicom3d-workspace-change',{detail:{kind:'empty'}}));return {createdEngines,disposedEngines,activeEngines:createdEngines-disposedEngines};}

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
// supplies only its explicitly published synthetic fixture. Rendering is shared.
export async function loadFiles(manifestFile: File, glbFile?: File) {
  const currentGeneration = ++generation;
  visibilityButton.disabled = true;
  clearButton.disabled = true;

  try {
    status.textContent = 'Reading manifest…';
    const manifest = JSON.parse(await manifestFile.text()) as Manifest;
    if (!manifest.structure?.semantic_id || !manifest.asset?.sha256 || !manifest.asset?.relative_filename) {
      throw new Error('Manifest is missing structure identity or asset metadata.');
    }
    const hasCt=Boolean((manifest as any).provenance?.B_evidence?.sha256 && (manifest as any).provenance?.B_volume?.sha256);
    if(!glbFile&&!hasCt)throw Error('CT-only workspace requires an accepted CT manifest.');
    if (glbFile && glbFile.name !== manifest.asset.relative_filename) {
      throw new Error(`Expected ${manifest.asset.relative_filename}; selected ${glbFile.name}.`);
    }

    const glbBytes = glbFile ? await glbFile.arrayBuffer() : null;
    if (glbBytes && (await sha256(glbBytes)).toLowerCase() !== manifest.asset.sha256.toLowerCase()) {
      throw new Error('GLB SHA-256 does not match the manifest.');
    }
    if (currentGeneration !== generation) return;
    experience.describeSource(manifest);

    status.textContent = 'Creating WebGPU scene…';
    await closeWorkspace?.();
    closeWorkspace=null;
    const engine = await createEngine(canvas,hasCt?{maxDevicePixelRatio:1,msaaSamples:1}:undefined);
    createdEngines++;
    const scene = createSceneContext(engine,hasCt?{defaultRenderTask:false}:undefined);
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
    const camera = createDefaultCamera(scene);
    camera.alpha = -Math.PI / 2;
    camera.beta = Math.PI / 2.35;
    camera.radius *= 1.25;
    let ctController:any=null;
    const framing=prepareCamera({camera,canvas,sourceMeshes:meshes,sliceController:referenceController??sliceController,additionalBounds:()=>ctController?.bounds()??[],presentation:referenceController?.cameraPresentation});
    experience.connectControls();
    sliceController?.setFraming(framing);
    referenceController?.setFraming(framing);
    let resourceOutput:HTMLOutputElement|null=null;
    if(referenceController){resourceOutput=document.createElement('output');resourceOutput.id='workspaceResourceState';resourceOutput.hidden=true;canvas.after(resourceOutput);resourceOutput.textContent=JSON.stringify({createdEngines,disposedEngines,activeEngines:createdEngines-disposedEngines,geometryLogicalBytes:(manifest as any).cost.geometry_buffer_bytes});}
    let detachCamera = attachControl(camera, canvas, scene);
    let cameraEnabled = true;
    sliceController?.setCameraControls((enabled:boolean)=>{
      if(enabled===cameraEnabled)return;
      detachCamera();cameraEnabled=enabled;
      if(enabled)detachCamera=attachControl(camera,canvas,scene);
    });
    if(hasCt)ctController=(await import('./ct-ui')).prepareLocalCt(manifest,{engine,scene,camera,canvas,sourceMeshes:meshes,framing,studyWorld:meshes[0]??{worldMatrix:STUDY_WORLD},selectStructure:()=>{if(!semanticNode)return;selected=true;for(const mesh of meshes)mesh.material=presentation.selectedMaterial;display();}});
    await registerScene(scene);
    ctController?.start();
    await startEngine(engine);

    let visible = true;
    let selected = false;
    const picker = createGpuPicker(scene);
    if(!referenceController)for (const mesh of meshes) mesh.material = presentation.material;
    const display = () => {
      ctController?.selection(selected);
      visibilityButton.textContent = visible ? 'Hide structure' : 'Show structure';
      if(!semanticNode){status.textContent='Local CT workspace · no lesion GLB loaded. Choose the accepted CT receipt and volume.';return;}
      status.textContent = `${selected ? 'Selected' : 'Loaded'} · ${manifest.structure.semantic_id} · ${visible ? 'visible' : 'hidden'}\n${manifest.asset.model_space} · ${manifest.asset.units} · Presentation only; no clinical meaning.`;
    };
    const pickClick=async (event:MouseEvent) => {
      if(sliceController?.consumeDragClick())return;
      const rect = canvas.getBoundingClientRect();
      const request = () => pickAsync(picker, event.clientX - rect.left, event.clientY - rect.top, {
        filter: (mesh: any) => referenceController ? referenceController.canPick(mesh) : sliceController?.active ? sliceController.canPick(mesh) : visible && meshes.includes(mesh),
      });
      if(referenceController){await referenceController.pick(request);return;}
      const pick = await request();
      if(sliceController?.active){sliceController.selectMesh(pick.hit?pick.pickedMesh:null);return;}
      selected = Boolean(pick.hit && meshes.includes(pick.pickedMesh));
      for (const mesh of meshes) mesh.material = selected ? presentation.selectedMaterial : presentation.material;
      display();
    };
    canvas.addEventListener('click',pickClick);
    closeWorkspace=async()=>{stopEngine(engine);detachCamera();canvas.removeEventListener('click',pickClick);referenceController?.dispose();resourceOutput?.remove();await ctController?.dispose();framing.dispose();disposePicker(picker);disposeScene(scene);disposeEngine(engine);disposedEngines++;};
    if(!referenceController)visibilityButton.onclick = () => {
      visible = !visible;
      setSubtreeVisible(semanticNode, visible);
      display();
    };
    clearButton.onclick = () => {
      if(referenceController){referenceController.clear();return;}
      if(sliceController?.active){sliceController.clear();return;}
      selected = false;
      for (const mesh of meshes) mesh.material = presentation.material;
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
    return true;

  } catch (error) {
    if (currentGeneration === generation) showError(error);
    return false;
  }
}

manifestInput.addEventListener('change', loadSelectedFiles);
glbInput.addEventListener('change', loadSelectedFiles);
