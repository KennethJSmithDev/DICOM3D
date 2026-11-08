"""Focused packet integrity, evidence identity and auth checks; no LLM request."""
import argparse, hashlib, json
from pathlib import Path
import contest

def verify_files():
    manifest=contest.load(contest.ROOT/'MANIFEST.json')
    for row in manifest['files']:
        file=contest.ROOT/row['path']
        assert file.is_file() and file.stat().st_size==row['bytes'],row['path']
        with file.open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==row['sha256'],row['path']
    fixtures=contest.load(contest.ROOT/'fixtures/evidence.json')
    assert len(fixtures)==9 and len({r['path'] for r in fixtures})==9
    print(json.dumps({'integrity':'PASS','files':len(manifest['files']),'fixtures':len(fixtures)}))

def canonical(resource):
    result=json.loads(json.dumps(resource))
    if 'meta' in result:
        result['meta']={k:v for k,v in result['meta'].items() if k not in ('versionId','lastUpdated')}
        if not result['meta']:result.pop('meta')
    return result

def check_runtime(state):
    root=Path(state['stateRoot'])
    credentials=contest.load(root/'private/reader.json')
    reader=credentials['R5P001Reader']
    rows=[]
    for expected in contest.load(contest.ROOT/'fixtures/evidence.json'):
        status,raw=contest.http(state,'GET',expected['path'],user='R5P001Reader',password=reader)
        assert status==200,(expected['path'],status)
        actual=json.loads(raw)
        assert canonical(actual)==canonical(expected['resource']),expected['path']
        rows.append({'path':expected['path'],'sha256':hashlib.sha256(raw).hexdigest(),'resource':actual})
    snapshot=root/'evidence/reader-first.json'
    if snapshot.exists():
        original=contest.load(snapshot)
        assert {r['path']:r['sha256'] for r in original}=={r['path']:r['sha256'] for r in rows},'Evidence changed during this fixture lifecycle'
    else:contest.save(snapshot,rows)
    contest.save(root/'evidence/reader-latest.json',rows)
    negatives=[]
    for label,user,password,method,path,body in (
        ('anonymous',None,None,'GET','/ImagingStudy/r5p-h000-ct',None),
        ('wrong-password','R5P001Reader','not-the-password','GET','/ImagingStudy/r5p-h000-ct',None),
        ('no-resource-role','R5P001Denied',credentials['R5P001Denied'],'GET','/ImagingStudy/r5p-h000-ct',None),
        ('reader-write-denied','R5P001Reader',reader,'PUT','/Patient/contest-no-write',{'resourceType':'Patient','id':'contest-no-write'})):
        status,raw=contest.http(state,method,path,body,user,password)
        # This pinned R5 gateway conceals invalid credentials with generic404.
        # Positive reads proved the same resource exists. Never accept a resource
        # body or broaden the other authorization expectations.
        denied=status in (401,403) or (label=='wrong-password' and status==404 and raw.strip()==b'Not Found')
        assert denied,(label,status)
        negatives.append({'case':label,'status':status})
    assert contest.http(state,'GET','/Patient/contest-no-write',user='R5P001Reader',password=reader)[0]==404
    contest.save(root/'evidence/auth-negative.json',negatives)
    print(json.dumps({'sourceEvidence':'PASS','resources':len(rows),'authNegatives':negatives,'claim':'Not an LLM/browser/clinical test'}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline',action='store_true')
    parser.add_argument('--state-dir',type=Path)
    args=parser.parse_args()
    verify_files()
    if args.state_dir:check_runtime(contest.load(args.state_dir/'state.json'))
