import {
  addToScene,
  createDirectionalLight,
  createHemisphericLight,
  createPbrMaterial,
} from '@babylonjs/lite';

export function createPresentation(scene: any) {
  const material = createPbrMaterial({
    baseColorFactor: [0.72, 0.32, 0.22, 1],
    metallicFactor: 0,
    roughnessFactor: 0.8,
    doubleSided: true,
  });
  const selectedMaterial = createPbrMaterial({
    baseColorFactor: [0.12, 0.65, 0.9, 1],
    metallicFactor: 0,
    roughnessFactor: 0.8,
    doubleSided: true,
  });
  const key = createDirectionalLight([0.4, -0.65, 1], 1.5);
  key.diffuse = [1, 1, 1];
  key.specular = [1, 1, 1];
  addToScene(scene, key);
  const fill = createHemisphericLight([0, 1, 0], 0.65);
  fill.diffuseColor = [1, 1, 1];
  fill.specularColor = [1, 1, 1];
  fill.groundColor = [0.45, 0.45, 0.45];
  addToScene(scene, fill);
  return { material, selectedMaterial };
}
