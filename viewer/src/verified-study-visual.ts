import {captureScreenshot} from '@babylonjs/lite';
import {createIntegratedCt} from './integrated-ct';
// Thin scientific adapter: existing CT composition and the established workstation UI.
// No SEG/lesion or presentation FX are inferred for a CT-only acquired source.
export async function createVerifiedStudyVisual({engine,scene,camera,canvas,manifest,verifiedVolume}:any){
 const ct=createIntegratedCt({engine,scene,camera,canvas,meshes:[],manifest,verifiedVolume});let closed=false,closePromise:any=null;
 const ensure=()=>{if(closed)throw Error('Verified CT visual closed');};
 return {backend:'babylon',supportedModes:['scientific'],supportsPresentationFX:false,
 activate(){ct.start();},mode(value:string){ensure();if(value!=='scientific')throw Error('Verified CT FX unsupported');},progress(value:number){ensure();if(value!==1)throw Error('Verified CT materialization unsupported');},
 select(value:boolean){ensure();if(value)throw Error('No segmentation admitted');},visible(value:boolean){ensure();if(value)throw Error('No source structure admitted');},
 sourceFrame(receipt:any,image:ImageData,k:number){ensure();ct.sourceFrame(receipt,image,k);},ctSettings(options:any){ensure();if(options.masked)throw Error('No segmentation admitted');ct.settings(options);},
 linkSource(k:number,value:boolean,cutaway:boolean){ensure();if(cutaway)throw Error('No source surface cutaway admitted');},
 async loadVolume(source:any,mask:any){ensure();if(source!==verifiedVolume.pixels||mask!==null)throw Error('Verified source change');await verifiedVolume.assertSourceUnchanged();return ct.loadVolume(source,null);},
 sourceIndexGeometry(){ensure();return [];},fitContext(){ensure();ct.fit();},pickAllowed(){return false;},pickDiscard(){return undefined;},
 verifySource(points:number[][]){ensure();return ct.verify(points);},capture(){ensure();return captureScreenshot(engine);},
 snapshot(){return {backend:'babylon',owner:'verified-ct',mode:'scientific',sourceIdentity:verifiedVolume.descriptor.payload.sha256,sourceShape:verifiedVolume.descriptor.shape,ct:ct.snapshot(),camera:{alpha:camera.alpha,beta:camera.beta,radius:camera.radius,target:[camera.target.x,camera.target.y,camera.target.z],fov:camera.fov,nearPlane:camera.nearPlane,farPlane:camera.farPlane}};},
 dispose(){if(closePromise)return closePromise;closed=true;closePromise=ct.clear().finally(()=>ct.dispose());return closePromise;}
 };
}
