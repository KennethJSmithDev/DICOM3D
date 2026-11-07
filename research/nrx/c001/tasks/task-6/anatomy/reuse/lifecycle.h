struct LifecycleTimings {double sample_publish=0,mesh_publish=0,collision_delay=0;};
inline LifecycleTimings lifecycle_timings;
enum class Readiness {Absent,Queued,Building,ReadyCurrent,ReadyStale,Failed};
enum class JobState {Queued,Building,Complete,Failed,Canceled};
Readiness readiness(bool payload,bool current,JobState job){if(payload)return current?Readiness::ReadyCurrent:Readiness::ReadyStale;switch(job){case JobState::Queued:return Readiness::Queued;case JobState::Building:return Readiness::Building;case JobState::Failed:return Readiness::Failed;default:return Readiness::Absent;}}
struct MeshJob {
 uint64_t world=1,generation=1;int configuration;size_t region;uint64_t token;
 JobState status=JobState::Queued;std::shared_ptr<const Region> result;
};
struct CollisionArtifact {
 uint64_t generation=0,token=0,publication=0,mesh_publication=0;
 std::shared_ptr<const Region> mesh; // lifecycle stand-in only, never a collider
};
struct Publication {
 std::shared_ptr<const Cache> samples;
 std::shared_ptr<const Mesh> meshes;
 std::vector<CollisionArtifact> collisions;
 uint64_t sample_revision=7;
 explicit Publication(std::shared_ptr<const Cache> cache,const Mesh& initial):samples(std::move(cache)),meshes(std::make_shared<const Mesh>(initial)),collisions(initial.size()){}
 bool valid(const MeshJob& job,const World& world)const{return job.status==JobState::Complete&&job.result&&job.world==world.authority->world&&job.generation==world.authority->generation&&job.configuration==world.authority->resolution&&job.region<world.authority->tokens.size()&&job.token==world.authority->tokens[job.region]&&job.result->token==job.token&&job.result->generation==job.generation&&job.result->configuration==job.configuration;}
 bool publish_samples(std::shared_ptr<const Cache> result,const World& world,uint64_t generation){
  if(!result->source||result->source->generation!=generation||generation!=world.authority->generation||result->cfg.n!=world.authority->resolution||result->tokens!=world.authority->tokens)return false;
  uint64_t next=increment(sample_revision);samples=std::move(result);sample_revision=next;return true;
 }
 bool publish_group(const std::vector<MeshJob>& jobs,const std::vector<bool>& required,const World& world){
  allocation::Scope category(allocation::Temporary);
  if(required.size()!=meshes->size()||jobs.size()!=size_t(std::count(required.begin(),required.end(),true)))return false;
  std::vector<bool> seen(required.size());
  for(auto& j:jobs){if(!valid(j,world)||!required[j.region]||seen[j.region]||samples->tokens[j.region]!=j.token||j.result->publication!=increment((*meshes)[j.region]->publication))return false;seen[j.region]=true;}
  auto replacement=std::make_shared<Mesh>(*meshes);
  for(auto& j:jobs)(*replacement)[j.region]=j.result;
  meshes=std::move(replacement);return true;
 }
 bool collision_current(size_t region,const World& world)const{
  auto& c=collisions[region];return c.mesh&&c.generation==world.authority->generation&&c.token==world.authority->tokens[region]&&c.mesh==(*meshes)[region]&&c.mesh_publication==(*meshes)[region]->publication;
 }
 void complete_collision(size_t region,const World& world){auto& c=collisions[region];c={world.authority->generation,world.authority->tokens[region],increment(c.publication),(*meshes)[region]->publication,(*meshes)[region]};}
};
uint64_t lifecycle_checks(const std::shared_ptr<const Cache>& old_cache,const Cache& edited,const Mesh& old_mesh,const Mesh& edited_mesh,const std::vector<bool>& dirty){
 lifecycle_timings={};uint64_t checked=0;auto check=[&](bool value,const char* message){require(value,message);++checked;};
 auto rejects=[&](auto operation,const char* message){bool rejected=false;try{operation();}catch(const std::exception&){rejected=true;}check(rejected,message);};
 uint64_t baseline=allocation::totals.total;
 {
  allocation::Scope category(allocation::Temporary);
  World world(edited.cfg.n);auto old_authority=world.authority;
  Publication views(old_cache,old_mesh);
  for(size_t k=0;k<old_mesh.size();k++)views.complete_collision(k,world);
  auto old_mesh_snapshot=views.meshes;
  auto delay_started=Clock::now();auto receipt=world.accept(Proposal{},dirty);
  check(readiness(false,false,JobState::Canceled)==Readiness::Absent,"absent readiness");
  check(readiness(false,false,JobState::Queued)==Readiness::Queued,"queued readiness");
  check(readiness(false,false,JobState::Building)==Readiness::Building,"building readiness");
  check(readiness(false,false,JobState::Failed)==Readiness::Failed,"failed readiness");
  check(readiness(true,false,JobState::Building)==Readiness::ReadyStale,"stale old result while building");
  check(readiness(true,true,JobState::Complete)==Readiness::ReadyCurrent,"current readiness");
  check(receipt==1&&world.authority->shape==1&&world.authority->material==1,"authority stable identities");
  check(old_authority->commit==0&&old_authority->edits.empty(),"immutable captured authority");
  check(world.accept(Proposal{},dirty)==1&&world.authority->edits.size()==1,"idempotent operation");
  auto accepted=world.authority;
  Proposal conflict;conflict.radius=.4;rejects([&]{world.accept(conflict,dirty);},"conflicting replay");
  Proposal stale;stale.operation=2;rejects([&]{world.accept(stale,dirty);},"stale proposal");
  Proposal invalid;invalid.radius=std::numeric_limits<double>::quiet_NaN();rejects([&]{world.accept(invalid,dirty);},"nonfinite radius");
  invalid.radius=-1;rejects([&]{world.accept(invalid,dirty);},"negative radius");
  check(world.authority==accepted,"rejected mutation atomicity");
  check(edited.tokens==world.authority->tokens,"cache updated from accepted regional dependencies");
  size_t first=0;while(first<dirty.size()&&!dirty[first])++first;check(first<dirty.size(),"nonempty changed group");
  MeshJob late{1,1,edited.cfg.n,first,0,JobState::Complete,old_mesh[first]};
  check(!views.valid(late,world),"stale affected work rejected");
  {auto forged=late;forged.token=world.authority->tokens[first];check(!views.valid(forged,world),"new job stamp cannot relabel old payload");}
  for(size_t k=0;k<dirty.size();k++)if(!dirty[k]){auto unchanged=late;unchanged.region=k;unchanged.result=old_mesh[k];check(views.valid(unchanged,world),"unaffected work current after commit");check(views.collision_current(k,world),"unaffected collision current");}
  check(!views.collision_current(first,world),"collision stale at edit");
  auto fresh_samples=std::make_shared<const Cache>(edited);
  auto publication_started=Clock::now();check(views.publish_samples(fresh_samples,world,1),"independent sample publication");lifecycle_timings.sample_publish=secs(publication_started);
  check(views.sample_revision==8&&(*views.meshes)[first]->publication==1&&!views.collision_current(first,world),"sample readiness not mesh/collision readiness");
  std::vector<MeshJob> jobs;for(size_t k=0;k<dirty.size();k++)if(dirty[k])jobs.push_back({1,1,edited.cfg.n,k,world.authority->tokens[k],JobState::Complete,edited_mesh[k]});
  auto snapshot=views.meshes;auto incomplete=jobs;incomplete.pop_back();
  check(!views.publish_group(incomplete,dirty,world)&&views.meshes==snapshot,"atomic incomplete border rejection");
  for(auto state:{JobState::Queued,JobState::Building,JobState::Failed,JobState::Canceled}){auto bad=jobs;bad[0].status=state;check(!views.publish_group(bad,dirty,world)&&views.meshes==snapshot,"unready failed canceled cannot publish");}
  {auto bad=jobs;bad[0].token=0;check(!views.publish_group(bad,dirty,world)&&views.meshes==snapshot,"mixed shared-border token rejection");}
  {auto bad=jobs;bad[0].configuration=edited.cfg.n/2;check(!views.publish_group(bad,dirty,world),"wrong configuration rejection");}
  // Forward, reverse and rotations exercise order-independent complete groups.
  for(int order=0;order<6;order++){
    views.meshes=snapshot;
    std::sort(jobs.begin(),jobs.end(),[](auto&a,auto&b){return a.region<b.region;});
    static constexpr int permutations[6][3]={{0,1,2},{0,2,1},{1,0,2},{1,2,0},{2,0,1},{2,1,0}};
    if(jobs.size()>=3){auto a=jobs[0],b=jobs[1],c=jobs[2];std::array<MeshJob,3> prefix{a,b,c};for(int k=0;k<3;k++)jobs[k]=prefix[permutations[order][k]];}
    publication_started=Clock::now();check(views.publish_group(jobs,dirty,world),"atomic group permutation");lifecycle_timings.mesh_publish+=secs(publication_started);
    for(size_t k=0;k<dirty.size();k++)check((*views.meshes)[k]==edited_mesh[k],"published canonical region identity");
  }
  check(!views.collision_current(first,world),"mesh publication not collision readiness");
  views.complete_collision(first,world);lifecycle_timings.collision_delay=secs(delay_started);check(views.collision_current(first,world),"delayed collision test artifact ready");
  check((*old_mesh_snapshot)[first]==old_mesh[first]&&old_cache->tokens[first]==0,"old readers preserve old payload");
  auto old_job=jobs[0];world.reset();check(!views.valid(old_job,world),"old generation rejection");
  rejects([&]{increment(UINT64_MAX);},"checked publication counter overflow");
  {World overflow(edited.cfg.n);auto state=std::make_shared<Authority>(*overflow.authority);state->commit=UINT64_MAX;overflow.authority=state;Proposal p;p.expected=UINT64_MAX;rejects([&]{overflow.accept(p,dirty);},"world overflow atomic rejection");check(overflow.authority==state,"overflow leaves authority unchanged");}
  {World overflow(edited.cfg.n);auto state=std::make_shared<Authority>(*overflow.authority);state->tokens[first]=UINT64_MAX;overflow.authority=state;rejects([&]{overflow.accept(Proposal{},dirty);},"region overflow atomic rejection");check(overflow.authority==state,"region overflow leaves authority unchanged");}
 }
 check(allocation::totals.total==baseline,"integrated snapshots jobs readers return to byte baseline");
 // Repeat actual cache build/edit/collapse destruction on a tiny fixture.
 for(int repeat=0;repeat<3;repeat++){
  uint64_t before=allocation::totals.total;
  {Cache cycle(16,edited.sparse);cycle.build(false);auto d=cycle.dirty();auto captured=std::make_shared<const Cache>(cycle);cycle.update(d);if(cycle.sparse){cycle.edited=false;for(size_t k=0;k<d.size();k++)if(d[k])cycle.fill_brick(int(k));for(int z=0;z<=16;z++)for(int y=0;y<=16;y++)for(int x=0;x<=16;x++)check(cycle.pair(x,y,z)==captured->pair(x,y,z),"collapse/re-expansion preserved paired samples");}}
  check(allocation::totals.total==before,"repeated cache reset returns allocation baseline");
 }
 return checked;
}
