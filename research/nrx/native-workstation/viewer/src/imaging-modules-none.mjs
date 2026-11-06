// Independent configuration: no CT import, including when its implementation file is absent.
import {createImagingRegistry} from './imaging-module-registry.mjs';
export const moduleRegistry=createImagingRegistry([]);
