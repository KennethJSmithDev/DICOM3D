import {loadPublicResearchFixture} from './vendor/public-research-loader';
import {frameRgba,digest} from './vendor/ct-frame.mjs';
import {point,validateSpatial} from './vendor/ct-spatial.mjs';
const g:any=globalThis;
const check=(ok:any,message:string)=>{if(!ok)throw Error(message);};
const wait=async(test:()=>boolean)=>{const start=performance.now();while(!test()){if(g.nativeAbort)throw Error(g.nativeAbort);if(g.nativeReady&&g.Module._nrx_value(0)<0)throw Error('Native error');if(performance.now()-start>20000)throw Error('Native wait deadline');await new Promise(r=>setTimeout(r,10));}};
g.campaignResult={task:1,status:'PENDING',cycles:[]};
let fixture:any;
async function run(){
  const start=performance.now();document.querySelector('#load')!.setAttribute('disabled','');
  fixture=await loadPublicResearchFixture('/');
  const k=71,level=-600,width=1500,bytes=524288;
  const slice=fixture.pixels.subarray(k*262144,(k+1)*262144);
  const reference=frameRgba(fixture.pixels,k,level,width,new Uint8ClampedArray(1048576));
  (document.querySelector('#cpu') as HTMLCanvasElement).getContext('2d')!.putImageData(new ImageData(reference,512,512),0,0);
  const identity={k,sop:fixture.ctReceipt.slice_mapping[k].sop_uid,source:fixture.manifest.source,volumeSha:fixture.ctReceipt.volume.npy_sha256,sliceSha:await digest(new Uint8Array(slice.buffer,slice.byteOffset,bytes)),level,width};
  document.querySelector('#identity')!.textContent=JSON.stringify(identity,null,2);
  const m=validateSpatial(fixture.ctReceipt,fixture.manifest);
  let spatialError=0;for(const p of [[71,0,0],[71,511,511],[71,255.5,255.5]]){const patient=point(m.index_to_patient_mm,p);const back=point(m.patient_mm_to_index,patient);const model=point(m.patient_mm_to_model_m,patient);const round=point(m.model_m_to_patient_mm,model);spatialError=Math.max(spatialError,...back.map((v:number,i:number)=>Math.abs(v-p[i])),...round.map((v:number,i:number)=>Math.abs(v-patient[i])));}
  check(spatialError<=1e-9,'Spatial round-trip');
  await wait(()=>g.nativeReady===true);
  for(let cycle=0;cycle<3;cycle++){
    g.nativeReadbacks={};const module=g.Module;const token=module._nrx_init();check(token>0,'Native initialization');await wait(()=>module._nrx_value(0)===1);
    const ptr=module._nrx_source_ptr();check(typeof ptr==='bigint'&&ptr>=0n&&ptr<=BigInt(Number.MAX_SAFE_INTEGER),'Wasm64 pointer contract');
    const memory=g.wasmMemory;check(memory instanceof WebAssembly.Memory,'Wasm memory unavailable');const address=Number(ptr);check(address+bytes<=memory.buffer.byteLength,'Native span');
    const nativeBytes=new Uint8Array(memory.buffer,address,bytes);nativeBytes.set(new Uint8Array(slice.buffer,slice.byteOffset,bytes));
    check(await digest(nativeBytes)===identity.sliceSha,'Native source bytes');
    const rejectedBefore=module._nrx_value(5);check(module._nrx_publish(token,bytes-2)===0,'Invalid length accepted');
    check(module._nrx_publish(token,bytes)===1,'Source upload');const renderStart=performance.now();check(module._nrx_start(token)===1,'Native loop start');await wait(()=>module._nrx_value(0)===3);
    const source=g.nativeReadbacks[1] as Uint8Array, image=g.nativeReadbacks[2] as Uint8Array;
    check(source?.byteLength===bytes&&image?.byteLength===1048576,'Native GPU readback sizes');
    const sourceValues=new Uint16Array(source.buffer,source.byteOffset,262144);let sourceMismatch=0,maxRgb=0,alphaMismatch=0;let displayMismatch=0;
    for(let i=0;i<262144;i++){if(sourceValues[i]!==slice[i])sourceMismatch++;const j=i*4;for(let c=0;c<3;c++){const d=Math.abs(image[j+(2-c)]-reference[j+c]);maxRgb=Math.max(maxRgb,d);if(d>1)displayMismatch++;}if(image[j+3]!==255)alphaMismatch++;}
    const frameCount=module._nrx_value(1),errors=module._nrx_value(2);check(sourceMismatch===0,'GPU stored source mismatch');check(displayMismatch===0&&alphaMismatch===0,'GPU image mismatch');check(frameCount===60&&errors===0,'Frame/error boundary');
    const record:any={cycle,token,sourceMismatch,maxRgb,displayMismatch,alphaMismatch,frames:frameCount,errors,renderToReadbackMs:performance.now()-renderStart,sourceReadbackSha:await digest(source),imageReadbackSha:await digest(image),wasmMemoryBytes:memory.buffer.byteLength,liveBeforeDispose:module._nrx_value(3)};
    g.campaignResult.cycles.push(record);g.cycleReady=cycle;await wait(()=>g.captureComplete===cycle);
    let finishOld:any;const delayedOld=new Promise(resolve=>finishOld=resolve).then(()=>module._nrx_publish(token,bytes));
    const disposeStart=performance.now();check(module._nrx_dispose()===1,'Native dispose');finishOld();check(await delayedOld===0,'Stale generation accepted');record.delayedOldPublicationRejected=true;
    record.disposeMs=performance.now()-disposeStart;record.liveAfterDispose=module._nrx_value(3);record.rejections=module._nrx_value(5)-rejectedBefore;
    check(record.liveAfterDispose===0&&record.rejections===2,'Lifecycle accounting');g.cycleDisposed=cycle;
    if(cycle<2)await wait(()=>g.recreateReady===cycle);
  }
  g.campaignResult={...g.campaignResult,status:'PASS',identity,spatialError,loaderMetrics:fixture.metrics,elapsedMs:performance.now()-start};document.querySelector('#status')!.textContent='Task 1 correctness checks complete';
}
document.querySelector('#load')!.addEventListener('click',()=>run().catch(error=>{g.campaignResult.status='FAIL';g.campaignResult.error=String(error);document.querySelector('#status')!.textContent=String(error);console.error(error);}));
g.fixture=()=>fixture;
