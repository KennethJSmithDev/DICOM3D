// Compile-time registration. The module-absent build substitutes imaging-modules-none.mjs.
import {createImagingRegistry} from './imaging-module-registry.mjs';
import {classicCt} from './imaging-ct-classic.mjs';
export const moduleRegistry=createImagingRegistry([classicCt],{disabled:import.meta.env?.DICOM3D_CT_MODULE_DISABLED?['dicom.ct-classic']:[]});
