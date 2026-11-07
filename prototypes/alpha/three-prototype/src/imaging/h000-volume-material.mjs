import {BackSide,BoxGeometry,Data3DTexture,DepthTexture,Matrix4,NearestFilter,NoColorSpace,RGBAFormat,UnsignedByteType,Vector4} from 'three';
import {MeshBasicNodeMaterial} from 'three/webgpu';
import {wgslFn,texture3D,uniform,positionLocal,modelWorldMatrix,modelWorldMatrixInverse,cameraPosition,cameraProjectionMatrixInverse,cameraWorldMatrix,vec4,screenUV,viewportTexture} from 'three/tsl';
import {packStored,opacityValues,opacityPerMm,validateVolume,volumeTransform} from './h000-volume-core.mjs';
import {accumulationVector,accumulationWGSL} from '../../../viewer/src/ct-accumulation.mjs';

// REUSE: exact CT low/high byte packing and transfer knots from ct-volume-core.
// BRIDGE: Three model-space proxy and WebGPU projection/depth, not Babylon scene ownership.
export const storedWGSL = `fn ctStored(tex:texture_3d<f32>,p:vec3<i32>)->f32 {let d=vec3<i32>(textureDimensions(tex));let v=textureLoad(tex,clamp(p,vec3<i32>(0),d-vec3<i32>(1)),0);return round(v.r*255.0)+256.0*round(v.g*255.0);}`;
const stored=wgslFn(storedWGSL);
export const interpolateWGSL=`fn ctInterpolate(tex:texture_3d<f32>,p:vec3<f32>)->f32{let lo=vec3<i32>(floor(p));let f=fract(p);let a=mix(ctStored(tex,lo),ctStored(tex,lo+vec3<i32>(1,0,0)),f.x);let b=mix(ctStored(tex,lo+vec3<i32>(0,1,0)),ctStored(tex,lo+vec3<i32>(1,1,0)),f.x);let c=mix(ctStored(tex,lo+vec3<i32>(0,0,1)),ctStored(tex,lo+vec3<i32>(1,0,1)),f.x);let d=mix(ctStored(tex,lo+vec3<i32>(0,1,1)),ctStored(tex,lo+vec3<i32>(1,1,1)),f.x);return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);}`;
const interpolate=wgslFn(interpolateWGSL,[stored]);
const transfer=wgslFn(`fn ctTransfer(value:f32,display:vec4<f32>)->vec2<f32>{let intensity=value-1024.0;let gray=clamp((intensity-(display.x-display.y*.5))/display.y,0.0,1.0);let knots=array<f32,15>(${opacityValues.map(v=>v.toFixed(6)).join(',')});let alpha=array<f32,15>(${opacityPerMm.map(v=>v.toFixed(6)).join(',')});var perMm=alpha[0];for(var i=1;i<15;i++){if(intensity>=knots[i]){perMm=alpha[i];}else if(intensity>knots[i-1]){perMm=mix(alpha[i-1],alpha[i],(intensity-knots[i-1])/(knots[i]-knots[i-1]));break;}}return vec2<f32>(gray,1.0-pow(1.0-clamp(perMm*display.z,0.0,.95),2.0));}`);
const accumulated=wgslFn(accumulationWGSL);
const march=wgslFn(`fn ctMarch(tex:texture_3d<f32>,origin:vec3<f32>,exitPoint:vec3<f32>,model:mat4x4<f32>,display:vec4<f32>,accumulation:vec4<f32>,depthLocal:vec3<f32>,sceneDepth:f32)->vec4<f32>{
 let direction=normalize(exitPoint-origin);let safe=select(direction,vec3<f32>(0.00000001),abs(direction)<vec3<f32>(0.00000001));
 let a=(vec3<f32>(-.5)-origin)/safe;let b=(vec3<f32>(.5)-origin)/safe;let near=max(max(min(a,b).x,min(a,b).y),min(a,b).z);let far=min(min(max(a,b).x,max(a,b).y),max(a,b).z);
 let worldPerLocal=length((model*vec4<f32>(direction,0)).xyz);let delta=.002/max(worldPerLocal,0.000001);var stop=far;
 if(sceneDepth<.999999){stop=min(stop,dot(depthLocal-origin,direction));}
 var rgb=0.0;var alpha=0.0;
 for(var i=0;i<512;i++){let t=max(near,0.0)+(f32(i)+.5)*delta;if(t>stop||alpha>=.999){break;}let p=(origin+direction*t+vec3<f32>(.5))*vec3<f32>(512,512,103)-vec3<f32>(.5);if(p.z<display.w||!accumulatedK(p.z,accumulation)){continue;}let s=ctTransfer(ctInterpolate(tex,p),display);rgb+=(1-alpha)*s.y*s.x;alpha+=(1-alpha)*s.y;}
 return vec4<f32>(vec3<f32>(rgb/max(alpha,.000001)),alpha);
}`,[interpolate,transfer,accumulated]);
// Ownership instrumentation only; allocation/disposal is not physical GPU reclamation.
export const volumeLifecycle={created:0,disposed:0,active:0};
export function createH000Volume(study){
 const matrices=validateVolume(study),bytes=packStored(study.pixels);
 const texture=new Data3DTexture(bytes,512,512,103);texture.format=RGBAFormat;texture.type=UnsignedByteType;texture.colorSpace=NoColorSpace;texture.minFilter=texture.magFilter=NearestFilter;texture.unpackAlignment=1;texture.generateMipmaps=false;texture.needsUpdate=true;
 const depthTexture=new DepthTexture(),depth=viewportTexture(screenUV,null,depthTexture).r;
 const ndc=vec4(screenUV.x.mul(2).sub(1),screenUV.y.mul(-2).add(1),depth,1);
 const view=cameraProjectionMatrixInverse.mul(ndc),world=cameraWorldMatrix.mul(view.div(view.w));
 const depthLocal=modelWorldMatrixInverse.mul(world).xyz;
 const origin=modelWorldMatrixInverse.mul(vec4(cameraPosition,1)).xyz;
 const display=uniform(new Vector4(-600,1500,1,-.5));
 const accumulatedRange=uniform(new Vector4(0,-.5,102.5,1));
 const material=new MeshBasicNodeMaterial({transparent:true,side:BackSide,depthTest:false,depthWrite:false,toneMapped:false});
 material.fragmentNode=march({tex:texture3D(texture),origin,exitPoint:positionLocal,model:modelWorldMatrix,display,accumulation:accumulatedRange,depthLocal,sceneDepth:depth});
 const geometry=new BoxGeometry(1,1,1),matrix=new Matrix4().fromArray(volumeTransform(matrices));
 let disposed=false;volumeLifecycle.created++;volumeLifecycle.active++;
 return {texture,material,geometry,matrix,display,logicalVolumeBytes:bytes.byteLength,sourceBytes:study.pixels.byteLength,
 setDisplay(level,width,gain,clipK){if(![level,width,gain,clipK].every(Number.isFinite)||width<=0)throw Error('Invalid volume presentation');display.value.set(level,width,Math.max(0,Math.min(2,gain)),Math.max(-.5,Math.min(102.5,clipK)));},
 setAccumulation(a){if(a)accumulatedRange.value.fromArray(accumulationVector(a));else accumulatedRange.value.set(0,-.5,102.5,1);},
 dispose(){if(disposed)return;disposed=true;volumeLifecycle.disposed++;volumeLifecycle.active--;geometry.dispose();material.dispose();texture.dispose();depthTexture.dispose();texture.image.data=null;},
 };
}
