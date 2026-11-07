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
// Private prototype only: the existing complete male and female paths remain intact.
const semanticEnabled=new URLSearchParams(location.search).get('semanticMale')==='1';
const semanticPanel=document.createElement('section');semanticPanel.hidden=true;
semanticPanel.innerHTML='<h3>Male semantic bundles · private research</h3><p>Load one bundle or all bundles. Other catalog entries are not resident until loaded. Each request replaces the current reference scene.</p><label>Find catalog anatomy <input id="semanticSearch" type="search" autocomplete="off"></label><label>Catalog structure <select id="semanticStructure"></select></label><button type="button" id="semanticLoad">Load selected structure’s bundle</button><button type="button" id="semanticFull">Load full body from bundles</button><button type="button" id="semanticCancel" disabled>Cancel fetch</button><button type="button" id="semanticUnload">Unload reference</button><output id="semanticStatus" role="status"></output>';
if(semanticEnabled){select.add(new Option('Male · semantic bundles (private)','bp3d-male-semantic'));mount.append(semanticPanel);}
const semanticDirectory=new URL(`${base}reference/semantic-male/`,location.href);
let semanticIndex:any=null,semanticAbort:AbortController|null=null,semanticToken=0;
const semanticStatus=semanticPanel.querySelector<HTMLOutputElement>('#semanticStatus')!,semanticSearch=semanticPanel.querySelector<HTMLInputElement>('#semanticSearch')!,semanticStructure=semanticPanel.querySelector<HTMLSelectElement>('#semanticStructure')!,semanticLoad=semanticPanel.querySelector<HTMLButtonElement>('#semanticLoad')!,semanticCancel=semanticPanel.querySelector<HTMLButtonElement>('#semanticCancel')!;
function updateSemanticOptions(){const q=semanticSearch.value.trim().toLocaleLowerCase(),old=semanticStructure.value;semanticStructure.replaceChildren();for(const part of semanticIndex?.structures??[])if(!q||`${part.label} ${part.id}`.toLocaleLowerCase().includes(q))semanticStructure.add(new Option(`${part.label} · ${part.id}`,part.id));if([...semanticStructure.options].some(o=>o.value===old))semanticStructure.value=old;semanticStatus.textContent=`${semanticStructure.options.length} catalog structures; geometry loads only on request.`;}
semanticSearch.oninput=updateSemanticOptions;
semanticCancel.onclick=()=>{semanticToken++;semanticAbort?.abort();semanticCancel.disabled=true;semanticStatus.textContent='Bundle fetch cancelled; previous scene retained.';};
semanticPanel.querySelector<HTMLButtonElement>('#semanticUnload')!.onclick=()=>{if(!busy)(document.querySelector('#referenceUnload') as HTMLButtonElement).click();};
async function startSemantic(full=false){
 const token=++semanticToken;semanticAbort?.abort();const abort=new AbortController();semanticAbort=abort;semanticCancel.disabled=false;
 try{
  const loader=await import('./semantic-atlas-loader.mjs');
  if(!semanticIndex){semanticStatus.textContent='Loading semantic catalog…';semanticIndex=await loader.loadSemanticIndex(semanticDirectory,abort.signal);updateSemanticOptions();}
  const entry=semanticIndex.structures.find((s:any)=>s.id===semanticStructure.value);if(!entry)throw Error('Choose a catalog structure');
  semanticStatus.textContent=full?'Loading all semantic bundles…':`Loading bundle ${entry.bundleId}…`;
  let result:any;
  if(full){const loaded=[];for(const bundle of semanticIndex.bundles){if(abort.signal.aborted)return;semanticStatus.textContent=`Loading bundle ${loaded.length+1} of ${semanticIndex.bundles.length}…`;loaded.push(await loader.loadSemanticBundle(semanticIndex,semanticDirectory,bundle.id,abort.signal));}if(abort.signal.aborted)return;semanticStatus.textContent='Assembling verified bundles…';result=await loader.mergeSemanticBundles(semanticIndex,loaded);}
  else result=await loader.loadSemanticBundle(semanticIndex,semanticDirectory,entry.bundleId,abort.signal);
  if(token!==semanticToken||abort.signal.aborted)return;
  semanticCancel.disabled=true;semanticStatus.textContent='Opening verified bundle…';
  const baseHooks:any=hooks();const loaded=await loadFiles(new File([JSON.stringify(result.manifest)],result.bundle.manifestUrl),new File([result.bytes],result.bundle.url),{...baseHooks,onReady:async(context:any)=>{await baseHooks.onReady?.(context);if(!full){const box=document.querySelector<HTMLSelectElement>('#referenceSelect');if(box){box.value=entry.id;box.dispatchEvent(new Event('change',{bubbles:true}));}}}});
  if(!loaded)throw Error('Verified bundle could not be rendered');
  semanticStatus.textContent=`Loaded ${result.bundle.id}: ${result.bundle.structureIds.length} resident structures.${full?' All catalog structures are resident.':' Other catalog entries are not loaded.'}`;
 }catch(error){if(!abort.signal.aborted){semanticStatus.textContent=`Semantic bundle unavailable: ${error}. Previous scene is retained if verification failed.`;}}
 finally{if(token===semanticToken){semanticAbort=null;semanticCancel.disabled=true;}}
}
semanticLoad.onclick=()=>{if(busy)return;setBusy(true);startSemantic().finally(()=>setBusy(false));};
semanticPanel.querySelector<HTMLButtonElement>('#semanticFull')!.onclick=()=>{if(busy)return;setBusy(true);startSemantic(true).finally(()=>setBusy(false));};
const requestedReference=new URLSearchParams(location.search).get('reference');if(semanticEnabled&&!requestedReference)select.value='bp3d-male-semantic';else if(['bp3d-male','hra-female'].includes(requestedReference??''))select.value=requestedReference!;
let loads=0,sampleGeneration=0,busy=false;
const hooks=()=>shell?{onReady:shell.attach,onSelect:shell.selection,onIntent:shell.onIntent,onDispose:shell.detached,getRendererIntent:shell.rendererIntent}:{};
function setBusy(value:boolean){busy=value;select.disabled=reload.disabled=value;(document.querySelector('#referenceUnload') as HTMLButtonElement).disabled=value;shell?.busy(value);}
async function start(){
  if(busy)return;
  const token=++sampleGeneration,start=performance.now(),variant=select.value;setBusy(true);
  semanticPanel.hidden=variant!=='bp3d-male-semantic';
  if(variant==='bp3d-male-semantic'){try{await startSemantic();}finally{setBusy(false);}return;}
  document.querySelector('#status')!.textContent='Loading generalized reference anatomy…';
  try{
    const mr=await fetch(`${base}reference/${variant}.manifest.json`);if(!mr.ok)throw Error('Reference manifest unavailable');
    const text=await mr.text(),manifest=JSON.parse(text),ar=await fetch(`${base}reference/${manifest.asset.relative_filename}`);if(!ar.ok)throw Error('Reference asset unavailable');
    const loaded=await loadFiles(new File([text],variant+'.manifest.json'),new File([await ar.blob()],manifest.asset.relative_filename),hooks());if(!loaded)throw Error('Reference workspace failed to load');
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
document.querySelector<HTMLButtonElement>('#referenceUnload')!.onclick=async()=>{if(busy)return;setBusy(true);sampleGeneration++;try{document.querySelector('#referenceLoadState')!.textContent=JSON.stringify({unloaded:true,resources:await unloadWorkspace()});if(select.value==='bp3d-male-semantic')semanticStatus.textContent='Reference unloaded; no catalog geometry is resident.';}finally{setBusy(false);}};
start();


// Private ingress uses one verified boundary; the optional loopback fixture is public H000 only.
if((import.meta.env.DICOM3D_VERIFIED_VOLUME_IMPORT===true||import.meta.env.DICOM3D_PRIVATE_VOLUME_DEV===true)&&shell){
 const panel=document.createElement('details');panel.id='verifiedVolumeImport';panel.open=false;
 panel.innerHTML='<summary>Open verified study · local files · Babylon Lite</summary><label>Verified admission packet <input id="verifiedDescriptor" type="file" accept=".json"></label><label>Decoded stored values <input id="verifiedPixels" type="file" accept=".raw16,.bin"></label><button id="verifiedLoad" type="button">Open verified CT</button><button id="bdpPublicFixture" type="button">Open I001 retrieved H000 · local qualification</button><p>Choose an existing verified volume packet and its stored pixel payload. Original DICOM and live PACS/IRIS connection are not enabled here. No SEG or atlas registration is inferred.</p><output id="verifiedLoadState" hidden></output>';
 const openStudy=document.createElement('button');openStudy.id='openVerifiedStudy';openStudy.textContent='Open Study';reload.after(openStudy);openStudy.onclick=()=>{panel.open=!panel.open;if(panel.open)panel.scrollIntoView({block:'nearest'});};
 (document.getElementById('viewerDrawer')??mount.parentElement)!.append(panel);if(import.meta.env.DICOM3D_PRIVATE_VOLUME_DEV!==true)panel.querySelector('#bdpPublicFixture')!.remove();let token=0,abort:AbortController|null=null,lastVerified:any=null;
 (window as any).__bdpCandidate={backend:'babylon',snapshot:()=>({backend:'babylon',loaded:Boolean(lastVerified),descriptor:lastVerified?.descriptor??null}),assertSource:()=>lastVerified?.assertSourceUnchanged()};
 document.addEventListener('dicom3d-workspace-change',(event:any)=>{if(!event.detail?.verifiedVolume)lastVerified=null;});
 async function admit(read:()=>Promise<any>){
  if(busy)return;setBusy(true);const id=++token;abort?.abort();abort=new AbortController();const out=panel.querySelector('output')!;out.textContent='';
  try{
   const [packet,bytes]=await read();
   if(packet.apiVersion!==1||packet.representation!=='spatial-volume'||!packet.descriptor||!packet.sourceEncoding)throw Error('A truthful versioned source-admission packet is required');
   const {verifyVolume,verifiedManifest,verifiedPresentationReceipt}=await import('./verified-volume.mjs');
   const v=await verifyVolume(packet.descriptor,bytes,{signal:abort.signal,sourceEncoding:packet.sourceEncoding});if(id!==token)return;
   const study={verifiedVolume:v,pixels:v.pixels,mask:null,ctReceipt:verifiedPresentationReceipt(v),metrics:{sourceBytes:v.pixels.byteLength}};
   const loaded=await loadFiles(new File([JSON.stringify(verifiedManifest(v))],'verified-volume.json'),undefined,{...hooks(),onDispose:()=>{if(lastVerified===v)lastVerified=null;shell.detached();},verifiedVolume:v,workstationStudy:study});
   if(id!==token)return;if(!loaded)throw Error('Verified workstation construction failed');lastVerified=v;
   out.textContent=JSON.stringify({loaded:true,backend:'babylon',shape:v.descriptor.shape,payloadSha256:v.descriptor.payload.sha256});
  }catch(error){out.textContent=JSON.stringify({loaded:false,error:String(error)});shell.fail(error);}finally{setBusy(false);}
 }
 panel.querySelector<HTMLButtonElement>('#verifiedLoad')!.onclick=()=>admit(async()=>{const a=panel.querySelector<HTMLInputElement>('#verifiedDescriptor')!.files?.[0],b=panel.querySelector<HTMLInputElement>('#verifiedPixels')!.files?.[0];if(!a||!b||a.size>1024*1024||b.size>80*1024*1024)throw Error('Verified input bounds');return [JSON.parse(await a.text()),await b.arrayBuffer()];});
 if(import.meta.env.DICOM3D_PRIVATE_VOLUME_DEV===true)panel.querySelector<HTMLButtonElement>('#bdpPublicFixture')!.onclick=()=>admit(async()=>{const a=await fetch(base+'bdp-fixture/request.json',{cache:'no-store',signal:abort!.signal});if(!a.ok)throw Error('Pinned local public fixture unavailable');const packet=await a.json();const b=await fetch(base+'bdp-fixture/payload.raw16',{cache:'no-store',signal:abort!.signal});if(!b.ok||Number(b.headers.get('Content-Length'))!==packet.descriptor.payload.bytes)throw Error('Pinned public fixture payload unavailable');return [packet,await b.arrayBuffer()];});
}
