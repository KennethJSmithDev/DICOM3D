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
  startEngine,
} from '@babylonjs/lite';
import { createPresentation } from './presentation';
import { FIXTURE_ID, FIXTURE_SHA } from './slices.mjs';
import { prepareCamera } from './camera-ui';

type Manifest = {
  structure: { semantic_id: string };
  asset: { relative_filename: string; sha256: string; model_space: string; units: string };
};

const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas')!;
const status = document.querySelector<HTMLElement>('#status')!;
const manifestInput = document.querySelector<HTMLInputElement>('#manifestFile')!;
const glbInput = document.querySelector<HTMLInputElement>('#glbFile')!;
const visibilityButton = document.querySelector<HTMLButtonElement>('#visibilityButton')!;
const clearButton = document.querySelector<HTMLButtonElement>('#clearButton')!;
let generation = 0;

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
export async function loadFiles(manifestFile: File, glbFile: File) {
  const currentGeneration = ++generation;
  visibilityButton.disabled = true;
  clearButton.disabled = true;

  try {
    status.textContent = 'Reading manifest…';
    const manifest = JSON.parse(await manifestFile.text()) as Manifest;
    if (!manifest.structure?.semantic_id || !manifest.asset?.sha256 || !manifest.asset?.relative_filename) {
      throw new Error('Manifest is missing structure identity or asset metadata.');
    }
    if (glbFile.name !== manifest.asset.relative_filename) {
      throw new Error(`Expected ${manifest.asset.relative_filename}; selected ${glbFile.name}.`);
    }

    const glbBytes = await glbFile.arrayBuffer();
    if ((await sha256(glbBytes)).toLowerCase() !== manifest.asset.sha256.toLowerCase()) {
      throw new Error('GLB SHA-256 does not match the manifest.');
    }
    if (currentGeneration !== generation) return;

    status.textContent = 'Creating WebGPU scene…';
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);
    scene.clearColor = { r: 0.035, g: 0.055, b: 0.075, a: 1 };
    const container = await loadGltf(engine, glbBytes);
    const nodes: any[] = [];
    const visit = (node: any) => {
      nodes.push(node);
      for (const child of node.children || []) visit(child);
    };
    container.entities.forEach(visit);
    const semanticNode = nodes.find((node) => node.name === manifest.structure.semantic_id);
    if (!semanticNode) throw new Error(`GLB does not contain semantic node ${manifest.structure.semantic_id}.`);
    const semanticExtras = semanticNode.metadata?.gltf?.extras;
    if (semanticExtras?.semanticId && semanticExtras.semanticId !== manifest.structure.semantic_id) {
      throw new Error('GLB semantic extras do not match the manifest.');
    }

    const meshes: any[] = [];
    const findMeshes = (node: any) => {
      if (getMeshTriangles(node)) meshes.push(node);
      for (const child of node.children || []) findMeshes(child);
    };
    findMeshes(semanticNode);
    addToScene(scene, container);
    const presentation = createPresentation(scene);
    const sliceController = manifest.structure.semantic_id === FIXTURE_ID && manifest.asset.sha256 === FIXTURE_SHA
      ? await (await import('./slice-ui')).prepareSlices({engine,scene,sourceNode:semanticNode,sourceMeshes:meshes,glbBytes,canvas,status,visibilityButton,onOriginal:()=>display()})
      : null;
    const camera = createDefaultCamera(scene);
    camera.alpha = -Math.PI / 2;
    camera.beta = Math.PI / 2.35;
    camera.radius *= 1.25;
    const framing=prepareCamera({camera,canvas,sourceMeshes:meshes,sliceController});
    sliceController?.setFraming(framing);
    let detachCamera = attachControl(camera, canvas, scene);
    let cameraEnabled = true;
    sliceController?.setCameraControls((enabled:boolean)=>{
      if(enabled===cameraEnabled)return;
      detachCamera();cameraEnabled=enabled;
      if(enabled)detachCamera=attachControl(camera,canvas,scene);
    });
    await registerScene(scene);
    await startEngine(engine);

    let visible = true;
    let selected = false;
    const picker = createGpuPicker(scene);
    for (const mesh of meshes) mesh.material = presentation.material;
    const display = () => {
      visibilityButton.textContent = visible ? 'Hide structure' : 'Show structure';
      status.textContent = `${selected ? 'Selected' : 'Loaded'} · ${manifest.structure.semantic_id} · ${visible ? 'visible' : 'hidden'}\n${manifest.asset.model_space} · ${manifest.asset.units} · Presentation only; no clinical meaning.`;
    };
    canvas.addEventListener('click', async (event) => {
      if(sliceController?.consumeDragClick())return;
      const rect = canvas.getBoundingClientRect();
      const pick = await pickAsync(picker, event.clientX - rect.left, event.clientY - rect.top, {
        filter: (mesh: any) => sliceController?.active ? sliceController.canPick(mesh) : visible && meshes.includes(mesh),
      });
      if(sliceController?.active){sliceController.selectMesh(pick.hit?pick.pickedMesh:null);return;}
      selected = Boolean(pick.hit && meshes.includes(pick.pickedMesh));
      for (const mesh of meshes) mesh.material = selected ? presentation.selectedMaterial : presentation.material;
      display();
    });
    visibilityButton.onclick = () => {
      visible = !visible;
      setSubtreeVisible(semanticNode, visible);
      display();
    };
    clearButton.onclick = () => {
      if(sliceController?.active){sliceController.clear();return;}
      selected = false;
      for (const mesh of meshes) mesh.material = presentation.material;
      display();
    };
    visibilityButton.disabled = false;
    clearButton.disabled = false;
    manifestInput.disabled = true;
    glbInput.disabled = true;
    display();
  } catch (error) {
    if (currentGeneration === generation) showError(error);
  }
}

manifestInput.addEventListener('change', loadSelectedFiles);
glbInput.addEventListener('change', loadSelectedFiles);
