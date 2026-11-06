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
#include "allocation.h"
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
constexpr V center{
  .125,-.1875,.0625
}, cutter{
  .9375,-.1875,.0625
};
constexpr double R=.9,r=.3125,guard=1e-12;
double S(V p){
  return norm(p-center)-R;
}
double C(V p){
  return norm(p-cutter)-r;
}
double clamp(double x){
  return std::clamp(x,-1.,1.);
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
#include "authority.h"
float field(V p,const Config& c,bool edit,Stats& st){
  ++st.points;
  double a=clamp(S(p)/c.b);
  return float(edit?std::max(a,clamp(-C(p)/c.b)):a);
}
std::pair<double,double> distance_bounds(V lo,V hi,V c,double radius){
  double near2=0,far2=0;
  double l[]={
    lo.x,lo.y,lo.z
  },u[]={
    hi.x,hi.y,hi.z
  },a[]={
    c.x,c.y,c.z
  };
  for(int k=0;k<3;k++){
    double near=std::max({
      l[k]-a[k],0.,a[k]-u[k]
    }),far=std::max(std::abs(l[k]-a[k]),std::abs(u[k]-a[k]));
    near2+=near*near;
    far2+=far*far;
  }
  return{
    std::sqrt(near2)-radius-guard,std::sqrt(far2)-radius+guard
  };
}
std::pair<double,double> interval(V lo,V hi,const Config& c,bool edit,Stats& st){
  ++st.intervals;
  auto a=distance_bounds(lo,hi,center,R);
  double l=clamp(a.first/c.b),u=clamp(a.second/c.b);
  if(edit){
    auto b=distance_bounds(lo,hi,cutter,r);
    l=std::max(l,clamp(-b.second/c.b));
    u=std::max(u,clamp(-b.first/c.b));
  }
  return{
    l,u
  };
}
static_assert(sizeof(float)==4&&std::numeric_limits<float>::is_iec559&&sizeof(double)==8,"binary32/binary64 contract");
struct Sample {
  float a=-1,b=-1;
  bool operator==(const Sample& p)const{return a==p.a&&b==p.b;}
  bool operator!=(const Sample& p)const{return !(*this==p);}
};
Sample pair_field(V p,const Config& c,bool edit,Stats& st,const Authority* source=nullptr){
  ++st.points;
  V origin=source?source->sphere_center:center;double radius=source?source->sphere_radius:R;V q=source&&!source->edits.empty()?source->edits[0].q:cutter;double qr=source&&!source->edits.empty()?source->edits[0].radius:r;
  return {float(clamp((norm(p-origin)-radius)/c.b)),edit?float(clamp((qr-norm(p-q))/c.b)):-1.f};
}
struct Brick { Sample tile; bool constant=false; std::vector<Sample> samples; };
struct Node { std::array<int,8> children{}; int leaf=-1; bool constant=false; Sample tile; };
struct Cache {
  Config cfg; bool sparse,edited=false;std::shared_ptr<const Authority> source;
  std::vector<Sample> dense; std::vector<Brick> leaves; std::vector<Node> nodes;
  std::vector<uint64_t> tokens; Stats st;
  Cache(int n,bool sp,std::shared_ptr<const Authority> authority={}):cfg(n),sparse(sp),source(std::move(authority)),leaves(sp?cfg.bn*cfg.bn*cfg.bn:0),tokens(source?source->tokens:std::vector<uint64_t>(cfg.bn*cfg.bn*cfg.bn,0)){}
  int hierarchy(int x,int y,int z,int width){allocation::Scope category(allocation::Index);
    int id=int(nodes.size());nodes.emplace_back();
    if(width==1){nodes[id].leaf=cfg.brick(x,y,z);nodes[id].constant=leaves[nodes[id].leaf].constant;nodes[id].tile=leaves[nodes[id].leaf].tile;}
    else {int half=width/2;bool constant=true;Sample tile;
      for(int i=0;i<8;i++){int child=hierarchy(x+(i&1)*half,y+((i>>1)&1)*half,z+((i>>2)&1)*half,half);nodes[id].children[i]=child;if(i==0)tile=nodes[child].tile;constant&=nodes[child].constant&&nodes[child].tile==tile;}
      nodes[id].constant=constant;nodes[id].tile=tile;
    }return id;
  }
  void refresh_node(int id,const std::vector<bool>& dirty){
    ++st.nodes_visited;auto& n=nodes[id];bool before=n.constant;Sample old=n.tile;
    if(n.leaf>=0){if(dirty[n.leaf]){n.constant=leaves[n.leaf].constant;n.tile=leaves[n.leaf].tile;}return;}
    bool constant=true;Sample tile;
    for(int i=0;i<8;i++){refresh_node(n.children[i],dirty);auto& child=nodes[n.children[i]];if(i==0)tile=child.tile;constant&=child.constant&&child.tile==tile;}
    n.constant=constant;n.tile=tile;if(before!=constant||old!=tile)++st.ancestors;
  }
  void fill_brick(int k){allocation::Scope category(allocation::Samples);
    ++st.bricks;st.intervals+=edited?2:1;auto o=cfg.origin(k);V lo=cfg.pos(o[0],o[1],o[2]),hi=cfg.pos(o[0]+8,o[1]+8,o[2]+8);
    auto a=distance_bounds(lo,hi,center,R);double al=clamp(a.first/cfg.b),ah=clamp(a.second/cfg.b),bl=-1,bh=-1;
    if(edited){auto b=distance_bounds(lo,hi,cutter,r);bl=clamp(-b.second/cfg.b);bh=clamp(-b.first/cfg.b);}
    auto& leaf=leaves[k];leaf.constant=(al==ah)&&(bl==bh);leaf.tile={float(al),float(bl)};
    if(leaf.constant){std::vector<Sample>().swap(leaf.samples);return;}
    leaf.samples.resize(729);
    for(int z=0;z<=8;z++)for(int y=0;y<=8;y++)for(int x=0;x<=8;x++)leaf.samples[(z*9+y)*9+x]=pair_field(cfg.pos(o[0]+x,o[1]+y,o[2]+z),cfg,edited,st,source.get());
  }
  void build(bool edit){allocation::Scope category(allocation::Samples);edited=edit;if(sparse){for(size_t k=0;k<leaves.size();k++)fill_brick(int(k));{allocation::Scope index_category(allocation::Index);nodes.reserve((leaves.size()*8-1)/7);}hierarchy(0,0,0,cfg.bn);}else{dense.resize(size_t(cfg.n+1)*(cfg.n+1)*(cfg.n+1));for(int z=0;z<=cfg.n;z++)for(int y=0;y<=cfg.n;y++)for(int x=0;x<=cfg.n;x++)dense[cfg.id(x,y,z)]=pair_field(cfg.pos(x,y,z),cfg,edited,st,source.get());}}
  Sample pair(int x,int y,int z)const{(void)cfg.id(x,y,z);if(!sparse)return dense[cfg.id(x,y,z)];int bx=std::min(x/8,cfg.bn-1),by=std::min(y/8,cfg.bn-1),bz=std::min(z/8,cfg.bn-1);const auto& leaf=leaves[cfg.brick(bx,by,bz)];return leaf.constant?leaf.tile:leaf.samples[((z-bz*8)*9+(y-by*8))*9+x-bx*8];}
  Sample pair(uint32_t id)const{int x=id%(cfg.n+1);id/=cfg.n+1;return pair(x,id%(cfg.n+1),id/(cfg.n+1));}
  float get(int x,int y,int z)const{Sample s=pair(x,y,z);return std::max(s.a,s.b);}
  uint64_t payload()const{uint64_t n=dense.capacity()*sizeof(Sample);for(auto& leaf:leaves)n+=leaf.samples.capacity()*sizeof(Sample);return n;}
  uint64_t metadata()const{return sizeof(*this)+leaves.capacity()*sizeof(Brick)+nodes.capacity()*sizeof(Node)+tokens.capacity()*sizeof(uint64_t);}
  uint64_t instrumented_cost()const{uint64_t cost=sizeof(*this)+allocation::raw_bytes(dense.data())+allocation::raw_bytes(leaves.data())+allocation::raw_bytes(nodes.data())+allocation::raw_bytes(tokens.data());for(auto& leaf:leaves)cost+=allocation::raw_bytes(leaf.samples.data());return cost;}
  int saturated()const{int count=0;for(auto& leaf:leaves)count+=leaf.constant;return count;}
  std::vector<bool> dirty()const{
    std::vector<bool> d(tokens.size());double rad=r+cfg.b;
    for(int z=0;z<=cfg.n;z++)for(int y=0;y<=cfg.n;y++)for(int x=0;x<=cfg.n;x++){
      V p=cfg.pos(x,y,z);if(std::abs(p.x-cutter.x)>rad||std::abs(p.y-cutter.y)>rad||std::abs(p.z-cutter.z)>rad)continue;
      for(int dz=-1;dz<=0;dz++)for(int dy=-1;dy<=0;dy++)for(int dx=-1;dx<=0;dx++){int a=x+dx,b=y+dy,c=z+dz;if(a>=0&&b>=0&&c>=0&&a<cfg.n&&b<cfg.n&&c<cfg.n)d[cfg.brick(a/8,b/8,c/8)]=true;}
    }return d;
  }
  void update(const std::vector<bool>& d){edited=true;for(size_t k=0;k<d.size();k++)if(d[k]){require(tokens[k]<std::numeric_limits<uint64_t>::max(),"token overflow");++tokens[k];}
    if(sparse){for(size_t k=0;k<d.size();k++)if(d[k])fill_brick(int(k));refresh_node(0,d);}
    else {double rad=r+cfg.b;for(int z=0;z<=cfg.n;z++)for(int y=0;y<=cfg.n;y++)for(int x=0;x<=cfg.n;x++){V p=cfg.pos(x,y,z);if(std::abs(p.x-cutter.x)<=rad&&std::abs(p.y-cutter.y)<=rad&&std::abs(p.z-cutter.z)<=rad){++st.dirty_samples;auto& value=dense[cfg.id(x,y,z)];auto next=pair_field(p,cfg,true,st,source.get());st.changed+=next!=value;value=next;}}}
  }
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
uint64_t geometry_bytes(const Mesh& m){
  uint64_t n=m.capacity()*sizeof(m[0]);
  for(auto& r:m)n+=sizeof(Region)+r->triangles.capacity()*sizeof(Tri);
  return n;
}
uint64_t hash(const std::vector<Tri>& t){
  uint64_t h=14695981039346656037ull;
  auto add=[&](const void* p,size_t n){
    auto a=static_cast<const unsigned char*>(p);
    for(size_t k=0;k<n;k++){
      h^=a[k];
      h*=1099511628211ull;
    }
  };
  for(auto& q:t){
    add(&q.id,sizeof(q.id));
    for(auto& v:q.v){
      add(&v.key.a,4);
      add(&v.key.b,4);add(&v.key.c,4);add(&v.key.constraint,4);
      for(float p:v.p)add(&p,4);
    }
  }
  return h;
}
// Independent boundary distance: valid projections to two patches and rim.
double oracle(V p,bool edit){
  if(!edit)return std::abs(S(p));
  double d=norm(cutter-center),a=(R*R-r*r+d*d)/(2*d),rho=std::sqrt(R*R-a*a);
  V rim=center+V{
    a,0,0
  };
  double yz=std::hypot(p.y-rim.y,p.z-rim.z);
  double best=std::hypot(p.x-rim.x,yz-rho);
  for(int k=0;k<2;k++){
    V c=k?cutter:center;
    double rad=k?r:R;
    V v=p-c;
    double len=norm(v);
    V q=c+(len>0?v*(rad/len):V{
      0,rad,0
    });
    if(k?S(q)<=guard:C(q)>=-guard)best=std::min(best,norm(p-q));
  }
  return best;
}
double exact_volume(bool edit){
  double sphere=4*std::acos(-1.)*R*R*R/3;
  if(!edit)return sphere;
  double d=norm(cutter-center);
  double lens=std::acos(-1.)*std::pow(R+r-d,2)*(d*d+2*d*r-3*r*r+2*d*R+6*r*R-3*R*R)/(12*d);
  return sphere-lens;
}
// Independent nearest-triangle queries for analytic-to-mesh sampled error.
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
struct ReverseError {
  uint64_t count=0;
  double maximum=0,rms=0;
};
ReverseError reverse_error(const std::vector<Tri>& tris,const Config& cfg,bool edit){
  BVH bvh(tris);
  ReverseError result;
  double sum=0;
  auto sample=[&](V p){
    double d=bvh.distance(p);
    result.maximum=std::max(result.maximum,d);
    sum+=d*d;
    result.count++;
  };
  double pi=std::acos(-1.);
  for(int patch=0;patch<(edit?2:1);patch++){
    V c=patch?cutter:center;
    double radius=patch?r:R;
    int lat=int(std::ceil(pi*radius/(cfg.h/4))),lon=2*lat;
    for(int j=0;j<=lat;j++){
      double theta=pi*j/lat;
      for(int i=0;i<(j==0||j==lat?1:lon);i++){
        double phi=2*pi*i/lon;
        V p=c+V{
          radius*std::cos(theta),radius*std::sin(theta)*std::cos(phi),radius*std::sin(theta)*std::sin(phi)
        };
        if(!edit||(patch?S(p)<=guard:C(p)>=-guard))sample(p);
      }
    }
  }
  if(edit){
    double d=norm(cutter-center),a=(R*R-r*r+d*d)/(2*d),rho=std::sqrt(R*R-a*a);
    int count=int(std::ceil(2*pi*rho/(cfg.h/4)));
    for(int j=0;j<count;j++){
      double angle=2*pi*j/count;
      sample(center+V{
        a,rho*std::cos(angle),rho*std::sin(angle)
      });
    }
  }
  result.rms=std::sqrt(sum/result.count);
  require(result.maximum<=cfg.h&&result.rms<=.4*cfg.h,"reverse sampled error");
  return result;
}
#include "intersections.h"
struct Validation{
  uint64_t vertices=0,edges=0,triangles=0,forward_count=0,orientation_checked=0,orientation_rim_skipped=0,contact_pairs=0;
  ReverseError reverse;
  double volume=0,volume_error=0,forward_max=0,forward_rms=0;
};
Validation validate(const std::vector<Tri>& tris,const Config& cfg,bool edit){allocation::Scope category(allocation::Validation);
  Validation out;
  out.triangles=tris.size();
  std::map<Key,uint32_t> ids;
  std::vector<V> positions;
  std::vector<std::array<uint32_t,3>> faces;
  std::map<std::pair<uint32_t,uint32_t>,std::pair<int,int>> edges;
  std::set<std::array<uint32_t,3>> unique;
  std::vector<std::vector<std::pair<uint32_t,uint32_t>>> links;
  std::vector<uint32_t> parent;
  double sum=0;
  for(auto& t:tris){
    std::array<uint32_t,3> f;
    for(int k=0;k<3;k++){
      auto [it,inserted]=ids.emplace(t.v[k].key,uint32_t(ids.size()));
      f[k]=it->second;
      V p=t.v[k].pos();
      require(std::isfinite(p.x)&&std::isfinite(p.y)&&std::isfinite(p.z),"nonfinite");
      if(inserted){
        positions.push_back(p);
        links.emplace_back();
        parent.push_back(f[k]);
      }
      else require(norm(positions[f[k]]-p)==0,"seam positions");
    }
    auto canonical=f;
    std::sort(canonical.begin(),canonical.end());
    require(unique.insert(canonical).second,"duplicate face");
    for(int k=0;k<3;k++){
      auto a=f[k],b=f[(k+1)%3];
      auto& e=edges[std::minmax(a,b)];
      e.first++;
      e.second+=a<b?1:-1;
      links[f[k]].push_back({
        f[(k+1)%3],f[(k+2)%3]
      });
    }
    faces.push_back(f);
    V a=t.v[0].pos(),b=t.v[1].pos(),c=t.v[2].pos();
    V cr=cross(b-a,c-a);
    require(norm(cr)>1e-15,"zero area");
    out.volume+=dot(a,cross(b,c))/6;
    V mid=(a+b+c)*(1./3);
    V normal=t.branch?(cutter-mid):(mid-center);
    require(dot(cr,normal)>0,"analytic branch face orientation");++out.orientation_checked;
    int m=std::max(2,int(std::ceil(std::max({
      norm(b-a),norm(c-b),norm(a-c)
    })/(cfg.h/4))));
    for(int i=0;i<=m;i++)for(int j=0;j<=m-i;j++){
      V p=a+(b-a)*(double(i)/m)+(c-a)*(double(j)/m);
      double err=oracle(p,edit);
      out.forward_max=std::max(out.forward_max,err);
      sum+=err*err;
      ++out.forward_count;
    }
  }
  for(auto& [k,e]:edges){
    require(e.first==2&&e.second==0,"edge manifold/orientation");
  }
  auto root=[&](uint32_t x){
    while(parent[x]!=x){
      parent[x]=parent[parent[x]];
      x=parent[x];
    }
    return x;
  };
  for(auto& f:faces)for(int k=1;k<3;k++){
    auto a=root(f[0]),b=root(f[k]);
    parent[a]=b;
  }
  if(!parent.empty()){
    auto a=root(0);
    for(uint32_t k=1;k<parent.size();k++)require(root(k)==a,"disconnected");
  }
  for(size_t link_id=0;link_id<links.size();link_id++){
    auto& link=links[link_id];
    std::map<uint32_t,std::vector<uint32_t>> adjacency;
    for(auto [a,b]:link){
      adjacency[a].push_back(b);
      adjacency[b].push_back(a);
    }
    for(auto& [k,v]:adjacency)require(v.size()==2,"vertex link degree");
    std::set<uint32_t> visited;
    std::vector<uint32_t> todo{
      adjacency.begin()->first
    };
    while(!todo.empty()){
      auto k=todo.back();
      todo.pop_back();
      if(!visited.insert(k).second)continue;
      for(auto v:adjacency[k])todo.push_back(v);
    }
    if(visited.size()!=adjacency.size()){
      auto p=positions[link_id];
      std::cerr<<"link defect edit="<<edit<<" vertex="<<link_id<<" p="<<p.x<<","<<p.y<<","<<p.z<<" visited="<<visited.size()<<" neighbors="<<adjacency.size()<<"\n";
    }
    require(visited.size()==adjacency.size(),"vertex link disconnected");
  }
  out.vertices=ids.size();
  out.edges=edges.size();
  require(int64_t(out.vertices)-int64_t(out.edges)+int64_t(out.triangles)==2,"Euler");
  out.volume_error=std::abs(out.volume-exact_volume(edit))/exact_volume(edit);
  out.forward_rms=std::sqrt(sum/out.forward_count);
  require(out.volume>0&&out.volume_error<=.25*cfg.h/R,"volume error");
  require(out.forward_max<=cfg.h&&out.forward_rms<=.4*cfg.h,"forward sampled error");
  out.reverse=reverse_error(tris,cfg,edit);out.contact_pairs=validate_contacts(tris);
  return out;
}
void oracle_tests(){
  require(std::abs(oracle(center,false)-R)<1e-14,"oracle center");
  require(oracle(center+V{
    -R,0,0
  },true)<1e-14,"outer patch");
  require(oracle(cutter+V{
    -r,0,0
  },true)<1e-14,"cavity patch");
  double d=norm(cutter-center),a=(R*R-r*r+d*d)/(2*d),rho=std::sqrt(R*R-a*a);
  require(oracle(center+V{
    a,rho,0
  },true)<1e-14,"rim");
  require(std::abs(oracle(cutter,true)-r)<1e-14,"cutter center oracle");
}
void json_stats(const Stats&s){
  std::cout<<"{\"points\":"<<s.points<<",\"intervals\":"<<s.intervals<<",\"cells\":"<<s.cells<<",\"bricks\":"<<s.bricks<<",\"ancestor_summary_changes\":"<<s.ancestors<<",\"hierarchy_nodes_visited\":"<<s.nodes_visited<<"}";
}
void json_validation(const Validation&v){
  std::cout<<"{\"vertices\":"<<v.vertices<<",\"edges\":"<<v.edges<<",\"triangles\":"<<v.triangles<<",\"orientation_checked\":"<<v.orientation_checked<<",\"orientation_rim_band_skipped\":"<<v.orientation_rim_skipped<<",\"volume\":"<<v.volume<<",\"volume_relative_error\":"<<v.volume_error<<",\"forward_count\":"<<v.forward_count<<",\"forward_max_m\":"<<v.forward_max<<",\"forward_rms_m\":"<<v.forward_rms<<",\"reverse_count\":"<<v.reverse.count<<",\"reverse_max_m\":"<<v.reverse.maximum<<",\"reverse_rms_m\":"<<v.reverse.rms<<",\"triangle_contact_pairs_tested\":"<<v.contact_pairs<<",\"triangle_intersections\":\"PASS\"}";
}
#include "lifecycle.h"
int experiment_main(int argc,char**argv){
  try{
    require(argc==3,"usage: kernel N dense|sparse");
    size_t parsed=0;int n=std::stoi(argv[1],&parsed);require(parsed==std::strlen(argv[1]),"malformed resolution");
    std::string mode=argv[2];
    require(mode=="dense"||mode=="sparse","mode");
    bool sparse=mode=="sparse";
    oracle_tests();
    auto start=Clock::now();
    allocation::Scope main_category(allocation::Index);
    World world(n);
    Cache cache(n,sparse,world.authority);
    cache.build(false);
    double build=secs(start);
    auto base_payload=cache.payload(),base_meta=cache.metadata(),base_instrumented=cache.instrumented_cost();
    auto t=Clock::now();
    auto old_mesh=mesh(cache);
    double extraction=secs(t);
    auto initial_stats=cache.st;
    auto base=flatten(old_mesh);
    t=Clock::now();
    auto vb=validate(base,cache.cfg,false);
    double validation=secs(t);
    auto base_hash=hash(base);
    t=Clock::now();
    auto dirty=cache.dirty();
    double invalidation_time=secs(t);
    size_t dirty_bricks=std::count(dirty.begin(),dirty.end(),true);
    auto snapshot_requested_before=allocation::totals.total,snapshot_raw_before=allocation::totals.raw;
    std::shared_ptr<const Cache> old_cache;{allocation::Scope snapshot_category(allocation::Temporary);old_cache=std::make_shared<const Cache>(cache);}
    auto snapshot_requested=allocation::totals.total-snapshot_requested_before,snapshot_raw=allocation::totals.raw-snapshot_raw_before;
    cache.st={
    };
    t=Clock::now();
    auto accept_started=Clock::now();
    require(world.accept(Proposal{},dirty)==1,"accepted edit before update");
    double acceptance_time=secs(accept_started);
    t=Clock::now();
    cache.source=world.authority;
    cache.update(dirty);
    require(cache.tokens==world.authority->tokens,"source and sample token closure");
    double refresh=secs(t);
    uint64_t actual_changes=0,shared_occurrences=0,dirty_unique_samples=0;
    Stats diagnostics;
    for(int z=0;z<=n;z++)for(int y=0;y<=n;y++)for(int x=0;x<=n;x++){
      V p=cache.cfg.pos(x,y,z);

      require(old_cache->pair(x,y,z)==pair_field(p,cache.cfg,false,diagnostics),"base sample/reference");
      double radius=r+cache.cfg.b;
      dirty_unique_samples+=std::abs(p.x-cutter.x)<=radius&&std::abs(p.y-cutter.y)<=radius&&std::abs(p.z-cutter.z)<=radius;

      require(cache.pair(x,y,z)==pair_field(p,cache.cfg,true,diagnostics),"updated sample/reference");
      actual_changes+=old_cache->pair(x,y,z)!=cache.pair(x,y,z);
      if(C(cache.cfg.pos(x,y,z))>=cache.cfg.b)require(old_cache->pair(x,y,z)==cache.pair(x,y,z),"paired projection locality");
    }
    if(sparse)for(size_t k=0;k<cache.leaves.size();k++){
      auto o=cache.cfg.origin(int(k));
      auto& l=cache.leaves[k];
      for(int z=0;z<=8;z++)for(int y=0;y<=8;y++)for(int x=0;x<=8;x++){
        Sample sample=l.constant?l.tile:l.samples[(z*9+y)*9+x];
        require(sample==cache.pair(o[0]+x,o[1]+y,o[2]+z),"duplicate paired corner mismatch");
        ++shared_occurrences;
      }
    }
    t=Clock::now();
    Mesh incremental=old_mesh;
    for(size_t k=0;k<dirty.size();k++)if(dirty[k])incremental[k]=extract(cache,int(k),2);
    double incremental_mesh_time=secs(t);
    auto incremental_stats=cache.st;
    auto changed=flatten(incremental);
    auto changed_hash=hash(changed);
    uint64_t target_zero_incident_faces=0;
    if(n==128){uint32_t id=cache.cfg.id(94,66,72);Key key{id,id};require(cache.pair(94,66,72).b==0,"original exact zero preserved");for(const auto& triangle:changed)for(const auto& vertex:triangle.v)if(vertex.key==key){require(equal_pos(vertex.pos(),V{.9375,.0625,.25}),"zero vertex must not move");++target_zero_incident_faces;}require(target_zero_incident_faces>0,"original zero vertex retained");}
    t=Clock::now();
    auto ve=validate(changed,cache.cfg,true);
    validation+=secs(t);
    Cache full(n,sparse,world.authority);
    t=Clock::now();
    full.build(true);
    double full_build=secs(t);
    t=Clock::now();
    auto full_mesh=mesh(full);
    double full_extraction=secs(t);
    auto rebuilt=flatten(full_mesh);
    require(changed==rebuilt,"incremental/full geometry");
    for(size_t k=0;k<dirty.size();k++)if(!dirty[k])require(incremental[k]==old_mesh[k]&&incremental[k]->publication==1,"unaffected view");
    auto lifecycle_started=Clock::now();
    uint64_t integrated_checks=lifecycle_checks(old_cache,cache,old_mesh,incremental,dirty);
    double lifecycle_time=secs(lifecycle_started);
    uint64_t unchanged_dirty_bricks=0;
    for(size_t k=0;k<dirty.size();k++)if(dirty[k]&&old_mesh[k]->triangles==incremental[k]->triangles)++unchanged_dirty_bricks;
    uint64_t unique_stored_samples=cache.dense.size();
    if(sparse){allocation::Scope validation_category(allocation::Validation);std::vector<bool> present(size_t(n+1)*(n+1)*(n+1));for(size_t k=0;k<cache.leaves.size();k++)if(!cache.leaves[k].constant){auto o=cache.cfg.origin(k);for(int z=0;z<=8;z++)for(int y=0;y<=8;y++)for(int x=0;x<=8;x++)present[cache.cfg.id(o[0]+x,o[1]+y,o[2]+z)]=true;}unique_stored_samples=std::count(present.begin(),present.end(),true);}
    uint64_t expanded=0;
    if(sparse)for(auto& l:cache.leaves)expanded+=!l.constant;
    std::cout.precision(12);
    std::cout<<"{\"status\":\"V2_IMPLEMENTED_GATES_PASS\",\"N\":"<<n<<",\"mode\":\""<<mode<<"\",\"base_hash\":\""<<base_hash<<"\",\"edited_hash\":\""<<changed_hash<<"\",\"dirty_bricks\":"<<dirty_bricks<<",\"total_bricks\":"<<dirty.size()<<",\"actual_changed_unique_samples\":"<<actual_changes<<",\"dirty_unique_samples\":"<<dirty_unique_samples<<",\"false_positive_dirty_samples\":"<<dirty_unique_samples-actual_changes<<",\"unchanged_dirty_mesh_bricks\":"<<unchanged_dirty_bricks<<",\"expanded_bricks\":"<<expanded<<",\"saturated_bricks\":"<<cache.saturated()<<",\"stored_occurrences\":"<<(sparse?expanded*729:cache.dense.size())<<",\"unique_stored_sample_identities\":"<<unique_stored_samples<<",\"duplicate_stored_sample_occurrences\":"<<(sparse?expanded*729:cache.dense.size())-unique_stored_samples<<",\"base_sample_representation_instrumented_bytes\":"<<base_instrumented<<",\"edited_sample_representation_instrumented_bytes\":"<<cache.instrumented_cost()<<",\"retained_old_sample_snapshot_requested_bytes\":"<<snapshot_requested<<",\"retained_old_sample_snapshot_instrumented_bytes\":"<<snapshot_raw<<",\"base_sample_payload_capacity_bytes\":"<<base_payload<<",\"base_sample_metadata_capacity_bytes\":"<<base_meta<<",\"edited_sample_payload_capacity_bytes\":"<<cache.payload()<<",\"edited_sample_metadata_capacity_bytes\":"<<cache.metadata()<<",\"authority_descriptor_numeric_bytes\":"<<sizeof(center)+sizeof(cutter)+sizeof(R)+sizeof(r)<<",\"base_geometry_capacity_bytes\":"<<geometry_bytes(old_mesh)<<",\"edited_geometry_capacity_bytes\":"<<geometry_bytes(incremental)<<",\"retained_old_sample_capacity_bytes\":"<<old_cache->payload()+old_cache->metadata()<<",\"canonical_comparison_buffer_capacity_bytes\":"<<(base.capacity()+changed.capacity()+rebuilt.capacity())*sizeof(Tri)<<",\"initial_work\":";
    json_stats(initial_stats);
    std::cout<<",\"incremental_work\":";
    json_stats(incremental_stats);
    std::cout<<",\"full_edited_work\":";
    json_stats(full.st);
    std::cout<<",\"seconds\":{\"initial_samples\":"<<build<<",\"initial_extraction\":"<<extraction<<",\"edit_acceptance\":"<<acceptance_time<<",\"invalidation\":"<<invalidation_time<<",\"sample_refresh\":"<<refresh<<",\"incremental_extraction\":"<<incremental_mesh_time<<",\"full_edited_samples\":"<<full_build<<",\"full_edited_extraction\":"<<full_extraction<<",\"geometry_validation\":"<<validation<<",\"total\":"<<secs(start)<<"},\"base_geometry\":";
    json_validation(vb);
    std::cout<<",\"edited_geometry\":";
    json_validation(ve);
    std::cout<<",\"incremental_equal_full\":true,\"accounting_complete\":true,\"shared_occurrences_checked\":"<<shared_occurrences<<",\"target_zero_vertex_incident_faces\":"<<target_zero_incident_faces<<",\"integrated_lifecycle_checks\":"<<integrated_checks<<",\"lifecycle_seconds\":"<<lifecycle_time<<",\"sample_publication_seconds\":"<<lifecycle_timings.sample_publish<<",\"mesh_group_publication_seconds\":"<<lifecycle_timings.mesh_publish<<",\"collision_test_artifact_delay_seconds\":"<<lifecycle_timings.collision_delay<<",\"allocation_accounting\":";allocation::report();std::cout<<"}\n";
  }
  catch(const std::exception&e){
    std::cerr<<"FAIL: "<<e.what()<<"\n";
    return 1;
  }
  return 0;
}

#ifndef R002_TEST_INCLUDE
int main(int argc,char**argv){uint64_t baseline=allocation::totals.total;int result=experiment_main(argc,argv);if(allocation::totals.total!=baseline){std::cerr<<"allocation baseline mismatch "<<baseline<<" -> "<<allocation::totals.total<<"\n";return 2;}std::cerr<<"allocation baseline restored: "<<baseline<<" requested bytes\n";return result;}
#endif
