import React, {useEffect, useRef, useState} from 'react';
import {readLocalImage} from '../../../viewer/src/local-image.mjs';
import NativeImageFrames from './NativeImageFrames.jsx';

const endpoint = '/dicom3d/api/images/';
const requestHeader = {'X-DICOM3D-Request':'live-image-v1'};
const imageLimit = 16 * 1024 * 1024;
const catalogLimit = 64 * 1024;
const retained = ' Existing image and frame, if any, were retained.';
const denied = 'Live imaging access was denied.';
const unavailable = 'Live native imaging is unavailable on this preview.';
const incomplete = 'Live imaging transfer was incomplete or could not be verified.';

async function readResponse(url, options, limit) {
  const response = await fetch(url, {
    mode:'same-origin', credentials:'omit', redirect:'error', cache:'no-store', ...options,
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => {});
    if (response.status === 401 || response.status === 403) throw new Error(denied);
    if (response.status === 404 || response.status === 503) throw new Error(unavailable);
    throw new Error(incomplete);
  }
  const rawLength = response.headers.get('Content-Length');
  const declaredLength = rawLength === null ? null : Number(rawLength);
  if (rawLength !== null && (!/^\d+$/.test(rawLength) || declaredLength > limit)) {
    await response.body.cancel().catch(() => {});
    throw new Error(incomplete);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', {fatal:true});
  const pieces = [];
  let received = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > (declaredLength ?? limit)) throw new Error(incomplete);
      pieces.push(decoder.decode(value, {stream:true}));
    }
    if (declaredLength !== null && received !== declaredLength) throw new Error(incomplete);
    pieces.push(decoder.decode());
    return JSON.parse(pieces.join(''));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function verifiedCatalog(payload) {
  const {studies} = payload;
  if (!Array.isArray(studies) || studies.length > 64) throw new Error(unavailable);
  const seen = new Set();
  for (const study of studies) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(study?.id ?? '') || seen.has(study.id) ||
        typeof study.label !== 'string' || !study.label.trim() || study.label.length > 180 ||
        !Number.isInteger(study.frames) || study.frames < 1 || study.frames > 256) throw new Error(unavailable);
    seen.add(study.id);
  }
  return studies;
}

export default function LiveNativeImagePanel() {
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [choice, setChoice] = useState('');
  const [result, setResult] = useState(null);
  const [frame, setFrame] = useState(0);
  const [plane, setPlane] = useState('source');
  const [reformatFrame, setReformatFrame] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const activeCatalog = useRef(null);
  const activeImage = useRef(null);
  const series = result?.image.bundle.frameIdentity.series;
  const enhanced = series?.frames[0].sourceFrame !== undefined;
  const slice = plane === 'source' ? series?.frames[frame] : null;
  useEffect(() => () => {
    activeCatalog.current?.abort();
    activeImage.current?.abort();
  }, []);

  async function loadCatalog() {
    if (catalog || activeCatalog.current) return;
    const controller = new AbortController();
    activeCatalog.current = controller;
    setCatalogLoading(true);
    setStatus('Loading available native images…');
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
      const studies = verifiedCatalog(await readResponse(endpoint + 'catalog', {signal, headers:requestHeader}, catalogLimit));
      if (controller.signal.aborted) return;
      setCatalog(studies);
      setChoice(studies[0]?.id ?? '');
      setStatus(studies.length ? '' : unavailable);
    } catch {
      if (!controller.signal.aborted) setStatus(unavailable);
    } finally {
      if (!controller.signal.aborted) setCatalogLoading(false);
      activeCatalog.current = null;
    }
  }

  async function retrieve(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const username = data.get('username');
    const password = data.get('password');
    form.elements.password.value = '';
    const selected = catalog?.find(study => study.id === choice);
    if (!selected || activeImage.current) return;
    if (typeof username !== 'string' || !username || username.includes(':') || username.length > 128 ||
        typeof password !== 'string' || !password || password.length > 256) {
      setStatus('Enter a valid live imaging username and password.' + retained);
      return;
    }
    const authorization = 'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode(username + ':' + password)));
    const controller = new AbortController();
    activeImage.current = controller;
    setLoading(true);
    setStatus('Retrieving and verifying original DICOM data…');
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]);
      const packet = await readResponse(endpoint + selected.id, {
        signal, headers:{...requestHeader, Authorization:authorization},
      }, imageLimit);
      const image = await readLocalImage(packet);
      if (image.bundle.source.format !== 'DICOM' || !image.pixels || image.bundle.pixels.shape[0] !== selected.frames) {
        throw new Error(incomplete);
      }
      if (signal.aborted) throw new Error(incomplete);
      setResult({image, study:selected});
      setFrame(0);
      setPlane('source');
      setReformatFrame(0);
      setStatus(image.bundle.frameIdentity.series ? 'Live MR source volume verified.' : 'Live source image verified.');
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error.message === denied || error.message === unavailable ? error.message : incomplete;
        setStatus(message + retained);
      }
    } finally {
      if (activeImage.current === controller) {
        activeImage.current = null;
        setLoading(false);
      }
    }
  }

  function cancel() {
    const controller = activeImage.current;
    if (!controller) return;
    activeImage.current = null;
    controller.abort();
    setLoading(false);
    setStatus('Live imaging retrieval cancelled.' + retained);
  }

  return <details onToggle={event => {
    const visible = event.currentTarget.open;
    setOpen(visible);
    if (visible) loadCatalog();
  }}>
    <summary>Live native DICOM frames</summary>
    <p>Retrieve an admitted DICOM example from IRIS and Orthanc. The frame viewer uses verified slice or frame order and recorded display settings.</p>
    {catalog?.length ? <form onSubmit={retrieve} autoComplete="off">
      <label>Live imaging study <select aria-label="Live imaging study" value={choice} disabled={loading} onChange={event => setChoice(event.target.value)}>
        {catalog.map(study => <option key={study.id} value={study.id}>{study.label}</option>)}
      </select></label>
      <label>Live imaging username <input name="username" autoComplete="off" maxLength={128} required/></label>
      <label>Live imaging password <input name="password" type="password" autoComplete="off" maxLength={256} required/></label>
      <button type="submit" disabled={loading}>Retrieve live imaging</button>
      {loading && <button type="button" onClick={cancel}>Cancel live imaging retrieval</button>}
    </form> : !catalog && !catalogLoading && status && <button type="button" onClick={loadCatalog}>Retry live imaging catalog</button>}
    <p role="status">{status}</p>
    {result && <>
      <h3>{result.study.label}</h3>
      {series && <label>MR view <select aria-label="MR view" value={plane} onChange={event=>{
        setPlane(event.target.value);
        setReformatFrame(0);
      }}>
        <option value="source">Original source slices</option>
        <option value="row">Row reformat</option>
        <option value="column">Column reformat</option>
      </select></label>}
      {plane !== 'source' && <p>Derived view through stored voxels without interpolation. Source slices advance from top to bottom.</p>}
      <NativeImageFrames image={result.image} mrPlane={series ? plane : null}
        frame={plane === 'source' ? frame : reformatFrame} onFrameChange={plane === 'source' ? setFrame : setReformatFrame}
        active={open && !loading && result.study.id === choice}/>
      <details>
        <summary>Live image source evidence</summary>
        <p>{series && !enhanced ? 'Ordered DICOM source inventory SHA-256' : 'Original DICOM SHA-256'} <code style={{overflowWrap:'anywhere'}}>{result.image.bundle.source.sha256}</code></p>
        <p>Stored pixel SHA-256 <code style={{overflowWrap:'anywhere'}}>{result.image.bundle.pixels.sha256}</code></p>
        {slice && <>
          <p>Slice {frame+1} SOP Instance UID <code style={{overflowWrap:'anywhere'}}>{slice.sop}</code></p>
          {enhanced
            ? <p>Original DICOM frame {slice.sourceFrame}</p>
            : <p>Slice original DICOM SHA-256 <code style={{overflowWrap:'anywhere'}}>{slice.sourceSha256}</code></p>}
          <p>Slice origin (mm, LPS) {slice.position.join(', ')}</p>
          <p>Pixel spacing (row × column) {series.pixelSpacing.join(' × ')} mm · Slice spacing {series.sliceSpacing} mm</p>
        </>}
      </details>
    </>}
  </details>;
}
