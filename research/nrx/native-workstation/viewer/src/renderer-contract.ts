// WHY: the selected renderer must own construction and lifetime, not replace UI/source authority.
// BOUNDARY: private development integration only; unimplemented native operations fail closed.
// INVARIANT: no automatic Babylon fallback or second backend construction on a native request.
// EVIDENCE: private integration receipt and actual switch/lifetime observations.
// REGRESSION: a research screenshot cannot stand in for the workstation's source/presentation contract.
export type RendererId = 'babylon' | 'native';
export type RendererRequest = Readonly<{
  kind: 'reference' | 'study' | 'geometry';
  presentation?:string;
  semanticId: string;
  sourceSha256: string;
  units: string;
  required: readonly string[];
}>;
export type RendererAssessment = Readonly<{supported:boolean; missing:readonly string[]}>;
export interface RendererSessionOwner {
  readonly backend:RendererId;
  readonly generation:number;
  snapshot():{backend:RendererId;activeOwners:number;[key:string]:unknown};
  dispose():Promise<void>;
}
// Source decoding and original semantic/spatial authority stay outside this seam.
// Existing onReady visual/controller/framing hooks are the UI consumer; their
// required behavior must be implemented before a native factory may register.
export function rendererRequest(manifest:any,hasCt:boolean,presentation='holographic'):RendererRequest {
  const reference=Boolean(manifest.reference);
  return Object.freeze({presentation,kind:hasCt?'study':reference?'reference':'geometry',semanticId:manifest.structure.semantic_id,sourceSha256:manifest.asset.sha256,units:manifest.asset.units,
    required:Object.freeze(['responsive-main-canvas','owned-start-stop-dispose','semantic-pick-and-framing',...(presentation==='scientific'?['scientific-source-material']:['scientific-holographic-materialization']),'source-preserving-presentation',...(hasCt?['acquired-plane-world-depth','source-frame-window-and-ct-settings','exact-seg-and-glb-surface-correspondence','mapping-probe']:reference?['full-source-subtree-identity','reference-opacity-isolation-and-source-y-clipping']:[])])});
}
export function assessRenderer(id:RendererId,request:RendererRequest):RendererAssessment {
  if(id==='babylon')return Object.freeze({supported:true,missing:Object.freeze([])});
  if(import.meta.env.DICOM3D_NATIVE_SCIENTIFIC_DEV===true&&request.kind==='study'&&request.presentation==='scientific')return Object.freeze({supported:true,missing:Object.freeze([])});
  if(import.meta.env.DICOM3D_NATIVE_REFERENCE_DEV===true&&request.kind==='reference'&&request.presentation==='scientific')return Object.freeze({supported:true,missing:Object.freeze([])});
  // NRX-C002 exports fixed #native canvases, source-mask projection, three bounded
  // genus-zero field fixtures and 60-submission batches. It has no implemented
  // workstation onReady visual/controller/framing adapter. Do not fake these APIs.
  return Object.freeze({supported:false,missing:Object.freeze([...request.required])});
}
export function assertRenderer(id:RendererId,request:RendererRequest){const assessment=assessRenderer(id,request);if(!assessment.supported)throw Error('Native workstation capability gap: '+assessment.missing.join(', '));return assessment;}
