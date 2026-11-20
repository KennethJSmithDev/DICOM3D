import React, {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {CaseFigures} from '../placenta/PregnancyUltrasoundExamples.jsx';
import {ultrasoundExamples} from '../placenta/ultrasound-examples.mjs';
import {h001PelvicOwners} from './h001-pelvic-owners.mjs';
import './h001-study.css';

const FetalBrainExplorer = lazy(() => import('./fetal-mri/FetalBrainExplorer.jsx'));
const MyomaExplorer = lazy(() => import('./myoma/MyomaExplorer.jsx'));
const DevelopmentReference = lazy(() => import('../placenta/PlacentaReference.jsx'));

function RelatedReference({variant, onClose, rendererProps}) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element.showModal();
    return () => {element.close(); if (opener?.isConnected) opener.focus({preventScroll:true});};
  }, []);
  return <dialog ref={dialog} className="h001-reference-dialog" aria-label="Independent anatomy reference"
    onCancel={event => {event.preventDefault(); onClose();}}>
    <button type="button" autoFocus onClick={onClose}>Return to H001 ultrasound</button>
    <Suspense fallback={<p role="status">Opening anatomy reference…</p>}>
      <DevelopmentReference {...rendererProps} variant={variant} embedded/>
    </Suspense>
  </dialog>;
}

function UltrasoundComparison() {
  const [split, setSplit] = useState(50);
  const credit = ultrasoundExamples[0];
  return <section className="h001-comparison" aria-label="Ultrasound figure comparison">
    <label className="h001-split">Figure width balance
      <input type="range" min="30" max="70" value={split}
        aria-valuetext={split + '% for Figure 1, ' + (100 - split) + '% for Figure 2'}
        onChange={event => setSplit(Number(event.target.value))}/>
    </label>
    <div className="h001-pair" style={{'--first-width': split+'fr', '--second-width': (100-split)+'fr'}}>
      {ultrasoundExamples.map(example => <figure key={example.id}>
        <strong>{example.title}</strong>
        <img src={example.url} alt={example.alt} width={example.width} height={example.height}/>
        <figcaption>{example.caption}</figcaption>
      </figure>)}
    </div>
    <small>{credit.author} · <a href={credit.source}>Original images and case description</a> · <a href={credit.licenseUrl}>{credit.license}</a></small>
  </section>;
}

export function H001Study({compact, figure, onFigure, onPelvis, pelvicOwner, setPelvicOwner, pelvisAvailable, rendererProps, showMRI, setShowMRI, onLearn, reviewState}) {
  const [reference, setReference] = useState(null);
  const [compare, setCompare] = useState(false);
  const entry = useRef(null);
  const myomaEntry = useRef(null);
  const returnButton = useRef(null);
  const visited = useRef(false);
  useEffect(() => {
    if (showMRI) {
      visited.current = showMRI;
      returnButton.current?.focus();
    } else if (visited.current) {
      (visited.current === 'myoma' ? myomaEntry : entry).current?.focus();
    }
  }, [showMRI]);

  if (showMRI) return <article className="h001-study" aria-label={showMRI === 'myoma' ? 'Uterine fibroid MRI reference' : 'Fetal brain MRI reference'}>
    <button ref={returnButton} type="button" onClick={() => setShowMRI(false)}>Return to H001 ultrasound</button>
    <button type="button" onClick={onLearn}>Learn about this MRI</button>
    <Suspense fallback={<p role="status">Opening MRI explorer…</p>}>
      {showMRI === 'myoma' ? <MyomaExplorer compact={compact} rendererProps={rendererProps} reviewState={reviewState}/> : <FetalBrainExplorer rendererProps={rendererProps}/>}
    </Suspense>
  </article>;

  return <article className="h001-study" aria-labelledby="h001-title">
    <div className="h001-heading"><h2 id="h001-title">H001 · Twin pregnancy and uterine fibroid</h2>
      <p>Look at the twins in Figure 1, then choose Figure 2 to see the fibroid in the front wall of the uterus.</p></div>
    <div className="h001-case-actions">
      <button className="h001-mri-entry" type="button" onClick={onLearn}>Learn about this case</button>
      <button type="button" ref={myomaEntry} onClick={() => setShowMRI('myoma')}>Explore a fibroid in 3D</button>
      <button type="button" aria-expanded={compare} onClick={() => setCompare(open => !open)}>
        {compare ? 'Return to selected figure' : 'Compare ultrasound figures'}
      </button>
    </div>
    {compare ? <UltrasoundComparison/> : <CaseFigures label="Case figure" selected={figure} onSelect={onFigure}/>}
    <nav aria-label="Related teaching anatomy">
      <button type="button" ref={entry} onClick={() => setShowMRI(true)}>Explore fetal brain MRI</button>
      <label>Female atlas structure
        <select value={pelvicOwner} onChange={event=>setPelvicOwner(event.target.value)}>
          {h001PelvicOwners.map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <button type="button" onClick={()=>onPelvis(pelvicOwner)} disabled={!pelvisAvailable}>Explore female pelvic anatomy</button>
      <button type="button" onClick={() => onPelvis(pelvicOwner, true)} disabled={!pelvisAvailable}>Compare ultrasound with pelvic atlas</button>
      <button type="button" aria-haspopup="dialog" onClick={()=>setReference('placenta')}>Placenta and umbilical cord</button>
      <button type="button" aria-haspopup="dialog" onClick={()=>setReference('embryo')}>Embryonic development</button>
    </nav>
    <p>The anatomy models and MRI examples come from independent sources. Each uses its own scale and position.</p>
    {reference && <RelatedReference variant={reference} onClose={()=>setReference(null)} rendererProps={rendererProps}/>}
  </article>;
}

export function H001PelvicCompanion({figure, onFigure, onReturn}) {
  return <section className="h001-companion" aria-label="H001 ultrasound comparison">
    <button type="button" onClick={onReturn}>Return to H001 ultrasound</button>
    <h2>H001 ultrasound</h2>
    <CaseFigures label="Comparison case figure" selected={figure} onSelect={onFigure}/>
    <p>The illustrations in the female atlas use a separate reference body. Their position and scale are independent of this ultrasound.</p>
  </section>;
}

export function H001Evidence({showMRI}) {
  if (showMRI === 'myoma') return <section className="panel" aria-labelledby="h001-evidence" tabIndex={-1}>
    <h2 id="h001-evidence">Uterine MRI evidence</h2>
    <p>Haixia Pan and colleagues published a sagittal MRI series with expert tissue labels. In case UMD_221129_001, label 3 identifies the myoma. The MRI overlay and 3D surface use the selected tissue from the same segmentation.</p>
    <a href="https://doi.org/10.6084/m9.figshare.23541312.v3" target="_blank" rel="noreferrer">Read the UMD dataset record</a>
  </section>;
  if (showMRI) return <section className="panel" aria-labelledby="h001-evidence" tabIndex={-1}>
    <h2 id="h001-evidence">Fetal brain MRI evidence</h2>
    <p>The 22-week template comes from the CRL fetal brain atlas. Its T2-weighted MRI and matching tissue labels share a source grid. The 3D view follows those labeled voxels.</p>
    <p>This population reference is independent of the two H001 ultrasound figures.</p>
    <a href="https://doi.org/10.7910/DVN/QOO75G" target="_blank" rel="noreferrer">Read the MRI dataset record</a>
  </section>;
  return <section className="panel" aria-labelledby="h001-evidence" tabIndex={-1}>
    <h2 id="h001-evidence">H001 case evidence</h2>
    <p>Fariha Altaf and Biza Akbar published both figures in <i>Cureus</i> in 2026. Figure 1 shows the twin pregnancy; Figure 2 shows the anterior uterine-wall fibroid described in their report.</p>
    <p>The two published stills preserve the original ultrasound markings. The available files contain no DICOM series, segmentation or spatial mapping to the 3D references.</p>
    <a href="https://doi.org/10.7759/cureus.113224" target="_blank" rel="noopener noreferrer">Read the original case report</a>
  </section>;
}
