import {digest, readStoredNpy} from './ct-frame.mjs';
import {validateSpatial} from './ct-spatial.mjs';
import {readMaskNpy} from './source-overlay.mjs';

const need = (condition, message) => { if (!condition) throw Error(message); };
const verifiedMetadata = new WeakSet();
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};

// WHY: the admitted case has five exact objects, never a directory or URL template.
// BOUNDARY: local publication candidate; this grants no publication authority.
// INVARIANT: original decoded NPY/GLB identities and semantic IDs remain authoritative.
// EVIDENCE: scripts/test-public-research-data.mjs; local public-admission receipts.
// REGRESSION: accepting unknown paths/keys could expose unrelated research metadata.
export const PUBLIC_RESEARCH_ASSETS = freeze({
  metadata: {filename: 'source-binding.json', bytes: 22129, sha256: '605073678ef244b7ebd44995d01789e79f5cb31a715c66a21d4b76b12161d73e'},
  // Opaque suffix prevents static hosts from consuming the file's gzip container as HTTP encoding.
  // Container format is explicit in frozen metadata and decoded only after exact byte verification.
  ct: {filename: 'ct.npy.bin', bytes: 32972849, sha256: '645c9ebaf383bb447e415e0a400973aabb2da50e147033fb710180fa0b179b88', decodedBytes: 54001792, decodedSha256: '25c48e0d392888c61eb157093dc9b5db00e7cb9fcf84c2d6dfb4fbb4fcbf2340'},
  mask: {filename: 'mask.npy.bin', bytes: 28346, sha256: '44c55da565e520ee2d1eee25710650d23ada10bfb510c2e39e1cabb06ec0399c', decodedBytes: 27000960, decodedSha256: 'beb646363d8e19a86215d2df92a14d12d76d2e2bb7757efd553d813da7b8e17f'},
  mesh: {filename: 'lesion.glb', bytes: 263976, sha256: '0e77bfb887791614b5fcb15c614c4948ae4d48e24ab6e9fa289aa0603c66076d'},
  notice: {filename: 'NOTICE.md', bytes: 3865, sha256: '0dfff975e61696fd4b570e32b38e84ef4515ebb812906196169aab0818081d2a'},
});
export const PUBLIC_RESEARCH_FILES = Object.freeze(Object.values(PUBLIC_RESEARCH_ASSETS).map(a => a.filename));
export const PUBLIC_RESEARCH_SOURCE = freeze({
  source_collection: 'qin_lung_ct', public_subject_id: 'QIN-LSC-0064',
  source_study_uid: '1.3.6.1.4.1.14519.5.2.1.4320.7007.528630355329208477591397393556',
  ct_series_uid: '1.3.6.1.4.1.14519.5.2.1.4320.7007.151808167652515688166637630421',
  frame_of_reference_uid: '1.3.6.1.4.1.14519.5.2.1.4320.7007.948582471080265048379317906583',
  segmentation_analysis_result: 'qin_lungct_seg',
  segmentation_series_uid: '1.2.276.0.7230010.3.1.3.0.12158.1415315114.303388',
  segmentation_sop_uid: '1.2.276.0.7230010.3.1.4.0.12158.1415315114.303389',
});
export const PUBLIC_RESEARCH_SEMANTIC_ID = 'lesion.lung.mass.001';
const MAT = freeze({
  index_to_patient_mm: [[0,0,0.59765625,-155.701171875],[0,0.59765625,0,-290.701171875],[3,0,0,66.5],[0,0,0,1]],
  patient_mm_to_index: [[0,0,1/3,-22.166666666666664],[0,1.673202614379085,0,486.40196078431376],[1.673202614379085,0,0,260.51960784313724],[0,0,0,1]],
  patient_mm_to_model_m: [[-0.001,0,0,0],[0,0,0.001,0],[0,0.001,0,0],[0,0,0,1]],
  model_m_to_patient_mm: [[-1000,0,0,0],[0,0,1000,0],[0,1000,0,0],[0,0,0,1]],
});
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const literal = expected => (value,path) => need(same(value,expected), `Unexpected value at ${path}`);
const text = (value,path) => need(typeof value === 'string' && value.length <= 8192, `Invalid text at ${path}`);
const hash = (value,path) => need(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), `Invalid SHA-256 at ${path}`);
const uid = (value,path) => need(typeof value === 'string' && value.length <= 64 && /^\d+(\.\d+)+$/.test(value), `Invalid UID at ${path}`);
const integer = (min,max) => (value,path) => need(Number.isSafeInteger(value) && value >= min && value <= max, `Invalid integer at ${path}`);
const list = (check,length) => (value,path) => {
  need(Array.isArray(value) && value.length === length, `Invalid array at ${path}`);
  value.forEach((item,i) => inspect(item,check,`${path}[${i}]`));
};
function inspect(value,spec,path='$') {
  if (typeof spec === 'function') return spec(value,path);
  need(value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype, `Invalid object at ${path}`);
  const keys=Object.keys(value), allowed=Object.keys(spec);
  need(keys.length === allowed.length && keys.every(key => Object.hasOwn(spec,key)), `Unknown or missing key at ${path}`);
  for (const key of allowed) inspect(value[key],spec[key],`${path}.${key}`);
}
const code = {meaning:text,scheme:text,value:text};
const credit = {citation:text,doi:text};
const sourceCredit = {...credit,source:text};
const gzipAsset = key => {
  const a=PUBLIC_RESEARCH_ASSETS[key];
  return {proposed_relative_url:literal(`demo/h000/${a.filename}`),encoding:literal('gzip'),
    gzip_level:literal(9),gzip_mtime:literal(0),compressed_bytes:literal(a.bytes),
    compressed_sha256:literal(a.sha256),decoded_bytes:literal(a.decodedBytes),decoded_sha256:literal(a.decodedSha256)};
};
const SPEC = {
  schema:literal('DICOM3D.public-source-binding'), schema_version:literal(1),
  admission:{status:literal('LOCAL_PUBLICATION_CANDIDATE'),historical_h000_publication_authorized:literal(false),scope:text,publicationApproved:literal(false)},
  source:Object.fromEntries(Object.entries(PUBLIC_RESEARCH_SOURCE).map(([key,value])=>[key,literal(value)])),
  ct:{
    format:literal('NPY 1.0'),dtype:literal('<u2'),shape_k_row_column:literal([103,512,512]),
    fortran_order:literal(false),npy_header_bytes:literal(128),photometric_interpretation:literal('MONOCHROME2'),
    bits_allocated:literal(16),bits_stored:literal(12),high_bit:literal(11),pixel_representation:literal(0),
    samples_per_pixel:literal(1),stored_values:text,
    display:{slope:literal(1),intercept:literal(-1024),rescale_type:literal(''),initial_level:literal(-600),
      initial_width:literal(1500),function:text,calibration_claim:text},
    geometry:{image_orientation_patient:literal([1,0,0,0,1,0]),pixel_spacing_row_column_mm:literal([0.59765625,0.59765625]),
      measured_slice_spacing_mm:literal(3),first_ordered_image_position_patient_mm:literal([-155.701171875,-290.701171875,66.5])},
  },
  mask:{format:literal('NPY 1.0'),dtype:literal('|b1'),shape_k_row_column:literal([103,512,512]),fortran_order:literal(false),
    npy_header_bytes:literal(128),allowed_values:literal([0,1]),nonzero_voxel_count:literal(32588),
    occupied_k:literal(Array.from({length:15},(_,i)=>64+i)),seg_type:literal('BINARY'),morphology_modified:literal(false)},
  spatial:{
    coordinate_conventions:{homogeneous:text,index:text,model:text,patient:text},
    matrices:Object.fromEntries(Object.entries(MAT).map(([key,value])=>[key,literal(value)])),
    model_bounds_m:{maximum:literal([-0.028078125,0.302,-0.06568359375]),minimum:literal([-0.07648828125,0.257,-0.1033359375])},
    recentered:literal(false),right_handed:literal(true),display_reflections:text,
  },
  structure:{semantic_id:literal(PUBLIC_RESEARCH_SEMANTIC_ID),glb_node_name:literal(PUBLIC_RESEARCH_SEMANTIC_ID),
    source:{algorithm_name:literal('alg01_run1'),algorithm_type:literal('SEMIAUTOMATIC'),anatomic_region_codes:literal([]),
      category_codes:list(code,1),label:literal('Segmentation'),segment_number:literal(1),type_codes:list(code,1)},
    unsupported_inferences:{diagnosis:literal(null),laterality:literal(null),lobe:literal(null)}},
  frames:list({ct_k:integer(0,102),ct_sop_uid:uid,seg_frame_number:integer(1,103),nonzero_voxels:integer(0,262144)},103),
  binding_evidence:{ordering_basis:text,all_geometrically_mapped_sops_in_actual_source_context:literal(true),
    source_sha256:{manifest:hash,h000_b:hash,h000_c:hash,header_audit:hash},qualification_scope:text},
  assets:{
    ct:gzipAsset('ct'),mask:gzipAsset('mask'),
    mesh:{proposed_relative_url:literal('demo/h000/lesion.glb'),encoding:literal('identity'),bytes:literal(263976),
      sha256:literal(PUBLIC_RESEARCH_ASSETS.mesh.sha256),vertices:literal(10968),triangles:literal(21932),units:literal('metres'),
      normals_outward_winding_and_culling:literal('UNQUALIFIED')},
    notice:{proposed_relative_url:literal('demo/h000/NOTICE.md'),encoding:literal('identity'),
      bytes:literal(PUBLIC_RESEARCH_ASSETS.notice.bytes),sha256:literal(PUBLIC_RESEARCH_ASSETS.notice.sha256)},
  },
  legal:{input_license:literal('CC BY 3.0'),license_url:literal('https://creativecommons.org/licenses/by/3.0/'),
    credits:{ct:sourceCredit,seg:sourceCredit,methods:credit,tcia:credit,idc:credit},policy_url:text,dac_guidance_url:text,
    changes:text,downstream_notice:text,code_license_scope:text},
  limitations:list(text,4),
};

/** Structural checks are exported for rejection tests; loading also pins the exact metadata bytes. */
export function assertPublicMetadataStructure(metadata) {
  inspect(metadata,SPEC);
  need(new Set(metadata.frames.map(f=>f.ct_sop_uid)).size===103, 'Duplicate source CT SOP');
  need(new Set(metadata.frames.map(f=>f.seg_frame_number)).size===103, 'Duplicate source SEG frame');
  metadata.frames.forEach((f,k)=>need(f.ct_k===k,'Source frame order differs'));
  need(metadata.frames.reduce((sum,f)=>sum+f.nonzero_voxels,0)===32588,'Source mask total differs');
  need(same(metadata.frames.filter(f=>f.nonzero_voxels>0).map(f=>f.ct_k),metadata.mask.occupied_k),'Occupied source frames differ');
  return metadata;
}
export async function verifyPublicBytes(bytes, expected, label='asset') {
  need(bytes instanceof Uint8Array, `${label}: expected byte array`);
  need(bytes.byteLength===expected.bytes, `${label}: unexpected byte length`);
  need(await digest(bytes)===expected.sha256, `${label}: SHA-256 mismatch`);
  return bytes;
}
export async function parsePublicMetadata(bytes) {
  await verifyPublicBytes(bytes,PUBLIC_RESEARCH_ASSETS.metadata,'Public source binding');
  const metadata=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  freeze(assertPublicMetadataStructure(metadata));
  verifiedMetadata.add(metadata);
  return metadata;
}

/** No URL from metadata is fetch authority. Only these filenames beneath this same-origin app base. */
export function publicAssetUrl(base,filename,pageUrl=globalThis.location?.href) {
  need(PUBLIC_RESEARCH_FILES.includes(filename),'Public asset filename is not allowlisted');
  need(typeof base==='string' && base.length>0 && base.endsWith('/') && !/[\\%?#]/.test(base),'Invalid public app base');
  need(typeof pageUrl==='string','A same-origin page URL is required');
  const page=new URL(pageUrl), root=new URL(base,page);
  need(['http:','https:'].includes(root.protocol) && root.origin===page.origin && !root.username && !root.password && !root.search && !root.hash,'Public asset base must be same-origin HTTP(S)');
  // URL normalization must not turn traversal into an apparently valid app base.
  need(!base.split('/').some(part=>part==='.'||part==='..'),'Path traversal in public app base');
  const url=new URL(`demo/h000/${filename}`,root);
  need(url.origin===root.origin && url.pathname===root.pathname+`demo/h000/${filename}`,'Public asset path escaped base');
  return url.href;
}

export async function boundedStreamBytes(stream,expectedBytes,label='stream') {
  need(stream && typeof stream.getReader==='function','Readable byte stream required');
  need(Number.isSafeInteger(expectedBytes) && expectedBytes>=0 && expectedBytes<=PUBLIC_RESEARCH_ASSETS.ct.decodedBytes,'Invalid bounded byte limit');
  const reader=stream.getReader(), result=new Uint8Array(expectedBytes);
  let offset=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done) break;
      need(value instanceof Uint8Array,`${label}: non-byte stream chunk`);
      if(value.byteLength>expectedBytes-offset) throw Error(`${label}: output exceeds admitted byte limit`);
      result.set(value,offset); offset+=value.byteLength;
    }
    need(offset===expectedBytes,`${label}: incomplete byte stream`);
    return result;
  } catch(error) {
    await reader.cancel(String(error)).catch(()=>{});
    throw error;
  } finally { reader.releaseLock(); }
}
export async function decodePublicGzip(bytes,key,Decompressor=globalThis.DecompressionStream) {
  const asset=PUBLIC_RESEARCH_ASSETS[key];
  need(key==='ct'||key==='mask','Compressed asset is not allowlisted');
  need(typeof Decompressor==='function','Native gzip decompression is unavailable');
  await verifyPublicBytes(bytes,asset,key);
  const stream=new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}})
    .pipeThrough(new Decompressor('gzip'));
  const decoded=await boundedStreamBytes(stream,asset.decodedBytes,`${key} gzip`);
  await verifyPublicBytes(decoded,{bytes:asset.decodedBytes,sha256:asset.decodedSha256},`${key} decoded NPY`);
  return decoded;
}

export async function projectPublicResearch(metadata,ctBytes,maskBytes,glbBytes) {
  // The caller cannot bypass the frozen whole-metadata identity with a new object.
  need(verifiedMetadata.has(metadata),'Verified frozen public metadata is required');
  assertPublicMetadataStructure(metadata);
  await verifyPublicBytes(ctBytes,{bytes:PUBLIC_RESEARCH_ASSETS.ct.decodedBytes,sha256:PUBLIC_RESEARCH_ASSETS.ct.decodedSha256},'CT NPY');
  await verifyPublicBytes(maskBytes,{bytes:PUBLIC_RESEARCH_ASSETS.mask.decodedBytes,sha256:PUBLIC_RESEARCH_ASSETS.mask.decodedSha256},'Mask NPY');
  await verifyPublicBytes(glbBytes,PUBLIC_RESEARCH_ASSETS.mesh,'GLB');
  const ctBuffer=ctBytes.byteOffset===0&&ctBytes.byteLength===ctBytes.buffer.byteLength?ctBytes.buffer:ctBytes.slice().buffer;
  const maskBuffer=maskBytes.byteOffset===0&&maskBytes.byteLength===maskBytes.buffer.byteLength?maskBytes.buffer:maskBytes.slice().buffer;
  const pixels=readStoredNpy(ctBuffer),mask=readMaskNpy(maskBuffer);
  const frames=metadata.frames;
  for(const frame of frames) {
    let count=0;const base=frame.ct_k*262144;
    for(let i=0;i<262144;i++) count+=mask[base+i];
    need(count===frame.nonzero_voxels,`Mask count differs at k=${frame.ct_k}`);
  }
  const marker={schema:'DICOM3D.public-source-binding',status:'LOCAL_PUBLICATION_CANDIDATE',
    publicationApproved:false,metadata_sha256:PUBLIC_RESEARCH_ASSETS.metadata.sha256};
  const manifest={
    schema:'DICOM3D.public-study-projection',schema_version:1,public_projection:marker,
    structure:metadata.structure,source:metadata.source,spatial:metadata.spatial,
    asset:{relative_filename:'lesion.glb',sha256:PUBLIC_RESEARCH_ASSETS.mesh.sha256,
      model_space:'DICOM3D Model Space v1',units:'metres',bytes:263976,vertices:10968,triangles:21932},
    provenance:{public_projection:true,description:metadata.binding_evidence.ordering_basis,
      license:metadata.legal.input_license,license_url:metadata.legal.license_url,
      B_volume:{sha256:PUBLIC_RESEARCH_ASSETS.ct.decodedSha256,description:'Exact acquired stored-value NPY'},
      C_mask:{sha256:PUBLIC_RESEARCH_ASSETS.mask.decodedSha256,description:'Exact aligned source binary SEG mask'},
      original_evidence_sha256:metadata.binding_evidence.source_sha256},
    licensing:{publication_authorized:false,input_license:metadata.legal.input_license,
      license_url:metadata.legal.license_url,changes:metadata.legal.changes,credits:metadata.legal.credits},
  };
  const ctReceipt={
    schema:'DICOM3D.public-ct-projection',public_projection:marker,
    geometry:metadata.ct.geometry,
    affine_voxel_k_row_column_to_patient_mm:metadata.spatial.matrices.index_to_patient_mm,
    inverse_patient_mm_to_voxel_k_row_column:metadata.spatial.matrices.patient_mm_to_index,
    slice_mapping:frames.map(f=>({k:f.ct_k,sop_uid:f.ct_sop_uid})),
    volume:{dtype:'<u2',shape_k_row_column:[103,512,512],npy_sha256:PUBLIC_RESEARCH_ASSETS.ct.decodedSha256,
      npy_bytes:PUBLIC_RESEARCH_ASSETS.ct.decodedBytes,pixel_bytes:pixels.byteLength},
  };
  validateSpatial(ctReceipt,manifest);
  const occupied=frames.filter(f=>f.nonzero_voxels>0);
  const [row,col]=metadata.ct.geometry.pixel_spacing_row_column_mm,z=metadata.ct.geometry.measured_slice_spacing_mm;
  const count=metadata.mask.nonzero_voxel_count,voxelMm3=row*col*z;
  const binding={semanticId:PUBLIC_RESEARCH_SEMANTIC_ID,segSop:metadata.source.segmentation_sop_uid,
    segment:1,label:metadata.structure.source.label,typeCodes:metadata.structure.source.type_codes,
    algorithm:metadata.structure.source.algorithm_name,frames,occupied,
    peak:occupied.reduce((a,b)=>b.nonzero_voxels>a.nonzero_voxels?b:a),count,voxelMm3,
    maskVolumeMm3:count*voxelMm3,status:'VERIFIED_PUBLIC_PROJECTION',
    basis:metadata.binding_evidence.ordering_basis,
    limitation:'Source mask voxel volume, not independent anatomical accuracy, diagnosis or whole-lung segmentation. No linked SR report or reference-body registration is established.',
    public_projection:marker};
  return {manifest:freeze(manifest),ctReceipt:freeze(ctReceipt),binding:freeze(binding),pixels,mask,
    glbBytes:glbBytes.byteOffset===0&&glbBytes.byteLength===glbBytes.buffer.byteLength?glbBytes.buffer:glbBytes.slice().buffer};
}
