// WHY: Lite 1.32.0's default pan gain is tiny and its drag has no cancel path.
// BOUNDARY: camera input and primary-tap eligibility only; semantic picking stays with each owner.
// INVARIANT: retain Lite orbit/wheel/touch and source coordinates. No camera refit on resize.
// EVIDENCE: evidence/ux-b04; regression risks are stuck drag, false selection and pan gain.
export function panSensitivity(height,fov) {
  return Math.max(1,height)*.001/(2*Math.tan(fov/2));
}

export function bindViewportControls({camera,canvas,scene,attachControl,onIntent=()=>{},onTap=()=>{},windowTarget=window,documentTarget=document,now=()=>performance.now(),raf=requestAnimationFrame,caf=cancelAnimationFrame}) {
  let enabled=true,disposed=false,detach=()=>{},pending=0,measurement=null;
  const pointers=new Map(),responses=[],gestures=[],cancellations=[];
  let taps=0,contextMenus=0,captures=0;
  const pose=()=>[camera.alpha,camera.beta,camera.radius,camera.target.x,camera.target.y,camera.target.z];
  const keep=(list,value,limit)=>{list.push(value);if(list.length>limit)list.shift();};
  const configure=()=>{camera.panningInertia=0;camera.panningSensibility=panSensitivity(canvas.clientHeight,camera.fov);};
  const stopMomentum=()=>{for(const key of ['inertialAlphaOffset','inertialBetaOffset','inertialRadiusOffset','inertialPanningX','inertialPanningY'])camera[key]=0;};
  const supported=e=>enabled&&!disposed&&(e.pointerType==='touch'||e.button===0||e.button===2);
  const attach=()=>{detach=attachControl(camera,canvas,scene,{shouldHandlePointerDown:supported});};
  const cancel=(reason='cancel')=>{
    const ids=[...pointers.keys()];pointers.clear();stopMomentum();onIntent('cancel');
    if(ids.length)keep(cancellations,{reason,atMs:now(),pointerIds:ids},24);
    caf(pending);measurement=null;
    // Rebind through Lite's own disposer: clears private drag/touch state without synthetic input.
    detach();if(!disposed)attach();
    for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
  };
  const sample=()=>{
    pending=0;if(!measurement)return;
    const next=pose(),changed=next.some((v,i)=>Math.abs(v-measurement.pose[i])>1e-12);
    if(changed||measurement.frames++>=4){
      keep(responses,{...measurement,observedAtMs:now(),responseMs:now()-measurement.receivedAtMs,changed,after:next},128);
      measurement=null;
    }else pending=raf(sample);
  };
  const down=e=>{
    if(!supported(e))return;
    configure();onIntent('down');canvas.focus({preventScroll:true});
    pointers.set(e.pointerId,{id:e.pointerId,button:e.button,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,maxDistance:0,dx:0,dy:0,tap:e.button===0,atMs:now()});
    if(pointers.size>1)for(const p of pointers.values())p.tap=false;
  };
  const move=e=>{
    const p=pointers.get(e.pointerId);if(!p){if(pointers.size)e.stopImmediatePropagation();return;}
    const buttonMask=p.button===2?2:1;
    if(e.pointerType!=='touch'&&!(e.buttons&buttonMask)){cancel('buttons-released');return;}
    p.maxDistance=Math.max(p.maxDistance,Math.hypot(e.clientX-p.x,e.clientY-p.y));
    const dx=e.clientX-p.lastX,dy=e.clientY-p.lastY;p.dx+=dx;p.dy+=dy;p.lastX=e.clientX;p.lastY=e.clientY;
    if(p.maxDistance>4)p.tap=false;
    if(dx||dy){onIntent('move');if(!measurement){measurement={receivedAtMs:now(),eventTimeStamp:e.timeStamp,eventType:'pointermove',button:p.button,pose:pose(),frames:0};pending=raf(sample);}}
  };
  const up=e=>{
    const p=pointers.get(e.pointerId);pointers.delete(e.pointerId);if(!p){e.stopImmediatePropagation();return;}
    p.maxDistance=Math.max(p.maxDistance,Math.hypot(e.clientX-p.x,e.clientY-p.y));
    const r=canvas.getBoundingClientRect(),inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
    const tap=enabled&&e.button===0&&p.button===0&&p.tap&&p.maxDistance<=4&&inside;
    keep(gestures,{...p,endAtMs:now(),inside,tap,captureAtRelease:canvas.hasPointerCapture(e.pointerId)},24);
    if(tap){taps++;onTap(e);}
  };
  const lost=e=>{if(pointers.has(e.pointerId))cancel('lostpointercapture');};
  const pointerCancel=e=>{if(pointers.has(e.pointerId))cancel('pointercancel');};
  const escape=e=>{if(e.key==='Escape'&&(pointers.size||documentTarget.activeElement===canvas)){e.preventDefault();cancel('escape');}};
  const blur=()=>{if(pointers.size)cancel('blur');};
  const visibility=()=>{if(documentTarget.hidden)cancel('hidden');};
  const wheel=()=>{for(const p of pointers.values())p.tap=false;onIntent('wheel');};
  const capture=()=>captures++;
  const menu=e=>{e.preventDefault();contextMenus++;};
  configure();
  // Capture guards run before Lite, including after a cancellation rebind.
  const listeners=[
    [canvas,'pointerdown',down,true],[canvas,'pointermove',move,true],[canvas,'pointerup',up,true],
    [canvas,'pointercancel',pointerCancel,true],[canvas,'lostpointercapture',lost,true],
    [canvas,'gotpointercapture',capture,true],[canvas,'wheel',wheel,true],
    [windowTarget,'keydown',escape,true],[windowTarget,'blur',blur],
    [documentTarget,'visibilitychange',visibility],
  ];
  for(const [target,type,handler,capture] of listeners)target.addEventListener(type,handler,capture);
  attach();canvas.addEventListener('contextmenu',menu);
  return {
    cancel,resize:configure,
    setActive(value){if(!value)cancel('owner-deactivated');enabled=value;},
    snapshot:()=>({enabled,activePointerIds:[...pointers.keys()],panSensitivity:camera.panningSensibility,panInertia:camera.panningInertia,taps,contextMenusPrevented:contextMenus,captures,gestures:[...gestures],cancellations:[...cancellations],responses:[...responses],measurement:'Input-handler to first RAF observation of changed camera; CPU upper bound, not display latency. Bounded to 128 observations.',panAxes:'Lite horizontal right vector and world Y; one-to-one horizontal target-plane gain; tilted vertical gain retains Lite semantics.'}),
    dispose(){disposed=true;cancel('dispose');canvas.removeEventListener('contextmenu',menu);for(const [target,type,handler,capture] of listeners)target.removeEventListener(type,handler,capture);}
  };
}
