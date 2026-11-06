#include <webgpu/webgpu.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <cstdint>
#include <cstdio>

// Private NRX-C001 adapter of the frozen RawWebGPUControl. Imaging authority stays in the verified host loader.
namespace {
constexpr uint32_t W=512,H=512,N=W*H;
uint16_t Source[N];
WGPUInstance instance=nullptr;
WGPUAdapter adapter=nullptr;
WGPUDevice device=nullptr;
WGPUQueue queue=nullptr;
WGPUSurface surface=nullptr;
WGPURenderPipeline pipeline=nullptr;
WGPUTexture texture=nullptr;
WGPUTextureView textureView=nullptr;
WGPUBindGroup group=nullptr;
WGPUBuffer sourceRead=nullptr,imageRead=nullptr;
WGPUTextureFormat surfaceFormat=WGPUTextureFormat_Undefined;
int state=0,live=0,errors=0,frames=0,mapped=0,rejected=0;
uint32_t generation=0;
bool disposing=false;
void event(const char* message) {
  EM_ASM({ const message=UTF8ToString($0); (globalThis.nativeEvents || (globalThis.nativeEvents=[])).push(message);
    document.getElementById('native-log').textContent+=message+'\n'; console.log('[NRX native] '+message); },message);
}
void failure(const char* stage,WGPUStringView msg) {
  char text[512]; std::snprintf(text,sizeof(text),"ERROR %s %.*s",stage,int(msg.data?msg.length:0),msg.data?msg.data:"");
  ++errors;state=-1;event(text);
}
void uncaptured(WGPUDevice const*,WGPUErrorType,WGPUStringView msg,void*,void*){failure("GPU",msg);}
void lost(WGPUDevice const*,WGPUDeviceLostReason reason,WGPUStringView msg,void* token,void*){
  if(uintptr_t(token)!=generation || disposing || reason==WGPUDeviceLostReason_Destroyed){event("DEVICE_DESTROY_OBSERVED");return;}
  failure("DEVICE_LOST",msg);
}
WGPUBuffer readBuffer(uint64_t bytes){
  auto d=WGPU_BUFFER_DESCRIPTOR_INIT;d.size=bytes;d.usage=WGPUBufferUsage_CopyDst|WGPUBufferUsage_MapRead;
  auto b=wgpuDeviceCreateBuffer(device,&d);if(b)++live;return b;
}
void mapReady(WGPUMapAsyncStatus status,WGPUStringView msg,void* token,void* kind){
  if(uintptr_t(token)!=generation){++rejected;return;}
  if(status!=WGPUMapAsyncStatus_Success){failure("MAP",msg);return;}
  int k=int(uintptr_t(kind));size_t bytes=k==1?N*2:N*4;auto b=k==1?sourceRead:imageRead;
  auto ptr=wgpuBufferGetConstMappedRange(b,0,bytes);
  EM_ASM({const p=Number($1); const n=Number($2); if(!Number.isSafeInteger(p)||p+n>HEAPU8.length)throw Error('Invalid native readback span');
    (globalThis.nativeReadbacks || (globalThis.nativeReadbacks={}))[Number($0)]=HEAPU8.slice(p,p+n);},k,ptr,bytes);
  wgpuBufferUnmap(b);
  if(++mapped==2){state=3;event("READBACKS_READY");}
}
void queueReady(WGPUQueueWorkDoneStatus status,WGPUStringView msg,void* token,void*){
  if(uintptr_t(token)!=generation){++rejected;return;}
  if(status!=WGPUQueueWorkDoneStatus_Success){failure("QUEUE",msg);return;}
  event("QUEUE_COMPLETE_60");
  for(int kind=1;kind<=2;++kind){auto cb=WGPU_BUFFER_MAP_CALLBACK_INFO_INIT;cb.mode=WGPUCallbackMode_AllowSpontaneous;cb.callback=mapReady;cb.userdata1=token;cb.userdata2=(void*)uintptr_t(kind);
    wgpuBufferMapAsync(kind==1?sourceRead:imageRead,WGPUMapMode_Read,0,kind==1?N*2:N*4,cb);}
}
bool animation(double,void* token){
  if(uintptr_t(token)!=generation || state!=2)return false;
  auto acquired=WGPU_SURFACE_TEXTURE_INIT;wgpuSurfaceGetCurrentTexture(surface,&acquired);
  if(!acquired.texture || (acquired.status!=WGPUSurfaceGetCurrentTextureStatus_SuccessOptimal&&acquired.status!=WGPUSurfaceGetCurrentTextureStatus_SuccessSuboptimal)){
    failure("SURFACE_ACQUIRE",WGPU_STRING_VIEW_INIT);return false;}
  auto view=wgpuTextureCreateView(acquired.texture,nullptr);
  auto ed=WGPU_COMMAND_ENCODER_DESCRIPTOR_INIT;auto encoder=wgpuDeviceCreateCommandEncoder(device,&ed);
  auto color=WGPU_RENDER_PASS_COLOR_ATTACHMENT_INIT;color.view=view;color.loadOp=WGPULoadOp_Clear;color.storeOp=WGPUStoreOp_Store;color.clearValue={0,0,0,1};
  auto pd=WGPU_RENDER_PASS_DESCRIPTOR_INIT;pd.colorAttachmentCount=1;pd.colorAttachments=&color;
  auto pass=wgpuCommandEncoderBeginRenderPass(encoder,&pd);wgpuRenderPassEncoderSetPipeline(pass,pipeline);wgpuRenderPassEncoderSetBindGroup(pass,0,group,0,nullptr);wgpuRenderPassEncoderDraw(pass,3,1,0,0);wgpuRenderPassEncoderEnd(pass);wgpuRenderPassEncoderRelease(pass);
  ++frames;
  if(frames==60){
    for(int kind=1;kind<=2;++kind){auto from=WGPU_TEXEL_COPY_TEXTURE_INFO_INIT;from.texture=kind==1?texture:acquired.texture;from.aspect=WGPUTextureAspect_All;
      auto to=WGPU_TEXEL_COPY_BUFFER_INFO_INIT;to.buffer=kind==1?sourceRead:imageRead;to.layout.bytesPerRow=kind==1?W*2:W*4;to.layout.rowsPerImage=H;
      WGPUExtent3D size={W,H,1};wgpuCommandEncoderCopyTextureToBuffer(encoder,&from,&to,&size);}
  }
  auto bd=WGPU_COMMAND_BUFFER_DESCRIPTOR_INIT;auto commands=wgpuCommandEncoderFinish(encoder,&bd);wgpuQueueSubmit(queue,1,&commands);
  wgpuCommandBufferRelease(commands);wgpuCommandEncoderRelease(encoder);wgpuTextureViewRelease(view);wgpuTextureRelease(acquired.texture);
  if(frames==60){event("NATIVE_FRAME_COUNT=60");auto cb=WGPU_QUEUE_WORK_DONE_CALLBACK_INFO_INIT;cb.mode=WGPUCallbackMode_AllowSpontaneous;cb.callback=queueReady;cb.userdata1=token;wgpuQueueOnSubmittedWorkDone(queue,cb);return false;}return true;
}
void deviceReady(WGPURequestDeviceStatus status,WGPUDevice value,WGPUStringView msg,void* token,void*){
  if(uintptr_t(token)!=generation){if(value)wgpuDeviceRelease(value);++rejected;return;}
  if(status!=WGPURequestDeviceStatus_Success||!value){failure("DEVICE",msg);return;}
  device=value;++live;queue=wgpuDeviceGetQueue(device);++live;
  auto caps=WGPU_SURFACE_CAPABILITIES_INIT;
  if(wgpuSurfaceGetCapabilities(surface,adapter,&caps)!=WGPUStatus_Success){failure("CAPABILITIES",WGPU_STRING_VIEW_INIT);return;}
  surfaceFormat=WGPUTextureFormat_BGRA8Unorm;bool supported=false;
  for(size_t i=0;i<caps.formatCount;++i)if(caps.formats[i]==surfaceFormat)supported=true;
  if(!supported){wgpuSurfaceCapabilitiesFreeMembers(caps);failure("BGRA8_REQUIRED",WGPU_STRING_VIEW_INIT);return;}
  auto config=WGPU_SURFACE_CONFIGURATION_INIT;config.device=device;config.format=surfaceFormat;config.usage=WGPUTextureUsage_RenderAttachment|WGPUTextureUsage_CopySrc;config.width=W;config.height=H;config.presentMode=WGPUPresentMode_Fifo;config.alphaMode=WGPUCompositeAlphaMode_Opaque;
  wgpuSurfaceConfigure(surface,&config);wgpuSurfaceCapabilitiesFreeMembers(caps);
  auto td=WGPU_TEXTURE_DESCRIPTOR_INIT;td.dimension=WGPUTextureDimension_2D;td.size={W,H,1};td.format=WGPUTextureFormat_R16Uint;td.usage=WGPUTextureUsage_TextureBinding|WGPUTextureUsage_CopyDst|WGPUTextureUsage_CopySrc;
  texture=wgpuDeviceCreateTexture(device,&td);++live;textureView=wgpuTextureCreateView(texture,nullptr);++live;
  const char* code=R"(@group(0) @binding(0) var source:texture_2d<u32>;
    @vertex fn vs(@builtin(vertex_index)i:u32)->@builtin(position)vec4<f32>{let p=array<vec2<f32>,3>(vec2<f32>(-1,1),vec2<f32>(-1,-3),vec2<f32>(3,1));return vec4<f32>(p[i],0,1);}
    @fragment fn fs(@builtin(position)p:vec4<f32>)->@location(0)vec4<f32>{let stored=textureLoad(source,vec2<i32>(p.xy),0).r;let scaled=(f32(stored)-1024.0-(-1350.0))/1500.0;let gray=round(clamp(scaled,0.0,1.0)*255.0)/255.0;return vec4<f32>(gray,gray,gray,1);})";
  auto wgsl=WGPU_SHADER_SOURCE_WGSL_INIT;wgsl.code={code,WGPU_STRLEN};auto sd=WGPU_SHADER_MODULE_DESCRIPTOR_INIT;sd.nextInChain=&wgsl.chain;auto shader=wgpuDeviceCreateShaderModule(device,&sd);++live;
  auto target=WGPU_COLOR_TARGET_STATE_INIT;target.format=surfaceFormat;target.writeMask=WGPUColorWriteMask_All;
  auto fragment=WGPU_FRAGMENT_STATE_INIT;fragment.module=shader;fragment.entryPoint={"fs",WGPU_STRLEN};fragment.targetCount=1;fragment.targets=&target;
  auto pp=WGPU_RENDER_PIPELINE_DESCRIPTOR_INIT;pp.vertex.module=shader;pp.vertex.entryPoint={"vs",WGPU_STRLEN};pp.fragment=&fragment;pp.primitive.topology=WGPUPrimitiveTopology_TriangleList;
  pipeline=wgpuDeviceCreateRenderPipeline(device,&pp);++live;wgpuShaderModuleRelease(shader);--live;
  auto layout=wgpuRenderPipelineGetBindGroupLayout(pipeline,0);++live;
  auto entry=WGPU_BIND_GROUP_ENTRY_INIT;entry.binding=0;entry.textureView=textureView;
  auto gd=WGPU_BIND_GROUP_DESCRIPTOR_INIT;gd.layout=layout;gd.entryCount=1;gd.entries=&entry;group=wgpuDeviceCreateBindGroup(device,&gd);++live;wgpuBindGroupLayoutRelease(layout);--live;
  sourceRead=readBuffer(N*2);imageRead=readBuffer(N*4);state=1;event("SLICE_R16UINT_READY");
}
void adapterReady(WGPURequestAdapterStatus status,WGPUAdapter value,WGPUStringView msg,void* token,void*){
  if(uintptr_t(token)!=generation){if(value)wgpuAdapterRelease(value);++rejected;return;}
  if(status!=WGPURequestAdapterStatus_Success||!value){failure("ADAPTER",msg);return;}
  adapter=value;++live;auto dd=WGPU_DEVICE_DESCRIPTOR_INIT;dd.uncapturedErrorCallbackInfo.callback=uncaptured;dd.deviceLostCallbackInfo.mode=WGPUCallbackMode_AllowSpontaneous;dd.deviceLostCallbackInfo.callback=lost;dd.deviceLostCallbackInfo.userdata1=token;
  auto cb=WGPU_REQUEST_DEVICE_CALLBACK_INFO_INIT;cb.mode=WGPUCallbackMode_AllowSpontaneous;cb.callback=deviceReady;cb.userdata1=token;wgpuAdapterRequestDevice(adapter,&dd,cb);
}
}
extern "C" {
EMSCRIPTEN_KEEPALIVE uintptr_t nrx_source_ptr(){return uintptr_t(Source);}
EMSCRIPTEN_KEEPALIVE int nrx_init(){
  if(live)return 0;disposing=false;state=0;frames=0;mapped=0;errors=0;++generation;
  auto id=WGPU_INSTANCE_DESCRIPTOR_INIT;instance=wgpuCreateInstance(&id);++live;
  auto canvas=WGPU_EMSCRIPTEN_SURFACE_SOURCE_CANVAS_HTML_SELECTOR_INIT;canvas.selector={"#native",WGPU_STRLEN};auto sd=WGPU_SURFACE_DESCRIPTOR_INIT;sd.nextInChain=&canvas.chain;surface=wgpuInstanceCreateSurface(instance,&sd);++live;
  auto options=WGPU_REQUEST_ADAPTER_OPTIONS_INIT;options.compatibleSurface=surface;options.powerPreference=WGPUPowerPreference_HighPerformance;
  auto cb=WGPU_REQUEST_ADAPTER_CALLBACK_INFO_INIT;cb.mode=WGPUCallbackMode_AllowSpontaneous;cb.callback=adapterReady;cb.userdata1=(void*)uintptr_t(generation);wgpuInstanceRequestAdapter(instance,&options,cb);return generation;
}
EMSCRIPTEN_KEEPALIVE int nrx_publish(uint32_t token,uint32_t bytes){
  if(token!=generation||state!=1||bytes!=N*2){++rejected;return 0;}
  auto dest=WGPU_TEXEL_COPY_TEXTURE_INFO_INIT;dest.texture=texture;dest.aspect=WGPUTextureAspect_All;auto layout=WGPU_TEXEL_COPY_BUFFER_LAYOUT_INIT;layout.bytesPerRow=W*2;layout.rowsPerImage=H;WGPUExtent3D size={W,H,1};wgpuQueueWriteTexture(queue,&dest,Source,N*2,&layout,&size);return 1;
}
EMSCRIPTEN_KEEPALIVE int nrx_start(uint32_t token){if(token!=generation||state!=1)return 0;state=2;emscripten_request_animation_frame_loop(animation,(void*)uintptr_t(generation));return 1;}
EMSCRIPTEN_KEEPALIVE int nrx_value(int which){switch(which){case 0:return state;case 1:return frames;case 2:return errors;case 3:return live;case 4:return generation;case 5:return rejected;default:return -1;}}
EMSCRIPTEN_KEEPALIVE int nrx_dispose(){
  if(state==2)return 0;disposing=true;++generation;
  // WHY: invalidate callbacks before releasing derived resources. Source bytes are untouched.
  #define DROP(x,fn) if(x){fn(x);x=nullptr;--live;}
  if(sourceRead)wgpuBufferDestroy(sourceRead);DROP(sourceRead,wgpuBufferRelease);
  if(imageRead)wgpuBufferDestroy(imageRead);DROP(imageRead,wgpuBufferRelease);
  DROP(group,wgpuBindGroupRelease);DROP(textureView,wgpuTextureViewRelease);
  if(texture)wgpuTextureDestroy(texture);DROP(texture,wgpuTextureRelease);DROP(pipeline,wgpuRenderPipelineRelease);
  if(surface)wgpuSurfaceUnconfigure(surface);DROP(queue,wgpuQueueRelease);
  if(device)wgpuDeviceDestroy(device);DROP(device,wgpuDeviceRelease);DROP(adapter,wgpuAdapterRelease);DROP(surface,wgpuSurfaceRelease);DROP(instance,wgpuInstanceRelease);
  #undef DROP
  state=4;event("DISPOSE_COMPLETE");return live==0;
}
}
int main(){event(sizeof(void*)==8?"NATIVE_WASM64_MAIN":"WRONG_POINTER_WIDTH");return 0;}
