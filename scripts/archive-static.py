"""Freeze one exact admitted static frontend and its portable loopback launcher."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess,zipfile

ROOT=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--build',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--source-commit',required=True);a=p.parse_args()
 if a.output.exists():raise ValueError('Archive already exists; preserve it')
 if not re.fullmatch('[0-9a-f]{40}',a.source_commit):raise ValueError('Exact source commit required')
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 if head!=a.source_commit:raise ValueError('Source HEAD mismatch')
 frozen=lambda n:subprocess.check_output(['git','show',a.source_commit+':'+n],cwd=ROOT)
 source=json.loads(frozen('source-manifest.json'));mbytes=(a.build/'demo-build-manifest.json').read_bytes();m=json.loads(mbytes)
 if m['release']!='0.6.5' or m['publicationApproved'] is not False:raise ValueError('Private release candidate required')
 files={}
 for name,record in m['files'].items():
  if name.startswith('/') or '..' in Path(name).parts or re.search(r'(^|/)(\.secrets|node_modules|bdp-fixture)(/|$)|\.(dcm|raw16|iso)$',name,re.I):raise ValueError('Unadmitted path')
  data=(a.build/name).read_bytes()
  if {'bytes':len(data),'sha256':sha(data)}!=record:raise ValueError('Static inventory mismatch')
  files['public/'+name]=data
 files['public/demo-build-manifest.json']=mbytes
 for name in ['scripts/preview-static.mjs','scripts/open-preview.ps1','scripts/stop-preview.ps1','docs/RELEASE_CANDIDATE_065.md','docs/RELEASE_NOTES_065.md','docs/INSTALL_065.md','docs/ANATOMY_LICENSES_065.md','docs/INTEROPERABILITY_065.md','docs/MOBILE_HANDOFF_065.md','LICENSE','NOTICE']:
  data=frozen(name)
  if source['files'][name]!={'bytes':len(data),'sha256':sha(data)}:raise ValueError('Source inventory mismatch')
  files[name]=data
 files['README.md']=b'# DICOM3D0.6.5 private standalone Safe Demo candidate\n\nRun `node scripts/preview-static.mjs --root public --port 0` with existing Node24. Open the printed loopback URL; Ctrl+C stops the host. Windows persistent open/stop launchers are in scripts/. Read docs/RELEASE_CANDIDATE_065.md for scope and remaining distribution gates. No IRIS, Orthanc, AI, package installation or frontend build is required.\n'
 identity={n:{'bytes':len(d),'sha256':sha(d)} for n,d in sorted(files.items())}
 files['release-candidate.json']=(json.dumps({'version':'0.6.5','privateReleaseCandidate':True,'sourceGitHead':a.source_commit,'profile':m['buildProfile'],'publicationApproved':False,'requiresIRIS':False,'liveInteropDistribution':False,'files':identity},indent=2)+'\n').encode()
 a.output.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(a.output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for n,d in sorted(files.items()):
   i=zipfile.ZipInfo(n,date_time=(1980,1,1,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=0o100644<<16;z.writestr(i,d)
 result={'archive':a.output.name,'bytes':a.output.stat().st_size,'sha256':sha(a.output.read_bytes()),'sourceCommit':a.source_commit,'files':len(files),'profile':m['buildProfile']}
 a.output.with_suffix('.zip.sha256').write_text(result['sha256']+'  '+a.output.name+'\n',encoding='utf-8');print(json.dumps(result))
if __name__=='__main__':main()
