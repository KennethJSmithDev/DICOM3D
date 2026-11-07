#include "../../../../../research/nrx/c002/tasks/task-2/source/r002-adapter.h"
// Thin isolated occupancy adapter. Frozen NRX Task2 mesh ABI and source remain unchanged.
static std::vector<uint8_t> records;static std::string failure;
extern "C" {
EMSCRIPTEN_KEEPALIVE int nrx_extract(const float* values,int size,int ok,int orow,int oc){
 records.clear();failure.clear();try{
 require(values&&size>=3&&size<=87,"Unsupported scalar grid size");constexpr int offset=20,n=128;
 Cache cache(n,false);cache.dense.assign(size_t(n+1)*(n+1)*(n+1),Sample{-.5f,-1.f});
 for(int z=0;z<size;z++)for(int y=0;y<size;y++)for(int x=0;x<size;x++){float f=values[(z*size+y)*size+x];require(std::isfinite(f)&&f>=0&&f<=1,"Invalid occupancy scalar");cache.dense[cache.cfg.id(x+offset,y+offset,z+offset)]={f-.5f,-1.f};}
 auto extracted=mesh(cache);auto triangles=flatten(extracted);uint64_t count=triangles.size();require(count<=250000,"Surface triangle ceiling");records.resize(8+count*84);std::memcpy(records.data(),&count,8);size_t pos=8;
 for(const auto& tri:triangles)for(const auto& vertex:tri.v){uint32_t keys[4]={vertex.key.a,vertex.key.b,vertex.key.c,vertex.key.constraint};float coords[3]={(vertex.p[2]+2)*32-offset+ok,(vertex.p[1]+2)*32-offset+orow,(vertex.p[0]+2)*32-offset+oc};std::memcpy(records.data()+pos,keys,16);std::memcpy(records.data()+pos+16,coords,12);pos+=28;}
 return int(count);
 }catch(const std::exception& e){failure=e.what();records.clear();return -1;}
}
EMSCRIPTEN_KEEPALIVE uint8_t* nrx_pointer(){return records.data();}
EMSCRIPTEN_KEEPALIVE int nrx_bytes(){return int(records.size());}
EMSCRIPTEN_KEEPALIVE const char* nrx_error(){return failure.c_str();}
EMSCRIPTEN_KEEPALIVE void nrx_release(){std::vector<uint8_t>().swap(records);failure.clear();}
}
