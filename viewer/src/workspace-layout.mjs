// Presentation-only proportions. Image pixels, camera pose and dataset transforms are not owned here.
export function bindWorkspaceDivider({divider,imaging,viewing,record=()=>{}}) {
  let drag=null;
  const available=()=>Math.max(1,viewing.clientWidth-divider.offsetWidth-24);
  const limits=()=>{const width=available();return {width,min:Math.min(240,width*.4),max:Math.max(width*.4,width-300)};};
  const updateAria=()=>{const {min,max}=limits();divider.setAttribute('aria-valuemin',String(Math.round(min)));divider.setAttribute('aria-valuemax',String(Math.round(max)));divider.setAttribute('aria-valuenow',String(Math.round(imaging.clientWidth)));divider.setAttribute('aria-valuetext',`${Math.round(imaging.clientWidth/available()*100)}% imaging`);};
  const width=value=>{const l=limits(),bounded=Math.max(l.min,Math.min(l.max,value));viewing.style.setProperty('--ct-share',String(bounded/l.width));updateAria();record('dockWidth',bounded);};
  const end=e=>{if(e?.pointerId!==undefined&&e.pointerId!==drag?.id)return;const id=drag?.id;drag=null;if(id!==undefined&&divider.hasPointerCapture(id))divider.releasePointerCapture(id);};
  divider.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,width:imaging.clientWidth};divider.setPointerCapture(e.pointerId);};
  divider.onpointermove=e=>{if(drag&&drag.id===e.pointerId){if(!(e.buttons&1)){end();return;}width(drag.width+e.clientX-drag.x);}};
  divider.onpointerup=end;divider.onpointercancel=end;divider.onlostpointercapture=end;
  divider.onkeydown=e=>{if(e.key==='Escape'){end();return;}if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();width(e.key==='Home'?available()*.4:imaging.clientWidth+(e.key==='ArrowRight'?20:-20));}};
  const observer=new ResizeObserver(updateAria);observer.observe(viewing);observer.observe(imaging);
  window.addEventListener('blur',end);
  return {snapshot:()=>({imagingShare:imaging.hidden?0:imaging.clientWidth/available(),dragging:Boolean(drag)}),dispose(){end();observer.disconnect();window.removeEventListener('blur',end);for(const key of ['onpointerdown','onpointermove','onpointerup','onpointercancel','onlostpointercapture','onkeydown'])divider[key]=null;}};
}
