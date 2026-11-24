import createRuntime from './native-study-runtime.mjs';
import wasmUrl from './native-study-runtime.wasm?url';
import {shader} from './native-study-shader.mjs';
import {opacityValues,opacityPerMm,columns,multiplyRows} from '../../../viewer/src/ct-volume-core.mjs';
import {interpolateSource,validateVolume} from '../imaging/h000-volume-core.mjs';

const voxelCount=512*512*103;
const canvasId='nrx-h000-canvas';
const step=.002;
const toTextureAxes=[[0,0,1,0],[0,1,0,0],[1,0,0,0],[0,0,0,1]];
const applyMatrix=(m,p)=>[0,1,2,3].map(axis=>m[axis]*p[0]+m[axis+4]*p[1]+m[axis+8]*p[2]+m[axis+12]*p[3]);
const worldPoint=(matrix,x,y,z)=>{
  const p=applyMatrix(matrix,[x,y,z,1]);
  return p.slice(0,3).map(value=>value/p[3]);
};
const bounds=[511.5,511.5,102.5];
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

function sampleOpacity(study,k,row,column,gain) {
  const hu=interpolateSource(study.pixels,k,row,column)-1024;
  let opacity=opacityPerMm[0];
  for(let i=1;i<opacityValues.length;i++){
    if(hu>=opacityValues[i]) opacity=opacityPerMm[i];
    else if(hu>opacityValues[i-1]){
      const f=(hu-opacityValues[i-1])/(opacityValues[i]-opacityValues[i-1]);
      opacity=opacityPerMm[i-1]+f*(opacityPerMm[i]-opacityPerMm[i-1]);
      break;
    }
  }
  return 1-(1-clamp(gain*opacity,0,.95))**(step*1000);
}

function pickNative(study,worldToTexture,display,x,y) {
  if(!display || display[60]<.5 || display[61]<=0 || Math.abs(x)>1 || Math.abs(y)>1)return null;
  const eye=worldPoint(display,x,y,display[55]);
  const target=worldPoint(display,x,y,display[62]);
  const delta=target.map((v,i)=>v-eye[i]);
  const norm=Math.hypot(...delta);
  if(!Number.isFinite(norm)||norm<1e-9)return null;
  const origin=applyMatrix(worldToTexture,[...eye,1]).slice(0,3);
  const direction=applyMatrix(worldToTexture,[...delta.map(v=>v/norm),0]).slice(0,3);
  let near=0,far=Infinity;
  for(let i=0;i<3;i++){
    const d=Math.abs(direction[i])<1e-8?1e-8:direction[i];
    const a=(-.5-origin[i])/d, b=(bounds[i]-origin[i])/d;
    near=Math.max(near,Math.min(a,b)); far=Math.min(far,Math.max(a,b));
  }
  if(display[59]>.5 && Math.abs(direction[2])>1e-8){
    const t=(display[58]-origin[2])/direction[2];
    const p=origin.map((v,i)=>v+t*direction[i]);
    if(t>0 && p[0]>=-.5 && p[0]<=511.5 && p[1]>=-.5 && p[1]<=511.5) far=Math.min(far,t);
  }
  let opacity=0;
  for(let i=0;i<512;i++){
    const t=near+(i+.5)*step;
    if(t>far||opacity>=.999)break;
    const [column,row,k]=origin.map((v,axis)=>v+t*direction[axis]);
    if(k<display[56])continue;
    const [c,r,z]=[column,row,k].map(v=>Math.floor(v+.5));
    if(c>=0&&c<512&&r>=0&&r<512&&z>=0&&z<103&&study.mask[(z*512+r)*512+c])return {k:z,row:r,column:c};
    if(display[51]>.5) opacity+=(1-opacity)*sampleOpacity(study,k,row,column,display[50]);
  }
  return null;
}

function nativeError(module) {
  const pointer=Number(module._nrx_error_ptr());
  if (!Number.isSafeInteger(pointer)||pointer<=0||pointer>=module.HEAPU8.byteLength) {
    return 'Native H000 error details are unavailable.';
  }
  return module.UTF8ToString(pointer,512);
}

async function waitForDevice(module, signal) {
  const deadline=performance.now()+12000;
  for(;;) {
    signal?.throwIfAborted();
    const status=module._nrx_state();
    if(status<0)throw new Error(nativeError(module));
    if(status===1)return;
    if(performance.now()>=deadline)throw new Error('Native WebGPU device initialization timed out.');
    await new Promise(resolve=>setTimeout(resolve,15));
  }
}

export async function createNrxStudyRenderer(canvas,{study,signal}={}) {
  signal?.throwIfAborted();
  if (!globalThis.navigator?.gpu)throw new Error('Native NRX requires WebGPU.');
  const matrices=validateVolume(study);
  if (!(study.mask instanceof Uint8Array) || study.mask.length!==voxelCount)throw new Error('Native NRX requires the admitted H000 source SEG.');
  if (!canvas?.isConnected || (document.getElementById(canvasId)&&document.getElementById(canvasId)!==canvas)) {
    throw new Error('The native viewport must own a connected canvas.');
  }
  canvas.id=canvasId;
  const worldToTexture=columns(multiplyRows(toTextureAxes,
    multiplyRows(matrices.patient_mm_to_index,matrices.model_m_to_patient_mm)));
  if(!worldToTexture.every(Number.isFinite))throw new Error('Invalid native H000 spatial transform.');
  let failure;
  const lost=new Promise(resolve=>{failure=resolve;});
  let module=null, disposed=false, previous=null;
  const scratch=new Float32Array(64);
  scratch.set(worldToTexture,16);
  const dispose=()=>{
    if(disposed)return;
    disposed=true;
    module?._nrx_dispose();
    module=null;
    previous=null;
  };
  try {
    module=await createRuntime({
      canvas,
      locateFile:()=>wasmUrl,
      onNrxFailure:failure,
    });
    signal?.throwIfAborted();
    const shaderBytes=new TextEncoder().encode(shader+'\0');
    if(shaderBytes.length>16384)throw new Error('Native H000 shader exceeds storage.');
    module.HEAPU8.set(shaderBytes,Number(module._nrx_shader_ptr()));
    module._nrx_init();
    await waitForDevice(module,signal);
    const source=new Uint8Array(study.pixels.buffer,study.pixels.byteOffset,study.pixels.byteLength);
    module.HEAPU8.set(source,Number(module._nrx_source_ptr()));
    module.HEAPU8.set(study.mask,Number(module._nrx_mask_ptr()));
    if(module._nrx_publish(source.byteLength,study.mask.byteLength)!==1)throw new Error('Native H000 upload was rejected.');
    signal?.throwIfAborted();
  } catch(error) {
    dispose();
    throw error;
  }

  return {
    lost,
    render({inverseViewProjection,nearDepth=0,farDepth=1,level=-600,width=1500,gain=1,clipK=-.5,
      frame=71,lesionSelected=false,lesionVisible=true,volumeVisible=true,lesionOpacity=1,
      planeVisible=false,planeOverlay=false}){
      if(disposed || !canvas.width || !canvas.height)return false;
      if(inverseViewProjection?.length!==16 || !Array.from(inverseViewProjection).every(Number.isFinite) ||
         ![nearDepth,farDepth,level,width,gain,clipK,frame,lesionOpacity].every(Number.isFinite) || width<=0) {
        throw new Error('Invalid native H000 presentation state.');
      }
      const w=canvas.width,h=canvas.height;
      scratch.set(inverseViewProjection,0);
      scratch.set([level,width,clamp(gain,0,2),Number(volumeVisible)],48);
      scratch.set([w,h,step,nearDepth],52);
      scratch.set([clamp(clipK,-.5,102.5),Number(lesionSelected),clamp(Math.round(frame),0,102),Number(planeVisible)],56);
      scratch.set([Number(lesionVisible),clamp(lesionOpacity,0,1),farDepth+(nearDepth-farDepth)*1e-6,Number(planeOverlay)],60);
      if(module._nrx_state()<0)throw new Error(nativeError(module));
      if(previous && scratch.every((v,i)=>v===previous[i]))return false;
      new Float32Array(module.HEAPU8.buffer,Number(module._nrx_uniform_ptr()),64).set(scratch);
      if(module._nrx_draw(w,h)!==1)throw new Error(nativeError(module) || 'Native H000 frame submission was rejected.');
      previous??=new Float32Array(64);
      previous.set(scratch);
      return true;
    },
    pick(x,y){return disposed?null:pickNative(study,worldToTexture,previous,x,y);},
    stats(){return {submissions:module?._nrx_submissions()??0,sourceTextureBytes:voxelCount*2,segTextureBytes:voxelCount};},
    dispose,
  };
}
