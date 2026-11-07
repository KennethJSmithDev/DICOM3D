// Authenticated static-host regression: real admitted H000 bytes, fake HTTP session gate.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadPublicResearchFixture} from '../prototypes/alpha/viewer/src/public-research-loader.ts';
import {PUBLIC_RESEARCH_ASSETS} from '../prototypes/alpha/viewer/src/public-source-binding.mjs';
const originalFetch=globalThis.fetch,originalLocation=globalThis.location;
globalThis.location={href:'http://127.0.0.1:57980/dicom3d/reference.html'};
const requests=[];
globalThis.fetch=async(url,options)=>{
 requests.push({url,credentials:options.credentials,redirect:options.redirect});
 assert.equal(options.credentials,'same-origin','Native static assets need the viewer session');assert.equal(options.redirect,'error');
 const u=new URL(url);assert.equal(u.origin,'http://127.0.0.1:57980');
 const name=u.pathname.split('/').at(-1),asset=Object.values(PUBLIC_RESEARCH_ASSETS).find(a=>a.filename===name);assert(asset);
 const bytes=await readFile(new URL('../reference/public/demo/h000/'+name,import.meta.url));
 const response=new Response(bytes,{status:200,headers:{'content-length':String(bytes.length)}});Object.defineProperty(response,'url',{value:url});return response;
};
try{
 const study=await loadPublicResearchFixture('/dicom3d/');assert.equal(study.pixels.length,512*512*103);assert.equal(study.mask.length,512*512*103);assert.equal(requests.length,5);const before=requests.length;
 await assert.rejects(()=>loadPublicResearchFixture('https://unapproved.invalid/'));assert.equal(requests.length,before,'Cross-origin must reject before fetch');
 console.log(JSON.stringify({status:'PASS',authenticatedSameOriginAssets:5,originalStoredValues:study.pixels.length,crossOriginRejectedBeforeRequest:true,redirectsRejected:true,maxRssKiB:process.resourceUsage().maxRSS}));
}finally{globalThis.fetch=originalFetch;if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation}
