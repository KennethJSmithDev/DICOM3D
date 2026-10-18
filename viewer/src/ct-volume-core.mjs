// Presentation-only storage/sampling. Never changes the source uint16 view.
export const STUDY_WORLD=new Float32Array([-1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export const multiplyRows=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((sum,v,k)=>sum+v*b[k][j],0)));
export const columns=a=>new Float32Array(Array.from({length:16},(_,i)=>a[i%4][Math.floor(i/4)]));
export const rows=a=>Array.from({length:4},(_,r)=>Array.from({length:4},(_,c)=>a[c*4+r]));
export function packStored(source) {const bytes=new Uint8Array(source.length*4);for(let i=0;i<source.length;i++){bytes[4*i]=source[i]&255;bytes[4*i+1]=source[i]>>>8;bytes[4*i+3]=255;}return bytes;}
const permute=[[0,0,1,0],[0,1,0,0],[1,0,0,0],[0,0,0,1]];
export function volumeMatrices(m,world=STUDY_WORLD) {
  // Accepted Lite presentation reflection is rigid, and its inverse is itself.
  if(Array.from(world).some((v,i)=>Math.abs(v-STUDY_WORLD[i])>1e-7))throw Error('Unqualified study presentation transform');
  return {worldToTexture:columns(multiplyRows(permute,multiplyRows(m.patient_mm_to_index,multiplyRows(m.model_m_to_patient_mm,rows(world))))),textureToWorld:columns(multiplyRows(rows(world),multiplyRows(m.patient_mm_to_model_m,multiplyRows(m.index_to_patient_mm,permute))))};
}
export const opacityValues=[-1200,-1000,-950,-850,-750,-650,-500,-300,-150,0,150,300,600,1200,2200];
export const opacityPerMm=[0,0,.00015,.0005,.0016,.004,.008,.009,.010,.012,.014,.020,.030,.038,.025];
// Reused VOL-A byte decode, then interpolation; source order[k,row,col], texel[col,row,k].
export const volumeSamplerWGSL=`@group(0) @binding(0) var volume:texture_3d<f32>;
fn stored(p:vec3<i32>)->f32{let d=vec3<i32>(textureDimensions(volume));let v=textureLoad(volume,clamp(p,vec3<i32>(0),d-vec3<i32>(1)),0);return round(v.r*255.0)+256.0*round(v.g*255.0);}
fn interpolate(p:vec3<f32>)->f32{let lo=vec3<i32>(floor(p));let f=fract(p);let a=mix(stored(lo),stored(lo+vec3<i32>(1,0,0)),f.x);let b=mix(stored(lo+vec3<i32>(0,1,0)),stored(lo+vec3<i32>(1,1,0)),f.x);let c=mix(stored(lo+vec3<i32>(0,0,1)),stored(lo+vec3<i32>(1,0,1)),f.x);let d=mix(stored(lo+vec3<i32>(0,1,1)),stored(lo+vec3<i32>(1,1,1)),f.x);return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);}`;
export const volumeUniformWGSL=`struct CT{inverseViewProjection:mat4x4<f32>,worldToTexture:mat4x4<f32>,textureToWorld:mat4x4<f32>,display:vec4<f32>,screen:vec4<f32>,clip:vec4<f32>,padding:vec4<f32>};@group(0) @binding(1) var<uniform> ct:CT;`;
export const volumeTransferWGSL=`fn transfer(value:f32)->vec2<f32>{let intensity=value-1024.0;let gray=clamp((intensity-(ct.display.x-ct.display.y*.5))/ct.display.y,0.0,1.0);let knots=array<f32,15>(${opacityValues.map(v=>v.toFixed(6)).join(',')});let alpha=array<f32,15>(${opacityPerMm.map(v=>v.toFixed(6)).join(',')});var perMm=alpha[0];for(var i=1;i<15;i++){if(intensity>=knots[i]){perMm=alpha[i];}else if(intensity>knots[i-1]){perMm=mix(alpha[i-1],alpha[i],(intensity-knots[i-1])/(knots[i]-knots[i-1]));break;}}return vec2<f32>(gray,1.0-pow(1.0-clamp(perMm*ct.display.z,0.0,.95),ct.screen.z*1000.0));}`;
