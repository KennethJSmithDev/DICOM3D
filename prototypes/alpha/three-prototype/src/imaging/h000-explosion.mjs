// Derive an illustrative CT sampling region from the admitted H000 source SEG.
// These rectangular blocks are not segmented lung or anatomical compartments.
export function h000ExplosionLayout(study) {
  const counts = study?.binding?.frames;
  if (!Array.isArray(counts) || counts.length !== 103 || study?.mask?.length !== 103 * 512 * 512) return null;
  let peak = 0;
  for (let k = 1; k < counts.length; k++) if ((counts[k].nonzero_voxels || 0) > (counts[peak].nonzero_voxels || 0)) peak = k;
  if (!(counts[peak].nonzero_voxels > 0)) return null;
  let r0 = 512, r1 = -1, c0 = 512, c1 = -1;
  const start = peak * 512 * 512;
  for (let i = 0; i < 512 * 512; i++) if (study.mask[start + i]) {
    const r = Math.floor(i / 512), c = i % 512;
    r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
  }
  if (r1 < r0 || c1 < c0) return null;
  const row = Math.floor((r0 + r1) / 2), col = Math.floor((c0 + c1) / 2);
  const rows = [Math.max(0, row - 112), row, Math.min(512, row + 112)];
  const cols = [Math.max(0, col - 112), col, Math.min(512, col + 112)];
  const frames = Array.from({length: 12}, (_, i) => Math.max(0, Math.min(102, peak - 18 + i * 3)));
  const blocks = [];
  for (let layer = 0; layer < 2; layer++) for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    blocks.push({id: `sample-${layer}-${r}-${c}`, rows: [rows[r], rows[r + 1]], cols: [cols[c], cols[c + 1]],
      frames: frames.slice(layer * 6, layer * 6 + 6), direction: [c ? -1 : 1, layer ? 1 : -1, r ? 1 : -1]});
  }
  return {peak, center: [row, col], blocks};
}

export function h000SampleCorners(matrices, frame, rows, cols, point) {
  const convert = (row, col) => point(matrices.patient_mm_to_model_m,
    point(matrices.index_to_patient_mm, [frame, row - .5, col - .5]));
  return [convert(rows[0], cols[0]), convert(rows[0], cols[1]), convert(rows[1], cols[1]), convert(rows[1], cols[0])];
}
