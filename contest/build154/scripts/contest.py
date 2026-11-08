"""Thin portable lifecycle adapter for the existing Native005 demonstration.

Requires Python3.11+, Node22+, Docker Compose v2 and an installed local Ollama.
Never pulls images, downloads a model, touches another project or deletes data.
"""
import argparse, base64, datetime, hashlib, ipaddress, json, os, re, secrets, shutil, signal
import socket, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AI_IMAGE='sha256:bbea4364ab6fbd7810219780fa76730fc2977d8cf76f3e01b92c5d4291a2feae'
R5_IMAGE='sha256:471b301127cf37b0fcb91f1e9e8c65cc497318a14a873eb2fece5586b04e9d57'
MODEL_DIGEST='9ba9cc2b4e02463b933096090530aef679d534dd91ecc9afadfb2dbfdc59f3c5'
FLAGS=getattr(subprocess,'CREATE_NO_WINDOW',0)

def save(path, value):
    Path(path).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

def load(path): return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def assemble(folder):
    spec=load(ROOT/'ASSEMBLY.json')
    target=folder/'assembled/hra-female.glb'
    if target.exists():
        with target.open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==spec['sha256']
        return str(target)
    target.parent.mkdir(exist_ok=True)
    digest=hashlib.sha256()
    with target.open('xb') as out:
        for row in spec['parts']:
            current=hashlib.sha256()
            with (ROOT/row['path']).open('rb') as source:
                while chunk:=source.read(1048576):
                    current.update(chunk);digest.update(chunk);out.write(chunk)
            assert current.hexdigest()==row['sha256'], 'Asset part hash mismatch'
    assert target.stat().st_size==spec['bytes'] and digest.hexdigest()==spec['sha256'], 'Asset assembly mismatch; retain failure'
    return str(target)

def check_subnet(value):
    subnet=ipaddress.ip_network(value,strict=True)
    assert subnet.version==4 and subnet.is_private and 24<=subnet.prefixlen<=28, 'Use a private /24 through /28 subnet'
    ids=run(['docker','network','ls','-q']).split()
    networks=json.loads(run(['docker','network','inspect',*ids])) if ids else []
    occupied=[row['Subnet'] for net in networks for row in (net['IPAM'].get('Config') or []) if 'Subnet' in row and ':' not in row['Subnet']]
    if os.name=='nt':
        routes=json.loads(run(['powershell','-NoProfile','-Command','ConvertTo-Json -Compress -InputObject @(Get-NetRoute -AddressFamily IPv4 | Select-Object -ExpandProperty DestinationPrefix)']))
    else:
        routes=[r.get('dst','default') for r in json.loads(run(['ip','-j','-4','route']))]
    occupied += [r for r in routes if r not in ('default','0.0.0.0/0')]
    assert all(not subnet.overlaps(ipaddress.ip_network(r,strict=False)) for r in occupied), 'Subnet overlaps an existing Docker network or host route; choose --subnet explicitly'
    return str(subnet)

def run(args, text=None, timeout=60):
    r=subprocess.run(args,input=text,text=True,encoding='utf-8',errors='strict',capture_output=True,timeout=timeout,creationflags=FLAGS)
    if r.returncode: raise RuntimeError('Command failed: '+str(args[:3])+'; '+r.stderr[-500:])
    return r.stdout.strip()

def compose(state,*args):
    return run(['docker','compose','--project-name',state['project'],'--env-file',str(Path(state['stateRoot'])/'compose.env'),'-f',str(ROOT/'compose.yaml'),*args],timeout=240)

def owned(state):
    rows=[]
    for service,cid in state['containers'].items():
        c=json.loads(run(['docker','inspect',cid]))[0]
        assert c['Config']['Labels'].get('com.docker.compose.project')==state['project']
        assert c['Config']['Labels'].get('com.docker.compose.service')==service
        assert c['Image']==(AI_IMAGE if service=='agent' else R5_IMAGE)
        rows.append(c)
    return rows

def session(state,service,code,namespace='USER',log='session',timeout=180):
    owned(state)
    result=run(['docker','exec','--user','51773','-i',state['containers'][service],'iris','session','IRIS','-U',namespace],code+'\nHalt\n',timeout)
    # Bootstrap values never enter the command line or session source.
    for file in (Path(state['stateRoot'])/'private').glob('*.txt'):
        result=result.replace(file.read_text(encoding='utf-8').strip(),'[REDACTED]')
    (Path(state['stateRoot'])/'evidence'/f'{log}.txt').write_text(result+'\n',encoding='utf-8')
    if 'CONTEST_FAIL' in result or '<SYNTAX>' in result or '<METHOD DOES NOT EXIST>' in result:
        raise RuntimeError('IRIS gate failed; inspect owned evidence/'+log+'.txt')
    return result

def health(state):
    began=time.monotonic()
    while time.monotonic()-began<180:
        rows=owned(state)
        if any(not c['State']['Running'] for c in rows): raise RuntimeError('Owned runtime exited; retain logs')
        if all(c['State'].get('Health',{}).get('Status')=='healthy' for c in rows):
            # Separate a healthy database from actual loopback publication.
            with socket.create_connection(('127.0.0.1',state['port']+1),timeout=5): pass
            save(Path(state['stateRoot'])/'evidence/health.json',[{'id':c['Id'],'image':c['Image'],'state':c['State']} for c in rows])
            return
        time.sleep(2)
    raise TimeoutError('180-second vendor health deadline')

def http(state,method,path,body=None,user=None,password=None):
    headers={'Accept':'application/fhir+json','Content-Type':'application/fhir+json'}
    if user is not None: headers['Authorization']='Basic '+base64.b64encode((user+':'+password).encode()).decode()
    request=urllib.request.Request(state['fhirBase']+path,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,headers=headers,method=method)
    try: result=urllib.request.urlopen(request,timeout=30)
    except urllib.error.HTTPError as error: result=error
    raw=result.read(2097153)
    assert len(raw)<=2097152
    return result.status,raw

def configure(state):
    stages=[('foundation','HSSYS','Set sc=##class(HS.Util.Installer.Foundation).Install("R5P001")\nIf $SYSTEM.Status.IsError(sc) { Write "CONTEST_FAIL",! } Else { Write "CONTEST_PASS",! }'),
            ('r5-namespace','R5P001','Try { Do ##class(HS.FHIRServer.Installer).InstallNamespace() Write "CONTEST_PASS",! } Catch e { Write "CONTEST_FAIL ",e.DisplayString(),! }'),
            ('r5-instance','R5P001','Try { Do ##class(HS.FHIRServer.Installer).InstallInstance("/r5p001/fhir/r5","HS.FHIRServer.Storage.JsonAdvSQL.InteractionsStrategy",$lb("hl7.fhir.r5.core@5.0.0")) Write "CONTEST_PASS",! } Catch e { Write "CONTEST_FAIL ",e.DisplayString(),! }')]
    for name,ns,code in stages:
        out=session(state,'evidence',code,ns,name,240)
        assert 'CONTEST_PASS' in out
    private=Path(state['stateRoot'])/'private'
    password=(private/'r5-bootstrap.txt').read_text(encoding='utf-8').strip()
    inputs=load(ROOT/'fixtures/evidence.json')
    for row in inputs:
        status,raw=http(state,'PUT',row['path'],row['resource'],'_SYSTEM',password)
        assert status in (200,201), ('seed',row['path'],status)
    security='''Set stream=##class(%Stream.FileCharacter).%New()
Set sc=stream.LinkToFile("/run/contest/reader.json")
Set credentials=##class(%DynamicObject).%FromJSON(stream)
Set sc=##class(Security.Resources).Create("R5P001Evidence","Contest synthetic/public evidence","")
Write "RESOURCE=",sc,!
Set sc=##class(Security.Roles).Create("R5P001ReaderRole","Contest read only","R5P001Evidence:R","")
Write "ROLE=",sc,!
Set sc=##class(Security.Users).Create("R5P001Reader","R5P001ReaderRole",credentials.R5P001Reader,"Contest reader","R5P001","","",0,1)
Write "READER=",sc,!
Set sc=##class(Security.Users).Create("R5P001Denied","",credentials.R5P001Denied,"Negative control","R5P001","","",0,1)
Write "DENIED=",sc,!
Kill credentials,stream
ZN "R5P001"
Set strategy=##class(HS.FHIRServer.API.InteractionsStrategy).GetStrategyForEndpoint("/r5p001/fhir/r5")
Set config=strategy.GetServiceConfigData(),config.RequiredResource="R5P001Evidence"
Set config.MaxSearchPageSize=25,config.DefaultSearchPageSize=25,config.MaxSearchResults=100
Do strategy.SaveServiceConfigData(config)
Write "CONTEST_PASS",!
'''
    out=session(state,'evidence',security,'%SYS','restricted-reader')
    assert all(x+'=1' in out for x in ('RESOURCE','ROLE','READER','DENIED'))
    files=['Native001.Tools.cls','Native005.Request.cls','Native005.Response.cls','Native005.Tools.cls','Native005.SyntheticTools.cls','Native005.Operation.cls','Native005.Service.cls','Native005.Production.cls']
    code='\n'.join('Set sc=$SYSTEM.OBJ.Load("/run/contest/src/'+name+'","ck")\nWrite "FILE '+name+'=",$SYSTEM.Status.IsOK(sc),!' for name in files)
    out=session(state,'agent',code,log='compile-native')
    assert all('FILE '+name+'=1' in out for name in files)

def process_identity(pid):
    if os.name=='nt':
        return run(['powershell','-NoProfile','-Command',f'$p=Get-CimInstance Win32_Process -Filter "ProcessId={int(pid)}"; if($p){{$p.CreationDate.ToUniversalTime().ToString("o")}}'])
    try: return Path('/proc',str(pid),'stat').read_text().rsplit(')',1)[1].split()[19]
    except FileNotFoundError: return ''

def launch(state):
    folder=Path(state['stateRoot'])
    active=[p for p in state.get('processes',[]) if process_identity(p['pid'])]
    if active:
        assert len(active)==3 and all(process_identity(p['pid'])==p['identity'] for p in active), 'Partial or changed owned lifecycle; inspect and explicitly stop before start'
        config=load(folder/'config.json')
        assert config['viewerRoot']==str(ROOT/'frontend') and config['container']==state['containers']['agent'], 'Candidate identity differs; refusing implicit replacement'
        password=(folder/'private/bridge-password.txt').read_text(encoding='utf-8').strip()
        request=urllib.request.Request(f'http://127.0.0.1:{state["port"]}/healthz',headers={'Authorization':'Basic '+base64.b64encode(('contest:'+password).encode()).decode()})
        with urllib.request.urlopen(request,timeout=5) as response:assert json.load(response)['status']=='ready'
        print(json.dumps({'status':'READY_REUSED','url':f'http://127.0.0.1:{state["port"]}/DICOM3D/','processes':[p['pid'] for p in active]}))
        return
    env={key:value for key,value in os.environ.items() if not key.startswith('OLLAMA_') and key not in ('NODE_OPTIONS','NODE_PATH','PYTHONPATH','PYTHONHOME')}
    env.update(OLLAMA_HOST=f'127.0.0.1:{state["ollamaPort"]}',OLLAMA_MODELS=state['modelStore'],OLLAMA_NO_CLOUD='1',OLLAMA_NOPRUNE='1',OLLAMA_CONTEXT_LENGTH='2048',OLLAMA_KEEP_ALIVE='0',OLLAMA_NUM_PARALLEL='1',OLLAMA_MAX_LOADED_MODELS='1',OLLAMA_MAX_QUEUE='1',OLLAMA_LOAD_TIMEOUT='90s',OLLAMA_LLM_LIBRARY='cpu_avx2',ROCR_VISIBLE_DEVICES='-1')
    state['processes']=[]
    def start(name,args):
        with (folder/'evidence'/f'{name}.stdout').open('ab') as out,(folder/'evidence'/f'{name}.stderr').open('ab') as err:
            proc=subprocess.Popen(args,env=env,stdout=out,stderr=err,creationflags=FLAGS)
        state['processes'].append({'name':name,'pid':proc.pid,'identity':process_identity(proc.pid)})
        save(folder/'state.json',state)
        return proc
    start('ollama',[state['ollamaExecutable'],'serve'])
    for _ in range(30):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{state["ollamaPort"]}/api/tags',timeout=2) as response: models=json.load(response)['models']
            assert any(m['name']=='gpt-oss:20b' and m['digest']==MODEL_DIGEST for m in models), 'Required local model missing or different; no automatic download'
            break
        except urllib.error.URLError: time.sleep(1)
    else: raise TimeoutError('Ollama readiness')
    out=session(state,'agent','Write "KEY=",$SYSTEM.License.GetKeyStatus(),!\nWrite "INTEROP=",$SYSTEM.License.GetFeature(1),!\nSet sc=##class(Ens.Director).StartProduction("Native005.Production")\nWrite "START=",$SYSTEM.Status.IsOK(sc),!\nWrite "RUNNING=",##class(Ens.Director).IsProductionRunning(),!',log='production-start')
    assert all(x in out for x in ('KEY=Valid','INTEROP=1','START=1','RUNNING=1'))
    config={'port':state['port'],'viewerRoot':str(ROOT/'frontend'),'passwordFile':str(folder/'private/bridge-password.txt'),'username':'contest','container':state['containers']['agent'],'eventLog':str(folder/'evidence/adapter-events.jsonl'),'evidenceRoot':str(folder/'evidence'),'ollamaBase':f'http://127.0.0.1:{state["ollamaPort"]}','relayPort':state['relayPort'],'assetOverrides':{'reference/hra-female.glb':assemble(folder)}}
    save(folder/'config.json',config)
    start('relay',[sys.executable,str(ROOT/'scripts/relay.py'),'--config',str(folder/'config.json')])
    start('bridge',[shutil.which('node'),str(ROOT/'scripts/server.mjs'),'--config',str(folder/'config.json')])
    password=(folder/'private/bridge-password.txt').read_text(encoding='utf-8').strip()
    request=urllib.request.Request(f'http://127.0.0.1:{state["port"]}/healthz',headers={'Authorization':'Basic '+base64.b64encode(('contest:'+password).encode()).decode()})
    for _ in range(20):
        try:
            with urllib.request.urlopen(request,timeout=2) as response: assert response.status==200
            break
        except urllib.error.URLError: time.sleep(1)
    else: raise TimeoutError('Bridge readiness')
    print(json.dumps({'status':'READY','url':f'http://127.0.0.1:{state["port"]}/DICOM3D/','username':'contest','passwordFile':str(folder/'private/bridge-password.txt'),'state':str(folder/'state.json')}))

def stop(state):
    rows=owned(state)
    if any(c['State']['Running'] and c['Config']['Labels']['com.docker.compose.service']=='agent' for c in rows):
        out=session(state,'agent','Set sc=##class(Ens.Director).StopProduction(60,0)\nWrite "STOP=",$SYSTEM.Status.IsOK(sc),!',log='production-stop')
        assert 'STOP=1' in out
    for process in reversed(state.get('processes',[])):
        identity=process_identity(process['pid'])
        if identity:
            assert identity==process['identity'], 'PID identity changed; refusing stop'
            os.kill(process['pid'],signal.SIGTERM)
    compose(state,'stop','--timeout','120')
    assert all(not c['State']['Running'] for c in owned(state))
    print('STOPPED: owned containers and host processes only; retained storage and evidence. No deletion.')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['up','start','stop','status'])
    parser.add_argument('--state-dir',required=True,type=Path)
    parser.add_argument('--project',default='dicom3d-contest154')
    parser.add_argument('--port-base',type=int,default=57400)
    parser.add_argument('--subnet',default='10.203.154.0/28')
    parser.add_argument('--model-store',type=Path)
    parser.add_argument('--ollama',default=shutil.which('ollama'))
    args=parser.parse_args()
    folder=args.state_dir.resolve()
    if args.action!='up':
        state=load(folder/'state.json')
        if args.action=='stop':stop(state)
        elif args.action=='status': print(json.dumps([{'id':c['Id'],'state':c['State']['Status']} for c in owned(state)]))
        else:
            compose(state,'start');health(state);launch(state)
        return
    assert not folder.exists(), 'Fresh up requires an absent state directory; use start for retained state'
    assert re.fullmatch('[a-z][a-z0-9-]{3,40}',args.project)
    assert args.model_store and args.model_store.is_dir() and args.ollama
    assert shutil.which('node') and shutil.which('docker')
    assert not run(['docker','ps','-aq','--filter','label=com.docker.compose.project='+args.project]), 'Project already exists'
    subnet=check_subnet(args.subnet)
    for port in range(args.port_base,args.port_base+4):
        with socket.socket() as sock:sock.bind(('127.0.0.1',port))
    for image in (AI_IMAGE,R5_IMAGE):assert json.loads(run(['docker','image','inspect',image]))[0]['Id']==image
    (folder/'private').mkdir(parents=True,mode=0o700)
    (folder/'evidence').mkdir()
    if os.name=='nt':run(['icacls',str(folder/'private'),'/inheritance:r','/grant:r',run(['whoami'])+':(OI)(CI)F','SYSTEM:(OI)(CI)F'])
    for file in ('agent-bootstrap.txt','r5-bootstrap.txt','bridge-password.txt'):
        (folder/'private'/file).write_text('Contest!'+secrets.token_urlsafe(30)+'\n',encoding='ascii')
        (folder/'private'/file).chmod(0o600)
    save(folder/'private/reader.json',{u:'Contest!'+secrets.token_urlsafe(30) for u in ('R5P001Reader','R5P001Denied')})
    (folder/'private/reader.json').chmod(0o600)
    state={'project':args.project,'stateRoot':str(folder),'port':args.port_base,'fhirBase':f'http://127.0.0.1:{args.port_base+1}/r5p001/fhir/r5','ollamaPort':args.port_base+2,'relayPort':args.port_base+3,'modelStore':str(args.model_store.resolve()),'ollamaExecutable':str(Path(args.ollama).resolve()),'containers':{},'processes':[],'createdUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    env={'AI_IMAGE_ID':AI_IMAGE,'R5_IMAGE_ID':R5_IMAGE,'PACKET_ROOT':ROOT.as_posix(),'STATE_ROOT':folder.as_posix(),'FHIR_PORT':str(args.port_base+1),'EVIDENCE_SUBNET':subnet}
    (folder/'compose.env').write_text(''.join(f'{k}={v}\n' for k,v in env.items()),encoding='utf-8')
    save(folder/'state.json',state)
    compose(state,'config','--quiet')
    compose(state,'create')
    for service in ('agent','evidence'):state['containers'][service]=compose(state,'ps','--all','--quiet',service)
    save(folder/'state.json',state)
    compose(state,'start')
    health(state);configure(state);launch(state)

if __name__=='__main__':main()
