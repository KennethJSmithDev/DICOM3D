import {useLayoutEffect,useMemo,useRef,useState} from 'react';
export const PROFILE_KEY='dicom3d.render-profile.v1';
export function useRenderSettings(){
 const [compact,setCompact]=useState(()=>innerWidth<1280);
 const [profile,setProfile]=useState(()=>{try{const value=localStorage.getItem(PROFILE_KEY);if(['efficient','detail'].includes(value))return value}catch{}return innerWidth<1280?null:'detail'});
 const [choosing,setChoosing]=useState(false),[remember,setRemember]=useState(false),[panel,setPanel]=useState('');
 useLayoutEffect(()=>{const root=document.getElementById('root');const observer=new ResizeObserver(es=>setCompact(es[0].contentRect.width<1280));observer.observe(root);return()=>observer.disconnect()},[]);
 const policy=useMemo(()=>({id:profile??'waiting',fps:profile==='efficient'?30:60,dpr:profile==='efficient'?1:1.5}),[profile]);
 function choose(value){setProfile(value);setChoosing(false);try{if(remember)localStorage.setItem(PROFILE_KEY,value);else localStorage.removeItem(PROFILE_KEY)}catch{}}
 return {compact,profile,policy,panel,setPanel,chooser:!profile||choosing,remember,setRemember,choose,open:()=>setChoosing(true),cancel:profile?()=>setChoosing(false):null};
}
export function QualityChooser({settings}){
 const dialog=useRef(null);
 useLayoutEffect(()=>{if(!settings.chooser)return;const previous=document.activeElement;dialog.current?.querySelector('button')?.focus();return()=>previous?.isConnected&&previous.focus()},[settings.chooser]);
 function keyboard(event){if(event.key==='Escape'&&settings.cancel){event.preventDefault();settings.cancel();return}if(event.key!=='Tab')return;const items=[...dialog.current.querySelectorAll('button,input')].filter(x=>!x.disabled);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
 if(!settings.chooser)return null;return <div className="quality-backdrop"><section ref={dialog} onKeyDown={keyboard} role="dialog" aria-modal="true" aria-labelledby="quality-title" className="quality-dialog"><h2 id="quality-title">Choose your viewing experience</h2><p>Both choices use the same source-backed anatomy and imaging. You can change this later.</p><button onClick={()=>settings.choose('efficient')}><b>Efficient</b><span>Recommended for phones. Less drawing and loading work; additional anatomy loads when requested.</span></button><button onClick={()=>settings.choose('detail')}><b>Higher detail</b><span>Current starting anatomy and sharper 3D presentation. Uses more resources while interacting.</span></button><label><input type="checkbox" checked={settings.remember} onChange={e=>settings.setRemember(e.target.checked)}/>Remember on this device</label>{settings.cancel&&<button onClick={settings.cancel}>Keep current choice</button>}</section></div>}
