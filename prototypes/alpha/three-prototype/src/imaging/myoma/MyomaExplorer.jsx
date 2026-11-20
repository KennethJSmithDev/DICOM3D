import React, {useEffect, useMemo, useRef, useState} from 'react';
import TissueSurface from '../fetal-mri/FetalTissueSurface.jsx';
import {loadMyoma, myomaPlaneCorners, myomaSourceNotice, renderMyomaSlice} from './myoma-volume.mjs';
import './myoma.css';

function MyomaWorkspace({volume, rendererProps}) {
  const [index,setIndex] = useState(volume.centers[2]);
  const [overlay,setOverlay] = useState(true);
  const [plane,setPlane] = useState(true);
  const [opacity,setOpacity] = useState(70);
  const canvas = useRef(null);
  const [first,last] = volume.bounds[2];
  const slice = useMemo(() => renderMyomaSlice(volume, {
    axis:'sagittal', index, opacity:overlay ? .55 : 0, highlightId:3,
  }), [volume,index,overlay]);
  const corners = useMemo(() => myomaPlaneCorners(volume,{axis:'sagittal',index}), [volume,index]);
  useEffect(() => {
    const target = canvas.current;
    target.width = slice.width;
    target.height = slice.height;
    target.getContext('2d').putImageData(new ImageData(slice.rgba,slice.width,slice.height),0,0);
  }, [slice]);
  const label = 'Slice '+(index-first+1)+' of '+(last-first+1);
  return <>
    <div className="myoma-views">
      <figure><h3>Sagittal MRI</h3>
        <div className="myoma-image"><canvas ref={canvas} data-myoma-slice="" role="img" aria-label={'Sagittal uterine MRI, '+label}
          style={{aspectRatio:slice.displayWidthMm+' / '+slice.displayHeightMm}}/></div>
        <figcaption><strong>{label}</strong> · Original series index {index}. {volume.myomaCountsByK[index]
          ? volume.myomaCountsByK[index].toLocaleString('en-US')+' pixels carry the source fibroid label on this slice.'
          : 'This slice contains no source fibroid label.'}</figcaption>
      </figure>
      <figure><h3>3D fibroid</h3><TissueSurface {...rendererProps} volume={volume} tissueId={3}
        ariaLabel="Fibroid segmentation surface" axis="sagittal" index={index}
        planeCorners={corners} slice={plane ? slice : null} opacity={opacity/100}/>
        <figcaption>The 3D surface follows the same myoma label across the MRI series.</figcaption>
      </figure>
    </div>
    <div className="myoma-controls">
      <div>
        <label>Fibroid MRI slice<input type="range" min={first} max={last} value={index} aria-valuetext={label}
          onChange={event => setIndex(Number(event.target.value))}/></label>
        <div className="myoma-steps"><button type="button" aria-label="Previous fibroid MRI slice" disabled={index===first} onClick={() => setIndex(i=>Math.max(first,i-1))}>Previous</button>
          <button type="button" aria-label="Next fibroid MRI slice" disabled={index===last} onClick={() => setIndex(i=>Math.min(last,i+1))}>Next</button></div>
      </div>
      <div>
        <label className="myoma-check"><input type="checkbox" checked={overlay} onChange={event => setOverlay(event.target.checked)}/>Show fibroid overlay</label>
        <label className="myoma-check"><input type="checkbox" checked={plane} onChange={event => setPlane(event.target.checked)}/>Show MRI plane in 3D</label>
        <label>Fibroid surface opacity<input type="range" min="5" max="100" value={opacity} aria-valuetext={opacity+' percent'}
          onChange={event => setOpacity(Number(event.target.value))}/></label>
      </div>
    </div>
  </>;
}

export default function MyomaExplorer({rendererProps}) {
  const [volume,setVolume] = useState(null);
  const [failed,setFailed] = useState(false);
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadMyoma({signal:controller.signal}).then(value => {
      if (!controller.signal.aborted) setVolume(value);
    }).catch(() => {if (!controller.signal.aborted) setFailed(true);});
    return () => controller.abort();
  }, [attempt]);

  return <section className="myoma-explorer" aria-labelledby="myoma-title">
    <h2 id="myoma-title">Uterine fibroid MRI</h2>
    <p>Explore a fibroid, also called a myoma, in a published MRI. UMD_221129_001 is a separate case from the H001 twin-pregnancy ultrasound.</p>
    {volume ? <MyomaWorkspace volume={volume} rendererProps={rendererProps}/> : failed ? <div>
      <p role="alert">The uterine MRI or its tissue labels could not be loaded.</p>
      <button type="button" onClick={() => {setFailed(false);setAttempt(a=>a+1);}}>Retry uterine MRI</button>
    </div> : <p role="status">Loading uterine MRI and fibroid segmentation…</p>}
    <details><summary>Source and license</summary>
      <p>Haixia Pan and colleagues, Uterine Myoma Dataset, version 3. The oblique sagittal series and its accompanying tissue labels share their original coordinate system. This view crops to the uterine region.</p>
      <a href="https://doi.org/10.6084/m9.figshare.23541312.v3">Source MRI and labels</a> · <a href="https://doi.org/10.1038/s41597-024-03170-x">Dataset paper</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · <a href={myomaSourceNotice} target="_blank" rel="noreferrer">Local source notice</a>
    </details>
  </section>;
}
