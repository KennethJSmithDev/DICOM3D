import type {RendererId} from './renderer-contract';
export function installRendererSelector({enabled,switchTo,snapshot}: {enabled:boolean;switchTo:(id:RendererId)=>Promise<any>;snapshot:()=>any}){
  if(!enabled)return;
  const label=document.createElement('label');label.id='developmentRendererControl';label.textContent='Private dev renderer ';label.style.cssText='font-size:11px;max-width:18rem';
  const select=document.createElement('select');select.id='developmentRenderer';select.innerHTML='<option value="babylon">Babylon Lite · default</option><option value="native">Native Wasm64 · capability gate</option>';label.append(select);
  const output=document.createElement('output');output.id='developmentRendererState';output.hidden=true;output.style.cssText='max-width:38rem;font-size:11px;white-space:pre-wrap';label.append(output);document.querySelector('.app-header')!.append(label);
  let flight:Promise<any>|null=null;
  const change=(id:RendererId)=>{if(id!=='babylon'&&id!=='native')return Promise.reject(Error('Unknown renderer'));if(flight)return Promise.reject(Error('Renderer switch pending'));select.disabled=true;flight=switchTo(id).finally(()=>{select.value=snapshot().selected;select.disabled=false;output.textContent=JSON.stringify(snapshot());flight=null;});return flight;};
  select.onchange=()=>change(select.value as RendererId).catch(error=>{output.textContent=String(error);});
  output.textContent=JSON.stringify(snapshot());
  Object.assign(globalThis,{__dicom3dRendererDevelopment:{select:change,snapshot}});
}
