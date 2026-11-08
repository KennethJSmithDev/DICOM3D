// A waiter owns only its cancellation; consumers own independent scene leases.
export function createResourcePool({load,clone,dispose,releaseClone}){
 const entries=new Map(),leases=new WeakMap();
 const stats={loads:0,reuses:0,leases:0,entries:0,disposed:0};
 function collect(key,entry){
  if(entry.waiters||entry.refs)return;
  if(entries.get(key)===entry){entries.delete(key);stats.entries=entries.size}
  if(entry.ready&&!entry.disposed){entry.disposed=true;dispose(entry.value);stats.disposed++}else if(!entry.ready)entry.controller.abort();
 }
 async function acquire(key,input,signal){
  signal?.throwIfAborted();let entry=entries.get(key);
  if(!entry){entry={controller:new AbortController(),waiters:0,refs:0,ready:false,disposed:false};entries.set(key,entry);stats.entries=entries.size;stats.loads++;
   entry.promise=Promise.resolve().then(()=>load(input,entry.controller.signal)).then(value=>{entry.value=value;entry.ready=true;if(entry.controller.signal.aborted)collect(key,entry);return value});
  }else stats.reuses++;
  entry.waiters++;
  return new Promise((resolve,reject)=>{
   let finished=false;
   const abort=()=>finish(signal.reason??new DOMException('Cancelled','AbortError'));
   function finish(error,value){if(finished)return;finished=true;signal?.removeEventListener('abort',abort);entry.waiters--;
    if(error){collect(key,entry);reject(error);return}
    try{const result=clone(value);entry.refs++;stats.leases++;leases.set(result,()=>{releaseClone(result);entry.refs--;stats.leases--;collect(key,entry)});resolve(result)}catch(error){collect(key,entry);reject(error)}
   }
   signal?.addEventListener('abort',abort,{once:true});
   entry.promise.then(value=>finish(null,value),error=>finish(error));
  });
 }
 return {acquire,stats,release(value){const release=leases.get(value);if(!release)return false;leases.delete(value);release();return true}};
}
// Parsing is serialized; independently verified downloads can overlap.
export function createSerialAdmission(){let tail=Promise.resolve();return task=>{const next=tail.then(task,task);tail=next.catch(()=>{});return next}}
