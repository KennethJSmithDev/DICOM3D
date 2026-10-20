const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/gaussian-splatting-pipeline-sh-C4f7bqYn.js","assets/preload-helper-CKhbhPgO.js","assets/typed-arrays-B2JZIDLp.js","assets/camera-aDkjLH4y.js","assets/multiply-mat4-into-buffer-DfBnM-FI.js","assets/gpu-flags-C1xPl_f9.js","assets/engine-KxBmuJ5G.js","assets/lite-error-CbM31Lpb.js","assets/_matrix-allocator-lS7uVVV-.js","assets/render-target-signature-B-9UVrB_.js","assets/scene-helpers-CipkisDJ.js","assets/gaussian-splatting-pipeline-CyYfPlU--Cjfs55Lb.js","assets/scene-node-D7imXKRU.js","assets/compose-mat4-into-buffer-DVi8_Yl-.js"])))=>i.map(i=>d[i]);
import{t as e}from"./preload-helper-CKhbhPgO.js";import{t}from"./gltf-parser-oG-w_Wko.js";import{c as n,i as r,n as i}from"./gaussian-splatting-pipeline-CyYfPlU--Cjfs55Lb.js";var a=`(() => {
	function w(c, s, o, a, j) {
		const m = o[0], u = o[1], b = o[2], d = o[3], f = j[0];
		let r = 1 / 0, g = -1 / 0;
		for (let t = 0; t < s; t++) {
			f[t] = m * c[3 * t] + u * c[3 * t + 1] + b * c[3 * t + 2] + d;
			const n = f[t];
			n - n === 0 && (n < r && (r = n), n > g && (g = n));
		}
		const h = g - r;
		if (!(h > 1e-12)) {
			for (let t = 0; t < s; t++) a[t] = t;
			return;
		}
		const e = j[1];
		e.fill(0);
		const i = e.length - 1, p = i / h;
		for (let t = 0; t < s; t++) {
			const n = f[t];
			let l;
			n - n === 0 ? (l = (n - r) * p | 0, l > i && (l = i)) : l = i, f[t] = l, e[l]++;
		}
		let M = 0;
		for (let t = i; t >= 0; t--) {
			const n = e[t];
			e[t] = M, M += n;
		}
		for (let t = 0; t < s; t++) {
			const n = f[t];
			a[e[n]++] = t;
		}
	}
	let y, k;
	self.onmessage = (c) => {
		const s = c.data;
		if (s.p) {
			y = s.p;
			const a = y.length / 3;
			k = [new Float32Array(a), new Uint32Array(1 << Math.max(10, Math.min(20, Math.round(Math.log2(a / 4)))))];
			return;
		}
		const o = s.o;
		w(y, o.length, s.t, o, k), self.postMessage({ o }, [o.buffer]);
	};
})();

//# sourceMappingURL=splat-sort-worker-BUzRUbNz.js.map`,o=typeof self<`u`&&self.Blob&&new Blob([`URL.revokeObjectURL(import.meta.url);`,a],{type:`text/javascript;charset=utf-8`});function s(e){let t;try{if(t=o&&(self.URL||self.webkitURL).createObjectURL(o),!t)throw``;let n=new Worker(t,{type:`module`,name:e?.name});return n.addEventListener(`error`,()=>{(self.URL||self.webkitURL).revokeObjectURL(t)}),n}catch{return new Worker(`data:text/javascript;charset=utf-8,`+encodeURIComponent(a),{type:`module`,name:e?.name})}}async function c(t,a,o,c){let l=n(o.data),u=new s({name:`babylon-lite-splat-sort`}),d=t.surface.engine,f=r(d,a,l,u,o);if(o.sh&&o.shDegree&&o.shDegree>0){let{attachGaussianSplattingMeshSH:n}=await e(async()=>{let{attachGaussianSplattingMeshSH:e}=await import(`./gaussian-splatting-pipeline-sh-C4f7bqYn.js`);return{attachGaussianSplattingMeshSH:e}},__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13]));n(t,f,o.sh,c)}else i(t,f,c);return f}var l=`KHR_gaussian_splatting`,u=`KHR_gaussian_splatting:ROTATION`,d=`KHR_gaussian_splatting:SCALE`,f=`KHR_gaussian_splatting:OPACITY`,p=`KHR_gaussian_splatting:SH_DEGREE_0_COEF_0`,m=5120,h=5121,g=5122,_=5123,v=5125,y=5126,b={[m]:1,[h]:1,[g]:2,[_]:2,[v]:4,[y]:4},x=.28209479177387814,S=32;function C(e){return e<=0?0:e>=255?255:e+.5|0}function w(e){if(e?.extensions?.[l])return!0;let t=e?.attributes;if(!t)return!1;for(let e in t)if(e.startsWith(l+`:`))return!0;return!1}function T(e,n,r){let i=e.accessors[r],a=t[i.type]??1,o=i.count,s=new Float32Array(o*a);if(i.bufferView===void 0)return s;let c=e.bufferViews[i.bufferView],l=i.componentType,u=b[l]??4,d=a*u,f=c.byteStride??d,p=!!i.normalized,x=n.byteOffset+(c.byteOffset??0)+(i.byteOffset??0),S=new DataView(n.buffer);for(let e=0;e<o;e++){let t=x+e*f;for(let n=0;n<a;n++){let r=t+n*u,i;switch(l){case y:i=S.getFloat32(r,!0);break;case h:i=p?S.getUint8(r)/255:S.getUint8(r);break;case m:i=p?Math.max(S.getInt8(r)/127,-1):S.getInt8(r);break;case _:i=p?S.getUint16(r,!0)/65535:S.getUint16(r,!0);break;case g:i=p?Math.max(S.getInt16(r,!0)/32767,-1):S.getInt16(r,!0);break;case v:i=S.getUint32(r,!0);break;default:i=S.getFloat32(r,!0)}s[e*a+n]=i}}return s}function E(e,t,n){let r=n.attributes,i=T(e,t,r.POSITION),a=i.length/3|0,o=r[d]===void 0?null:T(e,t,r[d]),s=r[u]===void 0?null:T(e,t,r[u]),c=r[f]===void 0?null:T(e,t,r[f]),l=r[p]===void 0?null:T(e,t,r[p]),m=r.COLOR_0===void 0?null:T(e,t,r.COLOR_0),h=m?m.length/a|0:0,g=new ArrayBuffer(S*a),_=new Float32Array(g),v=new Uint8Array(g);for(let e=0;e<a;e++){let t=e*8,n=e*S,r=e*3;if(_[t+0]=i[r+0],_[t+1]=i[r+1],_[t+2]=i[r+2],_[t+3]=o?o[r+0]:1,_[t+4]=o?o[r+1]:1,_[t+5]=o?o[r+2]:1,l)v[n+24]=C((.5+x*l[r+0])*255),v[n+25]=C((.5+x*l[r+1])*255),v[n+26]=C((.5+x*l[r+2])*255);else if(m){let t=e*h;v[n+24]=C(m[t+0]*255),v[n+25]=C(m[t+1]*255),v[n+26]=C(m[t+2]*255)}else v[n+24]=255,v[n+25]=255,v[n+26]=255;c?v[n+27]=C(c[e]*255):m&&h>=4?v[n+27]=C(m[e*h+3]*255):v[n+27]=255;let a=e*4,u=s?s[a+0]:0,d=s?s[a+1]:0,f=s?s[a+2]:0,p=s?s[a+3]:1;v[n+28]=C(p*127.5+127.5),v[n+29]=C(u*127.5+127.5),v[n+30]=C(d*127.5+127.5),v[n+31]=C(f*127.5+127.5)}return g}var D={id:l,async preParse(e){let t=[],n=e.meshes??[];for(let e=0;e<n.length;e++){let r=n[e],i=r?.primitives;if(!i?.length)continue;let a=[];for(let n=0;n<i.length;n++){let o=i[n];w(o)?t.push({name:`${r.name??`splat`}_${e}_${n}`,attributes:o.attributes}):a.push(o)}r.primitives=a}t.length&&(e.__gsSplats=t)},async applyAsset(e,t,n){let r=n._json.__gsSplats;if(!r?.length)return{};let i=r.map(e=>({name:e.name,buffer:E(n._json,n._binChunk,e)})),a=[];return{_sceneSetup:e=>{for(let t of i)a.push(c(e,t.name,{data:t.buffer}).then(e=>(e.rotation.z=Math.PI,e)))},_gaussianSplats:a}}};export{D as default};