"""Prepare the exact qualified model metadata around a separately supplied GGUF.

No download, conversion, model mutation or provider installation. Default hardlink
avoids duplicating14GB; --copy is explicit and needs that extra storage. Use a NEW
private directory. Never add it to Git or a release archive.
"""
import argparse,hashlib,json,os,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def digest(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--weight-file',type=Path,required=True)
    parser.add_argument('--model-store',type=Path,required=True)
    parser.add_argument('--copy',action='store_true')
    args=parser.parse_args()
    source=json.loads((ROOT/'model/SOURCE.json').read_text(encoding='utf-8'))
    weight=args.weight_file.resolve();store=args.model_store.resolve()
    assert not store.exists(), 'Refusing to overwrite an existing model store'
    assert weight.is_file() and weight.stat().st_size==source['weight']['bytes']
    sha=source['weight']['digest'].split(':')[1]
    assert digest(weight)==sha,'Supplied model weight hash differs; no silent substitution'
    manifest=ROOT/'model/manifest.json'
    assert digest(manifest)==source['selectedManifestSha256']
    for row in source['metadata']:assert digest(ROOT/row['path'])==row['sha256']
    (store/'blobs').mkdir(parents=True)
    target=store/'blobs'/('sha256-'+sha)
    if args.copy:shutil.copyfile(weight,target)
    else:os.link(weight,target)  # Same-volume immutable input reference, no chmod.
    for row in source['metadata']:shutil.copyfile(ROOT/row['path'],store/'blobs'/Path(row['path']).name)
    destination=store/'manifests/registry.ollama.ai/library/gpt-oss/20b'
    destination.parent.mkdir(parents=True)
    shutil.copyfile(manifest,destination)
    print(json.dumps({'status':'PINNED_MODEL_STORE_PREPARED','modelStore':str(store),'selectedManifestSha256':source['selectedManifestSha256'],'weightSha256':sha,'weightBytes':weight.stat().st_size,'weightStorage':'copy' if args.copy else 'same-volume hardlink','downloadedBytes':0}))
