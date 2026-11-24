import React, {useEffect, useRef, useState} from 'react';
import {ionPlanSopClass, localObjectFileLimit, readLocalDicomObject} from './local-dicom-object.mjs';

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
  ReferencedFrameOfReferenceUID: 'Referenced frame of reference',
  GraphicType: 'Recorded graphic type',
  GraphicData: 'Recorded coordinates',
  StructureSetLabel: 'Structure set label',
  StructureSetName: 'Structure set name',
  ROINumber: 'Region number',
  ROIName: 'Region name',
  ReferencedROINumber: 'Referenced region number',
  ContourGeometricType: 'Recorded contour type',
  NumberOfContourPoints: 'Recorded contour point count',
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

function StructureSet({structure}) {
  return <>
    <p>Recorded region and contour metadata. Outlines appear on their matching verified CT planes when source geometry is available.</p>
    <Fields values={structure.fields}/>
    <details open><summary>Recorded regions ({structure.regions.length})</summary>
      {structure.regions.map(region => <Fields key={region.ROINumber} values={region}/>)}
    </details>
    <details><summary>Recorded contour groups ({structure.contours.length})</summary>
      {structure.contours.map((group, groupIndex) => <div key={groupIndex}>
        <Fields values={group.fields}/>
        {group.items.map((item, itemIndex) => <div key={itemIndex}>
          <Fields values={item.fields}/><References items={item.references}/>
        </div>)}
      </div>)}
    </details>
    <details><summary>Recorded observations ({structure.observations.length})</summary>
      {structure.observations.map((item, index) => <Fields key={index} values={item}/>)}
    </details>
    <References items={structure.references}/>
  </>;
}

function ObjectInspection({source, content}) {
  if (source.family === 'SR') return <><h3>DICOM structured report</h3><StructuredItem item={content} root/></>;
  if (source.family === 'RTSTRUCT') return <><h3>RT structure set source metadata</h3><StructureSet structure={content}/></>;
  return <>
    <h3>{source.sopClassUID === ionPlanSopClass ? 'RT ion plan source metadata' : 'RT plan source metadata'}</h3>
    <Plan plan={content}/>
  </>;
}

export default function LocalDicomObjectPanel({onObjectChange}) {
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
      onObjectChange?.(value.source.family === 'RTSTRUCT' ? value : null);
      setStatus('Prepared DICOM object verified.');
    } catch {
      if (generation.current === id) setStatus('The prepared DICOM object could not be verified. The current object, if any, was kept.');
    }
  }

  return <details>
    <summary>Local structured report or RT plan</summary>
    <p>Open a prepared .d3obj file to inspect a structured report, radiation therapy plan or structure set and its source references. For research review only.</p>
    <label>Prepared DICOM object <input aria-label="Prepared DICOM object" type="file"
      accept=".d3obj,application/json" onChange={load}/></label>
    <p role="status">{status}</p>
    {result && <section style={{overflowWrap:'anywhere'}}>
      <button type="button" onClick={() => { generation.current++; setResult(null); onObjectChange?.(null); setStatus(''); }}>Clear DICOM object</button>
      <ObjectInspection source={result.source} content={result.content}/>
      <details><summary>Original object identity</summary>
        <p>Original DICOM SHA-256 <code>{result.source.sha256}</code></p>
        <p>SOP class <code>{result.source.sopClassUID}</code></p>
        <p>SOP instance <code>{result.source.sopInstanceUID}</code></p>
        <p>Transfer syntax <code>{result.source.transferSyntaxUID}</code></p>
      </details>
    </section>}
  </details>;
}
