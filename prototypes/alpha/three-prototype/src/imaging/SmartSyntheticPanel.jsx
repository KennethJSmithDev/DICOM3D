import React,{useEffect,useRef,useState} from 'react';
import {prepareSyntheticRedirect,resumeSyntheticRedirect,restoreSyntheticViewerSession,clearSyntheticViewerSession} from '../../../viewer/src/smart-synthetic-redirect.mjs';
import {syntheticStudyBundle,syntheticViewerPhantom} from '../../../viewer/src/smart-synthetic-fixture.mjs';
import {verifiedFrameRgba} from '../../../viewer/src/verified-volume.mjs';

function browserStorage() {
  try { return window.sessionStorage; }
  catch { throw Object.assign(new Error('STORAGE_UNAVAILABLE'),{code:'STORAGE_UNAVAILABLE'}); }
}

export default function SmartSyntheticPanel({localStudy,onStudyChange,onFrameChange}) {
  const [persona,setPersona]=useState('patient'),[launchKind,setLaunchKind]=useState('ehr'),[version,setVersion]=useState('4.0.1');
  const [active,setActive]=useState(null),[reference,setReference]=useState(null),[phantom,setPhantom]=useState(null),[frame,setFrame]=useState(0);
  const [busy,setBusy]=useState(false),[status,setStatus]=useState('No synthetic session active.');
  const canvas=useRef(null), sequence=useRef(0), owned=useRef(null), currentLocal=useRef(localStudy), activeRef=useRef(null);
  currentLocal.current=localStudy;activeRef.current=active;

  function accept(result) {
    const ref=result.harness.clinicalStudyReference(result.session,syntheticStudyBundle(result.session),'synthetic-viewer-study');
    setActive(result);setReference(ref);setPersona(result.session.persona);setLaunchKind(result.session.launchKind);setVersion(result.session.fhirVersion);
    setStatus('Synthetic SMART session ready. No real provider or patient was accessed.');
  }
  useEffect(()=>{
    let mounted=true;
    (async()=>{
      try {
        const storage=browserStorage();
        const result=await resumeSyntheticRedirect({storage,pageUrl:location.href,history}) ??
          restoreSyntheticViewerSession({storage,pageUrl:location.href});
        if(mounted&&result)accept(result);
      } catch(error) {
        if(mounted)setStatus(error?.code==='STORAGE_UNAVAILABLE'?'Per-tab browser storage is unavailable. The synthetic launch cannot continue.':'The synthetic session or redirect is invalid or expired. Start a new simulation.');
      }
    })();
    return()=>{mounted=false;sequence.current++;};
  },[]);

  function end(message='Synthetic session ended.') {
    sequence.current++;
    const previous=activeRef.current;
    if(previous)previous.harness.closeSession(previous.session);
    try { clearSyntheticViewerSession(browserStorage()); } catch {}
    if(owned.current && currentLocal.current===owned.current)onStudyChange?.(null);
    owned.current=null;setPhantom(null);setReference(null);setActive(null);setBusy(false);setStatus(message);
  }
  useEffect(()=>{
    if(!active)return;
    const delay=Math.max(0,active.session.expiresAt-Date.now());
    const timer=setTimeout(()=>end('Synthetic session expired. Start a new simulation.'),delay);
    return()=>clearTimeout(timer);
  },[active]);

  async function start() {
    setBusy(true);setStatus('Preparing the synthetic redirect…');
    try {
      const next=await prepareSyntheticRedirect({storage:browserStorage(),pageUrl:location.href,
        options:{tenantKey:'synthetic-a',persona,launchKind,fhirVersion:version}});
      location.assign(next.url);
    } catch(error) {
      setBusy(false);setStatus(error?.code==='STORAGE_UNAVAILABLE'?'Per-tab browser storage is unavailable. The synthetic launch cannot continue.':'The synthetic launch could not be started in this viewer.');
    }
  }
  async function openPhantom() {
    if(!active)return;
    const id=++sequence.current, previous=currentLocal.current;
    setBusy(true);setStatus('Generating a synthetic test image…');
    try {
      const value=await syntheticViewerPhantom(active.harness,active.session);
      if(id!==sequence.current)return;
      if(currentLocal.current!==previous){setStatus('The active study changed; the synthetic image was not opened.');return;}
      owned.current=value.input.volume;setPhantom(value.input.volume);setFrame(0);
      onStudyChange?.(value.input.volume);onFrameChange?.(0);
      setStatus('Synthetic image open. It is generated test data, not a DICOM scan or patient record.');
    } catch {
      if(id===sequence.current)setStatus('The synthetic image could not be prepared. Any other open study was retained.');
    } finally {if(id===sequence.current)setBusy(false);}
  }
  const phantomActive=!!phantom&&localStudy===phantom;
  useEffect(()=>{
    if(!phantomActive||!canvas.current)return;
    const element=canvas.current,[,rows,cols]=phantom.descriptor.shape,c=phantom.descriptor.calibration;
    element.width=cols;element.height=rows;
    const ctx=element.getContext('2d'), image=ctx.createImageData(cols,rows);
    verifiedFrameRgba(phantom,frame,c.center,c.width,image.data);ctx.putImageData(image,0,0);
  },[phantomActive,phantom,frame]);

  return <div aria-label="Synthetic SMART demonstration">
    <p>Simulate a MyChart-style patient or Epic-style clinician launch in a local preview. This uses no real provider, sign-in or patient data. Starting reloads the viewer and resets the current unsaved view.</p>
    <label>Simulated launch profile <select value={persona} onChange={e=>setPersona(e.target.value)}>
      <option value="patient">Patient · MyChart style</option><option value="clinician">Clinician · Epic style</option>
    </select></label>
    <label>Launch style <select value={launchKind} onChange={e=>setLaunchKind(e.target.value)}>
      <option value="ehr">From a portal or EHR</option><option value="standalone">Standalone</option>
    </select></label>
    <label>Simulated FHIR version <select value={version} onChange={e=>setVersion(e.target.value)}>
      <option value="4.0.1">R4</option><option value="4.3.0">R4B</option><option value="5.0.0">R5</option>
    </select></label>
    <button type="button" onClick={start} disabled={busy}>Start synthetic SMART</button>{' '}
    {active&&<button type="button" onClick={()=>end()}>End synthetic session</button>}
    <p role="status">{status}</p>
    {active&&reference&&<>
      <p>Simulated {active.session.persona} · FHIR {active.session.fhirVersion} · {reference.resource}. The reference is metadata only; image access and patient matching are not established.</p>
      <button type="button" onClick={openPhantom} disabled={busy}>{busy?'Preparing…':'Open synthetic test image'}</button>
      <p>The optional image is a generated geometric phantom. Its raw-frame hashes are synthetic; it is not an acquired DICOM file or clinical evidence.</p>
      {phantomActive&&<><canvas ref={canvas} aria-label="Synthetic test image frame" style={{width:'100%',maxWidth:320,display:'block',background:'#000',imageRendering:'pixelated'}}/>
        <label>Synthetic frame {frame+1} / {phantom.descriptor.shape[0]} <input aria-label="Synthetic test frame" type="range" min="0" max={phantom.descriptor.shape[0]-1} value={frame} onChange={e=>{const next=Number(e.target.value);setFrame(next);onFrameChange?.(next)}}/></label>
      </>}
    </>}
  </div>;
}
