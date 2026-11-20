import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import TissueSurface from '../fetal-mri/FetalTissueSurface.jsx';
import {loadMyoma, myomaPlaneCorners, myomaSourceNotice, readMyomaPixel, renderMyomaSlice} from './myoma-volume.mjs';
import './myoma.css';

function MyomaWorkspace({volume, rendererProps, compact}) {
  const [index,setIndex] = useState(volume.centers[2]);
  const [tissueId,setTissueId] = useState(3);
  const [overlay,setOverlay] = useState(true);
  const [plane,setPlane] = useState(true);
  const [opacity,setOpacity] = useState(70);
  const [panes,setPanes] = useState({});
  const canvas = useRef(null);
  const [first,last] = volume.bounds[2];
  const tissue = volume.byId.get(tissueId);
  const name = tissueId===3 ? 'Fibroid' : tissue.name;
  const label = 'Slice '+(index-first+1)+' of '+(last-first+1);
  const grayscale = useMemo(() => renderMyomaSlice(volume,{axis:'sagittal',index,opacity:0}),[volume,index]);
  const slice = useMemo(() => overlay ? renderMyomaSlice(volume,{
    axis:'sagittal', index, opacity:.55, highlightId:tissueId,
  }) : grayscale,[volume,index,overlay,tissueId,grayscale]);
  const corners = useMemo(() => myomaPlaneCorners(volume,{axis:'sagittal',index}),[volume,index]);
  useLayoutEffect(() => {
    setPanes(compact ? {} : {
      source:document.getElementById('h001-source-pane'),
      controls:document.getElementById('h001-tissue-pane'),
    });
  },[compact]);
  useLayoutEffect(() => {
    const target=canvas.current;
    target.width=slice.width;
    target.height=slice.height;
    target.getContext('2d').putImageData(new ImageData(slice.rgba,slice.width,slice.height),0,0);
  },[slice,panes.source]);
  function pickSource(event) {
    const rect=event.currentTarget.getBoundingClientRect();
    const x=Math.floor((event.clientX-rect.left)*slice.width/rect.width);
    const y=Math.floor((event.clientY-rect.top)*slice.height/rect.height);
    if(x<0 || x>=slice.width || y<0 || y>=slice.height) return;
    const {id}=readMyomaPixel(volume,{axis:'sagittal',index,x,y});
    if(id) setTissueId(id);
  }
  const source=<section className="panel myoma-source">
    <h2>Sagittal MRI</h2>
    <div className="myoma-image"><canvas ref={canvas} data-myoma-slice="" role="img" aria-label={'Sagittal uterine MRI, '+label}
      onClick={pickSource} style={{aspectRatio:slice.displayWidthMm+' / '+slice.displayHeightMm}}/></div>
    <label>Fibroid MRI slice<input type="range" min={first} max={last} value={index} aria-valuetext={label}
      onChange={event=>setIndex(Number(event.target.value))}/></label>
    <div className="myoma-steps"><button type="button" aria-label="Previous fibroid MRI slice" disabled={index===first} onClick={()=>setIndex(index-1)}>Previous</button>
      <button type="button" aria-label="Next fibroid MRI slice" disabled={index===last} onClick={()=>setIndex(index+1)}>Next</button></div>
    <p>{label} · Original series index {index}</p>
    <p>{name}: {tissue.countsByK[index].toLocaleString('en-US')} labeled pixels on this slice.</p>
  </section>;
  const controls=<section className="panel myoma-settings">
    <h2>Study selection</h2>
    <label>MRI tissue<select value={tissueId} onChange={event=>setTissueId(Number(event.target.value))}>
      {volume.tissues.map(t=><option key={t.id} value={t.id}>{t.id===3?'Fibroid (myoma)':t.name}</option>)}
    </select></label>
    <button type="button" onClick={()=>setIndex(tissue.peakK)}>Go to clearest slice</button>
    <small>Opens the slice with the most pixels labeled for this tissue.</small>
    <label><input type="checkbox" checked={overlay} onChange={event=>setOverlay(event.target.checked)}/>Show {name.toLowerCase()} overlay</label>
    <label><input type="checkbox" checked={plane} onChange={event=>setPlane(event.target.checked)}/>Show MRI plane in 3D</label>
    <label>{name} surface opacity<input type="range" min="0" max="100" value={opacity} aria-valuetext={opacity+' percent'}
      onChange={event=>setOpacity(Number(event.target.value))}/></label>
  </section>;
  return <>
    {panes.source ? createPortal(source,panes.source) : source}
    <TissueSurface {...rendererProps} comparison volume={volume} tissueId={tissueId}
      ariaLabel={name+' segmentation surface'} axis="sagittal" index={index}
      sourceSlice={grayscale} planeCorners={corners} slice={plane ? slice : null} opacity={opacity/100}/>
    {panes.controls ? createPortal(controls,panes.controls) : controls}
  </>;
}

export default function MyomaExplorer({rendererProps, compact}) {
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
    {volume ? <MyomaWorkspace compact={compact} volume={volume} rendererProps={rendererProps}/> : failed ? <div>
      <p role="alert">The uterine MRI or its tissue labels could not be loaded.</p>
      <button type="button" onClick={() => {setFailed(false);setAttempt(a=>a+1);}}>Retry uterine MRI</button>
    </div> : <p role="status">Loading uterine MRI and fibroid segmentation…</p>}
    <details><summary>Source and license</summary>
      <p>Haixia Pan and colleagues, Uterine Myoma Dataset, version 3. The oblique sagittal series and its accompanying tissue labels share their original coordinate system. This view crops to the uterine region.</p>
      <a href="https://doi.org/10.6084/m9.figshare.23541312.v3">Source MRI and labels</a> · <a href="https://doi.org/10.1038/s41597-024-03170-x">Dataset paper</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · <a href={myomaSourceNotice} target="_blank" rel="noreferrer">Local source notice</a>
    </details>
  </section>;
}
