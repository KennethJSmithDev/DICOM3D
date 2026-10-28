# Source-backed anatomy reference capability — ANAT-ACCEPT-001

This is a separately qualified desktop product candidate based on the 0.6.0
workstation. It does not change the published 0.6.0 release or Safe Demo. The exact
acceptance commit, artifact and measurements are bound by the external acceptance
receipt; no publication or BDP integration follows automatically from this file.

## Supported operation

The existing Babylon Lite workstation loads the entire admitted male or female
reference, with one shared selection/visibility/camera controller. There are 386
male and 380 female selectable **draw owners**, including anatomical subcomponents.
These are not counts of organs or claims of exhaustive anatomical coverage.

Source-name, source-ID and male FJ-element search, source system/class filtering
and source hierarchy navigation resolve to those same owners. A source child
already contained in Heart, Skeleton or another accepted group is searchable but
does not acquire invented independent geometry. The hierarchy explicitly reports
“Provided through” when a source part maps to one larger existing owner; selection
and isolation then affect that entire owner. Containers filter owners without
changing selection, visibility, camera or source coordinates. Records without
admitted geometry remain visible in the hierarchy with an honest unavailable label.

## Complete accounting of available references

- BodyParts3D: all 1,258 local OBJ elements and 1,368 PART-OF concepts accounted
  for. 1,256 elements have accepted owners; FJ1450 and FJ1656 remain identity holds
  because their original headers lack names/concepts. Publisher IS-A suggestions
  do not silently clear those holds. The existing ileocecal-junction element
  FJ2599 belongs to both accepted small/large intestine owners; this inherited
  overlap is recorded rather than duplicated again or silently reowned.
- HRA female: all 1,073 source nodes accounted for. 646 nodes have existing draw
  ownership, 123 are ownerless containers, and 304 are held records (including
  external/pregnancy containers and their geometry). Of those held records, 298
  are mesh-bearing nodes. One previously accepted skeleton descendant has an
  incomplete source annotation; its native node identity and whole-group ownership
  remain explicit, with no new ontology identity invented.
- The publisher IS-A table describes 976 additional FJ IDs without local geometry.
  These are catalog-only, not admitted structures or a download authorization.
- Source FMA/UBERON identities are retained. Shared ontology identifiers are semantic
  links, never proof of male/female or patient/atlas spatial registration.

[Owner map](../reference/public/reference/anatomy-owner-map.json) records every
element/node, hold, relation and existing owner. Male functional systems use the
accepted PART-OF membership; previously unassigned parts expose explicitly labeled
IS-A classes rather than inferred organ-system assignments. Relations remain distinct.

## Source and representation ownership

BodyParts3D 4.0 PART-OF source geometry and HRA female-united source geometry remain
independent references. Their GLB hashes are unchanged from ANAT-EXPAND-002:

| Reference | Bytes | SHA-256 |
|---|---:|---|
| Male | 82,285,164 | `c44f884861550d92e54bae4beb8ebfd5b4927d61c37034e5f6a61f7b4b41d4d4` |
| Female | 187,220,140 | `24abc4d8bd0a00bfc93ab45e227c1e9b157ffc0d21d1e5c22408fbe3933f60cb` |

Original meshes → unchanged admitted GLBs → metadata owner projection → existing
Babylon renderer. No second canonical geometry store, smoothing, field conversion,
patient registration or new dependency is required. Presentation opacity, clipping,
camera and isolation remain reversible. Acquired imaging remains a separate pipeline.

## Attribution and reproducibility

Retain [BodyParts3D notice](../reference/public/reference/BODYParts3D-NOTICE.txt)
and [HRA notice](../reference/public/reference/HRA-FEMALE-NOTICE.txt). Existing derived
BodyParts3D geometry/member mapping retains CC BY-SA 2.1 Japan; HRA retains CC BY 4.0.
The publisher's current supplementary IS-A metadata is attributed under its current
CC BY 4.0 terms, with exact source URLs/hashes in
[metadata provenance](../reference/metadata/bodyparts3d/SOURCE.json). These data
licenses remain distinct from Apache-2.0 application code. No external atlas
geometry, new patient data or cross-atlas registration is included.

`python scripts/map-reference-owners.py` reproducibly regenerates the two metadata
manifests and owner map from frozen portable metadata. It never writes GLBs. Exact
UTF-8 LF output and source pins are enforced; `.gitattributes` prevents checkout
normalization from invalidating build admission. The existing geometry-admission
generator and original source hashes remain available for the separately qualified
geometry lineage; geometry regeneration is unnecessary for this mapping operation.

The build uses exact filename/byte/hash admission, not recursive public copying.
The Core ZIP contains all ten admitted reference files, source notices, mapping
inputs and tests. It excludes all H000 imaging files. Curated Safe Demo builds retain
their separate, exact five-file imaging admission and explicit loading action.

## Limits and promotion boundary

Desktop WebGPU and the operator-authorized 4 GiB renderer ceiling are the tested
target. This does not establish mobile, 1 GiB-device or unlimited-cycle support.
OS renderer working set, GPU-process private commit and logical GPU buffers are
different measurements; private commit is not physical VRAM.

The optional decorative point sampler retains its 8,192-point budget and fair
per-owner allocation. It samples all 386 male primitives but 507/590 female
primitives; all 380 female owners receive points. The 83 omitted decorative
primitive targets are not missing source meshes. Full-source rendering is qualified
separately. No accuracy, clinical completeness or diagnostic suitability is claimed.

BDP-001's designated writer must review and admit this exact candidate after its
CT gate, preserving both changesets and rerunning only affected integration checks.
Public main promotion, versioning and deployment remain separate approval gates.
