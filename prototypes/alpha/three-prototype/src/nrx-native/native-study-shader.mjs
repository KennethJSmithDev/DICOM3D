import {volumeSamplerWGSL, volumeUniformWGSL, volumeTransferWGSL} from '../../../viewer/src/ct-volume-core.mjs';

// Sample the same stored-value field and transfer function as the existing CT viewer.
// The bridge only changes the texture representation and viewport composition.
const sampler = volumeSamplerWGSL
  .replace('texture_3d<f32>', 'texture_3d<u32>')
  .replace('round(v.r*255.0)+256.0*round(v.g*255.0)', 'f32(v.r)');

export const shader = sampler + volumeUniformWGSL + volumeTransferWGSL + `
@group(0) @binding(2) var segmentation: texture_3d<u32>;

fn membership(p:vec3<i32>)->bool {
  let dimensions=vec3<i32>(textureDimensions(segmentation));
  if(any(p<vec3<i32>(0))||any(p>=dimensions)){return false;}
  return textureLoad(segmentation,p,0).r>0u;
}

fn srgbDecode(color:vec3<f32>)->vec3<f32>{
  return select(pow((color + .055)/1.055,vec3<f32>(2.4)),color/12.92,color<=vec3<f32>(.04045));
}

// H000 in Three is composited in linear sRGB before R3F's ACES output pass.
// These matrices and the fit match the installed Three ACESFilmic operator.
fn present(linear:vec3<f32>)->vec4<f32>{
  let intoAces=mat3x3<f32>(
    vec3<f32>(.59719,.07600,.02840),
    vec3<f32>(.35458,.90834,.13383),
    vec3<f32>(.04823,.01566,.83777));
  let outOfAces=mat3x3<f32>(
    vec3<f32>(1.60475,-.10208,-.00327),
    vec3<f32>(-.53108,1.10813,-.07276),
    vec3<f32>(-.07367,-.00605,1.07602));
  let v=intoAces*(linear/.6);
  let a=v*(v+.0245786)-.000090537;
  let b=v*(.983729*v+.4329510*.983729)+.238081;
  let mapped=clamp(outOfAces*(a/b),vec3<f32>(0),vec3<f32>(1));
  let encoded=select(1.055*pow(mapped,vec3<f32>(.41666))-.055,
                     12.92*mapped,mapped<=vec3<f32>(.0031308));
  return vec4<f32>(encoded,1);
}

fn planeTexel(p:vec2<i32>)->vec3<f32>{
  let q=vec3<i32>(clamp(p,vec2<i32>(0),vec2<i32>(511)),i32(ct.clip.z));
  // Reproduce the fixed source plane's byte-valued window and optional tint.
  let gray=round(clamp((stored(q)-1024.0+1350.0)/1500.0,0,1)*255.0);
  var rgb=vec3<f32>(gray);
  if(ct.padding.w>.5 && membership(q)){
    rgb=floor(.6*rgb+vec3<f32>(0,84,102)+.5);
  }
  return srgbDecode(rgb/255.0);
}

fn samplePlane(point:vec2<f32>,minifying:bool)->vec3<f32>{
  if(!minifying){return planeTexel(vec2<i32>(floor(point+.5)));}
  let base=vec2<i32>(floor(point));
  let f=fract(point);
  let a=mix(planeTexel(base),planeTexel(base+vec2<i32>(1,0)),f.x);
  let b=mix(planeTexel(base+vec2<i32>(0,1)),planeTexel(base+vec2<i32>(1,1)),f.x);
  return mix(a,b,f.y);
}

@vertex fn vs(@builtin(vertex_index) index:u32)->@builtin(position) vec4<f32> {
  let corners=array<vec2<f32>,3>(vec2<f32>(-1,1),vec2<f32>(-1,-3),vec2<f32>(3,1));
  return vec4<f32>(corners[index],0,1);
}

fn unproject(screen:vec2<f32>,depth:f32)->vec3<f32>{
  let q=ct.inverseViewProjection*vec4<f32>(screen,depth,1);
  return q.xyz/q.w;
}

@fragment fn fs(@builtin(position) pixel:vec4<f32>)->@location(0) vec4<f32>{
  let uv=pixel.xy/ct.screen.xy;
  let screen=vec2<f32>(uv.x*2-1,1-uv.y*2);
  let originWorld=unproject(screen,ct.screen.w);
  let directionWorld=normalize(unproject(screen,ct.padding.z)-originWorld);
  let origin=(ct.worldToTexture*vec4<f32>(originWorld,1)).xyz;
  let direction=(ct.worldToTexture*vec4<f32>(directionWorld,0)).xyz;
  let safe=select(direction,vec3<f32>(1e-8),abs(direction)<vec3<f32>(1e-8));
  let a=(vec3<f32>(-.5)-origin)/safe;
  let b=(vec3<f32>(511.5,511.5,102.5)-origin)/safe;
  let near=max(max(min(a,b).x,min(a,b).y),min(a,b).z);
  var far=min(min(max(a,b).x,max(a,b).y),max(a,b).z);
  var background=srgbDecode(vec3<f32>(5,12,21)/255.);
  let planeDistance=(ct.clip.z-origin.z)/safe.z;
  let planePoint=origin.xy+direction.xy*planeDistance;
  // Match the source texture's nearest magnification and linear minification.
  // Compute derivatives before entering the varying plane bounds check.
  let minifying=max(length(dpdx(planePoint)),length(dpdy(planePoint)))>1.0;
  if (ct.clip.w>.5 && abs(direction.z)>1e-8) {
    if (planeDistance>0 && all(planePoint>=vec2<f32>(-.5)) && all(planePoint<=vec2<f32>(511.5))) {
      background=samplePlane(planePoint,minifying);
      far=min(far,planeDistance);
    }
  }
  var rgb=0.0;
  var alpha=0.0;
  for (var i=0;i<512;i++) {
    let t=max(near,0.)+(f32(i)+.5)*ct.screen.z;
    if (t>far || alpha>=.999) {break;}
    let point=origin+direction*t;
    if (point.z<ct.clip.x) {continue;}
    if (ct.padding.x>.5 && ct.padding.y>0. && membership(vec3<i32>(floor(point+.5)))) {
      let mark=srgbDecode(select(vec3<f32>(56,201,233),vec3<f32>(255,153,26),ct.clip.y>.5)/255.0);
      background=mix(background,mark,ct.padding.y);
      break;
    }
    if (ct.display.w>.5) {
      let sample=transfer(interpolate(point));
      rgb+=(1-alpha)*sample.y*sample.x;
      alpha+=(1-alpha)*sample.y;
    }
  }
  return present(vec3<f32>(rgb)+(1-alpha)*background);
}
`;
