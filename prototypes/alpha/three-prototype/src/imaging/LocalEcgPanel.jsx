import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ecgLead, readLocalEcg, waveformSourceLimit} from './local-ecg.mjs';

function voltageRange(values) {
  let min = 0, max = 0;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const margin = Math.max((max - min) * .06, 1);
  return {min: min - margin, max: max + margin};
}

function Trace({values, range, name}) {
  const canvas = useRef(null);
  useEffect(() => {
    const {width, height} = canvas.current;
    const context = canvas.current.getContext('2d');
    const x = index => 12 + index * (width - 24) / (values.length - 1);
    const y = value => 12 + (range.max - value) * (height - 24) / (range.max - range.min);
    context.fillStyle = '#061824';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#46616d';
    context.beginPath();
    context.moveTo(12, y(0));
    context.lineTo(width - 12, y(0));
    context.stroke();
    context.strokeStyle = '#73e6f1';
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(x(0), y(values[0]));
    for (let i = 1; i < values.length; i++) context.lineTo(x(i), y(values[i]));
    context.stroke();
  }, [values, range]);
  return <canvas ref={canvas} role="img" aria-label={'ECG trace for ' + name} width="760" height="220"
    style={{width:'100%', height:'auto', display:'block'}}/>;
}

export default function LocalEcgPanel() {
  const [study, setStudy] = useState(null);
  const [groupIndex, setGroup] = useState(0);
  const [leadIndex, setLead] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);

  async function load(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const id = ++request.current;
    setLoading(true);
    try {
      if (file.size > waveformSourceLimit) throw new Error('ECG bundle exceeds the local file limit.');
      const next = await readLocalEcg(JSON.parse(await file.text()));
      if (id !== request.current) return;
      setStudy(next);
      setGroup(0);
      setLead(0);
      setStatus('ECG waveform samples verified.');
    } catch {
      if (id === request.current) setStatus('ECG verification failed. The previous waveform is retained if available.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  function clear() {
    request.current++;
    setStudy(null);
    setLoading(false);
    setStatus('ECG waveform cleared.');
  }

  const group = study?.groups[groupIndex];
  const lead = group?.channels[leadIndex];
  const values = useMemo(() => group && ecgLead(group, leadIndex), [group, leadIndex]);
  const range = useMemo(() => values && voltageRange(values), [values]);

  return <details>
    <summary>Local ECG waveform</summary>
    <p>Open a prepared DICOM3D ECG bundle to inspect source lead samples in microvolts. Research preview with an automatically scaled trace.</p>
    <label>Prepared ECG waveform <input aria-label="Prepared ECG waveform" type="file"
      accept=".d3ecg,application/json" onChange={load}/></label>
    {(study || loading) && <button type="button" onClick={clear}>Clear ECG waveform</button>}
    <p role="status">{loading ? 'Verifying ECG waveform…' : status}</p>
    {group && <>
      <label>Waveform group <select value={groupIndex} onChange={event => {
        setGroup(Number(event.target.value)); setLead(0);
      }}>
        {study.groups.map((entry, index) => <option key={index} value={index}>{entry.label} · {entry.originality.toLowerCase()}</option>)}
      </select></label>
      <label>Waveform lead <select value={leadIndex} onChange={event => setLead(Number(event.target.value))}>
        {group.channels.map((channel, index) => <option key={index} value={index}>{channel.label}</option>)}
      </select></label>
      <Trace values={values} range={range} name={lead.label}/>
      <p>{group.samples.toLocaleString()} samples at {group.frequency} Hz · 0–{((group.samples - 1) / group.frequency).toFixed(3)} s ·
        {Math.floor(range.min)} to {Math.ceil(range.max)} µV</p>
      <details><summary>ECG source evidence</summary>
        <p>Source DICOM SHA-256 <code style={{overflowWrap:'anywhere'}}>{study.source.sha256}</code></p>
        <p>Waveform group SHA-256 <code style={{overflowWrap:'anywhere'}}>{group.sampleSha256}</code></p>
        <p>Lead calibration {lead.gain} µV per stored unit, baseline {lead.baseline} µV</p>
      </details>
    </>}
  </details>;
}
