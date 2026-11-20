import {digest} from './imaging-primitives.mjs';
import {verifyVolume} from './verified-volume.mjs';

const STUDY_UID = '2.25.100001';
const SHAPE = [8,32,32];

// These are generated identifiers and drawings, not acquired DICOM objects.
export function syntheticStudyBundle(session) {
  const subject = {reference:session.patientRef};
  const study = {resourceType:'ImagingStudy',id:'synthetic-viewer-study',status:'available',subject,
    identifier:[{system:'urn:dicom:uid',value:`urn:oid:${STUDY_UID}`}]};
  const report = {resourceType:'DiagnosticReport',id:'synthetic-viewer-report',status:'final',subject,
    ...(session.fhirVersion === '5.0.0' ? {study:[{reference:'ImagingStudy/synthetic-viewer-study'}]} :
      {imagingStudy:[{reference:'ImagingStudy/synthetic-viewer-study'}]})};
  return {resourceType:'Bundle',type:'collection',entry:[study,report].map(resource =>
    ({fullUrl:`${session.fhirBase}/${resource.resourceType}/${resource.id}`,resource}))};
}

export async function syntheticViewerPhantom(harness,session) {
  const reference = harness.clinicalStudyReference(session,syntheticStudyBundle(session),'synthetic-viewer-study');
  const [slices,rows,cols] = SHAPE, pixels = new Uint16Array(slices * rows * cols);
  for (let k=0;k<slices;k++) for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
    const x=(c-15.5)/14, y=(r-15.5)/13;
    const body=x*x+y*y<1, left=((x+.4)/.29)**2+((y+.05)/.58)**2<1, right=((x-.4)/.29)**2+((y+.05)/.58)**2<1;
    const center=(x*x+(y-.5)**2)<.025;
    pixels[(k*rows+r)*cols+c]=body ? (center ? 1100 : left || right ? 150+k*4 : 750) : 0;
  }
  const raw = pixels.buffer, payloadHash = await digest(raw), frames = [];
  const row = [0,0,0,1];
  for (let k=0;k<slices;k++) {
    const hash=await digest(raw.slice(k*rows*cols*2,(k+1)*rows*cols*2));
    // Both hashes identify this generated raw frame; no DICOM file is claimed.
    frames.push({k,sourceFrame:1,sopIdentity:`2.25.1001${String(k).padStart(2,'0')}`,
      pixelSha256:hash,sourceFileSha256:hash,imagePositionPatient:[-62,-62,-17.5+5*k]});
  }
  const descriptor={schema:'DICOM3D-verified-volume-1',shape:[...SHAPE],
    source:{modality:'CT',studyIdentity:STUDY_UID,seriesIdentity:'2.25.100002',frameOfReferenceIdentity:'2.25.100003'},
    storage:{dtype:'<u2',bitsStored:16,highBit:15,photometric:'MONOCHROME2'},
    calibration:{slope:1,intercept:0,center:600,width:1200,voiFunction:'LINEAR_EXACT'},
    geometry:{pixelSpacingRowColumnMm:[4,4],imageOrientationPatient:[1,0,0,0,1,0],matrices:{
      index_to_patient_mm:[[0,0,4,-62],[0,4,0,-62],[5,0,0,-17.5],row],
      patient_mm_to_index:[[0,0,.2,3.5],[0,.25,0,15.5],[.25,0,0,15.5],row],
      patient_mm_to_model_m:[[-.001,0,0,0],[0,0,.001,0],[0,.001,0,0],row],
      model_m_to_patient_mm:[[-1000,0,0,0],[0,0,1000,0],[0,1000,0,0],row]}},
    frames,payload:{bytes:raw.byteLength,sha256:payloadHash}};
  const volume = await verifyVolume(descriptor,raw);
  return Object.freeze({reference,input:harness.viewerStudyInput(session,reference,volume)});
}
