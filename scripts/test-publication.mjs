import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {PUBLIC_RELEASE,publicBuildProfile} from '../viewer/src/public-release.mjs';
import {APPROVED_H000_ASSETS,EXCLUDED_STUDY_SCREENSHOT_SHA256} from '../viewer/src/public-h000-admission.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const git=args=>execFileSync('git',args,{cwd:root,maxBuffer:150*1024*1024});
const paths=git(['ls-files','-z']).toString('utf8').split('\0').filter(Boolean);
const staged=Object.fromEntries(git(['ls-files','--stage','-z']).toString('utf8').split('\0').filter(Boolean).map(row=>{
  const [record,path]=row.split('\t'),[mode,,stage]=record.split(' ');
  assert.equal(stage,'0','Unmerged index entry: '+path);
  assert(['100644','100755'].includes(mode),'Non-regular Git entry is not admitted: '+path);
  return [path,mode];
}));
const index=process.argv.indexOf('--profile'),profile=index<0?'reference-only':process.argv[index+1];
const selected=publicBuildProfile(profile);
const approved=Object.fromEntries(Object.entries(APPROVED_H000_ASSETS).map(([name,value])=>['reference/public/demo/h000/'+name,value]));
const researchHashes=new Set(Object.values(APPROVED_H000_ASSETS).map(value=>value.sha256));
assert.equal(PUBLIC_RELEASE.release,'0.6.5');
let bytes=0,researchFiles=0;
function check(path,content){
  const hash=createHash('sha256').update(content).digest('hex');
  assert.notEqual(hash,EXCLUDED_STUDY_SCREENSHOT_SHA256,'Excluded screenshot under renamed path: '+path);
  if(selected.studyEnabled&&Object.hasOwn(approved,path)){
    assert.equal(content.length,approved[path].bytes,'Admitted path changed size: '+path);
    assert.equal(hash,approved[path].sha256,'Admitted path changed bytes: '+path);
    return true;
  }
  assert(!/reference\/public\/demo\/|study-docked|\.(dcm|npy|npz|bin)$/i.test(path),'Unadmitted Git path: '+path);
  assert(!researchHashes.has(hash),'Approved data under an unapproved/renamed path: '+path);
  return false;
}
for(const path of paths){
  const content=git(['show',':'+path]);
  bytes+=content.length;
  if(check(path,content))researchFiles++;
}
assert.equal(Object.keys(staged).length,paths.length,'Unique regular index entries required');
assert.equal(researchFiles,selected.studyEnabled?5:0,'Exact five indexed files required for curated publication');
if(selected.studyEnabled){
  const sample=git(['show',':reference/public/demo/h000/NOTICE.md']);
  assert.throws(()=>check('docs/renamed-notice.md',sample),/unapproved\/renamed/);
  assert.throws(()=>check('reference/public/demo/h000/extra.md',sample),/Unadmitted/);
  assert.throws(()=>check('reference/public/demo/h000/NOTICE.md',Buffer.alloc(sample.length)),/changed bytes/);
  assert.equal(JSON.parse(git(['show',':reference/public/demo/h000/source-binding.json'])).admission.publicationApproved,false);
}
const metadata=JSON.parse(git(['show',':viewer/package.json']));
assert.equal(metadata.version,PUBLIC_RELEASE.release);
console.log(JSON.stringify({result:'PASS',scope:'Complete Git index paths and byte identities; not deployment qualification',release:PUBLIC_RELEASE.release,buildProfile:profile,files:paths.length,bytes,researchFiles,renamedStudyHashesDenied:researchHashes.size,excludedScreenshotHashes:1},null,2));
