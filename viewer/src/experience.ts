import './experience.css';

// Presentation profiles rearrange existing DOM. They never read/write scene state.
export function prepareExperience() {
  const canvas=document.querySelector<HTMLCanvasElement>('#renderCanvas')!;
  const header=document.querySelector('header')!;
  header.className='app-header';
  const brand=document.createElement('div');brand.className='brand';
  const mark=document.createElement('span');mark.className='brand-mark';mark.setAttribute('aria-hidden','true');
  brand.append(mark,header.querySelector('h1')!.parentElement!);
  const files=header.querySelector('.files');
  const hiddenInputs=[...header.querySelectorAll('input[hidden]')];
  const controls=header.querySelector('.controls')!;
  const links=header.querySelector('nav');
  header.replaceChildren(brand);
  const profile=document.createElement('label');profile.className='profile-control';
  profile.innerHTML=`Presentation <select id="presentationProfile" aria-describedby="profileNote"><option value="basic">Basic</option><option value="dicom">DICOM</option></select>`;
  header.append(profile);
  const skip=document.createElement('a');skip.href='#renderCanvas';skip.className='skip-link';skip.textContent='Skip to 3D canvas';header.before(skip);
  const workspace=document.createElement('div');workspace.className='workspace';
  workspace.innerHTML=`<details id="workspaceControls" class="inspector"><summary>Workspace controls</summary><div class="inspector-body">
    <div id="structureMount"></div><div id="sourceMount"></div><div id="sliceMount"></div><details open><summary>Camera</summary><div id="cameraMount"></div></details>
    <details><summary>Control guide</summary><div class="section-body"><p id="profileNote">Basic keeps the everyday controls close. DICOM exposes model transforms and source metadata. Both use the same viewer; neither adds DICOM ingestion.</p><p id="contextHelp" role="status">Focus a control to see what it changes.</p><p class="help-copy">Drag to orbit · scroll or pinch to zoom. Use the camera buttons to frame the model. Slice selection and transforms are also available by keyboard.</p></div></details>
    <details data-advanced><summary>Source &amp; spatial identity</summary><div class="section-body metadata" id="sourceMetadata">Load a verified manifest and GLB to inspect their declared identity.</div></details>
    <div class="section-body" id="projectLinks"></div>
  </div></details><main class="viewport" aria-label="Model workspace"><div class="viewport-heading"><strong>3D workspace</strong><span>Research presentation · WebGPU</span></div></main>`;
  header.after(workspace);
  workspace.querySelector('#structureMount')!.append(controls);
  workspace.querySelector('#sourceMount')!.append(...hiddenInputs);
  if(files) {const source=document.createElement('details');source.open=true;source.innerHTML='<summary>Local source files</summary><div class="section-body"></div>';source.querySelector('div')!.append(files);workspace.querySelector('#sourceMount')!.append(source);}
  if(links)workspace.querySelector('#projectLinks')!.append(links);
  canvas.tabIndex=0;workspace.querySelector('main')!.append(canvas);
  let footer=document.querySelector<HTMLElement>('footer');
  if(!footer){footer=document.createElement('footer');footer.append(document.querySelector('#status')!);document.body.append(footer);}
  footer.className='app-footer';
  const inspector=workspace.querySelector<HTMLDetailsElement>('#workspaceControls')!;
  inspector.open=!matchMedia('(max-width:760px)').matches;
  const select=profile.querySelector<HTMLSelectElement>('select')!;
  document.documentElement.dataset.profile='basic';
  select.onchange=()=>{document.documentElement.dataset.profile=select.value;};
  const explanations:Record<string,string>={
    presentationProfile:'Presentation profile changes which controls are shown. Selection, transforms, camera and permissions stay the same.',
    manifestFile:'Choose a local semantic manifest. Files remain in this browser; their declared SHA-256 is checked before rendering.',
    glbFile:'Choose the matching GLB. Canonical positions, indices and spatial transforms remain unchanged.',
    sliceMode:'Create reversible display bands from the authorized synthetic fixture only. These are open surfaces, not acquired CT slices.',
    sliceSelect:'Select one derived band by its stable presentation identity. Hidden bands cannot be picked on the canvas.',
    sliceAction:'Orbit moves the camera. Mouse drag moves the selected band in the screen plane through its existing presentation offsets; touch retains model X/Y dragging. Source transforms stay unchanged.',
    sliceGap:'Separate the five synthetic bands along model Y. Individual offsets remain separate; camera refits the assembly.',
    sliceRotation:'Rotate the selected display band around its model origin. This does not register or alter source anatomy.',
    sliceOpacity:'Adjust display opacity only. Transparency is not tissue density or calibrated HU.',
    sliceIsolate:'Temporarily show only the selected band. Other bands remain in shared state and cannot be picked while hidden.',
    sliceVisibility:'Toggle the selected display band. Canonical source geometry is retained.',
    sliceReset:'Restore only the selected band’s offsets, rotation, opacity and visibility.',
    sliceResetAll:'Restore all bands and zero expansion, then restore original camera framing.',
    cameraFit:'Fit bounds of the complete assembly, including hidden bands. The camera target is a presentation choice, not the source origin.',
    cameraFocus:'Frame the visible selected band. Source coordinates and transforms stay unchanged.',
    cameraRestore:'Restore the original camera angles and fit the original assembly for the current canvas size.',
    visibilityButton:'Show or hide the original structure. Slice mode has its own visibility controls.',
    clearButton:'Clear selection and isolation without changing geometry or individual transforms.',
  };
  for(let i=0;i<3;i++)explanations[`sliceOffset${i}`]=`Move the selected display band along model ${'XYZ'[i]} in millimetres. This is derived presentation state, not a source spatial transform.`;
  document.addEventListener('focusin',event=>{
    const target=event.target as HTMLElement;
    const text=explanations[target.id];if(text)workspace.querySelector('#contextHelp')!.textContent=text;
  });
  // These attributes are UI metadata only; handlers remain in their owning modules.
  return { connectControls() {
    for(const [id,text] of Object.entries(explanations)) {
      const control=document.getElementById(id);if(!control)continue;
      const description=document.createElement('span');description.id=`help-${id}`;description.hidden=true;description.textContent=text;
      workspace.append(description);control.setAttribute('aria-describedby',description.id);
    }
  }, describeSource(manifest:any) {
    const metadata=workspace.querySelector('#sourceMetadata')!;
    metadata.textContent=`Semantic ID: ${manifest.structure.semantic_id}\nGLB SHA-256: ${manifest.asset.sha256}\nDeclared space: ${manifest.asset.model_space}\nDeclared units: ${manifest.asset.units}\nSource origin ≠ bounds center ≠ camera target. No clinical or calibrated HU claim.`;
    (metadata as HTMLElement).style.whiteSpace='pre-wrap';
  }};
}
