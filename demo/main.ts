import { loadFiles } from '../viewer/src/main';

async function start() {
  const base = import.meta.env.BASE_URL;
  const manifestResponse = await fetch(`${base}sample/study.manifest.json`);
  if (!manifestResponse.ok) throw new Error(`Manifest HTTP ${manifestResponse.status}`);
  const text = await manifestResponse.text();
  const manifest = JSON.parse(text);
  const response = await fetch(`${base}sample/study.glb`);
  if (!response.ok) throw new Error(`Sample HTTP ${response.status}`);
  document.querySelector('#provenance')!.textContent =
    `${manifest.provenance.description} · ${manifest.provenance.copyright} · ${manifest.provenance.license}. No patient data or anatomical claim.`;
  await loadFiles(new File([text], 'study.manifest.json', { type: 'application/json' }),
    new File([await response.arrayBuffer()], 'study.glb', { type: 'model/gltf-binary' }));
}
start().catch(error => {
  document.querySelector('#status')!.textContent = `Demo unavailable: ${error}. This demo requires WebGPU in a supported browser.`;
});
