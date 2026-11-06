import {defineConfig} from 'vite';
import {publicBuildProfile} from './src/public-release.mjs';
export default defineConfig(({command,mode})=>{
  // build-demo owns this compile-time selection and overwrites inherited values.
  const profile=publicBuildProfile(process.env.DICOM3D_PUBLIC_BUILD_PROFILE);
  if(command==='build'&&mode!=='safe-reference-demo')throw Error('Build the reference workstation with scripts/build-demo.mjs');
  if(profile.studyEnabled&&mode!=='safe-reference-demo')throw Error('Curated study requires the guarded Safe Demo build');
  return {cacheDir:process.env.DICOM3D_BUILD_CACHE??'../.vite-cache',base:'/dicom3d/',publicDir:mode==='safe-reference-demo'?false:'../reference/public',
    define:{'import.meta.env.DICOM3D_PUBLIC_STUDY':JSON.stringify(profile.studyEnabled),'import.meta.env.DICOM3D_VERIFIED_VOLUME_IMPORT':true},
    build:{outDir:'../.reference-dist',rollupOptions:{input:'reference.html'}}};
});
