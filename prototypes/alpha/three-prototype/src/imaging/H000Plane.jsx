import React,{useMemo,useEffect} from 'react';
import {createH000Plane,disposeH000Plane} from './h000-plane.js';
export const planeLifecycle={created:0,disposed:0,active:0};
export default function H000Plane({study,frame,showSeg=true}){
 const plane=useMemo(()=>createH000Plane(study,frame,showSeg),[study,frame,showSeg]);
 useEffect(()=>{if(!plane)return;planeLifecycle.created++;planeLifecycle.active++;return()=>{disposeH000Plane(plane);planeLifecycle.disposed++;planeLifecycle.active--}},[plane]);
 return plane?<mesh key={plane.material.uuid} name="acquired-source-plane" geometry={plane.geometry} material={plane.material} raycast={()=>null} dispose={null}/>:null;
}

