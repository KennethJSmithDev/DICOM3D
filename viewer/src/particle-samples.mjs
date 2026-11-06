// Presentation-only samples. Inputs are caller-owned copies, never edited.
export function createParticleSamples(parts, count = 8192, seed = 0xD1C03D) {
  if (!Number.isInteger(count) || count < 1 || count > 8192) throw Error('Particle capacity must be 1..8192');
  const triangles = [], cumulative = [];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let area = 0, vertexCount = 0, triangleCount = 0;
  for (const {positions, indices, world} of parts) {
    vertexCount += positions.length / 3; triangleCount += indices.length / 3;
    const at = (index) => {
      const a = positions[index * 3], b = positions[index * 3 + 1], c = positions[index * 3 + 2];
      return [0, 1, 2].map(k => world[k] * a + world[k + 4] * b + world[k + 8] * c + world[k + 12]);
    };
    for (let n = 0; n < indices.length; n += 3) {
      const a = at(indices[n]), b = at(indices[n + 1]), c = at(indices[n + 2]);
      for (const p of [a, b, c]) for (let k = 0; k < 3; k++) {min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]);}
      const u = b.map((v, k) => v - a[k]), v = c.map((v, k) => v - a[k]);
      const weight = Math.hypot(u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]) / 2;
      if (weight > 0) {area += weight; triangles.push([a, b, c]); cumulative.push(area);}
    }
  }
  if (!(area > 0)) throw Error('No nondegenerate source surface');
  const center = min.map((v, k) => (v + max[k]) / 2), size = max.map((v, k) => v - min[k]);
  let state = seed >>> 0;
  const random = () => {state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296;};
  const data = new Float32Array(count * 8);
  for (let i = 0; i < count; i++) {
    const pick = random() * area;
    let lo = 0, hi = cumulative.length - 1;
    while (lo < hi) {const mid = (lo + hi) >>> 1; if (cumulative[mid] < pick) lo = mid + 1; else hi = mid;}
    const [a,b,c] = triangles[lo], r = Math.sqrt(random()), t = random();
    for (let k = 0; k < 3; k++) data[i*8+k] = a[k]*(1-r)+b[k]*r*(1-t)+c[k]*r*t;
    data[i*8+3] = random();
    for (let k = 0; k < 3; k++) data[i*8+4+k] = center[k] + (random()-.5)*size[k];
    data[i*8+7] = random();
  }
  return {data, bounds:{min,max,center,size,radius:Math.hypot(...size)/2}, vertexCount, triangleCount, area};
}

export function byteFingerprint(arrays) {
  let hash = 2166136261;
  for (const array of arrays) for (const byte of new Uint8Array(array.buffer,array.byteOffset,array.byteLength)) hash = Math.imul(hash ^ byte,16777619);
  return (hash >>> 0).toString(16).padStart(8,'0');
}
