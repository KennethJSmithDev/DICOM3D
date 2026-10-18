"""Freeze allowlisted Core source/assets; no build, downloads or Docker mutation."""
from pathlib import Path
import argparse,hashlib,json,subprocess,zipfile

ROOT=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,required=True);ap.add_argument('--source-commit',help='Recorded base commit for reproducing a release archive outside Git');args=ap.parse_args()
 if args.output.exists():raise SystemExit('Refusing to overwrite an archive')
 files={}
 singles=['Dockerfile.core','compose.core.yaml','.env.core.example','.dockerignore','LICENSE','NOTICE','README.md','CHANGELOG.md','docs/INSTALL_050.md','docs/COMPATIBILITY_050.md','docs/RELEASE_050.md','docs/OPEN_EXCHANGE_050_HANDOFF.md','docs/CORE_DOCKER_QUICKSTART.md','scripts/archive-core.py','docker/core/server.mjs']
 for rel in singles:files[rel]=(ROOT/rel).read_bytes()
 for folder in ['viewer','reference/public','assets/branding','third-party']:
  for p in (ROOT/folder).rglob('*'):
   if not p.is_file() or any(x in p.parts for x in ['node_modules','dist','.vite','.git','__pycache__']):continue
   rel=p.relative_to(ROOT).as_posix()
   if folder=='viewer' and p.suffix not in ['.ts','.mjs','.js','.css','.json','.html']:continue
   files[rel]=p.read_bytes()
 assert 'viewer/package-lock.json' in files
 for rel in files:
  if Path(rel).suffix.lower() in ['.dcm','.npy','.npz'] or '.secrets' in rel:raise SystemExit('Imaging/secret entry rejected')
 identity={n:{'bytes':len(v),'sha256':sha(v)} for n,v in sorted(files.items())}
 git=subprocess.run(['git','-C',str(ROOT),'rev-parse','HEAD'],capture_output=True,text=True)
 manifest={'distribution':'DICOM3D Core','campaign':'PKG-DOCKER-001','stage':'PROTOTYPE','published':False,'sourceGitHead':git.stdout.strip() if git.returncode==0 else None,'sourceIdentitySha256':sha(json.dumps(identity,sort_keys=True,separators=(',',':')).encode()),'baseImage':'node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f','entrypoint':'/dicom3d/reference.html','requiresIRIS':False,'containsPatientImaging':False,'files':identity}
 manifest['version']=json.loads(files['viewer/package.json'])['version']
 if args.source_commit:manifest['sourceGitHead']=args.source_commit
 files['distribution-manifest.json']=(json.dumps(manifest,indent=2)+'\n').encode()
 args.output.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(args.output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for rel,data in sorted(files.items()):
   info=zipfile.ZipInfo(rel,date_time=(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,data)
 digest=sha(args.output.read_bytes());args.output.with_suffix(args.output.suffix+'.sha256').write_text(digest+'  '+args.output.name+'\n')
 print(json.dumps({'archive':str(args.output),'bytes':args.output.stat().st_size,'sha256':digest,'sourceIdentitySha256':manifest['sourceIdentitySha256'],'files':len(files)}))
if __name__=='__main__':main()
