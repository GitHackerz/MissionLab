/** Deterministic terrain and scatter generation. No randomness at render time. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);

export function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm(x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Radius inside which the ground is dead flat so every module sits at y = 0. */
const FLAT_RADIUS = 9.5;
const BLEND_RADIUS = 24;

export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const blend = smoothstep(FLAT_RADIUS, BLEND_RADIUS, r);
  if (blend === 0) return 0;
  const broad = (fbm(x * 0.045 + 7.3, z * 0.045 - 2.1, 4) - 0.35) * 5.2;
  const dunes = Math.sin(x * 0.21 + fbm(x * 0.08, z * 0.08, 2) * 6) * 0.22;
  const crater = Math.exp(-Math.pow((r - 52) / 7, 2)) * 2.4;
  return blend * (broad + dunes) + smoothstep(38, 56, r) * crater;
}

export interface Scatter {
  x: number;
  y: number;
  z: number;
  scale: [number, number, number];
  rotation: [number, number, number];
  tone: number;
}

/** Rocks keep clear of the colony pad. */
export function generateScatter(
  count: number,
  seed: number,
  minRadius: number,
  maxRadius: number,
  minScale: number,
  maxScale: number,
): Scatter[] {
  const rand = mulberry32(seed);
  const out: Scatter[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const r = minRadius + Math.pow(rand(), 0.7) * (maxRadius - minRadius);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const s = minScale + Math.pow(rand(), 2.2) * (maxScale - minScale);
    out.push({
      x,
      y: terrainHeight(x, z) + s * 0.18,
      z,
      scale: [s * (0.8 + rand() * 0.6), s * (0.5 + rand() * 0.5), s * (0.8 + rand() * 0.6)],
      rotation: [rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4],
      tone: rand(),
    });
  }
  return out;
}
