// Adapted in part from lemo-opuscar (MIT, © LemoLab / Lemomo) — see THIRD_PARTY_NOTICES.md.
// Algorithms re-written from the research notes in analysis/sources/lemo-styles-a.md: banded gold + engraved
// keylines (art-deco/engine/deco.js), cel crescent shading + colour models (cel-anime-80s/demo/cel.js, pal.js),
// beta ease + settle spring (briefing-board/demo/kit/board.js), brick plastic (brick-toy/demo/bricks.js).
import React, {useLayoutEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {loadFont as loadLimelight} from '@remotion/google-fonts/Limelight';
import {loadFont as loadPoiret} from '@remotion/google-fonts/PoiretOne';
import {loadFont as loadJosefin} from '@remotion/google-fonts/JosefinSans';
import {loadFont as loadItaliana} from '@remotion/google-fonts/Italiana';
import {loadFont as loadVT} from '@remotion/google-fonts/VT323';
import {loadFont as loadKanit} from '@remotion/google-fonts/Kanit';
import {loadFont as loadMichroma} from '@remotion/google-fonts/Michroma';
import {loadFont as loadSourceSerif} from '@remotion/google-fonts/SourceSerif4';
import {loadFont as loadPlexSans} from '@remotion/google-fonts/IBMPlexSans';
import {clamp} from './ease';
import {fbm, rng} from './random';
import {fonts} from './fonts';
import {tfonts} from './text-kit';

/**
 * Shared helpers for build-round-2 group LA1 (lemo-opuscar styles part A): light table, art deco, ASCII/CRT,
 * liminal 3D, blueprint, brick toy, briefing board, caption news, 80s cel anime, city time-lapse.
 */

// ------------------------------------------------------------------------------------------------ fonts
export const lf = {
  ...fonts,
  plex: tfonts.plex,
  deco: loadLimelight('normal', {weights: ['400'], subsets: ['latin']}).fontFamily,
  poiret: loadPoiret('normal', {weights: ['400'], subsets: ['latin']}).fontFamily,
  josefin: loadJosefin('normal', {weights: ['600', '700'], subsets: ['latin']}).fontFamily,
  italiana: loadItaliana('normal', {weights: ['400'], subsets: ['latin']}).fontFamily,
  vt: loadVT('normal', {weights: ['400'], subsets: ['latin']}).fontFamily,
  kanit: loadKanit('italic', {weights: ['900'], subsets: ['latin']}).fontFamily,
  michroma: loadMichroma('normal', {weights: ['400'], subsets: ['latin']}).fontFamily,
  text: loadSourceSerif('normal', {weights: ['400', '600'], subsets: ['latin']}).fontFamily,
  plexSans: loadPlexSans('normal', {weights: ['400', '600', '700'], subsets: ['latin']}).fontFamily,
};

// ------------------------------------------------------------------------------------------------ colour
export type RGB3 = [number, number, number];
export const toRgb = (s: string): RGB3 => {
  let v = s.replace('#', '').trim();
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  const n = parseInt(v.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const h2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
export const toHex = (c: RGB3) => '#' + h2(c[0]) + h2(c[1]) + h2(c[2]);
export const mixC = (a: string, b: string, t: number) => {
  const A = toRgb(a);
  const B = toRgb(b);
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
};
export const alpha = (hex: string, a: number) => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
/** multiply a colour by a per-channel vector (colour-model relight) */
export const mulC = (hex: string, v: RGB3) => {
  const c = toRgb(hex);
  return toHex([c[0] * v[0], c[1] * v[1], c[2] * v[2]]);
};

// ------------------------------------------------------------------------------------------------ easing
export const sstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const betaLuts = new Map<string, Float32Array>();
/** beta ease: velocity ∝ u^a (1-u)^b, normalised cumulative integral (briefing-board camera moves) */
export const bease = (u: number, a = 2, b = 2) => {
  const key = a + ',' + b;
  let lut = betaLuts.get(key);
  if (!lut) {
    const N = 1024;
    lut = new Float32Array(N + 1);
    let s = 0;
    for (let i = 1; i <= N; i++) {
      const m = (i - 0.5) / N;
      s += Math.pow(m, a) * Math.pow(1 - m, b);
      lut[i] = s;
    }
    for (let i = 1; i <= N; i++) lut[i] /= s;
    betaLuts.set(key, lut);
  }
  const x = clamp(u) * 1024;
  const i = Math.floor(x);
  return i >= 1024 ? 1 : lut[i] + (lut[i + 1] - lut[i]) * (x - i);
};
/** damped settle 1 - e^(-k t) cos(f t)  (t in seconds) */
export const settle = (t: number, k = 9, f = 22) => (t <= 0 ? 0 : 1 - Math.exp(-k * t) * Math.cos(f * t));
/** 0..1 progress of frame between a and b */
export const seg = (f: number, a: number, b: number) => clamp((f - a) / Math.max(1e-6, b - a));
export const eo3 = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const eio3 = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** back-out with overshoot s */
export const backOut = (t: number, s = 1.6) => {
  const x = clamp(t) - 1;
  return 1 + x * x * ((s + 1) * x + s);
};
/** deterministic 0..1 hash of integers */
export const hh = (a: number, b = 0, c = 0) => {
  let x = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

// ------------------------------------------------------------------------------------------------ document page
export const DOC_DEFAULT = {
  org: 'NORTHWIND HARBOUR AUTHORITY',
  title: 'Report on the New Crossing',
  meta: 'Ref. NH-2041 · Filed 14 March · Page 3 of 12',
  lines: [
    'The survey team walked the full length of the channel on four',
    'separate mornings and recorded every reading by hand before',
    'it was checked against the harbour charts held in the archive.',
    'Ships now entering the port are wider and taller than any that',
    'the old bridge was designed for, and pilots report that the',
    'clearance at high water leaves almost no margin for error.',
    'The measured clear span required for safe passage is 1,208 metres,',
    'more than twice the distance the present structure can offer.',
    'A cable-stayed design meets this figure with room to spare and',
    'can be built while the existing crossing remains in service.',
    'Costs and timings are set out in the tables that follow, with',
    'every figure traced to its original source document.',
  ],
  keyLine: 6,
  keyNumber: '1,208',
  keyUnit: 'METRES',
};

export type DocLine = {x: number; y: number; w: number; size: number; text: string; justify: boolean};
export type DocLayout = {W: number; H: number; lines: DocLine[]; head: {org: number; title: number; meta: number}; margin: number; lineH: number};

/** page layout in page units (W = 1000). Every body line has a known box so marks can target it. */
export const docLayout = (lines: string[], W = 1000, H = 1294): DocLayout => {
  const margin = 96;
  const size = 25;
  const lineH = 44;
  const top = 360;
  const out: DocLine[] = lines.map((text, i) => {
    const paraEnd = i === lines.length - 1 || /[.:]$/.test(text.trim());
    const est = text.length * size * 0.47;
    const full = W - margin * 2;
    return {x: margin, y: top + i * lineH + (i >= 3 ? 22 : 0) + (i >= 8 ? 22 : 0), w: paraEnd ? Math.min(full, est) : full, size, text, justify: !paraEnd};
  });
  return {W, H, lines: out, head: {org: 130, title: 214, meta: 262}, margin, lineH};
};

/** the page's text in page units (draw inside a transformed <g>) */
export const DocText: React.FC<{L: DocLayout; org: string; title: string; meta: string; ink?: string; faint?: string; accent?: string; lineOpacity?: (i: number) => number}> = ({
  L,
  org,
  title,
  meta,
  ink = '#15171A',
  faint = '#5d5f63',
  accent = '#15171A',
  lineOpacity,
}) => (
  <g>
    <text x={L.margin} y={L.head.org} fontFamily={lf.plex} fontSize={19} letterSpacing={4} fill={faint}>
      {org}
    </text>
    <rect x={L.margin} y={L.head.org + 18} width={L.W - L.margin * 2} height={2.5} fill={accent} opacity={0.8} />
    <text x={L.margin} y={L.head.title} fontFamily={lf.text} fontWeight={600} fontSize={50} fill={ink}>
      {title}
    </text>
    <text x={L.margin} y={L.head.meta} fontFamily={lf.plex} fontSize={17} fill={faint}>
      {meta}
    </text>
    {L.lines.map((l, i) => (
      <text
        key={i}
        x={l.x}
        y={l.y}
        fontFamily={lf.text}
        fontSize={l.size}
        fill={ink}
        opacity={lineOpacity ? lineOpacity(i) : 1}
        {...(l.justify ? {textLength: l.w, lengthAdjust: 'spacing'} : {})}
      >
        {l.text}
      </text>
    ))}
    {[0, 1, 2].map((k) => (
      <rect key={k} x={L.margin} y={L.H - 250 + k * 30} width={(L.W - L.margin * 2) * [0.92, 0.84, 0.5][k]} height={9} rx={4} fill={faint} opacity={0.18} />
    ))}
    <text x={L.W / 2} y={L.H - 70} textAnchor="middle" fontFamily={lf.plex} fontSize={16} fill={faint} opacity={0.8}>
      — 3 —
    </text>
  </g>
);

/** page-unit box of a text span inside a line (character-proportional estimate, exact for justified lines) */
export const spanBox = (l: DocLine, needle: string) => {
  const i = Math.max(0, l.text.indexOf(needle));
  const n = l.text.length;
  const x0 = l.x + (l.w * i) / n;
  const x1 = l.x + (l.w * (i + (needle ? needle.length : n))) / n;
  return {x0, x1, y0: l.y - l.size * 0.82, y1: l.y + l.size * 0.28};
};

// ------------------------------------------------------------------------------------------------ backgrounds
/** cool backlit light table: diffuser white with radial falloff + mottling, aluminium frame, dark desk */
export const LightTable: React.FC<{id: string; w: number; h: number; u: number; table?: string; desk?: string; frame?: string; inset?: number}> = ({
  id,
  w,
  h,
  u,
  table = '#F7F9FB',
  desk = '#0E0F11',
  frame = '#545759',
  inset = 0,
}) => {
  const m = inset * u;
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-lt`} cx="50%" cy="48%" r="75%">
          <stop offset="0%" stopColor={table} />
          <stop offset="70%" stopColor={mixC(table, '#c9ced3', 0.35)} />
          <stop offset="100%" stopColor={mixC(table, '#a9afb5', 0.55)} />
        </radialGradient>
        <filter id={`${id}-mot`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={0.0026 / u} numOctaves={2} seed={7} />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.52  0 0 0 0 0.55  0 0 0 0.06 0" />
        </filter>
      </defs>
      <rect width={w} height={h} fill={desk} />
      {m > 0 && <rect x={m - 10 * u} y={m - 10 * u} width={w - 2 * m + 20 * u} height={h - 2 * m + 20 * u} rx={8 * u} fill={frame} />}
      <rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} fill={`url(#${id}-lt)`} />
      <rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} filter={`url(#${id}-mot)`} />
    </g>
  );
};

/** cyanotype paper (Prussian blue ramp, coating streaks, fibres, bleached edges) */
export const BlueprintPaper: React.FC<{id: string; w: number; h: number; u: number; dark?: string; light?: string; seed?: number}> = ({id, w, h, u, dark = '#18336B', light = '#2A58A6', seed = 3}) => (
  <g>
    <defs>
      <linearGradient id={`${id}-bp`} x1="0" y1="0" x2="1" y2="0.3">
        <stop offset="0" stopColor={mixC(dark, light, 0.12)} />
        <stop offset="1" stopColor={mixC(dark, light, 0.42)} />
      </linearGradient>
      <filter id={`${id}-bpn`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={`${0.0012 / u} ${0.0016 / u}`} numOctaves={3} seed={seed} />
        <feColorMatrix type="matrix" values={`0 0 0 0 ${toRgb(light)[0] / 255}  0 0 0 0 ${toRgb(light)[1] / 255}  0 0 0 0 ${toRgb(light)[2] / 255}  1.4 0 0 0 -0.55`} />
      </filter>
      <filter id={`${id}-bps`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={`${0.0004 / u} ${0.012 / u}`} numOctaves={2} seed={seed + 4} />
        <feColorMatrix type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.12  0 0 0 0 0.3  0 0 1.2 0 -0.5" />
      </filter>
      <filter id={`${id}-bpf`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={0.9 / u} numOctaves={1} seed={seed + 9} />
        <feColorMatrix type="matrix" values="0 0 0 0 0.85  0 0 0 0 0.9  0 0 0 0 1  0 0 0 -2.2 1.32" />
      </filter>
      <radialGradient id={`${id}-bpe`} cx="50%" cy="50%" r="72%">
        <stop offset="78%" stopColor="#8ca8d1" stopOpacity={0} />
        <stop offset="100%" stopColor="#8ca8d1" stopOpacity={0.38} />
      </radialGradient>
    </defs>
    <rect width={w} height={h} fill={`url(#${id}-bp)`} />
    <rect width={w} height={h} filter={`url(#${id}-bpn)`} />
    <rect width={w} height={h} filter={`url(#${id}-bps)`} />
    <rect width={w} height={h} filter={`url(#${id}-bpf)`} opacity={0.5} />
    <rect width={w} height={h} fill={`url(#${id}-bpe)`} />
  </g>
);

/** warm white enamel whiteboard with window falloff, ghost strokes and a sliding sheen */
export const Whiteboard: React.FC<{id: string; w: number; h: number; u: number; sheen?: number; enamel?: string; seed?: number; ghosts?: number}> = ({
  id,
  w,
  h,
  u,
  sheen = 0,
  enamel = '#F3F1EB',
  seed = 5,
  ghosts = 26,
}) => {
  const gs = useMemo(() => {
    const r = rng(seed * 31 + 7);
    return Array.from({length: ghosts}, () => {
      const x = r() * w;
      const y = r() * h;
      const L = (60 + r() * 260) * u;
      const a = (r() - 0.5) * 0.5;
      const bend = (r() - 0.5) * 40 * u;
      return `M${x.toFixed(1)} ${y.toFixed(1)} q${(L / 2).toFixed(1)} ${bend.toFixed(1)} ${(L * Math.cos(a)).toFixed(1)} ${(L * Math.sin(a)).toFixed(1)}`;
    });
  }, [w, h, u, seed, ghosts]);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-wf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.5} />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="1" stopColor="#8a8070" stopOpacity={0.22} />
        </linearGradient>
        <linearGradient id={`${id}-sh`} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset={0.3 + sheen * 0.2} stopColor="#ffffff" stopOpacity={0} />
          <stop offset={0.42 + sheen * 0.2} stopColor="#ffffff" stopOpacity={0.35} />
          <stop offset={0.5 + sheen * 0.2} stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
        <filter id={`${id}-gb`}>
          <feGaussianBlur stdDeviation={2.2 * u} />
        </filter>
      </defs>
      <rect width={w} height={h} fill={enamel} />
      <g filter={`url(#${id}-gb)`} opacity={0.07} fill="none" stroke="#3a4250" strokeWidth={9 * u} strokeLinecap="round">
        {gs.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <rect width={w} height={h} fill={`url(#${id}-wf)`} />
      <rect width={w} height={h} fill={`url(#${id}-sh)`} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------ art deco gold
export const GOLD = {shadow: '#6F5220', base: '#C9A24B', light: '#F3D98B', spec: '#FFF4D2'};

/** 7-stop banded gold gradient with a moving specular sheen s (-0.2 → 1.2 sweeps the light across) */
export const GoldGradient: React.FC<{id: string; sheen?: number; x1?: number; y1?: number; x2?: number; y2?: number; units?: 'objectBoundingBox' | 'userSpaceOnUse'; gold?: typeof GOLD}> = ({
  id,
  sheen = 0.5,
  x1 = 0,
  y1 = 0,
  x2 = 1,
  y2 = 0.35,
  units = 'objectBoundingBox',
  gold = GOLD,
}) => {
  const s = sheen;
  const stops: [number, string][] = [
    [0, gold.shadow],
    [s - 0.3, gold.base],
    [s - 0.08, gold.light],
    [s, gold.spec],
    [s + 0.1, gold.base],
    [s + 0.32, gold.shadow],
    [1, gold.base],
  ];
  const clean = stops.map(([o, c]) => [clamp(o), c] as [number, string]);
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits={units}>
      {clean.map(([o, c], i) => (
        <stop key={i} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
};

/** engraved keyline: dark under-stroke, gold gradient stroke, hairline highlight */
export const GLine: React.FC<{d: string; grad: string; w: number; draw?: number; glow?: string; fill?: string}> = ({d, grad, w, draw = 1, glow, fill = 'none'}) => {
  const dash = draw >= 0.999 ? {} : {pathLength: 1, strokeDasharray: `${Math.max(0, draw)} 2`};
  return (
    <g fill={fill} strokeLinecap="round" strokeLinejoin="miter">
      <path d={d} stroke={alpha(GOLD.shadow, 0.85)} strokeWidth={w + 1.6} {...dash} />
      <path d={d} stroke={`url(#${grad})`} strokeWidth={w} filter={glow ? `url(#${glow})` : undefined} {...dash} />
      <path d={d} stroke="rgba(255,246,214,0.55)" strokeWidth={w * 0.28} {...dash} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------ stroke font (bulb signs)
/**
 * Single-stroke geometric capitals in a 0..4 × 0..6 box (y down). Commands: M x y, L x y,
 * E cx cy rx ry a0 a1 (elliptical arc, degrees, 0 = +x, 90 = down; drawn from a0 to a1).
 */
const SF: Record<string, [number, string]> = {
  A: [4, 'M0 6 L2 0 L4 6 M0.75 3.9 L3.25 3.9'],
  B: [3.9, 'M0 0 L0 6 L2.4 6 E2.4 4.5 1.5 1.5 90 -90 L0 3 M0 3 L2.2 3 E2.2 1.5 1.45 1.5 90 -90 L0 0'],
  C: [4, 'E2.1 3 2.1 3 -42 -318'],
  D: [4, 'M0 0 L0 6 L1.4 6 E1.4 3 2.6 3 90 -90 L0 0'],
  E: [3.4, 'M3.4 0 L0 0 L0 6 L3.4 6 M0 3 L2.7 3'],
  F: [3.4, 'M3.4 0 L0 0 L0 6 M0 3 L2.7 3'],
  G: [4.2, 'E2.1 3 2.1 3 -42 -360 L2.4 3'],
  H: [3.8, 'M0 0 L0 6 M3.8 0 L3.8 6 M0 3 L3.8 3'],
  I: [0, 'M0 0 L0 6'],
  J: [3, 'M3 0 L3 4.4 E1.5 4.4 1.5 1.6 0 180'],
  K: [3.6, 'M0 0 L0 6 M3.5 0 L0 3.6 M1.25 2.6 L3.7 6'],
  L: [3.3, 'M0 0 L0 6 L3.3 6'],
  M: [4.6, 'M0 6 L0 0 L2.3 4.2 L4.6 0 L4.6 6'],
  N: [3.9, 'M0 6 L0 0 L3.9 6 L3.9 0'],
  O: [4.4, 'E2.2 3 2.2 3 -90 270'],
  P: [3.7, 'M0 6 L0 0 L2.1 0 E2.1 1.6 1.6 1.6 -90 90 L0 3.2'],
  Q: [4.4, 'E2.2 3 2.2 3 -90 270 M2.7 4.3 L4.5 6.3'],
  R: [3.8, 'M0 6 L0 0 L2.1 0 E2.1 1.6 1.6 1.6 -90 90 L0 3.2 M1.9 3.2 L3.8 6'],
  S: [3.8, 'E1.9 1.5 1.75 1.5 -25 -270 E1.9 4.5 1.9 1.5 -90 155'],
  T: [4, 'M0 0 L4 0 M2 0 L2 6'],
  U: [3.9, 'M0 0 L0 4.05 E1.95 4.05 1.95 1.95 180 0 L3.9 0'],
  V: [4, 'M0 0 L2 6 L4 0'],
  W: [5, 'M0 0 L1.25 6 L2.5 1.4 L3.75 6 L5 0'],
  X: [3.8, 'M0 0 L3.8 6 M3.8 0 L0 6'],
  Y: [4, 'M0 0 L2 3 L4 0 M2 3 L2 6'],
  Z: [3.8, 'M0 0 L3.8 0 L0 6 L3.8 6'],
  '0': [4, 'E2 3 2 3 -90 270'],
  '1': [1.8, 'M0.2 1.2 L1.6 0 L1.6 6'],
  '2': [3.9, 'E1.95 1.9 1.85 1.85 -170 15 L0 6 L3.9 6'],
  '3': [3.8, 'E1.9 1.5 1.7 1.5 -160 90 E1.9 4.5 1.9 1.5 -90 160'],
  '4': [4, 'M3 6 L3 0 L0 4.2 L4 4.2'],
  '5': [3.9, 'M3.6 0 L0.4 0 L0.2 2.75 E1.95 4.2 1.95 1.8 -125 155'],
  '6': [4, 'E4 4.1 4 4.1 -100 -180 E2 4.1 2 1.9 180 540'],
  '7': [3.8, 'M0 0 L3.8 0 L1.3 6'],
  '8': [4, 'E2 1.5 1.6 1.5 90 450 E2 4.5 2 1.5 -90 270'],
  '9': [4, 'E2 1.9 2 1.9 0 360 E0 1.9 4 4.1 0 80'],
  '!': [0, 'M0 0 L0 4.1 M0 5.7 L0 6'],
  '?': [3.6, 'E1.8 1.6 1.8 1.6 -170 60 L1.8 4.2 M1.8 5.7 L1.8 6'],
  '-': [2.4, 'M0 3.2 L2.4 3.2'],
  '.': [0, 'M0 5.75 L0 6'],
  "'": [0, 'M0 0 L0 1.4'],
  '&': [4.2, 'M4.2 6 L0.9 2.6 E1.9 1.4 1.1 1.2 150 -150 L0.6 4.1 E1.9 4.8 1.4 1.2 -150 30 L4 3.4'],
  ' ': [2, ''],
};

/** flatten a glyph's strokes to polylines in glyph units */
export const strokeGlyph = (ch: string): {width: number; strokes: [number, number][][]} => {
  const g = SF[ch.toUpperCase()] ?? SF['?'];
  const tok = g[1].replace(/([MLE])/g, ' $1 ').split(/\s+/).filter(Boolean);
  const strokes: [number, number][][] = [];
  let cur: [number, number][] = [];
  let i = 0;
  while (i < tok.length) {
    const c = tok[i++];
    if (c === 'M') {
      if (cur.length > 1) strokes.push(cur);
      cur = [[+tok[i], +tok[i + 1]]];
      i += 2;
    } else if (c === 'L') {
      cur.push([+tok[i], +tok[i + 1]]);
      i += 2;
    } else if (c === 'E') {
      const [cx, cy, rx, ry, a0, a1] = tok.slice(i, i + 6).map(Number);
      i += 6;
      const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 7));
      for (let k = 0; k <= n; k++) {
        const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180;
        cur.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
    }
  }
  if (cur.length > 1) strokes.push(cur);
  return {width: g[0], strokes};
};

/** points at equal arc spacing along each polyline (ends included) */
export const resample = (poly: [number, number][], spacing: number): [number, number][] => {
  const segs: number[] = [];
  let L = 0;
  for (let i = 1; i < poly.length; i++) {
    const d = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
    segs.push(d);
    L += d;
  }
  const n = Math.max(1, Math.round(L / spacing));
  const out: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    let s = (L * k) / n;
    let j = 0;
    while (j < segs.length - 1 && s > segs[j]) {
      s -= segs[j];
      j++;
    }
    const t = segs[j] > 0 ? clamp(s / segs[j]) : 0;
    out.push([poly[j][0] + (poly[j + 1][0] - poly[j][0]) * t, poly[j][1] + (poly[j + 1][1] - poly[j][1]) * t]);
  }
  return out;
};

// ------------------------------------------------------------------------------------------------ 5×7 pixel font (bricks)
const PF: Record<string, string> = {
  A: '01110 10001 10001 11111 10001 10001 10001',
  B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01111 10000 10000 10000 10000 10000 01111',
  D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111',
  F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01111 10000 10000 10011 10001 10001 01111',
  H: '10001 10001 10001 11111 10001 10001 10001',
  I: '11111 00100 00100 00100 00100 00100 11111',
  J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001',
  L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 11001 10101 10011 10001 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101',
  R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010',
  X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100',
  Z: '11111 00001 00010 00100 01000 10000 11111',
  '0': '01110 10001 10011 10101 11001 10001 01110',
  '1': '00100 01100 00100 00100 00100 00100 01110',
  '2': '01110 10001 00001 00010 00100 01000 11111',
  '3': '11110 00001 00001 01110 00001 00001 11110',
  '4': '00010 00110 01010 10010 11111 00010 00010',
  '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110',
  '7': '11111 00001 00010 00100 01000 01000 01000',
  '8': '01110 10001 10001 01110 10001 10001 01110',
  '9': '01110 10001 10001 01111 00001 00010 01100',
  '!': '00100 00100 00100 00100 00100 00000 00100',
  '?': '01110 10001 00001 00010 00100 00000 00100',
  '-': '00000 00000 00000 11111 00000 00000 00000',
  '+': '00000 00100 00100 11111 00100 00100 00000',
  '.': '00000 00000 00000 00000 00000 00000 00100',
  '♥': '00000 01010 11111 11111 01110 00100 00000',
  ' ': '00000 00000 00000 00000 00000 00000 00000',
};

/** cells (x right, y up from baseline 0) of a text in the 5×7 font, 1 cell gap between letters */
export const pixelText = (text: string): {cells: [number, number, number][]; width: number} => {
  const cells: [number, number, number][] = [];
  let x = 0;
  [...text.toUpperCase()].forEach((ch, li) => {
    const rows = (PF[ch] ?? PF['?']).split(' ');
    const narrow = ch === ' ' ? 3 : 5;
    rows.forEach((row, r) => {
      [...row].forEach((b, c) => {
        if (b === '1') cells.push([x + c, 6 - r, li]);
      });
    });
    x += narrow + 1;
  });
  return {cells, width: Math.max(0, x - 1)};
};

export type Brick = {x: number; y: number; z: number; w: number; d: number; h: number; color: string; round?: boolean; plate?: boolean};

/** merge horizontal runs of cells into 1×N bricks (max 4 long) with running-bond offsets per row */
export const cellsToBricks = (cells: ([number, number] | [number, number, number])[], palette: string[], seed = 1, depth = 1, colorBy: 'row' | 'random' | 'letter' = 'random'): Brick[] => {
  const set = new Set(cells.map(([x, y]) => x + ',' + y));
  const letterOf = new Map<string, number>();
  cells.forEach((c) => letterOf.set(c[0] + ',' + c[1], c[2] ?? 0));
  const rows = new Map<number, number[]>();
  cells.forEach(([x, y]) => rows.set(y, [...(rows.get(y) ?? []), x]));
  const r = rng(seed);
  const out: Brick[] = [];
  [...rows.keys()].sort((a, b) => a - b).forEach((y) => {
    const xs = (rows.get(y) ?? []).sort((a, b) => a - b);
    let i = 0;
    while (i < xs.length) {
      let len = 1;
      while (i + len < xs.length && xs[i + len] === xs[i] + len && set.has(xs[i] + len + ',' + y)) len++;
      // split the run into 2/3/4 bricks (odd rows start with a different size: running bond)
      let x = xs[i];
      let left = len;
      let first = true;
      while (left > 0) {
        let b = left >= 4 ? (first && y % 2 ? 3 : 4) : left;
        if (left - b === 1 && b > 2) b -= 1;
        const color =
          colorBy === 'row'
            ? palette[((y % palette.length) + palette.length) % palette.length]
            : colorBy === 'letter'
              ? palette[(letterOf.get(x + ',' + y) ?? 0) % palette.length]
              : palette[Math.floor(r() * palette.length) % palette.length];
        out.push({x: x + b / 2, y: y * 1.2 + 0.6, z: 0, w: b, d: depth, h: 1.2, color});
        x += b;
        left -= b;
        first = false;
      }
      i += len;
    }
  });
  return out;
};

export const BRICK_COLORS = {red: '#c91a09', blue: '#0055bf', yellow: '#f2cd37', green: '#237841', white: '#f2f2ee', black: '#1b2a34', orange: '#fe8a18', lightGrey: '#a0a5a9', darkGrey: '#6c6e68', tan: '#e4cd9e', azure: '#36aebf'};

// ------------------------------------------------------------------------------------------------ brick geometry (three.js)
const geoCache = new Map<string, THREE.BufferGeometry>();
/** rounded ABS brick w×d studs, height h (1.2 brick, 0.4 plate), with studs; round = cylinder brick */
export const brickGeometry = (w: number, d: number, h: number, round = false) => {
  const key = `${w}x${d}x${h}${round ? 'r' : ''}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const parts: THREE.BufferGeometry[] = [];
  if (round) {
    const body = new THREE.CylinderGeometry(w * 0.49, w * 0.49, h - 0.02, 28, 1);
    parts.push(body.toNonIndexed());
  } else {
    const body = new RoundedBoxGeometry(w - 0.02, h - 0.02, d - 0.02, 2, 0.05);
    parts.push(body.toNonIndexed());
  }
  const studs = round ? [[0, 0]] : Array.from({length: w * d}, (_, k) => [(k % w) - (w - 1) / 2, Math.floor(k / w) - (d - 1) / 2]);
  studs.forEach(([sx, sz]) => {
    const s = new THREE.CylinderGeometry(0.3, 0.3, 0.18, 20, 1);
    s.translate(sx, h / 2 + 0.08, sz);
    parts.push(s.toNonIndexed());
  });
  parts.forEach((p) => {
    p.deleteAttribute('uv');
  });
  const g = mergeGeometries(parts, false) ?? parts[0];
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
};

const matCache = new Map<string, THREE.MeshPhysicalMaterial>();
/** glossy clear-coated ABS (translucent = flame plates) */
export const brickMaterial = (hex: string, translucent = 0) => {
  const key = hex + '|' + translucent;
  const hit = matCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex),
    roughness: 0.24,
    metalness: 0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.07,
    envMapIntensity: 1.1,
    transparent: translucent > 0,
    opacity: translucent > 0 ? 1 - translucent * 0.55 : 1,
    emissive: translucent > 0 ? new THREE.Color(hex) : new THREE.Color('#000000'),
    emissiveIntensity: translucent > 0 ? 0.9 : 0,
    depthWrite: translucent === 0,
  });
  matCache.set(key, m);
  return m;
};

/** neutral studio environment (RoomEnvironment through PMREM) for glossy plastic */
export const StudioEnv: React.FC<{intensity?: number}> = ({intensity = 0.55}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const tex = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return t;
  }, [gl]);
  useLayoutEffect(() => {
    scene.environment = tex;
    (scene as unknown as {environmentIntensity: number}).environmentIntensity = intensity;
  }, [scene, tex, intensity]);
  return null;
};

/** one brick mesh at a transform */
export const BrickMesh: React.FC<{b: Brick; pos: [number, number, number]; rot?: [number, number, number]; scale?: number; translucent?: number; shadow?: boolean}> = ({
  b,
  pos,
  rot = [0, 0, 0],
  scale = 1,
  translucent = 0,
  shadow = true,
}) => {
  const geo = brickGeometry(b.w, b.d, b.h, b.round);
  const mat = brickMaterial(b.color, translucent);
  return <mesh geometry={geo} material={mat} position={pos} rotation={rot} scale={scale} castShadow={shadow && !translucent} receiveShadow={!translucent} />;
};

// ------------------------------------------------------------------------------------------------ cel shading
/**
 * Cel shape: flat fill + hard shadow crescent (far from the light) + hard highlight crescent (toward the
 * light) + thin saturated rim on the shadow edge + coloured outline. Crescents are the shape minus a
 * translated copy of itself (mask), so it works for any closed path.
 */
export const CelShape: React.FC<{
  id: string;
  d: string;
  fill: string;
  shade?: string;
  hi?: string;
  rim?: string;
  line?: string;
  light?: [number, number];
  shadeOff?: number;
  hiOff?: number;
  rimOff?: number;
  lineW?: number;
  transform?: string;
}> = ({id, d, fill, shade, hi, rim, line, light = [-0.6, -0.8], shadeOff = 8, hiOff = 4, rimOff = 3, lineW = 2.5, transform}) => {
  const L = Math.hypot(light[0], light[1]) || 1;
  const lx = light[0] / L;
  const ly = light[1] / L;
  const sh = shade ?? mixC(fill, '#2a1840', 0.38);
  const hl = hi ?? mixC(fill, '#ffffff', 0.45);
  const ln = line ?? mixC(fill, '#1a0c24', 0.62);
  return (
    <g transform={transform}>
      <defs>
        <clipPath id={`${id}-c`}>
          <path d={d} />
        </clipPath>
        <mask id={`${id}-ms`} maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000">
          <rect x="-5000" y="-5000" width="10000" height="10000" fill="white" />
          <path d={d} fill="black" transform={`translate(${lx * shadeOff} ${ly * shadeOff})`} />
        </mask>
        <mask id={`${id}-mh`} maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000">
          <rect x="-5000" y="-5000" width="10000" height="10000" fill="white" />
          <path d={d} fill="black" transform={`translate(${-lx * hiOff} ${-ly * hiOff})`} />
        </mask>
        <mask id={`${id}-mr`} maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000">
          <rect x="-5000" y="-5000" width="10000" height="10000" fill="white" />
          <path d={d} fill="black" transform={`translate(${lx * rimOff} ${ly * rimOff})`} />
        </mask>
      </defs>
      <path d={d} fill={fill} />
      <g clipPath={`url(#${id}-c)`}>
        <path d={d} fill={sh} mask={`url(#${id}-ms)`} />
        {hiOff > 0 && <path d={d} fill={hl} mask={`url(#${id}-mh)`} />}
        {rim && rimOff > 0 && <path d={d} fill={rim} mask={`url(#${id}-mr)`} />}
      </g>
      {lineW > 0 && <path d={d} fill="none" stroke={ln} strokeWidth={lineW} strokeLinejoin="round" />}
    </g>
  );
};

/** colour-model sets: per-role multipliers (lit fills, shadow fills, lines) + hand skin override */
export type LightSet = {lit: RGB3; shade: RGB3; line: RGB3; skin?: string; skinShade?: string; label: string};
export const LIGHT_SETS: Record<string, LightSet> = {
  day: {lit: [1, 1, 1], shade: [1, 1, 1], line: [1, 1, 1], label: 'DAY'},
  dawn: {lit: [1.04, 0.9, 0.84], shade: [0.86, 0.74, 0.82], line: [0.95, 0.82, 0.86], skin: '#F2C2A8', skinShade: '#C98E8E', label: 'DAWN'},
  night: {lit: [0.78, 0.74, 1.0], shade: [0.58, 0.52, 0.92], line: [0.8, 0.7, 1.1], skin: '#E9C9C4', skinShade: '#9B82B4', label: 'NIGHT'},
  backlit: {lit: [0.42, 0.3, 0.55], shade: [0.3, 0.2, 0.42], line: [0.6, 0.45, 0.8], skin: '#7E5C82', skinShade: '#4F3660', label: 'BACKLIT'},
  silhouette: {lit: [0.2, 0.16, 0.32], shade: [0.16, 0.12, 0.26], line: [0.3, 0.24, 0.45], skin: '#3A2C4E', skinShade: '#2A1F3A', label: 'SILHOUETTE'},
};
/** blend two light sets (for timed relights) */
export const mixSet = (a: LightSet, b: LightSet, t: number): LightSet => {
  const m = (x: RGB3, y: RGB3): RGB3 => [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  return {
    lit: m(a.lit, b.lit),
    shade: m(a.shade, b.shade),
    line: m(a.line, b.line),
    skin: a.skin || b.skin ? mixC(a.skin ?? '#000000', b.skin ?? a.skin ?? '#000000', a.skin && b.skin ? t : a.skin ? 0 : 1) : undefined,
    skinShade: a.skinShade || b.skinShade ? mixC(a.skinShade ?? b.skinShade ?? '#000', b.skinShade ?? a.skinShade ?? '#000', t) : undefined,
    label: t < 0.5 ? a.label : b.label,
  };
};
/** relight a role palette: every role multiplied by its vector, skin overridden by hand */
export const relight = <T extends Record<string, string>>(pal: T, set: LightSet, kinds: Partial<Record<keyof T, 'lit' | 'shade' | 'line' | 'skin' | 'skinShade' | 'keep'>>) => {
  const out = {} as Record<string, string>;
  (Object.keys(pal) as (keyof T)[]).forEach((k) => {
    const kind = kinds[k] ?? 'lit';
    const c = pal[k];
    if (kind === 'keep') out[k as string] = c;
    else if (kind === 'skin') out[k as string] = set.skin ? mixC(mulC(c, set.lit), set.skin, 0.85) : mulC(c, set.lit);
    else if (kind === 'skinShade') out[k as string] = set.skinShade ? mixC(mulC(c, set.shade), set.skinShade, 0.85) : mulC(c, set.shade);
    else out[k as string] = mulC(c, set[kind as 'lit' | 'shade' | 'line']);
  });
  return out as T;
};

// ------------------------------------------------------------------------------------------------ CRT glass
/** phosphor CRT finish over a dark screen: scanlines (thinner in bright areas is approximated), vignette, glass reflection */
export const CrtGlass: React.FC<{id: string; w: number; h: number; u: number; tint?: string; scan?: number; curve?: number; frame?: number}> = ({id, w, h, u, tint = '#FFB000', scan = 0.3, curve = 1, frame = 0}) => {
  const gap = Math.max(2, 3 * u);
  const flick = 1 + (hh(frame, 3) - 0.5) * 0.024;
  return (
    <g style={{pointerEvents: 'none'}}>
      <defs>
        <pattern id={`${id}-sl`} width={8} height={gap} patternUnits="userSpaceOnUse">
          <rect width={8} height={gap * 0.42} fill="#000" />
        </pattern>
        <radialGradient id={`${id}-vg`} cx="50%" cy="50%" r="72%">
          <stop offset="55%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={0.55 * curve} />
        </radialGradient>
        <radialGradient id={`${id}-rf`} cx="22%" cy="14%" r="40%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.05} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-gl`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={tint} stopOpacity={0.05} />
          <stop offset="100%" stopColor={tint} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}-sl)`} opacity={scan} />
      <rect width={w} height={h} fill={`url(#${id}-gl)`} opacity={flick} />
      <rect width={w} height={h} fill={`url(#${id}-vg)`} />
      <rect width={w} height={h} fill={`url(#${id}-rf)`} />
    </g>
  );
};

/** ink-density ramp for VT323-like glyphs, sparse → dense */
export const GLYPH_RAMP = " .'`,:;-~^=+<>!i|ilr/\\)(}{tjfxnvuczJLCYXUQ0OZmwqpdbkhao*#MW&8%B@";

/** bayer 4×4 */
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => v / 16 - 0.5));

/** smooth value noise in 0..1 for procedural scenes */
export const vnoise = (seed: string, x: number, y: number) => 0.5 + 0.5 * fbm(seed, x, y, 3);

// ------------------------------------------------------------------------------------------------ ASCII cells
/**
 * Brightness field for an ASCII grid (ascii-crt term.js port): box-averaged luma per cell, local contrast
 * m + k·(m − mean3×3), gamma, blank below 0.05.
 */
export const asciiField = (rgb: Float32Array, cols: number, rows: number, contrast = 0.9, gamma = 1.25, autoLevel = true) => {
  const n = cols * rows;
  const Lm = new Float32Array(n);
  for (let i = 0; i < n; i++) Lm[i] = (0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2]) / 255;
  if (autoLevel) {
    // stretch 2nd..99th percentile to 0..1 so dark plates still use the whole ramp
    const sorted = Float32Array.from(Lm).sort();
    const lo = sorted[Math.floor(n * 0.02)];
    const hi = sorted[Math.min(n - 1, Math.floor(n * 0.99))];
    const k = hi - lo > 0.05 ? 1 / (hi - lo) : 1;
    for (let i = 0; i < n; i++) Lm[i] = clamp((Lm[i] - lo) * k);
  }
  const out = new Float32Array(n);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      let s = 0;
      let k = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          s += Lm[rr * cols + cc];
          k++;
        }
      const m = Lm[r * cols + c];
      let v = clamp(m + contrast * (m - s / k));
      v = Math.pow(v, gamma);
      out[r * cols + c] = v < 0.05 ? 0 : v;
    }
  return out;
};

/** level 0..n-1 with Bayer 4×4 + hash dither */
export const pickLevel = (L: number, n: number, i: number, j: number, dither = 0.65, seed = 0) => {
  const x = L * (n - 1) + (BAYER4[j & 3][i & 3] * 0.5 + (hh(i, j, seed) - 0.5) * 0.5) * dither * 1.6;
  return Math.max(0, Math.min(n - 1, Math.round(x)));
};

/** phosphor ramp colour for brightness a (0..1): dim → mid → overexposed */
export const phosphor = (a: number, lo = '#FF6605', mid = '#FFB000', hi = '#FFEBB8') => (a < 0.55 ? mixC(lo, mid, a / 0.55) : mixC(mid, hi, clamp((a - 0.55) / 0.45)));

/** order characters sparse → dense using the glyph ramp as an ink-coverage proxy */
const COVER: Record<string, number> = {
  '.': 0.08, ',': 0.1, "'": 0.08, '`': 0.08, ':': 0.14, ';': 0.16, '-': 0.15, '!': 0.2, I: 0.3, L: 0.34, T: 0.36, J: 0.4, Y: 0.4, V: 0.44, F: 0.45,
  '1': 0.36, '7': 0.38, C: 0.5, X: 0.5, K: 0.54, S: 0.55, Z: 0.55, P: 0.55, '?': 0.4, U: 0.6, E: 0.6, A: 0.62, '2': 0.55, '3': 0.55, '4': 0.55, '5': 0.58,
  H: 0.65, G: 0.65, O: 0.64, '0': 0.66, D: 0.66, R: 0.66, '6': 0.66, '9': 0.66, N: 0.7, Q: 0.72, W: 0.76, M: 0.78, '8': 0.75, B: 0.8, '&': 0.78, '#': 0.85, '@': 0.9,
};
/** order characters sparse → dense by estimated ink coverage */
export const densityOrder = (chars: string) => {
  const uniq = [...new Set([...chars.toUpperCase()].filter((c) => c !== ' '))];
  const rank = (c: string) => COVER[c] ?? (GLYPH_RAMP.indexOf(c) >= 0 ? GLYPH_RAMP.indexOf(c) / GLYPH_RAMP.length : 0.5);
  return uniq.sort((a, b) => rank(a) - rank(b));
};

/** 20-level ink ramp for VT323 */
export const RAMP20 = ".'`:-~=+<*ilcoxOX#%&@";

// ------------------------------------------------------------------------------------------------ brick stage
/** warm macro desk set for the brick motions: key light + cool rim + soft fill, env, desk plane + baseplate */
export const BrickStage: React.FC<{children: React.ReactNode; desk?: string; plate?: string; plateR?: number; target?: [number, number, number]}> = ({
  children,
  desk = '#9b958c',
  plate = '#5c666c',
  plateR = 16,
  target = [0, 0, 0],
}) => (
  <>
    <StudioEnv intensity={0.5} />
    <ambientLight intensity={0.32} color="#fff4e8" />
    <directionalLight
      position={[target[0] - 14, 22, target[2] + 16]}
      intensity={2.6}
      color="#fff4e8"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-26}
      shadow-camera-right={26}
      shadow-camera-top={26}
      shadow-camera-bottom={-26}
      shadow-bias={-0.0004}
      shadow-radius={7}
    >
      <object3D attach="target" position={target} />
    </directionalLight>
    <directionalLight position={[target[0] + 18, 10, target[2] - 22]} intensity={0.9} color="#dbe8ff" />
    {/* desk far plane */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[target[0], -0.42, target[2]]} receiveShadow>
      <planeGeometry args={[400, 400]} />
      <meshLambertMaterial color={desk} />
    </mesh>
    {/* studded baseplate (matte) */}
    <mesh position={[target[0], -0.21, target[2]]} receiveShadow>
      <boxGeometry args={[plateR * 2, 0.42, plateR * 2]} />
      <meshStandardMaterial color={plate} roughness={0.85} metalness={0} />
    </mesh>
    <BasePlateStuds cx={target[0]} cz={target[2]} r={plateR} color={plate} />
    {children}
  </>
);

const BasePlateStuds: React.FC<{cx: number; cz: number; r: number; color: string}> = ({cx, cz, r, color}) => {
  const n = (2 * r) * (2 * r);
  const mesh = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.3, 0.3, 0.16, 14, 1);
    const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({color, roughness: 0.8}), n);
    m.receiveShadow = true;
    return m;
  }, [n, color]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    let k = 0;
    for (let x = 0; x < 2 * r; x++)
      for (let z = 0; z < 2 * r; z++) {
        o.position.set(cx - r + x + 0.5, 0.06, cz - r + z + 0.5);
        o.updateMatrix();
        mesh.setMatrixAt(k++, o.matrix);
      }
    mesh.instanceMatrix.needsUpdate = true;
  }, [mesh, cx, cz, r]);
  return <primitive object={mesh} />;
};

/** flight arc: start above/behind, land with snap overshoot (0.35 stud decaying over ~4 frames after landing) */
export const brickArc = (t01: number, from: [number, number, number], to: [number, number, number], arcH = 5): [number, number, number] => {
  const e = eio3(t01);
  const lift = Math.sin(Math.PI * Math.min(1, t01 * 1.05)) * arcH;
  return [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e + lift, from[2] + (to[2] - from[2]) * e];
};
export const snapOvershoot = (framesSinceLand: number) => (framesSinceLand < 0 ? 0 : 0.35 * Math.exp(-framesSinceLand / 1.8) * Math.cos(framesSinceLand * 0.9));
