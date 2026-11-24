import {isVerifiedVolume} from '../../../viewer/src/verified-volume.mjs';

const ctStorage = '1.2.840.10008.5.1.4.1.1.2';
const minPoints = new Map([['POINT', 1], ['OPEN_PLANAR', 2], ['CLOSED_PLANAR', 3], ['CLOSEDPLANAR_XOR', 3]]);
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

export function bindRtContours(result, study) {
  if (result?.source.family !== 'RTSTRUCT' || !isVerifiedVolume(study)) return null;
  const content = result.content;
  if (!content.contours.some(group => group.items.some(item => item.coordinatesMm))) return null;
  const {source, shape, geometry, frames} = study.descriptor;
  if (source.modality !== 'CT' || content.studyIdentity !== source.studyIdentity) return null;
  const [, rows, columns] = shape;
  const [rowSpacing,colSpacing] = geometry.pixelSpacingRowColumnMm;
  const alongColumns = geometry.imageOrientationPatient.slice(0,3);
  const alongRows = geometry.imageOrientationPatient.slice(3,6);
  const normal = [
    alongColumns[1]*alongRows[2]-alongColumns[2]*alongRows[1],
    alongColumns[2]*alongRows[0]-alongColumns[0]*alongRows[2],
    alongColumns[0]*alongRows[1]-alongColumns[1]*alongRows[0],
  ];
  const bySop = new Map(frames.map(frame => [frame.sopIdentity,frame]));
  const regions = new Map(content.regions.map(region => [+region.ROINumber,region]));
  const byFrame = new Map();
  let count = 0;
  for (const group of content.contours) {
    if (!group.items.some(item => item.coordinatesMm)) continue;
    const region = regions.get(+group.fields.ReferencedROINumber);
    if (region.ReferencedFrameOfReferenceUID !== source.frameOfReferenceIdentity) return null;
    for (const item of group.items) {
      const {coordinatesMm:coords,fields,references} = item;
      const type = fields.ContourGeometricType;
      const minimum = minPoints.get(type);
      const refs = references.filter(ref => ref.sequence === 'ContourImageSequence');
      if (!coords || !minimum || coords.length/3 < minimum || (type === 'POINT' && coords.length !== 3) || refs.length !== 1) return null;
      const ref = refs[0].values;
      const frame = bySop.get(ref.ReferencedSOPInstanceUID);
      if (!frame || bySop.size !== frames.length || frame.sourceFrame !== 1 ||
          ref.ReferencedSOPClassUID !== ctStorage || (ref.ReferencedFrameNumber && ref.ReferencedFrameNumber !== '1')) return null;
      const points = [];
      for (let i=0;i<coords.length;i+=3) {
        const relative = frame.imagePositionPatient.map((value,axis) => coords[i+axis]-value);
        // Match the stated plane before projecting to the shared pixel grid.
        if (Math.abs(dot(relative,normal)) > .01) return null;
        const x = dot(relative,alongColumns)/colSpacing + .5;
        const y = dot(relative,alongRows)/rowSpacing + .5;
        if (x < 0 || x > columns || y < 0 || y > rows) return null;
        points.push([x,y]);
      }
      const contours = byFrame.get(frame.k) ?? [];
      contours.push({points, type, label:region.ROIName || region.ROINumber});
      byFrame.set(frame.k,contours);
      count++;
    }
  }
  return {byFrame,count};
}
