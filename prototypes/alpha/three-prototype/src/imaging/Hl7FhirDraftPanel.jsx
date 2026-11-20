import React, {useEffect, useRef, useState} from 'react';
import {readLocalHl7Draft} from '../../../viewer/src/hl7v2-fhir-draft.mjs';

export default function Hl7FhirDraftPanel() {
  const [file,setFile] = useState(null), [version,setVersion] = useState(''), [system,setSystem] = useState('');
  const [patientSystem,setPatientSystem] = useState('');
  const [result,setResult] = useState(null), [busy,setBusy] = useState(false);
  const [status,setStatus] = useState('No fixture inspected.');
  const sequence = useRef(0), request = useRef(null);
  useEffect(() => () => { sequence.current++; request.current?.abort(); }, []);
  function changed() {
    sequence.current++; request.current?.abort(); request.current = null; setBusy(false);
    setStatus(result ? 'Input changed. The previous draft remains until you inspect again.' : 'Choose a fixture and target version.');
  }
  function cancel() {
    sequence.current++; request.current?.abort(); request.current = null; setBusy(false);
    setStatus('Inspection cancelled. Any earlier draft remains available.');
  }
  async function inspect() {
    const id = ++sequence.current; request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setStatus('Reading the local fixture…');
    try {
      const next = await readLocalHl7Draft(file, {targetVersion:version, facilitySystem:system.trim(), patientSystem:patientSystem.trim(), signal:controller.signal});
      if (id !== sequence.current || controller.signal.aborted) return;
      setResult(next); setStatus('Draft ready for review.');
    } catch {
      if (id === sequence.current && !controller.signal.aborted) setStatus('The fixture, identifier system or target version is invalid or unsupported. Any earlier draft remains available.');
    } finally {
      if (id === sequence.current) { request.current = null; setBusy(false); }
    }
  }
  return <details style={{marginTop:'0.75rem'}} aria-label="HL7 to FHIR fixture draft">
    <summary>Review an HL7-to-FHIR fixture</summary>
    <p>Local test only: inspect an ASCII HL7 2.5 ADT A01 fixture and draft an Organization, plus a Patient when a supported PID segment is present. A PID needs an explicit identifier system; only simple identifier, name, complete birth date and M/F/U administrative-sex fields are supported. Unsupported PID fields are refused. Nothing is sent to a server. This is not general HL7 conversion.</p>
    <label>FHIR draft version <select value={version} onChange={event => {changed();setVersion(event.target.value);}}>
      <option value="">Choose a version</option><option value="4.0.1">FHIR R4 (4.0.1)</option><option value="4.3.0">FHIR R4B (4.3.0)</option><option value="5.0.0">FHIR R5 (5.0.0)</option>
    </select></label>
    <label style={{display:'block',marginTop:'0.75rem'}}>HL7 fixture file <input type="file" accept=".hl7,.txt,text/plain" onChange={event => {changed();setFile(event.target.files?.[0] ?? null);}} /></label>
    <label style={{display:'block',marginTop:'0.75rem'}}>Facility identifier system (optional URI) <input type="text" value={system} onChange={event => {changed();setSystem(event.target.value);}} /></label>
    <label style={{display:'block',marginTop:'0.75rem'}}>Patient identifier system for PID (required URI) <input type="text" value={patientSystem} onChange={event => {changed();setPatientSystem(event.target.value);}} /></label>
    <button type="button" style={{marginTop:'0.5rem'}} onClick={inspect} disabled={busy || !file || !version}>Create local draft</button>{' '}
    {busy && <button type="button" onClick={cancel}>Cancel fixture inspection</button>}
    <p role="status">{status}</p>
    {result && <><p>FHIR {result.targetFhirVersion} · review required. The source control ID is not a FHIR resource ID; no resource has been sent or stored. PID administrative sex is not a claim about gender identity.</p>
      <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(result.resources ?? result.resource,null,2)}</pre>
      <details><summary>Local source fingerprint</summary><p>Message control ID: {result.source.controlId}</p><p>{result.source.bytes} bytes · SHA-256 {result.source.sha256}</p></details>
    </>}
  </details>;
}
