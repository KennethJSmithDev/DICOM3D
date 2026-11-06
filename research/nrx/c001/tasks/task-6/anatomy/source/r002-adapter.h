// Independently written bounded R002 CPU experiment. No external source dependency.
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <limits>
#include <map>
#include <memory>
#include <numeric>
#include <optional>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>
#include "../reuse/allocation.h"
#include <tuple>
#include <sstream>
#include <emscripten.h>
using Clock=std::chrono::steady_clock;
double secs(Clock::time_point t){
  return std::chrono::duration<double>(Clock::now()-t).count();
}
void require(bool v,const char* s){
  if(!v)throw std::runtime_error(s);
}
struct V{
  double x,y,z;
  V operator+(V b)const{
    return{
      x+b.x,y+b.y,z+b.z
    };
  }
  V operator-(V b)const{
    return{
      x-b.x,y-b.y,z-b.z
    };
  }
  V operator*(double s)const{
    return{
      x*s,y*s,z*s
    };
  }
};
double dot(V a,V b){
  return a.x*b.x+a.y*b.y+a.z*b.z;
}
V cross(V a,V b){
  return{
    a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x
  };
}
double norm(V a){
  return std::sqrt(dot(a,a));
}
V unit(V a){
  return a*(1/norm(a));
}
struct Stats{
  uint64_t points=0,intervals=0,cells=0,bricks=0,ancestors=0,nodes_visited=0,changed=0,dirty_samples=0;
};
struct Config{
  int n,bn;
  double h,b;
  explicit Config(int v):n(v),bn(v/8),h(4./v),b(8./v){
    require(v>=8&&v<=128&&(v&(v-1))==0,"resolution");
  }
  uint32_t id(int x,int y,int z)const{
    require(x>=0&&y>=0&&z>=0&&x<=n&&y<=n&&z<=n,"coordinate");
    return uint32_t((z*(n+1)+y)*(n+1)+x);
  }
  V pos(int x,int y,int z)const{
    (void)id(x,y,z);
    return{
      -2+h*x,-2+h*y,-2+h*z
    };
  }
  V pos(uint32_t id)const{
    int x=id%(n+1);
    id/=n+1;
    int y=id%(n+1),z=id/(n+1);
    return pos(x,y,z);
  }
  int brick(int x,int y,int z)const{
    return(z*bn+y)*bn+x;
  }
  std::array<int,3> origin(int k)const{
    return{
      8*(k%bn),8*((k/bn)%bn),8*(k/(bn*bn))
    };
  }
};
struct Sample {
  float a=-1,b=-1;
  bool operator==(const Sample& p)const{return a==p.a&&b==p.b;}
  bool operator!=(const Sample& p)const{return !(*this==p);}
};

struct Authority{uint64_t generation=1;};
struct Brick{Sample tile;bool constant=false;std::vector<Sample> samples;};
Sample organ_sample(V p,const Config& c);
struct Cache{
 Config cfg;bool sparse,edited=false;uint64_t capturedRevision=0;std::shared_ptr<const Authority> source=std::make_shared<const Authority>();std::vector<Sample> dense;std::vector<Brick> leaves;std::vector<uint64_t> tokens;Stats st;
 Cache(int n,bool sp):cfg(n),sparse(sp),leaves(sp?cfg.bn*cfg.bn*cfg.bn:0),tokens(cfg.bn*cfg.bn*cfg.bn,0){}
 void build();
 Sample pair(int x,int y,int z)const{(void)cfg.id(x,y,z);if(!sparse)return dense[cfg.id(x,y,z)];int bx=std::min(x/8,cfg.bn-1),by=std::min(y/8,cfg.bn-1),bz=std::min(z/8,cfg.bn-1);auto& b=leaves[cfg.brick(bx,by,bz)];return b.constant?b.tile:b.samples[((z-bz*8)*9+(y-by*8))*9+x-bx*8];}
 Sample pair(uint32_t id)const{int x=id%(cfg.n+1);id/=cfg.n+1;return pair(x,id%(cfg.n+1),id/(cfg.n+1));}
 uint64_t bytes()const{uint64_t b=sizeof(Cache)+dense.capacity()*sizeof(Sample)+leaves.capacity()*sizeof(Brick)+tokens.capacity()*8;for(auto& l:leaves)b+=l.samples.capacity()*sizeof(Sample);return b;}
};
struct Key {
  uint32_t a,b,c=std::numeric_limits<uint32_t>::max(),constraint=0;
  bool operator<(const Key& k)const{return std::tie(a,b,c,constraint)<std::tie(k.a,k.b,k.c,k.constraint);}
  bool operator==(const Key& k)const{return a==k.a&&b==k.b&&c==k.c&&constraint==k.constraint;}
};
struct Vertex{
  Key key;
  std::array<float,3> p;
  V pos()const{
    return{
      p[0],p[1],p[2]
    };
  }
  bool operator==(const Vertex& v)const{
    return key==v.key&&p==v.p;
  }
};
struct Tri{
  std::array<Vertex,3> v;
  uint64_t id;
  uint32_t branch=0;
  bool operator==(const Tri& t)const{
    return id==t.id&&branch==t.branch&&v==t.v;
  }
};
struct Region{
  uint64_t publication=1,generation=1,token=0;int configuration=0;
  std::vector<Tri> triangles;
};
using Mesh=std::vector<std::shared_ptr<const Region>>;
struct Crossing { Vertex vertex; std::array<uint32_t,3> support; int size=0; double other=0; };
Crossing on_edge(const Cache& cache,uint32_t u,uint32_t v,int branch){
  if(v<u)std::swap(u,v);
  Sample su=cache.pair(u),sv=cache.pair(v);
  double a=branch?su.b:su.a,b=branch?sv.b:sv.a;
  double f=a/(a-b);uint32_t endpoint=f==0?u:v;
  V p=cache.cfg.pos(u)+(cache.cfg.pos(v)-cache.cfg.pos(u))*f;
  Crossing out;out.vertex={{u,v,std::numeric_limits<uint32_t>::max(),uint32_t(branch+1)},{float(p.x),float(p.y),float(p.z)}};
  out.support={u,v,0};out.size=2;out.other=(branch?su.a:su.b)*(1-f)+(branch?sv.a:sv.b)*f;
  if(f==0||f==1){out.vertex.key={endpoint,endpoint};out.support={endpoint,0,0};out.size=1;}
  return out;
}
Crossing rim_crossing(const Cache& cache,const Crossing& a,const Crossing& b){
  if(a.other==0){return a;}
  if(b.other==0){return b;}
  std::set<uint32_t> support;for(int j=0;j<a.size;j++)support.insert(a.support[j]);for(int j=0;j<b.size;j++)support.insert(b.support[j]);
  require(support.size()==3,"rim must lie on canonical tetra face");
  std::array<uint32_t,3> ids;std::copy(support.begin(),support.end(),ids.begin());
  auto x=cache.pair(ids[0]),y=cache.pair(ids[1]),z=cache.pair(ids[2]);
  double aa=double(y.a)-x.a,ab=double(z.a)-x.a,ba=double(y.b)-x.b,bb=double(z.b)-x.b;
  double det=aa*bb-ab*ba;require(det!=0,"unresolved parallel constraints");
  double u=(-double(x.a)*bb+ab*x.b)/det,v=(-aa*x.b+double(x.a)*ba)/det;
  V p=cache.cfg.pos(ids[0])+(cache.cfg.pos(ids[1])-cache.cfg.pos(ids[0]))*u+(cache.cfg.pos(ids[2])-cache.cfg.pos(ids[0]))*v;
  return {{{ids[0],ids[1],ids[2],3},{float(p.x),float(p.y),float(p.z)}},ids,3,0};
}
std::shared_ptr<const Region> extract(Cache& cache,int brick,uint64_t pub){
  allocation::Scope temporary_category(allocation::Temporary);
  std::shared_ptr<Region> result;{allocation::Scope geometry_category(allocation::Geometry);result=std::make_shared<Region>();}result->publication=pub;result->generation=cache.source?cache.source->generation:1;result->token=cache.tokens[brick];result->configuration=cache.cfg.n;
  if(cache.sparse&&cache.leaves[brick].constant)return result;
  const auto& c=cache.cfg;auto o=c.origin(brick);
  static constexpr int tetra[6][4]={{0,1,3,7},{0,3,2,7},{0,2,6,7},{0,6,4,7},{0,4,5,7},{0,5,1,7}};
  for(int z=o[2];z<o[2]+8;z++)for(int y=o[1];y<o[1]+8;y++)for(int x=o[0];x<o[0]+8;x++){
    ++cache.st.cells;std::array<uint32_t,8> ids;std::array<Sample,8> values;std::array<V,8> positions;
    for(int j=0;j<8;j++){int a=x+(j&1),b=y+((j>>1)&1),d=z+((j>>2)&1);ids[j]=c.id(a,b,d);values[j]=cache.pair(a,b,d);positions[j]=c.pos(a,b,d);}
    for(int ti=0;ti<6;ti++)for(int branch=0;branch<(cache.edited?2:1);branch++){
      auto t=tetra[ti];int negative=0;V inside{},outside{};std::array<float,4> d;
      for(int j=0;j<4;j++){d[j]=branch?values[t[j]].b:values[t[j]].a;if(d[j]<0){negative++;inside=inside+positions[t[j]];}else outside=outside+positions[t[j]];}
      if(negative==0||negative==4)continue;
      V direction=outside*(1./(4-negative))-inside*(1./negative);
      std::vector<Crossing> polygon;
      for(int a=0;a<4;a++)for(int b=a+1;b<4;b++)if((d[a]<0)!=(d[b]<0))polygon.push_back(on_edge(cache,ids[t[a]],ids[t[b]],branch));
      std::sort(polygon.begin(),polygon.end(),[](const Crossing&a,const Crossing&b){return a.vertex.key<b.vertex.key;});
      polygon.erase(std::unique(polygon.begin(),polygon.end(),[](const Crossing&a,const Crossing&b){return a.vertex.key==b.vertex.key;}),polygon.end());
      if(polygon.size()<3)continue;
      V midpoint{};for(auto& v:polygon)midpoint=midpoint+v.vertex.pos();midpoint=midpoint*(1./polygon.size());
      V normal=unit(direction),u=unit(polygon[0].vertex.pos()-midpoint),v=cross(normal,u);
      std::sort(polygon.begin(),polygon.end(),[&](const Crossing&a,const Crossing&b){V pa=a.vertex.pos()-midpoint,pb=b.vertex.pos()-midpoint;return std::atan2(dot(pa,v),dot(pa,u))<std::atan2(dot(pb,v),dot(pb,u));});
      std::vector<Crossing> clipped;
      for(size_t j=0;j<polygon.size();j++){auto& a=polygon[j];auto& b=polygon[(j+1)%polygon.size()];if(a.other<=0)clipped.push_back(a);if((a.other<0&&b.other>0)||(a.other>0&&b.other<0))clipped.push_back(rim_crossing(cache,a,b));}
      if(clipped.size()<3)continue;
      auto smallest=std::min_element(clipped.begin(),clipped.end(),[](auto&a,auto&b){return a.vertex.key<b.vertex.key;});std::rotate(clipped.begin(),smallest,clipped.end());
      for(size_t j=1;j+1<clipped.size();j++){
        Tri tri{{clipped[0].vertex,clipped[j].vertex,clipped[j+1].vertex},(uint64_t(c.id(x,y,z))*6+ti)*16+branch*8+j-1,uint32_t(branch)};
        if(dot(cross(tri.v[1].pos()-tri.v[0].pos(),tri.v[2].pos()-tri.v[0].pos()),direction)<0)std::swap(tri.v[1],tri.v[2]);
        require(norm(cross(tri.v[1].pos()-tri.v[0].pos(),tri.v[2].pos()-tri.v[0].pos()))>1e-15,"degenerate triangle");{allocation::Scope geometry_category(allocation::Geometry);result->triangles.push_back(tri);}
      }
    }
  }
  return result;
}
Mesh mesh(Cache& c){allocation::Scope category(allocation::Geometry);
  Mesh m(c.tokens.size());
  for(size_t k=0;k<m.size();k++)m[k]=extract(c,int(k),1);
  return m;
}
std::vector<Tri> flatten(const Mesh& mesh){allocation::Scope category(allocation::Temporary);
  std::vector<Tri> t;
  for(auto& r:mesh)t.insert(t.end(),r->triangles.begin(),r->triangles.end());
  std::sort(t.begin(),t.end(),[](auto&a,auto&b){
    return a.id<b.id;
  });
  return t;
}
struct Box {
  V lo{
    1e30,1e30,1e30
  }, hi{
    -1e30,-1e30,-1e30
  };
  void add(V p){
    lo={
      std::min(lo.x,p.x),std::min(lo.y,p.y),std::min(lo.z,p.z)
    };
    hi={
      std::max(hi.x,p.x),std::max(hi.y,p.y),std::max(hi.z,p.z)
    };
  }
  double distance2(V p)const{
    double x=std::max({
      lo.x-p.x,0.,p.x-hi.x
    }),y=std::max({
      lo.y-p.y,0.,p.y-hi.y
    }),z=std::max({
      lo.z-p.z,0.,p.z-hi.z
    });
    return x*x+y*y+z*z;
  }
};
double segment_distance2(V p,V a,V b){
  V d=b-a;
  double t=std::clamp(dot(p-a,d)/dot(d,d),0.,1.);
  V e=p-(a+d*t);
  return dot(e,e);
}
double triangle_distance2(V p,const Tri& t){
  V a=t.v[0].pos(),b=t.v[1].pos(),c=t.v[2].pos(),u=b-a,v=c-a,w=p-a;
  double uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),wu=dot(w,u),wv=dot(w,v),det=uu*vv-uv*uv;
  double x=(wu*vv-wv*uv)/det,y=(wv*uu-wu*uv)/det;
  if(x>=0&&y>=0&&x+y<=1){
    V d=w-u*x-v*y;
    return dot(d,d);
  }
  return std::min({
    segment_distance2(p,a,b),segment_distance2(p,b,c),segment_distance2(p,c,a)
  });
}
struct BVH {
  struct Entry {
    Box box;
    int left=-1,right=-1;
    size_t begin=0,end=0;
  };
  const std::vector<Tri>& triangles;
  std::vector<size_t> order;
  std::vector<Entry> entries;
  explicit BVH(const std::vector<Tri>& t):triangles(t),order(t.size()){
    std::iota(order.begin(),order.end(),0);
    entries.reserve(t.size()/2);
    build(0,t.size());
  }
  int build(size_t begin,size_t end){
    Entry entry;
    entry.begin=begin;
    entry.end=end;
    for(size_t j=begin;j<end;j++)for(auto& v:triangles[order[j]].v)entry.box.add(v.pos());
    int id=int(entries.size());
    entries.push_back(entry);
    if(end-begin>8){
      V ext=entry.box.hi-entry.box.lo;
      int axis=ext.x>=ext.y&&ext.x>=ext.z?0:ext.y>=ext.z?1:2;
      auto coord=[&](size_t k){
        V p{
        };
        for(auto& v:triangles[k].v)p=p+v.pos();
        return axis==0?p.x:axis==1?p.y:p.z;
      };
      size_t mid=(begin+end)/2;
      std::nth_element(order.begin()+begin,order.begin()+mid,order.begin()+end,[&](size_t a,size_t b){
        double x=coord(a),y=coord(b);return x<y||(x==y&&a<b);
      });
      int left=build(begin,mid),right=build(mid,end);
      entries[id].left=left;
      entries[id].right=right;
    }
    return id;
  }
  void query(int id,V p,double& best)const{
    auto& e=entries[id];
    if(e.box.distance2(p)>best)return;
    if(e.left<0){
      for(size_t j=e.begin;j<e.end;j++)best=std::min(best,triangle_distance2(p,triangles[order[j]]));
      return;
    }
    double a=entries[e.left].box.distance2(p),b=entries[e.right].box.distance2(p);
    if(a<b){
      query(e.left,p,best);
      query(e.right,p,best);
    }
    else{
      query(e.right,p,best);
      query(e.left,p,best);
    }
  }
  double distance(V p)const{
    double best=std::numeric_limits<double>::infinity();
    query(0,p,best);
    return std::sqrt(best);
  }
};

#include "../reuse/intersections.h"
