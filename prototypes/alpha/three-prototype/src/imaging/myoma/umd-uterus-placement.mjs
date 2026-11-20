import {Box3, Group, Matrix4, Vector3} from 'three';

const uterusId='VH_F_uterus';

function sourceBounds(scene,id){
  const object=scene.getObjectByName(id);
  if(!object)throw Error('Required HRA landmark unavailable');
  const box=new Box3().setFromObject(object,true);
  if(box.isEmpty())throw Error('Empty HRA landmark');
  return box;
}

export function placeUterusReference(scene,volume){
  scene.updateMatrixWorld(true);
  const center=id=>sourceBounds(scene,id).getCenter(new Vector3());
  if(center('VH_F_left_ovary').x<=center('VH_F_right_ovary').x ||
    center('VH_F_fundus_of_uterus').y<=center('VH_F_cervix').y ||
    center('VH_F_urinary_bladder').z<=center('VH_F_vagina').z)
    throw Error('Unexpected HRA pelvic basis');

  // Center only on actual uterine-wall voxels in MRI space. The MRI and the
  // reference each retain their own physical dimensions and never share labels.
  const wallBounds=new Box3(),point=new Vector3();
  const [nx,ny]=volume.dims,[bx,by,bz]=volume.bounds,m=volume.affineRasMm;
  let wallCount=0;
  for(let k=bz[0];k<=bz[1];k++)for(let j=by[0];j<=by[1];j++)for(let i=bx[0];i<=bx[1];i++){
    if(volume.labels[i+nx*(j+ny*k)]!==1)continue;
    const ras=row=>m[row][0]*i+m[row][1]*j+m[row][2]*k+m[row][3];
    wallBounds.expandByPoint(point.set(ras(0),ras(2),-ras(1)));
    wallCount++;
  }
  if(!wallCount || wallCount!==volume.byId.get(1)?.count)throw Error('Incomplete MRI uterine-wall bounds');
  const target=wallBounds.getCenter(new Vector3());
  const owner=scene.getObjectByName(uterusId);
  const sourceCenter=sourceBounds(scene,uterusId).getCenter(new Vector3());
  const group=new Group();
  // Source glTF is metres, +X left, +Y superior, +Z anterior. Display is R,S,-A in mm.
  group.matrixAutoUpdate=false;
  group.matrix.makeTranslation(target.x,target.y,target.z)
    .multiply(new Matrix4().makeScale(-1000,1000,-1000))
    .multiply(new Matrix4().makeTranslation(-sourceCenter.x,-sourceCenter.y,-sourceCenter.z));
  const specimen=owner.clone(true);
  specimen.matrixAutoUpdate=false;
  specimen.matrix.copy(owner.matrixWorld);
  specimen.traverse(node=>{node.raycast=()=>null;});
  group.add(specimen);
  group.updateMatrixWorld(true);
  return group;
}
