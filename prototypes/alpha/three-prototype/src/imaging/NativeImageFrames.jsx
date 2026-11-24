import React, {useEffect, useMemo, useRef, useState} from 'react';
import {copyMrReformat,localImageRgba,mrPlaneLayout} from '../../../viewer/src/local-image.mjs';
import {sourceCineTiming} from './native-cine-timing.mjs';

function stopTimer(playback) {
  if (playback.current === null) return;
  window.clearTimeout(playback.current);
  playback.current = null;
}

export default function NativeImageFrames({
  image, frame, onFrameChange, active = true, label = 'Live source image', frameLabel = 'Live image frame',
  previousLabel = 'Previous live image frame', nextLabel = 'Next live image frame', mrPlane = null,
}) {
  const [playing, setPlaying] = useState(false);
  const canvas = useRef(null);
  const playback = useRef(null);
  const mrLayout = mrPlane ? mrPlaneLayout(image,mrPlane) : null;
  const [frames, rows, columns] = mrLayout
    ? [mrLayout.frames,mrLayout.rows,mrLayout.columns]
    : image.bundle.pixels.shape;
  const reformat = mrPlane === 'row' || mrPlane === 'column';
  const frameName = image.bundle.frameIdentity?.series?.frames[0].sourceFrame === undefined
    ? 'Source frame' : 'Volume slice';
  const timing = useMemo(() => mrPlane ? null : sourceCineTiming(image.bundle), [image,mrPlane]);
  const rgba = useMemo(() => new ImageData(columns, rows), [columns, rows]);
  const displayImage = useMemo(() => {
    if (!reformat) return image;
    return {
      pixels: new image.pixels.constructor(rows * columns),
      bundle: {...image.bundle, pixels: {...image.bundle.pixels,shape:[1,rows,columns,1]}},
    };
  }, [image,reformat,rows,columns]);

  useEffect(() => {
    const surface = canvas.current;
    const {center, width} = image.bundle.display;
    if (reformat) copyMrReformat(image,mrPlane,frame,displayImage.pixels);
    localImageRgba(displayImage, reformat ? 0 : frame, center, width, rgba.data);
    surface.getContext('2d').putImageData(rgba, 0, 0);
  }, [image, frame, rgba, displayImage, mrPlane, reformat]);

  function stop() {
    stopTimer(playback);
    setPlaying(false);
  }

  useEffect(() => {
    setPlaying(false);
    return () => stopTimer(playback);
  }, [image, active]);
  useEffect(() => {
    function stopWhenHidden() {
      if (document.hidden) stop();
    }
    function stopWhenCollapsed(event) {
      if (event.target instanceof HTMLDetailsElement && !event.target.open && event.target.contains(canvas.current)) stop();
    }
    document.addEventListener('visibilitychange', stopWhenHidden);
    document.addEventListener('toggle', stopWhenCollapsed, true);
    return () => {
      document.removeEventListener('visibilitychange', stopWhenHidden);
      document.removeEventListener('toggle', stopWhenCollapsed, true);
    };
  }, []);

  function isVisible() {
    return !document.hidden && canvas.current?.getClientRects().length > 0;
  }

  function play() {
    if (!active || !timing || !isVisible() || playback.current !== null) return;
    let index = frame < frames - 1 ? frame : 0;
    if (index !== frame) onFrameChange(index);
    const origin = performance.now() - timing[index];
    setPlaying(true);

    function advance() {
      if (!isVisible()) {
        stop();
        return;
      }
      const now = performance.now() - origin;
      // Keep source-relative cadence across timer delays, including dropped display frames.
      while (index + 1 < frames && timing[index + 1] <= now) index++;
      onFrameChange(index);
      if (index === frames - 1) stop();
      else schedule();
    }
    function schedule() {
      playback.current = window.setTimeout(advance, Math.ceil(Math.max(0, origin + timing[index + 1] - performance.now())));
    }
    schedule();
  }

  function seek(next) {
    stop();
    onFrameChange(next);
  }

  return <>
    <canvas ref={canvas} width={columns} height={rows} role="img" aria-label={label}
      style={{width:'100%',maxWidth:512,display:'block',background:'#000',
        aspectRatio:mrLayout ? mrLayout.widthMm/mrLayout.heightMm : undefined}}/>
    <p>{reformat ? `Reformatted ${mrPlane}` : frameName} {frame+1} / {frames}</p>
    {frames > 1 && <>
      <input aria-label={frameLabel} type="range" min="0" max={frames-1} value={frame}
        onChange={event => seek(Number(event.target.value))}/>
      <div className="view-controls">
        <button type="button" disabled={frame === 0} onClick={() => seek(frame-1)}>{previousLabel}</button>
        <button type="button" disabled={frame === frames-1} onClick={() => seek(frame+1)}>{nextLabel}</button>
        {timing && <button type="button" onClick={playing ? stop : play} disabled={!active}>
          {playing ? 'Pause cine' : 'Play cine'}
        </button>}
      </div>
    </>}
  </>;
}
