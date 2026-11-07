/** Display-only coloring of the admitted source SEG mask; never changes mask values. */
export function paintSourceSeg(mask, offset, rgba, selected) {
  const color = selected ? [255, 185, 48, 160] : [0, 210, 255, 96];
  for (let i = 0; i < rgba.length / 4; i++) if (mask[offset + i]) rgba.set(color, i * 4);
}
