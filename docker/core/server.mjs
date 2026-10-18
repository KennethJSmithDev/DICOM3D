// Copyright 2026 KennethJSmithDev. Apache-2.0.
// Read-only static Core host. No upload, authentication or clinical APIs.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
const root = resolve('/app/public');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm'};
const server = createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (pathname === '/healthz') {
      await stat(resolve(root,'reference.html'));
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:'{"service":"dicom3d-core","status":"ok"}');return;
    }
    if (pathname === '/' || pathname === '/dicom3d/' || pathname === '/dicom3d') {
      res.writeHead(302,{Location:'/dicom3d/reference.html','Cache-Control':'no-store'});res.end();return;
    }
    if (!pathname.startsWith('/dicom3d/')) {res.writeHead(404);res.end();return;}
    const file = resolve(root,pathname.slice('/dicom3d/'.length));
    if (!file.startsWith(root+sep)) {res.writeHead(404);res.end();return;}
    const s = await stat(file);
    if (!s.isFile()) {res.writeHead(404);res.end();return;}
    const immutable = /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(pathname);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':s.size,'Cache-Control':immutable?'public, max-age=31536000, immutable':'no-cache'});
    if (req.method==='HEAD') res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  } catch {res.writeHead(404);res.end();}
});
server.listen(8080,'0.0.0.0',()=>console.log('DICOM3D Core: /dicom3d/reference.html'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
