import React, {useEffect,useMemo,useRef,useState} from 'react';
import FhirEvidenceView from './FhirEvidenceView.jsx';
import {compareOpenCtIdentity,readLiveFhirStudy} from './fhir-live-viewer.mjs';

const messages={
  INVALID_SOURCE:'Use the configured source key and a valid FHIR ImagingStudy ID.',
  INVALID_CREDENTIALS:'Enter an IRIS username and password using supported ASCII characters.',
  INVALID_HOST:'Live IRIS is available only in the explicitly configured local preview.',
  ACCESS_DENIED:'IRIS denied the supplied credentials or permission for this study.',
  SOURCE_UNAVAILABLE:'The live source or study is not configured for this preview.',
  UPSTREAM_SECURE_TRANSPORT_REQUIRED:'This IRIS source needs HTTPS with a trusted server certificate before credentials can be sent.',
  TIMEOUT:'The live IRIS request timed out.',
};

export default function FhirLivePanel({study}) {
  const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[status,setStatus]=useState('No live study inspected.');
  const request=useRef(null),sequence=useRef(0);
  useEffect(()=>()=>{sequence.current++;request.current?.abort();},[]);
  const match=useMemo(()=>result?compareOpenCtIdentity(result.resource,study):null,[result,study]);

  function cancel(){sequence.current++;request.current?.abort();request.current=null;setBusy(false);setStatus('Live request cancelled.');}
  function clear(){cancel();setResult(null);setStatus('Live study information cleared.');}
  async function inspect(event){
    event.preventDefault();
    const form=event.currentTarget, id=++sequence.current;
    const sourceId=form.elements.source.value.trim(),studyId=form.elements.study.value.trim();
    let username=form.elements.username.value,password=form.elements.password.value;
    form.elements.username.value='';form.elements.password.value='';
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setBusy(true);setResult(null);setStatus('Reading the configured IRIS study…');
    try{
      const pending=readLiveFhirStudy({sourceId,studyId,username,password,appBase:import.meta.env.BASE_URL,
        pageUrl:globalThis.location.href,signal:controller.signal});
      username='';password='';
      const value=await pending;
      if(id!==sequence.current||controller.signal.aborted)return;
      setResult(value);setStatus('Live IRIS study metadata is ready.');
    }catch(error){
      if(id===sequence.current&&!controller.signal.aborted)setStatus(messages[error?.code]??'The live study could not be read or verified.');
    }finally{
      username='';password='';
      if(id===sequence.current){request.current=null;setBusy(false);}
    }
  }

  return <details style={{marginTop:'0.75rem'}} aria-label="Live IRIS study metadata">
    <summary>Read a configured live IRIS study</summary>
    <p>Local preview only. Enter your own authorized IRIS credentials; DICOM3D does not save them. The source and study must be configured by the local host.</p>
    <p>This reads FHIR ImagingStudy metadata, not DICOM pixels. Credentialed IRIS reads require HTTPS and a trusted server certificate.</p>
    <form onSubmit={inspect} autoComplete="off">
      <label>Configured source key <input name="source" required maxLength="64" autoComplete="off"/></label>
      <label>ImagingStudy ID <input name="study" required maxLength="64" autoComplete="off"/></label>
      <label>IRIS username <input name="username" required maxLength="256" autoComplete="off"/></label>
      <label>IRIS password <input name="password" type="password" required maxLength="1024" autoComplete="off"/></label>
      <button type="submit" disabled={busy}>{busy?'Reading…':'Read live study'}</button>{' '}
      {busy&&<button type="button" onClick={cancel}>Cancel live read</button>}{' '}
      {result&&<button type="button" onClick={clear}>Clear live result</button>}
    </form>
    <p role="status">{status}</p>
    {result&&<>
      <p>Source {result.sourceId} · FHIR {result.version}, verified against the server's CapabilityStatement.</p>
      <p>{match==='MATCHED_IDENTITIES'?'Study, series and instance identities match the open CT. Its pixels remain the separately verified local copy.':
        match==='NOT_MATCHED'?'The retrieved study has not been matched to the open CT.':'Open the public H000 CT to compare its source identities.'}</p>
      <p>Matching identifiers do not establish patient identity, image registration or clinical accuracy.</p>
      <FhirEvidenceView projection={result.projection} singleResource/>
      <details><summary>Source fingerprint</summary><p>{result.provenance?.study?.bytes} bytes · SHA-256 {result.provenance?.study?.sha256}</p></details>
    </>}
  </details>;
}
