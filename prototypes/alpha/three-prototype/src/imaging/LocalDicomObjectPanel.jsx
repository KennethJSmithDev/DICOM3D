import React, {useEffect, useRef, useState} from 'react';
import {localObjectFileLimit, readLocalDicomObject} from './local-dicom-object.mjs';

const labels = {
  RTPlanLabel: 'Plan label',
  RTPlanName: 'Plan name',
  RTPlanGeometry: 'Plan geometry',
  BeamNumber: 'Beam number',
  BeamName: 'Beam name',
  RadiationType: 'Radiation type',
  NumberOfControlPoints: 'Recorded control points',
  FractionGroupNumber: 'Fraction group number',
  NumberOfFractionsPlanned: 'Recorded planned fractions',
  NumberOfBeams: 'Recorded beam count',
  NumericValue: 'Source numeric value',
  ReferencedSOPInstanceUID: 'Referenced SOP instance',
  CodeMeaning: 'Code meaning',
};

function Fields({values}) {
  const entries = Object.entries(values);
  return entries.length > 0 && <ul>{entries.map(([key, value]) => (
    <li key={key}><strong>{labels[key] ?? key}</strong> {value}</li>
  ))}</ul>;
}

function Codes({codes}) {
  return codes?.map((code, index) => <Fields values={code} key={index}/>);
}

function References({items}) {
  return items.length > 0 && <details><summary>Source references</summary>
    <ul>{items.map((ref, index) => <li key={index}>{ref.sequence}
      <Fields values={ref.values}/><References items={ref.references}/>
    </li>)}</ul>
  </details>;
}

function StructuredItem({item, root = false}) {
  const title = item.concepts.find(concept => concept.CodeMeaning)?.CodeMeaning;
  return <details open={root || undefined}>
    <summary>{title ? title + ' · ' : ''}{item.type}{item.relationship ? ' · ' + item.relationship : ''}</summary>
    {item.limited && <p>Value display unavailable for this content type.</p>}
    <Fields values={item.values}/>
    <Codes codes={item.concepts}/>
    <Codes codes={item.codedValues}/>
    <Codes codes={item.qualifiers}/>
    {item.measurements?.map((measurement, index) => <div key={index}>
      <Fields values={measurement.values}/><Codes codes={measurement.units}/>
    </div>)}
    <References items={item.references}/>
    {item.children.map((child, index) => <StructuredItem item={child} key={index}/>)}
  </details>;
}

function Plan({plan}) {
  return <>
    <Fields values={plan.fields}/>
    <details open><summary>Recorded beams ({plan.beams.length})</summary>
      {plan.beams.map((beam, index) => <Fields key={index} values={beam}/>)}
    </details>
    <details><summary>Recorded fraction groups ({plan.fractions.length})</summary>
      {plan.fractions.map((group, index) => <div key={index}>
        <Fields values={group.fields}/><References items={group.references}/>
      </div>)}
    </details>
    <References items={plan.references}/>
  </>;
}

export default function LocalDicomObjectPanel() {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function load(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const id = ++generation.current;
    setStatus('Checking prepared DICOM object…');
    try {
      if (file.size > localObjectFileLimit) throw new Error('File exceeds size limit');
      const value = await readLocalDicomObject(JSON.parse(await file.text()));
      if (generation.current !== id) return;
      setResult(value);
      setStatus('Prepared DICOM object verified.');
    } catch {
      if (generation.current === id) setStatus('The prepared DICOM object could not be verified. The current object, if any, was kept.');
    }
  }

  return <details>
    <summary>Local structured report or RT plan</summary>
    <p>Open a prepared .d3obj file to inspect recorded content and source references. For research review only.</p>
    <label>Prepared DICOM object <input aria-label="Prepared DICOM object" type="file"
      accept=".d3obj,application/json" onChange={load}/></label>
    <p role="status">{status}</p>
    {result && <section style={{overflowWrap:'anywhere'}}>
      <button type="button" onClick={() => { generation.current++; setResult(null); setStatus(''); }}>Clear DICOM object</button>
      <h3>{result.source.family === 'SR' ? 'DICOM structured report' : 'RT plan source metadata'}</h3>
      {result.source.family === 'SR' ? <StructuredItem item={result.content} root/> : <Plan plan={result.content}/>}
      <details><summary>Original object identity</summary>
        <p>Original DICOM SHA-256 <code>{result.source.sha256}</code></p>
        <p>SOP class <code>{result.source.sopClassUID}</code></p>
        <p>SOP instance <code>{result.source.sopInstanceUID}</code></p>
        <p>Transfer syntax <code>{result.source.transferSyntaxUID}</code></p>
      </details>
    </section>}
  </details>;
}
