#include <webgpu/webgpu.h>
#include <emscripten.h>
#include <cstdint>
#include <cstdio>

// Derived from DICOM3D NRX-C001 Task 3/6 volume.cpp. Each module owns one viewport.
namespace {
constexpr uint32_t Width=512, Height=512, Depth=103, Pixels=Width*Height*Depth;
uint16_t source[Pixels];
uint8_t mask[Pixels];
char shaderSource[16384], errorText[512];
float uniforms[64];
WGPUInstance instance;
WGPUAdapter adapter;
WGPUDevice device;
WGPUQueue queue;
WGPUSurface surface;
WGPURenderPipeline pipeline;
WGPUTexture volume, segmentation;
WGPUBindGroup group;
WGPUBuffer uniformBuffer;
uint32_t generation, width, height, submissions;
int state;
bool configured, uploaded;

void fail(const char* stage, WGPUStringView message={nullptr,0}) {
  if (state < 0) return;
  const int length=message.data ? int(message.length < 400 ? message.length : 400) : 0;
  std::snprintf(errorText,sizeof(errorText),"%s: %.*s",stage,length,message.data ? message.data : "");
  state=-1;
  EM_ASM({ Module['onNrxFailure']?.(UTF8ToString(Number($0))); },errorText);
}

uintptr_t tokenValue(void* token) { return reinterpret_cast<uintptr_t>(token); }
void* activeToken() { return reinterpret_cast<void*>(uintptr_t(generation)); }

void uncaptured(WGPUDevice const*, WGPUErrorType, WGPUStringView msg, void* token, void*) {
  if (tokenValue(token)==generation) fail("Native GPU validation",msg);
}

void lost(WGPUDevice const*, WGPUDeviceLostReason reason, WGPUStringView msg, void* token, void*) {
  if (tokenValue(token)==generation && reason!=WGPUDeviceLostReason_Destroyed) fail("Native device lost",msg);
}

WGPUTexture makeVolume(WGPUTextureFormat format) {
  auto descriptor=WGPU_TEXTURE_DESCRIPTOR_INIT;
  descriptor.dimension=WGPUTextureDimension_3D;
  descriptor.size={Width,Height,Depth};
  descriptor.format=format;
  descriptor.usage=WGPUTextureUsage_TextureBinding|WGPUTextureUsage_CopyDst;
  return wgpuDeviceCreateTexture(device,&descriptor);
}

void deviceReady(WGPURequestDeviceStatus status, WGPUDevice value, WGPUStringView msg, void* token, void*) {
  if (tokenValue(token)!=generation) {
    if (value) { wgpuDeviceDestroy(value); wgpuDeviceRelease(value); }
    return;
  }
  if (status!=WGPURequestDeviceStatus_Success || !value) { fail("Native device initialization",msg); return; }
  device=value;
  queue=wgpuDeviceGetQueue(device);
  auto capabilities=WGPU_SURFACE_CAPABILITIES_INIT;
  if (wgpuSurfaceGetCapabilities(surface,adapter,&capabilities)!=WGPUStatus_Success) {
    fail("Native canvas capabilities");
    return;
  }
  bool supported=false;
  for (size_t i=0;i<capabilities.formatCount;i++) supported|=capabilities.formats[i]==WGPUTextureFormat_BGRA8Unorm;
  wgpuSurfaceCapabilitiesFreeMembers(capabilities);
  if (!supported) { fail("Native BGRA8 canvas unavailable"); return; }
  volume=makeVolume(WGPUTextureFormat_R16Uint);
  segmentation=makeVolume(WGPUTextureFormat_R8Uint);
  auto uniformDescriptor=WGPU_BUFFER_DESCRIPTOR_INIT;
  uniformDescriptor.size=sizeof(uniforms);
  uniformDescriptor.usage=WGPUBufferUsage_Uniform|WGPUBufferUsage_CopyDst;
  uniformBuffer=wgpuDeviceCreateBuffer(device,&uniformDescriptor);

  WGPUBindGroupLayoutEntry bindings[3]={WGPU_BIND_GROUP_LAYOUT_ENTRY_INIT,WGPU_BIND_GROUP_LAYOUT_ENTRY_INIT,WGPU_BIND_GROUP_LAYOUT_ENTRY_INIT};
  bindings[0].binding=0;
  bindings[0].visibility=WGPUShaderStage_Fragment;
  bindings[0].texture.sampleType=WGPUTextureSampleType_Uint;
  bindings[0].texture.viewDimension=WGPUTextureViewDimension_3D;
  bindings[1].binding=1;
  bindings[1].visibility=WGPUShaderStage_Fragment;
  bindings[1].buffer.type=WGPUBufferBindingType_Uniform;
  bindings[1].buffer.minBindingSize=sizeof(uniforms);
  bindings[2]=bindings[0];
  bindings[2].binding=2;
  auto layoutDescriptor=WGPU_BIND_GROUP_LAYOUT_DESCRIPTOR_INIT;
  layoutDescriptor.entryCount=3;
  layoutDescriptor.entries=bindings;
  auto layout=wgpuDeviceCreateBindGroupLayout(device,&layoutDescriptor);
  auto pipelineLayoutDescriptor=WGPU_PIPELINE_LAYOUT_DESCRIPTOR_INIT;
  pipelineLayoutDescriptor.bindGroupLayoutCount=1;
  pipelineLayoutDescriptor.bindGroupLayouts=&layout;
  auto pipelineLayout=wgpuDeviceCreatePipelineLayout(device,&pipelineLayoutDescriptor);
  auto shaderCode=WGPU_SHADER_SOURCE_WGSL_INIT;
  shaderCode.code={shaderSource,WGPU_STRLEN};
  auto shaderDescriptor=WGPU_SHADER_MODULE_DESCRIPTOR_INIT;
  shaderDescriptor.nextInChain=&shaderCode.chain;
  auto shader=wgpuDeviceCreateShaderModule(device,&shaderDescriptor);
  auto colorTarget=WGPU_COLOR_TARGET_STATE_INIT;
  colorTarget.format=WGPUTextureFormat_BGRA8Unorm;
  colorTarget.writeMask=WGPUColorWriteMask_All;
  auto fragment=WGPU_FRAGMENT_STATE_INIT;
  fragment.module=shader;
  fragment.entryPoint={"fs",WGPU_STRLEN};
  fragment.targetCount=1;
  fragment.targets=&colorTarget;
  auto pipelineDescriptor=WGPU_RENDER_PIPELINE_DESCRIPTOR_INIT;
  pipelineDescriptor.layout=pipelineLayout;
  pipelineDescriptor.fragment=&fragment;
  pipelineDescriptor.vertex.module=shader;
  pipelineDescriptor.vertex.entryPoint={"vs",WGPU_STRLEN};
  pipelineDescriptor.primitive.topology=WGPUPrimitiveTopology_TriangleList;
  pipeline=wgpuDeviceCreateRenderPipeline(device,&pipelineDescriptor);
  wgpuShaderModuleRelease(shader);
  wgpuPipelineLayoutRelease(pipelineLayout);

  auto volumeView=wgpuTextureCreateView(volume,nullptr);
  auto maskView=wgpuTextureCreateView(segmentation,nullptr);
  WGPUBindGroupEntry entries[3]={WGPU_BIND_GROUP_ENTRY_INIT,WGPU_BIND_GROUP_ENTRY_INIT,WGPU_BIND_GROUP_ENTRY_INIT};
  entries[0].binding=0; entries[0].textureView=volumeView;
  entries[1].binding=1; entries[1].buffer=uniformBuffer; entries[1].size=sizeof(uniforms);
  entries[2].binding=2; entries[2].textureView=maskView;
  auto groupDescriptor=WGPU_BIND_GROUP_DESCRIPTOR_INIT;
  groupDescriptor.layout=layout;
  groupDescriptor.entryCount=3;
  groupDescriptor.entries=entries;
  group=wgpuDeviceCreateBindGroup(device,&groupDescriptor);
  wgpuTextureViewRelease(volumeView);
  wgpuTextureViewRelease(maskView);
  wgpuBindGroupLayoutRelease(layout);
  if (state==0) state=1;
}

void adapterReady(WGPURequestAdapterStatus status, WGPUAdapter value, WGPUStringView msg, void* token, void*) {
  if (tokenValue(token)!=generation) {
    if(value) wgpuAdapterRelease(value);
    return;
  }
  if (status!=WGPURequestAdapterStatus_Success || !value) { fail("Native WebGPU adapter unavailable",msg); return; }
  adapter=value;
  auto descriptor=WGPU_DEVICE_DESCRIPTOR_INIT;
  descriptor.uncapturedErrorCallbackInfo.callback=uncaptured;
  descriptor.uncapturedErrorCallbackInfo.userdata1=token;
  descriptor.deviceLostCallbackInfo.mode=WGPUCallbackMode_AllowSpontaneous;
  descriptor.deviceLostCallbackInfo.callback=lost;
  descriptor.deviceLostCallbackInfo.userdata1=token;
  auto callback=WGPU_REQUEST_DEVICE_CALLBACK_INFO_INIT;
  callback.mode=WGPUCallbackMode_AllowSpontaneous;
  callback.callback=deviceReady;
  callback.userdata1=token;
  wgpuAdapterRequestDevice(adapter,&descriptor,callback);
}

void upload(WGPUTexture texture, const void* pixels, uint32_t bytesPerRow) {
  auto destination=WGPU_TEXEL_COPY_TEXTURE_INFO_INIT;
  destination.texture=texture;
  auto layout=WGPU_TEXEL_COPY_BUFFER_LAYOUT_INIT;
  layout.bytesPerRow=bytesPerRow;
  layout.rowsPerImage=Height;
  const WGPUExtent3D size={Width,Height,Depth};
  wgpuQueueWriteTexture(queue,&destination,pixels,size_t(bytesPerRow)*Height*Depth,&layout,&size);
}

void configure(uint32_t w, uint32_t h) {
  auto config=WGPU_SURFACE_CONFIGURATION_INIT;
  config.device=device;
  config.format=WGPUTextureFormat_BGRA8Unorm;
  config.usage=WGPUTextureUsage_RenderAttachment;
  config.width=w;
  config.height=h;
  config.presentMode=WGPUPresentMode_Fifo;
  config.alphaMode=WGPUCompositeAlphaMode_Opaque;
  wgpuSurfaceConfigure(surface,&config);
  configured=true;
  width=w;
  height=h;
}
}

extern "C" {
EMSCRIPTEN_KEEPALIVE uintptr_t nrx_source_ptr() { return uintptr_t(source); }
EMSCRIPTEN_KEEPALIVE uintptr_t nrx_mask_ptr() { return uintptr_t(mask); }
EMSCRIPTEN_KEEPALIVE uintptr_t nrx_shader_ptr() { return uintptr_t(shaderSource); }
EMSCRIPTEN_KEEPALIVE uintptr_t nrx_uniform_ptr() { return uintptr_t(uniforms); }
EMSCRIPTEN_KEEPALIVE uintptr_t nrx_error_ptr() { return uintptr_t(errorText); }
EMSCRIPTEN_KEEPALIVE int nrx_state() { return state; }
EMSCRIPTEN_KEEPALIVE uint32_t nrx_submissions() { return submissions; }

EMSCRIPTEN_KEEPALIVE void nrx_init() {
  if (instance || state!=0) return;
  ++generation;
  auto info=WGPU_INSTANCE_DESCRIPTOR_INIT;
  instance=wgpuCreateInstance(&info);
  auto canvas=WGPU_EMSCRIPTEN_SURFACE_SOURCE_CANVAS_HTML_SELECTOR_INIT;
  canvas.selector={"#nrx-h000-canvas",WGPU_STRLEN};
  auto descriptor=WGPU_SURFACE_DESCRIPTOR_INIT;
  descriptor.nextInChain=&canvas.chain;
  surface=wgpuInstanceCreateSurface(instance,&descriptor);
  if (!surface) { fail("Native canvas surface unavailable"); return; }
  auto options=WGPU_REQUEST_ADAPTER_OPTIONS_INIT;
  options.compatibleSurface=surface;
  auto callback=WGPU_REQUEST_ADAPTER_CALLBACK_INFO_INIT;
  callback.mode=WGPUCallbackMode_AllowSpontaneous;
  callback.callback=adapterReady;
  callback.userdata1=activeToken();
  wgpuInstanceRequestAdapter(instance,&options,callback);
}

EMSCRIPTEN_KEEPALIVE int nrx_publish(uint32_t sourceBytes, uint32_t maskBytes) {
  if (state!=1 || uploaded || sourceBytes!=sizeof(source) || maskBytes!=sizeof(mask)) return 0;
  upload(volume,source,Width*2);
  upload(segmentation,mask,Width);
  uploaded=true;
  return 1;
}

EMSCRIPTEN_KEEPALIVE int nrx_draw(uint32_t w,uint32_t h) {
  if (state!=1 || !uploaded || w<1 || h<1 || w>4096 || h>4096) return 0;
  if (!configured || width!=w || height!=h) configure(w,h);
  auto texture=WGPU_SURFACE_TEXTURE_INIT;
  wgpuSurfaceGetCurrentTexture(surface,&texture);
  if (!texture.texture || (texture.status!=WGPUSurfaceGetCurrentTextureStatus_SuccessOptimal
      && texture.status!=WGPUSurfaceGetCurrentTextureStatus_SuccessSuboptimal)) {
    if (texture.texture) wgpuTextureRelease(texture.texture);
    fail("Native canvas acquisition");
    return 0;
  }
  auto view=wgpuTextureCreateView(texture.texture,nullptr);
  auto encoderDescriptor=WGPU_COMMAND_ENCODER_DESCRIPTOR_INIT;
  auto encoder=wgpuDeviceCreateCommandEncoder(device,&encoderDescriptor);
  auto color=WGPU_RENDER_PASS_COLOR_ATTACHMENT_INIT;
  color.view=view;
  color.loadOp=WGPULoadOp_Clear;
  color.storeOp=WGPUStoreOp_Store;
  color.clearValue={0,0,0,1};
  auto descriptor=WGPU_RENDER_PASS_DESCRIPTOR_INIT;
  descriptor.colorAttachmentCount=1;
  descriptor.colorAttachments=&color;
  auto pass=wgpuCommandEncoderBeginRenderPass(encoder,&descriptor);
  wgpuRenderPassEncoderSetPipeline(pass,pipeline);
  wgpuRenderPassEncoderSetBindGroup(pass,0,group,0,nullptr);
  wgpuRenderPassEncoderDraw(pass,3,1,0,0);
  wgpuRenderPassEncoderEnd(pass);
  auto commandsDescriptor=WGPU_COMMAND_BUFFER_DESCRIPTOR_INIT;
  auto commands=wgpuCommandEncoderFinish(encoder,&commandsDescriptor);
  wgpuQueueWriteBuffer(queue,uniformBuffer,0,uniforms,sizeof(uniforms));
  wgpuQueueSubmit(queue,1,&commands);
  wgpuCommandBufferRelease(commands);
  wgpuRenderPassEncoderRelease(pass);
  wgpuCommandEncoderRelease(encoder);
  wgpuTextureViewRelease(view);
  wgpuTextureRelease(texture.texture);
  ++submissions;
  return 1;
}

EMSCRIPTEN_KEEPALIVE void nrx_dispose() {
  if (state==2) return;
  ++generation;
  state=2;
  if (configured) wgpuSurfaceUnconfigure(surface);
  if (group) wgpuBindGroupRelease(group);
  if (uniformBuffer) { wgpuBufferDestroy(uniformBuffer); wgpuBufferRelease(uniformBuffer); }
  if (volume) { wgpuTextureDestroy(volume); wgpuTextureRelease(volume); }
  if (segmentation) { wgpuTextureDestroy(segmentation); wgpuTextureRelease(segmentation); }
  if (pipeline) wgpuRenderPipelineRelease(pipeline);
  if (queue) wgpuQueueRelease(queue);
  if (device) { wgpuDeviceDestroy(device); wgpuDeviceRelease(device); }
  if (adapter) wgpuAdapterRelease(adapter);
  if (surface) wgpuSurfaceRelease(surface);
  if (instance) wgpuInstanceRelease(instance);
}
}
