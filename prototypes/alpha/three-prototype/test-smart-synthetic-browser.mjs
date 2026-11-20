import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';

const playwrightModule = process.env.DICOM3D_PLAYWRIGHT_MODULE;
const files = new Set(['smart-synthetic.mjs','fhir-evidence-projection.mjs','ct-frame.mjs',
  'imaging-core.mjs','imaging-primitives.mjs','imaging-contract.mjs','ct-spatial.mjs','smart-pkce.mjs']);
const origin = 'https://viewer.smart.synthetic.invalid';

test('synthetic launch executes in headed Edge with no server or external requests',
  {skip:playwrightModule ? false : 'DICOM3D_PLAYWRIGHT_MODULE is not set',timeout:60000}, async () => {
    const {chromium} = await import(pathToFileURL(playwrightModule).href);
    const browser = await chromium.launch({channel:'msedge',headless:false,args:['--disable-background-networking']});
    const errors = [], requests = [];
    try {
      const page = await browser.newPage({viewport:{width:1280,height:800}});
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        requests.push(url.href);
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/') return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Offline synthetic SMART witness</title><h1>Offline synthetic SMART witness</h1>'});
        const name = url.pathname.slice(1);
        if (!files.has(name) || url.search || url.hash) return route.abort();
        const body = await readFile(new URL(`../viewer/src/${name}`,import.meta.url));
        return route.fulfill({status:200,contentType:'text/javascript',body});
      });
      await page.goto(`${origin}/`);
      const result = await page.evaluate(async () => {
        const {createSyntheticSmartHarness,syntheticPkceS256} = await import('/smart-synthetic.mjs');
        const vector = await syntheticPkceS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
        let cases = 0, networkAttempts = 0, rejectedReplay = 0;
        window.fetch = () => { networkAttempts++; throw new Error('unexpected network'); };
        for (const fhirVersion of ['4.0.1','4.3.0','5.0.0']) for (const persona of ['patient','clinician']) for (const launchKind of ['ehr','standalone']) {
          const harness = createSyntheticSmartHarness();
          const request = await harness.begin({tenantKey:'synthetic-a',persona,launchKind,fhirVersion});
          const cb = harness.issueSyntheticCode(request.authorizationRequest);
          const session = await harness.complete(cb);
          try { await harness.complete(cb); } catch (error) { if (error.code === 'INVALID_CALLBACK') rejectedReplay++; else throw error; }
          const study = {resourceType:'ImagingStudy',id:'synthetic-study-a',status:'available',subject:{reference:session.patientRef}};
          const bundle = {resourceType:'Bundle',type:'collection',entry:[{fullUrl:`${session.fhirBase}/ImagingStudy/synthetic-study-a`,resource:study}]};
          const ref = harness.clinicalStudyReference(session,bundle,'synthetic-study-a');
          if (harness.viewerStudyInput(session,ref).kind !== 'metadata-only') throw new Error('unexpected viewer input');
          cases++;
        }
        return {secureContext:window.isSecureContext,vector,cases,networkAttempts,rejectedReplay};
      });
      assert.deepEqual(result,{secureContext:true,vector:'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',cases:12,networkAttempts:0,rejectedReplay:12});
      assert.deepEqual(errors,[]);
      assert.ok(requests.every(value => new URL(value).origin === origin));
      assert.equal(requests.length,files.size + 1);
      console.log(`Edge ${browser.version()}, headed 1280x800; 12 synthetic cases; ${requests.length} fulfilled local requests; no server.`);
    } finally { await browser.close(); }
  });
