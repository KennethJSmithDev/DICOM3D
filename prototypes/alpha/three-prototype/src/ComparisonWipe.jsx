import React from 'react';

export function ComparisonToolbar({split,onSplit,label,rangeLabel,tools}) {
  return <div className="comparison-tools">
    <label>{label}<input aria-label={rangeLabel} type="range" min="0" max="100" value={split} onChange={event=>onSplit(Number(event.target.value))}/></label>
    {tools}
  </div>;
}

export default function ComparisonWipe({split,onSplit,label,rangeLabel,overlayLabel,side='right',children,tools}) {
  const clipPath = side === 'left' ? `inset(0 ${100-split}% 0 0)` : `inset(0 0 0 ${split}%)`;
  return <>
    <div className="reference-wipe" style={{clipPath,pointerEvents:'none'}}>
      {children}
      {overlayLabel && <span className="comparison-label">{overlayLabel}</span>}
    </div>
    <div className="wipe-divider" style={{left:split+'%',pointerEvents:'none'}}/>
    {rangeLabel && <ComparisonToolbar {...{split,onSplit,label,rangeLabel,tools}}/>}
  </>;
}
