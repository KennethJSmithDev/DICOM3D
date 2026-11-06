import {packStored} from './ct-volume-core.mjs';
// Blue is unused in accepted RG uint16 packing. Membership stays a nearest sample.
export function packMaskedStored(source,mask){
 if(mask.length!==source.length)throw Error('Mask/CT dimensions differ');
 const packed=packStored(source);
 for(let i=0;i<mask.length;i++)packed[i*4+2]=mask[i]?255:0;
 return packed;
}
