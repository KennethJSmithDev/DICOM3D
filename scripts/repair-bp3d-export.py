"""Restore two pinned BP3D 4.0 export omissions without rewriting prior bundles.

Run with --atlas <expanded-atlas> --source-dir <original BP3D directory>
--evidence <new private output directory>. A second run verifies identical results.
Only source membership is repaired; native blank concept/label headers stay null.
No source download, new ontology, mirroring, clinical claim, or 4.3i admission.
"""
import argparse,array,collections,copy,csv,hashlib,json,math,pathlib,re,struct,sys,time,zipfile
from reference_assets import GLB

BASE_INDEX='d3335ceea378eedad9b3fd9c5f01572b6c048946392a32aaaff58479dc0b53a7'
BASE_CATALOG='231608fa3848f86cb3caeec217def43b35a258f07283ed31123a214b1d079a42'
PINS={
 'partof_BP3D_4.0_obj_99.zip':'9fbc713fffeee924a5a657d9813d84d7eb957bded63adb854931dd5e3eb61c97',
 'partof_parts_list_e.txt':'9224080557053e6f1322f1e13ab27f0ecde0db19bb3b505f0631afad230eeebd',
 'partof_inclusion_relation_list.txt':'1b40738270931e3c1d955ce34e0fce0d8d10d8c5ad543463e40b4b4c0243007c',
 'partof_element_parts.txt':'3f5f6df1028eb122b30de77c711597b6bb8e5541658e5985859fd228adbf88ea'}
ELEMENTS={'FJ1450':'b12a96b70122e6a6778ad4cce9ac9cd391f9962da20f7788f909fd6992ed71dc','FJ1656':'d880c6af8c943e02b081e05737955de906b505858fa212c9f53ee3fc755702aa'}
BUNDLE='source-table-repairs';GLB_NAME='male-source-table-repairs.glb';MANIFEST_NAME='male-source-table-repairs.manifest.json'
SYSTEMS=['FMA7152','FMA7157','FMA7158','FMA7159','FMA7160','FMA7161','FMA9668','FMA23881','FMA72979','FMA79063']
def digest(data):return hashlib.sha256(data).hexdigest()
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def encode(v):return (json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode()
def require(ok,message):
 if not ok:raise ValueError(message)
def parse_obj(raw):
 p=array.array('f');n=array.array('f');ix=array.array('I');head={}
 for line in raw.decode().splitlines():
  if line.startswith('# ') and ':'in line:
   key,value=line[2:].split(':',1);head[key.strip()]=value.strip()
  elif line.startswith('v '):x,y,z=map(float,line.split()[1:]);p.extend((x*.001,z*.001,-y*.001))
  elif line.startswith('vn '):x,y,z=map(float,line.split()[1:]);n.extend((x,z,-y))
  elif line.startswith('f '):
   face=[v.split('/')for v in line.split()[1:]]
   require(len(face)==3 and all(len(v)==3 and int(v[0])==int(v[2])for v in face),'Unsupported OBJ indices')
   ix.extend(int(v[0])-1 for v in face)
 require(sys.byteorder=='little' and p.itemsize==4 and ix.itemsize==4,'Requires little-endian Float32/Uint32')
 require(len(p)==len(n) and bool(ix) and min(ix)>=0 and max(ix)<len(p)//3,'Invalid OBJ geometry')
 require(all(math.isfinite(v)for v in p) and all(math.isfinite(v)for v in n),'Non-finite source data')
 return head,p,n,ix
def geometry_digest(p,n,ix):return digest(p+n+ix)
def make_glb(parts):
 d={'asset':{'version':'2.0','generator':'DICOM3D pinned BP3D export repair'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'BP3D40-source-table-repairs','children':[]}],'meshes':[],'materials':[],'accessors':[],'bufferViews':[]};blob=bytearray()
 def append(raw,template):
  blob.extend(b'\0'*(-len(blob)%4));offset=len(blob);blob.extend(raw);v=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)});d['accessors'].append(dict(template,bufferView=v));return len(d['accessors'])-1
 for item in parts:
  p,n,ix=item['arrays'];sid=item['owner']['id'];lo=[min(p[k::3])for k in range(3)];hi=[max(p[k::3])for k in range(3)]
  pa=append(p.tobytes(),{'componentType':5126,'count':len(p)//3,'type':'VEC3','min':lo,'max':hi});na=append(n.tobytes(),{'componentType':5126,'count':len(n)//3,'type':'VEC3'});ia=append(ix.tobytes(),{'componentType':5125,'count':len(ix),'type':'SCALAR'})
  mat=len(d['materials']);color=[.65,.22,.24,1]if 'cardiovascular system'in item['owner']['systems']else[.75,.63,.44,1]
  d['materials'].append({'name':sid,'doubleSided':True,'alphaMode':'OPAQUE','pbrMetallicRoughness':{'baseColorFactor':color,'roughnessFactor':.48,'metallicFactor':.06}})
  mesh=len(d['meshes']);d['meshes'].append({'name':sid,'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'indices':ia,'material':mat}]});d['nodes'][0]['children'].append(len(d['nodes']));d['nodes'].append({'name':sid,'mesh':mesh,'extras':{'sourceConcept':None,'sourceElements':[item['element']],'sourceVersion':'4.0','identityBasis':'PINNED_ARCHIVE_ELEMENT_AND_PARTOF_TABLE'}})
 d['buffers']=[{'byteLength':len(blob)}];j=encode(d).rstrip(b'\n');j+=b' '*(-len(j)%4);blob.extend(b'\0'*(-len(blob)%4))
 return struct.pack('<IIIII',0x46546c67,2,28+len(j)+len(blob),len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob
def main():
 start=time.perf_counter();p=argparse.ArgumentParser(description=__doc__);p.add_argument('--atlas',type=pathlib.Path,required=True);p.add_argument('--source-dir',type=pathlib.Path,required=True);p.add_argument('--evidence',type=pathlib.Path,required=True);p.add_argument('--supersede-owned-repair',action='store_true',help='Preserve and replace only outputs matching this evidence receipt');a=p.parse_args();atlas=a.atlas.resolve();evidence=a.evidence.resolve();source=a.source_dir.resolve()
 require(atlas!=source and not evidence.is_relative_to(source),'Evidence/output must not alter original source')
 for name,pin in PINS.items():require(sha(source/name)==pin,'Source pin mismatch: '+name)
 current_index=(atlas/'index.json').read_bytes();current_catalog=(atlas/'source-native.json').read_bytes();replay=sha(atlas/'index.json')!=BASE_INDEX
 if replay:
  require((evidence/'baseline-index.json').exists()and(evidence/'baseline-source-native.json').exists(),'Unexpected atlas baseline; supply original repair evidence for replay')
  original_index=(evidence/'baseline-index.json').read_bytes();original_catalog=(evidence/'baseline-source-native.json').read_bytes()
 else:original_index=current_index;original_catalog=current_catalog
 require(digest(original_index)==BASE_INDEX and digest(original_catalog)==BASE_CATALOG,'Baseline pin mismatch')
 old_index=json.loads(original_index);old_catalog=json.loads(original_catalog);index=copy.deepcopy(old_index);catalog=copy.deepcopy(old_catalog)
 require(len(index['bundles'])==15 and len(index['structures'])==1186,'Unexpected baseline owner set')
 for b in index['bundles']:
  require(sha(atlas/b['url'])==b['sha256'],'Existing bundle changed: '+b['id']);require(sha(atlas/b['manifestUrl'])==b['manifestSha256'],'Existing manifest changed: '+b['id'])
 def table(name):
  with (source/name).open(encoding='utf-8-sig',newline='')as f:return list(csv.DictReader(f,delimiter='\t'))
 labels={r['concept id']:r['en']for r in table('partof_parts_list_e.txt')};members=collections.defaultdict(set);by_element=collections.defaultdict(list)
 for r in table('partof_element_parts.txt'):members[r['concept id']].add(r['element file id']);by_element[r['element file id']].append(r['concept id'])
 parts=[]
 with zipfile.ZipFile(source/'partof_BP3D_4.0_obj_99.zip')as z:
  for element,pin in ELEMENTS.items():
   matches=[n for n in z.namelist()if pathlib.PurePosixPath(n).stem==element and n.endswith('.obj')];require(len(matches)==1,'Ambiguous original element');raw=z.read(matches[0]);require(digest(raw)==pin,'Element pin mismatch');head,ps,ns,ix=parse_obj(raw)
   require(head.get('File ID')==element and not head.get('Concept ID')and not head.get('English name'),'Unexpected native source metadata')
   cid=sorted(set(by_element[element]));require(cid and all(c in labels for c in cid),'Missing named source membership');source_id='BP3D40:'+element;sid='BP3D40_'+element;label='BodyParts3D 4.0 source element '+element;systems=[labels[k]for k in SYSTEMS if element in members[k]]
   owner={'id':sid,'bundleId':BUNDLE,'label':label,'region':'Source atlas','skin':False,'systems':systems,'source_concept':None,'source_elements':[element],'classification':'anatomical_subcomponent','identity_basis':'PINNED_ARCHIVE_ELEMENT_AND_PARTOF_TABLE','source_membership_ids':cid,'representation_scope':'Exact source element; published PART-OF memberships; native concept and label unavailable','source_annotation':{'atlas':'BodyParts3D 4.0','element_id':element,'native_concept_id':None,'native_label':None}}
   bounds=[[min(ps[k::3])for k in range(3)],[max(ps[k::3])for k in range(3)]]
   atom={'id':source_id,'sourceId':source_id,'version':'4.0','elementId':element,'ownerId':sid,'bundleId':BUNDLE,'vertexStart':0,'vertexCount':len(ps)//3,'indexStart':0,'indexCount':len(ix),'sourceConceptId':None,'conceptIds':cid,'label':label,'sourceSha256':pin,'boundsModel':bounds,'geometryAliasOf':None,'physicalSpanId':sid+':0:'+str(len(ix)),'verified':{'position':True,'normal':True,'index':True,'indexRange':True},'membershipBasis':'PINNED_BP3D40_COMPOUND_ELEMENT_TABLE','nativeSourceLabel':None,'nativeRepresentationId':None}
   parts.append({'element':element,'owner':owner,'atom':atom,'arrays':(ps,ns,ix),'header':head,'member':matches[0],'notices':[s for s in raw.decode().splitlines()[:15]if s.startswith('#')],'geometrySha256':geometry_digest(ps.tobytes(),ns.tobytes(),ix.tobytes())})
 require(len({p['geometrySha256']for p in parts})==2,'Repair elements duplicate each other')
 # Check source spans against all existing physical atoms, including merged owners.
 checks=0;source_fingerprints={x['geometrySha256']for x in parts};seen=set()
 for b in old_index['bundles']:
  glb=GLB(atlas/b['url']);nodes={n.get('name'):n for n in glb.doc['nodes']}
  for atom in old_catalog['atoms']:
   if atom['bundleId']!=b['id']or atom['physicalSpanId']in seen:continue
   seen.add(atom['physicalSpanId']);primitive=glb.doc['meshes'][nodes[atom['ownerId']]['mesh']]['primitives'][0];v0=atom['vertexStart']*12;v1=v0+atom['vertexCount']*12;pos=glb.payload(primitive['attributes']['POSITION'])[v0:v1];normal=glb.payload(primitive['attributes']['NORMAL'])[v0:v1];accessor=glb.doc['accessors'][primitive['indices']];kind={5123:'H',5125:'I'}[accessor['componentType']];whole=array.array(kind);whole.frombytes(glb.payload(primitive['indices']));local=array.array('I',(i-atom['vertexStart']for i in whole[atom['indexStart']:atom['indexStart']+atom['indexCount']]));require(geometry_digest(pos,normal,local.tobytes())not in source_fingerprints,'Repair duplicates an existing exact physical span');checks+=1
  glb.close()
 old_ids={x['id']for x in catalog['atoms']};require(not old_ids.intersection(x['atom']['id']for x in parts),'Duplicate repair source ID')
 for item in parts:
  catalog['atoms'].append(item['atom']);catalog['owners'].append(item['owner']);index['structures'].append(item['owner']);catalog['ownerMappings'].append({'id':item['owner']['id'],'systems':item['owner']['systems'],'sourceClassificationIds':item['atom']['conceptIds'],'mappingEvidence':[{'relation':'PART_OF','basis':'PINNED_BP3D40_COMPOUND_ELEMENT_TABLE','elementId':item['element'],'classificationIds':item['atom']['conceptIds'],'nativeSourceConceptId':None}]})
 changed=[]
 for concept in catalog['concepts']:
  if concept['relation']!='PART_OF':continue
  added=[x for x in parts if concept['id']in by_element[x['element']]]
  if not added:continue
  require(concept['scope']=='PARTIAL'and set(concept['missingElements'])=={x['element']for x in added},'Unexpected missing-members set')
  concept['atomIds']=sorted(set(concept['atomIds'])|{x['atom']['id']for x in added});concept['ownerIds']=sorted(set(concept['ownerIds'])|{x['owner']['id']for x in added});concept['missingElements']=[];concept['scope']='EXACT_COMPOUND';changed.append(concept['key'])
 require(len(changed)==27,'Expected all 27 PART-OF compounds')
 for node in index['hierarchy']:
  added=[x['owner']['id']for x in parts if node['id']in by_element[x['element']]]
  if added:node['owner_ids']=sorted(set(node.get('owner_ids',[]))|set(added));node['ownership_scope']='PROVIDED_THROUGH_EXISTING_OWNER'
 catalog['limits']=[s.replace('Existing held geometry is not admitted.','Existing held 4.3i geometry is not admitted. Two table-backed 4.0 export omissions are restored.')for s in catalog['limits']]
 catalog['exportRepairs']=[{'id':'BP3D40-BLANK-HEADER-EXPORT-001','baseCatalogSha256':BASE_CATALOG,'sourceArchiveSha256':PINS['partof_BP3D_4.0_obj_99.zip'],'membershipTableSha256':PINS['partof_element_parts.txt'],'atomIds':[x['atom']['id']for x in parts],'nativeConceptIdsPreservedNull':True,'changedConceptKeys':changed}]
 atom_by_id={x['id']:x for x in catalog['atoms']}
 for concept in catalog['concepts']:
  if concept['relation']=='PART_OF':require(concept['scope']=='EXACT_COMPOUND'and not concept['missingElements']and {atom_by_id[i]['elementId']for i in concept['atomIds']}==members[concept['id']],'PART-OF membership mismatch: '+concept['id'])
 old_by_key={x['key']:x for x in old_catalog['concepts']}
 require(all(c==old_by_key[c['key']]for c in catalog['concepts']if c['key']not in changed),'Unrelated concept changed')
 require(catalog['heldSourceEntries']==old_catalog['heldSourceEntries'],'Held entries changed')
 require(catalog['owners'][:-2]==old_catalog['owners']and catalog['atoms'][:-2]==old_catalog['atoms']and catalog['ownerMappings'][:-2]==old_catalog['ownerMappings'],'Existing catalog records changed')
 blob=make_glb(parts);asset_sha=digest(blob)
 manifest={'asset':{'relative_filename':GLB_NAME,'sha256':asset_sha,'model_space':index['source']['modelSpace'],'units':'metres'},'structure':{'semantic_id':'reference.body.bp3d.male'},'reference':{'id':index['source']['referenceId'],'variant':'male','representation':'original source element surfaces','mapping_notice':'These versioned source elements have published PART-OF membership and blank native Concept ID/English name headers. Compounds select exact source spans.','mapping_revision':'BP3D40-BLANK-HEADER-EXPORT-001','structures':[x['owner']for x in parts]},'cost':{'glb_bytes':len(blob),'vertices':sum(len(x['arrays'][0])//3 for x in parts),'triangles':sum(len(x['arrays'][2])//3 for x in parts),'geometry_buffer_bytes':sum(sum(len(v)*v.itemsize for v in x['arrays'])for x in parts),'semantic_structures':2},'provenance':{'archive_sha256':PINS['partof_BP3D_4.0_obj_99.zip'],'semantic_map_sha256':PINS['partof_element_parts.txt'],'operation':'Export two original source elements omitted by a native-header-only gate; retain original source array transform and source membership.','source_to_reference_m':[[.001,0,0,0],[0,0,.001,0],[0,-.001,0,0],[0,0,0,1]],'license_decision':'Existing accepted BodyParts3D decision unchanged; original embedded notices retained.','source_members':[{'element':x['element'],'member':x['member'],'sha256':x['atom']['sourceSha256'],'native_concept_id':None,'native_label':None,'notices':x['notices']}for x in parts]}}
 manifest_bytes=encode(manifest);catalog_bytes=encode(catalog);index['bundles'].append({'id':BUNDLE,'url':GLB_NAME,'manifestUrl':MANIFEST_NAME,'byteLength':len(blob),'sha256':asset_sha,'manifestSha256':digest(manifest_bytes),'structureIds':[x['owner']['id']for x in parts]});index['sourceNative']={**index['sourceNative'],'sha256':digest(catalog_bytes),'byteLength':len(catalog_bytes)};index_bytes=encode(index)
 outputs={GLB_NAME:bytes(blob),MANIFEST_NAME:manifest_bytes,'source-native.json':catalog_bytes,'index.json':index_bytes}
 evidence.mkdir(parents=True,exist_ok=True)
 for name,data in [('baseline-index.json',original_index),('baseline-source-native.json',original_catalog)]:
  target=evidence/name
  if target.exists():require(target.read_bytes()==data,'Evidence baseline differs')
  else:target.write_bytes(data)
 if replay and a.supersede_owned_repair:
  previous=json.loads((evidence/'REPAIR.json').read_bytes());require(set(previous['outputs'])==set(outputs),'Previous repair has another output set')
  for name,identity in previous['outputs'].items():require(sha(atlas/name)==identity['sha256'],'Cannot supersede modified output: '+name)
  backup=evidence/('superseded-'+previous['indexSha256'][:12]);backup.mkdir(exist_ok=False)
  for name in outputs:(backup/name).write_bytes((atlas/name).read_bytes())
  (backup/'REPAIR.json').write_bytes((evidence/'REPAIR.json').read_bytes())
  for name,data in outputs.items():(atlas/name).write_bytes(data)
  replay=False
 elif replay:
  for name,data in outputs.items():require((atlas/name).read_bytes()==data,'Deterministic replay differs: '+name)
 else:
  for name,data in outputs.items():
   if name not in ['index.json','source-native.json']:require(not(atlas/name).exists(),'Refusing unrelated output overwrite')
  for name,data in outputs.items():(atlas/name).write_bytes(data)
 # Re-read generated accessors, independently compare every byte to the source.
 result=GLB(atlas/GLB_NAME)
 for i,item in enumerate(parts):
  prim=result.doc['meshes'][i]['primitives'][0]
  for raw,acc in zip(item['arrays'],[prim['attributes']['POSITION'],prim['attributes']['NORMAL'],prim['indices']]):require(result.payload(acc)==raw.tobytes(),'Export array byte mismatch')
 result.close()
 for b in old_index['bundles']:require(sha(atlas/b['url'])==b['sha256']and sha(atlas/b['manifestUrl'])==b['manifestSha256'],'Existing bundle/manifest modified')
 report={'schema':'dicom3d-bp3d-export-repair-check-1','result':'PASS','replay':replay,'elapsedSeconds':round(time.perf_counter()-start,3),'baselineIndexSha256':BASE_INDEX,'baselineCatalogSha256':BASE_CATALOG,'indexSha256':digest(index_bytes),'catalogSha256':digest(catalog_bytes),'outputs':{n:{'bytes':len(v),'sha256':digest(v)}for n,v in outputs.items()},'existingBundlesAndManifestsUnchanged':15,'originalPhysicalSpansCheckedForExactDuplicates':checks,'newOwners':2,'newAtoms':2,'totalOwners':len(index['structures']),'totalAtoms':len(catalog['atoms']),'restoredElements':[{'id':x['atom']['id'],'vertices':len(x['arrays'][0])//3,'triangles':len(x['arrays'][2])//3,'geometrySha256':x['geometrySha256'],'boundsModel':x['atom']['boundsModel']}for x in parts],'allPartOfConceptsExact':1368,'repairedPartOfConceptKeys':changed,'otherConceptsUnchanged':len(catalog['concepts'])-27,'heldSourceEntriesUnchanged':len(catalog['heldSourceEntries']),'nativeConceptAndLabelRemainNull':True,'sourceAttributeAndIndexBytesVerified':True,'limitations':['CPU source/export proof; no browser, GPU or clinical qualification.','4.3i holds and cross-version proxy distinctions preserved.']}
 (evidence/('REPLAY.json'if replay else'REPAIR.json')).write_bytes(encode(report));print(json.dumps(report,indent=2))
if __name__=='__main__':main()
