import{a as e,c as t,d as n,f as r,i,l as a,n as o,o as s,r as c,s as l,t as u,u as d}from"./compute-texture-binding-BciuabhW.js";import{i as f,n as p,r as m}from"./storage-buffer-CRYEf7Ze.js";async function h(h,g,_,v){let y=new Float32Array(32);y.set(v,0);for(let e=0;e<4;e++)y.set(_.slice(e*3,e*3+3),16+e*4),y[19+e*4]=1;let b=p(h,y),x=p(h,112,{writable:!0}),S=n(h,{name:`CTX-002-B diagnostic`,computeSource:`
  @group(0) @binding(0) var<storage,read> src:array<vec4<f32>>;
  @group(0) @binding(1) var<storage,read_write> dst:array<vec4<f32>>;
  @group(0) @binding(2) var image:texture_2d<f32>;
  @compute @workgroup_size(1) fn main(){
    let m=mat4x4<f32>(src[0],src[1],src[2],src[3]);
    for(var i=0u;i<4u;i++){dst[i]=m*src[4u+i];}
    dst[4]=textureLoad(image,vec2<i32>(0,0),0);
    dst[5]=textureLoad(image,vec2<i32>(287,193),0);
    dst[6]=textureLoad(image,vec2<i32>(511,511),0);
  }`,bindings:[c(`src`,{group:0,binding:0,access:`read`}),c(`dst`,{group:0,binding:1,access:`read-write`}),u(`image`,{group:0,binding:2})]}),C,w;try{return C=a(S,{src:b,dst:x,image:await o(h,g)}),w=e(h,`CTX-002-B one diagnostic`),i(w,t(S,C,{size:{x:1}})),await s(w),w.record(),l([w]),Array.from(new Float32Array(await f(x)))}finally{w?.dispose(),C&&d(C),r(S),m(b),m(x)}}export{h as checkPlaneGpu};