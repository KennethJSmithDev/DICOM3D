export const placentaAsset = {bytes:4918168, sha256:'972ced14fda2e34dbba62af285345c72d56ae28885be6b38398db2bff775587f'};

const labels = new Map([
  ['HRA:421', 'Whole placenta and cord'], ['HRA:422', 'Basal plate'],
  ['HRA:423', 'Chorionic plate'], ['HRA:424', 'Placental vessels'],
  ['HRA:425', 'Amnion'], ['HRA:426', 'Umbilical cord and vessels'],
  ['HRA:427', 'Umbilical cord'], ['HRA:428', 'Umbilical artery 1'],
  ['HRA:429', 'Umbilical artery 2'], ['HRA:430', 'Umbilical vein']
]);

export function inspectPlacenta(scene) {
  const nodes = new Map();
  scene.traverse(object => {
    const id = object.userData.sourceKey;
    if (!id && !object.isMesh) return;
    if (!labels.has(id) || nodes.has(id)) throw Error('Unexpected placenta source identity');
    nodes.set(id, object);
  });
  if (nodes.size !== labels.size) throw Error('Incomplete placenta reference');
  const parts = [...labels].map(([id, label]) => {
    const node = nodes.get(id);
    const members = [];
    node.traverse(child => { if (child.isMesh) members.push(child); });
    const expected = id === 'HRA:421' ? 8 : id === 'HRA:426' ? 4 : 1;
    if (members.length !== expected) throw Error('Invalid placenta source hierarchy');
    return {id, label, node, members};
  });
  return parts;
}

export function showPlacentaSelection(parts, selected, isolated) {
  const selectedPart = parts.find(part => part.id === selected);
  if (!selectedPart) throw Error('Unrecognized placenta component');
  for (const mesh of parts[0].members) {
    mesh.visible = !isolated || selectedPart.members.includes(mesh);
  }
  return selectedPart;
}
