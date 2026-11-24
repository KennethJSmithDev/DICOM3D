import React, {useEffect, useMemo, useRef, useState} from 'react';
import {verifyVolume, verifiedFrameRgba} from '../../../viewer/src/verified-volume.mjs';
import ResearchEvidencePanel from './ResearchEvidencePanel.jsx';
import LocalFrameFilePanel from './LocalFrameFilePanel.jsx';
import LocalEcgPanel from './LocalEcgPanel.jsx';
import LocalDicomObjectPanel from './LocalDicomObjectPanel.jsx';
import LocalSegPanel from './LocalSegPanel.jsx';
import LiveNativeImagePanel from './LiveNativeImagePanel.jsx';
import {bindRtContours} from './local-rt-contours.mjs';

const descriptorLimit=1024*1024;
const pixelLimit=80*1024*1024;
const liveCtPath='/dicom3d/api/ct/h000';
const liveDenied='Live CT access was denied.';
const liveUnavailable='Live CT retrieval is unavailable on this preview.';
const liveIncomplete='Live CT transfer was incomplete or could not be verified.';
const retained=' Existing study, if any, was retained.';

function canRetrieveLiveCt(){
  const {hostname,protocol,pathname}=window.location;
  return ['127.0.0.1','localhost','[::1]'].includes(hostname)&&
    ['http:','https:'].includes(protocol)&&pathname.startsWith('/dicom3d/');
}

async function readLiveBody(endpoint,options,limit,expected){
  const response=await fetch(liveCtPath+endpoint,options);
  if(!response.ok||!response.body){
    await response.body?.cancel();
    if(response.status===401||response.status===403)throw new Error(liveDenied);
    if(response.status===404||response.status===503)throw new Error(liveUnavailable);
    throw new Error(liveIncomplete);
  }
  const length=response.headers.get('Content-Length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>limit||
    (expected!==undefined&&Number(length)!==expected))){
    await response.body.cancel();
    throw new Error(liveIncomplete);
  }
  const reader=response.body.getReader(), bytes=new Uint8Array(limit);
  let used=0;
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      if(value.byteLength>limit-used){
        await reader.cancel();
        throw new Error(liveIncomplete);
      }
      bytes.set(value,used);
      used+=value.byteLength;
    }
  }finally{reader.releaseLock();}
  if(expected!==undefined&&used!==expected)throw new Error(liveIncomplete);
  return bytes.subarray(0,used);
}

// Local files and live packets share admission. Retrieval never replaces a
// displayed study until its source descriptor and every stored frame verify.
export default function LocalStudyPanel({onStudyChange, onFrameChange}) {
  const [descriptorFile,setDescriptorFile]=useState(null),[pixelFile,setPixelFile]=useState(null);
  const [study,setStudy]=useState(null),[sourceEncoding,setSourceEncoding]=useState(null),[frame,setFrame]=useState(0),[loading,setLoading]=useState(false);
  const [status,setStatus]=useState('No local study loaded.');
  const [rtObject,setRtObject]=useState(null),[showContours,setShowContours]=useState(true);
  const rt=useMemo(()=>bindRtContours(rtObject,study),[rtObject,study]);
  const contours=rt?.byFrame.get(frame)??[];
  const canvasRef=useRef(null), generation=useRef(0), controller=useRef(null);
  useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
  async function admit(read,progress,success,failure){
    const id=++generation.current; controller.current?.abort(); const ac=new AbortController();controller.current=ac;
    setLoading(true);setStatus(progress);
    try{
      const {metadata,bytes}=await read(ac.signal);
      const descriptor=metadata?.descriptor??metadata;
      const result=await verifyVolume(descriptor,bytes,{signal:ac.signal,sourceEncoding:metadata?.sourceEncoding});
      if(id!==generation.current||ac.signal.aborted)return;
      setStudy(result);setSourceEncoding(metadata?.sourceEncoding??null);setFrame(0);onStudyChange?.(result);onFrameChange?.(0);
      setStatus(success);
    }catch(error){
      if(id===generation.current&&!ac.signal.aborted)setStatus(failure(error)+retained);
    }finally{if(id===generation.current)setLoading(false);}
  }
  function load(){
    if(!descriptorFile||!pixelFile){setStatus('Select both local files.');return;}
    if(descriptorFile.size>descriptorLimit||pixelFile.size>pixelLimit){setStatus('The selected files exceed the local admission limits.');return;}
    return admit(async()=>({
      metadata:JSON.parse(await descriptorFile.text()),
      bytes:await pixelFile.arrayBuffer(),
    }),'Verifying local source and spatial metadata…',
    'Local verified CT admitted. No live retrieval, segmentation or atlas registration is supplied.',
    ()=>'Local source could not be verified.');
  }
  function loadLive(event){
    event.preventDefault();
    const form=event.currentTarget;
    const values=new FormData(form);
    const username=values.get('username'),password=values.get('password');
    form.reset();
    if(!canRetrieveLiveCt()||loading)return;
    if(!username||username.includes(':')||username.length>128||!password||password.length>256){
      setStatus('Enter a valid live CT username and password.');
      return;
    }
    const authorization='Basic '+btoa(String.fromCharCode(...new TextEncoder().encode(username+':'+password)));
    return admit(async signal=>{
      const options={
        credentials:'omit',mode:'same-origin',redirect:'error',cache:'no-store',
        headers:{Authorization:authorization,'X-DICOM3D-Request':'live-ct-v1'},
        signal:AbortSignal.any([signal,AbortSignal.timeout(120000)]),
      };
      const metadata=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(
        await readLiveBody('/descriptor',options,descriptorLimit)));
      const expected=(metadata?.descriptor??metadata)?.payload?.bytes;
      if(!Number.isSafeInteger(expected)||expected<1||expected>pixelLimit)throw new Error(liveIncomplete);
      const pixels=await readLiveBody('/pixels',options,expected,expected);
      return {metadata,bytes:pixels.buffer};
    },'Retrieving and verifying live H000 CT…','Live verified H000 CT admitted.',error=>{
      if(error.message===liveDenied||error.message===liveUnavailable)return error.message;
      return liveIncomplete;
    });
  }
  function close(){generation.current++;controller.current?.abort();setLoading(false);setStudy(null);setSourceEncoding(null);setFrame(0);onStudyChange?.(null);onFrameChange?.(0);setStatus('No local study loaded.');}
  function changeFrame(value){setFrame(value);onFrameChange?.(value);}
  useEffect(()=>{
    if(!study||!canvasRef.current)return;
    const [,rows,cols]=study.descriptor.shape, canvas=canvasRef.current;
    canvas.width=cols;canvas.height=rows;
    const ctx=canvas.getContext('2d'),image=ctx.createImageData(cols,rows),c=study.descriptor.calibration;
    verifiedFrameRgba(study,frame,c.center,c.width,image.data);ctx.putImageData(image,0,0);
  },[study,frame]);
  return <section className="imaging-panel" aria-label="Private local study">
    <h2>Imaging sources</h2>
    <LocalFrameFilePanel/>
    <LocalEcgPanel/>
    <LocalDicomObjectPanel onObjectChange={setRtObject}/>
    <h3>Verified CT</h3><p>Open the admission request and decoded pixel file from a prepared CT packet. The viewer checks the files on this device before displaying the study.</p>
    <label>Descriptor or admission request <input aria-label="Local CT descriptor" type="file" accept=".json" onChange={e=>setDescriptorFile(e.target.files?.[0]??null)}/></label>
    <label>Decoded values <input aria-label="Local CT stored values" type="file" accept=".bin,.raw16" onChange={e=>setPixelFile(e.target.files?.[0]??null)}/></label>
    <button type="button" onClick={load} disabled={loading||!descriptorFile||!pixelFile}>{loading?'Verifying…':'Open local CT'}</button>{' '}
    {(study||loading)&&<button type="button" onClick={close}>Close local CT</button>}
    {canRetrieveLiveCt()&&<details><summary>Live H000 CT retrieval</summary>
      <form onSubmit={loadLive} autoComplete="off">
        <p>Retrieve the public H000 study through the configured imaging service.</p>
        <label>Live CT username <input name="username" autoComplete="off" maxLength={128} required/></label>
        <label>Live CT password <input name="password" type="password" autoComplete="off" maxLength={256} required/></label>
        <button type="submit" disabled={loading}>Retrieve live H000 CT</button>
      </form>
    </details>}
    {canRetrieveLiveCt() && <LiveNativeImagePanel/>}
    <p role="status">{status}</p>
    {study&&<><div style={{position:'relative',maxWidth:512}}>
      <canvas ref={canvasRef} role="img" aria-label="Private acquired CT frame" style={{width:'100%',display:'block',background:'#000'}}/>
      {showContours && contours.length>0 && <svg role="img" aria-label="Source-linked RT contour outlines"
        viewBox={`0 0 ${study.descriptor.shape[2]} ${study.descriptor.shape[1]}`} preserveAspectRatio="none"
        style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
        stroke="#ffd26d" strokeWidth="1.5" fill="none">
        {contours.map(({points,type,label},index)=>type==='POINT'
          ? <circle key={index} aria-label={label} cx={points[0][0]} cy={points[0][1]} r="3" vectorEffect="non-scaling-stroke"/>
          : type==='OPEN_PLANAR'
            ? <polyline key={index} aria-label={label} points={points.join(' ')} vectorEffect="non-scaling-stroke"/>
            : <polygon key={index} aria-label={label} points={points.join(' ')} vectorEffect="non-scaling-stroke"/>)}
      </svg>}
    </div>
      {rt && <><label><input type="checkbox" checked={showContours} onChange={event=>setShowContours(event.target.checked)}/> Show RT contour outlines</label>
        <p role="status">{contours.length} RT contours on this source plane. {rt.count} verified outlines across the study.</p></>}
      {rtObject && !rt && <p role="status">No RT outlines could be matched to this verified CT.</p>}
      <label>Source frame {frame+1} / {study.descriptor.shape[0]} <input aria-label="Local CT frame" type="range" min="0" max={study.descriptor.shape[0]-1} value={frame} onChange={e=>changeFrame(Number(e.target.value))}/></label>
      <div className="view-controls">
        <button type="button" disabled={frame===0} onClick={()=>changeFrame(frame-1)}>Previous CT frame</button>
        <button type="button" disabled={frame===study.descriptor.shape[0]-1} onClick={()=>changeFrame(frame+1)}>Next CT frame</button>
      </div>
      <p>Source frames and 3D plane are experimental. Reference anatomy remains unregistered.</p>
      <LocalSegPanel study={study} frame={frame}/>
      <ResearchEvidencePanel study={study} sourceEncoding={sourceEncoding} frame={frame} admissionGeneration={generation} admissionId={generation.current}/></>}
  </section>;
}
