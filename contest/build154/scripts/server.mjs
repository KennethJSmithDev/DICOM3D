// DICOM3D contest recovery adapter. Uses the retained Native005 production and viewer.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash, timingSafeEqual} from 'node:crypto';

const configPath = process.argv[process.argv.indexOf('--config') + 1];
if (!process.argv.includes('--config')) throw Error('A private configuration file is required');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const origin = `http://127.0.0.1:${config.port}`;
const root = path.resolve(config.viewerRoot);
const sourceRefs = ['Observation/r5p-h000-mask-volume', 'ImagingSelection/r5p-h000-segment-1'];
const reviewRefs = ['ImagingStudy/synthetic-ct', 'ImagingStudy/synthetic-seg', 'ImagingSelection/synthetic-seg-selection'];
const password = (await fs.readFile(config.passwordFile, 'utf8')).trim();
const expectedAuth = createHash('sha256').update('Basic '+Buffer.from(`${config.username}:${password}`).toString('base64')).digest();
let active = false;
let requests = 0;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary'};

async function log(event) {
  await fs.appendFile(config.eventLog, JSON.stringify({utc:new Date().toISOString(), ...event})+'\n');
}

function authenticated(request) {
  const received = createHash('sha256').update(request.headers.authorization ?? '').digest();
  return timingSafeEqual(expectedAuth, received);
}

function invoke(scenario) {
  const question = scenario === 'explain-h000'
    ? 'Explain the verified H000 lung mass segmentation measurement for a research user. Use the authorized evidence and selection tools. Return a concise source-linked research explanation.'
    : '';
  const literal = value => '"'+value.replaceAll('"','""')+'"';
  const script = [
    'Set req=##class(Native005.Request).%New()',
    `Set req.Scenario="${scenario === 'explain-h000' ? 'native-explain' : 'synthetic-mismatch'}"`,
    scenario === 'explain-h000' ? `Set req.Question=${literal(question)}` : 'Set req.Question=##class(Native005.SyntheticTools).ReadEvidence().%ToJSON()',
    'Set c049ReviewCounterBefore=$Get(^Native005Review,0)',
    'Set sc=##class(Ens.Director).CreateBusinessService("Entry",.entry)',
    'If $SYSTEM.Status.IsError(sc) { Write "C049_ERROR:ENTRY",! Halt }',
    'Set sc=entry.ProcessInput(req,.resp,.hint)',
    'If $SYSTEM.Status.IsError(sc) { Write "C049_ERROR:PROCESS",! Halt }',
    'If \'$IsObject(resp) { Write "C049_ERROR:RESPONSE",! Halt }',
    'Set result=##class(%DynamicObject).%New()',
    'Do result.%Set("status",resp.Status),result.%Set("semanticId",resp.SemanticId)',
    'Do result.%Set("explanation",resp.Explanation),result.%Set("limitation",resp.Limitation)',
    'If resp.Citations\'="" Do result.%Set("citations",##class(%DynamicArray).%FromJSON(resp.Citations))',
    'Set c049ReviewCounterAfter=$Get(^Native005Review,0)',
    // ObjectScript evaluates binary operators left-to-right: group the addition.
    'If c049ReviewCounterAfter=(c049ReviewCounterBefore+1) Do result.%Set("review",##class(%DynamicObject).%FromJSON(^Native005Review(c049ReviewCounterAfter)))',
    // IRIS terminal Write otherwise performs its legacy character conversion.
    // Preserve the internal Unicode JSON as UTF-8 before the Docker stdout boundary.
    'Write "C049_LIVE_RESPONSE:"_$ZConvert(result.%ToJSON(),"O","UTF8"),!',
    'Halt',
  ].join('\n')+'\n';
  return new Promise((resolve, reject) => {
    const process = spawn('docker.exe', ['exec','--user','51773','-i',config.container,'iris','session','IRIS','-U','USER'], {windowsHide:true});
    const output = [];
    const errors = [];
    const timer = setTimeout(() => {process.kill(); reject(Error('Bounded Interoperability request timed out'));}, 300000);
    process.stdout.on('data', chunk => output.push(chunk));
    process.stderr.on('data', chunk => errors.push(chunk));
    process.on('error', error => {clearTimeout(timer); reject(error);});
    process.on('close', code => {
      clearTimeout(timer);
      try {
        if (code !== 0) throw Error('IRIS session exited '+code);
        const text = new TextDecoder('utf-8', {fatal:true}).decode(Buffer.concat(output));
        const match = text.match(/C049_LIVE_RESPONSE:(\{[^\r\n]*\})/);
        if (!match) throw Error('IRIS did not return the response envelope');
        resolve(JSON.parse(match[1]));
      } catch (error) {reject(error);}
    });
    process.stdin.end(script, 'utf8');
  });
}

function validate(result, action) {
  if (action === 'explain-h000') {
    if (result.status !== 'ACCEPTED' || result.semanticId !== 'lesion.lung.mass.001' ||
        JSON.stringify(result.citations) !== JSON.stringify(sourceRefs) || !result.explanation || !result.limitation)
      throw Error('Unsupported explanation withheld');
  } else {
    const review = result.review;
    if (!review || review.status !== 'REVIEW_REQUESTED' || review.semanticId !== 'synthetic.structure.001' ||
        JSON.stringify(review.evidenceReferences) !== JSON.stringify(reviewRefs) || review.syntheticOnly !== 1)
      throw Error('Unverified review outcome withheld');
  }
}

const server = http.createServer(async (request, response) => {
  response.setHeader('Cache-Control','no-store');
  response.setHeader('X-Content-Type-Options','nosniff');
  const url = new URL(request.url, origin);
  try {
    if ((url.pathname.startsWith("/api/") || url.pathname === "/healthz") && !authenticated(request)) {
      response.writeHead(401, {'WWW-Authenticate':'Basic realm="DICOM3D contest workflow"'});
      response.end(); return;
    }
    if (request.method === 'GET' && url.pathname === '/healthz') {
      response.writeHead(200, {'Content-Type':'application/json'});
      response.end(JSON.stringify({status:'ready',frontend:'qualified Babylon Lite',requests,active})); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/c049/workflow') {
      if (request.headers.origin !== origin || request.headers.host !== `127.0.0.1:${config.port}`) {
        response.writeHead(403); response.end(); return;
      }
      if (active || requests >= 4) {response.writeHead(409); response.end(); return;}
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 128) {response.writeHead(413); response.end(); return;}
      }
      const {action} = JSON.parse(body);
      if (!['explain-h000','synthetic-mismatch'].includes(action)) {response.writeHead(400); response.end(); return;}
      active = true;
      requests++;
      const start = Date.now();
      try {
        await log({phase:'start',action,request:requests});
        const result = await invoke(action);
        validate(result,action);
        if (action === "explain-h000") delete result.review;
        const bytes = Buffer.from(JSON.stringify(result));
        await fs.writeFile(path.join(config.evidenceRoot, action+'-response.json'),bytes);
        response.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
        response.end(bytes);
        await log({phase:'validated',action,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),elapsedMs:Date.now()-start});
      } finally {active=false;}
      return;
    }
    if (request.method !== 'GET') {response.writeHead(405); response.end(); return;}
    if (url.pathname === '/contest-bridge.js') {
      response.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8'});
      response.end(await fs.readFile(new URL('./bridge.js', import.meta.url))); return;
    }
    if (!url.pathname.startsWith('/DICOM3D/')) {response.writeHead(404); response.end(); return;}
    const relative = decodeURIComponent(url.pathname.slice('/DICOM3D/'.length)) || 'index.html';
    const full = path.resolve(root, relative);
    if (!full.startsWith(root+path.sep)) {response.writeHead(403); response.end(); return;}
    let bytes = await fs.readFile(config.assetOverrides?.[relative] ?? full);
    if (['index.html','reference.html'].includes(relative))
      bytes = Buffer.from(bytes.toString('utf8').replace('</body>','<script src="/contest-bridge.js" defer></script></body>'));
    response.writeHead(200, {'Content-Type':mime[path.extname(full)] ?? 'application/octet-stream'});
    response.end(bytes);
  } catch (error) {
    await log({phase:'failure',path:url.pathname,error:String(error)});
    if (!response.headersSent) {response.writeHead(502, {'Content-Type':'application/json'}); response.end('{"error":"Workflow unavailable; result withheld"}');}
    else response.destroy();
  }
});
server.listen(config.port,'127.0.0.1', () => console.log(JSON.stringify({ready:true,origin,pid:process.pid})));
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
