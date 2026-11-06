"""Existing ANAT-EXPAND-001 binary adapter helpers; byte-preserving reuse.
Source meshes remain authoritative; this module only reads/repackages GLB storage.
"""
import copy,hashlib,json,mmap,pathlib,struct

def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()

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
 size=base.length+len(extra);assert size<=256*1048576
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
