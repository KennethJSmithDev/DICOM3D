import React, {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {fetalSourceNotice, loadFetalBrain, readBrainPixel, renderBrainSlice} from './fetal-brain.mjs';
import './fetal-brain.css';

const TissueSurface = lazy(() => import('./FetalTissueSurface.jsx'));
const planes = {
  axial: {axis: 2, label: 'Axial', description: 'Horizontal cross-section', edges: 'Right to left · front to back'},
  coronal: {axis: 1, label: 'Coronal', description: 'Front-facing cross-section', edges: 'Right to left · top to bottom'},
  sagittal: {axis: 0, label: 'Sagittal', description: 'Side-facing cross-section', edges: 'Front to back · top to bottom'},
};

function tissueName(name) {
  return name.replace(/_L$/, ' (left)').replace(/_R$/, ' (right)')
    .replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function SliceImage({volume, axis, index, opacity, tissueId, onPick}) {
  const canvas = useRef(null);
  useEffect(() => {
    const {width, height, rgba} = renderBrainSlice(volume, {axis, index, opacity, highlightId: tissueId});
    const target = canvas.current;
    target.width = width;
    target.height = height;
    target.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
  }, [volume, axis, index, opacity, tissueId]);

  function pick(event) {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const scale = Math.min(rect.width/target.width, rect.height/target.height);
    if (!scale) return;
    // object-fit:contain can leave letterboxing in a narrow workspace.
    const x = Math.floor((event.clientX-rect.left-(rect.width-target.width*scale)/2)/scale);
    const y = Math.floor((event.clientY-rect.top-(rect.height-target.height*scale)/2)/scale);
    if (x>=0 && x<target.width && y>=0 && y<target.height)
      onPick(readBrainPixel(volume, {axis, index, x, y}));
  }
  return <canvas ref={canvas} data-mri-slice="" role="img" onClick={pick}
    aria-label={planes[axis].label + ' fetal brain MRI at source slice index ' + index}/>;
}

function BrainWorkspace({volume, rendererProps}) {
  const [axis, setAxis] = useState('axial');
  const [slices, setSlices] = useState(() => [...volume.centers]);
  const [tissueId, setTissueId] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const [opacity, setOpacity] = useState(45);
  const [surface, setSurface] = useState(false);
  const [sample, setSample] = useState(null);
  const plane = planes[axis];
  const index = slices[plane.axis];
  const [min, max] = volume.bounds[plane.axis];
  const selectedTissue = volume.tissues.find(tissue => tissue.id === tissueId);
  const activeName = selectedTissue ? tissueName(selectedTissue.name) : 'All labeled tissues';
  const sliceText = 'Slice ' + (index - min + 1) + ' of ' + (max - min + 1);
  function setIndex(next) {
    setSample(null);
    setSlices(current => current.map((value, coord) => coord === plane.axis ? Math.max(min, Math.min(max, next)) : value));
  }
  function selectTissue(id) {
    setSample(null);
    setTissueId(id);
  }
  function pick(pixel) {
    setSample(pixel);
    if (pixel.id) setTissueId(pixel.id);
  }

  return <>
    <div className="brain-tabs" role="group" aria-label="MRI presentation">
      <button type="button" aria-pressed={!surface} onClick={() => setSurface(false)}>2D slices</button>
      <button type="button" aria-pressed={surface} onClick={() => setSurface(true)}>3D tissue</button>
    </div>
    <div className="brain-workspace">
      <figure className="brain-figure">
        {surface ? <Suspense fallback={<p role="status">Preparing tissue surface…</p>}>
          <TissueSurface {...rendererProps} volume={volume} tissueId={tissueId} onSelect={selectTissue}/>
        </Suspense> : <div className="brain-image"><SliceImage volume={volume} axis={axis} index={index} opacity={overlay ? opacity/100 : 0} tissueId={tissueId} onPick={pick}/></div>}
        <figcaption>{surface ? '3D tissue surface · ' + activeName : <>
          <strong>{plane.label} · {sliceText}</strong><br/>{plane.description}. {plane.edges} across and down the image.
        </>}</figcaption>
      </figure>
      <div className="brain-options">
        {!surface && <>
          <label>MRI viewing plane<select value={axis} onChange={event => {setAxis(event.target.value); setSample(null);}}>
            {Object.entries(planes).map(([key, item]) => <option value={key} key={key}>{item.label}</option>)}
          </select></label>
          <label>MRI slice<input type="range" min={min} max={max} step="1" value={index}
            aria-valuetext={sliceText} onChange={event => setIndex(Number(event.target.value))}/></label>
          <div className="brain-steps">
            <button type="button" aria-label="Previous MRI slice" disabled={index === min} onClick={() => setIndex(index-1)}>Previous</button>
            <button type="button" aria-label="Next MRI slice" disabled={index === max} onClick={() => setIndex(index+1)}>Next</button>
          </div>
        </>}
        <label>MRI tissue<select value={tissueId} onChange={event => selectTissue(Number(event.target.value))}>
          <option value="0">All labeled tissues</option>
          {volume.tissues.filter(tissue => tissue.id !== 0).map(tissue => <option key={tissue.id} value={tissue.id}>{tissueName(tissue.name)}</option>)}
        </select></label>
        {!surface && <>
          <label className="brain-check"><input type="checkbox" checked={overlay} onChange={event => setOverlay(event.target.checked)}/>Show tissue overlay</label>
          <label>MRI overlay opacity<input type="range" min="0" max="100" value={opacity} disabled={!overlay}
            aria-valuetext={opacity + ' percent'} onChange={event => setOpacity(Number(event.target.value))}/></label>
          <p>{overlay ? activeName + ' · ' + opacity + '% overlay' : 'Grayscale MRI'}</p>
          <p>Tap a tissue on the MRI or choose it in the list to explore it in 3D.</p>
          {sample && <output aria-live="polite">{sample.id ? tissueName(sample.name) : 'Unlabeled background'} · voxel {sample.ijk.join(', ')} · T2 intensity {sample.value.toFixed(2)}</output>}
        </>}
      </div>
    </div>
  </>;
}

export default function FetalBrainExplorer({rendererProps}) {
  const [volume, setVolume] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadFetalBrain({signal: controller.signal}).then(result => {
      if (!controller.signal.aborted) setVolume(result);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [attempt]);

  return <section className="brain-explorer" aria-labelledby="brain-title">
    <h2 id="brain-title">22-week fetal brain MRI atlas</h2>
    <p>Explore an average fetal brain at 22 weeks of pregnancy. This independent research atlas comes from a different population than the H001 ultrasound case.</p>
    {volume ? <BrainWorkspace volume={volume} rendererProps={rendererProps}/> : failed ? <div>
      <p role="alert">The fetal brain MRI could not be loaded.</p>
      <button type="button" onClick={() => {setFailed(false); setAttempt(value => value+1);}}>Retry MRI</button>
    </div> : <p role="status">Loading MRI and tissue labels…</p>}
    <details className="brain-credit"><summary>Atlas sources and license</summary>
      <p>CRL-2025 fetal brain atlas, Harvard Dataverse v4.1. The grayscale T2-weighted MRI and tissue labels come from the 22-week template. Colors show the atlas team’s tissue labels.</p>
      <a href="https://doi.org/10.7910/DVN/QOO75G">Atlas and source files</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · <a href="https://arxiv.org/abs/2508.15034">Bagheri et al. (2025)</a> · <a href="https://doi.org/10.1038/s41598-017-00525-w">Gholipour et al. (2017)</a>
      <p><a href={fetalSourceNotice} target="_blank" rel="noreferrer">Read the original atlas notice</a></p>
    </details>
  </section>;
}
