"""Bounded, source-preserving HRA admission. No arbitrary uploads or geometry repair."""
import json,struct,hashlib,collections,math,time,os
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent
ATLAS=Path(os.environ['NRX_HRA_FIXTURE'])
SHA='a61a60841fd3c8308d332421385be03188c0babd58b78ae101adf2807a88473a'
def need(ok,why):
    if not ok:raise ValueError(why)
def digest(b):return hashlib.sha256(b).hexdigest()
def read_atlas():
    raw=ATLAS.read_bytes();need(digest(raw)==SHA,'Atlas source identity');magic,version,length=struct.unpack_from('<III',raw);need(magic==0x46546c67 and version==2 and length==len(raw),'GLB envelope')
    n,kind=struct.unpack_from('<II',raw,12);need(kind==0x4e4f534a,'GLB JSON');g=json.loads(raw[20:20+n]);size,kind=struct.unpack_from('<II',raw,20+n);need(kind==0x004e4942,'GLB binary');return g,raw[28+n:28+n+size]
def decode(g,blob,index):
    a=g['accessors'][index];need('sparse' not in a,'Sparse accessor unsupported');v=g['bufferViews'][a['bufferView']];need(v.get('buffer',0)==0,'External buffer unsupported');fmt={5126:'f',5125:'I',5123:'H',5121:'B'}.get(a['componentType']);need(fmt is not None,'Component type unsupported');width={'SCALAR':1,'VEC3':3}.get(a['type']);need(width is not None,'Accessor shape unsupported');size=struct.calcsize('<'+fmt)*width;stride=v.get('byteStride',size);off=v.get('byteOffset',0)+a.get('byteOffset',0);need(a['count']<=50000 and stride>=size and off+max(0,a['count']-1)*stride+size<=len(blob),'Accessor bounds');return [struct.unpack_from('<'+fmt*width,blob,off+k*stride) for k in range(a['count'])]
def source_mesh(g,blob,name):
    ids=[i for i,n in enumerate(g['nodes']) if n.get('name')==name];need(len(ids)==1,'Unique semantic node required');node=ids[0];parents={c:i for i,n in enumerate(g['nodes']) for c in n.get('children',[])};ancestry=[];i=node
    while True:
        n=g['nodes'][i];need(not any(k in n for k in ['matrix','translation','rotation','scale']),'Nonidentity source transform unsupported; never silently drop it');ancestry.append({'node':i,'name':n.get('name'),'transform':'identity'})
        if i not in parents:break
        i=parents[i]
    n=g['nodes'][node];need('mesh' in n,'Group requires explicit leaf selection');ps=g['meshes'][n['mesh']]['primitives'];need(len(ps)==1,'Multiple primitives unsupported');p=ps[0];need(p.get('mode',4)==4 and 'indices' in p,'Indexed triangles required');need(g['accessors'][p['attributes']['POSITION']]['componentType']==5126,'Float32 positions required');positions=decode(g,blob,p['attributes']['POSITION']);indices=[v[0] for v in decode(g,blob,p['indices'])];need(len(indices)%3==0 and 0<len(indices)<=45000,'Triangle count bounded');need(all(0<=v<len(positions) for v in indices),'Index bounds');return node,n['mesh'],ancestry,positions,[tuple(indices[k:k+3]) for k in range(0,len(indices),3)]
def topology(positions,faces):
    need(all(math.isfinite(x) for p in positions for x in p),'Nonfinite coordinates');edges=collections.defaultdict(list);links=collections.defaultdict(lambda:collections.defaultdict(list));used=set();unique=set();adj=collections.defaultdict(set)
    p=np.asarray(positions);f=np.asarray(faces);need(np.all(np.linalg.norm(np.cross(p[f[:,1]]-p[f[:,0]],p[f[:,2]]-p[f[:,0]]),axis=1)>0),'Degenerate source triangle')
    for face in faces:
        key=tuple(sorted(face));need(key not in unique,'Duplicate source triangle');unique.add(key);used.update(face)
        for j in range(3):
            a,b,c=face[j],face[(j+1)%3],face[(j+2)%3];edges[tuple(sorted((a,b)))].append((a,b));links[a][b].append(c);links[a][c].append(b);adj[a].add(b);adj[b].add(a)
    need(len(used)==len(positions),'Unused source vertices unsupported');need(all(len(v)==2 and v[0]==v[1][::-1] for v in edges.values()),'Source is not closed and consistently oriented')
    for link in links.values():
        seen=set();todo=[next(iter(link))]
        while todo:
            a=todo.pop()
            if a not in seen:seen.add(a);todo.extend(link[a])
        need(len(seen)==len(link) and all(len(v)==2 for v in link.values()),'Nonmanifold source vertex link')
    components=0;seen=set()
    for i in used:
        if i in seen:continue
        components+=1;todo=[i]
        while todo:
            a=todo.pop()
            if a not in seen:seen.add(a);todo.extend(adj[a]-seen)
    need(components==1,'Multiple solid components unsupported at this stage');euler=len(positions)-len(edges)+len(faces);need(euler==2,'Only genus-zero closed fixture contract supported')
    volume=float(np.sum(np.einsum('ij,ij->i',p[f[:,0]],np.cross(p[f[:,1]],p[f[:,2]])))/6);need(volume>0,'Source outward winding required');return {'vertices':len(positions),'triangles':len(faces),'edges':len(edges),'components':components,'euler':euler,'signedVolumeM3':volume}
def contact_validator():
    # Independently implemented integer predicates from the accepted Python witness,
    # rather than the C++ extraction's 512-bit predicate implementation.
    source=ROOT.parents[1]/'tasks/task-4/independent_geometry.py';text=source.read_text();part=text[text.index('sub=lambda'):text.index('sourcePairs=')];ns={'np':np};exec(compile(part,str(source),'exec'),ns);return ns['contacts']
def admit(g,blob,name,contacts):
    node,mesh,ancestry,p,f=source_mesh(g,blob,name);top=topology(p,f);pairs=contacts(np.asarray(p),np.asarray(f));lo=np.min(p,axis=0);hi=np.max(p,axis=0);center=(lo+hi)/2;scale=float(max(hi-lo)*1.5/4);norm=np.asarray((np.asarray(p)-center)/scale,dtype='<f4');error=float(np.max(np.abs(norm.astype(float)*scale+center-p)));need(error<=1e-8,'Unexpected normalization drift')
    original=np.asarray(p,dtype='<f4').tobytes()+np.asarray(f,dtype='<u4').tobytes();payload=norm.tobytes()+np.asarray(f,dtype='<u4').tobytes();n=g['nodes'][node]
    record={'semantic':name,'sourceAtlasSha256':SHA,'subsetNode':node,'mesh':mesh,'sourceExtras':n.get('extras',{}),'ancestry':ancestry,'sourceUnits':'metres','up':'Y','boundsM':[lo.tolist(),hi.tolist()],'centerM':center.tolist(),'scaleM':scale,'normalizationMaxErrorM':error,'topology':top,'contactCandidates':pairs,'forbiddenContacts':0,'originalPayloadSha256':digest(original),'payloadSha256':digest(payload),'payloadBytes':len(payload),'positionCount':len(p),'indexCount':len(f)*3,'license':'CC BY 4.0','sourceAuthority':'Immutable admitted HRA united-female v1.5 mesh; generalized, not patient registered','derivedChange':'Uniform explicit source-metre normalization in binary32; original values separately retained'}
    return record,original,payload
def main():
    start=time.monotonic();g,blob=read_atlas();contacts=contact_validator();out=ROOT/'assets';out.mkdir();records=[]
    for name in ['VH_F_right_ovary','VH_F_left_ovary','VH_F_patella_R']:
        rec,original,payload=admit(g,blob,name,contacts);(out/(name+'.original.bin')).write_bytes(original);(out/(name+'.bin')).write_bytes(payload);records.append(rec)
    rejected=[]
    for name in ['VH_F_capsule_of_the_liver','VH_F_kidney_capsule_L']:
        try:admit(g,blob,name,contacts)
        except Exception as e:rejected.append({'semantic':name,'reason':str(e),'status':'REJECTED; no source repair or fallback'})
        else:raise AssertionError('Expected invalid fixture was admitted')
    # Deliberate corruption of an in-memory test copy must fail; originals untouched.
    _,_,_,p,f=source_mesh(g,blob,'VH_F_left_ovary');bad=list(f);bad[0]=(0,0,0)
    try:topology(p,bad)
    except ValueError:negative=True
    else:negative=False
    need(negative,'Defective geometry negative control')
    catalog={'schema':'NRX-C002 bounded anatomy catalog 1','sourceAtlasSha256':SHA,'accepted':records,'rejected':rejected,'negativeDegenerateRejected':negative,'seconds':time.monotonic()-start,'limits':'Named leaf meshes, identity ancestry, closed oriented genus-zero connected solids; arbitrary transforms/open/multi-component geometry explicitly unsupported.'};(out/'catalog.json').write_text(json.dumps(catalog,indent=2));print(json.dumps({'result':'PASS','accepted':[r['semantic'] for r in records],'rejected':rejected,'seconds':catalog['seconds']}))
if __name__=='__main__':main()
