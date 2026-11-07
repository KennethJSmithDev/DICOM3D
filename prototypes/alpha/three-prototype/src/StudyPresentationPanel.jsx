import React from 'react';
export default function StudyPresentationPanel({controller:p}){
 return <section id="study-presentation-controls" className="panel" aria-label="Study accumulation controls"><h2>Study materialization</h2>
  <p>Reveal the acquired CT and source lesion in recorded frame order. This changes presentation only; it does not generate tissue or segmentation.</p>
  <div className="view-controls"><button type="button" disabled={!p.available||p.playing} onClick={p.play}>{p.reduced?'Show selected range':p.playing?'Playing…':'Play accumulation'}</button><button type="button" disabled={!p.playing} onClick={p.pause}>Pause accumulation</button><button type="button" disabled={!p.available} onClick={p.reset}>Restore complete study</button></div>
  <label>Linked source range<select aria-label="Accumulation source range" value={p.rangeKind} disabled={!p.available} onChange={e=>p.changeRange(e.target.value)}><option value="acquired">Full acquired stack</option><option value="lesion">Source lesion frames</option></select></label>
  <label>Assembly progress <output>{Math.round(p.progress*100)}%</output><input aria-label="Study assembly progress" type="range" min="0" max="1" step="0.01" disabled={!p.available} value={p.progress} onChange={e=>p.scrub(e.target.value)}/></label>
  <p role="status">{p.enabled?`${p.accumulation.count} of ${p.accumulation.total} source slice cells revealed; source k ${p.accumulation.range[0]}–${p.accumulation.range[1]}.`:'Complete study presentation; accumulation is off.'} {p.reduced?'Reduced motion was explicitly selected.':''}</p>
  <small>Source image follows the last revealed frame. At 0%, the range start remains available for inspection. Manual CT clipping remains independent.</small>
 </section>;
}
