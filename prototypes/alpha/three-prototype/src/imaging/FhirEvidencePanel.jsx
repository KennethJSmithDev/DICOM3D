import React, {useEffect, useRef, useState} from 'react';
import {readLocalFhirEvidence} from '../../../viewer/src/fhir-evidence-projection.mjs';
import FhirEvidenceView from './FhirEvidenceView.jsx';

export default function FhirEvidencePanel() {
  const [file,setFile] = useState(null), [version,setVersion] = useState('');
  const [result,setResult] = useState(null), [busy,setBusy] = useState(false);
  const [status,setStatus] = useState('No local evidence bundle inspected.');
  const sequence = useRef(0), request = useRef(null);
  useEffect(() => () => { sequence.current++; request.current?.abort(); }, []);

  function cancel() {
    sequence.current++; request.current?.abort(); request.current = null;
    setBusy(false); setStatus('Inspection cancelled. Any earlier result remains available.');
  }

  function inputChanged() {
    sequence.current++; request.current?.abort(); request.current = null; setBusy(false);
    setStatus(result ? 'Input changed. The previous result remains until you inspect again.' : 'Choose a version and a local bundle to inspect.');
  }

  async function inspect() {
    const id = ++sequence.current;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setStatus('Inspecting the local FHIR evidence bundle…');
    try {
      const next = await readLocalFhirEvidence(file, {fhirVersion:version,signal:controller.signal});
      if (id !== sequence.current || controller.signal.aborted) return;
      setResult(next); setStatus('Local evidence is ready to inspect.');
    } catch {
      if (id === sequence.current && !controller.signal.aborted) setStatus('The bundle is invalid, unsupported, too large or conflicts with the chosen version. Any earlier result remains available.');
    } finally {
      if (id === sequence.current) { request.current = null; setBusy(false); }
    }
  }

  return <details style={{marginTop:'0.75rem'}} aria-label="Local FHIR evidence compatibility">
    <summary>Inspect local R4/R4B/R5 imaging evidence</summary>
    <p>Choose the source version and a FHIR Bundle JSON file. The version is your selection, not detected from the records. Files stay on this device and are not sent to a server.</p>
    <label>FHIR source version <select value={version} onChange={event => {inputChanged();setVersion(event.target.value);}}>
      <option value="">Choose a version</option><option value="4.0">FHIR R4 (4.0.x)</option><option value="4.3">FHIR R4B (4.3.x)</option><option value="5.0">FHIR R5 (5.0.x)</option>
    </select></label>
    <label style={{display:'block',marginTop:'0.75rem'}}>Local FHIR Bundle JSON <input type="file" accept=".json,application/json" onChange={event => {inputChanged();setFile(event.target.files?.[0] ?? null);}} /></label>
    <button type="button" style={{marginTop:'0.5rem'}} onClick={inspect} disabled={busy || !file || !version}>Inspect local evidence</button>{' '}
    {busy && <button type="button" onClick={cancel}>Cancel evidence inspection</button>}
    <p role="status">{status}</p>
    {result && <>
      <p>This is a limited compatibility view of the original file, not a conversion to FHIR R5 or a FHIR conformance check.</p>
      <FhirEvidenceView projection={result.projection}/>
      <details><summary>Local source fingerprint</summary><p>{result.provenance.bytes} bytes · SHA-256 {result.provenance.sha256}</p></details>
    </>}
  </details>;
}
