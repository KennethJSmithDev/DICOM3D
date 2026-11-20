import React, {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {CaseFigures} from '../placenta/PregnancyUltrasoundExamples.jsx';
import {h001PelvicOwners} from './h001-pelvic-owners.mjs';
import './h001-study.css';

const FetalBrainExplorer = lazy(() => import('./fetal-mri/FetalBrainExplorer.jsx'));

export function H001Study({figure, onFigure, onPelvis, pelvicOwner, setPelvicOwner, pelvisAvailable, webgl, rendererProps}) {
  const renderer = webgl ? '&renderer=webgl' : '';
  const [showMRI, setShowMRI] = useState(false);
  const entry = useRef(null);
  const returnButton = useRef(null);
  const visited = useRef(false);
  useEffect(() => {
    if (showMRI) {
      visited.current = true;
      returnButton.current?.focus();
    } else if (visited.current) {
      entry.current?.focus();
    }
  }, [showMRI]);

  if (showMRI) return <article className="h001-study" aria-label="Fetal brain MRI reference">
    <button ref={returnButton} type="button" onClick={() => setShowMRI(false)}>Return to H001 ultrasound</button>
    <Suspense fallback={<p role="status">Opening fetal MRI explorer…</p>}>
      <FetalBrainExplorer rendererProps={rendererProps}/>
    </Suspense>
  </article>;

  return <article className="h001-study" aria-labelledby="h001-title">
    <div className="h001-heading"><h2 id="h001-title">H001 · Twin pregnancy and uterine fibroid</h2>
      <p>Public teaching case · Two ultrasound figures from one published pregnancy</p></div>
    <CaseFigures label="Case figure" selected={figure} onSelect={onFigure}/>
    <nav aria-label="Related teaching anatomy">
      <button type="button" ref={entry} onClick={() => setShowMRI(true)}>Explore fetal brain MRI</button>
      <label>Female atlas structure
        <select value={pelvicOwner} onChange={event=>setPelvicOwner(event.target.value)}>
          {h001PelvicOwners.map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <button type="button" onClick={()=>onPelvis(pelvicOwner)} disabled={!pelvisAvailable}>Explore female pelvic anatomy</button>
      <a href={`?reference=placenta${renderer}`} target="_blank" rel="noopener noreferrer">Placenta and umbilical cord</a>
      <a href={`?reference=embryo${renderer}`} target="_blank" rel="noopener noreferrer">Embryonic development</a>
    </nav>
    <p>These anatomy references illustrate structures from independent sources. The placenta and developmental references open in separate tabs.</p>
  </article>;
}

export function H001Evidence() {
  return <section className="panel" aria-labelledby="h001-evidence" tabIndex={-1}>
    <h2 id="h001-evidence">H001 case evidence</h2>
    <p>Fariha Altaf and Biza Akbar published both figures in <i>Cureus</i> in 2026. Figure 1 shows the twin pregnancy; Figure 2 shows the anterior uterine-wall fibroid described in their report.</p>
    <p>The two published stills preserve the original ultrasound markings. The available files contain no DICOM series, segmentation or spatial mapping to the 3D references.</p>
    <a href="https://doi.org/10.7759/cureus.113224" target="_blank" rel="noopener noreferrer">Read the original case report</a>
  </section>;
}
