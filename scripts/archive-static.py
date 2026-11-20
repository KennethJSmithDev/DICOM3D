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
 modern = m['release'] == '0.7.0'
 if source['version'] != m['release']:
  raise ValueError('Frontend and source identities differ')
 if modern:
  if m['sourceBase'] != a.source_commit:
   raise ValueError('Frontend and source identities differ')
  subprocess.run(['node', str(ROOT/'scripts/test-alpha-distribution.mjs'), str(a.build)], check=True)
 elif m['release'] != '0.6.5' or m['publicationApproved'] is not False:
  raise ValueError('Unreviewed frontend')
 build_root=a.build.resolve(strict=True)
 files={}
 for name,record in m['files'].items():
  if not re.fullmatch(r'[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*',name) or set(name.split('/')) & {'.','..'}:
   raise ValueError('Unadmitted archive path')
  if re.search(r'(^|/)(\.secrets|node_modules|[^/]+-fixture)(/|$)|\.(dcm|raw16|iso)$',name,re.I):
   raise ValueError('Unadmitted archive path')
  path=build_root/name
  if path.resolve(strict=True)!=path or not path.is_file():
   raise ValueError('Archive input must be a regular file inside the build')
  data=path.read_bytes()
  if {'bytes':len(data),'sha256':sha(data)}!=record:raise ValueError('Static inventory mismatch')
  files['public/'+name]=data
 files['public/demo-build-manifest.json']=mbytes
 if modern:
  launcher_files = [
   'scripts/preview-static.mjs', 'scripts/preview-verified-file.mjs',
   'docker/core/fhir-configured-metadata.mjs', 'docker/core/fhir-loopback-route.mjs',
   'prototypes/alpha/viewer/src/fhir-capability-model.mjs',
   'scripts/export-fhir-readonly-openapi.mjs', 'scripts/fhir-readonly-openapi.mjs',
   'prototypes/alpha/viewer/src/fhir-readonly-openapi.mjs',
   'docs/INSTALL_070.md', 'docs/FHIR_INTEROP_ALPHA2.md', 'docs/SMART_SYNTHETIC_FOUNDATION.md',
   'LICENSE', 'NOTICE',
  ]
 else:
  launcher_files = ['scripts/preview-static.mjs','scripts/open-preview.ps1','scripts/stop-preview.ps1','docs/RELEASE_CANDIDATE_065.md','docs/RELEASE_NOTES_065.md','docs/INSTALL_065.md','docs/ANATOMY_LICENSES_065.md','docs/INTEROPERABILITY_065.md','LICENSE','NOTICE']
 for name in launcher_files:
  data=frozen(name)
  if source['files'][name]!={'bytes':len(data),'sha256':sha(data)}:raise ValueError('Source inventory mismatch')
  files[name]=data
 files['README.md']=b'# DICOM3D v0.6.5 standalone Safe Demo candidate\n\nRun `node scripts/preview-static.mjs --root public --port 0` with existing Node24. Open the printed loopback URL; Ctrl+C stops the host. Windows persistent open/stop launchers are in scripts/. Read docs/RELEASE_CANDIDATE_065.md for scope and remaining distribution gates. No IRIS, Orthanc, AI, package installation or frontend build is required.\n'
 if modern:
  files['README.md'] = b'# DICOM3D 0.7.0\n\nWith Node.js 24 installed, run `node scripts/preview-static.mjs --root public --port 0` here and open the URL it prints. Ctrl+C stops the viewer. See [installation and interoperability](docs/INSTALL_070.md).\n'
 profile=m['profile'] if modern else m['buildProfile']
 identity={n:{'bytes':len(d),'sha256':sha(d)} for n,d in sorted(files.items())}
 files['release-candidate.json']=(json.dumps({'version':m['release'],'privateReleaseCandidate':True,'sourceGitHead':a.source_commit,'profile':profile,'publicationApproved':False,'requiresIRIS':False,'liveInteropDistribution':modern,'files':identity},indent=2)+'\n').encode()
 a.output.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(a.output,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for n,d in sorted(files.items()):
   i=zipfile.ZipInfo(n,date_time=(1980,1,1,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=0o100644<<16;z.writestr(i,d)
 result={'archive':a.output.name,'bytes':a.output.stat().st_size,'sha256':sha(a.output.read_bytes()),'sourceCommit':a.source_commit,'files':len(files),'profile':profile}
 a.output.with_suffix('.zip.sha256').write_text(result['sha256']+'  '+a.output.name+'\n',encoding='utf-8');print(json.dumps(result))
if __name__=='__main__':main()
