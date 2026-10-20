import {loadFiles,unloadWorkspace} from './main';
import {prepareReferenceExperience} from './reference-experience';
import {PUBLIC_RELEASE} from './public-release.mjs';

// Public and private entries retain the reference viewer and shared scene owner.
const base=import.meta.env.BASE_URL,publicDemo=import.meta.env.MODE==='safe-reference-demo';
const mount=document.createElement('section');mount.className='section-body control-section';
mount.innerHTML='<label>Generalized adult reference <select id="referenceVariant"><option value="bp3d-male">Male · BodyParts3D anatomy</option><option value="hra-female">Female · HRA anatomical reference</option></select></label><button id="referenceReload">Reload reference</button><button id="referenceUnload">Unload reference</button><p>Independent BodyParts3D male and HRA female reference sources; partial coverage, no patient registration. No patient DICOM required.</p><output id="referenceLoadState" hidden></output>';
document.querySelector('#sourceMount')!.prepend(mount);
document.title=publicDemo?PUBLIC_RELEASE.title:'DICOM3D · Reference Anatomy Prototype';
prepareReferenceExperience(mount);
const shell=publicDemo?(await import('./public-workstation')).preparePublicWorkstation():null;
const select=document.querySelector<HTMLSelectElement>('#referenceVariant')!,reload=document.querySelector<HTMLButtonElement>('#referenceReload')!;
let loads=0,sampleGeneration=0,busy=false;
const hooks=()=>shell?{onReady:shell.attach,onSelect:shell.selection,onIntent:shell.onIntent,onDispose:shell.detached}:{};
function setBusy(value:boolean){busy=value;select.disabled=reload.disabled=value;(document.querySelector('#referenceUnload') as HTMLButtonElement).disabled=value;shell?.busy(value);}
async function start(){
  if(busy)return;
  const token=++sampleGeneration,start=performance.now(),variant=select.value;setBusy(true);
  document.querySelector('#status')!.textContent='Loading generalized reference anatomy…';
  try{
    const mr=await fetch(`${base}reference/${variant}.manifest.json`);if(!mr.ok)throw Error('Reference manifest unavailable');
    const text=await mr.text(),manifest=JSON.parse(text),ar=await fetch(`${base}reference/${manifest.asset.relative_filename}`);if(!ar.ok)throw Error('Reference asset unavailable');
    const loaded=await loadFiles(new File([text],variant+'.manifest.json'),new File([await ar.arrayBuffer()],manifest.asset.relative_filename),hooks());if(!loaded)throw Error('Reference workspace failed to load');
    const metrics:any={variant,loads:++loads,loadMs:performance.now()-start,heap:(performance as any).memory?.usedJSHeapSize??null},target=document.querySelector('#referenceLoadState')!;
    target.textContent=JSON.stringify(metrics);
    const samples:number[]=[];let last=performance.now();
    const sample=(now:number)=>{if(select.value!==variant||token!==sampleGeneration)return;samples.push(now-last);last=now;if(samples.length<120)requestAnimationFrame(sample);else{const sorted=samples.slice(1).sort((a,b)=>a-b);metrics.rafMs={median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],samples:sorted.length};target.textContent=JSON.stringify(metrics);}};
    requestAnimationFrame(sample);
  }catch(error){document.querySelector('#status')!.textContent=`Reference unavailable: ${error}`;shell?.fail(error);}
  finally{setBusy(false);}
}
if(import.meta.env.DICOM3D_PUBLIC_STUDY)shell?.setLoadStudy(async()=>{
  if(busy)return;setBusy(true);sampleGeneration++;
  document.querySelector('#status')!.textContent='Loading attributed research CT and SEG · approximately 33.3 MB…';
  try{
    // No H000 import, fetch or decoded buffer exists before this explicit action.
    const {loadPublicResearchFixture}=await import('./public-research-loader');
    const fixture=await loadPublicResearchFixture(base);
    const loaded=await loadFiles(new File([JSON.stringify(fixture.manifest)],'public-source-manifest.json'),new File([fixture.glbBytes],fixture.manifest.asset.relative_filename),{...hooks(),publicStudy:fixture});
    if(!loaded)throw Error('Admitted study could not be rendered');
  }finally{setBusy(false);}
});
select.onchange=start;reload.onclick=start;
document.querySelector<HTMLButtonElement>('#referenceUnload')!.onclick=async()=>{if(busy)return;setBusy(true);sampleGeneration++;try{document.querySelector('#referenceLoadState')!.textContent=JSON.stringify({unloaded:true,resources:await unloadWorkspace()});}finally{setBusy(false);}};
start();

