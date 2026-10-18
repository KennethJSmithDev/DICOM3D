import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'/.demo-dist/';
const manifest=JSON.parse(readFileSync(out+'demo-build-manifest.json'));
assert.equal(manifest.patientData,false);assert.equal(manifest.connectedServices,false);
for(const [name,value] of Object.entries(manifest.files)){const b=readFileSync(out+name);assert.equal(b.length,value.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),value.sha256);assert(!/\.(dcm|npy|npz)$/i.test(name));}
for(const [variant,count,notice] of [['bp3d-male',33,'BODYParts3D-NOTICE.txt'],['hra-female',22,'HRA-FEMALE-NOTICE.txt']]){
 const m=JSON.parse(readFileSync(out+'reference/'+variant+'.manifest.json')),b=readFileSync(out+'reference/'+m.asset.relative_filename);
 assert.equal(createHash('sha256').update(b).digest('hex'),m.asset.sha256);assert.equal(m.reference.structures.length,count);
 assert(m.reference.structures.some(x=>x.label==='Heart'));assert.equal(b.readUInt32LE(0),0x46546c67);
 assert.deepEqual(readFileSync(root+'/reference/public/reference/'+notice),readFileSync(out+'reference/'+notice));
}
assert.deepEqual(readFileSync(out+'index.html'),readFileSync(out+'reference.html'));
const html=readFileSync(out+'index.html','utf8');assert(html.includes('/DICOM3D/'));
const bundles=Object.keys(manifest.files).filter(x=>x.endsWith('.js')).map(x=>readFileSync(out+x,'utf8')).join('\n');
for(const s of ['connectLive','connectDicom','Read public FHIR test evidence','SMART_TEST','hapi.fhir.org','server.fire.ly'])assert(!bundles.includes(s),s+' must not be distributed');
for(const name of ['LICENSE','NOTICE','third-party/babylon-lite-1.32.0-NOTICE.txt'])assert.deepEqual(readFileSync(root+'/'+name),readFileSync(out+name));
assert(!Object.keys(manifest.files).some(x=>/reference\/(male|female)\.(glb|manifest\.json)$/.test(x)));
console.log('PASS: 33/22 reference identities, exact assets/notices, static Pages base, no placeholder/default or Connect provider UI, all output hashes');
