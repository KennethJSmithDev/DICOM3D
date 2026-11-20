import React, {useEffect, useMemo, useRef, useState} from 'react';
import {prepareResearchR5Evidence} from './research-r5-loader.mjs';
import {projectFhirEvidence} from '../../../viewer/src/fhir-evidence-projection.mjs';
import FhirEvidenceView from './FhirEvidenceView.jsx';

export default function ResearchEvidencePanel({study, sourceEncoding, frame, admissionGeneration, admissionId}) {
  const [graph, setGraph] = useState(null), [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const request = useRef(null), sequence = useRef(0);
  useEffect(() => {
    sequence.current++;
    setGraph(null); setSelected(''); setStatus(''); setBusy(false);
    return () => { sequence.current++; request.current?.abort(); request.current = null; };
  }, [study, sourceEncoding, admissionId]);

  async function prepare() {
    const id = ++sequence.current, generation = admissionGeneration.current;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setGraph(null); setSelected(''); setBusy(true); setStatus('Verifying the public H000 evidence mapping…');
    try {
      const appBase = new URL(import.meta.env.BASE_URL, globalThis.location.href).pathname;
      const result = await prepareResearchR5Evidence({study, sourceEncoding, generation,
        currentGeneration: () => admissionGeneration.current, appBase, pageUrl: globalThis.location.href, signal: controller.signal});
      if (id !== sequence.current || generation !== admissionGeneration.current || controller.signal.aborted) return;
      setGraph(result); setSelected('ImagingStudy/r5p-h000-ct');
      setStatus('Verified H000 research evidence is ready to inspect.');
    } catch (error) {
      if (id === sequence.current && generation === admissionGeneration.current && !controller.signal.aborted) {
        setStatus(error?.code === 'UNSUPPORTED_RESEARCH_SOURCE' || error?.code === 'SOURCE_ENCODING_REQUIRED'
          ? 'This preview requires the qualified public H000 admission request and stored values.'
          : 'Evidence could not be verified. The open CT was not changed.');
      }
    } finally {
      if (id === sequence.current) { request.current = null; setBusy(false); }
    }
  }

  const resource = graph?.resources.find(item => `${item.resourceType}/${item.id}` === selected);
  const mappedFrame = graph?.sourceMap.segFrames[frame];
  const projection = useMemo(() => {
    if (!graph) return null;
    try { return projectFhirEvidence(graph.bundle, {fhirVersion:'5.0.0'}); }
    catch { return null; }
  }, [graph]);
  return <details>
    <summary>FHIR R5 research evidence · public H000</summary>
    <p>This offline preview is limited to the qualified public H000 packet. It does not connect to IRIS or a FHIR server.</p>
    {!sourceEncoding && <p>Use an admission request with its original source encoding to prepare this preview.</p>}
    <button type="button" onClick={prepare} disabled={!sourceEncoding || busy}>{busy ? 'Verifying…' : 'Prepare evidence preview'}</button>
    <p role="status">{status}</p>
    {graph && <>
      <p>The graph describes a historically qualified retrieval; it does not establish how the current local files reached this browser. The source SEG was qualified separately from the CT retrieval. The Patient entry is synthetic administrative context, not the scan's demographics.</p>
      {mappedFrame && <p>Current CT frame {frame + 1}: source SEG frame {mappedFrame.segFrame}, with {mappedFrame.nonzeroVoxels} source mask voxels. This local CT view does not load or display that mask.</p>}
      <label>Research resource <select aria-label="FHIR research resource" value={selected} onChange={event => setSelected(event.target.value)}>
        {graph.resources.map(item => <option key={`${item.resourceType}/${item.id}`} value={`${item.resourceType}/${item.id}`}>{item.resourceType} · {item.id}</option>)}
      </select></label>
      <details><summary>Inspect selected resource JSON</summary><pre style={{maxHeight:'20rem', overflow:'auto', whiteSpace:'pre-wrap', overflowWrap:'anywhere'}}>{JSON.stringify(resource, null, 2)}</pre></details>
      <details><summary>Inspect version-aware source references</summary>{projection ? <FhirEvidenceView projection={projection}/> : <p>Source-reference projection is unavailable; the verified graph is unchanged.</p>}</details>
      <p>No resource has been sent, stored in a FHIR repository, clinically validated or linked to a patient-specific atlas.</p>
    </>}
  </details>;
}
