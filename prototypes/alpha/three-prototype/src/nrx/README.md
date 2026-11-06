# NRX-C002 surface bridge (private research)

The bridge uses the existing NRX-C002 Task 2 Wasm64 module and the admitted HRA
right-ovary fixture. It calls the CPU field generator at N32/N64 and converts
its non-indexed eight-float vertex records into Three.js position and normal
attributes. Positions are restored using the recorded HRA source-metre center
and scale; source and derived geometry remain distinct.

This is a generalized **female HRA** fixture. It is not a male atlas mesh,
patient anatomy, or registered to CT or the male reference. It must be shown
separately with the HRA attribution in `public/nrx/HRA-FEMALE-NOTICE.txt`.
No conclusions about arbitrary anatomy, clinical accuracy, or features below
the sampled grid resolution follow. Synchronous generation cannot be cancelled
once the Wasm call has begun. `_field_clear` releases field ownership after the
copy; the Wasm linear memory allocation can persist for the page lifetime.

The exact historical source, fixture catalog and qualification receipt remain at
`research/nrx/c002/tasks/task-2/` in this review branch (raw historical evidence stays local).
The private prototype verifies the copied JS, Wasm, and source payload hashes.
The original native WebGPU renderer is not initialized by this adapter.
