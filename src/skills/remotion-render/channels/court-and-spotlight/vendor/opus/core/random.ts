import {noise2D, noise3D} from '@remotion/noise';

/** deterministic PRNG so every render of a motion is identical */
export const rng = (seed: number | string) => {
  let a = typeof seed === 'string' ? [...seed].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0), 1779033703) : seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const range = (r: () => number, a: number, b: number) => a + (b - a) * r();
export const pick = <T,>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length) % arr.length];

/** n items with stable random fields */
export const scatter = <T,>(n: number, seed: number | string, make: (r: () => number, i: number) => T): T[] => {
  const r = rng(seed);
  return Array.from({length: n}, (_, i) => make(r, i));
};

export const n2 = (seed: string, x: number, y: number) => noise2D(seed, x, y);
export const n3 = (seed: string, x: number, y: number, z: number) => noise3D(seed, x, y, z);

/** fractal brownian motion, 0-centred, roughly -1..1 */
export const fbm = (seed: string, x: number, y: number, octaves = 4) => {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    v += amp * noise2D(seed + o, x * f, y * f);
    f *= 2;
    amp *= 0.5;
  }
  return v / (1 - Math.pow(0.5, octaves));
};

/** hand-drawn wobble offset for a point (pencil / ballpoint looks) */
export const wobble = (seed: string, i: number, t: number, amp = 1.5) => ({
  x: noise2D(seed + 'x', i * 0.37, t) * amp,
  y: noise2D(seed + 'y', i * 0.37, t) * amp,
});
