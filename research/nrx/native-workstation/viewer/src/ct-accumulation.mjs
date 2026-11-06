// Presentation-only prefix of complete acquired slice cells, in recorded increasing k.
export function accumulation(progress,range,enabled=true){
 const [start,end]=range;if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||!Number.isFinite(progress))throw Error('Invalid accumulation request');
 const p=Math.max(0,Math.min(1,progress)),total=end-start+1,count=p===0?0:Math.min(total,Math.ceil(p*total));
 return Object.freeze({enabled,progress:p,range:[start,end],count,total,empty:count===0,lower:start-.5,upper:start+count-.5,planeK:count?start+count-1:start,completion:'selected source range'});
}
export const accumulationVector=a=>new Float32Array([Number(a.enabled),a.lower,a.upper,Number(!a.empty)]);
export const accumulationWGSL=`fn accumulatedK(k:f32,a:vec4<f32>)->bool{return a.x<.5||(a.w>.5&&k>=a.y&&k<=a.z);}`;
