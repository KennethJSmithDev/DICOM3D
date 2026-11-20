import React, {useEffect, useRef, useState} from 'react';
import {readLocalConversionAudit} from '../../../viewer/src/fhir-conversion-audit.mjs';

export default function FhirConversionAuditPanel() {
  const [source,setSource]=useState(null), [converted,setConverted]=useState(null);
  const [sourceVersion,setSourceVersion]=useState('4.0.1');
  const [result,setResult]=useState(null), [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('Choose both local bundles to compare them.');
  const sequence=useRef(0), request=useRef(null);
  useEffect(() => () => { sequence.current++; request.current?.abort(); }, []);

  function inputChanged(setter, file) {
    sequence.current++; request.current?.abort(); request.current=null;
    setBusy(false); setResult(null); setter(file);
    setStatus('Input changed. Choose both bundles and compare again.');
  }
  function cancel() {
    sequence.current++; request.current?.abort(); request.current=null;
    setBusy(false); setStatus('Comparison cancelled.');
  }
  async function inspect() {
    const id=++sequence.current;
    request.current?.abort(); const controller=new AbortController(); request.current=controller;
    setBusy(true); setStatus('Comparing selected imaging details…');
    try {
      const next=await readLocalConversionAudit(source,converted,{signal:controller.signal,sourceVersion});
      if (id!==sequence.current || controller.signal.aborted) return;
      setResult(next);
      setStatus(next.audit.findings.length ? 'Differences need review.' : next.audit.checkedResources ? 'Selected checks completed.' : 'No comparable imaging resources were found.');
    } catch {
      if (id===sequence.current && !controller.signal.aborted) {
        setResult(null); setStatus('Could not compare these bundles. Check their versions, format and size.');
      }
    } finally {
      if (id===sequence.current) { request.current=null; setBusy(false); }
    }
  }

  return <details style={{marginTop:'0.75rem'}} aria-label="Compare a FHIR conversion">
    <summary>Compare an R4/R4B-to-R5 conversion</summary>
    <p>Choose the source version, original Bundle and converted R5 Bundle. Both files stay on this device. This checks selected imaging identities and report-to-study references; it does not convert files or detect their versions.</p>
    <label style={{display:'block'}}>Original FHIR version <select value={sourceVersion} onChange={event=>inputChanged(setSourceVersion,event.target.value)}><option value="4.0.1">FHIR R4 (4.0.1)</option><option value="4.3.0">FHIR R4B (4.3.0)</option></select></label>
    <label style={{display:'block'}}>Original R4/R4B Bundle JSON <input type="file" accept=".json,application/json" onChange={event=>inputChanged(setSource,event.target.files?.[0] ?? null)}/></label>
    <label style={{display:'block',marginTop:'0.5rem'}}>Converted R5 Bundle JSON <input type="file" accept=".json,application/json" onChange={event=>inputChanged(setConverted,event.target.files?.[0] ?? null)}/></label>
    <button type="button" style={{marginTop:'0.5rem'}} onClick={inspect} disabled={busy || !source || !converted}>Compare selected bundles</button>{' '}
    {busy && <button type="button" onClick={cancel}>Cancel comparison</button>}
    <p role="status">{status}</p>
    {result && <>
      <p>{result.audit.checkedResources} imaging resources checked. {result.audit.findings.length} difference(s) need review.</p>
      {result.audit.findings.length > 0 && <ul>{result.audit.findings.map((item,index)=><li key={`${item.code}-${index}`}><strong>{item.resource}</strong>: {item.detail}</li>)}</ul>}
      {result.audit.limitations.map((text,index)=><p key={index}>{text}</p>)}
      <details><summary>Local source fingerprints</summary>
        <p>Original: {result.provenance.source.bytes} bytes · SHA-256 {result.provenance.source.sha256}</p>
        <p>Converted: {result.provenance.converted.bytes} bytes · SHA-256 {result.provenance.converted.sha256}</p>
      </details>
    </>}
  </details>;
}
