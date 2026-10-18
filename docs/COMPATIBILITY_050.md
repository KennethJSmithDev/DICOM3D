# v0.5.0 compatibility and limitations

| Capability | Bounded scope |
|---|---|
| Core host | Docker Compose v2, Linux/amd64, pinned Node24 base; first build requires internet |
| Viewer | WebGPU-capable desktop Chromium; tablet/phone are secondary, not diagnostic workstations |
| Reference anatomy | BodyParts3D male33 / HRA female22 semantic subsets; generalized, partial coverage; no patient registration |
| Selection/presentation | Picking eligible exposed structures, explicit skin dropdown, hide/show/isolate/opacity/clip, presets/fit/reset; no source mutation |
| Acquired CT | Separately qualified local NPY+receipt+manifest; acquired frames distinguished from resampled views and mesh-derived sections |
| Other modalities/formats | Converted local .d3img/.d3arr bridge and semantic evidence recognition; not universal native DICOM/NIfTI/NRRD/OME decoding in the browser |
| CT intensity | Recorded display transformation; no independent calibrated HU or PET SUV claim |
| IRIS hosting/IPM | Existing protected static wrapper, %Development/password authentication, USER development profile; exact tested image/runtime in release manifest |
| Optional Connect | Exploratory interfaces only; no configured FHIR repository, PACS, production authorization or clinical system integration |
| Storage/network | Core has GET/HEAD static reads, no public write API or patient upload/storage; explicit public-provider controls may make outbound requests |

Browser/GPU peak memory, physical-device touch, all assistive technologies, other CPU architectures and native Windows IPM remain outside the qualified scope unless an exact receipt says otherwise. Container memory limits do not bound the host browser/GPU. Expanded evidence panels can reduce workspace height on short desktop viewports; keep them collapsed for anatomy exploration. No new clinical, segmentation accuracy, physiological digital-twin or AI claim.

Source arrays and spatial evidence remain immutable. Window/level, interpolation, materials, lighting and clipping are derived presentation. Approximate/generalized reference structures must not be presented as observed patient anatomy. External records and unresolved associations remain source-owned.
