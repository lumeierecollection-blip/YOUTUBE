import React, {useEffect, useMemo, useState} from 'react';
import {Img, cancelRender, continueRender, delayRender} from 'remotion';
import {resolveSrc} from './asset';
import {fbm, rng} from './random';
import {useStage} from './stage';

/**
 * image-kit — shared plumbing for the image/ family.
 *
 *  - ProceduralPlate: a seeded, layered illustrated plate (dusk lake + skyline + pines) built from a small
 *    list of primitives. The same primitive list renders to an SVG data URL (so every effect can treat it
 *    exactly like a photo: <Img>, CSS filters, clipping, copies) AND evaluates analytically per pixel
 *    (`plateColorAt`) so dot / pixel effects can sample it without a canvas round-trip.
 *  - Plate: <Img> of either a public/ image (`src`) or the procedural plate, object-fit cover.
 *  - usePlatePixels / sampleGrid: low-res RGB buffer of the image (canvas getImageData once, memoised by
 *    src) for dot-matrix style effects.
 *  - SVG filter builders shared by duotone / pixel-dither / comic / xray.
 */

export type RGB = [number, number, number];

export const hexRgb = (s: string): RGB => {
  let v = s.replace('#', '').trim();
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  const n = parseInt(v.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbStr = (c: RGB, a = 1) =>
  a >= 1 ? `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})` : `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
export const mixRgb = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mixHex = (a: string, b: string, t: number) => rgbStr(mixRgb(hexRgb(a), hexRgb(b), t));
/** Rec.709 luma 0..1 from 0..255 rgb */
export const luma = (c: RGB | Float32Array, i = 0) => (0.2126 * c[i] + 0.7152 * c[i + 1] + 0.0722 * c[i + 2]) / 255;

/** public/ path, absolute URL or data: URL -> loadable URL (see ./asset) */
export {resolveSrc};

// ---------------------------------------------------------------------------------------------------------
// Procedural plate
// ---------------------------------------------------------------------------------------------------------

export type PlatePaletteName = 'dusk' | 'night' | 'dawn';

type PlatePalette = {
  sky: [number, string][];
  sun: string;
  sunGlow: string;
  horizonGlow: string;
  cloud: [string, string];
  far: string;
  mid: string;
  city: string;
  windows: string[];
  lit: number;
  water: string;
  waterAlpha: number;
  glint: string;
  fg: string;
  stars: number;
  moon: boolean;
};

export const PLATE_PALETTES: Record<PlatePaletteName, PlatePalette> = {
  dusk: {
    sky: [
      [0, '#1a1540'],
      [0.32, '#47306f'],
      [0.6, '#b3496c'],
      [0.82, '#ee7d56'],
      [1, '#ffc978'],
    ],
    sun: '#fff3cf',
    sunGlow: '#ffb067',
    horizonGlow: '#ff9455',
    cloud: ['#8e4f88', '#ffa27a'],
    far: '#7b4e84',
    mid: '#4d2f62',
    city: '#24183e',
    windows: ['#ffd27a', '#ffb45e', '#fff0bd'],
    lit: 0.26,
    water: '#1d1337',
    waterAlpha: 0.42,
    glint: '#ffd49a',
    fg: '#0f0a1d',
    stars: 70,
    moon: false,
  },
  night: {
    sky: [
      [0, '#03050f'],
      [0.4, '#0b1633'],
      [0.75, '#1d2f5a'],
      [1, '#3a5287'],
    ],
    sun: '#eef3ff',
    sunGlow: '#7f9fe6',
    horizonGlow: '#4e6db0',
    cloud: ['#1c2748', '#4a5c8c'],
    far: '#1f2c4f',
    mid: '#16203d',
    city: '#0c1227',
    windows: ['#ffd27a', '#ffc35e', '#cfe3ff'],
    lit: 0.42,
    water: '#04070f',
    waterAlpha: 0.5,
    glint: '#cfe0ff',
    fg: '#03050b',
    stars: 220,
    moon: true,
  },
  dawn: {
    sky: [
      [0, '#2c3a68'],
      [0.35, '#5f6f9f'],
      [0.65, '#e3a6a2'],
      [0.85, '#ffd6a6'],
      [1, '#fff1d2'],
    ],
    sun: '#fffbea',
    sunGlow: '#ffd9a0',
    horizonGlow: '#ffc690',
    cloud: ['#8a8fbf', '#ffd0b8'],
    far: '#8f90b8',
    mid: '#666c99',
    city: '#3e4068',
    windows: ['#ffe2a0', '#fff3d0'],
    lit: 0.1,
    water: '#2d3554',
    waterAlpha: 0.38,
    glint: '#fff4dc',
    fg: '#1d2141',
    stars: 0,
    moon: false,
  },
};

type Prim =
  | {k: 'vgrad'; y0: number; y1: number; stops: [number, RGB][]}
  | {k: 'glow'; x: number; y: number; rx: number; ry: number; c: RGB; a: number}
  | {k: 'ell'; x: number; y: number; rx: number; ry: number; c: RGB; a: number; line?: boolean}
  | {k: 'ridge'; x0: number; dx: number; ys: number[]; yb: number; c: RGB; hatch?: boolean}
  | {k: 'rect'; x: number; y: number; w: number; h: number; c: RGB; a: number; kids?: Prim[]; line?: boolean}
  | {k: 'mirror'; axis: number; bottom: number; prims: Prim[]; tint: RGB; a: number};

export type PlateScene = {
  W: number;
  H: number;
  u: number;
  horizon: number;
  /** main light (sun / moon) in plate px */
  sun: {x: number; y: number; r: number};
  /** brightest window clusters etc. (for flares) */
  prims: Prim[];
  palette: PlatePaletteName;
  seed: number;
};

const ridgeAt = (p: {x0: number; dx: number; ys: number[]}, x: number) => {
  const f = (x - p.x0) / p.dx;
  const i = Math.floor(f);
  if (i < 0) return p.ys[0];
  if (i >= p.ys.length - 1) return p.ys[p.ys.length - 1];
  const t = f - i;
  return p.ys[i] + (p.ys[i + 1] - p.ys[i]) * t;
};

export type PlateOpts = {
  seed?: number;
  palette?: PlatePaletteName;
  /** px per 1080-short-side unit of the FRAME (plates larger than the frame keep detail sizes) */
  unit?: number;
  /** horizon as a fraction of plate height */
  horizon?: number;
  /** tall plate (for tilt reveals): adds a high night sky with moon and stars above the dusk band */
  tall?: boolean;
};

const sceneCache = new Map<string, PlateScene>();

/** Build (memoised) the primitive list for a W x H plate. */
export const buildPlate = (W: number, H: number, opts: PlateOpts = {}): PlateScene => {
  const seed = opts.seed ?? 1;
  const palName = opts.palette ?? 'dusk';
  const u = opts.unit ?? Math.min(W, H) / 1080;
  const tall = !!opts.tall;
  const hzF = opts.horizon ?? (tall ? 0.84 : W >= H ? 0.64 : 0.6);
  const key = [W, H, seed, palName, u.toFixed(4), hzF, tall].join('|');
  const hit = sceneCache.get(key);
  if (hit) return hit;

  const P = PLATE_PALETTES[palName];
  const r = rng(seed * 7919 + 17);
  const hz = H * hzF;
  const S = String(seed);
  const above: Prim[] = [];

  // sky
  let stops: [number, RGB][] = P.sky.map(([t, c]) => [t, hexRgb(c)]);
  if (tall) {
    // night zenith above the evening band; the tilt travels through it
    const night: [number, RGB][] = [
      [0, hexRgb('#04051a')],
      [0.25, hexRgb('#0c1240')],
    ];
    stops = [...night, ...stops.map(([t, c]) => [0.42 + t * 0.58, c] as [number, RGB])];
  }
  above.push({k: 'vgrad', y0: 0, y1: hz, stops});

  // stars
  const starArea = tall ? hz * 0.75 : hz * 0.55;
  const nStars = Math.round((P.stars + (tall ? 160 : 0)) * (W * starArea) / (1920 * 600));
  for (let i = 0; i < nStars; i++) {
    const y = Math.pow(r(), 1.3) * starArea;
    const a = (0.25 + 0.7 * r()) * Math.max(0, 1 - y / starArea);
    above.push({k: 'ell', x: r() * W, y, rx: (0.9 + 1.5 * r()) * u, ry: (0.9 + 1.5 * r()) * u, c: hexRgb('#fff6e8'), a});
  }

  // moon for tall plates / night palette
  const moonOn = P.moon || tall;
  if (moonOn) {
    const mx = W * (tall ? 0.3 : 0.24);
    const my = tall ? H * 0.12 : hz * 0.22;
    above.push({k: 'glow', x: mx, y: my, rx: 260 * u, ry: 260 * u, c: hexRgb('#a9c0ff'), a: 0.35});
    above.push({k: 'ell', x: mx, y: my, rx: 34 * u, ry: 34 * u, c: hexRgb('#f2f5ff'), a: 1});
    above.push({k: 'ell', x: mx + 9 * u, y: my - 6 * u, rx: 8 * u, ry: 7 * u, c: hexRgb('#d6deef'), a: 0.6});
    above.push({k: 'ell', x: mx - 12 * u, y: my + 9 * u, rx: 6 * u, ry: 5 * u, c: hexRgb('#d6deef'), a: 0.5});
  }

  // sun (the night palette treats it as a low moon-glow over the city)
  const sun = {x: W * 0.64, y: hz - 92 * u, r: 76 * u};
  above.push({k: 'glow', x: sun.x, y: hz, rx: W * 0.95, ry: 190 * u, c: hexRgb(P.horizonGlow), a: 0.55});
  above.push({k: 'glow', x: sun.x, y: sun.y, rx: 600 * u, ry: 560 * u, c: hexRgb(P.sunGlow), a: palName === 'night' ? 0.35 : 0.62});
  if (palName !== 'night') {
    above.push({k: 'glow', x: sun.x, y: sun.y, rx: 170 * u, ry: 170 * u, c: hexRgb(P.sun), a: 0.75});
    above.push({k: 'ell', x: sun.x, y: sun.y, rx: sun.r, ry: sun.r, c: hexRgb(P.sun), a: 1});
  }

  // clouds: long lit streaks, lower = warmer
  const nClouds = Math.max(6, Math.round(9 * W / 1920));
  for (let i = 0; i < nClouds; i++) {
    const cy = hz * (0.16 + 0.62 * r());
    const cx = W * (-0.05 + 1.1 * r());
    const rx = (150 + 320 * r()) * u;
    const ry = (7 + 15 * r()) * u;
    const t = Math.min(1, Math.max(0, cy / hz - 0.1) * 1.3);
    const c = mixRgb(hexRgb(P.cloud[0]), hexRgb(P.cloud[1]), t);
    const a = 0.32 + 0.4 * r();
    above.push({k: 'ell', x: cx, y: cy, rx, ry, c, a});
    above.push({k: 'ell', x: cx + rx * (0.2 + 0.3 * r()), y: cy - ry * 0.8, rx: rx * 0.55, ry: ry * 0.9, c: mixRgb(c, hexRgb(P.sun), 0.25), a: a * 0.8});
    if (r() > 0.4) above.push({k: 'ell', x: cx - rx * 0.4, y: cy + ry * 0.7, rx: rx * 0.45, ry: ry * 0.7, c, a: a * 0.7});
  }

  // far + mid mountain ridges (lower around the sun so it stays visible)
  const ridge = (name: string, amp: number, freq: number, base: number, color: string, step: number): Prim => {
    const n = Math.ceil(W / step) + 2;
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = i * step;
      const dip = 1 - 0.55 * Math.exp(-Math.pow((x - sun.x) / (0.2 * W + 120 * u), 2));
      const v = 0.5 + 0.5 * fbm(S + name, (x / (1080 * u)) * freq, 0.37, 4);
      ys.push(base - amp * (0.18 + 0.82 * v) * dip);
    }
    return {k: 'ridge', x0: 0, dx: step, ys, yb: hz + 2 * u, c: hexRgb(color), hatch: true};
  };
  above.push(ridge('far', 250 * u, 1.6, hz, P.far, 6 * u));
  // haze band between ridges
  above.push({k: 'glow', x: W * 0.5, y: hz, rx: W * 0.8, ry: 70 * u, c: hexRgb(P.horizonGlow), a: 0.3});
  above.push(ridge('mid', 120 * u, 3.1, hz, P.mid, 5 * u));

  // city skyline on the far shore, with lit windows
  const cityC = hexRgb(P.city);
  const winC = P.windows.map(hexRgb);
  let x = -10 * u;
  const dt1 = W * 0.36;
  const dt2 = W * 0.82;
  while (x < W + 10 * u) {
    const bw = (22 + 48 * r()) * u;
    const prof = 0.25 + 0.75 * Math.max(Math.exp(-Math.pow((x - dt1) / (0.16 * W + 80 * u), 2)), 0.7 * Math.exp(-Math.pow((x - dt2) / (0.1 * W + 60 * u), 2)));
    const bh = (24 + 190 * Math.pow(r(), 1.4) * prof) * u;
    if (r() > 0.07) {
      const by = hz + 2 * u - bh;
      const kids: Prim[] = [];
      const cols = Math.floor((bw - 6 * u) / (9 * u));
      const rows = Math.floor((bh - 10 * u) / (13 * u));
      const ox = x + (bw - cols * 9 * u) / 2 + 2.5 * u;
      for (let cy = 0; cy < rows; cy++)
        for (let cx = 0; cx < cols; cx++) {
          if (r() < P.lit) kids.push({k: 'rect', x: ox + cx * 9 * u, y: by + 7 * u + cy * 13 * u, w: 4 * u, h: 6 * u, c: winC[Math.floor(r() * winC.length) % winC.length], a: 0.75 + 0.25 * r()});
        }
      above.push({k: 'rect', x, y: by, w: bw, h: bh, c: mixRgb(cityC, hexRgb(P.mid), 0.15 * r()), a: 1, kids});
      if (bh > 140 * u && r() > 0.4) above.push({k: 'rect', x: x + bw * 0.5 - 1.5 * u, y: by - (14 + 26 * r()) * u, w: 3 * u, h: 40 * u, c: cityC, a: 1});
    }
    x += bw + (r() < 0.25 ? (4 + 30 * r()) * u : 0);
  }
  above.push({k: 'rect', x: 0, y: hz - 1 * u, w: W, h: 5 * u, c: mixRgb(cityC, [0, 0, 0], 0.3), a: 1});

  // everything above the waterline, drawn once and reflected below it (tinted)
  const prims: Prim[] = [{k: 'mirror', axis: hz + 3 * u, bottom: H, prims: above, tint: hexRgb(P.water), a: P.waterAlpha}];
  const glintC = hexRgb(P.glint);
  const depth = H - hz;
  for (let i = 0; i < 90; i++) {
    const t = Math.pow(r(), 1.5);
    const y = hz + 6 * u + t * depth;
    const spread = 30 * u + t * depth * 0.55;
    const gx = sun.x + (r() - 0.5) * 2 * spread * (0.4 + 0.6 * r());
    prims.push({k: 'rect', x: gx, y, w: (14 + 120 * r()) * u * (0.35 + t), h: (1.2 + 2.2 * r() * (0.5 + t)) * u, c: glintC, a: (0.25 + 0.55 * r()) * (1 - 0.55 * t)});
  }
  for (let i = 0; i < 70; i++) {
    const t = Math.pow(r(), 1.2);
    const y = hz + 8 * u + t * depth;
    prims.push({k: 'rect', x: r() * W - 60 * u, y, w: (40 + 220 * r()) * u * (0.4 + t), h: (1 + 2 * r()) * u * (0.6 + t), c: r() > 0.5 ? hexRgb(P.water) : mixRgb(hexRgb(P.horizonGlow), glintC, 0.4), a: 0.12 + 0.22 * r()});
  }

  // foreground: shore + pine clusters (left big, right small)
  const fgC = hexRgb(P.fg);
  const step = 3 * u;
  const n = Math.ceil(W / step) + 2;
  const trees: {x: number; h: number; w: number}[] = [];
  // portrait plates get a bigger foreground so the lower half is not empty water
  const fs = tall ? 1.2 : Math.max(1, Math.min(1.9, (H / W) * 1.05));
  const addCluster = (x0: number, x1: number, count: number, hMin: number, hMax: number) => {
    for (let i = 0; i < count; i++) {
      const th = (hMin + (hMax - hMin) * Math.pow(r(), 0.8)) * u * fs;
      trees.push({x: x0 + (x1 - x0) * r(), h: th, w: th * (0.44 + 0.14 * r())});
    }
  };
  addCluster(-0.04 * W, (0.24 + 0.08 * (fs - 1)) * W, Math.max(5, Math.round(8 * W / 1920)), 120, 340);
  addCluster(0.86 * W, 1.04 * W, Math.max(3, Math.round(4 * W / 1920)), 80, 220);
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const px = i * step;
    // shore: low bank rising toward the tree clusters
    const bank = Math.max(Math.exp(-Math.pow((px + 0.02 * W) / (0.3 * W), 2)), 0.8 * Math.exp(-Math.pow((px - 1.02 * W) / (0.2 * W), 2)));
    const ground = H - (34 + 50 * bank * fs + 16 * (0.5 + 0.5 * fbm(S + 'gr', px / (220 * u), 2.1, 3))) * u;
    let top = ground;
    for (const t of trees) {
      const dx = Math.abs(px - t.x);
      const half = t.w / 2;
      if (dx > half) continue;
      const q = dx / half;
      const yy = ground + 10 * u - t.h + t.h * 0.93 * q + t.h * 0.075 * ((q * 6) % 1) - t.h * 0.04;
      top = Math.min(top, yy);
    }
    ys.push(top);
  }
  prims.push({k: 'ridge', x0: 0, dx: step, ys, yb: H + 2, c: fgC});

  const scene: PlateScene = {W, H, u, horizon: hz, sun, prims, palette: palName, seed};
  sceneCache.set(key, scene);
  return scene;
};

// ---- analytic colour lookup --------------------------------------------------------------------------

const evalPrims = (prims: Prim[], x: number, y: number, c: RGB): RGB => {
  for (const p of prims) {
    switch (p.k) {
      case 'vgrad': {
        if (y < p.y0 - 1 || y > p.y1 + 1) {
          if (y > p.y1) c = [...p.stops[p.stops.length - 1][1]] as RGB;
          break;
        }
        const t = Math.min(1, Math.max(0, (y - p.y0) / (p.y1 - p.y0)));
        let j = 0;
        while (j < p.stops.length - 2 && t > p.stops[j + 1][0]) j++;
        const [t0, c0] = p.stops[j];
        const [t1, c1] = p.stops[j + 1];
        c = mixRgb(c0, c1, Math.min(1, Math.max(0, (t - t0) / Math.max(1e-6, t1 - t0))));
        break;
      }
      case 'glow': {
        const dx = (x - p.x) / p.rx;
        const dy = (y - p.y) / p.ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) c = mixRgb(c, p.c, p.a * (1 - d) * (1 - d));
        break;
      }
      case 'ell': {
        const dx = (x - p.x) / p.rx;
        const dy = (y - p.y) / p.ry;
        if (dx * dx + dy * dy <= 1) c = mixRgb(c, p.c, p.a);
        break;
      }
      case 'ridge': {
        if (y > p.yb) break;
        if (y >= ridgeAt(p, x)) c = p.c;
        break;
      }
      case 'rect': {
        if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
          c = mixRgb(c, p.c, p.a);
          if (p.kids) c = evalPrims(p.kids, x, y, c);
        }
        break;
      }
      case 'mirror': {
        if (y <= p.axis) c = evalPrims(p.prims, x, y, c);
        else if (y <= p.bottom) c = mixRgb(evalPrims(p.prims, x, 2 * p.axis - y, [0, 0, 0]), p.tint, p.a);
        break;
      }
    }
  }
  return c;
};

/** colour (0..255 RGB) of the procedural plate at plate pixel (x, y) */
export const plateColorAt = (scene: PlateScene, x: number, y: number): RGB => evalPrims(scene.prims, x, y, [0, 0, 0]);

// ---- SVG serialisation ---------------------------------------------------------------------------------

const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

type SvgMode = 'color' | 'lines';
type SvgCtx = {mode: SvgMode; defs: string[]; id: number; stroke: string; u: number};

const glowStops = (c: RGB, a: number) =>
  [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => `<stop offset="${t}" stop-color="${rgbStr(c)}" stop-opacity="${(a * (1 - t) * (1 - t)).toFixed(3)}"/>`).join('');

const ridgePath = (p: {x0: number; dx: number; ys: number[]; yb: number}, closed: boolean) => {
  let d = `M${f1(p.x0)} ${f1(p.ys[0])}`;
  for (let i = 1; i < p.ys.length; i++) d += `L${f1(p.x0 + i * p.dx)} ${f1(p.ys[i])}`;
  if (closed) d += `L${f1(p.x0 + (p.ys.length - 1) * p.dx)} ${f1(p.yb)}L${f1(p.x0)} ${f1(p.yb)}Z`;
  return d;
};

const primsSvg = (prims: Prim[], ctx: SvgCtx): string => {
  const L = ctx.mode === 'lines';
  const s = ctx.stroke;
  const u = ctx.u;
  // doubled strokes fake a glow without filters
  const glowLine = (attrs: string, w: number, op = 1) =>
    `<path ${attrs} fill="none" stroke="${s}" stroke-width="${f1(w * 4.5)}" stroke-opacity="${(0.16 * op).toFixed(3)}" stroke-linejoin="round"/>` +
    `<path ${attrs} fill="none" stroke="${s}" stroke-width="${f1(w)}" stroke-opacity="${(0.9 * op).toFixed(3)}" stroke-linejoin="round"/>`;
  let out = '';
  for (const p of prims) {
    switch (p.k) {
      case 'vgrad': {
        if (L) break;
        const id = `g${ctx.id++}`;
        ctx.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(p.y0)}" x2="0" y2="${f1(p.y1)}">${p.stops.map(([t, c]) => `<stop offset="${t}" stop-color="${rgbStr(c)}"/>`).join('')}</linearGradient>`);
        out += `<rect x="-2" y="${f1(p.y0 - 2)}" width="100%" height="${f1(p.y1 - p.y0 + 4)}" fill="url(#${id})"/>`;
        break;
      }
      case 'glow': {
        if (L) {
          if (p.rx < 400 * u && p.rx === p.ry) {
            // construction circles around light sources
            out += glowLine(`d="M${f1(p.x - p.rx * 0.6)} ${f1(p.y)}a${f1(p.rx * 0.6)} ${f1(p.rx * 0.6)} 0 1 0 ${f1(p.rx * 1.2)} 0a${f1(p.rx * 0.6)} ${f1(p.rx * 0.6)} 0 1 0 ${f1(-p.rx * 1.2)} 0" stroke-dasharray="${f1(6 * u)} ${f1(8 * u)}"`, 1.2 * u, 0.5);
            out += glowLine(`d="M${f1(p.x - p.rx)} ${f1(p.y)}H${f1(p.x + p.rx)}M${f1(p.x)} ${f1(p.y - p.rx)}V${f1(p.y + p.rx)}"`, 1 * u, 0.35);
          }
          break;
        }
        const id = `g${ctx.id++}`;
        ctx.defs.push(`<radialGradient id="${id}">${glowStops(p.c, p.a)}</radialGradient>`);
        out += `<ellipse cx="${f1(p.x)}" cy="${f1(p.y)}" rx="${f1(p.rx)}" ry="${f1(p.ry)}" fill="url(#${id})"/>`;
        break;
      }
      case 'ell': {
        if (L) {
          if (p.rx < 3 * u) out += `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(p.rx * 0.8)}" fill="${s}" fill-opacity="${(p.a * 0.8).toFixed(2)}"/>`;
          else out += glowLine(`d="M${f1(p.x - p.rx)} ${f1(p.y)}a${f1(p.rx)} ${f1(p.ry)} 0 1 0 ${f1(p.rx * 2)} 0a${f1(p.rx)} ${f1(p.ry)} 0 1 0 ${f1(-p.rx * 2)} 0"`, 1.4 * u, Math.min(1, p.a + 0.3));
          break;
        }
        out += `<ellipse cx="${f1(p.x)}" cy="${f1(p.y)}" rx="${f1(p.rx)}" ry="${f1(p.ry)}" fill="${rgbStr(p.c)}"${p.a < 1 ? ` fill-opacity="${p.a.toFixed(3)}"` : ''}/>`;
        break;
      }
      case 'ridge': {
        if (L) {
          const id = `c${ctx.id++}`;
          if (p.hatch) {
            ctx.defs.push(`<clipPath id="${id}"><path d="${ridgePath(p, true)}"/></clipPath>`);
            const minY = Math.min(...p.ys);
            const sp = 9 * u;
            let hd = '';
            const x1 = p.x0 + (p.ys.length - 1) * p.dx;
            for (let k = p.x0 - (p.yb - minY); k < x1; k += sp) hd += `M${f1(k)} ${f1(p.yb)}L${f1(k + (p.yb - minY))} ${f1(minY)}`;
            out += `<g clip-path="url(#${id})"><path d="${hd}" stroke="${s}" stroke-width="${f1(1 * u)}" stroke-opacity="0.28"/></g>`;
          }
          out += glowLine(`d="${ridgePath(p, false)}"`, 2.4 * u);
          break;
        }
        out += `<path d="${ridgePath(p, true)}" fill="${rgbStr(p.c)}"/>`;
        break;
      }
      case 'rect': {
        if (L) {
          const big = p.w > 12 * u && p.h > 12 * u;
          if (big) {
            out += glowLine(`d="M${f1(p.x)} ${f1(p.y)}h${f1(p.w)}v${f1(p.h)}h${f1(-p.w)}Z"`, 2 * u);
            if (p.kids) out += primsSvg(p.kids, ctx);
          } else if (p.h < 4 * u && p.w > 10 * u) {
            out += `<rect x="${f1(p.x)}" y="${f1(p.y)}" width="${f1(p.w)}" height="${f1(Math.max(1 * u, p.h * 0.5))}" fill="${s}" fill-opacity="${(p.a * 0.6).toFixed(2)}"/>`;
          } else {
            out += `<rect x="${f1(p.x)}" y="${f1(p.y)}" width="${f1(p.w)}" height="${f1(p.h)}" fill="none" stroke="${s}" stroke-width="${f1(0.8 * u)}" stroke-opacity="0.75"/>`;
          }
          break;
        }
        out += `<rect x="${f1(p.x)}" y="${f1(p.y)}" width="${f1(p.w)}" height="${f1(p.h)}" fill="${rgbStr(p.c)}"${p.a < 1 ? ` fill-opacity="${p.a.toFixed(3)}"` : ''}/>`;
        if (p.kids) out += primsSvg(p.kids, ctx);
        break;
      }
      case 'mirror': {
        const id = `m${ctx.id++}`;
        const cid = `c${ctx.id++}`;
        ctx.defs.push(`<g id="${id}">${primsSvg(p.prims, ctx)}</g>`);
        ctx.defs.push(`<clipPath id="${cid}"><rect x="-2" y="${f1(p.axis)}" width="100%" height="${f1(p.bottom - p.axis + 2)}"/></clipPath>`);
        out += `<use href="#${id}"/>`;
        if (L) {
          out += `<g clip-path="url(#${cid})" opacity="0.3"><use href="#${id}" transform="matrix(1 0 0 -1 0 ${f1(2 * p.axis)})"/></g>`;
          out += glowLine(`d="M0 ${f1(p.axis)}H${f1(4000 * u)}"`, 1.6 * u);
        } else {
          out += `<g clip-path="url(#${cid})"><use href="#${id}" transform="matrix(1 0 0 -1 0 ${f1(2 * p.axis)})"/><rect x="-2" y="${f1(p.axis)}" width="100%" height="${f1(p.bottom - p.axis + 2)}" fill="${rgbStr(p.tint)}" fill-opacity="${p.a}"/></g>`;
        }
        break;
      }
    }
  }
  return out;
};

const urlCache = new Map<string, string>();

/** SVG markup of the plate. mode 'lines' = blueprint / x-ray line art (navy ground, glowing strokes). */
export const plateSvg = (scene: PlateScene, mode: SvgMode = 'color', stroke = '#D8DAF5', ground = '#070818') => {
  const ctx: SvgCtx = {mode, defs: [], id: 0, stroke, u: scene.u};
  let body = primsSvg(scene.prims, ctx);
  if (mode === 'lines') {
    // blueprint ground + faint construction grid
    const g = 60 * scene.u;
    let grid = '';
    for (let x = g; x < scene.W; x += g) grid += `M${f1(x)} 0V${f1(scene.H)}`;
    for (let y = g; y < scene.H; y += g) grid += `M0 ${f1(y)}H${f1(scene.W)}`;
    body = `<rect width="100%" height="100%" fill="${ground}"/><path d="${grid}" stroke="${stroke}" stroke-opacity="0.07" stroke-width="${f1(scene.u)}"/>` + body;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(scene.W)}" height="${Math.round(scene.H)}" viewBox="0 0 ${f1(scene.W)} ${f1(scene.H)}"><defs>${ctx.defs.join('')}</defs>${body}</svg>`;
};

export const plateUrl = (scene: PlateScene, mode: SvgMode = 'color', stroke = '#D8DAF5', ground = '#070818') => {
  const key = `${scene.W}|${scene.H}|${scene.seed}|${scene.palette}|${scene.u}|${scene.horizon}|${mode}|${stroke}|${ground}`;
  let url = urlCache.get(key);
  if (!url) {
    url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(plateSvg(scene, mode, stroke, ground));
    urlCache.set(key, url);
  }
  return url;
};

// ---------------------------------------------------------------------------------------------------------
// <Plate>: the image layer every effect works on
// ---------------------------------------------------------------------------------------------------------

export type PlateSourceProps = {
  /** public/ path (e.g. "demo/owl.jpg"); empty = procedural plate */
  src?: string;
  seed?: number;
  palette?: PlatePaletteName;
};

/** Frame-sized procedural scene for the current composition (memoised). */
export const useFramePlate = (seed = 1, palette: PlatePaletteName = 'dusk') => {
  const {w, h, u} = useStage();
  return useMemo(() => buildPlate(w, h, {seed, palette, unit: u}), [w, h, u, seed, palette]);
};

/**
 * Full-frame image layer: `src` (cover-fitted) or the procedural plate.
 * Size defaults to the frame; pass width/height for over-scan plates.
 */
export const Plate: React.FC<
  PlateSourceProps & {
    width?: number;
    height?: number;
    mode?: SvgMode;
    stroke?: string;
    ground?: string;
    /** procedural only: tall plate with a night sky above (for tilt reveals) */
    tall?: boolean;
    objectPosition?: string;
    style?: React.CSSProperties;
    imgStyle?: React.CSSProperties;
  }
> = ({src, seed = 1, palette = 'dusk', width, height, mode = 'color', stroke, ground, tall, objectPosition = '50% 50%', style, imgStyle}) => {
  const {w, h, u} = useStage();
  const W = width ?? w;
  const H = height ?? h;
  const url = useMemo(() => {
    if (src) return resolveSrc(src);
    const scene = buildPlate(Math.round(W), Math.round(H), {seed, palette, unit: u, tall});
    return plateUrl(scene, mode, stroke, ground);
  }, [src, W, H, seed, palette, u, mode, stroke, ground, tall]);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, overflow: 'hidden', ...style}}>
      <Img src={url} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition, display: 'block', ...imgStyle}} />
    </div>
  );
};

// ---------------------------------------------------------------------------------------------------------
// Pixel sampling (dot-matrix family)
// ---------------------------------------------------------------------------------------------------------

export type Pixels = {w: number; h: number; data: Uint8ClampedArray};

const pixelCache = new Map<string, Pixels>();
const pixelPending = new Map<string, Promise<Pixels>>();

const loadImagePixels = (url: string, bw: number, bh: number): Promise<Pixels> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = bw;
      c.height = bh;
      const g = c.getContext('2d', {willReadFrequently: true});
      if (!g) return reject(new Error('no 2d context'));
      // cover fit
      const s = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
      const d = g.getImageData(0, 0, bw, bh);
      resolve({w: bw, h: bh, data: d.data});
    };
    img.onerror = () => reject(new Error('could not load image ' + url));
    img.src = url;
  });

const proceduralPixels = (scene: PlateScene, bw: number, bh: number): Pixels => {
  const data = new Uint8ClampedArray(bw * bh * 4);
  const sx = scene.W / bw;
  const sy = scene.H / bh;
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const c = plateColorAt(scene, (x + 0.5) * sx, (y + 0.5) * sy);
      const i = (y * bw + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  return {w: bw, h: bh, data};
};

/**
 * RGBA buffer (long side `res` px) of `src` cover-fitted to the frame aspect, or of the procedural plate.
 * Images are read once via an offscreen canvas (delayRender until ready) and memoised by src.
 */
export const usePlatePixels = ({src, seed = 1, palette = 'dusk'}: PlateSourceProps, res = 480): Pixels | null => {
  const {w, h, u} = useStage();
  const bw = w >= h ? res : Math.round((res * w) / h);
  const bh = w >= h ? Math.round((res * h) / w) : res;
  const key = src ? `img|${src}|${bw}x${bh}` : `proc|${seed}|${palette}|${w}x${h}|${bw}x${bh}`;
  const procedural = useMemo(() => {
    if (src) return null;
    const hit = pixelCache.get(key);
    if (hit) return hit;
    const px = proceduralPixels(buildPlate(w, h, {seed, palette, unit: u}), bw, bh);
    pixelCache.set(key, px);
    return px;
  }, [key, src, seed, palette, w, h, u, bw, bh]);
  const [loaded, setLoaded] = useState<Pixels | null>(() => (src ? pixelCache.get(key) ?? null : null));
  const [handle] = useState(() => (src && !pixelCache.has(key) ? delayRender(`sampling ${src}`) : null));
  useEffect(() => {
    if (!src) return;
    const hit = pixelCache.get(key);
    if (hit) {
      setLoaded(hit);
      if (handle !== null) continueRender(handle);
      return;
    }
    let p = pixelPending.get(key);
    if (!p) {
      p = loadImagePixels(resolveSrc(src), bw, bh);
      pixelPending.set(key, p);
    }
    p.then((px) => {
      pixelCache.set(key, px);
      setLoaded(px);
      if (handle !== null) continueRender(handle);
    }).catch((e) => cancelRender(e));
  }, [key, src, bw, bh, handle]);
  return src ? loaded : procedural;
};

export type GridRect = {x0: number; y0: number; x1: number; y1: number};

/**
 * Box-average colours of a cols x rows grid covering `rect` (normalised frame coords, may extend past
 * 0..1 — edge pixels are clamped). Returns Float32Array [r,g,b,...] 0..255.
 */
export const sampleGrid = (px: Pixels, cols: number, rows: number, rect: GridRect = {x0: 0, y0: 0, x1: 1, y1: 1}): Float32Array => {
  const out = new Float32Array(cols * rows * 3);
  const x0 = rect.x0;
  const y0 = rect.y0;
  const cw = ((rect.x1 - rect.x0) * px.w) / cols;
  const ch = ((rect.y1 - rect.y0) * px.h) / rows;
  const sub = Math.max(1, Math.min(4, Math.round(Math.min(cw, ch))));
  for (let gy = 0; gy < rows; gy++)
    for (let gx = 0; gx < cols; gx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = 0; sy < sub; sy++)
        for (let sx = 0; sx < sub; sx++) {
          const x = Math.min(px.w - 1, Math.max(0, Math.floor(x0 * px.w + (gx + (sx + 0.5) / sub) * cw)));
          const y = Math.min(px.h - 1, Math.max(0, Math.floor(y0 * px.h + (gy + (sy + 0.5) / sub) * ch)));
          const i = (y * px.w + x) * 4;
          r += px.data[i];
          g += px.data[i + 1];
          b += px.data[i + 2];
          n++;
        }
      const o = (gy * cols + gx) * 3;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
    }
  return out;
};

// ---------------------------------------------------------------------------------------------------------
// SVG filters (apply to HTML layers with style={{filter: `url(#id)`}})
// ---------------------------------------------------------------------------------------------------------

const LUMA = '0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0';

const tables = (colors: string[]) => {
  const c = colors.map(hexRgb);
  return [0, 1, 2].map((k) => c.map((v) => (v[k] / 255).toFixed(4)).join(' '));
};

/** deterministic, CSS-safe unique id for SVG defs (React useId without colons) */
export const useSafeId = (prefix: string) => prefix + React.useId().replace(/[^a-zA-Z0-9]/g, '');

/** a zero-size <svg> that only holds filter defs */
export const FilterDefs: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg width={0} height={0} style={{position: 'absolute', width: 0, height: 0, overflow: 'hidden'}} aria-hidden>
    <defs>{children}</defs>
  </svg>
);

/** luminance -> colour ramp (gradient map). discrete = hard posterised palette. */
export const GradientMapFilter: React.FC<{id: string; colors: string[]; discrete?: boolean; contrast?: number}> = ({id, colors, discrete, contrast = 1}) => {
  const [R, G, B] = tables(colors);
  const type = discrete ? 'discrete' : 'table';
  const k = contrast;
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={LUMA} />
      {k !== 1 && (
        <feComponentTransfer>
          <feFuncR type="linear" slope={k} intercept={0.5 - 0.5 * k} />
          <feFuncG type="linear" slope={k} intercept={0.5 - 0.5 * k} />
          <feFuncB type="linear" slope={k} intercept={0.5 - 0.5 * k} />
        </feComponentTransfer>
      )}
      <feComponentTransfer>
        <feFuncR type={type} tableValues={R} />
        <feFuncG type={type} tableValues={G} />
        <feFuncB type={type} tableValues={B} />
      </feComponentTransfer>
    </filter>
  );
};

/**
 * Pixelate (block size `size` px) + optional 2x2 Bayer ordered dither + luminance -> discrete palette.
 * Pass palette [] to keep the source colours (pixelate only, with per-channel posterise `levels`).
 */
export const PixelDitherFilter: React.FC<{id: string; size: number; palette: string[]; dither: number; levels?: number}> = ({id, size, palette, dither, levels = 0}) => {
  const s = Math.max(2, Math.round(size));
  const half = Math.floor(s / 2);
  const bayer = [
    [0, 0, 0 / 4],
    [1, 0, 2 / 4],
    [0, 1, 3 / 4],
    [1, 1, 1 / 4],
  ];
  const usePal = palette.length >= 2;
  const [R, G, B] = usePal ? tables(palette) : ['', '', ''];
  const n = usePal ? palette.length : Math.max(2, levels);
  // dither amplitude in luminance units: one palette step * strength
  const amp = (dither * 1) / n;
  const post = Array.from({length: Math.max(2, levels)}, (_, i) => (i / Math.max(1, levels - 1)).toFixed(3)).join(' ');
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB" primitiveUnits="userSpaceOnUse">
      {/* nearest-neighbour pixelate: keep one sample per block, dilate it to fill the block */}
      <feFlood x={half} y={half} width="1" height="1" floodColor="#000" result="dot" />
      <feComposite in="dot" in2="dot" width={s} height={s} x="0" y="0" result="cell" />
      <feTile in="cell" result="grid" />
      <feComposite in="SourceGraphic" in2="grid" operator="in" result="samp" />
      <feMorphology in="samp" operator="dilate" radius={half} result="px" />
      {usePal ? (
        <>
          <feColorMatrix in="px" type="matrix" values={LUMA} result="lum" />
          {/* 2x2 Bayer threshold map in virtual pixels */}
          {bayer.map(([bx, by, v], i) => (
            <feFlood key={i} x={bx * s} y={by * s} width={s} height={s} floodColor={`rgb(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)})`} result={`b${i}`} />
          ))}
          <feMerge x="0" y="0" width={2 * s} height={2 * s} result="btile">
            <feMergeNode in="b0" />
            <feMergeNode in="b1" />
            <feMergeNode in="b2" />
            <feMergeNode in="b3" />
          </feMerge>
          <feTile in="btile" result="bayer" />
          <feComposite in="lum" in2="bayer" operator="arithmetic" k1="0" k2="1" k3={amp} k4={-amp * 0.375} result="dl" />
          <feComponentTransfer in="dl">
            <feFuncR type="discrete" tableValues={R} />
            <feFuncG type="discrete" tableValues={G} />
            <feFuncB type="discrete" tableValues={B} />
            <feFuncA type="linear" slope="0" intercept="1" />
          </feComponentTransfer>
        </>
      ) : levels > 1 ? (
        <feComponentTransfer in="px">
          <feFuncR type="discrete" tableValues={post} />
          <feFuncG type="discrete" tableValues={post} />
          <feFuncB type="discrete" tableValues={post} />
        </feComponentTransfer>
      ) : (
        <feOffset in="px" dx="0" dy="0" />
      )}
    </filter>
  );
};

/** keeps one RGB channel (for split / misregistration copies blended with `screen`) */
export const channelMatrix = (ch: 'r' | 'g' | 'b') =>
  ch === 'r' ? '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0' : ch === 'g' ? '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0' : '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0';

/** CSS multiply colours that isolate a channel without an SVG filter */
export const CHANNEL_TINT = {r: '#ff0000', g: '#00ff00', b: '#0000ff'} as const;

/** A copy of children reduced to one channel (multiply by pure R/G/B), meant to be screen-blended. */
export const ChannelLayer: React.FC<{ch: 'r' | 'g' | 'b'; style?: React.CSSProperties; children: React.ReactNode}> = ({ch, style, children}) => (
  <div style={{position: 'absolute', inset: 0, isolation: 'isolate', mixBlendMode: 'screen', background: '#000', ...style}}>
    {children}
    <div style={{position: 'absolute', inset: 0, background: CHANNEL_TINT[ch], mixBlendMode: 'multiply'}} />
  </div>
);

// ---------------------------------------------------------------------------------------------------------
// Rain (video16 rain-overlay / video10 woodblock rain): parallax streak layers, one <path> per layer
// ---------------------------------------------------------------------------------------------------------

const RAIN_LAYERS = [
  {count: 150, speed: 2600, len: 120, op: 0.35, width: 1.6},
  {count: 300, speed: 1800, len: 70, op: 0.22, width: 1.2},
  {count: 600, speed: 1200, len: 35, op: 0.12, width: 1},
];

export const rainPath = (frame: number, w: number, h: number, u: number, layer: number, opts: {density?: number; angle?: number; speed?: number; seed?: number; fps?: number} = {}) => {
  const L = RAIN_LAYERS[layer];
  const density = opts.density ?? 1;
  const ang = ((opts.angle ?? 8) * Math.PI) / 180;
  const fps = opts.fps ?? 30;
  const n = Math.round(L.count * density * (w / 1920 + h / 1080) * 0.5);
  const r = rng((opts.seed ?? 3) * 101 + layer);
  const v = (L.speed * (opts.speed ?? 1) * u) / fps;
  const len = L.len * u;
  const span = h + len * 2;
  const dxv = Math.tan(ang);
  let d = '';
  for (let i = 0; i < n; i++) {
    const x0 = r() * (w + h * Math.abs(dxv)) - (dxv > 0 ? h * dxv : 0);
    const y0 = r() * span;
    const l = len * (0.6 + 0.8 * r());
    const y = ((y0 + frame * v * (0.85 + 0.3 * r())) % span) - len;
    const x = x0 + y * dxv;
    d += `M${x.toFixed(1)} ${y.toFixed(1)}l${(l * dxv).toFixed(1)} ${l.toFixed(1)}`;
  }
  return {d, op: L.op, width: L.width * u};
};

export const RainLayer: React.FC<{frame: number; density?: number; angle?: number; speed?: number; color?: string; opacity?: number; seed?: number; layers?: number[]}> = ({
  frame,
  density = 1,
  angle = 8,
  speed = 1,
  color = '#dfe6f2',
  opacity = 1,
  seed = 3,
  layers = [2, 1, 0],
}) => {
  const {w, h, u, fps} = useStage();
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {layers.map((li) => {
        const p = rainPath(frame, w, h, u, li, {density, angle, speed, seed, fps});
        return <path key={li} d={p.d} stroke={color} strokeOpacity={p.op * opacity} strokeWidth={p.width} strokeLinecap="round" fill="none" />;
      })}
    </svg>
  );
};
