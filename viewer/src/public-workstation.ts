import './public-workstation.css';
import './reference-theme.css';
import {imagingMarkup,labMarkup,learningMarkup} from './public-workstation-markup';
import {bindWorkspaceDivider} from './workspace-layout.mjs';
import {verifiedFrameRgba} from './verified-volume.mjs';
import {digest,frameRgba} from './ct-frame.mjs';
import {maskSegments,meshPlaneSegments,contourStats,svgSegments} from './source-overlay.mjs';
import {imageLesson,segmentationLesson} from './evidence-learning.mjs';
import {evidenceLearning} from './evidence-learning-ui';
import {accumulation} from './ct-accumulation.mjs';
import {PUBLIC_STUDY_ENABLED, PUBLIC_RELEASE} from './public-release.mjs';

const $=(id:string)=>document.getElementById(id) as any;
const icons:Record<string,string>={Viewer:'◇',Imaging:'▥',Anatomy:'▱',Lab:'✧',Learn:'▤'};
const DURATION=8000;

/** Reparents existing controls. Source selection, rendering and transforms retain their owners. */
export function preparePublicWorkstation(){
  document.body.classList.add('public-workstation');
  document.title=PUBLIC_RELEASE.title;
  const base=import.meta.env.BASE_URL;
  const favicon=document.createElement('link');favicon.rel='icon';favicon.href=base+'brand/favicon.svg';document.head.append(favicon);
  const brand=document.querySelector('.brand-mark')!;brand.replaceWith(Object.assign(document.createElement('img'),{src:base+'brand/semantic-cube.svg',alt:'DICOM3D semantic cube',width:44,height:44}));
  document.querySelector('h1')!.innerHTML='DICOM<span>3D</span>';
  document.querySelector('.intro')!.textContent='Visual Research Workstation';
  document.querySelector('.profile-control')!.setAttribute('hidden','');
  const header=document.querySelector('.app-header')!,projectLinks=header.querySelector('nav');
  if(projectLinks){projectLinks.innerHTML=`<a href="https://github.com/KennethJSmithDev/DICOM3D">GitHub</a><a href="https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.0">Published v0.6.0</a><a href="${base}NOTICE">Notices</a>`;}
  const identity=document.createElement('span');identity.className='release-identity';identity.textContent=`VISUAL RESEARCH WORKSTATION · v${PUBLIC_RELEASE.release} RC`;header.append(identity);
  const evidenceButton=document.createElement('button');evidenceButton.id='evidenceToggle';evidenceButton.textContent='Source & evidence';header.append(evidenceButton);
  const workspace=document.querySelector<HTMLElement>('.workspace')!,view=document.querySelector<HTMLElement>('main.viewport')!,inspector=$('workspaceControls');
  const stage=document.createElement('section');stage.id='publicStage';stage.setAttribute('aria-label','Research workspace');
  const toolbar=document.createElement('div');toolbar.className='public-toolbar';toolbar.append(view.querySelector('.viewport-heading')!);
  const modes=document.createElement('div');modes.className='mode-switch';modes.setAttribute('role','group');modes.setAttribute('aria-label','Presentation mode');
  modes.innerHTML='<button data-mode="scientific" aria-pressed="true">Scientific</button><button data-mode="holographic">Holographic</button><button data-mode="materialization">Materialization</button>';header.insertBefore(modes,projectLinks);stage.append(toolbar);
  const library=document.querySelector('.reference-library')!;stage.append(library,$('workspaceMode'));
  const studyButton=document.createElement('button');studyButton.id='exploreStudy';studyButton.textContent='Explore Real CT Study';studyButton.title='Optional attributed H000 research example · approximately 33.3 MB';library.append(studyButton);
  studyButton.hidden=!PUBLIC_STUDY_ENABLED;
  if(PUBLIC_STUDY_ENABLED){
    const studyNotice=document.createElement('p');studyNotice.className='reference-scope-note';studyNotice.id='studyAdmissionNotice';
    studyNotice.innerHTML=`Acquired research CT + one source segmentation · optional download approximately 33.3 MB. Research presentation only. <a href="${base}demo/h000/NOTICE.md">Source credits & transformation notes</a> · <a href="https://www.cancerimagingarchive.net/data-usage-policies-and-restrictions/">TCIA use policy</a>. Do not identify or contact participants.`;
    library.append(studyNotice);
  }
  const area=document.createElement('div');area.id='publicWorkArea';area.innerHTML=`<div id="viewingArea">${imagingMarkup}<div id="divider" hidden role="separator" tabindex="0" aria-label="Resize imaging dock" aria-orientation="vertical" title="Drag or use arrow keys. Home restores 40% imaging."></div><div class="viewport-slot"></div></div>`;
  area.querySelector('.viewport-slot')!.append(view);stage.append(area);
  workspace.prepend(stage);
  const rail=document.createElement('nav');rail.className='public-rail';rail.setAttribute('aria-label','Workspace panels');
  for(const [label,id] of Object.entries({Viewer:'workspaceButton',Imaging:'imagingToggle',Anatomy:'inspectorToggle',Lab:'labToggle',Learn:'learningToggle'})){
    const button=document.createElement('button');button.id=id;button.innerHTML=`<b aria-hidden="true">${icons[label]}</b><span>${label}</span>`;button.setAttribute('aria-expanded','false');rail.append(button);
  }
  workspace.prepend(rail);
  // WHY: utility controls must not consume render height. Reparent existing owners only.
  const viewerDrawer=document.createElement('aside');viewerDrawer.id='viewerDrawer';viewerDrawer.hidden=false;viewerDrawer.setAttribute('aria-label','Viewer controls');
  viewerDrawer.innerHTML='<header><h2>Viewer</h2><button id="closeViewer">Close viewer controls</button></header>';
  viewerDrawer.append(toolbar,library);workspace.append(viewerDrawer);
  const shellStatus=document.createElement('div');shellStatus.className='shell-status';shellStatus.append($('workspaceMode'));stage.append(shellStatus);

  $('imagingToggle').hidden=!PUBLIC_STUDY_ENABLED;
  const extra=document.createElement('div');extra.innerHTML=labMarkup+learningMarkup;workspace.append(...extra.children);
  inspector.open=true;inspector.hidden=!matchMedia('(min-width:1400px)').matches;
  const closeInspector=document.createElement('button');closeInspector.id='closeInspector';closeInspector.textContent='Close anatomy';inspector.querySelector('summary')!.append(closeInspector);
  const studyCard=document.createElement('div');studyCard.id='publicStudyCard';studyCard.hidden=true;studyCard.innerHTML='<button id="selectStructure" aria-pressed="false">Select lung mass</button><p>lesion.lung.mass.001</p><p>One acquired source segmentation · source geometry retained.</p><button id="studyContext">Acquired chest context</button><button id="studyLesion">Inspect lesion</button>';inspector.querySelector('.inspector-body')!.prepend(studyCard);
  const contextHelp=$('contextHelp');contextHelp.hidden=true;$('learningPanel').querySelector('.learning-panel-copy').prepend(contextHelp);
  const imageLearning=evidenceLearning('imageLearning',$('learningBody')),segLearning=evidenceLearning('segLearning',$('learningBody'));imageLearning.clear();segLearning.clear();
  const evidence=$('evidencePanel');evidence.hidden=true;evidence.open=true;
  const evidenceClose=document.createElement('button');evidenceClose.textContent='Close evidence';evidence.querySelector('summary')!.append(evidenceClose);
  evidence.querySelector('.evidence-grid > div:nth-child(2)').innerHTML=PUBLIC_STUDY_ENABLED?`<h2>Curated public research study</h2><p>The owner admitted exactly five unchanged H000 files for this Safe Demo. Historical candidate flags in their source metadata are preserved; they describe the earlier assessment, not the current admission.</p><p><a href="https://doi.org/10.7937/K9/TCIA.2015.NPGZYZBZ">QIN LUNG CT</a> · <a href="https://doi.org/10.7937/K9/TCIA.2015.1BUVFJR7">QIN-LungCT-Seg</a> · <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a></p><p>Generalized reference anatomy is not registered to acquired imaging. No clinical or privacy-certification claim.</p><a href="${base}demo/h000/NOTICE.md" id="studyNotice">Full source credits and transformation notes</a> · <a href="https://www.cancerimagingarchive.net/data-usage-policies-and-restrictions/">TCIA use policy: no participant identification/contact; retain source credit and policy downstream</a>`:`<h2>Reference anatomy release</h2><p>BodyParts3D male and HRA female are independent generalized sources with partial coverage. They are not patient anatomy. This reference-only build excludes acquired CT/SEG; the optional curated study belongs to the separately admitted Safe Demo profile.</p><a href="${base}reference/BODYParts3D-NOTICE.txt">BodyParts3D attribution</a> · <a href="${base}reference/HRA-FEMALE-NOTICE.txt">HRA attribution</a>`;
  const metrics=document.createElement('output');metrics.id='publicRuntimeState';metrics.hidden=true;evidence.append(metrics);
  const overlayData=document.createElement('output');overlayData.id='overlayGeometry';overlayData.hidden=true;evidence.append(overlayData);
  const observe=document.createElement('button');observe.id='observeRuntime';observe.textContent='Capture runtime observations';evidence.querySelector('.evidence-grid')!.append(observe);
  const verify=document.createElement('button');verify.id='verifyMapping';verify.textContent='Verify study mapping';verify.disabled=true;evidence.querySelector('.evidence-grid')!.append(verify);
  verify.hidden=!PUBLIC_STUDY_ENABLED;
  const mapping=document.createElement('output');mapping.id='mappingResults';mapping.hidden=true;evidence.append(mapping);
  const top=document.createElement('div');top.className='public-viewport-top';top.innerHTML='<span id="viewLabel">HOLOGRAPHIC</span><span>LEFT ORBIT · RIGHT PAN · WHEEL ZOOM</span><button id="maximize" aria-label="Maximize 3D viewport">⛶</button>';view.prepend(top);
  const annotations=document.createElement('div');annotations.id='publicAnnotation';view.append(annotations);
  const caption=document.createElement('span');caption.className='reference-scope-note';caption.textContent='Generalized anatomy · source coverage varies · no patient registration';library.append(caption);
  const startupControls=document.createElement('div');startupControls.className='startup-controls';startupControls.innerHTML='<span id="startupStatus" role="status"></span><button id="startupSkip" hidden>Skip introduction</button><button id="startupReplay" hidden>Replay introduction</button>';header.append(startupControls);
  let startupUsed=false,startupRunning=false,startupTarget='scientific',startupOwner=0;
  const layout=bindWorkspaceDivider({divider:$('divider'),imaging:$('imagingDock'),viewing:$('viewingArea')});
  let context:any=null,study:any=null,revision=0,mode='scientific',progress=1,playing=false,last=0,selected=false,sourceK=71,image:ImageData|null=null;
  let zoom=1,pan=[0,0],drag:any=null,ctRevision=0,volumePromise:Promise<any>|null=null;
  let studyUi:any={},referenceObserver:MutationObserver|null=null,mappingFlight:Promise<any>|null=null;const observations:any={startedAt:new Date().toISOString(),userAgent:navigator.userAgent,errors:[],lastPlay:null,benchmark:null};
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  $('reduced').checked=motion.matches;
  const saved=(()=>{try{return JSON.parse(localStorage.getItem('dicom3d.public-visual.preferences')||'{}');}catch{return {};}})();
  for(const [id,values,fallback] of [['effect',['layers','assembly'],'layers'],['density',['512','2048','8192'],'512'],['preset',['cyan','ice','amber'],'cyan']] as any[]){
    // Color preset remains in the existing source inspector's presentation controls.
    if(id==='preset'&&!$(id)){const label=document.createElement('label');label.textContent='Material preset';label.innerHTML+='<select id="preset"><option value="cyan">Ion cyan</option><option value="ice">Arctic white</option><option value="amber">Warm amber</option></select>'; $('labPanel').querySelector('.lab-controls').append(label);}
    $(id).value=values.includes(String(saved[id]))?String(saved[id]):fallback;
  }
  const fail=(error:any)=>{observations.errors.push(String(error));$('status').textContent=String(error);capture();};
  function capture(){metrics.textContent=JSON.stringify({...observations,context:context?.snapshot(),owner:study?'study':context?'reference':'empty',mode,progress,playing,sourceK:study?sourceK:null,ct:studyUi,layout:layout.snapshot(),learning:{visible:!$('learningPanel').hidden,text:$('learningBody').textContent},heapUsedBytes:(performance as any).memory?.usedJSHeapSize??null},null,2);}
  const drawers:Record<string,string>={viewerDrawer:'workspaceButton',workspaceControls:'inspectorToggle',labPanel:'labToggle',learningPanel:'learningToggle',evidencePanel:'evidenceToggle'};
  function panel(id:string,button:string,value?:boolean){
    const open=value===undefined?$(id).hidden:value;
    if(open)for(const [other,toggle] of Object.entries(drawers)){if(other!==id&&!(other==='workspaceControls'||id==='workspaceControls')){$(other).hidden=true;$(toggle).setAttribute('aria-expanded','false');}}
    $(id).hidden=!open;$(button).setAttribute('aria-expanded',String(open));
  }
  for(const [id,button] of Object.entries(drawers)){$(button).setAttribute('aria-controls',id);$(button).setAttribute('aria-expanded',String(!$(id).hidden));$(id).addEventListener('keydown',(e:KeyboardEvent)=>{if(e.key==='Escape'){panel(id,button,false);$(button).focus();}});}
  $('closeViewer').onclick=()=>{panel('viewerDrawer','workspaceButton',false);$('workspaceButton').focus();};
  $('inspectorToggle').onclick=()=>panel('workspaceControls','inspectorToggle');
  closeInspector.onclick=(e:Event)=>{e.preventDefault();panel('workspaceControls','inspectorToggle',false);$('inspectorToggle').focus();};
  $('labToggle').onclick=()=>panel('labPanel','labToggle');
  $('learningToggle').setAttribute('aria-controls','learningPanel');
  $('learningToggle').onclick=()=>panel('learningPanel','learningToggle');
  $('closeLearning').onclick=()=>{panel('learningPanel','learningToggle',false);$('learningToggle').focus();};
  $('learningPanel').onkeydown=(e:KeyboardEvent)=>{if(e.key==='Escape')$('closeLearning').click();};
  evidenceButton.onclick=()=>panel('evidencePanel','evidenceToggle');
  evidenceClose.onclick=(e:Event)=>{e.preventDefault();panel('evidencePanel','evidenceToggle',false);evidenceButton.focus();};
  function imaging(value:boolean){if(value)panel('viewerDrawer','workspaceButton',false);$('imagingDock').hidden=$('divider').hidden=!value; $('imagingToggle').setAttribute('aria-expanded',String(value));}
  $('imagingToggle').onclick=()=>{if(!PUBLIC_STUDY_ENABLED)return;if(!study){studyButton.click();return;}imaging($('imagingDock').hidden);};
  $('closeImaging').onclick=()=>imaging(false);
  $('maximize').onclick=()=>area.classList.toggle('maximized');
  $('workspaceButton').onclick=()=>panel('viewerDrawer','workspaceButton');
  function finishStartup(reason='completed'){
    if(!startupRunning)return;startupRunning=false;context?.visual.silhouette?.(false);playing=false;
    setProgress(1);setMode(startupTarget);$('startupSkip').hidden=true;$('startupReplay').hidden=Boolean(study)||!context;
    $('startupStatus').textContent='';observations.startup={...observations.startup,status:reason,completedAtMs:performance.now()};
  }
  function startIntroduction(){
    if(!context||study||!context.visual.silhouette)return;
    startupUsed=true;startupTarget=mode==='scientific'?'scientific':'holographic';
    if($('reduced').checked){setProgress(1);$('startupReplay').hidden=false;observations.startup={status:'reduced-motion'};return;}
    startupRunning=true;startupOwner=revision;context.visual.effect('layers');context.visual.density(2048);$('effect').value='layers';$('density').value='2048';
    context.visual.silhouette(true);setMode('materialization');setProgress(0);playing=true;last=performance.now();
    observations.lastPlay={requestedAtMs:last,durationMs:DURATION};observations.startup={status:'running',owner:revision,target:startupTarget};
    $('startupStatus').textContent='Presentation-only anatomical assembly';$('startupSkip').hidden=false;$('startupReplay').hidden=true;
  }
  $('startupSkip').onclick=()=>finishStartup('skipped');$('startupReplay').onclick=startIntroduction;
  function pause(){if(startupRunning)finishStartup('interrupted');playing=false;$('play').textContent='▶ Play';$('play').setAttribute('aria-label','Play materialization');}
  function setMode(next:string){if(context?.visual.supportedModes&&!context.visual.supportedModes.includes(next)){fail(Error('Scientific CT presentation capability unavailable: '+next));return;}context?.invalidatePick();mode=next;context?.visual.mode(next);if(study)applyAccumulation();modes.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));$('viewLabel').textContent=mode.toUpperCase();if(mode!=='materialization')pause();learn(next);}
  const sourceShape=()=>study?.verifiedVolume?.descriptor.shape??[103,512,512];
  const selectedRange=()=>($('sourceRange').value==='lesion'&&study?.mask?[64,78]:[0,sourceShape()[0]-1]);
  function applyAccumulation(){if(!study||!context)return;if(context.visual.supportsPresentationFX===false){if(mode!=='scientific'||progress!==1)throw Error('CT-only materialization unavailable');settings();$('phase').textContent='Scientific source complete; CT-only FX unavailable';return;}const range=selectedRange(),a=accumulation(progress,range,mode==='materialization');context.visual.accumulationRange(range);context.visual.progress(progress);if(a.enabled&&$('sourceLink').checked&&sourceK!==a.planeK){sourceK=a.planeK;renderCt();}else settings();$('phase').textContent=a.enabled?`${Math.round(progress*100)}% · ${a.count}/${a.total} selected slices · k ${range[0]}–${range[1]}`:'Authoritative surface · stable';}
  function setProgress(value:number){progress=$('reduced').checked?1:Math.max(0,Math.min(1,value));context?.visual.progress(progress);$('progress').value=String(progress*100);$('progressLabel').textContent=Math.round(progress*100)+'%';$('phase').textContent=progress===1?'Source surface · stable':progress<.06?'Data emergence':'Source layers forming';if(study)applyAccumulation();}
  modes.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.onclick=()=>{if(startupRunning){startupTarget=b.dataset.mode==='scientific'?'scientific':'holographic';finishStartup('mode-selected');}setMode(b.dataset.mode!);capture();});
  $('play').onclick=()=>{if(!context)return;if(playing){pause();return;}setMode('materialization');if($('reduced').checked){setProgress(1);return;}if(progress>=1)setProgress(0);playing=true;last=performance.now();observations.lastPlay={requestedAtMs:last,requiredDataReadyAtMs:observations.readyAtMs,sourceOrder:study?'acquired source k':'reference model Y',durationMs:DURATION};$('play').textContent='Ⅱ Pause';$('play').setAttribute('aria-label','Pause materialization');};
  $('sourceRange').onchange=()=>{if(study){applyAccumulation();capture();}};
  $('restart').onclick=()=>{pause();setMode('materialization');setProgress(0);capture();};
  $('progress').oninput=()=>{pause();setMode('materialization');setProgress(Number($('progress').value)/100);capture();};
  let raf=0;function tick(t:number){if(playing){setProgress(progress+Math.max(0,t-last)/DURATION);if(progress===1){if(startupRunning&&startupOwner===revision)finishStartup();else pause();observations.lastPlay.completedAtMs=t;capture();}}last=t;raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  for(const id of ['effect','density','preset'])$(id).onchange=()=>{context?.invalidatePick();context?.visual[id](id==='density'?Number($(id).value):$(id).value);try{localStorage.setItem('dicom3d.public-visual.preferences',JSON.stringify(Object.fromEntries(['effect','density','preset'].map(key=>[key,$(key).value]))));}catch{}learn(id);capture();};
  function reduced(){if(context?.visual.supportsPresentationFX===false)return;context?.invalidatePick();context?.visual.reducedMotion($('reduced').checked);if($('reduced').checked){pause();setProgress(1);}capture();}
  $('reduced').onchange=reduced;motion.addEventListener('change',e=>{$('reduced').checked=e.matches;reduced();});
  const explanations:Record<string,string>={
    scientific:'Scientific uses source surfaces and their original reference materials. Selection is a presentation choice, not a finding.',
    holographic:'Cyan light and transparency emphasize source boundaries. Transparent shells do not reveal internal tissue.',
    materialization:'Bounded decorative samples converge to the unchanged source surface. Particles are not cells, acquired voxels or inferred anatomy.',
    effect:'Layer Sweep follows reference model Y, or acquired source k within the separate study. Source pixels and complete SEG contours remain independent of reveal progress.',
    density:'512, 2,048 and 8,192 are total presentation sample budgets. Source anatomical detail is unchanged.',
    frame:'Acquired k owns the source image and the aligned SEG boundary. Linked inspection ties that same physical plane to 3D.',
    overlayToggle:'Cyan outlines the complete source segmentation on this acquired frame, independent of camera angle and animation.',
    meshOverlay:'Amber dashed lines intersect the unchanged derived surface with the same source plane. Differences from SEG remain visible.',
    sourceLink:'The accepted source index, patient and model transforms link the acquired plane. Reference anatomy has no study registration.',
    cutaway:'Cutaway keeps the holographic surface at or below the selected source k. It does not reveal tissue unless acquired CT is displayed.',
    maskVolume:'Lesion interior displays acquired CT values restricted by source SEG membership. It is a research transfer-function presentation.',
    ctVolume:'Acquired chest context displays the CT volume. It is not a separate patient lung segmentation.',
    level:'Window level changes displayed gray values; stored source pixels remain intact.',
    width:'Window width changes contrast; stored values are preserved. No calibrated HU claim is added.',
    reduced:'Reduced motion resolves immediately to the unchanged final mesh. Explicit clipping and visibility remain in effect.'
    ,cameraFocus:'Frame the selected source structure. Camera target and distance change; source geometry and transforms remain unchanged.'
    ,cameraFit:'Frame the visible source assembly. The camera center is a presentation choice, not a source origin or anatomical landmark.'
  };
  function learn(action=''){
    $('contextHint').textContent=explanations[action]||'Source identity, presentation choices, limitations and attribution follow the current selection.';
    if(!study){imageLearning.clear();segLearning.clear();return;}
    if(study.verifiedVolume){const d=study.verifiedVolume.descriptor;imageLearning.show(imageLesson({source:{format:'Verified multi-SOP',sha256:d.payload.sha256,sopName:'Verified acquired CT; original source identity retained',identity:{Modality:'CT',SOPInstanceUID:d.frames[sourceK].sopIdentity},provenance:{collection:'Verified source provenance retained; local admission'}},pixels:true,display:{slope:d.calibration.slope,intercept:d.calibration.intercept,function:d.calibration.voiFunction,invert:false}},sourceK));segLearning.clear();return;}imageLearning.show(imageLesson({source:{format:'NPY',sha256:study.ctReceipt.volume.npy_sha256,sopName:'Admitted H000 CT stack; lossless public derivative',identity:{Modality:'CT',SOPInstanceUID:study.ctReceipt.slice_mapping[sourceK].sop_uid},provenance:{collection:'QIN LUNG CT / TCIA',license:'CC BY 3.0 · collection DOI 10.7937/K9/TCIA.2015.NPGZYZBZ'}},pixels:true,display:{slope:1,intercept:-1024,function:'linear research',invert:false}},sourceK));
    if(study.mask)segLearning.show(segmentationLesson(study.binding,sourceK));else segLearning.clear();
  }
  document.addEventListener('focusin',e=>{const el=e.target as HTMLElement;if(!el.closest('#learningPanel'))learn(el.dataset.mode||el.id);});
  function overlay(){
    if(!study||!context)return;
    if(!study.mask){$('segPath').setAttribute('d','');$('meshPath').setAttribute('d','');$('segFill').getContext('2d').clearRect(0,0,sourceShape()[2],sourceShape()[1]);$('intersectionState').textContent='Verified acquired CT; no segmentation admitted';overlayData.textContent='';return;}
    const seg=maskSegments(study.mask,sourceK),mesh=meshPlaneSegments(context.visual.sourceIndexGeometry(),sourceK),count=study.binding.frames.find((f:any)=>f.ct_k===sourceK).nonzero_voxels,show=selected&&$('overlayToggle').checked;
    $('segPath').setAttribute('d',show?svgSegments(seg):'');$('meshPath').setAttribute('d',selected&&$('meshOverlay').checked?svgSegments(mesh):'');
    const fill=$('segFill').getContext('2d');fill.clearRect(0,0,512,512);if(show&&$('overlayFill').checked){const rgba=fill.createImageData(512,512);for(let i=0;i<262144;i++)if(study.mask[sourceK*262144+i])rgba.data.set([0,210,255,48],i*4);fill.putImageData(rgba,0,0);}
    $('intersectionState').textContent=!selected?'Select the lesion to inspect its source relationship':count?`${count.toLocaleString()} source segmentation voxels · ${contourStats(seg).components} contour component(s)`:'Selected structure does not intersect this frame';
    overlayData.textContent=JSON.stringify({k:sourceK,seg,mesh});studyUi.overlay={k:sourceK,selected,count,seg:contourStats(seg),mesh:contourStats(mesh)};
  }
  function settings(){if(!study||!context)return;context.invalidatePick();context.visual.ctSettings({plane:$('ctPlane').checked,volume:$('ctVolume').checked||$('maskVolume').checked,masked:$('maskVolume').checked,gain:Number($('ctOpacity').value),clip:mode==='materialization'?Number($('ctClip').value):$('sourceLink').checked?sourceK:Number($('ctClip').value),level:Number($('level').value),width:Number($('width').value)});context.visual.linkSource(sourceK,$('sourceLink').checked,$('cutaway').checked);$('clipOutput').textContent=String(mode!=='materialization'&&$('sourceLink').checked?sourceK:$('ctClip').value);$('sourceMode').textContent=$('sourceLink').checked?'Linked inspection · same source plane':'Independent cinematic · source coordinates retained';}
  function renderCt(){if(!study||!context||!image)return;const token=++ctRevision,k=sourceK,level=Number($('level').value),width=Number($('width').value);if(study.verifiedVolume)verifiedFrameRgba(study.verifiedVolume,k,level,width,image.data);else frameRgba(study.pixels,k,level,width,image.data);$('ctCanvas').getContext('2d').putImageData(image,0,0);context.visual.sourceFrame(study.ctReceipt,image,k);$('ctCanvas').setAttribute('aria-label',`Acquired CT frame ${k}`);
    $('frame').value=String(k);$('frameLabel').textContent=`k = ${k} / ${sourceShape()[0]-1}`;$('frameOutput').textContent=`${k+1} of ${sourceShape()[0]}`;$('levelOutput').textContent=String(level);$('widthOutput').textContent=String(width);$('ctLoading').hidden=true;
    studyUi={...studyUi,k,level,width,sourceSop:study.ctReceipt.slice_mapping[k].sop_uid,load:study.metrics};overlay();settings();learn('frame');
    const displayed=$('ctCanvas').getContext('2d').getImageData(0,0,sourceShape()[2],sourceShape()[1]).data;Promise.all([digest(image.data),digest(displayed)]).then(([rgbaSha256,canvasSha256])=>{if(token===ctRevision){Object.assign(studyUi,{rgbaSha256,canvasSha256,canvasPixelMatch:rgbaSha256===canvasSha256});capture();}}).catch(fail);
  }
  function setSourceK(k:number,manual=true){if(manual&&study&&mode==='materialization'&&$('sourceLink').checked){pause();const [lo,hi]=selectedRange();setProgress(Math.max(0,Math.min(hi-lo+1,Math.round(k)-lo+1))/(hi-lo+1));return;}if(manual){pause();setProgress(1);}sourceK=Math.max(0,Math.min(sourceShape()[0]-1,Math.round(k)));renderCt();}
  $('frame').oninput=()=>setSourceK(Number($('frame').value));
  for(const id of ['level','width'])$(id).oninput=()=>renderCt();
  for(const id of ['overlayToggle','meshOverlay','overlayFill'])$(id).onchange=()=>{overlay();capture();};
  async function ensureVolume(){if(!study||!context)return;const owner=revision,ctx=context;if(!volumePromise)volumePromise=ctx.visual.loadVolume(study.pixels,study.mask);await volumePromise;if(owner!==revision||ctx!==context)throw Error('Study owner changed while loading volume');settings();}
  for(const id of ['sourceLink','cutaway','ctPlane','ctVolume','maskVolume'])$(id).onchange=async()=>{pause();try{if(id==='sourceLink'&&$('sourceLink').checked){$('ctPlane').checked=true;if(mode!=='materialization'&&context?.visual.supportsPresentationFX!==false)$('cutaway').checked=true;}if($('ctVolume').checked||$('maskVolume').checked)await ensureVolume();settings();if(study)applyAccumulation();learn(id);capture();}catch(e){fail(e);}};
  for(const id of ['ctOpacity','ctClip'])$(id).oninput=()=>{pause();settings();capture();};
  $('fitContext').onclick=()=>context?.visual.fitContext();
  $('selectStructure').onclick=()=>context?.selectStudy(!selected);
  async function contextView(){const owner=revision;await ensureVolume();if(owner!==revision)return;$('ctVolume').checked=$('ctPlane').checked=true;$('maskVolume').checked=$('sourceLink').checked=$('cutaway').checked=false;$('ctClip').value='-.5';$('ctOpacity').value='.25';settings();context.visual.fitContext();capture();}
  $('studyContext').onclick=()=>contextView().catch(fail);
  $('studyLesion').onclick=()=>{$('ctVolume').checked=$('maskVolume').checked=false;$('ctPlane').checked=$('sourceLink').checked=true;$('cutaway').checked=false;setSourceK(71);context?.framing.restore();context?.selectStudy(true);};
  const transform=()=>$('ctTransform').style.transform=`translate(${pan[0]}px,${pan[1]}px) scale(${zoom})`;
  $('imageZoom').oninput=()=>{zoom=Number($('imageZoom').value);transform();};
  $('imageReset').onclick=()=>{zoom=1;pan=[0,0];$('imageZoom').value='1';transform();};
  $('ctTransform').onpointerdown=(e:PointerEvent)=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:[...pan],distance:0};$('ctTransform').setPointerCapture(e.pointerId);};
  $('ctTransform').onpointermove=(e:PointerEvent)=>{if(!drag||drag.id!==e.pointerId)return;drag.distance=Math.max(drag.distance,Math.hypot(e.clientX-drag.x,e.clientY-drag.y));if(zoom>1){pan=[drag.pan[0]+e.clientX-drag.x,drag.pan[1]+e.clientY-drag.y];transform();}};
  $('ctTransform').onpointerup=(e:PointerEvent)=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.distance>4;drag=null;if(moved||!study)return;const r=$('ctCanvas').getBoundingClientRect(),col=Math.floor((e.clientX-r.left)/r.width*512),row=Math.floor((e.clientY-r.top)/r.height*512);if(study.mask&&col>=0&&row>=0&&col<512&&row<512&&study.mask[sourceK*262144+row*512+col])context?.selectStudy(true);};
  $('ctTransform').onpointercancel=$('ctTransform').onlostpointercapture=()=>drag=null;
  $('ctTransform').parentElement.addEventListener('wheel',(e:WheelEvent)=>{if(!study)return;e.preventDefault();setSourceK(sourceK+Math.sign(e.deltaY));},{passive:false});
  new ResizeObserver(()=>{const r=$('ctTransform').parentElement.getBoundingClientRect(),size=Math.max(1,Math.min(r.width,r.height));$('ctTransform').style.width=$('ctTransform').style.height=`${size}px`;}).observe($('ctTransform').parentElement);
  function bounded<T>(promise:Promise<T>,ms:number){return new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Observation deadline exceeded')),ms);promise.then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});}
  $('benchmark').onclick=async()=>{if(!context||$('reduced').checked)return;const owner=revision,ctx=context,visual=ctx.visual,original={mode,progress,count:Number($('density').value)},results:any[]=[];pause();$('benchmark').disabled=true;let measuring=true,frame=0;
    const check=()=>{if(owner!==revision||ctx!==context||document.hidden||!measuring)throw Error('Benchmark cancelled: source or foreground changed');};
    try{setMode('materialization');for(const count of [512,2048,8192]){check();visual.density(count);setProgress(.45);await new Promise(r=>setTimeout(r,400));check();visual.resetMetrics();const start=performance.now();await bounded(new Promise<void>((resolve,reject)=>{const sample=(t:number)=>{try{check();setProgress(.2+.5*Math.min(1,(t-start)/3000));if(t-start<3000)frame=requestAnimationFrame(sample);else resolve();}catch(e){reject(e);}};frame=requestAnimationFrame(sample);}),5000);check();results.push({count,elapsedMs:performance.now()-start,foreground:true,renderer:visual.snapshot()});}observations.benchmark={results};}
    catch(e){observations.benchmark={results,error:String(e)};fail(e);}finally{measuring=false;cancelAnimationFrame(frame);if(owner===revision&&ctx===context){visual.density(original.count);setMode(original.mode);setProgress(original.progress);}$('benchmark').disabled=false;capture();}};
  observe.onclick=()=>{pause();context?.visual.auditGeometry?.();capture();};
  // A UI deadline cannot cancel GPU readback. Keep one flight until the underlying
  // operation settles, so repeated clicks cannot accumulate diagnostic buffers.
  verify.onclick=async()=>{if(!study||!context||mappingFlight)return;const owner=revision,ctx=context;verify.disabled=true;
    const flight=(async()=>{await ensureVolume();if(owner!==revision||ctx!==context)throw Error('Study changed before mapping probe');return ctx.visual.verifySource(study.verifiedVolume?Array.from({length:24},(_,i)=>[i%sourceShape()[0],i*79%sourceShape()[1],i*137%sourceShape()[2]]):[[63,0,0],[63,314,308],[63,345,350],[63,511,511],[64,338,353],[64,346,362],[64,352,364],[64,0,0],[71,316,333],[71,344,375],[71,373,342],[71,0,0],[78,350,345],[78,356,341],[78,362,346],[78,0,0],[79,0,0],[79,314,308],[79,345,350],[79,511,511],[0,0,0],[0,511,511],[102,0,0],[102,511,511]]);})();
    mappingFlight=flight;const settled=()=>{if(mappingFlight===flight){mappingFlight=null;verify.disabled=!study;}};
    flight.then(settled,settled);
    try{const result=await bounded(flight,10000);if(owner===revision&&ctx===context)mapping.textContent=JSON.stringify(result);}catch(e){if(owner===revision&&ctx===context)fail(e);}finally{capture();}};
  if(import.meta.env.DICOM3D_PRIVATE_RENDERER_DEV)(window as any).__dicom3dMaterializationProbe={verify:()=>context.visual.verifySource(Array.from({length:103},(_,k)=>[k,0,0])),capture:()=>context.visual.capture()};
  function selection(value:boolean){selected=value;if(study){$('selectStructure').setAttribute('aria-pressed',String(value));$('selectStructure').textContent=value?'Selected · Lung mass':'Select lung mass';overlay();learn();}}
  function detached(){pause();$('startupSkip').hidden=$('startupReplay').hidden=true;$('startupStatus').textContent='';revision++;ctRevision++;pause();referenceObserver?.disconnect();referenceObserver=null;context=study=image=null;volumePromise=null;studyUi={};$('referenceLearning')?.remove();imageLearning.clear();segLearning.clear();$('segPath').setAttribute('d','');$('meshPath').setAttribute('d','');for(const id of ['ctCanvas','segFill'])$(id).getContext('2d').clearRect(0,0,512,512);imaging(false);$('publicStudyCard').hidden=true;$('intersectionState').textContent='No acquired study loaded';annotations.textContent='No source loaded';overlayData.textContent='';mapping.textContent='';verify.disabled=true;}
  async function attach(next:any){
    revision++;referenceObserver?.disconnect();referenceObserver=null;context=next;study=next.study;volumePromise=null;if(!study?.mask){for(const id of ['maskVolume','overlayToggle','meshOverlay','overlayFill','cutaway','sourceLink'])$(id).checked=false;selected=false;}mode=study&&next.visual.supportedModes?.length!==1?'holographic':'scientific';progress=1;
    $('cameraFit').textContent=study?(study.mask?'Fit lesion':'Fit acquired context'):'Fit anatomy';$('cameraFocus').textContent='Focus selected';
    const fx=next.visual.supportsPresentationFX!==false;for(const id of ['effect','density','preset','reduced','progress','play','restart','sourceRange','benchmark'])$(id).disabled=!fx;for(const button of modes.querySelectorAll<HTMLButtonElement>('button')){button.disabled=Boolean(next.visual.supportedModes&&!next.visual.supportedModes.includes(button.dataset.mode));button.title=button.disabled?'Presentation not supported by this source':'';}$('cutaway').disabled=!fx;if(!fx)$('cutaway').checked=false;
    if(fx){next.visual.effect($('effect').value);next.visual.density(Number($('density').value));next.visual.preset($('preset').value);next.visual.reducedMotion($('reduced').checked);}setMode(mode);setProgress(progress);
    $('publicStudyCard').hidden=!study;$('sourceRange').closest('label').hidden=!study?.mask;verify.disabled=!study||Boolean(mappingFlight);$('referenceLesson').hidden=Boolean(study);
    if(study){for(const p of $('publicStudyCard').querySelectorAll('p'))p.hidden=!study.mask;$('studyContext').textContent=study.mask?'Acquired chest context':'Acquired CT context';const shape=sourceShape();sourceK=study.verifiedVolume?0:71;image=new ImageData(shape[2],shape[1]);for(const id of ['ctCanvas','segFill']){$(id).width=shape[2];$(id).height=shape[1];}$('ctOverlay').setAttribute('viewBox',`0 0 ${shape[2]} ${shape[1]}`);$('frame').max=String(shape[0]-1);$('ctClip').max=String(shape[0]-.5);$('level').min=study.verifiedVolume?'-65536':'-1024';$('level').max=study.verifiedVolume?'65536':'3071';$('width').max=study.verifiedVolume?'65536':'4096';$('level').value=study.verifiedVolume?.descriptor.calibration.center??-600;$('width').value=study.verifiedVolume?.descriptor.calibration.width??1500;for(const id of ['overlayToggle','meshOverlay','overlayFill','maskVolume','selectStructure','studyLesion'])$(id).disabled=!study.mask;imaging(true);$('ctPlane').checked=true;next.selectStudy(Boolean(study.mask));renderCt();await contextView();annotations.textContent=study.mask?'H000 · source-linked lung mass':'Verified acquired CT · no SEG admitted';caption.textContent=study.mask?'Acquired research CT + SEG · reference anatomy not registered':'Verified acquired CT · local-only · no atlas registration';}
    else{imaging(false);const lesson=$('referenceLearning');if(lesson){lesson.open=true; $('referenceLesson').replaceChildren(lesson);}const appearance=$('referenceAppearance');if(appearance)appearance.closest('label').hidden=true;caption.textContent='Generalized anatomy · source coverage varies · no patient registration';
      const describe=()=>{const state=next.controller.state(),part=next.manifest.reference.structures.find((p:any)=>p.id===state.selected),male=next.manifest.reference.id==='BODY-DEFAULT-BP3D-01';annotations.textContent=part?`${part.label} · ${part.id}`:male?'BodyParts3D male · generalized reference':'HRA female · generalized reference';$('referenceSourceCoverage')?.remove();if(male&&['FMA7309','FMA7310'].includes(state.selected)){const note=document.createElement('p');note.id='referenceSourceCoverage';note.innerHTML='<strong>KNOWN SOURCE COVERAGE</strong>Source subset: airway and vessel branches; no complete lung envelope.';lesson.querySelector('.learning-copy').append(note);}};
      describe();referenceObserver=new MutationObserver(describe);referenceObserver.observe($('referenceState'),{childList:true,subtree:true,characterData:true});
    }
    observations.readyAtMs=performance.now();if(!study&&!startupUsed)startIntroduction();else $('startupReplay').hidden=Boolean(study);learn();capture();
  }
  return {rendererIntent:()=>({mode,camera:context?.visual.snapshot().camera??null}),attach,selection,onIntent:pause,detached,fail,capture,
    setLoadStudy(action:()=>Promise<void>){if(PUBLIC_STUDY_ENABLED)studyButton.onclick=()=>action().catch(fail);},
    busy(value:boolean){for(const id of ['exploreStudy','referenceVariant','referenceReload','referenceUnload','returnReference'])if($(id))$(id).disabled=value;},
    dispose(){cancelAnimationFrame(raf);layout.dispose();detached();}
  };
}
