// Qualified BODY-ANATOMY-001 source basis, not a generic DICOM convention.
// OBJ: +Z superior, -Y anterior, +X left (named source landmarks).
// GLB: (X,Z,-Y); accepted Lite glTF root world basis: (-X,+Y,+Z).
// Therefore renderer +Z anterior, -Z posterior, -X anatomical left.
export const ATLAS_CAMERA_PRESENTATION={verticalFill:.92,horizontalFill:.9,presets:[
  {id:'Anterior',label:'Anterior',alpha:Math.PI/2,beta:Math.PI/2},
  {id:'Posterior',label:'Posterior',alpha:-Math.PI/2,beta:Math.PI/2},
  {id:'LeftLateral',label:'Left lateral',alpha:Math.PI,beta:Math.PI/2},
  {id:'RightLateral',label:'Right lateral',alpha:0,beta:Math.PI/2},
]};
// HRA glTF Y-up. Named anterior/posterior uterine walls establish anterior -Z;
// left/right ovaries establish source +X left. Lite glTF flips world X only.
export const HRA_FEMALE_CAMERA_PRESENTATION={...ATLAS_CAMERA_PRESENTATION,verticalFill:.88,presets:
  ATLAS_CAMERA_PRESENTATION.presets.map(p=>({...p,alpha:p.id==='Anterior'?-Math.PI/2:p.id==='Posterior'?Math.PI/2:p.alpha}))};
