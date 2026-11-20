import {openSync,closeSync,fstatSync,readSync} from 'node:fs';
import {createHash} from 'node:crypto';

// The returned snapshot is the exact byte sequence verified, even if the path
// is replaced after open. No response may stream a separately reopened file.
export function readVerifiedFile(path,record){
 if(!record||!Number.isSafeInteger(record.bytes)||record.bytes<0||record.bytes>=100000000||!/^[0-9a-f]{64}$/.test(record.sha256))throw Error('Invalid preview inventory record');
 const fd=openSync(path,'r');
 try{
  const info=fstatSync(fd);
  if(!info.isFile()||info.size!==record.bytes)throw Error('Preview file changed');
  const bytes=Buffer.allocUnsafe(record.bytes);let offset=0;
  while(offset<bytes.length){const n=readSync(fd,bytes,offset,bytes.length-offset,offset);if(!n)throw Error('Preview file truncated');offset+=n;}
  if(createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw Error('Preview file changed');
  return bytes;
 }finally{closeSync(fd);}
}

// Bound verified buffers retained for slow clients; queued requests do not
// allocate a file buffer. A closed response is removed from the queue.
export function createResponseGate(limit=2,maxQueued=64){
 let active=0;const queue=[];
 const advance=()=>{while(active<limit&&queue.length){const item=queue.shift();item.res.removeListener('close',item.cancel);item.enter();}};
 return res=>new Promise(resolve=>{
  const enter=()=>{
   if(res.destroyed){resolve(false);return;}
   active++;let released=false;
   const release=()=>{if(released)return;released=true;active--;res.removeListener('finish',release);res.removeListener('close',release);advance();};
   res.once('finish',release);res.once('close',release);resolve(true);
  };
  if(active<limit)return enter();
  if(queue.length>=maxQueued)return resolve(false);
  const item={res,enter,cancel:()=>{const i=queue.indexOf(item);if(i>=0)queue.splice(i,1);resolve(false);}};
  queue.push(item);res.once('close',item.cancel);
 });
}
