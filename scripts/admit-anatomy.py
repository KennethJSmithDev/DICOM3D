"""Source-driven atlas admission; no new geometry generation or patient registration.

WHY: complete held sources exceed the curated selection list. BOUNDARY: original
atlas metadata and disjoint new draw ownership. INVARIANT: baseline payloads/IDs
are retained. Helpers reuse the accepted selective binary adapters. The offline
catalog records exclusions instead of manufacturing labels or atlas registration.
"""
import argparse,array,collections,copy,csv,hashlib,json,math,pathlib,re,struct,zipfile
from reference_assets import GLB,sha,write,appender

p=argparse.ArgumentParser();p.add_argument('--base',required=True);p.add_argument('--male',required=True);p.add_argument('--female',required=True);p.add_argument('--output',required=True);p.add_argument('--evidence',required=True);p.add_argument('--classify-only',action='store_true');a=p.parse_args()
BASE=pathlib.Path(a.base);M=pathlib.Path(a.male);F=pathlib.Path(a.female);O=pathlib.Path(a.output);E=pathlib.Path(a.evidence);O.mkdir(parents=True,exist_ok=True);E.mkdir(parents=True,exist_ok=True)
def save(p,d):p.write_bytes((json.dumps(d,indent=2,ensure_ascii=False)+'\n').encode())
def table(n):return list(csv.DictReader((M/n).open(encoding='utf-8-sig'),delimiter='\t'))
assert sha(BASE/'bp3d-male.glb')=='dcbe513dbf1cef7ac12c03b6a1c53861680cb7f44f6a89c7dcb81e40ea66ee03'
assert sha(BASE/'hra-female.glb')=='9a26e88e0223969b18874f00bfa2e30dad36c8916db5d12af9b1736ceaf91b0b'
assert sha(M/'partof_BP3D_4.0_obj_99.zip')=='9fbc713fffeee924a5a657d9813d84d7eb957bded63adb854931dd5e3eb61c97'
assert sha(F)=='472567a56896b9b7890508da6501fbf858e56aaa30745365f7a71ade782b529c'
concepts=table('partof_parts_list_e.txt');relations=table('partof_inclusion_relation_list.txt');mapping=collections.defaultdict(set)
for r in table('partof_element_parts.txt'):mapping[r['concept id']].add(r['element file id'])
children=collections.defaultdict(list);parents=collections.defaultdict(list)
for r in relations:children[r['parent id']].append(r['child id']);parents[r['child id']].append(r['parent id'])
SYSTEMS=['FMA7152','FMA7157','FMA7158','FMA7159','FMA7160','FMA7161','FMA9668','FMA23881','FMA72979','FMA79063']
labels={r['concept id']:r['en'] for r in concepts}
def systems(elements):return [labels[k] for k in SYSTEMS if mapping[k]&set(elements)] or ['Unassigned source system']
bm=json.loads((BASE/'bp3d-male.manifest.json').read_text());fm=json.loads((BASE/'hra-female.manifest.json').read_text());members=json.loads((BASE/'bp3d-source-members.json').read_text());owners=collections.defaultdict(list)
for g in members:
 for m in g['members']:owners[m['element']].append(g['id'])
z=zipfile.ZipFile(M/'partof_BP3D_4.0_obj_99.zip');elements=[];new_groups=collections.defaultdict(list);payloads={}
def obj(data):
 positions=array.array('f');normals=array.array('f');indices=array.array('I')
 for line in data.decode().splitlines():
  if line.startswith('v '):x,y,z=map(float,line.split()[1:4]);positions.extend((x*.001,z*.001,-y*.001))
  elif line.startswith('vn '):x,y,z=map(float,line.split()[1:4]);normals.extend((x,z,-y))
  elif line.startswith('f '):
   f=[v.split('/') for v in line.split()[1:]]
   if len(f)!=3 or any(int(v[0])!=int(v[-1]) for v in f):raise ValueError('Unsupported separately indexed/nontriangular OBJ')
   indices.extend(int(v[0])-1 for v in f)
 if len(positions)!=len(normals) or not indices or min(indices)<0 or max(indices)>=len(positions)//3 or not all(math.isfinite(v) for v in positions):raise ValueError('Invalid geometry')
 return positions,normals,indices
for item in sorted(z.infolist(),key=lambda x:x.filename):
 if not item.filename.endswith('.obj'):continue
 raw=z.read(item);eid=pathlib.PurePosixPath(item.filename).stem;head={m.group(1).strip():m.group(2).strip() for line in raw.decode().splitlines()[:15] if (m:=re.match(r'# ([^:]+):\s*(.*)',line))};sid=head.get('Concept ID','');name=head.get('English name','');hold=None
 try:ps,ns,ix=obj(raw)
 except ValueError as err:hold='unsupported_or_unusable_geometry: '+str(err)
 if not sid or not name:hold='insufficient_source_identity: blank original concept and name'
 geometry_hash=hashlib.sha256(raw).hexdigest()
 kind='duplicate_or_shared_geometry_owner' if eid in owners else 'anatomical_subcomponent'
 rec={'element':eid,'member':item.filename,'source_concept':sid,'label':name,'source_sha256':geometry_hash,'existing_owners':owners.get(eid,[]),'classification':kind,'eligible_new':not hold and eid not in owners,'hold':hold,'previous_exclusion':'Already merged into accepted group; no duplicate draw' if eid in owners else 'Not selected by original hardcoded subset','systems':systems([eid])}
 if hold:rec['classification']='insufficient_source_identity' if hold.startswith('insufficient') else 'unsupported_or_unusable_geometry'
 if not hold:rec.update(vertices=len(ps)//3,triangles=len(ix)//3)
 elements.append(rec)
 if rec['eligible_new']:new_groups[sid].append(rec)
# Each new source-native concept owns its own disjoint element set. Parent FMA
# concepts remain filters/relationships; they are not extra copies of child draws.
male_parts=[]
for sid,items in sorted(new_groups.items()):
 names={x['label'] for x in items};label=labels.get(sid,next(iter(sorted(names))));ids=[x['element'] for x in items];complete=mapping.get(sid,set())==set(ids)
 male_parts.append({'id':sid,'label':label if complete else label+' (source components)','region':'Source atlas','skin':False,'systems':systems(ids),'source_concept':sid,'source_elements':ids,'representation_scope':'complete source concept membership' if complete else 'named source components; not complete parent geometry','classification':'independently_selectable_anatomical_structure' if complete and not children[sid] else 'anatomical_subcomponent'})
male_nodes=[{'id':x['concept id'],'label':x['en'],'parents':parents[x['concept id']],'children':children[x['concept id']],'classification':'semantic_group_container' if children[x['concept id']] else 'anatomical_subcomponent','elements':sorted(mapping[x['concept id']])} for x in concepts]
src=GLB(F);sn=src.doc['nodes'];parent={j:i for i,n in enumerate(sn) for j in n.get('children',[])}
def path(i):
 out=[i]
 while i in parent:i=parent[i];out.insert(0,i)
 return out
def desc(i):return {i}.union(*(desc(c) for c in sn[i].get('children',[])))
fowners={i:g['id'] for g in fm['reference']['structures'] for i in desc(g['source_node_index'])};female_nodes=[];female_parts=[];seen_payload={}
name_counts=collections.Counter(n.get('name') for n in sn)
for i,n in enumerate(sn):
 ancestry=path(i);names=[sn[j].get('name','') for j in ancestry];ext=n.get('extras',{});hold=None;kind='semantic_group_container' if 'mesh' not in n else 'anatomical_subcomponent';signature=None
 if any(s.startswith(('Allen','Yao')) or s in ['VH_F_placenta','VH_F_umbilical'] for s in names):hold='licensing_or_attribution_hold: external/pregnancy component provenance/registration not admitted'
 elif 'mesh' in n:
  if ext.get('source_spatial_entity')!='#VHFemaleOrgans' or not ext.get('ontologyid') or not ext.get('label'):hold='insufficient_source_identity'
  elif any(k in sn[j] for j in ancestry for k in ['matrix','translation','rotation','scale']):hold='unsupported_or_unusable_geometry: unreviewed source transform'
  else:
   h=hashlib.sha256()
   for prim in src.doc['meshes'][n['mesh']]['primitives']:
    for k,acc in sorted(prim['attributes'].items()):h.update(k.encode());h.update(src.payload(acc))
    h.update(src.payload(prim['indices']))
   signature=h.hexdigest()
   if signature in seen_payload:hold='duplicate_or_shared_geometry_owner: exact payload at node '+str(seen_payload[signature])
   else:seen_payload[signature]=i
 if i in fowners:kind='duplicate_or_shared_geometry_owner' if 'mesh' in n else 'semantic_group_container'
 if hold:kind=hold.split(':')[0]
 rec={'index':i,'id':n.get('name'),'label':ext.get('label',n.get('name')),'parents':[sn[parent[i]].get('name')] if i in parent else [],'children':[sn[j].get('name') for j in n.get('children',[])],'source_annotation':ext,'classification':kind,'existing_owner':fowners.get(i),'eligible_new':not hold and 'mesh' in n and i not in fowners,'hold':hold,'geometry_fingerprint':signature,'previous_exclusion':'Already inside accepted subtree; own descendant draw not separable without reownership' if i in fowners else 'Explicit component hold' if hold else 'Not selected by original curated roots','systems':[sn[ancestry[1]]['name'].removeprefix('VH_F_').replace('_',' ')] if len(ancestry)>1 else []}
 female_nodes.append(rec)
 if rec['eligible_new']:
  sid=n['name'] if name_counts[n['name']]==1 else 'hra.node.'+str(i)
  female_parts.append({'id':sid,'label':ext['label'],'region':'Source atlas','skin':False,'systems':rec['systems'],'source_node_index':i,'source_name':n['name'],'source_annotation':ext,'classification':'anatomical_subcomponent'})
catalog={'revision':'ANAT-EXPAND-002','male':{'elements':elements,'concepts':male_nodes,'eligible_groups':male_parts},'female':{'nodes':female_nodes,'eligible_groups':female_parts},'limits':'Mesh count is not organ count. Existing merged/subtree descendants remain metadata-only unless separately reowned. External atlases are not registered.'}
save(E/'classification.json',catalog)
summary={'male':{'source_elements':len(elements),'source_concepts':len(male_nodes),'eligible_new_groups':len(male_parts),'eligible_new_elements':sum(len(p['source_elements']) for p in male_parts),'holds':dict(collections.Counter(x['hold'] for x in elements if x['hold']))},'female':{'source_nodes':len(sn),'source_meshes':len(src.doc['meshes']),'eligible_new_groups':len(female_parts),'holds':dict(collections.Counter(x['classification'] for x in female_nodes if x['hold']))}}
save(E/'classification-summary.json',summary)
if a.classify_only:print(json.dumps(summary));sys_exit=__import__('sys').exit;sys_exit(0)
fingerprint=hashlib.sha256(pathlib.Path(__file__).read_bytes().replace(b'\r\n',b'\n')+pathlib.Path(__file__).with_name('reference_assets.py').read_bytes().replace(b'\r\n',b'\n')).hexdigest();admission={'revision':'ANAT-EXPAND-002','generator_canonical_lf_sha256':fingerprint,'sources':{'male_archive':sha(M/'partof_BP3D_4.0_obj_99.zip'),'female_original':sha(F)},'variants':[]}
for variant,manifest,parts in [('bp3d-male',bm,male_parts),('hra-female',fm,female_parts)]:
 base=GLB(BASE/(variant+'.glb'));d=copy.deepcopy(base.doc);blob,append=appender(d,base);V=T=0;member_provenance=copy.deepcopy(members)
 for old in manifest['reference']['structures']:
  old['systems']=systems([m['element'] for g in members if g['id']==old['id'] for m in g['members']]) if variant=='bp3d-male' else female_nodes[old['source_node_index']]['systems']
 for part in parts:
  mesh=len(d['meshes']);node=len(d['nodes']);sid=part['id']
  if variant=='bp3d-male':
   ps=array.array('f');ns=array.array('f');ix=array.array('I')
   for rec in new_groups[sid]:
    pp,nn,ii=obj(z.read(rec['member']));offset=len(ps)//3;ps.extend(pp);ns.extend(nn);ix.extend(v+offset for v in ii)
   count=len(ps)//3;lo=[min(ps[k::3]) for k in range(3)];hi=[max(ps[k::3]) for k in range(3)];pa=append(ps.tobytes(),{'componentType':5126,'count':count,'type':'VEC3','min':lo,'max':hi});na=append(ns.tobytes(),{'componentType':5126,'count':count,'type':'VEC3'});ia=append(ix.tobytes(),{'componentType':5125,'count':len(ix),'type':'SCALAR'});V+=count;T+=len(ix)//3
   mat=len(d['materials']);color=[.65,.22,.24,1] if any('cardiovascular' in s for s in part['systems']) else [.75,.63,.44,1]
   d['materials'].append({'name':sid,'doubleSided':True,'alphaMode':'OPAQUE','pbrMetallicRoughness':{'baseColorFactor':color,'roughnessFactor':.48,'metallicFactor':.06}});d['meshes'].append({'name':sid,'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'indices':ia,'material':mat}]});d['nodes'].append({'name':sid,'mesh':mesh,'extras':{'sourceConcept':sid,'sourceElements':part['source_elements']}})
   member_provenance.append({'id':sid,'label':part['label'],'members':[{'element':rec['element'],'path':rec['member'],'sha256':rec['source_sha256'],'vertices':rec['vertices'],'triangles':rec['triangles'],'license_header':z.read(rec['member']).decode().splitlines()[1],'license_url':z.read(rec['member']).decode().splitlines()[2]} for rec in new_groups[sid]],'vertices':count,'triangles':len(ix)//3,'bounds_m':[lo,hi]})
  else:
   original=sn[part['source_node_index']];m=copy.deepcopy(src.doc['meshes'][original['mesh']])
   for prim in m['primitives']:
    V+=src.doc['accessors'][prim['attributes']['POSITION']]['count'];T+=src.doc['accessors'][prim['indices']]['count']//3
    prim['indices']=append(src.payload(prim['indices']),src.doc['accessors'][prim['indices']]);prim['attributes']={k:append(src.payload(v),src.doc['accessors'][v]) for k,v in prim['attributes'].items()}
   d['meshes'].append(m);d['nodes'].append({'name':sid,'mesh':mesh,'extras':{**original.get('extras',{}),'sourceNodeIndex':part['source_node_index']}})
  d['nodes'][0]['children'].append(node)
 target=O/(variant+'.glb');write(target,d,base,blob);manifest['reference']['structures']+=parts
 hierarchy=male_nodes if variant=='bp3d-male' else [{'id':x['id'],'label':x['label'],'parents':x['parents'],'children':x['children']} for x in female_nodes]
 manifest['reference']['hierarchy']=hierarchy
 manifest['asset']['sha256']=sha(target);manifest['cost'].update(glb_bytes=target.stat().st_size,vertices=manifest['cost']['vertices']+V,triangles=manifest['cost']['triangles']+T,geometry_buffer_bytes=base.length+len(blob),semantic_structures=len(manifest['reference']['structures']))
 manifest['provenance']['derived_revision']={'id':'ANAT-EXPAND-002','baseline_sha256':sha(BASE/(variant+'.glb')),'generator_canonical_lf_sha256':fingerprint,'operation':'Append disjoint named source geometry; original geometry/IDs retained; source hierarchy indexed; no field or smoothing'}
 save(O/(variant+'.manifest.json'),manifest)
 if variant=='bp3d-male':save(O/'bp3d-source-members.json',member_provenance)
 admission['variants'].append({'variant':variant,'new_groups':len(parts),'total_groups':len(manifest['reference']['structures']),'added_vertices':V,'added_triangles':T,'added_geometry_bytes':len(blob),'glb_bytes':target.stat().st_size,'glb_sha256':sha(target)});base.close()
src.close();save(O/'anatomy-admission.json',admission);save(E/'admission.json',admission);print(json.dumps(admission['variants']))
