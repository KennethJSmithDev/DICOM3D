import React, {useEffect, useRef, useState} from 'react';
import {readLocalImage} from '../../../viewer/src/local-image.mjs';
import NativeImageFrames from './NativeImageFrames.jsx';

const maxFileBytes = 32 * 1024 * 1024;

export default function LocalFrameFilePanel() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [frame, setFrame] = useState(0);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const current = useRef(0);
  useEffect(() => () => { current.current++; }, []);

  async function load(event) {
    event.preventDefault();
    if (!file || busy) return;
    if (file.size > maxFileBytes) {
      setStatus('The file exceeds the 32 MiB limit. The current image, if any, was kept.');
      return;
    }
    const generation = ++current.current;
    setBusy(true);
    setStatus('Verifying prepared source frames…');
    try {
      const image = await readLocalImage(JSON.parse(await file.text()));
      if (!image.pixels) throw new Error('Prepared image contains no supported pixels');
      if (generation !== current.current) return;
      setResult(image);
      setFrame(0);
      setStatus('Prepared source image verified.');
    } catch {
      if (generation === current.current) setStatus('The prepared image could not be verified. The current image, if any, was kept.');
    } finally {
      if (generation === current.current) setBusy(false);
    }
  }

  function close() {
    current.current++;
    setBusy(false);
    setResult(null);
    setFrame(0);
    setStatus('');
  }

  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Open prepared image frames</summary>
    <p>Open a local .d3img file converted from DICOM, NIfTI, NRRD or OME-TIFF. Frames use the source order and recorded display settings.</p>
    <form onSubmit={load}>
      <label>Prepared image file <input aria-label="Prepared image file" type="file" accept=".d3img" onChange={event => setFile(event.target.files?.[0] ?? null)}/></label>
      <button disabled={!file || busy}>Open prepared image</button>
      {(result || busy) && <button type="button" onClick={close}>Close prepared image</button>}
    </form>
    <p role="status">{status}</p>
    {result && <>
      <h3>{result.bundle.source.sopName || result.bundle.source.format} source frames</h3>
      {result.bundle.source.relativeDose && <p>Relative dose grid · source frame order · grayscale display</p>}
      <NativeImageFrames image={result} frame={frame} onFrameChange={setFrame} active={open && !busy}
        label="Prepared source image" frameLabel="Prepared image frame"
        previousLabel="Previous prepared frame" nextLabel="Next prepared frame"/>
    </>}
  </details>;
}
