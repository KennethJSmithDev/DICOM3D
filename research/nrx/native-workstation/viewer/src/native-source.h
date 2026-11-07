// Native scientific source resources; source admission and authority remain host-owned.
char SourceShader[65536];float SourceUniforms[96],SourceProbePoints[512];
WGPUBuffer pointBuffer=nullptr;WGPUTexture diagnosticTexture=nullptr;WGPUTextureView diagnosticView=nullptr;WGPURenderPipeline diagnosticPipeline=nullptr;
uint16_t* SourceWords=nullptr;uint8_t* SourceMask=nullptr;float* SourceVertices=nullptr;uint32_t* SourceIndices=nullptr;
uint32_t sourceW=0,sourceH=0,sourceD=0,vertexCount=0,indexCount=0;
WGPUTexture sourceTexture=nullptr,segTexture=nullptr,depthTexture=nullptr;WGPUTextureView sourceView=nullptr,segView=nullptr,depthView=nullptr;
WGPUBuffer sourceUniform=nullptr,vertexBuffer=nullptr,indexBuffer=nullptr;WGPUBindGroup sourceGroup=nullptr;
WGPURenderPipeline volumePipeline=nullptr,meshPipeline=nullptr;
WGPUBuffer probeBuffer=nullptr;int probeKind=0;uint64_t probeSize=0;uint32_t probeStride=0;
void clearSource(){
 sourceReady=false;
 #define SRC_DROP(x,fn) if(x){fn(x);x=nullptr;--live;}
 if(probeBuffer)wgpuBufferDestroy(probeBuffer);SRC_DROP(probeBuffer,wgpuBufferRelease);
 if(pointBuffer)wgpuBufferDestroy(pointBuffer);SRC_DROP(pointBuffer,wgpuBufferRelease);SRC_DROP(diagnosticPipeline,wgpuRenderPipelineRelease);SRC_DROP(diagnosticView,wgpuTextureViewRelease);if(diagnosticTexture)wgpuTextureDestroy(diagnosticTexture);SRC_DROP(diagnosticTexture,wgpuTextureRelease);
 if(sourceUniform)wgpuBufferDestroy(sourceUniform);SRC_DROP(sourceUniform,wgpuBufferRelease);
 if(vertexBuffer)wgpuBufferDestroy(vertexBuffer);SRC_DROP(vertexBuffer,wgpuBufferRelease);if(indexBuffer)wgpuBufferDestroy(indexBuffer);SRC_DROP(indexBuffer,wgpuBufferRelease);
 SRC_DROP(sourceGroup,wgpuBindGroupRelease);SRC_DROP(volumePipeline,wgpuRenderPipelineRelease);SRC_DROP(meshPipeline,wgpuRenderPipelineRelease);
 SRC_DROP(sourceView,wgpuTextureViewRelease);SRC_DROP(segView,wgpuTextureViewRelease);SRC_DROP(depthView,wgpuTextureViewRelease);
 if(sourceTexture)wgpuTextureDestroy(sourceTexture);SRC_DROP(sourceTexture,wgpuTextureRelease);if(segTexture)wgpuTextureDestroy(segTexture);SRC_DROP(segTexture,wgpuTextureRelease);if(depthTexture)wgpuTextureDestroy(depthTexture);SRC_DROP(depthTexture,wgpuTextureRelease);
 #undef SRC_DROP
 std::free(SourceWords);SourceWords=nullptr;std::free(SourceMask);SourceMask=nullptr;std::free(SourceVertices);SourceVertices=nullptr;std::free(SourceIndices);SourceIndices=nullptr;
 sourceW=sourceH=sourceD=vertexCount=indexCount=0;
}
bool resizeSourceDepth(uint32_t w,uint32_t h){
 if(depthView){wgpuTextureViewRelease(depthView);depthView=nullptr;--live;}if(depthTexture){wgpuTextureDestroy(depthTexture);wgpuTextureRelease(depthTexture);depthTexture=nullptr;--live;}
 if(!w||!h)return true;
 auto td=WGPU_TEXTURE_DESCRIPTOR_INIT;td.dimension=WGPUTextureDimension_2D;td.size={w,h,1};td.format=WGPUTextureFormat_Depth32Float;td.usage=WGPUTextureUsage_RenderAttachment;depthTexture=wgpuDeviceCreateTexture(device,&td);if(!depthTexture)return false;++live;depthView=wgpuTextureCreateView(depthTexture,nullptr);if(!depthView)return false;++live;return true;
}
bool prepareSource(uint32_t w,uint32_t h,uint32_t d,uint32_t nv,uint32_t ni){
 if(state!=1||pending||!w||!h||!d||uint64_t(w)*h*d>41943040||nv>1000000||ni>3000000)return false;
 clearSource();sourceW=w;sourceH=h;sourceD=d;vertexCount=nv;indexCount=ni;size_t n=size_t(w)*h*d;
 SourceWords=(uint16_t*)std::malloc(n*2);SourceMask=(uint8_t*)std::calloc(n,1);SourceVertices=nv?(float*)std::malloc(size_t(nv)*24):nullptr;SourceIndices=ni?(uint32_t*)std::malloc(size_t(ni)*4):nullptr;
 if(!SourceWords||!SourceMask||(nv&&!SourceVertices)||(ni&&!SourceIndices)){clearSource();return false;}return true;
}
bool publishSource(){
 if(state!=1||pending||!SourceWords)return false;
 auto td=WGPU_TEXTURE_DESCRIPTOR_INIT;td.dimension=WGPUTextureDimension_3D;td.size={sourceW,sourceH,sourceD};td.format=WGPUTextureFormat_R16Uint;td.usage=WGPUTextureUsage_CopyDst|WGPUTextureUsage_CopySrc|WGPUTextureUsage_TextureBinding;sourceTexture=wgpuDeviceCreateTexture(device,&td);if(!sourceTexture)return false;++live;sourceView=wgpuTextureCreateView(sourceTexture,nullptr);++live;
 td.format=WGPUTextureFormat_R8Uint;segTexture=wgpuDeviceCreateTexture(device,&td);++live;segView=wgpuTextureCreateView(segTexture,nullptr);++live;
 auto dst=WGPU_TEXEL_COPY_TEXTURE_INFO_INIT;dst.texture=sourceTexture;auto layout=WGPU_TEXEL_COPY_BUFFER_LAYOUT_INIT;layout.bytesPerRow=sourceW*2;layout.rowsPerImage=sourceH;WGPUExtent3D extent={sourceW,sourceH,sourceD};wgpuQueueWriteTexture(queue,&dst,SourceWords,uint64_t(sourceW)*sourceH*sourceD*2,&layout,&extent);dst.texture=segTexture;layout.bytesPerRow=sourceW;wgpuQueueWriteTexture(queue,&dst,SourceMask,uint64_t(sourceW)*sourceH*sourceD,&layout,&extent);
 auto bd=WGPU_BUFFER_DESCRIPTOR_INIT;bd.size=384;bd.usage=WGPUBufferUsage_Uniform|WGPUBufferUsage_CopyDst;sourceUniform=wgpuDeviceCreateBuffer(device,&bd);++live;bd.size=2048;bd.usage=WGPUBufferUsage_Storage|WGPUBufferUsage_CopyDst;pointBuffer=wgpuDeviceCreateBuffer(device,&bd);++live;
 if(vertexCount){bd.size=uint64_t(vertexCount)*24;bd.usage=WGPUBufferUsage_Vertex|WGPUBufferUsage_CopyDst|WGPUBufferUsage_CopySrc;vertexBuffer=wgpuDeviceCreateBuffer(device,&bd);++live;wgpuQueueWriteBuffer(queue,vertexBuffer,0,SourceVertices,bd.size);}
 if(indexCount){bd.size=uint64_t(indexCount)*4;bd.usage=WGPUBufferUsage_Index|WGPUBufferUsage_CopyDst|WGPUBufferUsage_CopySrc;indexBuffer=wgpuDeviceCreateBuffer(device,&bd);++live;wgpuQueueWriteBuffer(queue,indexBuffer,0,SourceIndices,bd.size);}
 WGPUBindGroupLayoutEntry entries[4]={WGPU_BIND_GROUP_LAYOUT_ENTRY_INIT,WGPU_BIND_GROUP_LAYOUT_ENTRY_INIT,WGPU_BIND_GROUP_LAYOUT_ENTRY_INIT,WGPU_BIND_GROUP_LAYOUT_ENTRY_INIT};
 for(int i=0;i<3;i+=2){entries[i].binding=i;entries[i].visibility=WGPUShaderStage_Fragment;entries[i].texture.sampleType=WGPUTextureSampleType_Uint;entries[i].texture.viewDimension=WGPUTextureViewDimension_3D;}
 entries[1].binding=1;entries[1].visibility=WGPUShaderStage_Vertex|WGPUShaderStage_Fragment;entries[1].buffer.type=WGPUBufferBindingType_Uniform;entries[1].buffer.minBindingSize=384;
 entries[3].binding=3;entries[3].visibility=WGPUShaderStage_Fragment;entries[3].buffer.type=WGPUBufferBindingType_ReadOnlyStorage;entries[3].buffer.minBindingSize=2048;
 auto ld=WGPU_BIND_GROUP_LAYOUT_DESCRIPTOR_INIT;ld.entryCount=4;ld.entries=entries;auto groupLayout=wgpuDeviceCreateBindGroupLayout(device,&ld);++live;auto pd=WGPU_PIPELINE_LAYOUT_DESCRIPTOR_INIT;pd.bindGroupLayoutCount=1;pd.bindGroupLayouts=&groupLayout;auto pipelineLayout=wgpuDeviceCreatePipelineLayout(device,&pd);++live;
 auto wgsl=WGPU_SHADER_SOURCE_WGSL_INIT;wgsl.code={SourceShader,WGPU_STRLEN};auto sd=WGPU_SHADER_MODULE_DESCRIPTOR_INIT;sd.nextInChain=&wgsl.chain;auto shader=wgpuDeviceCreateShaderModule(device,&sd);++live;
 auto target=WGPU_COLOR_TARGET_STATE_INIT;target.format=WGPUTextureFormat_BGRA8Unorm;target.writeMask=WGPUColorWriteMask_All;auto fs=WGPU_FRAGMENT_STATE_INIT;fs.module=shader;fs.entryPoint={"volumeFS",WGPU_STRLEN};fs.targetCount=1;fs.targets=&target;
 auto depth=WGPU_DEPTH_STENCIL_STATE_INIT;depth.format=WGPUTextureFormat_Depth32Float;depth.depthWriteEnabled=WGPUOptionalBool_False;depth.depthCompare=WGPUCompareFunction_Always;
 auto pipeline=WGPU_RENDER_PIPELINE_DESCRIPTOR_INIT;pipeline.layout=pipelineLayout;pipeline.vertex.module=shader;pipeline.vertex.entryPoint={"volumeVS",WGPU_STRLEN};pipeline.fragment=&fs;pipeline.depthStencil=&depth;pipeline.primitive.topology=WGPUPrimitiveTopology_TriangleList;volumePipeline=wgpuDeviceCreateRenderPipeline(device,&pipeline);++live;
 target.format=WGPUTextureFormat_RGBA32Float;fs.entryPoint={"diagnosticFS",WGPU_STRLEN};pipeline.depthStencil=nullptr;diagnosticPipeline=wgpuDeviceCreateRenderPipeline(device,&pipeline);++live;target.format=WGPUTextureFormat_BGRA8Unorm;pipeline.depthStencil=&depth;
 auto diagnostic=WGPU_TEXTURE_DESCRIPTOR_INIT;diagnostic.dimension=WGPUTextureDimension_2D;diagnostic.size={128,1,1};diagnostic.format=WGPUTextureFormat_RGBA32Float;diagnostic.usage=WGPUTextureUsage_RenderAttachment|WGPUTextureUsage_CopySrc;diagnosticTexture=wgpuDeviceCreateTexture(device,&diagnostic);++live;diagnosticView=wgpuTextureCreateView(diagnosticTexture,nullptr);++live;
 WGPUVertexAttribute attributes[2]={WGPU_VERTEX_ATTRIBUTE_INIT,WGPU_VERTEX_ATTRIBUTE_INIT};attributes[0].format=WGPUVertexFormat_Float32x3;attributes[0].shaderLocation=0;attributes[1].format=WGPUVertexFormat_Float32x3;attributes[1].offset=12;attributes[1].shaderLocation=1;auto vertices=WGPU_VERTEX_BUFFER_LAYOUT_INIT;vertices.arrayStride=24;vertices.stepMode=WGPUVertexStepMode_Vertex;vertices.attributeCount=2;vertices.attributes=attributes;
 pipeline.vertex.entryPoint={"meshVS",WGPU_STRLEN};pipeline.vertex.bufferCount=1;pipeline.vertex.buffers=&vertices;fs.entryPoint={"meshFS",WGPU_STRLEN};depth.depthWriteEnabled=WGPUOptionalBool_True;depth.depthCompare=WGPUCompareFunction_GreaterEqual;meshPipeline=wgpuDeviceCreateRenderPipeline(device,&pipeline);++live;
 WGPUBindGroupEntry bindings[4]={WGPU_BIND_GROUP_ENTRY_INIT,WGPU_BIND_GROUP_ENTRY_INIT,WGPU_BIND_GROUP_ENTRY_INIT,WGPU_BIND_GROUP_ENTRY_INIT};bindings[0].binding=0;bindings[0].textureView=sourceView;bindings[1].binding=1;bindings[1].buffer=sourceUniform;bindings[1].size=384;bindings[2].binding=2;bindings[2].textureView=segView;bindings[3].binding=3;bindings[3].buffer=pointBuffer;bindings[3].size=2048;auto bg=WGPU_BIND_GROUP_DESCRIPTOR_INIT;bg.layout=groupLayout;bg.entryCount=4;bg.entries=bindings;sourceGroup=wgpuDeviceCreateBindGroup(device,&bg);++live;
 wgpuBindGroupLayoutRelease(groupLayout);--live;wgpuPipelineLayoutRelease(pipelineLayout);--live;wgpuShaderModuleRelease(shader);--live;
 sourceReady=resizeSourceDepth(width,height);return sourceReady;
}
void recordSource(WGPURenderPassEncoder pass){wgpuQueueWriteBuffer(queue,sourceUniform,0,SourceUniforms,384);wgpuRenderPassEncoderSetBindGroup(pass,0,sourceGroup,0,nullptr);wgpuRenderPassEncoderSetPipeline(pass,volumePipeline);wgpuRenderPassEncoderDraw(pass,3,1,0,0);if(indexCount){wgpuRenderPassEncoderSetPipeline(pass,meshPipeline);wgpuRenderPassEncoderSetVertexBuffer(pass,0,vertexBuffer,0,uint64_t(vertexCount)*24);wgpuRenderPassEncoderSetIndexBuffer(pass,indexBuffer,WGPUIndexFormat_Uint32,0,uint64_t(indexCount)*4);wgpuRenderPassEncoderDrawIndexed(pass,indexCount,1,0,0,0);}}
void probeReady(WGPUMapAsyncStatus status,WGPUStringView message,void* token,void*){
 --pending;if(status!=WGPUMapAsyncStatus_Success){if(!closing)fail("SOURCE_READBACK",message);return;}
 if(uintptr_t(token)==generation&&!closing){auto data=wgpuBufferGetConstMappedRange(probeBuffer,0,probeSize);EM_ASM({const p=Number($0);const n=Number($1);if(!Number.isSafeInteger(p)||p+n>HEAPU8.length)throw Error('Native readback span');const result={};result.kind=$2;result.stride=$3;result.bytes=HEAPU8.slice(p,p+n);Module.nrxReadback=result;},data,probeSize,probeKind,probeStride);}
 wgpuBufferUnmap(probeBuffer);
}
void recordDiagnostic(WGPUCommandEncoder encoder){auto color=WGPU_RENDER_PASS_COLOR_ATTACHMENT_INIT;color.view=diagnosticView;color.loadOp=WGPULoadOp_Clear;color.storeOp=WGPUStoreOp_Store;auto desc=WGPU_RENDER_PASS_DESCRIPTOR_INIT;desc.colorAttachmentCount=1;desc.colorAttachments=&color;auto pass=wgpuCommandEncoderBeginRenderPass(encoder,&desc);wgpuRenderPassEncoderSetPipeline(pass,diagnosticPipeline);wgpuRenderPassEncoderSetBindGroup(pass,0,sourceGroup,0,nullptr);wgpuRenderPassEncoderDraw(pass,3,1,0,0);wgpuRenderPassEncoderEnd(pass);wgpuRenderPassEncoderRelease(pass);}
void recordProbe(WGPUCommandEncoder encoder,WGPUTexture surfaceTexture){
 const int kind=probeKind;
 if(kind==4||kind==5){probeStride=0;probeSize=kind==4?uint64_t(vertexCount)*24:uint64_t(indexCount)*4;if(probeBuffer){wgpuBufferDestroy(probeBuffer);wgpuBufferRelease(probeBuffer);--live;}auto bd=WGPU_BUFFER_DESCRIPTOR_INIT;bd.size=probeSize;bd.usage=WGPUBufferUsage_CopyDst|WGPUBufferUsage_MapRead;probeBuffer=wgpuDeviceCreateBuffer(device,&bd);++live;wgpuCommandEncoderCopyBufferToBuffer(encoder,kind==4?vertexBuffer:indexBuffer,0,probeBuffer,0,probeSize);return;}
 const bool src=kind==1||kind==2;const bool diagnostic=kind==6;uint32_t row=diagnostic?128*16:src?sourceW*(kind==1?2:1):width*4,rows=diagnostic?1:src?sourceH:height,layers=src?sourceD:1;probeStride=(row+255)&~255u;probeSize=uint64_t(probeStride)*rows*layers;
 if(probeBuffer){wgpuBufferDestroy(probeBuffer);wgpuBufferRelease(probeBuffer);probeBuffer=nullptr;--live;}auto bd=WGPU_BUFFER_DESCRIPTOR_INIT;bd.size=probeSize;bd.usage=WGPUBufferUsage_CopyDst|WGPUBufferUsage_MapRead;probeBuffer=wgpuDeviceCreateBuffer(device,&bd);++live;
 auto from=WGPU_TEXEL_COPY_TEXTURE_INFO_INIT;from.texture=kind==1?sourceTexture:kind==2?segTexture:kind==6?diagnosticTexture:surfaceTexture;auto to=WGPU_TEXEL_COPY_BUFFER_INFO_INIT;to.buffer=probeBuffer;to.layout.bytesPerRow=probeStride;to.layout.rowsPerImage=rows;WGPUExtent3D extent={diagnostic?128:src?sourceW:width,rows,layers};wgpuCommandEncoderCopyTextureToBuffer(encoder,&from,&to,&extent);
}
