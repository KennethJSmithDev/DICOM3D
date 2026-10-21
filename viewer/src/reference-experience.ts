import './reference-experience.css';
import {prepareLocalImageInspector} from './local-image-ui';
import {prepareConnectPrototype} from './connect-ui';
const publicReferenceDemo=import.meta.env.MODE==='safe-reference-demo';

// Reference-entry presentation only. Existing controllers retain their DOM and state.
export function prepareReferenceExperience(library:HTMLElement) {
  document.body.classList.add('anatomy-experience');
  const workspace=document.querySelector('.workspace')!;
  const inspector=document.querySelector<HTMLDetailsElement>('#workspaceControls')!;
  inspector.querySelector('summary')!.textContent='Anatomy explorer';
  const source=document.querySelector<HTMLElement>('#sourceMount')!;
  const imaging=document.createElement('details');imaging.id='imagingRail';
  imaging.innerHTML='<summary>Local imaging</summary><div class="imaging-body"><h2>Patient evidence</h2><p>Reference anatomy works without a study. Load accepted local imaging here when available. Reference anatomy is not registered to your study.</p></div>';
  imaging.querySelector('div')!.append(source);workspace.prepend(imaging);
  if(!publicReferenceDemo)prepareLocalImageInspector();
  if(publicReferenceDemo)imaging.hidden=true;
  source.querySelectorAll<HTMLElement>('details').forEach(el=>{el.hidden=false;});
  const viewport=workspace.querySelector<HTMLElement>('main.viewport')!;
  const heading=viewport.querySelector('.viewport-heading')!;
  heading.innerHTML='<div><span class="eyebrow">REFERENCE WORKSPACE</span><strong>Explore human anatomy</strong></div><span class="research-badge">Research prototype</span>';
  library.classList.add('reference-library');viewport.insertBefore(library,heading.nextSibling);
  const mode=document.createElement('p');mode.id='workspaceMode';mode.className='workspace-mode';mode.setAttribute('role','status');library.after(mode);
  const returnReference=document.createElement('button');returnReference.id='returnReference';returnReference.textContent='Return to reference';returnReference.hidden=true;library.append(returnReference);
  returnReference.onclick=()=>document.querySelector<HTMLButtonElement>('#referenceReload')!.click();
  document.addEventListener('dicom3d-workspace-change',(event:Event)=>{
    const detail=(event as CustomEvent).detail;const reference=detail.kind==='reference',study=detail.kind==='study';
    workspace.setAttribute('data-workspace-kind',detail.kind);
    mode.textContent=reference?'Generalized reference · source anatomy, partial coverage · no patient study loaded':study?(publicReferenceDemo?'Curated public research study · source-linked CT / lesion · reference anatomy is not registered':'Local study · source-linked CT / lesion · reference anatomy is not registered to this study'):publicReferenceDemo?'Workspace empty · load a generalized reference':'Workspace empty · load a reference or choose accepted local source files';
    returnReference.hidden=!study;
    (document.querySelector('#referenceReload') as HTMLElement).textContent=study?'Load selected reference':'Reload reference';
    heading.querySelector('.eyebrow')!.textContent=reference?'REFERENCE WORKSPACE':study?(publicReferenceDemo?'PUBLIC RESEARCH STUDY':'LOCAL STUDY WORKSPACE'):'LOCAL WORKSPACE';
    heading.querySelector('strong')!.textContent=reference?'Explore human anatomy':study?'Explore source imaging':'Choose a source';
    document.querySelector('#renderCanvas')!.setAttribute('aria-label',study?'Source CT and lesion workspace':'Generalized reference anatomy');
    if(reference)imaging.open=false;
  });
  const hint=document.createElement('div');hint.className='canvas-hint';hint.textContent='Drag to orbit · scroll / pinch to zoom · select a structure to explore';viewport.append(hint);
  const evidence=document.createElement('details');evidence.id='evidencePanel';
  evidence.innerHTML='<summary>Documents & evidence <span>Source identity · limitations · local research</span></summary><div class="evidence-grid"><div><h2>Source evidence</h2><p>Generalized anatomy and patient imaging are separate sources. Display choices do not establish anatomical or clinical accuracy.</p></div><div><h2>Clinical references</h2><p>Optional public-test evidence below. Local imaging is never uploaded or implicitly linked. No clinical records are generated or inferred.</p></div></div>';
  const metadata=document.querySelector('#sourceMetadata')!.closest('details')!;metadata.removeAttribute('data-advanced');evidence.querySelector('.evidence-grid')!.append(metadata);
  workspace.append(evidence);
  // Public demo composes the same reference controller; no live-provider controls mount.
  if(!publicReferenceDemo)prepareConnectPrototype(evidence.querySelector('.evidence-grid')!);
  else {
    evidence.querySelector('.evidence-grid > div:nth-child(2)')!.innerHTML='<h2>Reference provenance</h2><p>Licensed generalized anatomy only. No patient records, local-file import or connected clinical service is included in this public demonstration.</p>';
    evidence.querySelector('summary span')!.textContent='Source identity · attribution · limitations';
    document.body.classList.add('safe-reference-demo');
    const links=document.createElement('nav');links.setAttribute('aria-label','Demo project links');
    links.innerHTML='<a href="https://github.com/KennethJSmithDev/DICOM3D">GitHub</a> · <a href="https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.5.1">Install v0.5.1</a> · <a href="https://openexchange.intersystems.com/">Open Exchange</a> · <a href="'+import.meta.env.BASE_URL+'NOTICE">Notices</a>';
    document.querySelector('header')!.append(links);
  }
  document.querySelector('.intro')!.textContent='From Pixels to Meaning · local research explorer';
  const learn=document.querySelector('#contextHelp')!;learn.textContent='Choose a structure to reveal its identity, region and presentation controls.';
  const help:Record<string,string>={referenceSelect:'Choose a source-labeled anatomical structure. Selection changes its highlight only.',referenceOpacity:'Reduce the selected structure’s display opacity. Source material transparency is preserved.',referenceClip:'Hide fragments above the chosen model-space height. This is a presentation cut with no anatomical cap.',referenceIsolate:'Show only the selected structure. Restore model returns all reference structures.',referenceSearch:'Filter source structure labels and semantic identities; no anatomy is inferred.'};
  inspector.addEventListener('focusin',event=>{const text=help[(event.target as HTMLElement).id];if(text)learn.textContent=text;});
  // The CT controller still owns pixels/resources; only its pane is docked here.
  let hadCt=false;
  new MutationObserver(()=>{
    const pane=document.querySelector('#ctPane');
    if(pane?.parentElement===workspace)imaging.querySelector('.imaging-body')!.prepend(pane);
    const hasCt=workspace.classList.contains('has-ct');
    if(hasCt!==hadCt){
      if(hasCt)imaging.open=true;
      hadCt=hasCt;
    }
  }).observe(workspace,{childList:true,attributes:true,attributeFilter:['class']});
  const dockCamera=()=>{const camera=document.querySelector('#cameraControls');if(camera&&camera.parentElement!==viewport){viewport.insertBefore(camera,hint);document.querySelector('#cameraMount')!.closest('details')!.hidden=true;}};
  new MutationObserver(dockCamera).observe(inspector,{childList:true,subtree:true});
  dockCamera();
}
