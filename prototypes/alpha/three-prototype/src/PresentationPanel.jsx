import React from 'react';
export default function PresentationPanel({intro,settings,onSettings,enabled=true}){
 const ambient=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 return <details className="panel presentation-lab" id="presentation-lab" tabIndex={-1}><summary>Presentation Lab</summary>
 <p>Explore how source geometry assembles into a surface. These controls change presentation, not anatomy or source data.</p>
 <label><input type="checkbox" checked={intro.reduced} onChange={e=>intro.setReduced(e.target.checked)}/> Reduce motion (my choice)</label>
 {ambient&&!intro.reduced&&<p>Your device recommends reduced motion. You can enable it here; the introduction still plays by default.</p>}
 <button disabled={!enabled} onClick={intro.play}>Play assembly</button> <button disabled={!intro.active} onClick={()=>intro.finish('manual-skip')}>Skip introduction</button>
 <label>Assembly progress <input aria-label="Assembly progress" type="range" min="0" max="1" step=".01" value={intro.progress} disabled={!enabled||intro.reduced} onChange={e=>intro.scrub(e.target.value)}/><output>{Math.round(intro.progress*100)}%</output></label>
 <label>Effect<select aria-label="Assembly effect" value={settings.effect} onChange={e=>onSettings(s=>({...s,effect:e.target.value}))}><option value="layers">Layer sweep</option><option value="particles">Particle assembly</option></select></label>
 <label>Particle budget<select aria-label="Particle budget" value={settings.count} onChange={e=>onSettings(s=>({...s,count:Number(e.target.value)}))}><option value="512">512 · low</option><option value="2048">2,048 · balanced</option><option value="8192">8,192 · high</option></select></label>
 <label>Material preset<select aria-label="Assembly material preset" value={settings.color} onChange={e=>onSettings(s=>({...s,color:e.target.value}))}><option value="#14bfff">Ion cyan</option><option value="#d9f5ff">Arctic white</option><option value="#ffbc65">Warm amber</option></select></label>
 <p>Progress is the assembly effect, not download percentage. Original source materials return when assembly finishes.</p>
 </details>;
}
