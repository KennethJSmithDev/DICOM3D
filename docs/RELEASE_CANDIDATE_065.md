# DICOM3D v0.6.5 private release candidate

> **Historical preparation snapshot.** The [GitHub v0.6.5 release](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.5) was subsequently published on October 28, 2026. Its reviewed downloads and owner-approval record are summarized in [current release notes](RELEASE_NOTES_065.md). The unpublished/private-candidate and pending-approval statements below remain unchanged as preparation evidence; they do not override that later publication record or qualify additional distributions.

This candidate integrates existing qualified technology in the Babylon Lite Visual Research Workstation. It is not published, installed into IRIS, a clinical product, or a native-renderer migration. Exact source/artifact identities and observed qualification outcomes belong to the external release-candidate manifest.

| Capability | Status and scope |
| --- | --- |
| Babylon workstation, Viewer / Imaging / Anatomy / Lab / Learn | QUALIFIED LOCAL; accepted visual baseline retained |
| Expanded source-backed anatomy | QUALIFIED LOCAL integrated capability; accepted ANAT-ACCEPT-001 donor b59b50a70c0c42eceda480dbb2331ebc18fd2bcb |
| 386 male / 380 female selectable groups | QUALIFIED LOCAL; draw-owner counts, not organ counts or comprehensive coverage |
| Search, source hierarchy, system / region filters, source holds | QUALIFIED LOCAL; original ownership and partial HRA skeleton retained |
| Verified CT interface and modular classic CT | QUALIFIED LOCAL; original source syntax distinct from decoded uint16 representation |
| Original 103 IRIS-returned H000 CT volume | QUALIFIED LOCAL numerical admission, geometry, displayed frames and lifecycle; source payload excluded from all release archives |
| Local Open Study | Versioned verified descriptor plus raw stored pixels only; not arbitrary DICOM or ISO import. Empty/invalid input fails closed. Positive file-picker qualification exists for earlier e98aba4, not independently repeated on f55623f6 |
| Public H000 CT + SEG | QUALIFIED LOCAL in curated Safe Demo; exactly five owner-admitted files, explicit load, unchanged attribution |
| Accumulated CT / lesion presentation | QUALIFIED LOCAL full stack and lesion-range controls and endpoints; intentional source-range prefix, separate manual clip |
| Live IRIS / Orthanc retrieval distribution | DEFERRED; local I001 research is preserved, no production endpoint/credential/runtime ships |
| NRX / native renderer, AI, FHIR | DEFERRED and not required; Babylon default |
| Clinical truth, diagnosis, patient-to-atlas registration | NOT CLAIMED |

## Two distinct distributions

The Core source candidate contains generalized references and optional local verified-volume admission, but no acquired H000 payload. The curated Safe Demo standalone candidate contains exactly the five already-admitted H000 web assets. No original DICOM objects, personal studies, reports, restricted raw16 payload, credential files or service configuration belong to either distribution.

Use the supplied readonly loopback launcher with an existing supported Node runtime. The portable artifact requires no frontend build or package installation. A source rebuild requires already-installed locked Node dependencies. Docker, native installer and IPM runtime qualification are separate and are not inherited from a ZIP/browser PASS. Existing v0.6.0 tags, installers, releases and deployed Pages remain unchanged.

## Reopen and stop

From the extracted standalone archive: `node scripts/preview-static.mjs --root public --port 0`. Open the printed loopback URL in Edge; Ctrl+C stops this host. On Windows, `powershell -File scripts/open-preview.ps1 -Build public` opens a persistent normal Edge window; `powershell -File scripts/stop-preview.ps1` stops only the matching recorded host. The browser window is operator-owned and closes manually. Local state is outside the distributed frontend inventory; qualification sessions do not own this preview.

## Source and presentation boundaries

Original acquired samples, SOP/frame associations, calibration, patient millimetres and model metres remain authoritative. Original H000 uses Implicit VR Little Endian, 16 allocated / 12 stored bits / high bit 11 unsigned; decoded storage is little-endian uint16. No source is relabeled Explicit VR or given invented meaningful bits. Geometry and exact stored-value proofs are independently preserved from I001; display windowing is a derived presentation and does not establish calibrated HU truth.

CT-only admission has no SEG, lesion selection or materialization FX; unsupported controls remain disabled. Curated H000 has its own accepted CT/SEG identities and source-aligned lesion. Reference anatomy is generalized and never implicitly registered to acquired imaging. Scientific, holographic and materialization modes alter presentation, not source geometry. Full range completion means all selected acquired slices; lesion-range completion means selected k64–78, not the entire stack.

BodyParts3D historical derived geometry remains CC BY-SA 2.1 Japan, HRA remains CC BY 4.0, and supplementary publisher IS-A metadata remains CC BY 4.0. Preserve all source notices, Apache-2.0 software notices and third-party licenses. Missing source geometry remains held; no missing skeleton, new atlas or synthetic medical evidence was invented.

## Remaining publication gate

Exact candidate, archive/extraction, static inventory and browser receipts must be reviewed separately. The final source correction requires another Core frontend build; the earlier Core build is withheld. Only the corrected curated offline Safe Demo is offered as a built standalone candidate in this bounded packet. Core source ZIP is a source artifact, not a newly qualified Core runtime. The user alone authorizes any push, merge, tag, Pages deployment, release or OEX update. Local Docker and IPM results are separately bound to f55623f6; the IPM browser witness used an authenticated loopback harness, and ordinary interactive login remains unverified. No installer or OEX completion follows from this candidate. Generalized anatomy and the public research fixture retain their redistribution obligations.

## Publication closure update

See RELEASE_NOTES_065.md, INSTALL_065.md and ANATOMY_LICENSES_065.md. The Safe Demo frontend reuses the frozen f55623f6 payload; this successor changes only publication plumbing and documentation. The Core ZIP is source, not a qualified built Core runtime. The anatomy publication flag remains false pending source-license review and owner approval.
