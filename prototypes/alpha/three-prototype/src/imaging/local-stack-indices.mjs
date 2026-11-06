// Deterministic source frame selection for a bounded illustrative plane stack.
// This is not a resampling or a volume renderer. Every index names an acquired frame.
export function sampledFrameIndices(frameCount, requested=16){
 if(!Number.isSafeInteger(frameCount)||frameCount<1||!Number.isSafeInteger(requested)||requested<1||requested>24)throw new Error('Invalid source frame sampling request');
 const count=Math.min(frameCount,requested);if(count===1)return [Math.floor((frameCount-1)/2)];
 return Array.from({length:count},(_,i)=>Math.round(i*(frameCount-1)/(count-1)));
}
