// Container/display adapter only. No DICOM decode, registration or source writes.
export async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function requireValue(ok,message){if(!ok)throw Error(message);}
export function validateReceipt(receipt,manifest) {
  requireValue(receipt.result==='PASS_H000_B','CT metadata is not an accepted H000-B receipt');
  const v=receipt.volume,p=receipt.pixel_decode,s=p?.uniform_source_representation;
  requireValue(v?.npy_sha256===manifest.provenance?.B_volume?.sha256,'CT identity differs from manifest');
  requireValue(v?.dtype==='<u2'&&JSON.stringify(v.shape_k_row_column)==='[103,512,512]','Unsupported CT dimensions or dtype');
  requireValue(s?.photometric_interpretation==='MONOCHROME2'&&s.Rows===512&&s.Columns===512,'Unsupported CT pixel representation');
  const rules=p.rescale_rules;
  requireValue(rules?.length===1&&rules[0].slope===1&&rules[0].intercept===-1024&&rules[0].rescale_type==='','Unexpected display rescale evidence');
  for(const [a,b] of [['study_uid','source_study_uid'],['ct_series_uid','ct_series_uid'],['frame_of_reference_uid','frame_of_reference_uid']])requireValue(receipt.accepted_input?.[a]===manifest.source?.[b],`CT ${a} identity differs`);
  requireValue(receipt.slice_mapping?.length===103,'Expected 103 source frames');
  const ids=new Set();
  for(let k=0;k<103;k++) {const f=receipt.slice_mapping[k];requireValue(f.k===k&&typeof f.sop_uid==='string'&&/^\d+(\.\d+)+$/.test(f.sop_uid)&&!ids.has(f.sop_uid),'Missing, duplicate or unordered source frame identity');ids.add(f.sop_uid);}
  return receipt;
}
export function readStoredNpy(buffer) {
  requireValue(buffer.byteLength===54001792,'Unexpected CT file size');
  const b=new Uint8Array(buffer),v=new DataView(buffer);
  requireValue(b[0]===0x93&&String.fromCharCode(...b.subarray(1,6))==='NUMPY'&&b[6]===1&&b[7]===0,'Expected NPY 1.0');
  const offset=10+v.getUint16(8,true),header=new TextDecoder('latin1').decode(b.subarray(10,offset));
  requireValue(offset===128&&/'descr':\s*'<u2'/.test(header)&&/'fortran_order':\s*False/.test(header)&&/'shape':\s*\(103,\s*512,\s*512\s*\)/.test(header),'Unsupported NPY layout');
  requireValue(new Uint8Array(new Uint16Array([1]).buffer)[0]===1,'Little-endian browser required');
  return new Uint16Array(buffer,offset,103*512*512);
}
export function boundedDisplay(k,level,width) {
  requireValue(Number.isInteger(k)&&k>=0&&k<=102,'Frame must be an integer from 0 to 102');
  requireValue(Number.isFinite(level)&&level>=-1024&&level<=3071,'Display level must be -1024 to 3071');
  requireValue(Number.isFinite(width)&&width>=1&&width<=4096,'Display width must be 1 to 4096');
}
function roundEven(x) {const n=Math.floor(x),r=x-n;return r===.5?n+(n%2):Math.round(x);}
export function frameRgba(stored,k,level,width,rgba) {
  boundedDisplay(k,level,width);
  const start=k*512*512,lo=level-width/2;
  for(let i=0;i<512*512;i++) {
    // Match the accepted NumPy float32 display operations and ties-to-even.
    const scaled=Math.fround(Math.fround(stored[start+i]-1024-lo)/width);
    const gray=roundEven(Math.fround(Math.max(0,Math.min(1,scaled))*255)),j=i*4;
    rgba[j]=rgba[j+1]=rgba[j+2]=gray;rgba[j+3]=255;
  }
  return rgba;
}
