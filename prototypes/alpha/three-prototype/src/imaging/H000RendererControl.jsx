import React from 'react';

export default function H000RendererControl({choice,onChange,available,active,status,pauseReason}) {
 const message=active?'NRX WebGPU is rendering H000.':
  status==='error'?'NRX WebGPU unavailable. Three.js restored.':
  choice==='nrx'?(pauseReason??'Starting NRX WebGPU…'):'Three.js is rendering H000.';
 return <section className="panel">
  <h2>H000 3D backend</h2>
  <label>H000 3D renderer
   <select aria-label="H000 3D renderer" value={choice} onChange={event=>onChange(event.target.value)}>
    <option value="three">Three.js (default)</option>
    <option value="nrx" disabled={!available}>NRX WebGPU (experimental)</option>
   </select>
  </label>
  <p role="status">{message}</p>
  {!available&&choice==='three'&&<small>{pauseReason}</small>}
  {active&&<small>NRX displays the source lesion mask. The source CT and 2D SEG panel share the same selected frame.</small>}
 </section>;
}
