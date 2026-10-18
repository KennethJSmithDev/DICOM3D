// Evidence stages are per path/example, never inferred from a Modality tag.
export const imagingCapabilities=[
  {capability:'H000 acquired CT / planes / volume',stage:'QUALIFIED',scope:'Accepted local 103-frame QIN study only; existing receipt/NPY path.'},
  {capability:'H000 SEG → source CT → lesion',stage:'QUALIFIED EXAMPLE',scope:'Hash-bound accepted alignment receipt; exact CT SOP/k and SEG frame navigation, lesion selection, mask-derived voxel count/volume. No linked SR finding, diagnosis or generic SEG overlay.'},
  {capability:'Local DICOM CT, MR, CR, RGB US',stage:'INTERACTIVE',scope:'Offline pydicom bridge; tested local examples. Full modality/source-rights qualification remains bounded in receipts.'},
  {capability:'30-frame ultrasound',stage:'INTERACTIVE',scope:'Native frame navigation; no timed cine playback or reconstructed 3D claim.'},
  {capability:'DX / CR / CT / MR / US / PT / MG',stage:'QUALIFIED EXAMPLES',scope:'Local single-image display/windowing on pinned CC-BY research examples; exact identities and independent checks in campaign receipt. Not universal modality, acquisition-volume or clinical qualification. No SUV/calibration claim.'},
  {capability:'SEG / SR / RTPLAN / RTDOSE / ECG',stage:'RECOGNIZED',scope:'Actual local recognition reports and source references only; no generic overlay, report interpretation, dose or waveform rendering.'},
  {capability:'REG / surfaces / presentation states / parametric maps',stage:'DISCOVERED',scope:'pydicom UID dictionary; no real-object interpretation qualified.'},
  {capability:'NM planar / XA static / RF two-frame',stage:'QUALIFIED EXAMPLES',scope:'Pinned CC-BY local examples; source ImageType retained. No SPECT volume, quantitative activity, angiographic analysis or timed cine claim.'},
  {capability:'Reconstructed SPECT native slices',stage:'QUALIFIED EXAMPLE',scope:'44×128×128 public NM example, native frames and independent pixel checks. Detector geometry/vector metadata retained; no 3D placement or quantitative activity claim.'},
  {capability:'Clinical references / optional Connect',stage:'SYNTHETIC PROTOTYPE',scope:'Offline FHIR R4 identity/reference checks only; no connected PACS/EHR/IRIS, no real patient/access verification or inferred finding-to-anatomy link.'},
  {capability:'Dental / endoscopy',stage:'DISCOVERED',scope:'No representative source/provider qualification in this campaign.'},
  {capability:'OCT / whole-slide pathology',stage:'DISCOVERED',scope:'Specialized axes, tiles, pyramids and codecs require separate adapters; not flattened into generic images.'},
  {capability:'OME-TIFF scalar YX / ZYX',stage:'INTERACTIVE',scope:'Offline installed tifffile bridge; analytic fixture only. No biological/WSI/OME universal qualification.'},
  {capability:'NIfTI-1 / attached raw NRRD',stage:'PROTOTYPE ADAPTER',scope:'Bounded scalar integer native-plane bridge; analytic fixtures only. Original coordinate metadata retained, no DICOM conversion or registration.'},
];
export function capabilityTable(){
  const section=document.createElement('details');section.id='imagingCapabilities';
  const summary=document.createElement('summary');summary.textContent='Compatibility · evidence stages';section.append(summary);
  const intro=document.createElement('p');intro.textContent='Discovery, recognition, decoding, display, interaction and qualification are independent claims. A tested example does not establish universal modality support.';section.append(intro);
  for(const item of imagingCapabilities){const p=document.createElement('p');const title=document.createElement('strong');title.textContent=`${item.capability} · ${item.stage}`;p.append(title,document.createElement('br'),document.createTextNode(item.scope));section.append(p);}
  return section;
}
