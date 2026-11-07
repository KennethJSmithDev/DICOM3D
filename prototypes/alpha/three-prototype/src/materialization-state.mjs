import {referenceVisualRules} from './live-reference-samples.mjs';
export const INTRO_DURATION_MS=8000;
export function introFrame(elapsed,reduced=false){
 const p=reduced?1:Math.max(0,Math.min(1,elapsed/INTRO_DURATION_MS)),forming=Math.min(1,p/.8);
 return {progress:p,forming,phase:p>=1?'scientific':p<.8?'assembling':'holographic',reveal:referenceVisualRules('materialization',forming,'layers',reduced).reveal,particles:reduced?0:Math.max(0,1-Math.max(0,(p-.8)/.2)),done:p===1};
}
