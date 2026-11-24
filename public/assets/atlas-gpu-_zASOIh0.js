var e=64,t=1+Math.log2(e),n=4,r=(e,t,n,r,i,a)=>({perMeter:e,tint:t,contrast:n,roughness:r,roughnessRange:i,pattern:a}),i=(e,t)=>Math.sin(e+t+.9*Math.sin(e-2*t)),a=(e,t)=>Math.sin(4*e-3*t)*Math.cos(5*t+2*e),o=(e,t)=>Math.sin(17*e+11*t)*Math.sin(9*e-16*t),s=[r(14,[1,.98,.98],.14,.68,.1,(e,t)=>.7*a(e,t)+.3*o(e,t)),r(13,[1,.96,.94],.22,.55,.13,(e,t)=>.6*a(e,t)+.4*i(2*e,t)),r(24,[1,.94,.94],.22,.68,.12,(e,t)=>.7*i(3*e,2*t)+.3*o(e,t)),r(20,[1,.95,.94],.12,.58,.065,(e,t)=>.7*Math.sin(9*e+2*t+1.5*Math.sin(2*e-t))+.3*a(e,t)),r(19,[1,.95,.93],.1,.5,.06,(e,t)=>.65*a(e,t)+.35*a(t+1,2*e)),r(15,[1.01,1,.98],.09,.54,.06,(e,t)=>.7*i(2*e,3*t)+.3*a(e,t)),r(17,[1.01,.97,.97],.17,.5,.11,(e,t)=>.8*i(2*e,5*t)+.2*o(e,t)),r(21,[1,.98,.96],.14,.46,.09,(e,t)=>.7*i(e,7*t)+.3*a(e,t)),r(24,[1.01,.99,.95],.21,.63,.12,(e,t)=>.7*a(2*e,2*t)+.3*o(e,t)),r(21,[.98,.94,1],.17,.56,.1,(e,t)=>.5*a(e,t)+.5*o(e,t)),r(20,[1.01,.98,.97],.11,.48,.07,(e,t)=>.7*i(3*e,2*t)+.3*a(e,t)),r(26,[1.02,.98,.96],.15,.53,.1,(e,t)=>.5*a(2*e,t)+.5*i(e,4*t)),r(30,[1,1,1],.035,.23,.035,(e,t)=>.7*i(e,2*t)+.3*o(e,t)),r(25,[1.01,.98,.97],.13,.53,.09,(e,t)=>.8*i(2*e,6*t)+.2*o(e,t)),r(20,[.95,1.01,.95],.105,.42,.08,(e,t)=>.6*i(2*e,4*t)+.4*a(e,t)),r(34,[1,.99,.98],.07,.58,.08,(e,t)=>.5*a(e,t)+.5*o(e,t)),r(26,[1.02,1,.97],.15,.61,.1,(e,t)=>.75*a(2*e,3*t)+.25*i(4*e,t)),r(31,[1,.994,.976],.09,.67,.095,(e,t)=>.42*a(e,t)+.58*o(e,t)),r(24,[1,.96,.94],.135,.53,.09,(e,t)=>.72*Math.sin(12*e+t+1.6*Math.sin(2*t-e))+.28*a(e,t)),r(34,[1,.975,.965],.065,.45,.06,(e,t)=>.65*i(e,6*t)+.35*a(e,t)),r(30,[.98,.988,1],.06,.41,.065,(e,t)=>.7*i(2*e,3*t)+.3*a(e,t))];function c(e){return s[e-1]?.perMeter??0}var l;function u(){let t=4096*n,r=new Uint8Array(t*s.length),i=e=>Math.round(Math.min(1,Math.max(0,e))*255);for(let[a,{tint:o,contrast:c,roughness:l,roughnessRange:u,pattern:d}]of s.entries())for(let s=0;s<e;s++)for(let f=0;f<e;f++){let p=d(f*2*Math.PI/e,s*2*Math.PI/e),m=a*t+(s*e+f)*n;for(let e=0;e<3;e++)r[m+e]=i(o[e]*(1+c*p)/1.33);r[m+3]=i(l-u*p)}let a=[r];for(let t=e;t>1;t/=2){let e=a.at(-1),r=t/2,i=t*n,o=r*r*n,c=new Uint8Array(o*s.length);for(let a=0;a<s.length;a++){let s=a*t*i,l=a*o;for(let t=0;t<r;t++)for(let a=0;a<r;a++)for(let o=0;o<n;o++){let u=s+2*t*i+2*a*n+o,d=l+(t*r+a)*n+o;c[d]=Math.round((e[u]+e[u+n]+e[u+i]+e[u+i+n])/4)}}a.push(c)}return a}var d=n*s.length*(4**t-1)/3;function f(r){let i=s.length,a=r.createTexture({label:`NRX atlas materials`,size:[e,e,i],mipLevelCount:t,format:`rgba8unorm`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});try{l??=u();for(let[t,o]of l.entries()){let s=e>>t;r.queue.writeTexture({texture:a,mipLevel:t},o,{bytesPerRow:n*s,rowsPerImage:s},[s,s,i])}return a}catch(e){throw a.destroy(),e}}var p=24,m=40,h=20,g=`rgba16float`,_=`depth24plus`,v=4,y={color:{operation:`add`,srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`},alpha:{operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`}},b=`
struct Frame {
 viewProjection:mat4x4<f32>,
 eye:vec4<f32>,
}
struct Object {
 model:mat4x4<f32>,
 normalX:vec4<f32>,
 normalY:vec4<f32>,
 normalZ:vec4<f32>,
 color:vec4<f32>,
 material:vec4<f32>,
 emissive:vec4<f32>,
}
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read> objects:array<Object>;
@group(0) @binding(2) var tissueMap:texture_2d_array<f32>;
@group(0) @binding(3) var tissueSampler:sampler;
struct Raster {
 @builtin(position) clip:vec4<f32>,
 @location(0) world:vec3<f32>,
 @location(1) normal:vec3<f32>,
 @location(2) tint:vec4<f32>,
 @location(3) @interpolate(flat) objectIndex:u32,
 @location(4) localPosition:vec3<f32>,
 @location(5) localNormal:vec3<f32>,
}
@vertex fn vs(@location(0) position:vec3<f32>,@location(1) normal:vec4<f32>,
 @location(2) tint:vec4<f32>,@builtin(instance_index) index:u32)->Raster{
 let object=objects[index];
 let world=object.model*vec4<f32>(position,1);
 let normalMatrix=mat3x3<f32>(object.normalX.xyz,object.normalY.xyz,object.normalZ.xyz);
 return Raster(frame.viewProjection*world,world.xyz,normalMatrix*normal.xyz,tint,index,position,normal.xyz);
}

fn tissueMaterial(p:vec3<f32>,dx:vec3<f32>,dy:vec3<f32>,normal:vec3<f32>,layer:i32)->vec4<f32>{
 let axes=max(abs(normal),vec3<f32>(.0001));
 let weighted=axes*axes*axes*axes;
 let weights=weighted/dot(weighted,vec3<f32>(1));
 return weights.x*textureSampleGrad(tissueMap,tissueSampler,p.yz,layer,dx.yz,dy.yz)+
        weights.y*textureSampleGrad(tissueMap,tissueSampler,p.zx,layer,dx.zx,dy.zx)+
        weights.z*textureSampleGrad(tissueMap,tissueSampler,p.xy,layer,dx.xy,dy.xy);
}

// The workbench uses white ambient, key and fill lights. Evaluate its standard
// diffuse and GGX response in linear light before compositing source opacity.
fn direct(light:vec3<f32>,intensity:f32,n:vec3<f32>,v:vec3<f32>,
 diffuse:vec3<f32>,f0:vec3<f32>,roughness:f32)->vec3<f32>{
 let nl=max(dot(n,light),0);
 let nv=max(dot(n,v),0);
 if(nl<=0){return vec3<f32>(0);}
 let halfRay=normalize(light+v);
 let nh=max(dot(n,halfRay),0);
 let vh=clamp(dot(v,halfRay),0,1);
 let alpha2=pow(roughness,4);
 let term=nh*nh*(alpha2-1)+1;
 let distribution=alpha2/(3.14159265*max(term*term,1e-7));
 let visibility=.5/max(nl*sqrt(nv*nv*(1-alpha2)+alpha2)+
                        nv*sqrt(nl*nl*(1-alpha2)+alpha2),1e-6);
 let fresnel=mix(f0,vec3<f32>(1),exp2((-5.55473*vh-6.98316)*vh));
 return (diffuse+fresnel*visibility*distribution)*(intensity*nl);
}
@fragment fn fs(input:Raster,@builtin(front_facing) front:bool)->@location(0) vec4<f32>{
 let object=objects[input.objectIndex];
 let tissueDx=dpdx(input.localPosition);
 let tissueDy=dpdy(input.localPosition);
 let vertexTint=select(vec4<f32>(1),input.tint,object.material.w>.5);
 var base=object.color.rgb*vertexTint.rgb;
 var opacity=object.color.a*vertexTint.a;
 if(object.emissive.w>0 && opacity<=object.emissive.w){discard;}
 // Like the source opaque materials, vary COLOR_0 alpha only when blending.
 if(object.normalX.w<.5){opacity=1;}else if(opacity<=0){discard;}
 if(object.material.z>.5){return vec4<f32>(base,opacity);}
 let n=normalize(select(-input.normal,input.normal,front));
 let v=normalize(frame.eye.xyz-input.world);
 var roughness=max(object.material.x,.0525);
 let tissueScale=object.normalZ.w;
 if(tissueScale>0){
  let layer=i32(object.normalY.w)-1;
  let tissue=tissueMaterial(input.localPosition*tissueScale,tissueDx*tissueScale,tissueDy*tissueScale,input.localNormal,layer);
  base*=tissue.rgb*1.33;
  roughness=tissue.a;
 }
 let metal=object.material.y;
 let diffuse=base*(1-metal)/3.14159265;
 let f0=mix(vec3<f32>(.04),base,metal);
 let lit=diffuse*1.1+direct(normalize(vec3<f32>(3,5,4)),2.2,n,v,diffuse,f0,roughness)+
         direct(normalize(vec3<f32>(-4,2,-3)),.9,n,v,diffuse,f0,roughness)+object.emissive.rgb;
 return vec4<f32>(lit,opacity);
}
`,x=`
@group(0) @binding(0) var scene:texture_2d<f32>;
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{
 let points=array<vec2<f32>,3>(vec2<f32>(-1,1),vec2<f32>(-1,-3),vec2<f32>(3,1));
 return vec4<f32>(points[i],0,1);
}
@fragment fn fs(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{
 let source=textureLoad(scene,vec2<i32>(p.xy),0);
 if(source.a<=0){return vec4<f32>(0);}
 // ACES filmic and sRGB output use the same convention as the Three viewer.
 let toAces=mat3x3<f32>(vec3<f32>(.59719,.07600,.02840),vec3<f32>(.35458,.90834,.13383),
                        vec3<f32>(.04823,.01566,.83777));
 let fromAces=mat3x3<f32>(vec3<f32>(1.60475,-.10208,-.00327),vec3<f32>(-.53108,1.10813,-.07276),
                          vec3<f32>(-.07367,-.00605,1.07602));
 let v=toAces*(source.rgb/(.6*source.a));
 let fitted=(v*(v+.0245786)-.000090537)/(v*(.983729*v+.4329510*.983729)+.238081);
 let mapped=clamp(fromAces*fitted,vec3<f32>(0),vec3<f32>(1));
 let encoded=select(1.055*pow(mapped,vec3<f32>(.41666))-.055,12.92*mapped,mapped<=vec3<f32>(.0031308));
 return vec4<f32>(encoded*source.a,source.a);
}
`;function S(e,t){let n=new Float32Array(e.length),r=t?.length??e.length/3;for(let i=0;i+2<r;i+=3){let r=3*(t?.[i]??i),a=3*(t?.[i+1]??i+1),o=3*(t?.[i+2]??i+2),s=e[a]-e[r],c=e[a+1]-e[r+1],l=e[a+2]-e[r+2],u=e[o]-e[r],d=e[o+1]-e[r+1],f=e[o+2]-e[r+2],p=c*f-l*d,m=l*u-s*f,h=s*d-c*u;for(let e of[r,a,o])n[e]+=p,n[e+1]+=m,n[e+2]+=h}return n}function C(e,t,n){let{positions:r,colors:i,colorSize:a=3}=t;if(!r?.length||r.length%3)throw Error(`NRX atlas geometry has invalid positions.`);let o=r.length/3,{indices:s,normals:c}=t;if(s&&!(s instanceof Uint16Array||s instanceof Uint32Array)&&(s=o<=65536?Uint16Array.from(s):Uint32Array.from(s)),!c&&n!==`line-list`&&(c=S(r,s)),c&&c.length!==r.length)throw Error(`NRX atlas normal count differs from the positions.`);if(i&&(a!==3&&a!==4||i.length!==o*a))throw Error(`NRX atlas color count differs from the positions.`);let l=new ArrayBuffer(o*p),u=new Float32Array(l),d=new Int16Array(l),f=new Uint8Array(l);for(let e=0;e<o;e++){let t=e*3,n=e*p,o=c&&Math.hypot(c[t],c[t+1],c[t+2]);for(let e=0;e<3;e++)u[n/4+e]=r[t+e],d[(n+12)/2+e]=Math.round(32767*(o?c[t+e]/o:Number(e===2)));for(let t=0;t<4;t++)f[n+20+t]=i&&t<a?Math.round(255*Math.min(1,Math.max(0,i[e*a+t]))):255}let m,h;try{m=e.createBuffer({size:l.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),e.queue.writeBuffer(m,0,l);let t=s?Math.ceil(s.byteLength/4)*4:0;return s&&(h=e.createBuffer({size:t,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST,mappedAtCreation:!0}),new Uint8Array(h.getMappedRange()).set(new Uint8Array(s.buffer,s.byteOffset,s.byteLength)),h.unmap()),{vertices:m,index:h,format:s instanceof Uint32Array?`uint32`:`uint16`,count:s?.length??o,bytes:l.byteLength+t}}catch(e){throw m?.destroy(),h?.destroy(),e}}function w(e,t,n){let r=n.modelMatrix;if(r?.length!==16)throw Error(`NRX atlas object model matrix is invalid.`);let i=r[5]*r[10]-r[6]*r[9],a=r[6]*r[8]-r[4]*r[10],o=r[4]*r[9]-r[5]*r[8],s=r[9]*r[2]-r[10]*r[1],l=r[10]*r[0]-r[8]*r[2],u=r[8]*r[1]-r[9]*r[0],d=r[1]*r[6]-r[2]*r[5],f=r[2]*r[4]-r[0]*r[6],p=r[0]*r[5]-r[1]*r[4],m=r[0]*i+r[1]*a+r[2]*o<0?-1:1;e.set(r,t);let h=n.transparent??n.opacity<1,g=n.illustrativeTissue||0;return e.set([i*m,a*m,o*m,Number(h),s*m,l*m,u*m,g,d*m,f*m,p*m,c(g)],t+16),e.set([...n.color??[1,1,1],Math.min(1,n.opacity??1)],t+28),e.set([n.roughness??1,n.metalness??0,Number(n.unlit||n.topology===`line-list`),Number(n.vertexColors??!!n.geometry.colors)],t+32),e.set([...n.emissive??[0,0,0],n.alphaTest??0],t+36),m<0}function T(e,t){let n=e.modelMatrix,[r,i,a]=e.center??[n[12],n[13],n[14]];return(t[2]*r+t[6]*i+t[10]*a+t[14])/(t[3]*r+t[7]*i+t[11]*a+t[15])}async function E(e,t){let n=e.createShaderModule({code:t}),r=(await n.getCompilationInfo()).messages.filter(e=>e.type===`error`);if(r.length)throw Error(`NRX atlas shader failed: `+r.map(e=>e.message).join(`; `));return n}async function D(e,{signal:t,onLost:n}={}){if(!globalThis.navigator?.gpu)throw Error(`NRX atlas requires WebGPU.`);t?.throwIfAborted();let r=await navigator.gpu.requestAdapter({powerPreference:`high-performance`});if(t?.throwIfAborted(),!r)throw Error(`NRX atlas found no WebGPU adapter.`);let i=await r.requestDevice(),a,o,s,c,l,u,S,D=!1,O=null,k,A=new Promise(e=>{k=e}),j=new Map,M=new Map,N={residentGeometries:0,residentBytes:0,materialTextureBytes:0,submissions:0,draws:0,width:0,height:0,samples:v},P=e=>{D||O||(O=e instanceof Error?e:Error(String(e)),k(O),n?.(O))},F=e=>P(e.error?.message??`Uncaptured NRX atlas GPU error.`);i.addEventListener(`uncapturederror`,F),i.lost.then(e=>{e.reason!==`destroyed`&&P(e.message||`NRX atlas GPU device lost.`)});function I(e){e.vertices.destroy(),e.index?.destroy(),N.residentBytes-=e.bytes}function L(){if(!D){D=!0,i.removeEventListener(`uncapturederror`,F),a?.unconfigure(),c?.destroy(),l?.destroy(),u?.destroy(),S?.destroy(),o?.destroy(),s?.destroy();for(let e of j.values())I(e);j.clear(),M.clear(),N.residentGeometries=0,N.materialTextureBytes=0,i.destroy()}}try{if(t?.throwIfAborted(),a=e.getContext(`webgpu`),!a)throw Error(`NRX atlas could not acquire a WebGPU canvas.`);let n=navigator.gpu.getPreferredCanvasFormat();a.configure({device:i,format:n,alphaMode:`premultiplied`});let[r,k]=await Promise.all([E(i,b),E(i,x)]);t?.throwIfAborted();let P=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`read-only-storage`}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`,viewDimension:`2d-array`}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}}]}),F=i.createPipelineLayout({bindGroupLayouts:[P]}),R=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`unfilterable-float`}}]}),z=await i.createRenderPipelineAsync({layout:i.createPipelineLayout({bindGroupLayouts:[R]}),vertex:{module:k,entryPoint:`vs`},fragment:{module:k,entryPoint:`fs`,targets:[{format:n}]}});t?.throwIfAborted(),o=i.createBuffer({size:80,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM}),S=i.createTexture({label:`NRX atlas material placeholder`,size:[1,1],format:`rgba8unorm`,usage:GPUTextureUsage.TEXTURE_BINDING});let B=S.createView({dimension:`2d-array`});N.materialTextureBytes=4;let V=i.createSampler({addressModeU:`repeat`,addressModeV:`repeat`,minFilter:`linear`,magFilter:`linear`,mipmapFilter:`linear`}),H=new Float32Array(h),U=new Float32Array,W,G,K,q,J,Y=!0;function X(t,n,r,a){if(a&&N.materialTextureBytes!==d){let e=S;S=f(i),e.destroy(),B=S.createView(),N.materialTextureBytes=d,Y=!0}if(t!==N.width||n!==N.height){c?.destroy(),l?.destroy(),u?.destroy(),e.width=t,e.height=n;let r=[t,n];c=i.createTexture({size:r,format:g,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),l=i.createTexture({size:r,format:g,sampleCount:v,usage:GPUTextureUsage.RENDER_ATTACHMENT}),u=i.createTexture({size:r,format:_,sampleCount:v,usage:GPUTextureUsage.RENDER_ATTACHMENT}),K=c.createView(),q=l.createView(),J=u.createView(),G=i.createBindGroup({layout:R,entries:[{binding:0,resource:K}]}),N.width=t,N.height=n}let p=Math.max(1,r)*m;U.length<p&&(s?.destroy(),U=new Float32Array(Math.max(p,U.length*2)),s=i.createBuffer({size:U.byteLength,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.STORAGE}),Y=!0),Y&&=(W=i.createBindGroup({layout:P,entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:s}},{binding:2,resource:B},{binding:3,resource:V}]}),!1)}function Z(e,t,n=e.side){let a=e.topology===`line-list`?`line-list`:`triangle-list`,o=t?`cw`:`ccw`,s=a===`line-list`||n===`double`?`none`:n===`back`?`front`:`back`,c=e.transparent??e.opacity<1,l=e.depthWrite??!c,u=e.depthTest===!1?`always`:`less-equal`,d=[a,o,s,c,l,u].join(`/`);if(!M.has(d)){let e={format:g};c&&(e.blend=y),M.set(d,i.createRenderPipeline({label:`NRX atlas `+d,layout:F,vertex:{module:r,entryPoint:`vs`,buffers:[{arrayStride:p,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`snorm16x4`},{shaderLocation:2,offset:20,format:`unorm8x4`}]}]},fragment:{module:r,entryPoint:`fs`,targets:[e]},multisample:{count:v},primitive:{topology:a,frontFace:o,cullMode:s},depthStencil:{format:_,depthWriteEnabled:l,depthCompare:u}}))}return M.get(d)}function Q({viewProjection:t,cameraPosition:n,width:r=e.width,height:c=e.height,draws:l,background:u=[0,0,0,0],residentGeometries:d}){if(D||O)throw O??Error(`NRX atlas renderer is disposed.`);if(!r||!c)return!1;if(r>i.limits.maxTextureDimension2D||c>i.limits.maxTextureDimension2D)throw Error(`NRX atlas viewport exceeds the WebGPU device limit.`);if(t?.length!==16||n?.length!==3)throw Error(`NRX atlas camera is invalid.`);if(d)for(let[e,t]of j)d.has(e)||(I(t),j.delete(e));let f=[],p=[],h=!1;for(let e of l)e.visible===!1||e.opacity<=0||(h||=e.illustrativeTissue>0,e.transparent??e.opacity<1?p.push({item:e,depth:T(e,t)}):f.push(e));let g=(e,t)=>(e.renderOrder??0)-(t.renderOrder??0);f.sort(g),p.sort((e,t)=>g(e.item,t.item)||t.depth-e.depth);let _=f.concat(p.map(e=>e.item));X(r,c,_.length,h),H.set(t,0),H.set(n,16),i.queue.writeBuffer(o,0,H);let v=[];for(let[e,t]of _.entries()){let n=t.geometry,r=j.get(n);r||(r=C(i,n,t.topology),j.set(n,r),N.residentBytes+=r.bytes);let a=w(U,e*m,t),o={resource:r,first:t.start??0,count:t.count??r.count-(t.start??0),instance:e};(t.transparent??t.opacity<1)&&t.side===`double`&&t.forceSinglePass!==!0?v.push({...o,pipeline:Z(t,a,`back`)},{...o,pipeline:Z(t,a,`front`)}):v.push({...o,pipeline:Z(t,a)})}_.length&&i.queue.writeBuffer(s,0,U,0,_.length*m),N.residentGeometries=j.size;let[y,b,x,S=1]=u,E=i.createCommandEncoder(),k=E.beginRenderPass({colorAttachments:[{view:q,resolveTarget:K,loadOp:`clear`,storeOp:`discard`,clearValue:{r:y*S,g:b*S,b:x*S,a:S}}],depthStencilAttachment:{view:J,depthLoadOp:`clear`,depthStoreOp:`discard`,depthClearValue:1}}),A,M;k.setBindGroup(0,W),v.forEach(({resource:e,pipeline:t,first:n,count:r,instance:i})=>{t!==A&&(k.setPipeline(t),A=t),e!==M&&(k.setVertexBuffer(0,e.vertices),e.index&&k.setIndexBuffer(e.index,e.format),M=e),e.index?k.drawIndexed(r,1,n,0,i):k.draw(r,1,n,i)}),k.end();let P=E.beginRenderPass({colorAttachments:[{view:a.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:0,g:0,b:0,a:0}}]});return P.setPipeline(z),P.setBindGroup(0,G),P.draw(3),P.end(),i.queue.submit([E.finish()]),N.submissions++,N.draws=v.length,!0}return{render:Q,dispose:L,lost:A,stats:()=>({...N})}}catch(e){throw L(),e}}export{D as createAtlasGpu};