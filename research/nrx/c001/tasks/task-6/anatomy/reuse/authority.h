// Integrated immutable source/cache/mesh publication fixture. Single-threaded
// completion permutations qualify the protocol, not a production scheduler.
uint64_t increment(uint64_t value){require(value<UINT64_MAX,"revision overflow");return value+1;}
struct Proposal {uint64_t operation=1,expected=0,generation=1;V q=cutter;double radius=r;};
struct Accepted {uint64_t operation,commit;V q;double radius;};
struct Authority {
 uint64_t world=1,generation=1,shape=1,material=1,commit=0;int resolution;
 V sphere_center=center;double sphere_radius=R;
 std::vector<uint64_t> tokens;std::vector<Accepted> edits;
 explicit Authority(int n):resolution(n),tokens(size_t(n/8)*(n/8)*(n/8),0){}
};
struct World {
 std::shared_ptr<const Authority> authority;
 explicit World(int n){allocation::Scope category(allocation::Authority);authority=std::make_shared<const Authority>(n);}
 uint64_t accept(const Proposal& p,const std::vector<bool>& dirty){
  allocation::Scope category(allocation::Authority);
  require(p.generation==authority->generation,"wrong world generation");
  require(std::isfinite(p.q.x)&&std::isfinite(p.q.y)&&std::isfinite(p.q.z)&&std::isfinite(p.radius)&&p.radius>0,"invalid operation numbers");
  for(auto& e:authority->edits)if(e.operation==p.operation){require((e.q.x==p.q.x&&e.q.y==p.q.y&&e.q.z==p.q.z)&&e.radius==p.radius,"conflicting operation replay");return e.commit;}
  require(p.expected==authority->commit,"stale expected commit");
  require((p.q.x==cutter.x&&p.q.y==cutter.y&&p.q.z==cutter.z)&&p.radius==r&&authority->edits.empty(),"operation outside bounded fixture");
  require(dirty.size()==authority->tokens.size(),"support configuration mismatch");
  uint64_t next=increment(authority->commit);
  auto replacement=std::make_shared<Authority>(*authority);
  replacement->commit=next;
  for(size_t k=0;k<dirty.size();k++)if(dirty[k])replacement->tokens[k]=increment(replacement->tokens[k]);
  replacement->edits.push_back({p.operation,next,p.q,p.radius});
  authority=std::move(replacement);return next;
 }
 void reset(){allocation::Scope category(allocation::Authority);auto next=std::make_shared<Authority>(authority->resolution);next->generation=increment(authority->generation);authority=std::move(next);}
};

struct Query {double sphere,cutter;bool solid;std::optional<V> sphere_gradient,cutter_gradient;};
Query query(const Authority& source,V p){
 require(std::isfinite(p.x)&&std::isfinite(p.y)&&std::isfinite(p.z)&&p.x>=-2&&p.x<=2&&p.y>=-2&&p.y<=2&&p.z>=-2&&p.z<=2,"query outside finite domain");
 V a=p-source.sphere_center,b=p-cutter;double an=norm(a),bn=norm(b);
 Query out{an-source.sphere_radius,bn-r,false,std::nullopt,std::nullopt};
 out.solid=out.sphere<=0&&(source.edits.empty()||out.cutter>=0);
 if(an>0)out.sphere_gradient=a*(1/an);
 if(bn>0)out.cutter_gradient=b*(1/bn);
 return out;
}
