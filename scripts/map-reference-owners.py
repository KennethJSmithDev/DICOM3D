"""Map source anatomy to existing draw owners; never generates geometry.

WHY: source hierarchy children may already be merged into accepted Heart/Skeleton
draws. BOUNDARY: source identity -> honest owner projection, not new selection
state. INVARIANT: all original GLBs, IDs and ownership remain unchanged. IS-A and
PART-OF relations remain distinct; unknown geometry is retained as an explicit hold.
"""
import collections,csv,hashlib,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
PUB=ROOT/'reference/public/reference'
META=ROOT/'reference/metadata/bodyparts3d'
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.write_bytes((json.dumps(d,indent=2,ensure_ascii=False)+'\n').encode())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
PINS={'isa_parts_list_e.txt':'ab7796deedd49205e77f3609a1cb8c53e2bbee14ecb5c9a6ca05227469780513','isa_inclusion_relation_list.txt':'26e7d818e03a8c909fe09c561f38d0d513423c87681f9450a803bc38f5b07564','isa_element_parts.txt':'a3de74423f943b0d724ae8f59b3a817f87c423a544f8db98113b1980817cbeaf'}
for n,h in PINS.items():assert digest(META/n)==h,n
def table(n):return list(csv.DictReader((META/n).open(encoding='utf-8-sig'),delimiter='\t'))
labels={r['concept id']:r['en'] for r in table('isa_parts_list_e.txt')}
isa=collections.defaultdict(set)
for r in table('isa_element_parts.txt'):isa[r['concept id']].add(r['element file id'])
isa_parents=collections.defaultdict(list)
for r in table('isa_inclusion_relation_list.txt'):isa_parents[r['child id']].append(r['parent id'])
catalog=load(ROOT/'reference/metadata/anatomy-source-records.json')
members=load(PUB/'bp3d-source-members.json');element_owners=collections.defaultdict(list)
for g in members:
 for e in g['members']:element_owners[e['element']].append(g['id'])
result={'revision':'ANAT-ACCEPT-001','claim':'Complete available-source accounting, not complete human anatomical coverage','taxonomies':{'PART_OF':'Original admitted BodyParts3D source hierarchy','IS_A':{'publisher':'BodyParts3D LATEST metadata, retrieved 2026-10-28; exact FJ identifiers only; no geometry downloaded','files':PINS}},'variants':{}}
for variant,key in [('bp3d-male','male'),('hra-female','female')]:
 m=load(PUB/(variant+'.manifest.json'));parts=m['reference']['structures'];ids={p['id'] for p in parts};nodes=m['reference']['hierarchy'];byid={n['id']:n for n in nodes}
 if key=='male':
  records=[]
  for e in catalog['male']['elements']:
   eid=e['element'];owners=sorted(element_owners[eid]);classes=sorted(k for k,v in isa.items() if eid in v)
   records.append({'source_id':eid,'label':e['label'],'concept':e['source_concept'],'owner_ids':owners,'status':'OWNED' if owners else 'HOLD','hold':e.get('hold'),'isa_concepts':classes})
  for n in nodes:
   n['owner_ids']=sorted({o for e in n.get('elements',[]) for o in element_owners[e]});n['relation']='PART_OF'
  # IS-A is a separate source-backed classification facet, never guessed system membership.
  for p in parts:
   elements=[e['element'] for g in members if g['id']==p['id'] for e in g['members']]
   p['source_elements']=elements
   if p.get('systems')==['Unassigned source system']:
    candidates=[k for k,v in isa.items() if set(elements)<=v]
    specific=[k for k in candidates if not any(k in isa_parents[x] for x in candidates)]
    p['systems']=['IS-A: '+labels[k] for k in sorted(specific)] or ['Unassigned source system']
  isa_nodes=[{'id':k,'label':labels[k],'relation':'IS_A','parents':isa_parents[k],'elements':sorted(v),'owner_ids':sorted({o for e in v for o in element_owners[e]})} for k,v in sorted(isa.items())]
  result['variants'][variant]={'source_elements':records,'source_concepts':nodes,'classification_concepts':isa_nodes,'source_elements_not_locally_available':sorted(set().union(*isa.values())-{r['source_id'] for r in records})}
 else:
  raw=catalog['female']['nodes'];direct={p['source_node_index']:p['id'] for p in parts};owners={}
  for r in raw:
   owner=direct.get(r['index'],r.get('existing_owner'));owners[r['id']]=[owner] if owner in ids else []
  def below(k,visiting=None):
   visiting=set() if visiting is None else visiting
   assert k not in visiting,'Cyclic female source hierarchy'
   return set(owners.get(k,[])).union(*(below(c,visiting|{k}) for c in byid.get(k,{}).get('children',[])))
  records=[]
  for r in raw:
   n=byid[r['id']];n['owner_ids']=sorted(below(r['id']));n['relation']='PART_OF';n['source_annotation']=r.get('source_annotation',{});n['hold']=r.get('hold')
   records.append({'source_id':r['id'],'source_node_index':r['index'],'label':r['label'],'owner_ids':owners[r['id']],'subtree_owner_ids':n['owner_ids'],'status':'OWNED' if owners[r['id']] else 'HOLD' if r.get('hold') else 'CONTAINER','hold':r.get('hold'),'source_annotation':r.get('source_annotation',{})})
  result['variants'][variant]={'source_nodes':records,'source_concepts':nodes}
 for n in nodes:
  n['ownership_scope']='DIRECT' if n['id'] in ids else 'PROVIDED_THROUGH_EXISTING_OWNER' if n['owner_ids'] else 'NO_ADMITTED_GEOMETRY'
 m['reference']['mapping_revision']='ANAT-ACCEPT-001';m['reference']['mapping_notice']='Source nodes filter existing draw owners. A contained part may select its whole existing owner; no independent subpart geometry is implied.'
 save(PUB/(variant+'.manifest.json'),m)
result['summary']={v:{'selectable_owners':len(load(PUB/(v+'.manifest.json'))['reference']['structures']),'source_records':len(d.get('source_elements',d.get('source_nodes',[]))),'unowned_records':sum(not r['owner_ids'] for r in d.get('source_elements',d.get('source_nodes',[]))),'mapped_concepts':sum(bool(n['owner_ids']) for n in d['source_concepts'])} for v,d in result['variants'].items()}
save(PUB/'anatomy-owner-map.json',result)
print(json.dumps(result['summary']))
