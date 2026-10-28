import {loadFiles,unloadWorkspace} from './main';
import {prepareReferenceExperience} from './reference-experience';
import {PUBLIC_RELEASE} from './public-release.mjs';

// Public and private entries retain the reference viewer and shared scene owner.
const base=import.meta.env.BASE_URL,publicDemo=import.meta.env.MODE==='safe-reference-demo';
const mount=document.createElement('section');mount.className='section-body control-section';
mount.innerHTML='<label>Generalized adult reference <select id="referenceVariant"><option value="bp3d-male">Male Â· BodyParts3D anatomy</option><option value="hra-female">Female Â· HRA anatomical reference</option></select></label><button id="referenceReload">Reload reference</button><button id="referenceUnload">Unload reference</button><p>Independent BodyParts3D male and HRA female reference sources; partial coverage, no patient registration. No patient DICOM required.</p><output id="referenceLoadState" hidden></output>';
document.querySelector('#sourceMount')!.prepend(mount);
document.title=publicDemo?PUBLIC_RELEASE.title:'DICOM3D Â· Reference Anatomy Prototype';
prepareReferenceExperience(mount);
const shell=publicDemo?(await import('./public-workstation')).preparePublicWorkstation():null;
const select=document.querySelector<HTMLSelectElement>('#referenceVariant')!,reload=document.querySelector<HTMLButtonElement>('#referenceReload')!;
const requestedReference=new URLSearchParams(location.search).get('reference');if(['bp3d-male','hra-female'].includes(requestedReference??''))select.value=requestedReference!;
let loads=0,sampleGeneration=0,busy=false;
const hooks=()=>shell?{onReady:shell.attach,onSelect:shell.selection,onIntent:shell.onIntent,onDispose:shell.detached,getRendererIntent:shell.rendererIntent}:{};
function setBusy(value:boolean){busy=value;select.disabled=reload.disabled=value;(document.querySelector('#referenceUnload') as HTMLButtonElement).disabled=value;shell?.busy(value);}
async function start(){
  if(busy)return;
  const token=++sampleGeneration,start=performance.now(),variant=select.value;setBusy(true);
  document.querySelector('#status')!.textContent='Loading generalized reference anatomyâ€¦';
  try{
    const mr=await fetch(`${base}reference/${variant}.manifest.json`);if(!mr.ok)throw Error('Reference manifest unavailable');
    const text=await mr.text(),manifest=JSON.parse(text);
    // HRA is distributed in ordered byte chunks; loadFiles still verifies the original GLB SHA-256.
    const names=variant==='hra-female' && manifest.asset.relative_filename==='hra-female.glb'
      ? ['hra-female.glb.part001','hra-female.glb.part002','hra-female.glb.part003'] : [manifest.asset.relative_filename];
    const parts:Blob[]=[];for(const name of names){const response=await fetch(`${base}reference/${name}`);if(!response.ok)throw Error('Reference asset unavailable: '+name);parts.push(await response.blob());}
    const loaded=await loadFiles(new File([text],variant+'.manifest.json'),new File(parts,manifest.asset.relative_filename),hooks());if(!loaded)throw Error('Reference workspace failed to load');
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
  document.querySelector('#status')!.textContent='Loading attributed research CT and SEG Â· approximately 33.3 MBâ€¦';
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


// Private ingress uses one verified boundary; the optional loopback fixture is public H000 only.
if((import.meta.env.DICOM3D_VERIFIED_VOLUME_IMPORT===true||import.meta.env.DICOM3D_PRIVATE_VOLUME_DEV===true)&&shell){
 const panel=document.createElement('details');panel.id='verifiedVolumeImport';panel.open=false;
 panel.innerHTML='<summary>Open verified study Â· local files Â· Babylon Lite</summary><label>Verified admission packet <input id="verifiedDescriptor" type="file" accept=".json"></label><label>Decoded stored values <input id="verifiedPixels" type="file" accept=".raw16,.bin"></label><button id="verifiedLoad" type="button">Open verified CT</button><button id="bdpPublicFixture" type="button">Open I001 retrieved H000 Â· local qualification</button><p>Choose an existing verified volume packet and its stored pixel payload. Original DICOM and live PACS/IRIS connection are not enabled here. No SEG or atlas registration is inferred.</p><output id="verifiedLoadState" hidden></output>';
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
