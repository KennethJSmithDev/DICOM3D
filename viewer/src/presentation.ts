import {
  addToScene,
  createDirectionalLight,
  createHemisphericLight,
  createPbrMaterial,
  setPbrEmissive,
} from '@babylonjs/lite';

export function createPresentation(scene: any, reference = false) {
  const material = createPbrMaterial({
    baseColorFactor: [0.72, 0.32, 0.22, 1],
    metallicFactor: 0,
    roughnessFactor: reference ? 0.38 : 0.8,
    doubleSided: true,
  });
  const selectedMaterial = createPbrMaterial({
    baseColorFactor: reference ? [1, 0.64, 0.18, 1] : [0.12, 0.65, 0.9, 1],
    metallicFactor: 0,
    roughnessFactor: reference ? 0.28 : 0.8,
    doubleSided: true,
  });
  if(reference)setPbrEmissive(selectedMaterial,[0.14,0.045,0.006]);
  const key = createDirectionalLight([0.4, -0.65, 1], 1.5);
  key.diffuse = reference ? [0.83, 0.94, 1] : [1, 1, 1];
  key.specular = [1, 1, 1];
  addToScene(scene, key);
  const fill = createHemisphericLight([0, 1, 0], 0.65);
  fill.diffuseColor = [1, 1, 1];
  fill.specularColor = [1, 1, 1];
  fill.groundColor = [0.45, 0.45, 0.45];
  addToScene(scene, fill);
  if (reference) {
    const rim = createDirectionalLight([-0.7, -0.2, -1], 0.75);
    rim.diffuse = [0.32, 0.8, 1];
    rim.specular = [0.55, 0.9, 1];
    addToScene(scene, rim);
  }
  return { material, selectedMaterial };
}
