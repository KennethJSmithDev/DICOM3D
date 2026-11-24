import React from 'react';

export default function AtlasRendererControl({value,status,active,pauseReason,onChange,showIllustrativeTissue,onIllustrativeTissueChange}) {
 const message=active?'NRX WebGPU is rendering the atlas.':
  status==='error'?'NRX WebGPU unavailable. Three.js restored.':
  value==='nrx'?(pauseReason??'Starting NRX WebGPU…'):'Three.js is rendering the atlas.';
 return <section className="panel">
  <h2>Anatomy 3D backend</h2>
  <label>Anatomy 3D renderer
   <select aria-label="Anatomy 3D renderer" value={value} onChange={event=>onChange(event.target.value)}>
    <option value="three">Three.js (fallback)</option>
    <option value="nrx" disabled={Boolean(pauseReason)}>NRX WebGPU (default)</option>
   </select>
  </label>
  <p role="status">{message}</p>
  {active&&<label>
   <input type="checkbox" style={{width:'auto',marginInlineEnd:8}} checked={showIllustrativeTissue} onChange={event=>onIllustrativeTissueChange(event.target.checked)}/>
   Illustrative anatomy materials
  </label>}
  {pauseReason&&value==='three'&&<small>{pauseReason}</small>}
 </section>;
}
