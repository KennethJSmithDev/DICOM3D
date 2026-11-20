// Copyright 2026 KennethJSmithDev. Apache-2.0.
// Configured FHIR access binds the whole host to loopback so request credentials stay local.
import {createServer} from 'node:http';
import {createReadStream, readFileSync, realpathSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve, extname, sep, relative, isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadLoopbackFhirRoute, LOOPBACK_FHIR_PREFIX} from './fhir-loopback-route.mjs';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm'};

export function createCoreServer({publicRoot='/app/public', port=8080, configPath, fetchImpl}={}) {
  const root = resolve(publicRoot);
  if (configPath) {
    const fromRoot = relative(realpathSync(root), realpathSync(configPath));
    if (fromRoot !== '..' && !fromRoot.startsWith('..'+sep) && !isAbsolute(fromRoot)) {
      throw new Error('The FHIR configuration must be outside the served directory');
    }
  }
  const distribution = JSON.parse(readFileSync(resolve(root,'distribution-manifest.json'),'utf8'));
  const liveFhir = loadLoopbackFhirRoute(configPath, port, fetchImpl);
  const hostname = liveFhir ? '127.0.0.1' : '0.0.0.0';
  const server = createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    try {
      const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if (pathname.startsWith(LOOPBACK_FHIR_PREFIX)) {
        if (liveFhir) { await liveFhir(req,res,pathname); return; }
        res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
        res.end(req.method==='HEAD'?undefined:JSON.stringify({error:'LIVE_FHIR_NOT_CONFIGURED'}));return;
      }
      if (pathname === '/healthz') {
        await stat(resolve(root,'reference.html'));
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
        res.end(req.method==='HEAD'?undefined:JSON.stringify({product:'DICOM3D',service:'dicom3d-core',version:distribution.version,status:'ok',clinicalUse:false}));return;
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
  return {server, port, hostname};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {server, port, hostname} = createCoreServer({configPath:process.env.DICOM3D_LIVE_FHIR_CONFIG});
  server.listen(port, hostname, ()=>console.log('DICOM3D Core: /dicom3d/reference.html'));
  process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
  process.on('SIGINT',()=>server.close(()=>process.exit(0)));
}
