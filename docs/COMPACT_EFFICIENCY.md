# Compact layout and rendering policy — private implementation checkpoint

The available workspace width, not device detection, selects the compact shell below 1280 CSS pixels. The existing desktop shell remains above that threshold. One independently scrolling contextual panel is shown at a time; the scene and application state remain mounted across layout transitions.

Compact first visits choose Efficient or Higher detail before atlas admission. Wide first visits retain Higher detail; Quality remains available everywhere. Remembering the choice is optional. Rendering quality is independent of layout. Efficient schedules drawing at most 30 times per second and caps DPR at 1; Higher detail uses a 60-draw budget and DPR 1.5 (comparison capped at 1.25). These are drawing budgets, not guaranteed delivered FPS or input-event limits.

R3F roots use an explicit demand/cadence scheduler. Scene commits, controls and damping, resize, reference transforms, source frames and comparison changes request drawing. Materialization and study playback keep it awake only while active. Animation timing uses elapsed time. Hidden documents stop scheduled drawing and request a frame when visible again. Selection bounds are evaluated on requested frames, including transform and reference transitions.

Checkpoint 1 evidence: a headed Chromium/WebGL2 route-served exact static build at 390×844, DPR2, showed actual anatomy and compact navigation; viewport changed to 1920×1080 without recreating the renderer. Quality changes preserved the camera. Main and comparison each produced zero additional frames during ten settled idle seconds, then resumed on a drag. The first compact canvas selector and a final linked-camera lag were identified and repaired; final regression follows in checkpoint 2. No physical-phone thermal, battery, Safari or installed-runtime acceptance is implied. Frozen public artifacts are unchanged.

The next checkpoint owns bounded loading and resource ownership. Sharing must protect per-view materials and source component draw-group edits; network reuse alone is not GPU-memory evidence.
