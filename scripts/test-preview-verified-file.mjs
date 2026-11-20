import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {readVerifiedFile} from './preview-verified-file.mjs';
import {createResponseGate} from './preview-verified-file.mjs';
import {EventEmitter} from 'node:events';
const dir=process.env.DICOM3D_SECURITY_TEST_DIR;
if(!dir)throw Error('Set DICOM3D_SECURITY_TEST_DIR to the owned qualification directory');
mkdirSync(dir,{recursive:true});
const file=join(dir,'preview-verification-fixture.txt'),source=Buffer.from('public sample');
const record={bytes:source.length,sha256:createHash('sha256').update(source).digest('hex')};
test('responds only with the exact admitted bytes',()=>{
 writeFileSync(file,source);const snapshot=readVerifiedFile(file,record);assert.deepEqual(snapshot,source);
 writeFileSync(file,'other sample!');assert.throws(()=>readVerifiedFile(file,record));assert.deepEqual(snapshot,source);
 writeFileSync(file,'short');assert.throws(()=>readVerifiedFile(file,record));
 assert.throws(()=>readVerifiedFile(file,{bytes:100000000,sha256:record.sha256}));
});
test('slow responses are bounded, queued and released',async()=>{
 const gate=createResponseGate(1,1),a=new EventEmitter(),b=new EventEmitter(),c=new EventEmitter();
 assert.equal(await gate(a),true);
 const pending=gate(b);assert.equal(await gate(c),false);
 a.emit('finish');assert.equal(await pending,true);b.emit('close');
 assert.equal(await gate(c),true);c.emit('finish');
});
