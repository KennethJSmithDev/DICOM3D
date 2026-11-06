import {digest} from './ct-frame.mjs';
const types={'|u1':Uint8Array,'|i1':Int8Array,'<u2':Uint16Array,'<i2':Int16Array,'<u4':Uint32Array,'<i4':Int32Array};
const need=(ok,message)=>{if(!ok)throw Error(message);};
export async function readLocalImage(bundle){
  need(bundle?.schema==='DICOM3D-local-image-1','Expected local bridge schema v1');
  need(['DICOM','OME-TIFF','NIfTI','NRRD'].includes(bundle.source?.format)&&/^[a-f0-9]{64}$/.test(bundle.source.sha256),'Missing source identity');
  if(!bundle.support?.decoded||!bundle.pixels)return {bundle,pixels:null};
  const p=bundle.pixels,shape=p.shape;
  need(Array.isArray(shape)&&shape.length===4,'Invalid pixel shape');
  const [frames,rows,cols,channels]=shape;
  need(shape.every(Number.isInteger)&&frames>=1&&frames<=256&&rows>=1&&cols>=1&&rows<=4096&&cols<=4096&&[1,3].includes(channels),'Image dimensions exceed bound');
  const Type=types[p.dtype];need(Type,'Unsupported decoded integer type');
  const count=frames*rows*cols*channels,bytes=count*Type.BYTES_PER_ELEMENT;
  need(bytes<=64*1024**2&&typeof p.base64==='string'&&p.base64.length===4*Math.ceil(bytes/3),'Pixel byte bound mismatch');
  need(['MONOCHROME1','MONOCHROME2','RGB'].includes(p.photometric),'Unsupported photometric');
  need((p.photometric==='RGB')===(channels===3)&&(!(channels===3)||Type===Uint8Array),'Unsupported color channels');
  need(new Uint8Array(new Uint16Array([1]).buffer)[0]===1,'Little-endian browser required');
  const d=bundle.display;
  need(d&&Array.isArray(d.range)&&d.range.length===2&&
    [d.slope,d.intercept,d.center,d.width,...d.range].every(Number.isFinite)&&
    d.width>=1&&d.range[0]<=d.range[1]&&typeof d.invert==='boolean','Invalid display metadata');
  need(['LINEAR','LINEAR_EXACT','SIGMOID'].includes(d.function),'Unsupported VOI function');
  // Fill the exact byte buffer directly: string iteration materializes large
  // temporary arrays in some runtimes. The final integer view shares this buffer.
  const binary=atob(p.base64),raw=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)raw[i]=binary.charCodeAt(i);
  need(raw.byteLength===bytes&&await digest(raw)===p.sha256,'Decoded pixel SHA-256 mismatch');
  need(bundle.frameIdentity?.frameNumbers?.length===frames&&bundle.frameIdentity.frameNumbers.every((v,i)=>v===i+1),'Source frame identity mismatch');
  if(bundle.source.format==='DICOM')need(bundle.frameIdentity.sop&&bundle.frameIdentity.sop===bundle.source.identity?.SOPInstanceUID,'Source frame identity mismatch');
  else need(bundle.frameIdentity.sourceId===bundle.source.sha256,'Source frame identity mismatch');
  // Retain typed intensities and metadata, release the base64 transport string.
  return {bundle:{...bundle,pixels:{...p,base64:undefined}},pixels:new Type(raw.buffer)};
}
// PS3.3 C.11.2: windowing is a presentation transform after recorded rescale.
export function windowGray(value,center,width,fn='LINEAR',invert=false){
  need([value,center,width].every(Number.isFinite)&&width>=1,'Invalid window');
  let y;
  if(fn==='LINEAR') y=value<=center-.5-(width-1)/2?0:value>center-.5+(width-1)/2?1:(value-(center-.5))/(width-1)+.5;
  else if(fn==='LINEAR_EXACT')y=(value-center)/width+.5;
  else if(fn==='SIGMOID')y=1/(1+Math.exp(-4*(value-center)/width));
  else throw Error('Unsupported VOI function');
  y=Math.max(0,Math.min(1,y));return Math.round((invert?1-y:y)*255);
}
export function localImageRgba(image,k,center,width,out){
  const {bundle:b,pixels}=image,[frames,rows,cols,channels]=b.pixels.shape;
  need(Number.isInteger(k)&&k>=0&&k<frames,'Frame outside source');
  need(out.length===rows*cols*4,'RGBA size mismatch');
  need([center,width].every(Number.isFinite)&&width>=1,'Invalid window');
  // Integer display lookup: avoid millions of identical window evaluations on
  // full-resolution radiographs. This cache is derived and discarded on unload.
  let lut=null;
  if(channels===1&&pixels.BYTES_PER_ELEMENT<=2){
    const size=2**(8*pixels.BYTES_PER_ELEMENT),offset=pixels instanceof Int8Array||pixels instanceof Int16Array?size/2:0;
    const key=[center,width,b.display.slope,b.display.intercept,b.display.function,b.display.invert].join('/');
    if(image.displayLut?.key!==key){
      const values=new Uint8Array(size);
      for(let i=0;i<size;i++)values[i]=windowGray((i-offset)*b.display.slope+b.display.intercept,center,width,b.display.function,b.display.invert);
      image.displayLut={key,offset,values};
    }
    lut=image.displayLut;
  }
  for(let i=0,start=k*rows*cols*channels;i<rows*cols;i++){
    const o=i*4,s=start+i*channels;
    if(channels===3){out[o]=pixels[s];out[o+1]=pixels[s+1];out[o+2]=pixels[s+2];}
    else out[o]=out[o+1]=out[o+2]=lut?lut.values[pixels[s]+lut.offset]:windowGray(pixels[s]*b.display.slope+b.display.intercept,center,width,b.display.function,b.display.invert);
    out[o+3]=255;
  }
  return out;
}
