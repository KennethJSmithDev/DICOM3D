#pragma once
#include <array>
#include <cstddef>
#include <cstdlib>
#include <new>
#include <cstdint>
#include <iostream>
namespace allocation {
enum Category {Authority, Samples, Index, Geometry, Temporary, Validation, Count};
inline const char* names[Count]={"authority","sample_payload","index_metadata","geometry","temporary_snapshots_queues","validation"};
struct Totals {std::array<uint64_t,Count> live{},peak{},at_total_peak{},allocations{};uint64_t total=0,peak_total=0,raw=0,peak_raw=0,blocks=0;};
inline Totals totals;inline Category category=Temporary;
struct Scope {Category previous;explicit Scope(Category c):previous(category){category=c;}~Scope(){category=previous;}};
struct alignas(std::max_align_t) Header {void* base;size_t size,raw;Category category;};
inline void* allocate(size_t bytes,size_t alignment){
 if(bytes>SIZE_MAX-sizeof(Header)-alignment)throw std::bad_alloc();
 alignment=alignment<alignof(Header)?alignof(Header):alignment;
 size_t raw=bytes+sizeof(Header)+alignment-1;void* base=std::malloc(raw);if(!base)throw std::bad_alloc();
 auto address=(reinterpret_cast<uintptr_t>(base)+sizeof(Header)+alignment-1)&~uintptr_t(alignment-1);
 auto* h=reinterpret_cast<Header*>(address)-1;*h={base,bytes,raw,category};
 auto& t=totals;t.live[category]+=bytes;t.peak[category]=std::max(t.peak[category],t.live[category]);++t.allocations[category];++t.blocks;t.total+=bytes;t.raw+=raw;t.peak_raw=std::max(t.peak_raw,t.raw);
 if(t.total>t.peak_total){t.peak_total=t.total;t.at_total_peak=t.live;}
 return reinterpret_cast<void*>(address);
}
inline uint64_t raw_bytes(const void* ptr){if(!ptr)return 0;return (reinterpret_cast<const Header*>(ptr)-1)->raw;}
inline void release(void* ptr)noexcept{if(!ptr)return;auto* h=reinterpret_cast<Header*>(ptr)-1;totals.live[h->category]-=h->size;totals.total-=h->size;totals.raw-=h->raw;--totals.blocks;std::free(h->base);}
inline void report(){const auto snapshot=totals;std::cout<<"{\"requested_live_bytes\":"<<snapshot.total<<",\"requested_peak_bytes\":"<<snapshot.peak_total<<",\"instrumented_malloc_peak_bytes\":"<<snapshot.peak_raw<<",\"live_blocks\":"<<snapshot.blocks<<",\"categories\":{";for(int i=0;i<Count;i++){if(i)std::cout<<',';std::cout<<'"'<<names[i]<<"\":{\"live\":"<<snapshot.live[i]<<",\"peak\":"<<snapshot.peak[i]<<",\"at_total_peak\":"<<snapshot.at_total_peak[i]<<",\"allocations\":"<<snapshot.allocations[i]<<'}';}std::cout<<"},\"includes_all_cpp_new_requests\":true,\"allocator_internal_fragmentation\":\"RSS_ONLY\",\"compiler_stack_and_runtime_malloc\":\"RSS_ONLY\"}";}
}
void* operator new(std::size_t n){return allocation::allocate(n,alignof(std::max_align_t));}
void* operator new[](std::size_t n){return allocation::allocate(n,alignof(std::max_align_t));}
void operator delete(void* p)noexcept{allocation::release(p);}
void operator delete[](void* p)noexcept{allocation::release(p);}
void operator delete(void* p,std::size_t)noexcept{allocation::release(p);}
void operator delete[](void* p,std::size_t)noexcept{allocation::release(p);}
void* operator new(std::size_t n,std::align_val_t a){return allocation::allocate(n,size_t(a));}
void* operator new[](std::size_t n,std::align_val_t a){return allocation::allocate(n,size_t(a));}
void operator delete(void* p,std::align_val_t)noexcept{allocation::release(p);}
void operator delete[](void* p,std::align_val_t)noexcept{allocation::release(p);}
void operator delete(void* p,std::size_t,std::align_val_t)noexcept{allocation::release(p);}
void operator delete[](void* p,std::size_t,std::align_val_t)noexcept{allocation::release(p);}
