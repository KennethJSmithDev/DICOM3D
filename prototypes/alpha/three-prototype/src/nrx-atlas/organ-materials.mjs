const side=64;
const levels=1+Math.log2(side);
const texelBytes=4;

// Each recipe modulates the existing atlas color. Roughness and texture scale
// are presentation settings. The patterns are illustrative, not tissue images.
const recipe=(perMeter,tint,contrast,roughness,roughnessRange,pattern)=>
 ({perMeter,tint,contrast,roughness,roughnessRange,pattern});
const wave=(u,v)=>Math.sin(u+v+.9*Math.sin(u-2*v));
const mottling=(u,v)=>Math.sin(4*u-3*v)*Math.cos(5*v+2*u);
const grain=(u,v)=>Math.sin(17*u+11*v)*Math.sin(9*u-16*v);
const recipes=[
 recipe(14,[1,.98,.98],.14,.68,.1,(u,v)=>.7*mottling(u,v)+.3*grain(u,v)), // Lung
 recipe(13,[1,.96,.94],.22,.55,.13,(u,v)=>.6*mottling(u,v)+.4*wave(2*u,v)), // Liver
 recipe(24,[1,.94,.94],.22,.68,.12,(u,v)=>.7*wave(3*u,2*v)+.3*grain(u,v)), // Uterus
 recipe(20,[1,.95,.94],.12,.58,.065,(u,v)=>.7*Math.sin(9*u+2*v+1.5*Math.sin(2*u-v))+.3*mottling(u,v)), // Myocardium
 recipe(19,[1,.95,.93],.10,.50,.06,(u,v)=>.65*mottling(u,v)+.35*mottling(v+1,2*u)), // Kidney
 recipe(15,[1.01,1,.98],.09,.54,.06,(u,v)=>.7*wave(2*u,3*v)+.3*mottling(u,v)), // Nervous tissue
 recipe(17,[1.01,.97,.97],.17,.50,.11,(u,v)=>.8*wave(2*u,5*v)+.2*grain(u,v)), // Stomach and esophagus
 recipe(21,[1,.98,.96],.14,.46,.09,(u,v)=>.7*wave(u,7*v)+.3*mottling(u,v)), // Intestine
 recipe(24,[1.01,.99,.95],.21,.63,.12,(u,v)=>.7*mottling(2*u,2*v)+.3*grain(u,v)), // Glandular
 recipe(21,[.98,.94,1],.17,.56,.1,(u,v)=>.5*mottling(u,v)+.5*grain(u,v)), // Spleen and other lymphoid organs
 recipe(20,[1.01,.98,.97],.11,.48,.07,(u,v)=>.7*wave(3*u,2*v)+.3*mottling(u,v)), // Urinary wall
 recipe(26,[1.02,.98,.96],.15,.53,.1,(u,v)=>.5*mottling(2*u,v)+.5*wave(u,4*v)), // Reproductive tissue
 recipe(30,[1,1,1],.035,.23,.035,(u,v)=>.7*wave(u,2*v)+.3*grain(u,v)), // Eye
 recipe(25,[1.01,.98,.97],.13,.53,.09,(u,v)=>.8*wave(2*u,6*v)+.2*grain(u,v)), // Upper airway
 recipe(20,[.95,1.01,.95],.105,.42,.08,(u,v)=>.6*wave(2*u,4*v)+.4*mottling(u,v)), // Gallbladder
 recipe(34,[1,.99,.98],.07,.58,.08,(u,v)=>.5*mottling(u,v)+.5*grain(u,v)), // Skin
 recipe(26,[1.02,1,.97],.15,.61,.1,(u,v)=>.75*mottling(2*u,3*v)+.25*wave(4*u,v)), // Mammary tissue
 recipe(31,[1,.994,.976],.09,.67,.095,(u,v)=>.42*mottling(u,v)+.58*grain(u,v)), // Bone
 recipe(24,[1,.96,.94],.135,.53,.09,(u,v)=>.72*Math.sin(12*u+v+1.6*Math.sin(2*v-u))+.28*mottling(u,v)), // Skeletal muscle
 recipe(34,[1,.975,.965],.065,.45,.06,(u,v)=>.65*wave(u,6*v)+.35*mottling(u,v)), // Artery
 recipe(30,[.98,.988,1],.06,.41,.065,(u,v)=>.7*wave(2*u,3*v)+.3*mottling(u,v)), // Vein
];

export function tissueScale(id){
 return recipes[id-1]?.perMeter??0;
}

// RGB encodes a linear multiplier up to 1.33, and A stores roughness.
// Keep each mip contiguous so every material layer can upload in one call.
let mipChain;
function bakeMips(){
 const layerBytes=side*side*texelBytes;
 const base=new Uint8Array(layerBytes*recipes.length);
 const encode=value=>Math.round(Math.min(1,Math.max(0,value))*255);
 for(const [layer,{tint,contrast,roughness,roughnessRange,pattern}] of recipes.entries()){
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){
   const signal=pattern(x*2*Math.PI/side,y*2*Math.PI/side);
   const offset=layer*layerBytes+(y*side+x)*texelBytes;
   for(let channel=0;channel<3;channel++){
    base[offset+channel]=encode(tint[channel]*(1+contrast*signal)/1.33);
   }
   base[offset+3]=encode(roughness-roughnessRange*signal);
  }
 }
 const chain=[base];
 for(let size=side;size>1;size/=2){
  const larger=chain.at(-1);
  const half=size/2,rowBytes=size*texelBytes;
  const nextLayerBytes=half*half*texelBytes;
  const smaller=new Uint8Array(nextLayerBytes*recipes.length);
  for(let layer=0;layer<recipes.length;layer++){
   const sourceStart=layer*size*rowBytes,destinationStart=layer*nextLayerBytes;
   for(let y=0;y<half;y++)for(let x=0;x<half;x++)for(let channel=0;channel<texelBytes;channel++){
    const i=sourceStart+2*y*rowBytes+2*x*texelBytes+channel;
    const j=destinationStart+(y*half+x)*texelBytes+channel;
    smaller[j]=Math.round((larger[i]+larger[i+texelBytes]+larger[i+rowBytes]+larger[i+rowBytes+texelBytes])/4);
   }
  }
  chain.push(smaller);
 }
 return chain;
}

export const tissueTextureBytes=texelBytes*recipes.length*(4**levels-1)/3;

export function uploadTissueMap(device){
 const layers=recipes.length;
 const texture=device.createTexture({label:'NRX atlas materials',size:[side,side,layers],mipLevelCount:levels,format:'rgba8unorm',
  usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 try{
  mipChain??=bakeMips();
  for(const [level,pixels] of mipChain.entries()){
   const size=side>>level;
   device.queue.writeTexture({texture,mipLevel:level},pixels,{bytesPerRow:texelBytes*size,rowsPerImage:size},[size,size,layers]);
  }
  return texture;
 }catch(error){
  texture.destroy();
  throw error;
 }
}
