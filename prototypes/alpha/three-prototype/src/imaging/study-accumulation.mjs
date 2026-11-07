import {Matrix4,Vector3} from 'three';
import {volumeTransform,validateVolume} from './h000-volume-core.mjs';
export function sourceKTransform(study){return new Matrix4().fromArray(volumeTransform(validateVolume(study))).invert()}
export function pointSourceK(point,inverse){return new Vector3(point.x,point.y,point.z).applyMatrix4(inverse).z*103+51}
export function allowsAccumulatedPoint(point,inverse,a){if(!a?.enabled)return true;const k=pointSourceK(point,inverse);return !a.empty&&k>=a.lower&&k<=a.upper}
