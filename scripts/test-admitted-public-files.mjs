import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,readdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {copyAdmittedFlat,copyNotices,THIRD_PARTY_NOTICES,sha256} from './admitted-public-files.mjs';
const base=process.env.DICOM3D_SECURITY_TEST_DIR;
if(!base)throw Error('Set DICOM3D_SECURITY_TEST_DIR to the owned qualification directory');
test('public asset copying refuses extras and changed bytes before copying',async()=>{
 const input=join(base,'public-input'),output=join(base,'public-output');
 await mkdir(input,{recursive:true});
 const bytes=Buffer.from('public fixture'),record={'approved.txt':{bytes:bytes.length,sha256:sha256(bytes)}};
 await writeFile(join(input,'approved.txt'),bytes);
 await writeFile(join(input,'unexpected.txt'),'private synthetic fixture');
 await assert.rejects(copyAdmittedFlat(input,output,record),/Unexpected/);
 await assert.rejects(readdir(output),{code:'ENOENT'});
 // Use a separate admitted directory to avoid deleting any existing evidence.
 const clean=join(base,'public-clean');await mkdir(clean,{recursive:true});
 await writeFile(join(clean,'approved.txt'),'different bytes');
 await assert.rejects(copyAdmittedFlat(clean,output,record),/changed/);
 await writeFile(join(clean,'approved.txt'),bytes);
 await copyAdmittedFlat(clean,output,record);
 assert.deepEqual(await readFile(join(output,'approved.txt')),bytes);
});
test('notice names and contents must match pinned public identities',async()=>{
 const input=join(base,'notice-input'),output=join(base,'notice-output');
 await mkdir(join(input,'alpha'),{recursive:true});
 for(const name of THIRD_PARTY_NOTICES)await copyFile(join('third-party',name),join(input,name));
 const victim=THIRD_PARTY_NOTICES[0];await writeFile(join(input,victim),'unreviewed replacement');
 await assert.rejects(copyNotices(input,output),/Preview file changed/);
 await assert.rejects(readdir(output),{code:'ENOENT'});
 await copyFile(join('third-party',victim),join(input,victim));
 await copyNotices(input,output);
 assert.deepEqual(await readFile(join(output,victim)),await readFile(join('third-party',victim)));
 const extra=join(base,'notice-extra');await mkdir(join(extra,'alpha'),{recursive:true});
 for(const name of THIRD_PARTY_NOTICES)await copyFile(join('third-party',name),join(extra,name));
 await writeFile(join(extra,'unexpected.txt'),'not admitted');
 await assert.rejects(copyNotices(extra,join(base,'notice-extra-output')),/Unexpected/);
 await assert.rejects(readdir(join(base,'notice-extra-output')),{code:'ENOENT'});
});
