import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {verifiedFrameRgba} from '../../../viewer/src/verified-volume.mjs';
import {localSegFileLimit, readLocalSeg} from './local-seg.mjs';

export default function LocalSegPanel({study, frame}) {
  const [open, setOpen] = useState(false);
  const [admission, setAdmission] = useState(null);
  const [result, setResult] = useState(null);
  const [occupied, setOccupied] = useState(null);
  const generation = useRef(0);
  const canvas = useRef(null);
  const segment = admission?.study === study ? admission.seg : null;
  useEffect(() => {
    return () => { generation.current++; };
  }, [study]);

  async function load(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const id = ++generation.current;
    try {
      if (file.size > localSegFileLimit) throw new Error('The SEG file exceeds the 24 MiB limit.');
      setResult({study, status:'Checking SEG reference planes…'});
      const seg = await readLocalSeg(JSON.parse(await file.text()), study);
      if (id !== generation.current) return;
      setAdmission({study, seg});
      setResult({study, status:'SEG source frames and mask verified.'});
    } catch (error) {
      if (id === generation.current) setResult({study, status:error instanceof SyntaxError
        ? 'The prepared SEG is not a valid JSON bundle.' : error.message});
    }
  }

  function clear() {
    generation.current++;
    setAdmission(null);
    setResult(null);
    setOccupied(null);
  }

  useLayoutEffect(() => {
    const surface = canvas.current;
    if (!open || !segment || !surface) return;
    const [, rows, columns] = study.descriptor.shape;
    const {center, width} = study.descriptor.calibration;
    surface.width = columns;
    surface.height = rows;
    const context = surface.getContext('2d');
    const image = context.createImageData(columns, rows);
    verifiedFrameRgba(study, frame, center, width, image.data);
    setOccupied(segment.apply(frame, image.data));
    context.putImageData(image, 0, 0);
  }, [open, segment, study, frame]);

  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Local source-linked SEG</summary>
    <p>Open a prepared binary SEG bundle for the verified CT above. The preview uses only matching source planes.</p>
    <label>Prepared DICOM SEG <input aria-label="Prepared DICOM SEG" type="file" accept=".d3seg,application/json" onChange={load}/></label>
    {(segment || result?.study === study) && <button type="button" onClick={clear}>Clear local SEG</button>}
    <p role="status">{result?.study === study ? result.status : ''}</p>
    {segment && <>
      <p>{segment.label} · segment {segment.segmentNumber} · {segment.matchedFrames} matched source frames</p>
      {open && <>
        <canvas ref={canvas} role="img" aria-label="Source-linked SEG overlay"
          style={{width:'100%', maxWidth:512, display:'block', background:'#000'}}/>
        <p>{occupied === null ? 'No SEG frame for this source plane.' : occupied.toLocaleString() + ' masked pixels on this source plane.'}</p>
      </>}
      <details><summary>SEG source evidence</summary>
        <p>Original SEG SHA-256 <code style={{overflowWrap:'anywhere'}}>{segment.sourceSha256}</code></p>
      </details>
    </>}
  </details>;
}
