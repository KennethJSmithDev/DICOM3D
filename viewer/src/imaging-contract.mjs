// Versioned admission contracts. Categories do not imply implemented handlers.
export const IMAGING_API_VERSION=1;
export const REPRESENTATIONS=Object.freeze(['acquired-2d','spatial-volume','segmentation','structured-evidence']);
export class ImagingRejection extends Error {
  constructor(code,{moduleId=null,reasons=[]}={}){super(`Imaging admission: ${code}`);this.name='ImagingRejection';this.code=code;this.moduleId=moduleId;this.reasons=Object.freeze([...reasons]);}
  toJSON(){return {apiVersion:IMAGING_API_VERSION,code:this.code,moduleId:this.moduleId,reasons:this.reasons};}
}
export const reject=(code,options)=>{throw new ImagingRejection(code,options);};
export function requireImaging(ok,code,options){if(!ok)reject(code,options);}
export function freezeMetadata(value){if(value&&typeof value==='object'){Object.values(value).forEach(freezeMetadata);Object.freeze(value);}return value;}
