/// Fail closed when the separately provisioned public viewer is absent or changed.
Class DICOM3D.Assets Extends %RegisteredObject
{

ClassMethod Verify(root As %String) As %Status [ Language = python ]
{
    import hashlib, json, os, re, stat
    import iris

    try:
        root = os.path.abspath(root)
        def check_path(path):
            current = path
            while True:
                info = os.lstat(current)
                if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
                    raise ValueError('linked path refused')
                parent = os.path.dirname(current)
                if parent == current: break
                current = parent
        check_path(root)
        mpath = os.path.join(root, 'demo-build-manifest.json')
        check_path(mpath)
        with open(mpath, 'rb') as f: raw = f.read(2_000_001)
        if len(raw) > 2_000_000 or hashlib.sha256(raw).hexdigest() != 'b3cb1ad332ea0c9f9b5ab7db568d12e5537a86013f28eaf260adb998e293b416':
            raise ValueError('public asset manifest mismatch')
        records = json.loads(raw)['files']
        for name, record in records.items():
            if not re.fullmatch(r'[A-Za-z0-9_./-]+', name) or any(p in ('', '.', '..') for p in name.split('/')):
                raise ValueError('invalid asset path')
            path = os.path.join(root, *name.split('/'))
            check_path(path)
            h = hashlib.sha256()
            with open(path, 'rb') as f:
                for chunk in iter(lambda: f.read(1024*1024), b''): h.update(chunk)
            if os.path.getsize(path) != record['bytes'] or h.hexdigest() != record['sha256']:
                raise ValueError('asset identity mismatch: '+name)
        return 1
    except Exception as e:
        return iris.cls('%SYSTEM.Status').Error(5001, 'DICOM3D public assets unavailable or invalid; provision the verified bundle before installation: '+str(e))
}

}
