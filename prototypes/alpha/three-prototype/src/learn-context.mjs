import {referenceLesson} from '../../viewer/src/reference-learning.mjs';
import {imageLesson, segmentationLesson} from '../../viewer/src/evidence-learning.mjs';
import {referenceSourceLinks, relationshipScope, compositeCoverageText} from './female-catalog.mjs';

// Adapt the existing deterministic lessons to current source context. No medical
// finding, new anatomical classification or registration is generated here.
const card=(title,body)=>({title,body});
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
const safeUrl=value=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.href:null}catch{return null}};
const finite=value=>Number.isFinite(value)?value:null;
const present=value=>value===null||value===undefined?'Not supplied':String(value);
const rows=entries=>entries.map(([label,value])=>({label,value:present(value)}));
const presentationCards=[
 card('Scientific, Holographic and Materialization','Scientific uses the source materials. Holographic changes their appearance. Materialization introduces the available geometry with a temporary assembly effect; it does not reconstruct anatomy or change the source coordinates.'),
 card('See inside without changing the source','Select a structure, focus or isolate it, then use Controls to change its opacity or appearance. Restore returns the presentation to its assembled state. Transparency and separated layouts reveal relationships; they are not physical tissue cuts.'),
];

function referenceContext(o){
 const female=!!o.femaleActive,index=female?o.femaleData?.index:o.index;
 const selected=female?o.femaleSelected:o.selected;
 const part=index?.structures?.find(p=>p.id===selected);
 const bundle=part?o.bundles?.get(part.bundleId):o.bundles?.values?.().next().value;
 const manifest=female?(o.femaleData?.sourceManifests?.get(part?.bundleId)??o.femaleData?.manifest):bundle?.manifest;
 const referenceId=manifest?.reference?.id??(female?'BodyParts3D + HRA female composite':'BodyParts3D male reference');
 const provenance=manifest?.provenance??{};
 const normalized={...manifest,structure:{semantic_id:manifest?.structure?.semantic_id??referenceId},reference:{id:referenceId},provenance:{...provenance,license:provenance.license??'See the source notice; no new redistribution approval is implied.'}};
 const prefs=female?o.femalePrefs:null;
 const opacity=finite(prefs?.opacity??o.opacity)??1;
 const lesson=referenceLesson(normalized,part,{isolate:!!(prefs?.isolated??o.isolatedId),opacity:new Map(part?[[part.id,opacity]]:[]),context:false,clip:'unchanged'});
 const related=(index?.hierarchy??[]).filter(p=>p.owner_ids?.includes(selected));
 const indirect=related.filter(p=>p.ownership_scope!=='DIRECT');
 const loaded=female?!!o.femaleData:!!(part&&o.bundles?.has(part.bundleId));
 const held=female?index?.held?.length:o.heldCount;
 const cards=[
  card(part?`About this selection: ${part.label}`:'Explore the available reference',part?`${lesson.known} ${loaded?'Its source geometry is loaded.':'Its catalog identity is available; its geometry is not yet loaded.'}`:'Choose a structure in the explorer or click visible anatomy. Learn follows your current selection, reference source and imaging workspace.'),
  card('What the reference represents',female?'The female composite uses the shared BodyParts3D base and an approximately fitted HRA organ delta.':'BodyParts3D is a generalized male anatomical reference. Selectable source structures and groups may contain several components; the catalog count is not a count of independent organs.'),
  card('Relationships and coverage',`${indirect.length?`${indirect.length} source relationships for this selection are represented through existing rendered geometry, rather than separate selectable meshes. `:''}System memberships can overlap. ${female?compositeCoverageText(index)+' ':Number.isInteger(held)?`${held} source entries or relationships remain unavailable pending source review. `:''}An unloaded or unavailable structure is not evidence that anatomy is absent. Height-based navigation groups are not anatomical system classifications.`),
  ...presentationCards,
  card('Reference versus patient',lesson.unverified),
 ];
 const systems=(part?.systems??[]).join(' · ');
 return {kind:'reference',title:part?`Understand ${part.label}`:`Explore ${female?'female':'male'} anatomy`,subtitle:'Generalized reference anatomy',cards,
  sourceRows:rows([['Reference',referenceId],['Selected source ID',part?.id??'No structure selected'],['Source label',part?.label??'No structure selected'],['Source systems / classifications',systems||'Not supplied for this selection'],['Region',part?.region??'Not supplied'],['Geometry',part?(loaded?'Loaded':'Not loaded'):'Select a structure'],['Source attribution',provenance.copyright??'See source notice'],['Source terms',provenance.license??'See source notice']]),
  relationships:related.slice(0,20).map(p=>({id:p.id,label:p.label,scope:female?relationshipScope(p):p.ownership_scope==='DIRECT'?'Direct source relationship':'Represented through existing geometry',relation:p.relation??''})),
  links:[...referenceSourceLinks(female,part),...(safeUrl(provenance.source_url)?[{label:'Publisher source',href:safeUrl(provenance.source_url)}]:[])],
 };
}

function h000Context(o){
 const study=o.study,binding=study?.binding,k=Number.isInteger(o.studyFrame)?o.studyFrame:0;
 if(!study)return {kind:'empty-imaging',title:'Understand source imaging',subtitle:'No acquired study loaded',cards:[card('Start with an acquired source','Open the public H000 CT/SEG example, or use the supported local verified CT packet controls. A reference atlas is available independently of acquired imaging.'),card('Keep the sources distinct','Source frames, a segmentation mask, a display surface and generalized anatomy are different representations. Learn identifies the active source when it is available.')],sourceRows:[],relationships:[],links:[]};
 const frame=binding?.frames?.find(f=>f.ct_k===k),shape=study.ctReceipt?.volume?.shape_k_row_column;
 const image=imageLesson({source:{format:'DICOM',identity:{Modality:'CT',SOPInstanceUID:frame?.ct_sop_uid},provenance:{collection:'Curated public H000 research example'},sopName:'Acquired CT source frames',sha256:study.ctReceipt?.volume?.npy_sha256},pixels:study.pixels,display:null},k);
 const seg=binding&&frame&&Array.isArray(binding.frames)&&Number.isFinite(binding.maskVolumeMm3)?segmentationLesson(binding,k):null;
 const cards=[card('Read the acquired image',image.known),card('Brightness and 3D display','Windowing changes how stored values are shown. The complete CT volume uses interpolation and an opacity transfer for display; neither identifies or segments organs. Source-plane navigation and the source SEG overlay retain their separate evidence.'),
 card('Understand this SEG relationship',seg?seg.known:'No complete source SEG relationship is available in this context.'),
 card('Selection and frame correspondence',`${o.lesionSelected?'The source lesion is selected. ':'Select the source-linked lesion to highlight its mask. '}${frame&&frame.nonzero_voxels===0?'The current frame does not intersect the source mask; absence of an overlay here is expected. ':''}${o.studySeg===false?'The source SEG overlay is currently hidden. ':''}Changing the selected frame or highlight does not edit the original CT or segmentation.`),
 card('Surface, mask and volume are different',o.derivedMode?`${o.derivedMode==='nrx'?'The NRX/R002':'The Three.js'} smooth surface is a display derivative of the existing lesion SEG. ${o.derivedInfo?.status==='ready'?'The derivative is ready.':'The derivative is not yet confirmed ready. '}It is not a new whole-lung or whole-scan organ segmentation. Fine features and global surface accuracy remain separate qualification limits.`:'The displayed source lesion comes from the admitted source segmentation. It is distinct from the CT volume and from generalized reference organs.'),
 card('Interpretation boundary',seg?.uncertainty??'Source relationships do not establish a diagnosis or patient-atlas registration.'),
 ];
 if(o.wipe)cards.push(card('Linked reference comparison','The scan and reference views share camera navigation and the acquired plane. Reference alignment and size fitting are reversible display approximations, not verified patient registration or substituted patient organs. The lesion remains linked to its acquired source.'));
 return {kind:'h000',title:'Understand H000 CT and segmentation',subtitle:`Acquired source frame ${k+1}${shape?` of ${shape[0]}`:''}`,cards,
  sourceRows:rows([['Source representation','Acquired CT + source SEG'],['Source frame (display / stack index)',`${k+1} / k=${k}`],['CT SOP instance',frame?.ct_sop_uid],['SEG SOP instance',binding?.segSop],['Segment number',binding?.segment],['Source segment label',binding?.label],['Source algorithm',binding?.algorithm],['Mask voxels on this frame',frame?.nonzero_voxels],['CT decoded source SHA-256',study.ctReceipt?.volume?.npy_sha256],['Input license',study.manifest?.provenance?.license]]),relationships:[],links:[{label:'H000 credits, transformations and source policy',href:safeUrl(study.noticeUrl)}].filter(l=>l.href)};
}

function localContext(o){
 const descriptor=o.localStudy?.descriptor,k=Number.isInteger(o.localFrame)?o.localFrame:0,shape=descriptor?.shape;
 return {kind:'local',title:'Understand local verified CT',subtitle:descriptor?`Acquired local frame ${k+1}${shape?` of ${shape[0]}`:''}`:'No admitted local CT',cards:[
 card('What was admitted',descriptor?'A locally selected descriptor and decoded stored values passed the existing verification path. The files remain on this device; loading a prepared packet does not establish a live IRIS connection.':'Select the supported descriptor and stored-value files before an acquired source can be explained.'),
 card('The visible representation',o.showStack?'The plane stack samples acquired frames for display. It is not direct volume rendering, an extracted surface or an organ segmentation.':'This view places an acquired source image plane in 3D using the supplied spatial metadata. A plane is not a reconstructed organ or segmented finding.'),
 card('Segmentation and atlas comparison','No source SEG is supplied by this local CT-only path. A generalized reference shown beside it is an unregistered comparison; no finding or patient organ is inferred from the reference.'),
 card('Privacy and evidence','Learn shows only the supported representation and limited acquisition shape here. It does not parse reports, invent findings or transmit local studies. Original source values and spatial metadata remain authoritative.'),
 ],sourceRows:rows([['Admission',descriptor?'Local verified CT packet':'No admitted local CT'],['Frame',descriptor?k+1:null],['Stored shape (frames × rows × columns)',shape?.join(' × ')],['Representation',o.showStack?'Sampled plane stack':'Single acquired plane'],['Source SEG','Not supplied by this path']]),relationships:[],links:[]};
}

export function buildLearnContext(options={}){
 if(options.localMode)return localContext(options);
 if(options.studyView||options.imagingOpen)return h000Context(options);
 if(options.nrx)return {kind:'nrx',title:'Understand the NRX research surface',subtitle:'Independent HRA right-ovary source',cards:[card('Independent reference source','This smooth-field example derives from the HRA female right-ovary reference. It is independent of the male atlas and the acquired CT study.'),card('What the surface establishes','The bridge displays an NRX-derived surface. Its appearance does not establish registration, organ segmentation from this CT, or clinical correctness.'),...presentationCards],sourceRows:rows([['Source context','HRA female right ovary'],['Registration to active CT','Not established']]),relationships:[],links:[{label:'HRA source attribution',path:'nrx/HRA-FEMALE-NOTICE.txt'}]};
 const result=referenceContext(options);
 if(options.nrxReference)result.cards.push(card('Selected-organ NRX derivative',`This requested surface is generated from the selected reference geometry, not patient CT. ${options.nrxReferenceInfo?.status==='ready'?'The display derivative is ready.':'Generation is pending or unavailable; inspect its status in Controls.'} The original reference remains authoritative.`));
 return result;
}
