# Native H000 backend

This local experimental backend derives from the DICOM3D NRX-C001 Task 3/6 volume prototype. It retains the integer WebGPU volume and SEG textures and the same H000 source-value interpretation. It replaces the research host's fixed-size two-panel canvas, 60-frame proof loop and whole-volume GPU readbacks with an independently owned viewport and one submission per changed presentation. The custom geometry and semantic identity of the source SEG stay with the established H000 admission pipeline.

`createNrxStudyRenderer` accepts the already verified public H000 fixture, with its 54,001,664-byte uint16 CT view and 27,000,832-byte source mask. Neither is fetched by this backend. A byte-for-byte copy of each view into the native module feeds an R16Uint and R8Uint texture respectively. The host never rewrites the accepted typed views. The Wasm module reserves 96 MiB of linear address space; this is separate from the two logical texture payloads and does not measure physical GPU or browser memory.

The passed camera matrix and accepted model/patient transforms set the 3D projection. The adapter submits only when the camera, viewport, visibility, slice or display uniforms change. Picking marches the same bounded CT/SEG source grid on the CPU, respecting source-plane occlusion and CT clipping, and returns an original source index. It does not perform segmentation, infer a mesh, or serve as a speedup claim. The 2D image and UI still belong to the normal viewer. The backend is qualified only on public H000 and requires a usable WebGPU adapter and Wasm64.

## Compile locally

From the DICOM3D worktree root, configure an installed Emscripten toolchain and the Emdawnwebgpu port. The recorded build used Emscripten 5.0.6 and Emdawnwebgpu 20260720.160313 with a frozen cache.

```powershell
$folder='prototypes/alpha/three-prototype/src/nrx-native'
em++ --target=wasm64 -std=c++17 -O0 "--use-port=$env:EMDAWNWEBGPU_PORT" '-sENVIRONMENT=web' '-sMODULARIZE=1' '-sEXPORT_ES6=1' '-sINITIAL_MEMORY=100663296' '-sALLOW_MEMORY_GROWTH=0' '-sEXIT_RUNTIME=0' '-sEXPORTED_RUNTIME_METHODS=HEAPU8,UTF8ToString' --no-entry "$folder/nrx-study.cpp" -o "$folder/native-study-runtime.mjs"
```

Generated module SHA-256 is `eb5392814c890007d7b8ab9e0c008ed2babf4e1fcacf5d1227be5265e868c3e7`. Generated Wasm SHA-256 is `99d8be883c016564d49b84bb3c13c3768406934970429207ad0b84f6a402eb1a`. The Emscripten and Dawn license texts are retained alongside the generated files. The historical donor artifacts and receipts remain in their original campaign.
