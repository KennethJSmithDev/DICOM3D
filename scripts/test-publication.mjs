import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {PUBLIC_RELEASE, PUBLIC_STUDY_ENABLED} from '../viewer/src/public-release.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const git=args=>execFileSync('git',args,{cwd:root,maxBuffer:150*1024*1024});
const paths=git(['ls-files','-z']).toString('utf8').split('\0').filter(Boolean);
const excludedHashes=new Set([
  '645c9ebaf383bb447e415e0a400973aabb2da50e147033fb710180fa0b179b88',
  '44c55da565e520ee2d1eee25710650d23ada10bfb510c2e39e1cabb06ec0399c',
  '0e77bfb887791614b5fcb15c614c4948ae4d48e24ab6e9fa289aa0603c66076d',
  '605073678ef244b7ebd44995d01789e79f5cb31a715c66a21d4b76b12161d73e',
  '0dfff975e61696fd4b570e32b38e84ef4515ebb812906196169aab0818081d2a',
  'fcfdacfeaf8fd78e929f313a7d33abf34e214de6b2ad3c813ecf2ebcade13335',
]);
assert.equal(PUBLIC_RELEASE.release,'0.6.0');
assert.equal(PUBLIC_STUDY_ENABLED,false);
let bytes=0;
for(const path of paths){
  assert(!/reference\/public\/demo\/|study-docked|\.(dcm|npy|npz|bin)$/i.test(path),'Unadmitted Git path: '+path);
  const content=git(['show',':'+path]);
  bytes+=content.length;
  assert(!excludedHashes.has(createHash('sha256').update(content).digest('hex')),'Unapproved bytes under renamed path: '+path);
}
const metadata=JSON.parse(git(['show',':viewer/package.json']));
assert.equal(metadata.version,PUBLIC_RELEASE.release);
console.log(JSON.stringify({result:'PASS',scope:'Complete Git index paths and byte identities; reference-only release',release:PUBLIC_RELEASE.release,files:paths.length,bytes,excludedPayloadAndScreenshotHashes:excludedHashes.size},null,2));
