import {loadFiles,unloadWorkspace} from './main';

import {prepareReferenceExperience} from './reference-experience';

// Opt-in local prototype entry. Product and public Safe Demo entry points are unchanged.

const base=import.meta.env.BASE_URL;const mount=document.createElement('section');mount.className='section-body control-section';

mount.innerHTML=`<label>Generalized adult reference <select id="referenceVariant"><option value="bp3d-male">Male · BodyParts3D anatomy</option><option value="hra-female">Female · HRA anatomical reference</option></select></label><button id="referenceReload">Reload reference</button><button id="referenceUnload">Unload reference</button><p>Independent BodyParts3D male and HRA female reference sources; partial coverage, no patient registration. No patient DICOM required.</p><output id="referenceLoadState" hidden></output>`;

document.querySelector('#sourceMount')!.prepend(mount);document.title=import.meta.env.MODE==='safe-reference-demo'?'DICOM3D v0.5.0 · Anatomy Safe Demo':'DICOM3D · Reference Anatomy Prototype';

prepareReferenceExperience(mount);

const select=document.querySelector<HTMLSelectElement>('#referenceVariant')!;const reload=document.querySelector<HTMLButtonElement>('#referenceReload')!;let loads=0,sampleGeneration=0;

async function start(){const token=++sampleGeneration;(document.querySelector('#referenceUnload') as HTMLButtonElement).disabled=true;select.disabled=reload.disabled=true;const start=performance.now();const variant=select.value;

 try{const mr=await fetch(`${base}reference/${variant}.manifest.json`);if(!mr.ok)throw Error('Reference manifest unavailable');const text=await mr.text();const manifest=JSON.parse(text);const ar=await fetch(`${base}reference/${manifest.asset.relative_filename}`);if(!ar.ok)throw Error('Reference asset unavailable');const loaded=await loadFiles(new File([text],variant+'.manifest.json'),new File([await ar.arrayBuffer()],manifest.asset.relative_filename));if(!loaded)throw Error('Reference workspace failed to load');const metrics:any={variant,loads:++loads,loadMs:performance.now()-start,heap:(performance as any).memory?.usedJSHeapSize??null};const target=document.querySelector('#referenceLoadState')!;target.textContent=JSON.stringify(metrics);const samples:number[]=[];let last=performance.now();const sample=(now:number)=>{if(select.value!==variant||token!==sampleGeneration)return;samples.push(now-last);last=now;if(samples.length<120)requestAnimationFrame(sample);else{const sorted=samples.slice(1).sort((a,b)=>a-b);metrics.rafMs={median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],samples:sorted.length};target.textContent=JSON.stringify(metrics);}};requestAnimationFrame(sample);}

 catch(error){document.querySelector('#status')!.textContent=`Reference unavailable: ${error}`;}

 finally{select.disabled=reload.disabled=false;(document.querySelector('#referenceUnload') as HTMLButtonElement).disabled=false;}}

select.onchange=start;reload.onclick=start;document.querySelector<HTMLButtonElement>('#referenceUnload')!.onclick=async()=>{sampleGeneration++;document.querySelector('#referenceLoadState')!.textContent=JSON.stringify({unloaded:true,resources:await unloadWorkspace()});};start();

