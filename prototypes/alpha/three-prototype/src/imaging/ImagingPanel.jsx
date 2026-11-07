import React, { useEffect, useRef, useState } from 'react';
// The admission and pixel display logic stay owned by the existing DICOM3D imaging code.
import { loadPublicResearchFixture } from '../../../viewer/src/public-research-loader.ts';
import { frameRgba } from '../../../viewer/src/ct-frame.mjs';
import { paintSourceSeg } from './seg-overlay.js';

/** Public H000 research fixture only. No patient-to-atlas registration is implied. */
export default function ImagingPanel({ onStudyChange, onFrameChange, onSegChange, controlledFrame, lesionSelected=false }) {
  const [study, setStudy] = useState(null);
  const [internalFrame, setInternalFrame] = useState(71);
  const frame=Number.isInteger(controlledFrame)?controlledFrame:internalFrame;
  const setFrame=value=>{const next=typeof value==='function'?value(frame):value;setInternalFrame(next);onFrameChange?.(next)};
  const [status, setStatus] = useState('No acquired study loaded.');
  const [loading, setLoading] = useState(false);
  const [showSeg, setShowSeg] = useState(true);
  const generation = useRef(0), request = useRef(null), imageRef = useRef(null), overlayRef = useRef(null);

  useEffect(() => () => { generation.current += 1; request.current?.abort(); }, []);
  async function load() {
    const owner = ++generation.current;
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setStatus('Verifying the public H000 research fixture…');
    try {
      // Resolve Vite's relative deployment base before the unchanged fixed-asset validator.
      // The validator still enforces same-origin paths, its allowlist and exact source hashes.
      const appBase = new URL(import.meta.env.BASE_URL, globalThis.location.href).pathname;
      const value = await loadPublicResearchFixture(appBase, controller.signal);
      if (owner !== generation.current) return;
      setStudy(value); setFrame(71); onStudyChange?.(value);
      setStatus('Verified public H000 CT + source SEG. Generalized anatomy is not registered.');
    } catch (error) {
      if (owner === generation.current) setStatus(`H000 unavailable: ${String(error)}`);
    } finally { if (owner === generation.current) { request.current = null; setLoading(false); } }
  }
  function cancelLoad() {
    generation.current += 1; request.current?.abort(); request.current = null; setLoading(false);
    setStatus(study ? 'Loading cancelled; previous study retained.' : 'Loading cancelled; no acquired study loaded.');
  }
  function unload() {
    generation.current += 1; request.current?.abort(); request.current = null; setStudy(null); setLoading(false); onStudyChange?.(null);
    setStatus('No acquired study loaded.');
  }
  useEffect(() => {
    if (!study) return;
    const canvas = imageRef.current, overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const ctx = canvas.getContext('2d'), over = overlay.getContext('2d');
    const image = ctx.createImageData(512, 512);
    frameRgba(study.pixels, frame, -600, 1500, image.data);
    ctx.putImageData(image, 0, 0);
    const mask = over.createImageData(512, 512), offset = frame * 512 * 512;
    if (showSeg) paintSourceSeg(study.mask, offset, mask.data, lesionSelected && study.binding?.semanticId === 'lesion.lung.mass.001');
    over.putImageData(mask, 0, 0);
  }, [study, frame, showSeg, lesionSelected]);
  useEffect(() => { onSegChange?.(showSeg); }, [showSeg, onSegChange]);
  const counts = study?.binding?.frames?.[frame]?.nonzero_voxels;
  return <section className="imaging-panel" aria-label="Public research source imaging">
    <h2>Source imaging</h2>
    <p>Public H000 research example · CT and source segmentation</p>
    <button type="button" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Open H000 example'}</button>{' '}
    {loading && <button type="button" onClick={cancelLoad}>Cancel loading</button>}{' '}
    {(study || loading) && <button type="button" onClick={unload}>Close study</button>}
    <p role="status">{status}</p>
    {study && <>
      <div style={{ position:'relative', width:'100%', maxWidth:512, aspectRatio:'1', background:'#000' }}>
        <canvas ref={imageRef} width="512" height="512" aria-label={`Acquired CT frame ${frame}`} style={{width:'100%', height:'100%', display:'block'}} />
        <canvas ref={overlayRef} width="512" height="512" aria-label="Source segmentation overlay" style={{position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none'}} />
      </div>
      <label>Source frame {frame + 1} / 103 <input type="range" min="0" max="102" value={frame} onChange={e => setFrame(Number(e.target.value))} /></label>
      <div><button type="button" onClick={() => setFrame(k => Math.max(0, k - 1))} disabled={frame === 0}>Previous frame</button>{' '}
      <button type="button" onClick={() => setFrame(k => Math.min(102, k + 1))} disabled={frame === 102}>Next frame</button></div>
      <label><input type="checkbox" checked={showSeg} onChange={e => setShowSeg(e.target.checked)} /> Source SEG overlay</label>
      {lesionSelected && <p>{showSeg ? 'Selected lesion: the source SEG overlay is highlighted in amber on frames containing the mask. The frame and source values are unchanged.' : 'Selected lesion: the source SEG overlay is off.'}</p>}
      <p>{Number.isInteger(counts) ? counts : 'Unavailable'} source segmentation voxels on this frame · 512 × 512 original stored values · display window −600 / 1500.</p>
      <p>Acquired CT and generalized atlas are independent; no patient-atlas registration or clinical claim.</p>
    </>}
  </section>;
}
