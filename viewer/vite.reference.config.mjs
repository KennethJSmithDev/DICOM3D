import {defineConfig} from 'vite';
export default defineConfig({base:'/dicom3d/',publicDir:'../reference/public',build:{outDir:'../.reference-dist',rollupOptions:{input:'reference.html'}}});
