#define R002_TEST_INCLUDE
#include "kernel.cpp"
#include <functional>
Tri test_triangle(std::array<V,3> p,std::array<uint32_t,3> ids){Tri t{};for(int i=0;i<3;i++)t.v[i]={{ids[i],ids[i]},{float(p[i].x),float(p[i].y),float(p[i].z)}};return t;}
int main(){try{
 uint64_t count=0;auto check=[&](bool v,const char* why){require(v,why);++count;};
 auto rejects=[&](std::function<void()> f,const char* why){bool failed=false;try{f();}catch(const std::exception&){failed=true;}check(failed,why);};
 auto a=test_triangle({V{0,0,0},V{1,0,0},V{0,1,0}},{0,1,2});
 check(!bad_contact(a,test_triangle({V{2,0,0},V{3,0,0},V{2,1,0}},{3,4,5})),"disjoint coplanar triangles");
 check(bad_contact(a,test_triangle({V{.25,.25,-1},V{.25,.25,1},V{.75,.25,0}},{3,4,5})),"transverse intersection");
 check(bad_contact(a,test_triangle({V{.1,.1,0},V{.2,.1,0},V{.1,.2,0}},{3,4,5})),"coplanar containment");
 check(bad_contact(a,test_triangle({V{0,0,0},V{-1,0,0},V{0,-1,0}},{3,4,5})),"undeclared point contact");
 check(!bad_contact(a,test_triangle({V{0,0,0},V{-1,0,0},V{0,-1,0}},{0,4,5})),"declared vertex only");
 check(bad_contact(a,test_triangle({V{0,0,0},V{.5,.1,0},V{.1,.5,0}},{0,4,5})),"shared vertex does not excuse overlap");
 check(!bad_contact(a,test_triangle({V{0,0,0},V{1,0,0},V{0,-1,0}},{0,1,5})),"valid coplanar shared edge");
 check(bad_contact(a,test_triangle({V{0,0,0},V{1,0,0},V{.5,.2,0}},{0,1,5})),"folded coplanar shared edge");
 check(!bad_contact(a,test_triangle({V{0,0,0},V{1,0,0},V{0,0,1}},{0,1,5})),"valid noncoplanar shared edge");
 check(bad_contact(a,a),"duplicate triangle contact");
 check(orient3({0,0,0},{1,0,0},{0,1,0},{0,0,1})==-1,"exact 3D orientation sign");
 check(orient3({0,0,0},{1,0,0},{0,1,0},{.25,.25,0})==0,"exact coplanarity");
 check(orient2({0,0,0},{1,0,0},{0,1,0},2)==1,"exact projected orientation");
 check((ExactInt::number(1)-ExactInt::number(1)).sign==0,"exact integer cancellation");
 float tiny=std::numeric_limits<float>::denorm_min();check(orient3({0,0,0},{1,0,0},{0,1,0},{0,0,tiny})==-1,"subnormal exact predicate");
 for(int mask=0;mask<8;mask++){
  auto p=V{(mask&1)?1.:0.,(mask&2)?1.:0.,(mask&4)?1.:0.};
  check(ExactInt::number(p.x).sign==(p.x>0?1:0),"integer coordinate encoding");
 }
 uint64_t baseline=allocation::totals.total;{allocation::Scope tag(allocation::Samples);std::vector<uint32_t> v(1024);check(allocation::totals.total==baseline+v.capacity()*sizeof(uint32_t),"allocation capacity instrument");}check(allocation::totals.total==baseline,"allocation release instrument");
 {struct alignas(128) Aligned{char data[128];};auto v=std::make_unique<Aligned>();check(reinterpret_cast<uintptr_t>(v.get())%128==0,"aligned allocation");}check(allocation::totals.total==baseline,"aligned release");
 World world(16);auto q=query(*world.authority,center);check(!q.sphere_gradient&&q.sphere==-R&&q.solid,"center field and unavailable gradient");
 check(!query(*world.authority,cutter).cutter_gradient,"cutter center gradient unavailable");
 check(std::abs(norm(*query(*world.authority,center+V{.5,0,0}).sphere_gradient)-1)<1e-14,"analytic gradient");
 rejects([&]{query(*world.authority,{3,0,0});},"finite domain rejection");
 rejects([&]{query(*world.authority,{std::numeric_limits<double>::infinity(),0,0});},"nonfinite query rejection");
 for(int n:{16,32,64,128}){Config c(n);check(c.pos(0,0,0).x==-2&&c.pos(n,n,n).z==2,"lattice endpoints");for(double axis:{cutter.x,cutter.y,cutter.z}){int crossings=0;for(int k=1;k<c.bn;k++){double plane=-2+k*8*c.h;crossings+=axis-r<plane&&plane<axis+r;}if(n>=32)check(crossings>0,"cutter partition crossing");}}
 rejects([]{Config c(17);},"invalid resolution");rejects([]{Config c(16);c.id(-1,0,0);},"out of range sample");
 oracle_tests();++count;check(std::abs(triangle_distance2({.25,.25,1},a)-1)<1e-14,"independent triangle distance");
 Config config(16);uint32_t seed=305419896;auto random=[&](){seed=1664525*seed+1013904223;return double(seed)/4294967296.;};
 for(int test=0;test<200;test++){V low{-2+3*random(),-2+3*random(),-2+3*random()},hi=low+V{random(),random(),random()};for(auto sphere:{std::make_pair(center,R),std::make_pair(cutter,r)}){auto bound=distance_bounds(low,hi,sphere.first,sphere.second);for(int i=0;i<20;i++){V p{low.x+(hi.x-low.x)*random(),low.y+(hi.y-low.y)*random(),low.z+(hi.z-low.z)*random()};double value=norm(p-sphere.first)-sphere.second;check(value>=bound.first&&value<=bound.second,"independent interval extrema diagnostics");}}}
 Cache dense(16,false),sparse(16,true);dense.build(false);sparse.build(false);for(int z=0;z<=16;z++)for(int y=0;y<=16;y++)for(int x=0;x<=16;x++)check(dense.pair(x,y,z)==sparse.pair(x,y,z),"paired dense sparse equality");
 rejects([&]{sparse.pair(-1,0,0);},"sparse out of domain query");rejects([&]{config.pos(17,0,0);},"out of domain coordinate mapping");
 auto tris=flatten(mesh(dense));auto v=validate(tris,config,false);check(v.contact_pairs>0,"sphere validator executed contact checks");
 auto broken=tris;broken.pop_back();rejects([&]{validate(broken,config,false);},"hole rejected");
 broken=tris;broken.push_back(tris[0]);rejects([&]{validate(broken,config,false);},"duplicate face rejected");
 broken=tris;std::swap(broken[0].v[0],broken[0].v[1]);rejects([&]{validate(broken,config,false);},"bad winding rejected");
 broken=tris;broken[0].v[0].p[0]=std::numeric_limits<float>::quiet_NaN();rejects([&]{validate(broken,config,false);},"NaN rejected");
 std::cout<<"{\"status\":\"V2_DISCRIMINATING_CHECKS_PASS\",\"checks\":"<<count<<",\"interval_seed\":305419896,\"contact_cases\":10,\"thresholds_changed\":false}\n";
 }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}return 0;}
