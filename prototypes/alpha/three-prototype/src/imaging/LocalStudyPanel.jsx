import React, {useEffect, useRef, useState} from 'react';
import {verifyVolume, verifiedFrameRgba} from '../../../viewer/src/verified-volume.mjs';

// Files remain in the browser; no fetch or upload is used. The adapter validates
// the supplied producer descriptor and every decoded frame before publication.
export default function LocalStudyPanel({onStudyChange, onFrameChange}) {
  const [descriptorFile,setDescriptorFile]=useState(null),[pixelFile,setPixelFile]=useState(null);
  const [study,setStudy]=useState(null),[frame,setFrame]=useState(0),[loading,setLoading]=useState(false);
  const [status,setStatus]=useState('No local study loaded.');
  const canvasRef=useRef(null), generation=useRef(0), controller=useRef(null);
  useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
  async function load(){
    const id=++generation.current; controller.current?.abort(); const ac=new AbortController();controller.current=ac;
    if(!descriptorFile||!pixelFile){setLoading(false);setStatus('Select both local files.');return;}
    if(descriptorFile.size>1024*1024||pixelFile.size>80*1024*1024){setLoading(false);setStatus('The selected files exceed the local admission limits.');return;}
    setLoading(true);setStatus('Verifying local source and spatial metadata…');
    try{
      const metadata=JSON.parse(await descriptorFile.text());
      const descriptor=metadata?.descriptor??metadata;
      const bytes=await pixelFile.arrayBuffer();
      const result=await verifyVolume(descriptor,bytes,{signal:ac.signal,sourceEncoding:metadata?.sourceEncoding});
      if(id!==generation.current||ac.signal.aborted)return;
      setStudy(result);setFrame(0);onStudyChange?.(result);onFrameChange?.(0);
      setStatus('Local verified CT admitted. No live retrieval, segmentation or atlas registration is supplied.');
    }catch{
      if(id===generation.current&&!ac.signal.aborted)setStatus('Local source could not be verified. Existing study, if any, was retained.');
    }finally{if(id===generation.current)setLoading(false);}
  }
  function close(){generation.current++;controller.current?.abort();setLoading(false);setStudy(null);setFrame(0);onStudyChange?.(null);onFrameChange?.(0);setStatus('No local study loaded.');}
  function changeFrame(value){setFrame(value);onFrameChange?.(value);}
  useEffect(()=>{
    if(!study||!canvasRef.current)return;
    const [,rows,cols]=study.descriptor.shape, canvas=canvasRef.current;
    canvas.width=cols;canvas.height=rows;
    const ctx=canvas.getContext('2d'),image=ctx.createImageData(cols,rows),c=study.descriptor.calibration;
    verifiedFrameRgba(study,frame,c.center,c.width,image.data);ctx.putImageData(image,0,0);
  },[study,frame]);
  return <section className="imaging-panel" aria-label="Private local study">
    <h2>Local verified CT</h2><p>Files stay on this device. Choose a verified descriptor or admission request and its decoded stored values. Previously retrieved IRIS packets can be opened here; this does not connect to IRIS live.</p>
    <label>Descriptor or admission request <input aria-label="Local CT descriptor" type="file" accept=".json" onChange={e=>setDescriptorFile(e.target.files?.[0]??null)}/></label>
    <label>Decoded values <input aria-label="Local CT stored values" type="file" accept=".bin,.raw16" onChange={e=>setPixelFile(e.target.files?.[0]??null)}/></label>
    <button type="button" onClick={load} disabled={loading}>{loading?'Verifying…':'Open local CT'}</button>{' '}
    {(study||loading)&&<button type="button" onClick={close}>Close local CT</button>}
    <p role="status">{status}</p>
    {study&&<><canvas ref={canvasRef} aria-label="Private acquired CT frame" style={{width:'100%',maxWidth:512,display:'block',background:'#000'}}/>
      <label>Source frame {frame+1} / {study.descriptor.shape[0]} <input aria-label="Local CT frame" type="range" min="0" max={study.descriptor.shape[0]-1} value={frame} onChange={e=>changeFrame(Number(e.target.value))}/></label>
      <p>Source frames and 3D plane are experimental. No source SEG or atlas registration is available.</p></>}
  </section>;
}
