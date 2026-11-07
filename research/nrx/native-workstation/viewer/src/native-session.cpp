#include <webgpu/webgpu.h>
#include <emscripten.h>
#include <cstdint>
#include <cstdio>
#include <cstdlib>

// DICOM3D-owned Wasm64 session. Thin adaptation of qualified C001 ownership/Emdawn path.
// No native RAF loop, source authority or process-global JS Module is installed.
namespace {
WGPUInstance instance=nullptr;WGPUSurface surface=nullptr;WGPUAdapter adapter=nullptr;
WGPUDevice device=nullptr;WGPUQueue queue=nullptr;
char selector[256];uint32_t generation=0,width=0,height=0,maxExtent=0;
int state=0,live=0,pending=0,errors=0,rejected=0,submitted=0,completed=0;
bool closing=false,sourceReady=false,referenceReady=false,probeRequested=false;
void clearSource();bool resizeSourceDepth(uint32_t,uint32_t);
void fail(const char* stage,WGPUStringView message){++errors;state=-1;char text[512];std::snprintf(text,sizeof(text),"%s: %.*s",stage,int(message.data?message.length:0),message.data?message.data:"");EM_ASM({Module.nrxLastError=UTF8ToString($0);},text);}
void error(WGPUDevice const*,WGPUErrorType,WGPUStringView message,void*,void*){fail("GPU",message);}
void lost(WGPUDevice const*,WGPUDeviceLostReason reason,WGPUStringView message,void* token,void*){if(uintptr_t(token)!=generation||closing||reason==WGPUDeviceLostReason_Destroyed)return;fail("DEVICE_LOST",message);}
bool configure(uint32_t w,uint32_t h){
 if(!device||w>maxExtent||h>maxExtent)return false;
 if(width||height)wgpuSurfaceUnconfigure(surface);width=w;height=h;
 if(!w||!h)return (sourceReady||referenceReady)?resizeSourceDepth(0,0):true;
 auto config=WGPU_SURFACE_CONFIGURATION_INIT;config.device=device;config.format=WGPUTextureFormat_BGRA8Unorm;config.usage=WGPUTextureUsage_RenderAttachment|WGPUTextureUsage_CopySrc;config.width=w;config.height=h;config.presentMode=WGPUPresentMode_Fifo;config.alphaMode=WGPUCompositeAlphaMode_Opaque;wgpuSurfaceConfigure(surface,&config);return (sourceReady||referenceReady)?resizeSourceDepth(w,h):true;
}
void deviceReady(WGPURequestDeviceStatus status,WGPUDevice value,WGPUStringView message,void* token,void*){
 --pending;if(uintptr_t(token)!=generation||closing){if(value){wgpuDeviceDestroy(value);wgpuDeviceRelease(value);}++rejected;return;}
 if(status!=WGPURequestDeviceStatus_Success||!value){fail("DEVICE",message);return;}
 device=value;++live;queue=wgpuDeviceGetQueue(device);++live;auto limits=WGPU_LIMITS_INIT;
 if(wgpuDeviceGetLimits(device,&limits)!=WGPUStatus_Success){fail("LIMITS",WGPU_STRING_VIEW_INIT);return;}maxExtent=limits.maxTextureDimension2D;
 auto caps=WGPU_SURFACE_CAPABILITIES_INIT;if(wgpuSurfaceGetCapabilities(surface,adapter,&caps)!=WGPUStatus_Success){fail("SURFACE_CAPABILITIES",WGPU_STRING_VIEW_INIT);return;}
 bool found=false;for(size_t i=0;i<caps.formatCount;i++)if(caps.formats[i]==WGPUTextureFormat_BGRA8Unorm)found=true;wgpuSurfaceCapabilitiesFreeMembers(caps);
 if(!found||!configure(width,height)){fail("SURFACE_CONFIGURATION",WGPU_STRING_VIEW_INIT);return;}state=1;
}
void adapterReady(WGPURequestAdapterStatus status,WGPUAdapter value,WGPUStringView message,void* token,void*){
 --pending;if(uintptr_t(token)!=generation||closing){if(value)wgpuAdapterRelease(value);++rejected;return;}
 if(status!=WGPURequestAdapterStatus_Success||!value){fail("ADAPTER",message);return;}adapter=value;++live;
 auto dd=WGPU_DEVICE_DESCRIPTOR_INIT;dd.uncapturedErrorCallbackInfo.callback=error;dd.deviceLostCallbackInfo.mode=WGPUCallbackMode_AllowSpontaneous;dd.deviceLostCallbackInfo.callback=lost;dd.deviceLostCallbackInfo.userdata1=token;
 auto cb=WGPU_REQUEST_DEVICE_CALLBACK_INFO_INIT;cb.mode=WGPUCallbackMode_AllowSpontaneous;cb.callback=deviceReady;cb.userdata1=token;++pending;wgpuAdapterRequestDevice(adapter,&dd,cb);
}
void queueReady(WGPUQueueWorkDoneStatus status,WGPUStringView message,void* token,void*){--pending;if(uintptr_t(token)!=generation||closing){++rejected;return;}if(status!=WGPUQueueWorkDoneStatus_Success){fail("QUEUE",message);return;}completed++;}
#include "native-source.h"
#include "native-reference.h"
}
extern "C" {
EMSCRIPTEN_KEEPALIVE uintptr_t nrx_selector_ptr(){return uintptr_t(selector);}
EMSCRIPTEN_KEEPALIVE int nrx_pointer_bytes(){return sizeof(void*);}
EMSCRIPTEN_KEEPALIVE int nrx_init(uint32_t w,uint32_t h){
 if(live||pending||w==0||h==0)return 0;closing=false;state=0;errors=0;submitted=completed=0;++generation;width=w;height=h;
 auto id=WGPU_INSTANCE_DESCRIPTOR_INIT;instance=wgpuCreateInstance(&id);++live;
 auto canvas=WGPU_EMSCRIPTEN_SURFACE_SOURCE_CANVAS_HTML_SELECTOR_INIT;canvas.selector={selector,WGPU_STRLEN};auto sd=WGPU_SURFACE_DESCRIPTOR_INIT;sd.nextInChain=&canvas.chain;surface=wgpuInstanceCreateSurface(instance,&sd);++live;
 auto options=WGPU_REQUEST_ADAPTER_OPTIONS_INIT;options.compatibleSurface=surface;options.powerPreference=WGPUPowerPreference_HighPerformance;
 auto cb=WGPU_REQUEST_ADAPTER_CALLBACK_INFO_INIT;cb.mode=WGPUCallbackMode_AllowSpontaneous;cb.callback=adapterReady;cb.userdata1=(void*)uintptr_t(generation);++pending;wgpuInstanceRequestAdapter(instance,&options,cb);return generation;
}
EMSCRIPTEN_KEEPALIVE int nrx_resize(uint32_t token,uint32_t w,uint32_t h){if(token!=generation||closing||state!=1||pending){++rejected;return 0;}return configure(w,h);}
EMSCRIPTEN_KEEPALIVE int nrx_frame(uint32_t token,float r,float g,float b){
 if(token!=generation||closing||state!=1||pending||!width||!height){++rejected;return 0;}
 auto acquired=WGPU_SURFACE_TEXTURE_INIT;wgpuSurfaceGetCurrentTexture(surface,&acquired);
 if(!acquired.texture){fail("ACQUIRE",WGPU_STRING_VIEW_INIT);return 0;}
 auto view=wgpuTextureCreateView(acquired.texture,nullptr);auto ed=WGPU_COMMAND_ENCODER_DESCRIPTOR_INIT;auto encoder=wgpuDeviceCreateCommandEncoder(device,&ed);
 auto color=WGPU_RENDER_PASS_COLOR_ATTACHMENT_INIT;color.view=view;color.loadOp=WGPULoadOp_Clear;color.storeOp=WGPUStoreOp_Store;color.clearValue={r,g,b,1};auto pd=WGPU_RENDER_PASS_DESCRIPTOR_INIT;pd.colorAttachmentCount=1;pd.colorAttachments=&color;auto depth=WGPU_RENDER_PASS_DEPTH_STENCIL_ATTACHMENT_INIT;if(sourceReady||referenceReady){depth.view=depthView;depth.depthLoadOp=WGPULoadOp_Clear;depth.depthStoreOp=WGPUStoreOp_Store;depth.depthClearValue=0;pd.depthStencilAttachment=&depth;}
 auto pass=wgpuCommandEncoderBeginRenderPass(encoder,&pd);if(sourceReady)recordSource(pass);else if(referenceReady)recordReference(pass);wgpuRenderPassEncoderEnd(pass);wgpuRenderPassEncoderRelease(pass);const bool probing=probeRequested;if(probing){if(probeKind==6)recordDiagnostic(encoder);if(probeKind==7||probeKind==8)recordReferenceProbe(encoder);else recordProbe(encoder,acquired.texture);probeRequested=false;}auto bd=WGPU_COMMAND_BUFFER_DESCRIPTOR_INIT;auto commands=wgpuCommandEncoderFinish(encoder,&bd);wgpuQueueSubmit(queue,1,&commands);submitted++;
 wgpuCommandBufferRelease(commands);wgpuCommandEncoderRelease(encoder);wgpuTextureViewRelease(view);wgpuTextureRelease(acquired.texture);
 auto cb=WGPU_QUEUE_WORK_DONE_CALLBACK_INFO_INIT;cb.mode=WGPUCallbackMode_AllowSpontaneous;cb.callback=queueReady;cb.userdata1=(void*)uintptr_t(generation);++pending;wgpuQueueOnSubmittedWorkDone(queue,cb);if(probing){auto map=WGPU_BUFFER_MAP_CALLBACK_INFO_INIT;map.mode=WGPUCallbackMode_AllowSpontaneous;map.callback=probeReady;map.userdata1=(void*)uintptr_t(generation);++pending;wgpuBufferMapAsync(probeBuffer,WGPUMapMode_Read,0,probeSize,map);}return 1;
}
EMSCRIPTEN_KEEPALIVE uintptr_t nrx_source_ptr(int kind){switch(kind){case 0:return uintptr_t(SourceShader);case 1:return uintptr_t(SourceUniforms);case 2:return uintptr_t(SourceWords);case 3:return uintptr_t(SourceMask);case 4:return uintptr_t(SourceVertices);case 5:return uintptr_t(SourceIndices);case 6:return uintptr_t(SourceProbePoints);default:return 0;}}
EMSCRIPTEN_KEEPALIVE int nrx_prepare_source(uint32_t token,uint32_t w,uint32_t h,uint32_t d,uint32_t vertices,uint32_t indices){if(token!=generation||closing)return 0;return prepareSource(w,h,d,vertices,indices);}
EMSCRIPTEN_KEEPALIVE int nrx_publish_source(uint32_t token){if(token!=generation||closing)return 0;return publishSource();}
EMSCRIPTEN_KEEPALIVE int nrx_probe_points(uint32_t token,uint32_t count){if(token!=generation||closing||pending||!sourceReady||count<1||count>128)return 0;wgpuQueueWriteBuffer(queue,pointBuffer,0,SourceProbePoints,count*16);return 1;}
EMSCRIPTEN_KEEPALIVE int nrx_source_probe(uint32_t token,int kind){if(token!=generation||closing||pending||(!sourceReady&&!referenceReady)||kind<1||kind>8)return 0;probeKind=kind;probeRequested=true;return 1;}
EMSCRIPTEN_KEEPALIVE uintptr_t nrx_reference_ptr(int kind){switch(kind){case 0:return uintptr_t(ReferenceVertices);case 1:return uintptr_t(ReferenceIndices);case 2:return uintptr_t(ReferenceRanges);case 3:return uintptr_t(ReferenceUniforms);case 4:return uintptr_t(ReferenceStates);default:return 0;}}
EMSCRIPTEN_KEEPALIVE int nrx_prepare_reference(uint32_t token,uint32_t vertices,uint32_t indices,uint32_t draws){return token==generation&&!closing?prepareReference(vertices,indices,draws):0;}
EMSCRIPTEN_KEEPALIVE int nrx_publish_reference(uint32_t token){return token==generation&&!closing?publishReference():0;}
EMSCRIPTEN_KEEPALIVE int nrx_source_meta(int key){switch(key){case 0:return sourceReady;case 1:return sourceW;case 2:return sourceH;case 3:return sourceD;case 4:return vertexCount;case 5:return indexCount;default:return -1;}}
EMSCRIPTEN_KEEPALIVE int nrx_begin_close(){if(!closing){closing=true;generation++;state=4;}return generation;}
EMSCRIPTEN_KEEPALIVE int nrx_dispose(){
 if(!closing||pending)return 0;clearReference();clearSource();
 #define DROP(x,fn) if(x){fn(x);x=nullptr;--live;}
 if(surface)wgpuSurfaceUnconfigure(surface);DROP(queue,wgpuQueueRelease);if(device)wgpuDeviceDestroy(device);DROP(device,wgpuDeviceRelease);DROP(adapter,wgpuAdapterRelease);DROP(surface,wgpuSurfaceRelease);DROP(instance,wgpuInstanceRelease);
 #undef DROP
 state=5;return live==0;
}
EMSCRIPTEN_KEEPALIVE int nrx_value(int key){switch(key){case 0:return state;case 1:return live;case 2:return pending;case 3:return errors;case 4:return generation;case 5:return submitted;case 6:return completed;case 7:return rejected;case 8:return width;case 9:return height;case 10:return maxExtent;default:return -1;}}
}
int main(){EM_ASM({Module.nrxMemory=wasmMemory;});return sizeof(void*)==8?0:1;}
