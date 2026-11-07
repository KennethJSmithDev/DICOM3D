import { BufferAttribute, BufferGeometry } from 'three';

// Private bridge to the previously qualified NRX-C002 Task 2 CPU extractor.
// This does not start the NRX WebGPU renderer or register HRA to another source.
const FILES = Object.freeze({
  'native.js': 'c2798c8edaa60d7768c6db448de2ee3f908e5529c36c07028f36cbee6d7aeb1c',
  'native.wasm': '34c3d466ed3b8c3c4c7863ea178cd40463d2fd08cde0afcbad1750aab0aa0b19',
  'VH_F_right_ovary.bin': '6ba29bc67fb9b3aecae79c60446f8f0681efa28a3cb9773a3b4f24c127ae6e25',
});
const source = Object.freeze({
  id: 'VH_F_right_ovary', ontologyId: 'FMA:7213', atlas: 'HRA united-female v1.5',
  atlasSha256: 'a61a60841fd3c8308d332421385be03188c0babd58b78ae101adf2807a88473a',
  centerM: [-0.07056222856044769, 0.06090236455202103, -0.045502813532948494],
  scaleM: 0.008995084092020988, positionCount: 207, indexCount: 1230,
});
let runtimePromise;
let generating = false;

async function verifiedAsset(name) {
  const response = await fetch(`${import.meta.env.BASE_URL}nrx/${name}`);
  if (!response.ok) throw new Error(`NRX fixture unavailable: ${name} (${response.status})`);
  const bytes = await response.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    x => x.toString(16).padStart(2, '0')).join('');
  if (digest !== FILES[name]) throw new Error(`NRX fixture integrity mismatch: ${name}`);
  return bytes;
}

async function runtime() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    if (window.Module || window.wasmMemory) throw new Error('NRX runtime global already owned');
    const [js, wasm] = await Promise.all([verifiedAsset('native.js'), verifiedAsset('native.wasm')]);
    return await new Promise((resolve, reject) => {
      let done = false;
      const timeout = setTimeout(() => finish(new Error('NRX runtime initialization timed out')), 30000);
      const blobUrl = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }));
      const script = document.createElement('script');
      const finish = (error) => {
        if (done) return;
        done = true; clearTimeout(timeout); URL.revokeObjectURL(blobUrl);
        if (error) reject(error); else resolve(window.Module);
      };
      window.Module = { noInitialRun: true, wasmBinary: new Uint8Array(wasm), onRuntimeInitialized: () => finish(),
        onAbort: reason => finish(new Error(`NRX runtime aborted: ${String(reason)}`)) };
      script.onerror = () => finish(new Error('NRX runtime script failed to load'));
      script.src = blobUrl; document.head.append(script);
    });
  })();
  return runtimePromise;
}

/** Produce one source-relative derived N32 or N64 HRA surface, never a patient or male atlas. */
export async function loadNrxOvarySurface({ resolution = 32 } = {}) {
  if (![32, 64].includes(resolution)) throw new Error('NRX supports only N32 or N64');
  if (generating) throw new Error('NRX field generation already in progress');
  generating = true;
  let module;
  try {
    const [m, payload] = await Promise.all([runtime(), verifiedAsset('VH_F_right_ovary.bin')]);
    module = m;
    if (payload.byteLength !== 7404 || !(window.wasmMemory instanceof WebAssembly.Memory))
      throw new Error('NRX input or Wasm memory unavailable');
    const inputPointer = Number(module._source_ptr());
    if (!Number.isSafeInteger(inputPointer) || inputPointer < 0 || inputPointer + payload.byteLength > window.wasmMemory.buffer.byteLength)
      throw new Error('NRX input memory span invalid');
    new Uint8Array(window.wasmMemory.buffer, inputPointer, payload.byteLength).set(new Uint8Array(payload));
    if (module._source_commit(source.positionCount, source.indexCount) !== 1) throw new Error('NRX source rejected');
    if (module._field_generate(resolution) !== 1) throw new Error('NRX field generation failed');
    const report = structuredClone(window.fieldReport);
    const pointer = Number(module._field_render_ptr()), size = module._field_render_bytes();
    if (!Number.isSafeInteger(pointer) || !Number.isInteger(size) || pointer < 0 || size <= 0 || size % 96 || pointer + size > window.wasmMemory.buffer.byteLength || report?.n !== resolution)
      throw new Error('NRX derived output span invalid');
    const data = new Float32Array(window.wasmMemory.buffer, pointer, size / 4).slice();
    const vertices = data.length / 8, positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3);
    for (let i = 0; i < vertices; i++) for (let axis = 0; axis < 3; axis++) {
      const p = data[i * 8 + axis], n = data[i * 8 + 4 + axis];
      if (!Number.isFinite(p) || !Number.isFinite(n)) throw new Error('NRX derived geometry contains nonfinite values');
      positions[i * 3 + axis] = p * source.scaleM + source.centerM[axis];
      normals[i * 3 + axis] = n;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const provenance = { ...source, sourcePayloadSha256: FILES['VH_F_right_ovary.bin'],
      wasmSha256: FILES['native.wasm'], derived: 'NRX-C002 sampled field and extracted triangle surface',
      resolution, generation: report.generation, revision: report.revision, sourceUnits: 'metres',
      scope: 'Generalized female HRA source; not registered to male atlas or acquired CT',
      triangleVertices: vertices, triangleCount: vertices / 3, fieldReport: report };
    geometry.userData.provenance = provenance;
    let disposed = false;
    return { geometry, provenance, dispose() { if (!disposed) { disposed = true; geometry.dispose(); } } };
  } finally {
    // The linear Wasm allocation itself remains live; only source/field allocations are cleared.
    if (module && typeof module._field_clear === 'function') module._field_clear();
    generating = false;
  }
}
