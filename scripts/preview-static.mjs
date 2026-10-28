// Read-only loopback host over the exact admitted frontend inventory.
// No ingestion, credentials, original-DICOM, proxy or directory routes.
import {createServer} from 'node:http';
import {readFileSync,createReadStream,realpathSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const option=(n,f)=>{const i=process.argv.indexOf(n);return i<0?f:process.argv[i+1];};
const root=realpathSync(resolve(option('--root','.'))),port=Number(option('--port','0'));
if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid loopback port');
const manifest=JSON.parse(readFileSync(resolve(root,'demo-build-manifest.json'),'utf8')),base=manifest.entrypoint;
if(!['/DICOM3D/','/dicom3d/'].includes(base))throw Error('Unadmitted base');
const files=new Map();
for(const [name,record]of Object.entries(manifest.files)){
 const path=realpathSync(resolve(root,name));if(!path.startsWith(root+sep))throw Error('Inventory escaped build');
 const b=readFileSync(path),sha=createHash('sha256').update(b).digest('hex');
 if(b.length!==record.bytes||sha!==record.sha256)throw Error('Build inventory mismatch');
 files.set(base+name,path);
}
files.set(base+'demo-build-manifest.json',resolve(root,'demo-build-manifest.json'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.glb':'model/gltf-binary','.png':'image/png','.txt':'text/plain; charset=utf-8'};
const server=createServer((req,res)=>{
 for(const [k,v]of Object.entries({'X-Content-Type-Options':'nosniff','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store'}))res.setHeader(k,v);
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let path;try{path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname)}catch{res.writeHead(400);res.end();return;}
 if(path==='/healthz'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({product:'DICOM3D',version:manifest.release,status:'ok',backend:'babylon',sourceProfile:manifest.buildProfile}));return;}
 if(path==='/'||path===base)path=base+'index.html';
 const file=files.get(path);if(!file){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'});
 if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
});
server.listen(port,'127.0.0.1',()=>{
 const url=`http://127.0.0.1:${server.address().port}${base}`;
 const state={owner:'DICOM3D operator preview',pid:process.pid,url,root,script:realpathSync(process.argv[1]),base,startedUtc:new Date().toISOString()};
 const stateFile=option('--state',null);if(stateFile)writeFileSync(stateFile,JSON.stringify(state,null,2));
 console.log(JSON.stringify(state));
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
