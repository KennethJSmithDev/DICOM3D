"""ANAT-EXPAND-001: append six pinned atlas structures to accepted mesh subsets.

WHY: source geometry exists outside the admitted catalog. BOUNDARY: selective
offline atlas admission only. INVARIANT: existing geometry/IDs remain unchanged.
Reuse: legacy build-anatomy.py's OBJ basis/index adapter and
build-female-reference.py's exact accessor copying. No runtime dependency.
"""
import array, copy, csv, hashlib, json, mmap, pathlib, struct, sys, zipfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=pathlib.Path(sys.argv[1]); MALE=pathlib.Path(sys.argv[2]); FEMALE=pathlib.Path(sys.argv[3]); EVIDENCE=pathlib.Path(sys.argv[4])
OUT=ROOT/'reference/public/reference'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def save(p,d):p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
class GLB:
 def __init__(self,p):
  self.file=p.open('rb');self.mm=mmap.mmap(self.file.fileno(),0,access=mmap.ACCESS_READ)
  assert self.mm[:4]==b'glTF';size,kind=struct.unpack_from('<II',self.mm,12);assert kind==0x4e4f534a
  self.doc=json.loads(self.mm[20:20+size]);self.start=28+size
  self.length,self.kind=struct.unpack_from('<II',self.mm,20+size);assert self.kind==0x004e4942
 def payload(self,index):
  a=self.doc['accessors'][index];v=self.doc['bufferViews'][a['bufferView']]
  lanes={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4};width={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}
  size=lanes[a['type']]*width[a['componentType']];offset=self.start+v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size)
  assert 'sparse' not in a
  return self.mm[offset:offset+a['count']*size] if stride==size else b''.join(self.mm[offset+i*stride:offset+i*stride+size] for i in range(a['count']))
 def close(self):self.mm.close();self.file.close()
def write(p,d,base,extra):
 size=base.length+len(extra);assert size<=128*1048576
 d['buffers']=[{'byteLength':size}];j=json.dumps(d,separators=(',',':'),ensure_ascii=True).encode();j+=b' '*(-len(j)%4);pad=b'\0'*(-size%4)
 with p.open('wb') as f:
  f.write(struct.pack('<IIIII',0x46546c67,2,28+len(j)+size+len(pad),len(j),0x4e4f534a));f.write(j);f.write(struct.pack('<II',size+len(pad),0x004e4942))
  for off in range(0,base.length,1048576):f.write(base.mm[base.start+off:base.start+min(off+1048576,base.length)])
  f.write(extra);f.write(pad)
def appender(d,base):
 blob=bytearray()
 def append(raw,template):
  blob.extend(b'\0'*(-(base.length+len(blob))%4));offset=base.length+len(blob);blob.extend(raw)
  a=copy.deepcopy(template);a['bufferView']=len(d['bufferViews']);a.pop('byteOffset',None)
  d['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)});d['accessors'].append(a);return len(d['accessors'])-1
 return blob,append
def update(manifest,p,extra_v,extra_t,geometry,parts,source):
 manifest['asset']['sha256']=sha(p);manifest['reference']['structures'].extend(parts)
 manifest['cost'].update(glb_bytes=p.stat().st_size,geometry_buffer_bytes=geometry,vertices=manifest['cost']['vertices']+extra_v,triangles=manifest['cost']['triangles']+extra_t,semantic_structures=len(manifest['reference']['structures']))
 manifest['provenance']['derived_revision']={'id':'ANAT-EXPAND-001','baseline_asset_sha256':source,'operation':'Append six approved same-source structures across male/female assemblies; original geometry and selection IDs retained','generator_sha256':sha(pathlib.Path(__file__))}

assert sha(BASE/'bp3d-male.glb')=='dcef47dc21d252b93b288b649ac30795d9de73f733c27b285f8d1a43ae4fc055'
assert sha(BASE/'hra-female.glb')=='a61a60841fd3c8308d332421385be03188c0babd58b78ae101adf2807a88473a'
assert sha(MALE/'partof_BP3D_4.0_obj_99.zip')=='9fbc713fffeee924a5a657d9813d84d7eb957bded63adb854931dd5e3eb61c97'
assert sha(MALE/'partof_element_parts.txt')=='3f5f6df1028eb122b30de77c711597b6bb8e5541658e5985859fd228adbf88ea'
assert sha(FEMALE)=='472567a56896b9b7890508da6501fbf858e56aaa30745365f7a71ade782b529c'
report={'operation':'ANAT-EXPAND-001','accessors':[],'male':[],'female':[]}
b=GLB(BASE/'bp3d-male.glb');d=copy.deepcopy(b.doc);extra,append=appender(d,b);manifest=json.loads((BASE/'bp3d-male.manifest.json').read_text());parts=[];provenance=json.loads((BASE/'bp3d-source-members.json').read_text());V=T=0
with zipfile.ZipFile(MALE/'partof_BP3D_4.0_obj_99.zip') as z:
 paths={pathlib.PurePosixPath(n).stem:n for n in z.namelist() if n.endswith('.obj')}
 specs=[('FMA7202','FJ2817','Gallbladder','Abdomen',[.25,.56,.3,1]),('FMA9600','FJ3139','Prostate','Pelvis',[.72,.43,.5,1]),('FMA15629','FJ3130','Right adrenal gland','Abdomen',[.9,.68,.25,1]),('FMA15630','FJ3129','Left adrenal gland','Abdomen',[.9,.68,.25,1])]
 rows=list(csv.DictReader((MALE/'partof_element_parts.txt').open(encoding='utf-8'),delimiter='\t'))
 for sid,eid,label,region,color in specs:
  assert {x['element file id'] for x in rows if x['concept id']==sid}=={eid}
  assert not any(x['id']==sid for x in manifest['reference']['structures'])
  raw=z.read(paths[eid]);text=raw.decode();ps=array.array('f');ns=array.array('f');ix=array.array('I');vn=0
  for line in text.splitlines():
   if line.startswith('v '):x,y,zv=map(float,line.split()[1:4]);ps.extend((x*.001,zv*.001,-y*.001))
   elif line.startswith('vn '):x,y,zv=map(float,line.split()[1:4]);ns.extend((x,zv,-y));vn+=1
   elif line.startswith('f '):
    face=[x.split('/') for x in line.split()[1:]];assert len(face)==3
    assert all(int(x[0])==int(x[-1]) for x in face);ix.extend(int(x[0])-1 for x in face)
  n=len(ps)//3;assert vn==n and min(ix)>=0 and max(ix)<n
  lo=[min(ps[k::3]) for k in range(3)];hi=[max(ps[k::3]) for k in range(3)]
  pa=append(ps.tobytes(),{'componentType':5126,'count':n,'type':'VEC3','min':lo,'max':hi});na=append(ns.tobytes(),{'componentType':5126,'count':n,'type':'VEC3'});ia=append(ix.tobytes(),{'componentType':5125,'count':len(ix),'type':'SCALAR'})
  material=len(d['materials']);d['materials'].append({'name':label,'doubleSided':True,'alphaMode':'OPAQUE','pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':.06,'roughnessFactor':.48}})
  mesh=len(d['meshes']);d['meshes'].append({'name':sid,'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'indices':ia,'material':material}]})
  node=len(d['nodes']);d['nodes'].append({'name':sid,'mesh':mesh,'extras':{'semanticId':sid,'source':'BodyParts3D 4.0','sourceElement':eid}});d['nodes'][0]['children'].append(node)
  part={'id':sid,'label':label,'region':region,'skin':False,'source_annotation':{'ontology_id':sid,'element_id':eid,'atlas':'BodyParts3D 4.0'}};parts.append(part)
  member={'element':eid,'path':paths[eid],'sha256':hashlib.sha256(raw).hexdigest(),'vertices':n,'triangles':len(ix)//3,'license_header':text.splitlines()[1],'license_url':text.splitlines()[2]}
  provenance.append({'id':sid,'label':label.lower(),'members':[member],'vertices':n,'triangles':len(ix)//3,'bounds_m':[lo,hi]});report['male'].append({'id':sid,'element':eid,'vertices':n,'triangles':len(ix)//3,'bounds_m':[lo,hi]});V+=n;T+=len(ix)//3
path=OUT/'bp3d-male.glb';write(path,d,b,extra);update(manifest,path,V,T,b.length+len(extra),parts,sha(BASE/'bp3d-male.glb'));save(OUT/'bp3d-male.manifest.json',manifest);save(OUT/'bp3d-source-members.json',provenance);report['male_extra_geometry_bytes']=len(extra);b.close()

b=GLB(BASE/'hra-female.glb');s=GLB(FEMALE);d=copy.deepcopy(b.doc);extra,append=appender(d,b);manifest=json.loads((BASE/'hra-female.manifest.json').read_text());parts=[];V=T=0
assert all(not any(k in n for k in ['matrix','translation','rotation','scale']) for n in s.doc['nodes'])
seen=set()
def node(i):
 global V,T
 assert i not in seen;seen.add(i);n=copy.deepcopy(s.doc['nodes'][i]);out=len(d['nodes']);d['nodes'].append(n);n['extras']={**n.get('extras',{}),'sourceNodeIndex':i,'sourceReference':'HRA united-female v1.5'}
 if 'mesh' in n:
  mesh=copy.deepcopy(s.doc['meshes'][n['mesh']]);n['mesh']=len(d['meshes']);d['meshes'].append(mesh)
  for p in mesh['primitives']:
   # The accepted female derivative retained source material order unchanged.
   assert p.get('material',0)<len(d['materials'])
   V+=s.doc['accessors'][p['attributes']['POSITION']]['count'];T+=s.doc['accessors'][p['indices']]['count']//3
   def cp(a):
    raw=s.payload(a);new=append(raw,s.doc['accessors'][a]);report['accessors'].append({'source_node':i,'source_accessor':a,'derived_accessor':new,'sha256':hashlib.sha256(raw).hexdigest()});return new
   p['indices']=cp(p['indices']);p['attributes']={k:cp(v) for k,v in p['attributes'].items()}
 if 'children' in n:n['children']=[node(c) for c in n['children']]
 return out
for i,label,region in [(559,'Gallbladder','Abdomen'),(950,'Thymus','Thorax')]:
 sid=s.doc['nodes'][i]['name'];assert not any(x['id']==sid for x in manifest['reference']['structures']);d['nodes'][0]['children'].append(node(i))
 parts.append({'id':sid,'label':label,'region':region,'skin':False,'source_node_index':i,'source_annotation':copy.deepcopy(s.doc['nodes'][i].get('extras',{}))});report['female'].append({'id':sid,'source_node_index':i})
path=OUT/'hra-female.glb';write(path,d,b,extra);update(manifest,path,V,T,b.length+len(extra),parts,sha(BASE/'hra-female.glb'));save(OUT/'hra-female.manifest.json',manifest);report['female_extra_geometry_bytes']=len(extra);b.close();s.close()

# Source-backed metadata sidecar: source IDs are not a patient registration.
catalog={'revision':'ANAT-EXPAND-001','scope':'Source annotations and hierarchy, not cross-atlas spatial registration','male':{'source_version':'BodyParts3D 4.0','concepts':list(csv.DictReader((MALE/'partof_parts_list_e.txt').open(encoding='utf-8-sig'),delimiter='\t')),'part_of':list(csv.DictReader((MALE/'partof_inclusion_relation_list.txt').open(encoding='utf-8-sig'),delimiter='\t'))},'female':{'source_version':'HRA united-female v1.5','annotations':[]}}
s=GLB(FEMALE)
for i,n in enumerate(s.doc['nodes']):
 if n.get('extras',{}).get('ontologyid'):catalog['female']['annotations'].append({'node':i,'name':n['name'],**n['extras']})
s.close();save(OUT/'anatomy-source-catalog.json',catalog)
save(EVIDENCE/'admission.json',report)
print(json.dumps({'male_extra_geometry_bytes':report['male_extra_geometry_bytes'],'female_extra_geometry_bytes':report['female_extra_geometry_bytes'],'structures':[x['id'] for x in report['male']+report['female']]}))
