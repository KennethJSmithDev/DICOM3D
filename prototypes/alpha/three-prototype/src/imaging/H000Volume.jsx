import React,{useEffect,useState} from 'react';
import {useThree} from '@react-three/fiber';
import {probeH000Volume} from './h000-volume-probe.mjs';
import {createH000Volume} from './h000-volume-material.mjs';
const noop=()=>{};
/** Complete admitted H000 volume. Source voxels/mask unchanged; not organ segmentation or NRX extraction. */
export default function H000Volume({study,enabled=true,level=-600,width=1500,gain=1,clipK=-.5,accumulation=null,onStatus=noop,probeRequest=0,onProbe=noop}){
 const gl=useThree(state=>state.gl),[resource,setResource]=useState(null);
 useEffect(()=>{let value=null;setResource(null);if(!study||!enabled){onStatus({status:'unloaded'});return}
 if(!gl.backend?.isWebGPUBackend){onStatus({status:'unsupported',message:'Whole CT volume currently requires WebGPU; source imaging and lesion remain available.'});return}
 try{value=createH000Volume(study);setResource({value,study});onStatus({status:'allocated',representation:'Direct volume rendering',dimensions:[512,512,103],stepMm:2,sourceBytes:value.sourceBytes,logicalVolumeBytes:value.logicalVolumeBytes,sourceSha256:study.manifest?.provenance?.B_volume?.sha256??null,depth:'Copied opaque scene depth; transparent mesh depth follows existing material settings',limitation:'Interpolation and opacity transfer are display only; not organ segmentation or NRX extraction.'});}
 catch(error){onStatus({status:'error',message:error.message})}
 return()=>{value?.dispose();};
 },[study,enabled,gl,onStatus]);
 useEffect(()=>{if(resource?.study===study)resource.value.setDisplay(level,width,gain,clipK)},[resource,study,level,width,gain,clipK]);
 useEffect(()=>{if(resource?.study===study)resource.value.setAccumulation(accumulation)},[resource,study,accumulation]);
 useEffect(()=>{let live=true;if(!probeRequest||resource?.study!==study)return;onProbe({status:'running'});probeH000Volume(gl,resource.value,study).then(value=>{if(live)onProbe(value)}).catch(error=>{if(live)onProbe({status:'error',message:error.message})});return()=>{live=false}},[probeRequest,resource,study,gl,onProbe]);
 if(!enabled||resource?.study!==study)return null;
 const value=resource.value;
 return <mesh geometry={value.geometry} material={value.material} matrix={value.matrix} matrixAutoUpdate={false} renderOrder={100} frustumCulled={false} raycast={()=>null} dispose={null}/>;
}
