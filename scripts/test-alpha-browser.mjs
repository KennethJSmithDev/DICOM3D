// Public-fixture UI smoke tests. Run against a built static site, never a patient directory.
// A software-rendered CI pass is not a hardware WebGPU or clinical qualification.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.DICOM3D_PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DICOM3D_TEST_URL || 'http://127.0.0.1:4173/DICOM3D/';
const output = process.env.DICOM3D_BROWSER_OUTPUT || '/tmp/dicom3d-browser-results';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'chrome', headless:false, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const results = {url, browser:browser.version(), rendererScope:'CI software WebGL2', gates:[], errors:[], badResponses:[]};
const context = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
const page = await context.newPage();
page.on('pageerror', error => results.errors.push(String(error)));
page.on('response', response => {if(response.status()>=400)results.badResponses.push({status:response.status(),url:response.url()});});
const state = () => page.locator('#runtimeState').evaluate(el=>JSON.parse(el.textContent));
async function wait(predicate, timeout=90000){await page.waitForFunction(predicate,null,{timeout});}
async function gate(name, action){await action();results.gates.push({name,status:'PASS'});console.log('PASS',name);}
try {
 await page.goto(url+'?renderer=webgl',{waitUntil:'domcontentloaded'});
 await gate('startup and skin-hidden reference',async()=>{
  await wait(()=>{const e=document.querySelector('#runtimeState');return e&&JSON.parse(e.textContent).initialReady;});
  const s=await state();assert.match(s.renderer.backend,/WebGL2/);assert.ok(s.hiddenCount>=1);assert.equal(s.loadingError,undefined);
  await page.screenshot({path:output+'/male-startup.png'});
 });
 await gate('full expanded male atlas',async()=>{
  const details=page.locator('details').filter({has:page.getByRole('button',{name:'Load complete reference',exact:true})});
  if(await details.count())await details.evaluate(e=>e.open=true);
  await page.getByRole('button',{name:'Load complete reference',exact:true}).click();
  await wait(()=>{const s=JSON.parse(document.querySelector('#runtimeState').textContent);return s.bundles.length===15&&s.owners===1186;});
  await page.screenshot({path:output+'/male-complete.png'});
 });
 await gate('female composite and source selection',async()=>{
  await page.getByRole('button',{name:'Female · composite',exact:true}).click();
  await wait(()=>{const s=JSON.parse(document.querySelector('#runtimeState').textContent);return s.femaleActive&&s.femaleOwners===1184;});
  const search=page.getByRole('textbox',{name:'Search female structures',exact:true});
  await search.fill('uterus');
  await page.locator('.structure-result').filter({hasText:/uterus/i}).first().click();
  await page.getByRole('button',{name:'Isolate selected',exact:true}).filter({visible:true}).click();
  const s=await state();assert.ok(s.femaleSelected);assert.equal(s.femaleIsolated,s.femaleSelected);
  await page.screenshot({path:output+'/female-uterus.png'});
  await page.getByRole('button',{name:'Restore female presentation',exact:true}).click();
  await search.fill('prostate');assert.equal(await page.locator('.structure-result').count(),0);
  await search.fill('heart');assert.ok(await page.locator('.structure-result').count());
  await search.fill('');
  await page.screenshot({path:output+'/female-complete.png'});
 });
 await gate('male restoration and responsive layout',async()=>{
  await page.getByRole('button',{name:'Male · BodyParts3D',exact:true}).click();
  await wait(()=>!JSON.parse(document.querySelector('#runtimeState').textContent).femaleActive);
  await page.setViewportSize({width:1024,height:768});await page.waitForTimeout(500);
  assert.ok(await page.locator('canvas').first().isVisible());
  await page.screenshot({path:output+'/laptop.png'});
  await page.setViewportSize({width:1440,height:1000});
 });
 await gate('public H000 source and segmentation',async()=>{
  await page.getByRole('button',{name:'CT + 3D',exact:true}).click();
  await page.getByRole('button',{name:'Open H000 example',exact:true}).click();
  await wait(()=>JSON.parse(document.querySelector('#runtimeState').textContent).study);
  await page.waitForTimeout(1500);
  const canvas=page.getByRole('img',{name:'Acquired CT frame 71'});
  assert.ok(await page.locator('canvas[aria-label="Acquired CT frame 71"]').count());
  const nonzero=await page.locator('canvas[aria-label="Acquired CT frame 71"]').evaluate(c=>{const b=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return b.some((v,i)=>i%4!==3&&v>0);});
  assert.equal(nonzero,true);
  await page.screenshot({path:output+'/h000.png'});
  await page.getByRole('button',{name:'Next frame',exact:true}).click();
  await wait(()=>JSON.parse(document.querySelector('#runtimeState').textContent).studyFrame===72);
  await page.getByRole('button',{name:'Close study',exact:true}).click();
 });
 await gate('explicit renderer and worker teardown',async()=>{
  await page.getByRole('button',{name:'Scientific',exact:true}).click();
  await page.getByRole('button',{name:'Unmount 3D (unloads atlas)',exact:true}).click();
  await wait(()=>{const s=JSON.parse(document.querySelector('#runtimeState').textContent);return s.renderer.active===0&&s.controls.active===0&&s.bundles.length===0;});
  results.finalState=await state();
 });
 assert.deepEqual(results.errors,[],'Uncaught page errors');
 assert.deepEqual(results.badResponses,[],'Missing requested runtime assets');
 results.status='PASS';
} catch(error) {
 results.status='FAIL';results.failure=String(error.stack||error);
 try{results.state=await state();await page.screenshot({path:output+'/failure.png'});}catch{}
 process.exitCode=1;
} finally {
 await writeFile(output+'/browser-result.json',JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results,null,2));await browser.close();
}
