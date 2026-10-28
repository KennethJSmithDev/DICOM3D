// One source owner retires once; all callers join the same completion.
// Failure reporting never skips remaining explicitly owned resources.
export function createDisposalOwner(stop,teardown,report){
 let completion;
 return function dispose(){
  if(completion)return completion;
  completion=Promise.resolve().then(async()=>{
   const failures=[];try{await stop();}catch(e){failures.push(e);}
   for(const release of [...teardown].reverse()){try{await release();}catch(e){failures.push(e);}}
   if(failures.length)report(failures);
  });
  return completion;
 };
}
