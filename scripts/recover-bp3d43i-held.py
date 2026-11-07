"""Restore 17 unchanged pinned 4.3i files and exact source-header concept membership.

16 additional version-specific identities alias byte-identical resident 4.0 spans.
This does not relabel 4.0 anatomy, invent 4.3i hierarchy, or admit overlap/laterality
holds. Existing source notices and historical hold records are retained.
"""
import argparse,array,copy,hashlib,importlib.util,json,pathlib,struct,sys,time,zipfile

spec=importlib.util.spec_from_file_location('export_repair',pathlib.Path(__file__).with_name('repair-bp3d-export.py'))
repair=importlib.util.module_from_spec(spec);spec.loader.exec_module(repair)
BASE_INDEX='e90d1d5f4a06d989b3b26788ebbb0701c537cf791fb19ec580f2586886df04de'
BASE_CATALOG='c33799ee6c9c3b80026d6b62f567110ad4d39924a9167a6abd0901b8c9527257'
ARCHIVE='ee0dda4ff9ec8e7bb966d0eeb11df92b736c5351b73cbb1757d038b1a0bd5ead'
NEW=set('FJ2127 FJ2203 FJ7504M FJ7504 FJ6089 FJ5994 FJ6002 FJ6013 FJ6019 FJ6024 FJ4984 FJ4715 FJ4986 FJ4993 FJ5015 FJ6140 FJ6043'.split())
MEMBERS={'FMA20731':'FJ2143 FJ2127 FJ2203','FMA242160':'FJ1817 FJ7504M','FMA242162':'FJ1770 FJ7504','FMA50302':'FJ3020 FJ6089','FMA50305':'FJ2933 FJ6002 FJ2925 FJ5994','FMA50306':'FJ6013 FJ6024 FJ2955 FJ2944 FJ6019 FJ2950','FMA66647':'FJ4984 FJ3583','FMA69316':'FJ4715 FJ3417','FMA69325':'FJ3564 FJ4986','FMA75866':'FJ1682 FJ4993','FMA76261':'FJ5015 FJ1725','FMA8613':'FJ3019 FJ6140','FMA8616':'FJ6043 FJ2973'}
BUNDLE='source43-recoveries';GLB_NAME='male-source43-recoveries.glb';MANIFEST_NAME='male-source43-recoveries.manifest.json'
sha=repair.sha;encode=repair.encode;require=repair.require
def fingerprint(arrays):return hashlib.sha256(b''.join(x.tobytes()for x in arrays)).hexdigest()

def main():
 start=time.perf_counter();ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--atlas',type=pathlib.Path,required=True);ap.add_argument('--source-archive',type=pathlib.Path,required=True);ap.add_argument('--evidence',type=pathlib.Path,required=True);ap.add_argument('--verify-existing',action='store_true',help='Regenerate in memory from preserved baseline and compare every output byte; no asset writes');a=ap.parse_args()
 atlas=a.atlas.resolve();ev=a.evidence.resolve();require(sha(a.source_archive)==ARCHIVE,'Pinned source archive differs')
 base_index=ev/'baseline-index.json'if a.verify_existing else atlas/'index.json';base_catalog=ev/'baseline-source-native.json'if a.verify_existing else atlas/'source-native.json'
 require(sha(base_index)==BASE_INDEX and sha(base_catalog)==BASE_CATALOG,'Unexpected atlas baseline')
 index=json.loads(base_index.read_bytes());catalog=json.loads(base_catalog.read_bytes());old=copy.deepcopy(catalog)
 for b in index['bundles']:
  require(sha(atlas/b['url'])==b['sha256']and sha(atlas/b['manifestUrl'])==b['manifestSha256'],'Existing bundle identity mismatch')
 wanted={e for es in MEMBERS.values()for e in es.split()};source={}
 with zipfile.ZipFile(a.source_archive)as z:
  paths={pathlib.PurePosixPath(n).stem.split('_')[0]:n for n in z.namelist()if n.endswith('.obj')}
  for eid in sorted(wanted):
   raw=z.read(paths[eid]);head,p,n,ix=repair.parse_obj(raw);cid=next(c for c,es in MEMBERS.items()if eid in es.split())
   require(head.get('File ID')==eid and head.get('Concept ID')==cid and bool(head.get('English name')),'Source identity mismatch')
   source[eid]={'head':head,'arrays':(p,n,ix),'sha256':hashlib.sha256(raw).hexdigest(),'member':paths[eid],'notices':[line for line in raw.decode().splitlines()[:20]if line.startswith('#')]}
 # Verify exact reused geometry against the current resident arrays, never just IDs.
 atoms={x['id']:x for x in catalog['atoms']};arrays={};seen=set()
 for b in index['bundles']:
  g=repair.GLB(atlas/b['url']);nodes={n.get('name'):n for n in g.doc['nodes']}
  for eid in sorted(wanted-NEW):
   atom=atoms['BP3D40:'+eid]
   if atom['bundleId']!=b['id']:continue
   prim=g.doc['meshes'][nodes[atom['ownerId']]['mesh']]['primitives'][0];v0=atom['vertexStart']*12;v1=v0+atom['vertexCount']*12;p=array.array('f');p.frombytes(g.payload(prim['attributes']['POSITION'])[v0:v1]);n=array.array('f');n.frombytes(g.payload(prim['attributes']['NORMAL'])[v0:v1]);ix=array.array({5123:'H',5125:'I'}[g.doc['accessors'][prim['indices']]['componentType']]);ix.frombytes(g.payload(prim['indices']));local=array.array('I',(i-atom['vertexStart']for i in ix[atom['indexStart']:atom['indexStart']+atom['indexCount']]));require(fingerprint((p,n,local))==fingerprint(source[eid]['arrays']),'Version alias geometry differs: '+eid);seen.add(eid)
  g.close()
 require(seen==wanted-NEW,'Missing resident alias geometry');parts=[];new_atoms=[]
 for eid,item in source.items():
  head=item['head'];p,n,ix=item['arrays'];sid='BP3D43i:'+eid;cid=head['Concept ID'];require(sid not in atoms,'Source identity already exists')
  if eid in NEW:
   oid='BP3D43i_'+eid;bounds=[[min(p[k::3])for k in range(3)],[max(p[k::3])for k in range(3)]]
   owner={'id':oid,'bundleId':BUNDLE,'label':head['English name']+' · '+eid,'region':'Source atlas','skin':False,'systems':[],'source_concept':cid,'source_elements':[eid],'classification':'anatomical_subcomponent','representation_scope':'Exact BodyParts3D 4.3i source element; select its source concept for all published members','identity_basis':'PINNED_43I_OBJ_HEADER','source_annotation':{'atlas':'BodyParts3D 4.3i','element_id':eid,'native_concept_id':cid,'native_label':head['English name']}}
   atom={'id':sid,'sourceId':sid,'version':'4.3i','elementId':eid,'ownerId':oid,'bundleId':BUNDLE,'vertexStart':0,'vertexCount':len(p)//3,'indexStart':0,'indexCount':len(ix),'sourceConceptId':cid,'conceptIds':[cid],'label':head['English name'],'sourceSha256':item['sha256'],'boundsModel':bounds,'geometryAliasOf':None,'physicalSpanId':oid+':0:'+str(len(ix)),'verified':{'position':True,'normal':True,'index':True,'indexRange':True},'membershipBasis':'PINNED_43I_OBJ_HEADER'}
   parts.append({'element':eid,'owner':owner,'atom':atom,'arrays':(p,n,ix)});index['structures'].append(owner);catalog['owners'].append(owner);catalog['ownerMappings'].append({'id':oid,'systems':[],'sourceClassificationIds':[],'mappingEvidence':[{'relation':'SOURCE_CONCEPT','basis':'PINNED_43I_OBJ_HEADER','sourceConceptId':cid,'note':'No version-specific system hierarchy supplied for this recovery; 4.0 membership is not inferred.'}]})
  else:
   original=atoms['BP3D40:'+eid];atom=copy.deepcopy(original);atom.update({'id':sid,'sourceId':sid,'version':'4.3i','sourceConceptId':cid,'conceptIds':[cid],'label':head['English name'],'sourceSha256':item['sha256'],'geometryAliasOf':original['id'],'membershipBasis':'PINNED_43I_OBJ_HEADER_WITH_EXACT_RESIDENT_ARRAY_ALIAS','aliasEvidence':{'residentSourceId':original['id'],'positionNormalLocalIndexSha256':fingerprint(item['arrays']),'doesNotRelabelResidentSource':True}})
  catalog['atoms'].append(atom);new_atoms.append(atom)
 by_id={x['id']:x for x in catalog['atoms']};changed=[]
 for c in catalog['concepts']:
  if c['key']not in {'SOURCE_CONCEPT:4.3i:'+cid for cid in MEMBERS}:continue
  require(c['scope']=='CATALOG_ONLY'and not c['atomIds']and set(c['expectedElements'])==set(MEMBERS[c['id']].split()),'Unexpected source concept membership')
  c['atomIds']=sorted('BP3D43i:'+eid for eid in MEMBERS[c['id']].split());c['ownerIds']=sorted({by_id[x]['ownerId']for x in c['atomIds']});c['missingElements']=[];c['scope']='EXACT_COMPOUND';changed.append(c['key'])
 require(len(changed)==13 and len(parts)==17 and len(new_atoms)==33,'Unexpected recovery totals')
 # Historical records remain byte-equivalent as JSON records; current resolution is separate.
 catalog['sourceRecoveries']=[{'id':'BP3D43I-HELD-RECOVERY-001','sourceArchiveSha256':ARCHIVE,'newElementIds':sorted(NEW),'reusedElementIds':sorted(wanted-NEW),'newAtomIds':[x['id']for x in new_atoms],'changedConceptKeys':sorted(changed),'remainingResidualHoldFiles':18,'remainingResidualOverlapFiles':3,'remainingResidualLateralityFiles':15,'historicalHoldRecordsPreserved':True}]
 catalog['limits']=[x.replace('Existing held 4.3i geometry is not admitted.','17 pinned 4.3i source files are restored; 16 versioned identities reuse byte-identical resident geometry. Historical holds are retained separately from current resolution.')for x in catalog['limits']]
 catalog['limits'].append('Recovered 4.3i concepts use complete pinned OBJ Concept ID membership; no new 4.3i system hierarchy or cross-version equivalence is asserted. Exact noncoincidence does not establish anatomical independence of alternative surfaces.')
 require(catalog['heldSourceEntries']==old['heldSourceEntries'],'Historical holds changed');old_concepts={x['key']:x for x in old['concepts']};require(all(x==old_concepts[x['key']]for x in catalog['concepts']if x['key']not in changed),'Unrelated concepts changed')
 require(catalog['atoms'][:-33]==old['atoms']and catalog['owners'][:-17]==old['owners'],'Existing identities changed')
 # Reuse the established lossless exporter, adapting only its metadata for this version.
 raw=repair.make_glb(parts);jlen=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jlen]);binary=raw[28+jlen:];doc['asset']['generator']='DICOM3D pinned BP3D 4.3i source recovery';doc['nodes'][0]['name']='BP3D43i-source-recoveries'
 for node in doc['nodes'][1:]:
  eid=node['extras']['sourceElements'][0];node['extras'].update({'sourceVersion':'4.3i','sourceConcept':source[eid]['head']['Concept ID'],'identityBasis':'PINNED_43I_OBJ_HEADER'})
 jb=encode(doc).rstrip(b'\n');jb+=b' '*(-len(jb)%4);blob=struct.pack('<IIIII',0x46546c67,2,28+len(jb)+len(binary),len(jb),0x4e4f534a)+jb+struct.pack('<II',len(binary),0x004e4942)+binary;asset_sha=hashlib.sha256(blob).hexdigest()
 manifest={'asset':{'relative_filename':GLB_NAME,'sha256':asset_sha,'model_space':index['source']['modelSpace'],'units':'metres'},'reference':{'id':index['source']['referenceId'],'variant':'male','representation':'original source element surfaces','structures':[x['owner']for x in parts]},'cost':{'glb_bytes':len(blob),'vertices':sum(len(x['arrays'][0])//3 for x in parts),'triangles':sum(len(x['arrays'][2])//3 for x in parts),'geometry_buffer_bytes':sum(sum(len(v)*v.itemsize for v in x['arrays'])for x in parts),'semantic_structures':17},'provenance':{'archive_sha256':ARCHIVE,'operation':'Unchanged source export and version-specific exact geometry aliases; original 4.0 source identities remain intact.','source_to_reference_m':[[.001,0,0,0],[0,0,.001,0],[0,-.001,0,0],[0,0,0,1]],'license_decision':'Existing accepted BodyParts3D CC BY 4.0 decision and historical notices preserved.','source_members':[{'element':eid,'member':v['member'],'sha256':v['sha256'],'native_concept_id':v['head']['Concept ID'],'native_label':v['head']['English name'],'geometry_reused':eid not in NEW,'notices':v['notices']}for eid,v in source.items()]}}
 mb=encode(manifest);cb=encode(catalog);index['bundles'].append({'id':BUNDLE,'url':GLB_NAME,'manifestUrl':MANIFEST_NAME,'byteLength':len(blob),'sha256':asset_sha,'manifestSha256':hashlib.sha256(mb).hexdigest(),'structureIds':[x['owner']['id']for x in parts]});index['sourceNative'].update({'sha256':hashlib.sha256(cb).hexdigest(),'byteLength':len(cb)});ib=encode(index)
 outputs={GLB_NAME:blob,MANIFEST_NAME:mb,'source-native.json':cb,'index.json':ib};ev.mkdir(parents=True,exist_ok=True)
 if a.verify_existing:
  for name,data in outputs.items():require((atlas/name).read_bytes()==data,'Reproduction mismatch: '+name)
 else:
  require(not(ev/'RECOVERY.json').exists(),'Evidence already exists; preserve it and choose a new verification directory')
  for name in ['index.json','source-native.json']:(ev/('baseline-'+name)).write_bytes((atlas/name).read_bytes())
  for name,data in outputs.items():
   if name not in ['index.json','source-native.json']:require(not(atlas/name).exists(),'Refusing existing output overwrite')
   require(len(data)<100000000,'Output exceeds GitHub hard limit');(atlas/name).write_bytes(data)
 result={'status':'SOURCE_EXPORT_PASS_BROWSER_NOT_TESTED','baselineIndexSha256':BASE_INDEX,'baselineCatalogSha256':BASE_CATALOG,'archiveSha256':ARCHIVE,'outputs':{n:{'sha256':hashlib.sha256(d).hexdigest(),'bytes':len(d)}for n,d in outputs.items()},'addedDrawOwners':17,'addedSourceOccurrences':33,'newPhysicalSpans':17,'geometryAliases':16,'exactSourceConceptsRecovered':13,'maleDrawOwners':len(index['structures']),'maleSourceOccurrences':len(catalog['atoms']),'maleExactPartOf':sum(c['relation']=='PART_OF'and c['scope']=='EXACT_COMPOUND'for c in catalog['concepts']),'historicalHoldRecords':len(catalog['heldSourceEntries']),'residualUnresolvedFiles':18,'sourceTrianglesAdded':manifest['cost']['triangles'],'elapsedSeconds':time.perf_counter()-start}
 if a.verify_existing:result['deterministicRegenerationAllOutputBytesEqual']=True
 (ev/('REPRODUCTION.json'if a.verify_existing else 'RECOVERY.json')).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,indent=2))
if __name__=='__main__':main()
