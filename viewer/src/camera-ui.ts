import {getViewProjectionMatrix} from '@babylonjs/lite';
import {worldBounds,fitDistance,presentationDistance} from './camera-fit.mjs';
import {screenDragDelta} from './screen-drag.mjs';
export function prepareCamera({camera,canvas,sourceMeshes,sliceController,additionalBounds=()=>[],presentation=null}:any) {
  const toolbar=document.createElement('div');toolbar.id='cameraControls';toolbar.setAttribute('aria-label','Presentation camera controls');
  toolbar.innerHTML=`<div class="camera-actions"><button id="cameraFit" type="button">Fit complete assembly</button><button id="cameraFocus" type="button" disabled>Focus selected slice</button><button id="cameraRestore" type="button">Restore original camera</button></div><p id="cameraStatus" role="status" aria-live="polite"></p><small>Camera target follows geometric bounds. Source-space origin and model transforms stay unchanged.</small><pre id="cameraState" hidden></pre>`;
  (document.querySelector('#cameraMount')||canvas.parentElement!).append(toolbar);
  const get=(id:string)=>toolbar.querySelector(`#${id}`) as any;
  if(presentation){camera.alpha=presentation.presets[0].alpha;camera.beta=presentation.presets[0].beta;get('cameraRestore').textContent='Reset View';}
  const initial={alpha:camera.alpha,beta:camera.beta,fov:camera.fov};
  const listeners=new AbortController();
  if(new URLSearchParams(location.search).has('diagnostics')) {
    const live=document.createElement('output');live.id='cameraInteractionState';live.hidden=true;toolbar.append(live);
    const capture=()=>{const rect=canvas.getBoundingClientRect();live.textContent=JSON.stringify({alpha:camera.alpha,beta:camera.beta,radius:camera.radius,target:[camera.target.x,camera.target.y,camera.target.z],viewProjection:Array.from(getViewProjectionMatrix(camera,rect.width/rect.height)),canvas:{width:rect.width,height:rect.height}});};
    for(const type of ['pointerdown','pointermove','pointerup','click'])canvas.addEventListener(type,()=>requestAnimationFrame(()=>requestAnimationFrame(capture)),{signal:listeners.signal});
  }
  const originalMeshes=sourceMeshes.filter((m:any)=>m.visible!==false);
  let mode='original',pending=0;
  // Complete assembly includes temporarily hidden bands without revealing them.
  const assembly=()=>sliceController?.active?sliceController.meshes():sourceMeshes;
  const selected=()=>sliceController?.active?sliceController.selectedMeshes():[];
  const meshes=()=>{const list=mode==='selected'?selected():[...(mode==='original'?originalMeshes:assembly()),...additionalBounds()];return presentation?list.filter((m:any)=>m.visible!==false):list;};
  function cancelInertia() {
    for(const key of ['inertialAlphaOffset','inertialBetaOffset','inertialRadiusOffset','inertialPanningX','inertialPanningY'])camera[key]=0;
  }
  function fit() {
    const rect=canvas.getBoundingClientRect(),bounds=worldBounds(meshes());
    if(!bounds||rect.width<=0||rect.height<=0)return;
    cancelInertia();camera.target.set(...bounds.center);
    camera.radius=presentation?presentationDistance(bounds,camera.fov,rect.width/rect.height,camera.alpha,camera.beta,presentation.verticalFill,presentation.horizontalFill):fitDistance(bounds,camera.fov,rect.width/rect.height);
    camera.nearPlane=Math.max(bounds.radius*.001,1e-7);camera.farPlane=Math.max(camera.radius*100,bounds.radius*10);
    get('cameraStatus').textContent=`Framed ${mode==='selected'?(presentation?'selected structure':'selected slice'):presentation?'visible anatomy':mode==='original'?'original assembly':'complete assembly (including hidden bands)'} · presentation camera only`;
    capture(bounds);
  }
  function capture(bounds=worldBounds(meshes())) {
    if(!bounds)return;
    const rect=canvas.getBoundingClientRect();
    if(new URLSearchParams(location.search).has('diagnostics')) {
      const vp=getViewProjectionMatrix(camera,rect.width/rect.height);
      const corners=[];
      for(let mask=0;mask<8;mask++) {
        const p=[0,1,2].map(k=>(mask&(1<<k))?bounds.max[k]:bounds.min[k]);
        const q=[0,1,2,3].map(k=>vp[k]*p[0]+vp[4+k]*p[1]+vp[8+k]*p[2]+vp[12+k]);
        corners.push(q.slice(0,3).map(v=>v/q[3]));
      }
      get('cameraState').textContent=JSON.stringify({mode,target:[camera.target.x,camera.target.y,camera.target.z],radius:camera.radius,alpha:camera.alpha,beta:camera.beta,bounds,canvas:{width:rect.width,height:rect.height},corners,projectedHeightFraction:(Math.max(...corners.map(p=>p[1]))-Math.min(...corners.map(p=>p[1])))/2,requestedHeightFraction:presentation?.verticalFill??null,contained:corners.every(p=>Math.abs(p[0])<=1&&Math.abs(p[1])<=1&&p[2]>=0&&p[2]<=1),worldMatrices:meshes().map((m:any)=>Array.from(m.worldMatrix))});
    }
  }
  function schedule() {cancelAnimationFrame(pending);pending=requestAnimationFrame(fit);}
  function sync() {get('cameraFocus').disabled=selected().length===0;}
  const api={
    dragDelta:(anchor:number[],parent:any,dx:number,dy:number)=>{const r=canvas.getBoundingClientRect();return screenDragDelta(getViewProjectionMatrix(camera,r.width/r.height),parent,anchor,dx,dy,r.width,r.height);},
    fitAssembly:()=>{mode='assembly';schedule();},
    restore:()=>{mode='original';camera.alpha=initial.alpha;camera.beta=initial.beta;camera.fov=initial.fov;schedule();},
    sync,
    dispose(){listeners.abort();observer.disconnect();cancelAnimationFrame(pending);toolbar.remove();},
  };
  get('cameraFit').onclick=api.fitAssembly;
  get('cameraFocus').onclick=()=>{if(selected().length){mode='selected';schedule();}};
  get('cameraRestore').onclick=api.restore;
  if(presentation)for(const preset of presentation.presets){const button=document.createElement('button');button.id='camera'+preset.id;button.textContent=preset.label;button.type='button';button.onclick=()=>{cancelAnimationFrame(pending);cancelInertia();camera.alpha=preset.alpha;camera.beta=preset.beta;get('cameraStatus').textContent=`${preset.label} · camera distance and target preserved`;capture();};toolbar.querySelector('.camera-actions')!.append(button);}
  // Canvas size, not browser width, owns projection framing (panels alter it).
  const observer=new ResizeObserver(schedule);observer.observe(canvas);
  sync();schedule();
  return api;
}
