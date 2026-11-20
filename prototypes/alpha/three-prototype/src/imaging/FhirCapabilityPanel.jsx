import React, {Suspense,useEffect, useRef, useState} from 'react';
import {readLocalFhirCapabilities, readPublicFhirCapabilities} from './fhir-capabilities.mjs';
import {SYNTHETIC_CALLBACK_PARAMS,SYNTHETIC_SESSION_KEY} from '../../../viewer/src/smart-synthetic-keys.mjs';
import FhirEvidencePanel from './FhirEvidencePanel.jsx';
import FhirConversionAuditPanel from './FhirConversionAuditPanel.jsx';
import Hl7FhirDraftPanel from './Hl7FhirDraftPanel.jsx';
import FhirLivePanel from './FhirLivePanel.jsx';
const SmartSyntheticPanel=React.lazy(()=>import('./SmartSyntheticPanel.jsx'));
const EpicSandboxPanel=React.lazy(()=>import('./EpicSandboxPanel.jsx'));

function syntheticState() {
  const callback=SYNTHETIC_CALLBACK_PARAMS.some(key=>new URLSearchParams(location.search).has(key));
  let saved=false;try{saved=!!sessionStorage.getItem(SYNTHETIC_SESSION_KEY);}catch{}
  return {open:callback||saved,reveal:callback||(saved&&location.hash==='#imaging')};
}

function failureMessage(error, kind) {
  if (kind === 'local') return 'The local capability statement is invalid, too large or unsupported.';
  const message = String(error?.message ?? '');
  if (message.includes('ACCESS_DENIED')) return 'The public test server denied access.';
  if (message.includes('TIMEOUT')) return 'The public test server did not respond in time.';
  if (message.includes('TRANSPORT_OR_CORS')) return 'The public test server could not be reached from this browser.';
  return 'The public test capability statement could not be read or is unsupported.';
}

export default function FhirCapabilityPanel({study,localStudy,onSyntheticReturn,onSyntheticStudyChange,onSyntheticFrameChange,epicSandboxMailbox}) {
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('No server information loaded.'), [query, setQuery] = useState('');
  const [file, setFile] = useState(null);
  const [initialSynthetic]=useState(syntheticState),[syntheticOpen,setSyntheticOpen]=useState(initialSynthetic.open),[syntheticMounted,setSyntheticMounted]=useState(initialSynthetic.open);
  const [initialEpic]=useState(()=>Boolean(epicSandboxMailbox?.current)),[epicOpen,setEpicOpen]=useState(initialEpic),[epicMounted,setEpicMounted]=useState(initialEpic);
  const sequence = useRef(0), request = useRef(null);
  useEffect(() => () => { sequence.current++; request.current?.abort(); }, []);
  useEffect(() => {if(initialSynthetic.reveal||initialEpic)onSyntheticReturn?.();},[]);

  function cancel() {
    sequence.current++; request.current?.abort(); request.current = null;
    setBusy(false); setStatus('Request cancelled. Any earlier result remains available.');
  }

  function selectFile(event) {
    sequence.current++; request.current?.abort(); request.current = null; setBusy(false);
    setFile(event.target.files?.[0] ?? null);
    setStatus(result ? 'Input changed. The previous result remains until you inspect again.' : 'Choose a local statement to inspect.');
  }

  async function inspect(kind) {
    const id = ++sequence.current;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setStatus(kind === 'local' ? 'Reading the local capability statement…' : 'Reading the public test server capability statement…');
    try {
      const next = kind === 'local' ? await readLocalFhirCapabilities(file, {signal:controller.signal}) : await readPublicFhirCapabilities({signal: controller.signal});
      if (id !== sequence.current || controller.signal.aborted) return;
      setResult(next); setQuery('');
      setStatus(kind === 'local' ? 'Local capability statement is ready.' : 'Public test server information is ready.');
    } catch (error) {
      if (id === sequence.current && !controller.signal.aborted) setStatus(`${failureMessage(error, kind)} Any earlier result remains available.`);
    } finally {
      if (id === sequence.current) { request.current = null; setBusy(false); }
    }
  }

  const resources = result?.capability.resources.filter(item => `${item.type} ${item.mode} ${item.interactions.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())) ?? [];
  return <section className="panel" aria-label="FHIR capability information">
    <details>
      <summary>FHIR capability information</summary>
      <p>Inspect the public SMART FHIR R4 test server or an exported local R4, R4B or R5 CapabilityStatement. Local files stay on this device; this capability inspector does not read patient records.</p>
      <button type="button" onClick={() => inspect('public')} disabled={busy}>Inspect public test server</button>{' '}
      <label style={{display:'block', marginTop:'0.75rem'}}>Local CapabilityStatement JSON <input type="file" accept=".json,application/json" onChange={selectFile} /></label>
      <button type="button" style={{marginTop:'0.5rem'}} onClick={() => inspect('local')} disabled={busy || !file}>Inspect local statement</button>{' '}
      {busy && <button type="button" onClick={cancel}>Cancel server inspection</button>}
      <p role="status">{status}</p>
      {result && <>
        <p>FHIR {result.capability.fhirVersion} · statement kind: {result.capability.kind}. The source describes capabilities, not your access or proof that an operation works. This view does not generate OpenAPI.</p>
        <label>Filter declared resources <input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <p>{resources.length} of {result.capability.resources.length} declared resource entries shown.</p>
        {resources.length > 0 ? <div style={{overflowX:'auto'}}><table style={{width:'100%', textAlign:'left', borderSpacing:'0.75rem 0.35rem'}}>
          <caption>Declared resource interactions</caption>
          <thead><tr><th scope="col">Resource</th><th scope="col">Mode</th><th scope="col">Declared interactions</th></tr></thead>
          <tbody>{resources.map((item, index) => <tr key={`${item.mode}-${item.type}-${index}`}><td>{item.type}</td><td>{item.mode}</td><td>{item.interactions.join(', ') || 'None listed'}</td></tr>)}</tbody>
        </table></div> : <p>No matching resource entries were declared.</p>}
        <details><summary>Source and system interactions</summary>
          <p>{result.provenance.kind === 'public-test' ? `Public test URL: ${result.provenance.url}` : 'Local file, read on this device only'}</p><p>Read: {result.provenance.retrievedAt} · {result.provenance.bytes} bytes · SHA-256 {result.provenance.sha256}</p>
          {result.capability.systems.map((item, index) => <p key={index}>{item.mode}: {item.interactions.join(', ') || 'No system interactions listed'}</p>)}
        </details>
      </>}
    </details>
    <details style={{marginTop:'0.75rem'}} aria-label="Synthetic SMART launch" open={syntheticOpen} onToggle={event=>{const open=event.currentTarget.open;setSyntheticOpen(open);if(open)setSyntheticMounted(true);}}>
      <summary>Try a synthetic SMART launch</summary>
      {syntheticMounted&&<Suspense fallback={<p role="status">Preparing the synthetic demonstration…</p>}><SmartSyntheticPanel localStudy={localStudy} onStudyChange={onSyntheticStudyChange} onFrameChange={onSyntheticFrameChange}/></Suspense>}
    </details>
    <details style={{marginTop:'0.75rem'}} aria-label="Epic sandbox connection" open={epicOpen} onToggle={event=>{const open=event.currentTarget.open;setEpicOpen(open);if(open)setEpicMounted(true);}}>
      <summary>Connect Epic sandbox (test data)</summary>
      {epicMounted&&<Suspense fallback={<p role="status">Preparing the sandbox connection...</p>}><EpicSandboxPanel mailbox={epicSandboxMailbox}/></Suspense>}
    </details>
    <FhirLivePanel study={study}/>
    <FhirEvidencePanel/>
    <FhirConversionAuditPanel/>
    <Hl7FhirDraftPanel/>
  </section>;
}
