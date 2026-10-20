# DICOM3D v0.6.0 — Visual Research Workstation

**From Pixels to Meaning.**

Release scope: **desktop-first, reference-only web/source experience**. GitHub source, tag/release and Pages are the selected publication surfaces. See [release notes](RELEASE_060.md) for the installation boundary and [publication procedure](VISUAL_PUBLICATION_PROCEDURE.md) for final verification. This document does not assert a completed deployment.

## Experience and ownership

The workstation places the existing anatomy renderer in a dominant 4:3 viewport. Collapsible tools provide selection, visibility, opacity, camera and presentation settings. Learn sits directly below Lab and explains source identity, effects, limitations and attribution without permanently shrinking the view.

Scientific mode preserves source materials. Holographic mode applies controlled cyan illumination and transparency. Bounded materialization uses deterministic source-derived samples and resolves to the existing complete mesh. Pause, restart and reduced motion control presentation only. Right-drag pan remains distinct from primary selection.

Source geometry, semantic IDs, primitive-to-group membership, coordinates and provenance remain authoritative. The viewer owns camera, visibility, materials and animation. A sample is not a newly segmented structure, acquired voxel or measurement.

The implementation composes with `reference.html`, the existing reference controller and Babylon Lite renderer, without a new rendering engine or runtime dependency. Earlier local imaging work remains separately preserved; CT docks, linked slices, source contours and acquired-data download are not features of this reference-only release.

## Reference coverage

| Source | Semantic groups | Source geometry |
| --- | ---: | --- |
| Male BodyParts3D | 33 | 1,057,660 vertices / 1,827,964 triangles |
| Female HRA | 22 | 1,492,898 vertices / 2,098,191 triangles across 231 primitives |

A group can contain multiple primitives; effects and selection preserve that association. The global effect budget is bounded at 8,192 samples across the selected source rather than multiplied by anatomy count.

BodyParts3D lung groups contain admitted airway/vessel branches, not complete lung envelopes. Female HRA has its own membership and limitations. The generalized references use their own orientation conventions, have partial coverage and have no patient registration. No invented anatomy or replacement source geometry is added.

Retain the unchanged [BodyParts3D notice](../reference/public/reference/BODYParts3D-NOTICE.txt) and [HRA notice](../reference/public/reference/HRA-FEMALE-NOTICE.txt).

## Evidence classification

| Classification | Scope |
| --- | --- |
| KNOWN | Existing reference assets provide 33 male and 22 female semantic groups with source notices. |
| KNOWN, bounded earlier evidence | Local Edge/WebGPU checks exercised both references, selection/visibility, learning, scientific/holographic modes, multi-primitive materialization, right pan/cancellation, resizing and reduced motion. |
| KNOWN, historical | The CT-inclusive local Build04 and research evidence were preserved before selecting this reference-only release. Its output hash and data inventory are not the final publication build. |
| INFERRED | Reusing the reference controller and narrow adapters reduces changed ownership to qualify; it does not prove final deployment correctness. |
| KNOWN, bounded release02 | Reference-only local build and desktop replay passed; four refreshed reference screenshots carry v0.6.0 branding. |
| UNVERIFIED until remote receipt | GitHub release completion and Pages readback. |
| Outside qualification | New native/Core/IPM installers, other browser/GPU combinations, physical-mobile behavior, clinical accuracy, diagnosis and complete anatomical coverage. |

## Reference screenshots

These are actual local release02 reference-viewer captures with v0.6.0 branding, not generated concept art. Screenshot identity and remote rendering are separate evidence steps.

| Capture | Reference state |
| --- | --- |
| [Male desktop](images/visual-060-reference-desktop.jpg) | BodyParts3D anatomy and holographic workspace |
| [Female desktop](images/visual-060-female-desktop.jpg) | HRA source identity and overview |
| [Materialization](images/visual-060-materialization.jpg) | Bounded Layer Sweep over the selected male BodyParts3D heart |
| [Learning](images/visual-060-learning.jpg) | Female HRA heart: source, presentation, limitations and attribution |

No H000 CT screenshot or acquired-data payload is included. The [data policy](PUBLIC_RESEARCH_DATA_POLICY.md) requires absence from both Git and Pages.

## Bounded performance evidence

Earlier foreground local measurements used Windows, Edge 155 and the reported AMD RDNA-3 WebGPU adapter. Each budget was observed for about three seconds after warmup at partial Layer Sweep progress. These characterize that earlier candidate, not the final deployment, another device or internet startup.

| Reference scene | Sample budgets | Frame-interval p95 (ms) | Existing GPU EMA sampled p95 (ms) |
| --- | --- | --- | --- |
| Male, 1280 × 720 | 512 / 2,048 / 8,192 | 7.0 / 7.0 / 7.0 | 0.231 / 0.234 / 0.240 |
| Female, 1440 × 900 | 512 / 2,048 / 8,192 | 7.1 / 7.1 / 7.1 | 0.381 / 0.383 / 0.630 |

Frame intervals are display-paced CPU observations. GPU values are the engine's asynchronous exponential moving average (`0.8 previous + 0.2 raw`), not raw GPU frame-latency percentiles. Sample and instance buffers use 262,144 and 524,288 bytes. Driver, picker, uniforms, render targets and transient allocations add costs; total browser/driver memory remains unknown.

Unchanged GLBs are approximately 47.35 MB male and 67.54 MB female before HTTP overhead. No decimation or assumed server compression improves these figures. The local release02 inventory records 374 output files totaling 116,342,181 bytes before the build manifest. Eight local right-pan observations ranged from 0.9 to 1.1 ms from handler entry to first RAF; these CPU upper-bound observations are not input-to-display latency. Final published identities and remote behavior belong to the release receipt, not the superseded CT-inclusive inventory.

## Limits and next boundary

Desktop is primary. A prior 390 × 844 emulation check supports only layout/learning reachability, not physical-phone or touch qualification. Large transfers, finite GPU checks and incomplete source coverage remain known limitations. No all-browser, clinical or native-install claim follows from visual qualification.

Complete exact reference-only build and remote GitHub/Pages readback, then bind accepted source, assets, screenshots and output in the receipt. Preserve v0.5.1 installation artifacts and evidence. Future H000 publication, native distributions or OEX/IPM actions require their own authorized scope.
