"""Build a local split IPM candidate from an already qualified 0.8.0 staging tree."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError('Expected a regular input file: ' + str(path))
    return path.read_bytes()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--stage', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    if args.output.exists():
        raise FileExistsError('Output already exists')
    stage = args.stage.resolve(strict=True)
    if args.stage.is_symlink():
        raise ValueError('Linked staging directory refused')
    manifest_bytes = read(stage / 'public/demo-build-manifest.json')
    if hashlib.sha256(manifest_bytes).hexdigest() != 'b3cb1ad332ea0c9f9b5ab7db568d12e5537a86013f28eaf260adb998e293b416':
        raise ValueError('Frontend manifest identity mismatch')
    manifest = json.loads(manifest_bytes)
    if manifest.get('release') != '0.8.0' or manifest.get('sourceBase') != '65aa601b853bb031f6788816a18bd4ed5969bbf9':
        raise ValueError('Expected the exact qualified 0.8.0 frontend')
    for name, record in manifest['files'].items():
        path = stage / 'public' / name
        if '..' in Path(name).parts or not path.resolve(strict=True).is_relative_to((stage / 'public').resolve()):
            raise ValueError('Invalid source asset path')
        data = read(path)
        if {'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} != record:
            raise ValueError('Asset identity mismatch: ' + name)
    module = ET.fromstring(read(stage / 'module.xml'))
    item = module.find('./Document/Module')
    if item is None or item.findtext('Version') != '0.8.0':
        raise ValueError('Invalid staged module')
    copies = item.findall('FileCopy')
    expected = set(manifest['files']) | {'demo-build-manifest.json'}
    if len(copies) != len(expected) or {e.attrib['Name'].removeprefix('public/') for e in copies} != expected:
        raise ValueError('Unexpected IPM FileCopy inventory')
    for entry in copies:
        item.remove(entry)
    guard = ET.Element('Invoke', {'Class':'DICOM3D.Assets','Method':'Verify','Phase':'Activate','When':'After'})
    ET.SubElement(guard, 'Arg').text = '{$cspdir}dicom3d/'
    migration = next(e for e in item.findall('Invoke') if e.attrib.get('Class') == 'DICOM3D.InstallMigration')
    item.insert(list(item).index(migration), guard)
    entries = {'module.xml':ET.tostring(module, encoding='utf-8', xml_declaration=True)}
    for name in ('LICENSE','NOTICE','src/DICOM3D/Entry.cls','src/DICOM3D/InstallMigration.cls'):
        entries[name] = read(stage / name)
    entries['src/DICOM3D/Health.cls'] = read(ROOT / 'src/DICOM3D/Health.cls')
    entries['src/DICOM3D/Assets.cls'] = read(ROOT / 'src/DICOM3D/Assets.cls')
    entries['provision-ipm-assets.py'] = read(ROOT / 'scripts/provision-ipm-assets.py')
    entries['README-SPLIT-IPM.txt'] = read(ROOT / 'docs/INSTALL_SPLIT_IPM.md')
    with args.output.open('xb') as raw, gzip.GzipFile(filename='', mode='wb', fileobj=raw, compresslevel=6, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as tar:
            for name, data in sorted(entries.items()):
                entry = tarfile.TarInfo(name); entry.size = len(data); entry.mode = 0o644; entry.mtime = 0
                tar.addfile(entry, io.BytesIO(data))
    print(json.dumps({'archive':str(args.output),'bytes':args.output.stat().st_size,'sha256':hashlib.sha256(read(args.output)).hexdigest(),'status':'LOCAL CANDIDATE; separate setup required'}))


if __name__ == '__main__':
    main()
