import sys,json,math,time,collections,struct
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root));from ingest import read_atlas,source_mesh
here=Path(__file__).resolve().parent;name=sys.argv[1];catalog=json.loads((root/'assets/catalog.json').read_text());identity=next(x for x in catalog['accepted'] if x['semantic']==name);g,blob=read_atlas();_,_,_,positions,faces=source_mesh(g,blob,name);src=np.asarray(positions);sf=np.asarray(faces);scale=identity['scaleM'];center=np.array(identity['centerM']);n=int(sys.argv[2]);t0=time.monotonic();mesh=np.fromfile(here/('browser-001/'+name+'-N'+str(n)+'.bin'),dtype='<f4').reshape(-1,8)[:,:3].astype(np.float64);dv,inverse=np.unique(mesh,axis=0,return_inverse=True);df=inverse.reshape(-1,3);derived=mesh.reshape(-1,3,3);source=((src-center)/scale)[sf]
# Independent Ericson region tests, rather than the native projection/edge/BVH routine.
def distances(points,triangles):
 answers=[]
 for begin in range(0,len(points),16):
  pt=points[begin:begin+16,None,:];a=triangles[None,:,0,:];b=triangles[None,:,1,:];c=triangles[None,:,2,:];ab=b-a;ac=c-a;ap=pt-a;bp=pt-b;cp=pt-c
  dot=lambda x,y:np.sum(x*y,axis=-1);d1=dot(ab,ap);d2=dot(ac,ap);d3=dot(ab,bp);d4=dot(ac,bp);d5=dot(ab,cp);d6=dot(ac,cp);vc=d1*d4-d3*d2;vb=d5*d2-d1*d6;va=d3*d6-d5*d4
  normal=np.cross(ab,ac);result=dot(ap,normal)**2/dot(normal,normal)
  divide=lambda x,y:np.divide(x,y,out=np.zeros_like(x),where=y!=0)
  edge=ap-ab*divide(d1,d1-d3)[...,None];result=np.where((vc<=0)&(d1>=0)&(d3<=0),dot(edge,edge),result)
  edge=ap-ac*divide(d2,d2-d6)[...,None];result=np.where((vb<=0)&(d2>=0)&(d6<=0),dot(edge,edge),result)
  edge=bp-(c-b)*divide(d4-d3,(d4-d3)+(d5-d6))[...,None];result=np.where((va<=0)&((d4-d3)>=0)&((d5-d6)>=0),dot(edge,edge),result)
  result=np.where((d1<=0)&(d2<=0),dot(ap,ap),result);result=np.where((d3>=0)&(d4<=d3),dot(bp,bp),result);result=np.where((d6>=0)&(d5<=d6),dot(cp,cp),result);answers.extend(np.sqrt(np.maximum(0,np.min(result,axis=1))))
 return np.asarray(answers)
forwardQueries=np.concatenate([dv,derived.mean(axis=1)]);reverseQueries=np.concatenate([(src-center)/scale,source.mean(axis=1)]);forward=distances(forwardQueries,source);reverse=distances(reverseQueries,derived);combined=np.concatenate([forward,reverse]);h=4/n
edges=collections.defaultdict(list);links=collections.defaultdict(lambda:collections.defaultdict(set))
for f in df:
 for j in range(3):
  a,b=int(f[j]),int(f[(j+1)%3]);edges[tuple(sorted((a,b)))].append((a,b));v=int(f[j]);a,b=int(f[(j+1)%3]),int(f[(j+2)%3]);links[v][a].add(b);links[v][b].add(a)
assert all(len(e)==2 and e[0]==tuple(reversed(e[1])) for e in edges.values())
for adj in links.values():
 todo=[next(iter(adj))];seen=set()
 while todo:
  x=todo.pop()
  if x not in seen:seen.add(x);todo.extend(adj[x]-seen)
 assert len(seen)==len(adj) and all(len(v)==2 for v in adj.values())
assert len(dv)-len(edges)+len(df)==2
sub=lambda a,b:tuple(x-y for x,y in zip(a,b))
cross=lambda a,b:(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
dot=lambda a,b:sum(x*y for x,y in zip(a,b))
sign=lambda x:(x>0)-(x<0)
def orient3(a,b,c,d):return sign(dot(sub(a,d),cross(sub(b,d),sub(c,d))))
def axis(a,b,c):return max(range(3),key=lambda i:abs(cross(sub(b,a),sub(c,a))[i]))
def orient2(a,b,c,k):
 i,j=[q for q in range(3) if q!=k];return sign((a[i]-c[i])*(b[j]-c[j])-(a[j]-c[j])*(b[i]-c[i]))
def inside(p,t,k):
 s=[orient2(t[i],t[(i+1)%3],p,k) for i in range(3)];return all(x>=0 for x in s) or all(x<=0 for x in s)
def between(p,a,b,k):return all(min(a[i],b[i])<=p[i]<=max(a[i],b[i]) for i in range(3) if i!=k)
def coplanar(a,b,t,k,shared):
 if inside(a,t,k) and a not in shared or inside(b,t,k) and b not in shared:return True
 for i in range(3):
  c,d=t[i],t[(i+1)%3];ac,ad=orient2(a,b,c,k),orient2(a,b,d,k);ca,cb=orient2(c,d,a,k),orient2(c,d,b,k)
  if ac*ad<0 and ca*cb<0:return True
  if any(s==0 and between(p,a,b,k) and p not in shared for p,s in [(c,ac),(d,ad)]):return True
  if any(s==0 and between(p,c,d,k) and p not in shared for p,s in [(a,ca),(b,cb)]):return True
  if ac==ad==ca==cb==0:
   points=[p for p in [a,b] if between(p,c,d,k)]+[p for p in [c,d] if between(p,a,b,k)]
   if len(points)>1 and len(shared)<2 and any(p!=points[0] for p in points):return True
 return False
def segment(a,b,t,shared):
 p,q,r=t;sa,sb=orient3(p,q,r,a),orient3(p,q,r,b)
 if sa*sb>0:return False
 k=axis(p,q,r)
 if sa==sb==0:return coplanar(a,b,t,k,shared)
 if sa==0:return inside(a,t,k) and a not in shared
 if sb==0:return inside(b,t,k) and b not in shared
 x,y,z=orient3(a,b,p,q),orient3(a,b,q,r),orient3(a,b,r,p);return x>=0 and y>=0 and z>=0 or x<=0 and y<=0 and z<=0
def contacts(positions,faces):
 vertices=[]
 for p in positions:
  values=[]
  for x in p:n,d=float(x).as_integer_ratio();values.append(n*(1<<149)//d)
  vertices.append(tuple(values))
 tri=positions[faces];lo=tri.min(axis=1);hi=tri.max(axis=1);pairs=0
 for i in range(len(faces)):
  candidates=np.nonzero(np.all((lo[i]<=hi[i+1:])&(lo[i+1:]<=hi[i]),axis=1))[0]+i+1
  for j in candidates:
   pairs+=1;fa,fb=faces[i],faces[j];a=[vertices[v] for v in fa];b=[vertices[v] for v in fb];shared=[vertices[v] for v in set(fa)&set(fb)];bad=False
   if len(shared)==3:bad=True
   elif len(shared)==2:
    x=next(p for p in a if p not in shared);y=next(p for p in b if p not in shared)
    if orient3(shared[0],shared[1],x,y)==0:k=axis(shared[0],shared[1],x);bad=orient2(shared[0],shared[1],x,k)*orient2(shared[0],shared[1],y,k)>=0
   else:bad=any(segment(a[k],a[(k+1)%3],b,shared) or segment(b[k],b[(k+1)%3],a,shared) for k in range(3))
   assert not bad,('forbidden contact',i,int(j))
 return pairs
sourcePairs=contacts(src,sf);derivedPairs=contacts(dv,df)
volume=lambda t:float(np.sum(np.einsum('ij,ij->i',t[:,0],np.cross(t[:,1],t[:,2])))/6)
relativeVolume=abs(volume(derived)-volume(source))/volume(source);assert max(forward.max(),reverse.max())<=h and math.sqrt(np.mean(combined**2))<=.4*h and relativeVolume<=.05
report={'result':'PASS','numpy':np.__version__,'sourceContactPairs':sourcePairs,'derivedContactPairs':derivedPairs,'forbiddenContacts':0,'derivedVertices':len(dv),'derivedTriangles':len(df),'derivedEdges':len(edges),'euler':2,'forwardQueries':len(forward),'reverseQueries':len(reverse),'forwardMaxM':float(forward.max()*scale),'reverseMaxM':float(reverse.max()*scale),'combinedRmsM':float(math.sqrt(np.mean(combined**2))*scale),'relativeVolumeError':relativeVolume,'hM':h*scale,'unqualifiedFeaturesBelow2hM':2*h*scale,'sourceMinimumBboxWidthM':float(np.min(np.ptp(src,axis=0))),'normalizationMaxErrorM':identity['normalizationMaxErrorM'],'geometryLimit':'Sampled errors on actual source, not globalHausdorff; tips or features under2h may be rounded/lost; topology checked for this mesh only','elapsedSeconds':time.monotonic()-t0}
(here/(name+'-N'+str(n)+'-independent.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
