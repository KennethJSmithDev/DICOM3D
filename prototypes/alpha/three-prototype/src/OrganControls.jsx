import React from 'react';
export default function OrganControls({choice,resident,isolated,hidden,focus,toggleHidden,overrides,setOverride,assembly,setAssembly,restore,disabled}) {
 const settings=overrides.get(choice?.id)||{opacity:1,style:'original'};
 return <section id="organ-controls" tabIndex={-1} className="panel organ-controls" aria-label="Selected structure presentation">
  <div className="section-eyebrow">EXPLORE ANATOMY</div>
  <h2>{choice?.label||'Choose a structure'}</h2>
  <p>{choice?'Inspect this source structure, or reveal its relationship to neighbouring anatomy.':'Select an organ in the explorer or directly in the viewport.'}</p>
  <div className="view-controls">
   <button disabled={!resident||disabled} onClick={focus}>Isolate and focus</button>
   <button disabled={!resident||disabled} onClick={toggleHidden}>{hidden?'Show structure':'Hide structure'}</button>
  </div>
  {choice&&<><label>Structure appearance<select aria-label="Selected structure appearance" disabled={disabled||!resident} value={settings.style} onChange={e=>setOverride(choice.id,{...settings,style:e.target.value})}><option value="original">Scientific · source material</option><option value="holographic">Holographic · illustrative</option></select></label>
  <label>Structure opacity <output>{Math.round(settings.opacity*100)}%</output><input aria-label="Selected structure opacity" disabled={disabled||!resident} type="range" min=".05" max="1" step=".05" value={settings.opacity} onChange={e=>setOverride(choice.id,{...settings,opacity:+e.target.value})}/></label></>}
  <label>Separate reference structures <output>{Math.round(assembly*100)}%</output><input aria-label="Reference assembly separation" disabled={disabled||isolated} type="range" min="0" max="1" step=".05" value={assembly} onChange={e=>setAssembly(+e.target.value)}/></label>
  <small>{isolated?'Return to the reference to explore neighbouring structures.':'Reversible layout offsets of existing structures; not cut tissue or patient registration.'}</small>
  <button className="restore-assembly" disabled={disabled} onClick={restore}>Restore assembled reference</button>
 </section>;
}
