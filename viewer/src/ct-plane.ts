import {addToScene,createMeshFromData,createTexture2DFromPixels,updateTexture2DFromPixels,updateMeshGeometry,createPbrMaterial,setPbrUnlit,setParent,setSubtreeVisible,getMeshTriangles,getViewProjectionMatrix} from '@babylonjs/lite';
import {validateSpatial,planeModel,point} from './ct-spatial.mjs';
import {worldBounds,fitDistance} from './camera-fit.mjs';

export function prepareCtPlane({engine,scene,camera,canvas,sourceMeshes,studyWorld}:any,manifest:any) {
  let mesh:any=null,texture:any=null,matrices:any=null,k=0,shown=false;
  const normals=new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),indices=new Uint32Array([0,1,2,0,2,3]),uvs=new Float32Array([0,0,1,0,1,1,0,1]);
  const panel=document.querySelector('#ctControls')!;
  const label=document.createElement('label');label.innerHTML='<input id="ctPlaneVisible" type="checkbox"> Place acquired CT plane in 3D';panel.append(label);
  const fit=document.createElement('button');fit.id='ctPlaneFit';fit.textContent='Fit CT plane and lesion';fit.type='button';fit.disabled=true;panel.append(fit);
  const explanation=document.createElement('p');explanation.className='help-copy';explanation.textContent='Acquired plane, nearest pixels, opaque and two-sided. Pixel centers follow source coordinates; edges extend half a pixel. This is not a volume, segmentation or anatomical surface. Plane is excluded from lesion picking.';panel.append(explanation);
  const output=document.createElement('output');output.id='ctPlaneState';output.hidden=true;panel.append(output);
  if(new URLSearchParams(location.search).has('diagnostics')){
    const check=document.createElement('button');check.type='button';check.id='ctPlaneCheck';check.textContent='Verify plane GPU mapping';panel.append(check);
    const result=document.createElement('output');result.id='ctPlaneGpu';result.hidden=true;panel.append(result);
    check.onclick=async()=>{check.disabled=true;try{const frame=k;const values=await (await import('./ct-plane-check')).checkPlaneGpu(engine,texture,getMeshTriangles(mesh)!.positions,mesh.worldMatrix);result.textContent=JSON.stringify({k:frame,values});}catch(error){result.textContent=JSON.stringify({error:String(error)});}finally{check.disabled=false;}};
  }
  const checkbox=label.querySelector('input')!;
  const world=(p:number[],m:any)=>[0,1,2].map(d=>m[d]*p[0]+m[d+4]*p[1]+m[d+8]*p[2]+m[d+12]);
  function report(){if(!mesh)return;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!mesh)return;
    const triangles=getMeshTriangles(mesh),positions=Array.from(triangles!.positions),wm=Array.from(mesh.worldMatrix);
    const rect=canvas.getBoundingClientRect();
    output.textContent=JSON.stringify({k,shown,planeVisible:mesh.visible,modelCorners:planeModel(matrices,k),uploadedPositions:positions,worldMatrix:wm,sourceWorldMatrices:sourceMeshes.map((m:any)=>Array.from(m.worldMatrix)),worldCorners:[0,1,2,3].map(i=>world(positions.slice(i*3,i*3+3) as number[],wm)),patientCorners:planeModel(matrices,k).map((p:any)=>point(matrices.model_m_to_patient_mm,p)),uv:[0,0,1,0,1,1,0,1],textureBytes:1048576,geometryBytes:152,viewProjection:Array.from(getViewProjectionMatrix(camera,rect.width/rect.height)),canvas:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}});
  }));}
  checkbox.onchange=()=>{shown=checkbox.checked;if(mesh)setSubtreeVisible(mesh,shown);fit.disabled=!shown;report();};
  fit.onclick=()=>{const bounds=worldBounds([...sourceMeshes,mesh]),rect=canvas.getBoundingClientRect();if(bounds){for(const key of ['inertialAlphaOffset','inertialBetaOffset','inertialRadiusOffset','inertialPanningX','inertialPanningY'])camera[key]=0;camera.target.set(...bounds.center);camera.radius=fitDistance(bounds,camera.fov,rect.width/rect.height);camera.nearPlane=Math.max(bounds.radius*.001,1e-7);camera.farPlane=camera.radius*100;report();}};
  return {
    update(receipt:any,image:ImageData,frame:number){
      matrices=validateSpatial(receipt,manifest);k=frame;
      const positions=new Float32Array(planeModel(matrices,k).flat());
      const bytes=new Uint8Array(image.data.buffer,image.data.byteOffset,image.data.byteLength);
      if(!mesh){
        // Share the accepted world mapping without joining the lesion visibility subtree.
        // Public transform-provider getters preserve its root reflection and future updates.
        for(const source of sourceMeshes)if(source.position.x!==0||source.position.y!==0||source.position.z!==0||source.rotation.x!==0||source.rotation.y!==0||source.rotation.z!==0||source.scaling.x!==1||source.scaling.y!==1||source.scaling.z!==1||source.parent!==sourceMeshes[0].parent)throw Error('Unqualified lesion local transform');
        texture=createTexture2DFromPixels(engine,bytes,512,512,{minFilter:'nearest',magFilter:'nearest',srgb:true});
        const material=createPbrMaterial({baseColorTexture:texture,baseColorFactor:[1,1,1,1],doubleSided:true,metallicFactor:0,roughnessFactor:1});setPbrUnlit(material);
        mesh=createMeshFromData(engine,'presentation.acquired-ct-plane',positions,normals,indices,uvs);
        mesh.material=material;setParent(mesh,studyWorld||{get worldMatrix(){return sourceMeshes[0].worldMatrix;},get worldMatrixVersion(){return sourceMeshes[0].worldMatrixVersion;}} as any);
        mesh.position.set(0,0,0);mesh.rotationQuaternion.set(0,0,0,1);mesh.scaling.set(1,1,1);
        addToScene(scene,mesh);
      }else{updateMeshGeometry(engine,mesh,positions,normals,indices,uvs);updateTexture2DFromPixels(engine,texture,bytes);}
      setSubtreeVisible(mesh,shown);report();
    },
    clear(){shown=false;checkbox.checked=false;fit.disabled=true;if(mesh){setSubtreeVisible(mesh,false);updateTexture2DFromPixels(engine,texture,new Uint8Array(1048576));}output.textContent='';},
  };
}
