import React from 'react';

/** Presentation only: controls affect loaded reference owners, never source geometry. */
export default function AtlasPresentationControls({selected, selectedResident, hiddenIds, setHiddenIds,
  isolatedId, setIsolatedId, style, setStyle, opacity, setOpacity, explode, setExplode}) {
  const hidden = !!selected && hiddenIds.has(selected);
  function toggleSelected() {
    setHiddenIds(previous => {const next = new Set(previous); hidden ? next.delete(selected) : next.add(selected); return next;});
    if (!hidden && isolatedId === selected) setIsolatedId('');
  }
  function toggleIsolate() {
    if (isolatedId === selected) {setIsolatedId(''); return;}
    setHiddenIds(previous => {const next = new Set(previous);next.delete(selected);return next;});
    setIsolatedId(selected);
  }
  function restore() {setHiddenIds(new Set());setIsolatedId('');setStyle('original');setOpacity(1);setExplode(0);}
  return <div className="panel atlas-presentation-controls">
    <h2>Reference presentation</h2>
    <p>Visibility and appearance apply to resident generalized anatomy. They do not change source data or register it to a study.</p>
    <div className="view-controls">
      <button type="button" onClick={toggleSelected} disabled={!selectedResident}>{hidden?'Show selected':'Hide selected'}</button>
      <button type="button" onClick={toggleIsolate} disabled={!selectedResident}>{isolatedId===selected?'End isolation':'Isolate selected'}</button>
    </div>
    <label>Appearance <select aria-label="Reference appearance" value={style} onChange={e=>setStyle(e.target.value)}><option value="original">Source materials</option><option value="holographic">Holographic tint (presentation)</option></select></label>
    <label>Reference opacity <input aria-label="Reference opacity" type="range" min="0.05" max="1" step="0.05" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label>
    <label>Lung surface separation <input aria-label="Lung surface separation" type="range" min="0" max="1" step="0.01" value={explode} onChange={e=>setExplode(Number(e.target.value))}/></label>
    <small>Only the two source lung surfaces move; no tissue fragments or segmentation are created. Zero restores their positions.</small>
    <p>{isolatedId?`Isolated owner: ${isolatedId}`:`${hiddenIds.size} owner(s) hidden`}</p>
    <button type="button" onClick={restore}>Restore reference presentation</button>
  </div>;
}
