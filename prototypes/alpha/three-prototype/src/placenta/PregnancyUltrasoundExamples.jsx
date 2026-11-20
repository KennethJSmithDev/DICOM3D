import React, {useState} from 'react';
import {ultrasoundExamples} from './ultrasound-examples.mjs';

export default function PregnancyUltrasoundExamples() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('twins');
  return <details className="ultrasound-examples" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Explore public ultrasound examples</summary>
    {open && <>
      <p>These two published ultrasound figures show different views from the same pregnancy. The 3D placenta above is an independent teaching model.</p>
      <CaseFigures label="Ultrasound example" selected={selected} onSelect={setSelected}/>
    </>}
  </details>;
}

export function CaseFigures({label, selected, onSelect}) {
  const example = ultrasoundExamples.find(item => item.id === selected);
  return <>
      <label>{label}
        <select value={selected} onChange={event => onSelect(event.target.value)}>
          {ultrasoundExamples.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <figure>
        <img src={example.url} alt={example.alt} width={example.width} height={example.height}/>
        <figcaption aria-live="polite">
          <p>{example.caption}</p>
          <small>{example.author} · <a href={example.source}>Original image and case description</a> · <a href={example.licenseUrl}>{example.license}</a></small>
        </figcaption>
      </figure>
  </>;
}
