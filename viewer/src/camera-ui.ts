import {getViewProjectionMatrix} from '@babylonjs/lite';
import {worldBounds,fitDistance} from './camera-fit.mjs';

export function prepareCamera({camera,canvas,sourceMeshes,sliceController}:any) {
  const toolbar=document.createElement('div');toolbar.id='cameraControls';toolbar.setAttribute('aria-label','Presentation camera controls');
  toolbar.innerHTML=`<div class="camera-actions"><button id="cameraFit" type="button">Fit complete assembly</button><button id="cameraFocus" type="button" disabled>Focus selected slice</button><button id="cameraRestore" type="button">Restore original camera</button></div><p id="cameraStatus" role="status" aria-live="polite"></p><small>Camera target follows geometric bounds. Source-space origin and model transforms stay unchanged.</small><pre id="cameraState" hidden></pre>`;
  const style=document.createElement('style');style.textContent=`#cameraControls{padding:8px 16px;border-bottom:1px solid #34414a;flex-shrink:0;font:13px system-ui}#cameraControls .camera-actions{display:flex;flex-wrap:wrap;gap:8px}#cameraControls button{min-height:44px}#cameraControls p{margin:4px 0}#cameraControls small{color:#aab8c3}#cameraControls :focus-visible{outline:2px solid #5edbff;outline-offset:2px}`;
  document.head.append(style);canvas.before(toolbar);
  const get=(id:string)=>toolbar.querySelector(`#${id}`) as any;
  const initial={alpha:camera.alpha,beta:camera.beta,fov:camera.fov};
  const originalMeshes=sourceMeshes.filter((m:any)=>m.visible!==false);
  let mode='original',pending=0;
  // Complete assembly includes temporarily hidden bands without revealing them.
  const assembly=()=>sliceController?.active?sliceController.meshes():sourceMeshes;
  const selected=()=>sliceController?.active?sliceController.selectedMeshes():[];
  const meshes=()=>mode==='selected'?selected():mode==='original'?originalMeshes:assembly();
  function cancelInertia() {
    for(const key of ['inertialAlphaOffset','inertialBetaOffset','inertialRadiusOffset','inertialPanningX','inertialPanningY'])camera[key]=0;
  }
  function fit() {
    const rect=canvas.getBoundingClientRect(),bounds=worldBounds(meshes());
    if(!bounds||rect.width<=0||rect.height<=0)return;
    cancelInertia();camera.target.set(...bounds.center);
    camera.radius=fitDistance(bounds,camera.fov,rect.width/rect.height);
    camera.nearPlane=Math.max(bounds.radius*.001,1e-7);camera.farPlane=Math.max(camera.radius*100,bounds.radius*10);
    get('cameraStatus').textContent=`Framed ${mode==='selected'?'selected slice':mode==='original'?'original assembly':'complete assembly (including hidden bands)'} · presentation camera only`;
    if(new URLSearchParams(location.search).has('diagnostics')) {
      const vp=getViewProjectionMatrix(camera,rect.width/rect.height);
      const corners=[];
      for(let mask=0;mask<8;mask++) {
        const p=[0,1,2].map(k=>(mask&(1<<k))?bounds.max[k]:bounds.min[k]);
        const q=[0,1,2,3].map(k=>vp[k]*p[0]+vp[4+k]*p[1]+vp[8+k]*p[2]+vp[12+k]);
        corners.push(q.slice(0,3).map(v=>v/q[3]));
      }
      get('cameraState').textContent=JSON.stringify({mode,target:[camera.target.x,camera.target.y,camera.target.z],radius:camera.radius,alpha:camera.alpha,beta:camera.beta,bounds,canvas:{width:rect.width,height:rect.height},corners,contained:corners.every(p=>Math.abs(p[0])<=1&&Math.abs(p[1])<=1&&p[2]>=0&&p[2]<=1),worldMatrices:meshes().map((m:any)=>Array.from(m.worldMatrix))});
    }
  }
  function schedule() {cancelAnimationFrame(pending);pending=requestAnimationFrame(fit);}
  function sync() {get('cameraFocus').disabled=selected().length===0;}
  const api={
    fitAssembly:()=>{mode='assembly';schedule();},
    restore:()=>{mode='original';camera.alpha=initial.alpha;camera.beta=initial.beta;camera.fov=initial.fov;schedule();},
    sync,
  };
  get('cameraFit').onclick=api.fitAssembly;
  get('cameraFocus').onclick=()=>{if(selected().length){mode='selected';schedule();}};
  get('cameraRestore').onclick=api.restore;
  // Canvas size, not browser width, owns projection framing (panels alter it).
  new ResizeObserver(schedule).observe(canvas);
  sync();schedule();
  return api;
}
