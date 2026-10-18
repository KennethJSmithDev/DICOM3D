import {readLocalImage,localImageRgba} from './local-image.mjs';
import {capabilityTable} from './imaging-capabilities.mjs';
import {imageLesson} from './evidence-learning.mjs';
import {evidenceLearning} from './evidence-learning-ui';

// Optional local frame inspector. It never registers reference anatomy to images
// or enters the accepted H000 CT/plane/volume controller.
export function prepareLocalImageInspector(){
  const mount=document.querySelector('.imaging-body');if(!mount)return;
  const panel=document.createElement('details');panel.id='localImagePanel';
  panel.innerHTML=`<summary>Imaging formats · local bridge</summary><div class="section-body">
    <p>Import a converted local DICOM, NIfTI, NRRD or OME-TIFF frame bundle. Conversion uses local libraries; no upload. This image is not registered to reference anatomy.</p>
    <label>Converted image or recognition report <input id="localImageFile" type="file" accept=".json,.d3img"></label>
    <button id="localImageLoad">Inspect local image</button> <button id="localImageUnload">Clear image</button>
    <p id="localImageStatus" role="status">No local bridge image loaded.</p>
    <div id="localImageView" hidden><p id="localImageCaption"></p><canvas id="localImagePixels" role="img"></canvas>
    <label>Source frame <input id="localImageFrame" type="range" min="0" max="0" step="1" value="0"></label>
    <div class="controls"><button id="localImagePrevious">Previous</button><button id="localImageNext">Next</button><button id="localImageReset">Reset display</button></div>
    <label>Window center <input id="localImageCenter" type="range" step="any"></label>
    <label>Window width <input id="localImageWidth" type="range" min="1" step="any"></label>
    <p>Window, inversion and color conversion are display choices. No SUV or calibrated intensity claim. Native pixels; no inferred 3D stack or physical measurement.</p></div>
    <details><summary>Source identity & capability evidence</summary><pre id="localImageIdentity"></pre></details>
    <output id="localImageState" hidden></output></div>`;
  mount.append(panel);
  panel.querySelector('.section-body')!.append(capabilityTable());
  const get=(id:string)=>panel.querySelector('#'+id) as any;
  const learning=evidenceLearning('localImageLearning',panel.querySelector('.section-body')!);
  const canvas=get('localImagePixels') as HTMLCanvasElement,ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  let image:any=null,rgba:ImageData|null=null,generation=0,loadMs=0;
  function clear(){image=null;rgba=null;learning.clear();canvas.width=canvas.height=1;get('localImageView').hidden=true;get('localImageIdentity').textContent='';get('localImageState').textContent=JSON.stringify({loaded:false,decodedBytes:0,rgbaBytes:0});}
  function draw(){if(!image?.pixels||!rgba)return;
    const b=image.bundle,[frames,rows,cols,channels]=b.pixels.shape,k=Number(get('localImageFrame').value),center=Number(get('localImageCenter').value),width=Number(get('localImageWidth').value),start=performance.now();
    localImageRgba(image,k,center,width,rgba.data);ctx.putImageData(rgba,0,0);
    get('localImagePrevious').disabled=k===0;get('localImageNext').disabled=k===frames-1;
    const sourceLabel=b.source.provenance?.collection||b.source.provenance?.source||b.source.format;
    learning.show(imageLesson(b,k));
    get('localImageCaption').textContent=`${sourceLabel} · ${b.source.identity.Modality||b.source.format} · ${b.source.sopName} · ${b.source.format==='DICOM'?'source frame':'native plane'} ${k+1}/${frames} · ${cols}×${rows}`;
    canvas.setAttribute('aria-label',`${b.source.identity.Modality||b.source.format} source pixels, source ${b.frameIdentity.sop||b.frameIdentity.sourceId}, frame ${k+1}`);
    const drawMs=performance.now()-start;
    let canvasReadbackFnv1a:number|null=null;
    if(new URLSearchParams(location.search).has('diagnostics')){
      let hash=2166136261;for(const x of ctx.getImageData(0,0,cols,rows).data)hash=Math.imul(hash^x,16777619)>>>0;canvasReadbackFnv1a=hash;
    }
    get('localImageState').textContent=JSON.stringify({loaded:true,sourceHash:b.source.sha256,pixelHash:b.pixels.sha256,k,frame:k+1,sop:b.frameIdentity.sop,center,width,loadMs,drawMs,decodedBytes:image.pixels.byteLength,rgbaBytes:rgba.data.byteLength,displayLutBytes:image.displayLut?.values.byteLength??0,channels,canvasReadbackFnv1a});
  }
  get('localImageLoad').onclick=async()=>{
    const token=++generation;clear();get('localImageStatus').textContent='Verifying local frame bundle…';
    try{
      const file=get('localImageFile').files?.[0];if(!file||file.size>96*1024**2)throw Error('Choose a bundle no larger than 96 MiB');
      const start=performance.now(),candidate=await readLocalImage(JSON.parse(await file.text()));if(token!==generation)return;
      const b=candidate.bundle;const {pixels,...metadata}=b;
      get('localImageIdentity').textContent=JSON.stringify({...metadata,support:{...b.support,displayed:false,interactive:false,qualified:false}},null,2);
      if(!candidate.pixels){learning.show(imageLesson(b));get('localImageStatus').textContent=`Recognized only: ${b.source.sopName}. ${b.unsupportedReason||'No qualified pixel adapter.'}`;return;}
      image=candidate;const [frames,rows,cols,channels]=b.pixels.shape;
      canvas.width=cols;canvas.height=rows;rgba=ctx.createImageData(cols,rows);
      get('localImageFrame').max=frames-1;get('localImageFrame').value=0;
      const span=Math.max(1,b.display.range[1]-b.display.range[0],b.display.width);
      get('localImageCenter').min=Math.min(b.display.range[0]-span,b.display.center);get('localImageCenter').max=Math.max(b.display.range[1]+span,b.display.center);
      get('localImageWidth').max=Math.max(2*span,b.display.width);
      get('localImageCenter').value=b.display.center;get('localImageWidth').value=b.display.width;
      for(const id of ['localImageCenter','localImageWidth'])get(id).disabled=channels===3;
      loadMs=performance.now()-start;get('localImageView').hidden=false;draw();
      get('localImageIdentity').textContent=JSON.stringify({...metadata,pixels:{...pixels,base64:undefined},support:{...b.support,displayed:true,interactive:true,qualified:false}},null,2);
      get('localImageStatus').textContent=`Local ${b.source.identity.Modality||'image'} displayed · source hash verified by converter; decoded payload hash verified in browser · example qualification in campaign receipt.`;
    }catch(error){if(token===generation){clear();get('localImageStatus').textContent=`Image unavailable: ${String(error)}. Source unchanged.`;}}
  };
  for(const id of ['localImageFrame','localImageCenter','localImageWidth'])get(id).oninput=draw;
  get('localImagePrevious').onclick=()=>{get('localImageFrame').value=Math.max(0,Number(get('localImageFrame').value)-1);draw();};
  get('localImageNext').onclick=()=>{get('localImageFrame').value=Math.min(Number(get('localImageFrame').max),Number(get('localImageFrame').value)+1);draw();};
  get('localImageReset').onclick=()=>{if(image){get('localImageFrame').value=0;get('localImageCenter').value=image.bundle.display.center;get('localImageWidth').value=image.bundle.display.width;draw();}};
  get('localImageUnload').onclick=()=>{generation++;clear();get('localImageFile').value='';get('localImageStatus').textContent='Image cleared; source files unchanged.';};clear();
}
