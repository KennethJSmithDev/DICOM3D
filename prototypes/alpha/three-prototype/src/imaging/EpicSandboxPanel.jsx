import React,{useEffect,useRef,useState} from 'react';
import {prepareEpicSandboxLaunch,finishEpicSandboxCallback,searchEpicSandboxStudies,closeEpicSandboxSession} from '../../../viewer/src/epic-sandbox.mjs';
import {EPIC_SANDBOX_PENDING_KEY,EPIC_SANDBOX_REDIRECT} from '../../../viewer/src/epic-sandbox-callback.mjs';

function message(error) {
  switch(error?.code) {
    case 'INVALID_REDIRECT': return 'Open this viewer at the registered local address shown below.';
    case 'INVALID_CLIENT_ID': return 'Enter the non-production client ID from your own Epic registration.';
    case 'STORAGE_UNAVAILABLE': return 'This browser must allow per-tab session storage for the redirect.';
    case 'ACCESS_DENIED': return 'The sandbox did not authorize the request.';
    case 'NO_PATIENT_CONTEXT': return 'The sandbox did not supply a patient context.';
    case 'SCOPE_NOT_GRANTED': return 'The sandbox did not grant the requested study-search permission.';
    case 'EXPIRED_SESSION': return 'The sandbox session expired. Connect again.';
    case 'TIMEOUT': return 'The sandbox did not respond in time.';
    case 'CANCELLED': return 'The request was cancelled.';
    case 'INVALID_CALLBACK': return 'The sandbox return was invalid, expired, or already used. Connect again.';
    case 'UNSUPPORTED_SANDBOX': return 'The sandbox configuration is different from the expected test environment.';
    default: return 'The sandbox request could not be completed. No production service was contacted.';
  }
}

export default function EpicSandboxPanel({mailbox}) {
  const [clientId,setClientId]=useState(''),[session,setSession]=useState(null),[studies,setStudies]=useState(null);
  const [busy,setBusy]=useState(false),[status,setStatus]=useState('No Epic sandbox session active.');
  const active=useRef(null),request=useRef(null),sequence=useRef(0);

  useEffect(()=>{
    const callback=mailbox?.current;
    if(!callback)return;
    mailbox.current=null;
    const id=++sequence.current,controller=new AbortController();request.current=controller;
    setBusy(true);setStatus('Completing the sandbox return…');
    const task=finishEpicSandboxCallback(callback,{signal:controller.signal});
    callback.code=null;callback.pending=null;
    task.then(value=>{
      if(id!==sequence.current||controller.signal.aborted){closeEpicSandboxSession(value);return;}
      active.current=value;setSession(value);
      setStatus(value.hasPatient&&value.canSearch?'Epic sandbox session connected. You can look for test imaging studies.':'Epic sandbox connected, but patient context or study-search permission was not supplied.');
    }).catch(error=>{if(id===sequence.current&&!controller.signal.aborted)setStatus(message(error));})
      .finally(()=>{if(id===sequence.current){request.current=null;setBusy(false);}});
    return()=>{sequence.current++;controller.abort();};
  },[]);

  useEffect(()=>()=>{sequence.current++;request.current?.abort();if(active.current)closeEpicSandboxSession(active.current);},[]);
  useEffect(()=>{
    if(!session)return;
    const timer=setTimeout(()=>end('Sandbox session expired. Connect again.'),Math.max(0,session.expiresAt-Date.now()));
    return()=>clearTimeout(timer);
  },[session]);

  function end(text='Local sandbox session ended.') {
    sequence.current++;request.current?.abort();request.current=null;
    if(active.current)closeEpicSandboxSession(active.current);
    active.current=null;setSession(null);setStudies(null);setBusy(false);setStatus(text);
  }

  async function connect() {
    const id=++sequence.current,controller=new AbortController();request.current=controller;
    setBusy(true);setStatus('Checking the Epic sandbox…');
    try {
      const launch=await prepareEpicSandboxLaunch({clientId:clientId.trim(),pageUrl:location.href,storage:sessionStorage,signal:controller.signal});
      if(id!==sequence.current||controller.signal.aborted){try{sessionStorage.removeItem(EPIC_SANDBOX_PENDING_KEY)}catch{}return;}
      setClientId('');location.assign(launch.authorizationUrl);
    } catch(error) {
      if(id===sequence.current&&!controller.signal.aborted)setStatus(message(error));
    } finally {if(id===sequence.current){request.current=null;setBusy(false);}}
  }

  async function search() {
    const id=++sequence.current,controller=new AbortController();request.current=controller;
    setBusy(true);setStatus('Looking for sandbox imaging studies…');
    try {
      const result=await searchEpicSandboxStudies(session,{signal:controller.signal});
      if(id===sequence.current&&!controller.signal.aborted){setStudies(result);setStatus('Sandbox study metadata loaded.');}
    } catch(error) {if(id===sequence.current&&!controller.signal.aborted)setStatus(message(error));}
    finally {if(id===sequence.current){request.current=null;setBusy(false);}}
  }

  return <div aria-label="Epic sandbox connection controls">
    <p>Connect only to Epic's public test environment using its synthetic test accounts. This first integration is a patient-facing R4 launch; clinician/EHR launch is not yet qualified.</p>
    <p>A connection reloads the viewer and resets its unsaved view. The session stays in this tab's memory and ends on reload or when you disconnect. Study metadata does not include image pixels.</p>
    <p>Register this exact local callback: <code>{EPIC_SANDBOX_REDIRECT}</code></p>
    {!session&&<><label>Epic non-production client ID <input value={clientId} onChange={event=>setClientId(event.target.value)} autoComplete="off" spellCheck="false" /></label>{' '}
      <button type="button" onClick={connect} disabled={busy||!clientId.trim()}>Connect Epic sandbox</button></>}
    {session&&<><button type="button" onClick={search} disabled={busy||!session.hasPatient||!session.canSearch}>Find sandbox imaging studies</button>{' '}
      <button type="button" onClick={()=>end()}>End local sandbox session</button></>}
    {busy&&<button type="button" onClick={()=>end('The sandbox request was cancelled.')}>Cancel sandbox request</button>}
    <p role="status">{status}</p>
    {studies&&<><p>{studies.studies.length} study {studies.studies.length===1?'reference':'references'} shown.{studies.moreAvailable?' More results may be available.':''}</p>
      {studies.studies.length>0&&<ul>{studies.studies.map(item=><li key={item.reference}>{item.reference} · {item.status}</li>)}</ul>}
      <p>These are sandbox references, not scans. Viewing images requires a separately authorized imaging source.</p></>}
  </div>;
}
