import { fileURLToPath } from 'node:url';
export default {
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/DICOM3D/',
  build: { outDir: '../.demo-dist', emptyOutDir: true },
};
