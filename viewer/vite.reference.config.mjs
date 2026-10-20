import {defineConfig} from 'vite';
import {PUBLIC_STUDY_ENABLED} from './src/public-release.mjs';
export default defineConfig(({mode})=>({base:'/dicom3d/',publicDir:mode==='safe-reference-demo'?false:'../reference/public',define:{'import.meta.env.DICOM3D_PUBLIC_STUDY':JSON.stringify(PUBLIC_STUDY_ENABLED)},build:{outDir:'../.reference-dist',rollupOptions:{input:'reference.html'}}}));
