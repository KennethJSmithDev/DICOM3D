// Presentation-input projection only. Matrices use column-major column vectors.
const mul=(m,p)=>[0,1,2,3].map(r=>p.reduce((s,v,c)=>s+m[c*4+r]*v,0));
function inverse(m){
  const a=[0,1,2,3].map(r=>[...Array.from({length:4},(_,c)=>m[c*4+r]),...Array.from({length:4},(_,c)=>+(c===r))]);
  for(let c=0;c<4;c++){
    let p=c;for(let r=c+1;r<4;r++)if(Math.abs(a[r][c])>Math.abs(a[p][c]))p=r;
    if(Math.abs(a[p][c])<1e-14)throw Error('Singular presentation projection');
    [a[c],a[p]]=[a[p],a[c]];const d=a[c][c];a[c]=a[c].map(v=>v/d);
    for(let r=0;r<4;r++)if(r!==c){const d=a[r][c];a[r]=a[r].map((v,j)=>v-d*a[c][j]);}
  }
  return Array.from({length:16},(_,i)=>a[i%4][4+Math.floor(i/4)]);
}
export function screenDragDelta(vp,parent,anchor,dx,dy,width,height){
  if(!(width>0&&height>0)||![...vp,...parent,...anchor,dx,dy].every(Number.isFinite))throw Error('Invalid presentation drag');
  const clip=mul(vp,[...anchor,1]);if(Math.abs(clip[3])<1e-10)throw Error('Drag anchor at projection singularity');
  const ndc=clip.map(v=>v/clip[3]),inv=inverse(vp),parentInv=inverse(parent);
  const a=mul(inv,[ndc[0],ndc[1],ndc[2],1]),b=mul(inv,[ndc[0]+2*dx/width,ndc[1]-2*dy/height,ndc[2],1]);
  const world=a.slice(0,3).map((v,i)=>b[i]/b[3]-v/a[3]);
  return mul(parentInv,[...world,0]).slice(0,3);
}
