// Read-only loopback host over the exact admitted frontend inventory.
// An explicitly configured FHIR source can serve allowlisted study metadata.
import {createServer} from 'node:http';
import {readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {loadLoopbackFhirRoute,LOOPBACK_FHIR_PREFIX} from '../docker/core/fhir-loopback-route.mjs';
import {readVerifiedFile,createResponseGate} from './preview-verified-file.mjs';
import {liveH000Prefix,loadLiveH000Route} from './live-h000-ct.mjs';
import {nativeImagePrefix,loadLiveNativeImages} from './live-native-images.mjs';
const option=(n,f)=>{const i=process.argv.indexOf(n);return i<0?f:process.argv[i+1];};
const root=realpathSync(resolve(option('--root','.'))),port=Number(option('--port','0'));
if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid loopback port');
const instance=option('--instance',null);
if(instance!==null&&!/^[a-f0-9]{32}$/.test(instance))throw Error('Invalid preview identity');
const manifestBytes=readFileSync(resolve(root,'demo-build-manifest.json'));
const manifest=JSON.parse(manifestBytes.toString('utf8'));
const alpha=manifest.schema==='dicom3d-alpha-distribution-1'&&manifest.profile==='three-r3f-alpha';
const base=alpha&&manifest.entrypoint==='/dicom3d/reference.html'?'/dicom3d/':manifest.entrypoint;
if(!['/DICOM3D/','/dicom3d/'].includes(base))throw Error('Unadmitted base');
const files=new Map();
for(const [name,record]of Object.entries(manifest.files)){
 const path=realpathSync(resolve(root,name));if(!path.startsWith(root+sep))throw Error('Inventory escaped build');
 readVerifiedFile(path,record);
 files.set(base+name,{path,record});
}
files.set(base+'demo-build-manifest.json',{path:resolve(root,'demo-build-manifest.json'),bytes:manifestBytes});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm'};
const admitResponse=createResponseGate();
const server=createServer();
async function servePreview(liveFhir,liveCt,liveNativeImages,req,res){
 for(const [k,v]of Object.entries({'X-Content-Type-Options':'nosniff','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store'}))res.setHeader(k,v);
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let path;try{path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname)}catch{res.writeHead(400);res.end();return;}
 if(path==='/healthz'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({product:'DICOM3D',version:manifest.release,status:'ok',...(alpha?{frontend:'three-r3f'}:{backend:'babylon'}),sourceProfile:manifest.profile??manifest.buildProfile}));return;}
 if(path.startsWith(liveH000Prefix)){
  if(!liveCt){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'LIVE_CT_NOT_CONFIGURED'}));return;}
  await liveCt(req,res,path);
  return;
 }
 if(path.startsWith(nativeImagePrefix)){
  if(!liveNativeImages){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'LIVE_IMAGES_NOT_CONFIGURED'}));return;}
  await liveNativeImages(req,res,path);
  return;
 }
 if(path.startsWith(LOOPBACK_FHIR_PREFIX)){
  if(!liveFhir){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'LIVE_FHIR_NOT_CONFIGURED'}));return;}
  try{await liveFhir(req,res,path)}catch{if(!res.headersSent){res.writeHead(500,{'Cache-Control':'no-store'});res.end()}else res.destroy()}
  return;
 }
 if(path==='/'||path===base)path=base+'index.html';
 const file=files.get(path);if(!file){res.writeHead(404);res.end();return;}
 if(!await admitResponse(res)){if(!res.destroyed){res.writeHead(503,{'Retry-After':'1'});res.end('Preview busy');}return;}
 let bytes;try{bytes=file.bytes??readVerifiedFile(file.path,file.record)}catch{res.writeHead(409);res.end('Preview file no longer matches its admitted inventory');return;}
 res.writeHead(200,{'Content-Type':mime[extname(file.path)]??'application/octet-stream','Content-Length':bytes.length});
 res.end(req.method==='HEAD'?undefined:bytes);
}
server.listen(port,'127.0.0.1',()=>{
 // The OS chooses the exact origin when --port 0 is requested.
 const boundPort=server.address().port;
 let liveFhir,liveCt,liveNativeImages;
 try{
  liveFhir=loadLoopbackFhirRoute(process.env.DICOM3D_LIVE_FHIR_CONFIG,boundPort);
  liveCt=loadLiveH000Route(process.env.DICOM3D_LIVE_H000_CONFIG,boundPort);
  liveNativeImages=loadLiveNativeImages(process.env.DICOM3D_LIVE_NATIVE_IMAGES_CONFIG,boundPort);
 }catch{console.error('Invalid imaging bridge configuration');process.exitCode=1;server.close();return;}
 server.on('request',(req,res)=>servePreview(liveFhir,liveCt,liveNativeImages,req,res));
 const url=`http://127.0.0.1:${boundPort}${base}`;
 const stateFile=option('--state',null);
 const state={owner:'DICOM3D operator preview',pid:process.pid,url,root,script:realpathSync(process.argv[1]),base,startedUtc:new Date().toISOString(),node:process.execPath,requestedPort:port,instance,stateFile:stateFile?resolve(stateFile):null};
 if(stateFile)writeFileSync(stateFile,JSON.stringify(state,null,2));
 console.log(JSON.stringify(state));
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
