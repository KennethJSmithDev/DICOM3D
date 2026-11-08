import {createHash} from 'node:crypto';
// Backport missing-global guards in the actual published r180 entry bundles and
// their source equivalents. No fake WebCodecs API or dependency/security change.
const pins={
  "/three/src/renderers/common/Textures.js": "47b8c045d7d400db92e4a19c51032c876dfd961743ebd51c3770955f98695edd",
  "/three/src/textures/Source.js": "54d1056f3ad8f29846b83a448ea5df6a84004bc7b2e35d4286cb0b928d093439",
  "/three/build/three.webgpu.js": "c6b225365368fc052bd96ebfae1363324ea526e59f15a60e201e1257c3adc12f",
  "/three/build/three.core.js": "eb077d2417f61d3e6d9264c317cabc4ea35769ed6b0ab533067292a550784c20"
};
export function threeTextureCompatibility(){const seen=new Set();return {name:'dicom3d-three-r180-videoframe-guard',enforce:'pre',transform(code,id){
 const path=id.split('?')[0].replaceAll('\\','/'),entry=Object.entries(pins).find(([suffix])=>path.endsWith(suffix));if(!entry)return null;
 const [name,pin]=entry,source=code.replaceAll('\r\n','\n');
 if(createHash('sha256').update(source).digest('hex')!==pin)throw Error('Three texture compatibility source changed; requalify the backport');
 const pattern=/\b(image|data) instanceof VideoFrame\b/g;if([...source.matchAll(pattern)].length!==1)throw Error('Expected exactly one pinned VideoFrame check');seen.add(name);
 return {code:source.replace(pattern,"typeof VideoFrame !== 'undefined' && $1 instanceof VideoFrame"),map:null};
},generateBundle(){if(!seen.has('/three/build/three.webgpu.js')||!seen.has('/three/build/three.core.js'))throw Error('Actual Three entry bundles were not compatibility-patched')}}}
