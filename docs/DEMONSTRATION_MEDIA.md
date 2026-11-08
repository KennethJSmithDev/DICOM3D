# Genuine DICOM3D demonstration media

Use actual application captures to show released behavior. Concept art is not runtime evidence. Do not add personal imaging, reports, identifiers, private correspondence or local machine paths to public media.

## Capture contract

Record the runtime source, build manifest, actual backend, browser, viewport, DPR, zoom/scaling observations and interaction sequence. Capture the existing frozen alpha.1 runtime without rebuilding it or changing animation timing, camera mathematics or source data. A recording's resolution or frame-rate reduction is an export choice, not a change to the test viewport.

Use generalized male/female anatomy and the admitted public H000 example. Distinguish atlas geometry, original CT, source SEG, derived surfaces and presentation effects. The female composite and atlas/scan comparison retain their approximate-placement disclosures. A smooth lesion surface is not whole-scan organ segmentation.

## Storyboards

| Media | Sequence | Acceptance |
|---|---|---|
| README GIF, about 10–15 seconds | Real Materialization replay settles into Scientific; a brief settled view closes the loop | No fabricated frames or shortened animation; readable title/caption; bounded download size |
| Short MP4, about 45–60 seconds | Male reference and camera; female composite; contextual Learn; public CT/SEG and lesion; return to reference | Actual workflow, no clinical/registration claim; visible version/backend retained in source capture |
| Walkthrough, about 3–5 minutes | Purpose; navigation; selection/isolation/opacity; both atlases; learning; H000 and comparison; installation choices and limits | Script checked against released controls; pause on source relationships; no unavailable feature demonstrated as functional |

## Reproduction and limitations

Reuse the existing headed Edge/Playwright setup in a separate automation-owned session; preserve operator windows and the existing preview. Timed compositor frames or screenshots may be encoded using already installed tools. Record frame timestamps and gaps rather than claiming native-frame-rate capture.

Pillow can produce a GIF from genuine frames. MP4 export needs a verified supported local encoder; browser MediaRecorder support must be tested if no command-line encoder is installed. Do not download or install a new encoder automatically, and do not require a paid video-generation API. Keep a failure or alternate WebM result clearly labeled.

Media in this review candidate is unpublished. After approval, place the bounded README GIF at `docs/media/materialization-alpha1.gif`; larger video deliverables should use separately reviewed hosting/release assets rather than unnecessarily enlarging ordinary Git history. The qualified application and immutable release ZIP remain unchanged.

## Prepared alpha.1 review footage

The uncommitted review includes a 9.5-second README GIF, a 28.1-second feature tour and a 129.9-second guided walkthrough. These are genuine compositor-frame recordings of the unchanged `623d81bc` runtime, not concept imagery. Normal desktop capture: 1898 × 990 CSS pixels, DPR 1.25, fresh-context default zoom 100%, visual viewport scale 1; no device emulation. Exported video is 1600 × 834 H.264 MP4; GIF is 960 × 500. Browser encoding retains source timing with held duplicate frames, not interpolated anatomy or motion. Frame cadence varies, so these are demonstration media, not FPS or performance benchmarks.

The longer 3–5 minute narrated storyboard remains a proposal. The two MP4 files are retained as separate unpublished review artifacts rather than added to ordinary Git history. The GIF is a candidate documentation asset; it is not inside any frozen release download.

Source attribution remains separate from the software license: [BodyParts3D](../prototypes/alpha/three-prototype/expanded-atlas/LICENSE.md), [HRA supplement](../prototypes/alpha/three-prototype/atlas-delta/HRA-FEMALE-NOTICE.txt), and the [public H000 research-data policy](PUBLIC_RESEARCH_DATA_POLICY.md). Preserve those notices with any approved redistribution of the media. Videos are silent; the review packet includes a chapter index rather than implying a recorded narration.
