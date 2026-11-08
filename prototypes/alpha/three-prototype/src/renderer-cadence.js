import {REVISION} from 'three';
const owned=new WeakSet();
// Three r180 starts a bookkeeping RAF even without setAnimationLoop(callback).
// This pinned bridge moves that bookkeeping to our requested draws. Do not patch
// browser APIs or node_modules, and do not use this adapter for XR-owned rendering.
export function ownRendererCadence(renderer){
 const animation=renderer._animation,nodeFrame=renderer._nodes?.nodeFrame;
 if(REVISION!=='180'||!animation?.stop||!nodeFrame?.update||!renderer.info?.reset)throw Error('Unsupported Three renderer cadence boundary');
 if(owned.has(renderer))throw Error('Renderer cadence already owned');
 owned.add(renderer);animation.stop();let disposed=false;
 return {
  beforeDraw(){if(disposed)return;if(renderer.info.autoReset===true)renderer.info.reset();nodeFrame.update();renderer.info.frame=nodeFrame.frameId},
  dispose(){if(disposed)return;disposed=true;animation.stop();owned.delete(renderer)},
 };
}
