import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame} from 'remotion';
import {resolveSrc} from './asset';
import {loadFont as loadInstrument} from '@remotion/google-fonts/InstrumentSerif';
import {loadFont as loadQuicksand} from '@remotion/google-fonts/Quicksand';
import {loadFont as loadTiltNeon} from '@remotion/google-fonts/TiltNeon';
import {loadFont as loadPlex} from '@remotion/google-fonts/IBMPlexMono';
import {loadFont as loadJBM} from '@remotion/google-fonts/JetBrainsMono';
import {clamp, lerp} from './ease';
import {fonts} from './fonts';
import {fbm, n2, rng} from './random';
import {smoothOpen} from './shapes';
import {useStage} from './stage';

/**
 * Shared helpers for the text/ family: extra font roles, width estimates (no DOM
 * measuring, so layouts are stable on the first frame), typing helpers, a monotone
 * keyframe interpolator and procedural backdrops that stand in for the source footage.
 */

loadInstrument('italic', {weights: ['400'], subsets: ['latin']});
const instrument = loadInstrument('normal', {weights: ['400'], subsets: ['latin']}).fontFamily;

export const tfonts = {
  ...fonts,
  /** high-contrast serif; use with fontStyle italic for video17 numerals */
  instrument,
  /** thin rounded sans (video1/6 "opus 5.5" signature) */
  rounded: loadQuicksand('normal', {weights: ['300', '500', '700'], subsets: ['latin']}).fontFamily,
  /** rounded neon-tube display (video20 NOODLES) */
  neon: loadTiltNeon('normal', {weights: ['400'], subsets: ['latin']}).fontFamily,
  /** IBM Plex Mono (video19 small labels) */
  plex: loadPlex('normal', {weights: ['400', '500', '700'], subsets: ['latin']}).fontFamily,
  /** JetBrains Mono light/extra-bold weights (video23 depth HUD, video19 logotype) */
  monoLight: loadJBM('normal', {weights: ['200', '300', '500', '800'], subsets: ['latin']}).fontFamily,
};
export type TFont = keyof typeof tfonts;

/** average advance width per em (lower-case / mixed text) */
const AVG: Record<TFont, number> = {
  sans: 0.55,
  display: 0.62,
  mono: 0.6,
  serif: 0.47,
  comic: 0.46,
  hand: 0.4,
  grotesk: 0.56,
  instrument: 0.45,
  rounded: 0.52,
  neon: 0.56,
  plex: 0.6,
  monoLight: 0.6,
};
const MONO = new Set<TFont>(['mono', 'plex', 'monoLight']);
/** how much wider an all-caps string is than mixed case */
const CAPS: Record<TFont, number> = {sans: 1.25, display: 1.1, mono: 1, serif: 1.5, comic: 1.1, hand: 1.3, grotesk: 1.25, instrument: 1.45, rounded: 1.3, neon: 1.2, plex: 1, monoLight: 1};

/** estimated rendered width of a single line in px (tracking in em) */
export const estWidth = (text: string, size: number, font: TFont = 'sans', tracking = 0) => {
  const chars = [...text];
  if (!chars.length) return 0;
  const upper = chars.filter((c) => /[A-Z0-9]/.test(c)).length / chars.length;
  const capBoost = MONO.has(font) ? 1 : 1 + (CAPS[font] - 1) * upper;
  const spaces = chars.filter((c) => c === ' ').length;
  const per = AVG[font] * capBoost;
  return size * (per * (chars.length - spaces) + 0.28 * spaces + tracking * chars.length);
};

/** font size that keeps `text` within `maxW` */
export const fitSize = (text: string, size: number, maxW: number, font: TFont = 'sans', tracking = 0) => {
  const wdt = estWidth(text, size, font, tracking);
  return wdt > maxW ? (size * maxW) / wdt : size;
};

/** how many characters are typed at `frame` (cps = characters per second at 30 fps) */
export const typed = (frame: number, start: number, cps: number) => Math.max(0, Math.floor(((frame - start) * cps) / 30));

/** block cursor visibility: solid while typing, blinking at `hz` when idle */
export const cursorOn = (frame: number, typing: boolean, hz = 1) => typing || Math.floor((frame * hz * 2) / 30) % 2 === 0;

/** deterministic 0..1 hash for (i, seed) */
export const hash01 = (i: number, seed: number | string = 1) => {
  const r = rng(`${seed}:${i}`);
  return r();
};

/** monotone cubic (Fritsch–Carlson) interpolation through [x, y] keys; clamps outside */
export const monotone = (keys: [number, number][], x: number) => {
  const k = [...keys].sort((a, b) => a[0] - b[0]);
  const n = k.length;
  if (n === 0) return 0;
  if (n === 1 || x <= k[0][0]) return k[0][1];
  if (x >= k[n - 1][0]) return k[n - 1][1];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((k[i + 1][1] - k[i][1]) / Math.max(1e-9, k[i + 1][0] - k[i][0]));
  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  let i = 0;
  while (i < n - 2 && x > k[i + 1][0]) i++;
  const hgt = k[i + 1][0] - k[i][0];
  const t = (x - k[i][0]) / hgt;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * k[i][1] + (t3 - 2 * t2 + t) * hgt * m[i] + (-2 * t3 + 3 * t2) * k[i + 1][1] + (t3 - t2) * hgt * m[i + 1];
};

/** easeOutCubic / easeInCubic shorthands used by the text motions */
export const eoc = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const eic = (t: number) => Math.pow(clamp(t), 3);
export const eioc = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** solid block cursor (video8 ▌, video17 red ▮) */
export const BlockCursor: React.FC<{visible: boolean; color: string; w: number; h: number; style?: React.CSSProperties}> = ({visible, color, w, h, style}) => (
  <span style={{display: 'inline-block', width: w, height: h, background: color, opacity: visible ? 1 : 0, verticalAlign: 'middle', marginLeft: w * 0.25, ...style}} />
);

/** corner crop marks (video17 HUD) */
export const CropMarks: React.FC<{color?: string; inset?: number; arm?: number; width?: number}> = ({color = '#888578', inset = 18, arm = 22, width = 2}) => {
  const {w, h, u} = useStage();
  const i = inset * u;
  const a = arm * u;
  const d = [
    `M${i},${i + a} V${i} H${i + a}`,
    `M${w - i - a},${i} H${w - i} V${i + a}`,
    `M${i},${h - i - a} V${h - i} H${i + a}`,
    `M${w - i - a},${h - i} H${w - i} V${h - i - a}`,
  ].join(' ');
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <path d={d} fill="none" stroke={color} strokeWidth={width * u} />
    </svg>
  );
};

// ---------------------------------------------------------------------------------------------
// Procedural backdrops (stand-ins for the source footage; every text motion paints one)
// ---------------------------------------------------------------------------------------------

export type BackdropKind = 'dunes' | 'peaks' | 'dusk' | 'comic' | 'aurora' | 'ocean' | 'warm' | 'cream' | 'ink' | 'none';

const ridge = (seed: string, w: number, base: number, amp: number, freq: number, shift: number, n = 64, sharp = 0, oct = 4): [number, number][] => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * (w * 1.1) - w * 0.05;
    let v = fbm(seed, (x + shift) * freq, 0.37, oct);
    if (sharp) v = lerp(v, 1 - Math.abs(v) * 2, sharp);
    pts.push([x, base - v * amp]);
  }
  return pts;
};
const closeDown = (d: string, w: number, h: number) => `${d} L ${w * 1.06} ${h + 10} L ${-w * 0.06} ${h + 10} Z`;

/** grey sky over soft white dunes (video8 NOISE stage) */
const Dunes: React.FC<{drift: number}> = ({drift}) => {
  const frame = useCurrentFrame();
  const {w, h, u} = useStage();
  const hz = h * 0.36;
  const layers = 7;
  const geo = Array.from({length: layers}, (_, i) => {
    const k = i / (layers - 1);
    const base = hz + 8 * u + Math.pow(k, 1.5) * h * 0.6;
    const amp = (10 + 120 * k * k) * u;
    return {k, base, amp};
  });
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="tk-dunes-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#787a83" />
          <stop offset="0.34" stopColor="#999aa2" />
          <stop offset="0.37" stopColor="#b9bac0" />
          <stop offset="1" stopColor="#b5b6ba" />
        </linearGradient>
        {geo.map((g, i) => (
          <linearGradient key={i} id={`tk-dune-${i}`} gradientUnits="userSpaceOnUse" x1="0" y1={g.base - g.amp} x2="0" y2={g.base + g.amp * 0.8 + 40 * u}>
            <stop offset="0" stopColor="#f4f4f5" />
            <stop offset="0.55" stopColor={i < 2 ? '#dcdcdf' : '#d4d4d7'} />
            <stop offset="1" stopColor={i < 2 ? '#c4c5c9' : '#a9aaaf'} />
          </linearGradient>
        ))}
        <filter id="tk-dune-soft">
          <feGaussianBlur stdDeviation={1.5 * u} />
        </filter>
      </defs>
      <rect width={w} height={h} fill="url(#tk-dunes-sky)" />
      {geo.map((g, i) => {
        const freq = 0.0021 / (0.45 + g.k * 1.4) / u;
        const shift = frame * drift * (0.3 + g.k * 2.2) * u;
        const d = closeDown(smoothOpen(ridge(`dune${i}`, w, g.base, g.amp, freq, shift, 40, 0, 2)), w, h);
        return <path key={i} d={d} fill={`url(#tk-dune-${i})`} filter={i < 2 ? 'url(#tk-dune-soft)' : undefined} />;
      })}
      <rect width={w} height={h} fill="#8d8e95" opacity={0.06} />
    </svg>
  );
};

/** sunrise over snowy peaks and a sea of clouds (video8 end card) */
const Peaks: React.FC<{drift: number}> = ({drift}) => {
  const frame = useCurrentFrame();
  const {w, h, u} = useStage();
  const S = Math.min(w, h);
  const hz = h * 0.52;
  const sunX = w * 0.56;
  const sunY = hz - S * 0.24;
  const t = frame * drift;
  const puffs = React.useMemo(() => {
    const r = rng('tk-puffs');
    return Array.from({length: 120}, (_, i) => ({x: r(), d: r(), s: r(), i}));
  }, []);
  const ranges = [
    {seed: 'pk-far', base: hz + 10 * u, amp: S * 0.1, freq: 0.0032, shift: 0.3, fill: 'url(#tk-pk-far)', op: 0.8},
    {seed: 'pk-mid', base: hz + S * 0.12, amp: S * 0.19, freq: 0.0021, shift: 0.7, fill: 'url(#tk-pk-m)', op: 1},
  ];
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="tk-pk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9b6c9" />
          <stop offset="0.32" stopColor="#e6e3d4" />
          <stop offset="0.5" stopColor="#f8dc7e" />
          <stop offset="0.6" stopColor="#f2b636" />
          <stop offset="1" stopColor="#8a6a34" />
        </linearGradient>
        <radialGradient id="tk-pk-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity={1} />
          <stop offset="0.12" stopColor="#fffbe8" stopOpacity={0.95} />
          <stop offset="0.45" stopColor="#ffeaa6" stopOpacity={0.35} />
          <stop offset="1" stopColor="#ffe9a0" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="tk-pk-far" gradientUnits="userSpaceOnUse" x1="0" y1={hz - S * 0.1} x2="0" y2={hz + 20 * u}>
          <stop offset="0" stopColor="#c9c3bf" />
          <stop offset="1" stopColor="#8f8c98" />
        </linearGradient>
        <linearGradient id="tk-pk-m" gradientUnits="userSpaceOnUse" x1="0" y1={hz + S * 0.12 - S * 0.19} x2="0" y2={hz + S * 0.12}>
          <stop offset="0" stopColor="#efeae0" />
          <stop offset="0.2" stopColor="#9a929a" />
          <stop offset="0.5" stopColor="#4a4553" />
          <stop offset="1" stopColor="#2e2c36" />
        </linearGradient>
        <linearGradient id="tk-pk-lit" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1d1b26" stopOpacity={0.35} />
          <stop offset="0.55" stopColor="#ffd27a" stopOpacity={0.0} />
          <stop offset="1" stopColor="#ffcf7a" stopOpacity={0.22} />
        </linearGradient>
        <radialGradient id="tk-pk-puff" cx="0.45" cy="0.3" r="0.65">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset="0.7" stopColor="#efd18b" />
          <stop offset="1" stopColor="#d2ad6c" />
        </radialGradient>
        <radialGradient id="tk-pk-puff2" cx="0.45" cy="0.3" r="0.65">
          <stop offset="0" stopColor="#e2c58a" />
          <stop offset="0.7" stopColor="#b08d57" />
          <stop offset="1" stopColor="#8d6f45" />
        </radialGradient>
        <filter id="tk-pk-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={13 * u} />
        </filter>
        <filter id="tk-pk-haze">
          <feGaussianBlur stdDeviation={1.5 * u} />
        </filter>
      </defs>
      <rect width={w} height={h} fill="url(#tk-pk-sky)" />
      <circle cx={sunX} cy={sunY} r={S * 0.55} fill="url(#tk-pk-sun)" />
      {ranges.map((r, i) => (
        <path key={i} d={closeDown(smoothOpen(ridge(r.seed, w, r.base, r.amp, r.freq / u, t * r.shift * u, 90, 0.9)), w, h)} fill={r.fill} opacity={r.op} filter={i === 0 ? 'url(#tk-pk-haze)' : undefined} />
      ))}
      <g filter="url(#tk-pk-soft)">
        {puffs.map((pf) => {
          const span = w * 1.4;
          const x = ((((pf.x * span - t * (0.6 + pf.d * 1.6) * u) % span) + span) % span) - w * 0.2;
          const y = hz + S * 0.1 + Math.pow(pf.d, 0.9) * (h - hz) * 0.85;
          const r = (40 + 70 * pf.s) * u * (0.7 + pf.d * 1.2);
          return <ellipse key={pf.i} cx={x} cy={y} rx={r * 2.3} ry={r * 0.75} fill={pf.d > 0.55 ? 'url(#tk-pk-puff2)' : 'url(#tk-pk-puff)'} opacity={0.95} />;
        })}
      </g>
      <path d={closeDown(smoothOpen(ridge('pk-fg', w, h * 1.02, S * 0.16, 0.0015 / u, t * 2 * u, 40, 0.8)), w, h)} fill="#29241f" opacity={0.9} />
    </svg>
  );
};

/** woodblock-print dusk: blue sky to vermilion horizon, aqueduct and ruined columns (video10) */
const Column: React.FC<{x: number; base: number; cw: number; ch: number; broken: boolean; u: number; fill: string; light: string}> = ({x, base, cw, ch, broken, u, fill, light}) => {
  const flutes = 4;
  const top = base - ch;
  return (
    <g>
      <rect x={x - cw * 0.65} y={base - cw * 0.35} width={cw * 1.3} height={cw * 0.35} fill={fill} />
      <rect x={x - cw * 0.5} y={top} width={cw} height={ch} fill={fill} />
      {Array.from({length: flutes}, (_, i) => (
        <rect key={i} x={x - cw * 0.5 + ((i + 0.5) * cw) / flutes - 1 * u} y={top + cw * 0.3} width={2 * u} height={ch - cw * 0.7} fill={light} opacity={0.35} />
      ))}
      <rect x={x + cw * 0.18} y={top} width={cw * 0.32} height={ch} fill={light} opacity={0.18} />
      {broken ? (
        <path d={`M${x - cw * 0.5} ${top} L${x - cw * 0.2} ${top - cw * 0.35} L${x + cw * 0.1} ${top - cw * 0.1} L${x + cw * 0.5} ${top - cw * 0.45} L${x + cw * 0.5} ${top} Z`} fill={fill} />
      ) : (
        <g fill={fill}>
          <rect x={x - cw * 0.75} y={top - cw * 0.28} width={cw * 1.5} height={cw * 0.28} />
          <path d={`M${x - cw * 0.6} ${top} Q ${x} ${top + cw * 0.35} ${x + cw * 0.6} ${top} Z`} />
        </g>
      )}
    </g>
  );
};

const Dusk: React.FC<{drift: number}> = ({drift}) => {
  const frame = useCurrentFrame();
  const {w, h, u} = useStage();
  const hz = h * 0.6;
  const t = frame * drift;
  const S = Math.min(w, h);
  const arches = 9;
  const aqW = w * 1.3;
  const aqTop = hz - S * 0.11;
  const archW = aqW / arches;
  let aq = `M ${-w * 0.15} ${hz + 4 * u} L ${-w * 0.15} ${aqTop}`;
  aq += ` L ${-w * 0.15 + aqW} ${aqTop} L ${-w * 0.15 + aqW} ${hz + 4 * u} Z`;
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="tk-dk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f3a63" />
          <stop offset="0.32" stopColor="#47689a" />
          <stop offset="0.5" stopColor="#c9b394" />
          <stop offset="0.57" stopColor="#ec9a62" />
          <stop offset="0.62" stopColor="#d4583a" />
        </linearGradient>
        <linearGradient id="tk-dk-ground" gradientUnits="userSpaceOnUse" x1="0" y1={hz} x2="0" y2={h}>
          <stop offset="0" stopColor="#3d5680" />
          <stop offset="0.35" stopColor="#5d6f86" />
          <stop offset="0.6" stopColor="#2b3a56" />
          <stop offset="1" stopColor="#1b2438" />
        </linearGradient>
        <radialGradient id="tk-dk-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe3b0" stopOpacity={0.9} />
          <stop offset="1" stopColor="#ffb070" stopOpacity={0} />
        </radialGradient>
        <filter id="tk-dk-cloud" x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation={6 * u} />
        </filter>
        <filter id="tk-dk-grain">
          <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={4} />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.4" />
          </feComponentTransfer>
        </filter>
        <mask id="tk-dk-arch">
          <rect x={-w} y={0} width={w * 3} height={h} fill="#fff" />
          {Array.from({length: arches}, (_, i) => {
            const ax = -w * 0.15 + (i + 0.5) * archW;
            const r = archW * 0.32;
            const y0 = aqTop + S * 0.03;
            return <path key={i} d={`M ${ax - r} ${hz + 6 * u} L ${ax - r} ${y0 + r} A ${r} ${r} 0 0 1 ${ax + r} ${y0 + r} L ${ax + r} ${hz + 6 * u} Z`} fill="#000" />;
          })}
        </mask>
      </defs>
      <rect width={w} height={h} fill="url(#tk-dk-sky)" />
      <ellipse cx={w * 0.62} cy={hz - S * 0.02} rx={S * 0.7} ry={S * 0.28} fill="url(#tk-dk-sun)" />
      <g filter="url(#tk-dk-cloud)" opacity={0.75}>
        {Array.from({length: 7}, (_, i) => {
          const r = rng(`dkc${i}`);
          const cx = ((r() * w * 1.3 - t * 0.25 * u * (1 + r())) % (w * 1.3) + w * 1.3) % (w * 1.3) - w * 0.15;
          const cy = h * (0.12 + r() * 0.32);
          return <ellipse key={i} cx={cx} cy={cy} rx={(120 + r() * 200) * u} ry={(10 + r() * 14) * u} fill={cy > h * 0.33 ? '#f2c9a0' : '#9fb3cf'} />;
        })}
      </g>
      <path d={closeDown(smoothOpen(ridge('dk-hills', w, hz - 6 * u, 40 * u, 0.0024 / u, t * 0.2 * u, 50)), w, h)} fill="#5a7398" opacity={0.85} />
      <g transform={`translate(${-t * 0.4 * u} 0)`}>
        <path d={aq} fill="#587399" mask="url(#tk-dk-arch)" />
        <rect x={-w * 0.15} y={aqTop - 6 * u} width={aqW} height={6 * u} fill="#587399" />
      </g>
      <path d={closeDown(smoothOpen(ridge('dk-city', w, hz + 26 * u, 18 * u, 0.006 / u, t * 0.6 * u, 90)), w, h)} fill="url(#tk-dk-ground)" />
      {Array.from({length: 18}, (_, i) => {
        const r = rng(`blk${i}`);
        const bw = (40 + r() * 70) * u;
        const bh = (14 + r() * 50) * u;
        const x = (((i / 18) * w * 1.3 - t * 0.6 * u) % (w * 1.3) + w * 1.3) % (w * 1.3) - w * 0.15;
        return <rect key={i} x={x} y={hz + 30 * u - bh} width={bw} height={bh + 40 * u} fill="#2a3c5b" />;
      })}
      <path d={closeDown(smoothOpen(ridge('dk-near', w, h * 0.84, 30 * u, 0.003 / u, t * 1.2 * u, 50)), w, h)} fill="#1f2a40" />
      <g transform={`translate(${-t * 1.2 * u} 0)`}>
        <Column x={w * 0.07} base={h * 0.86} cw={S * 0.055} ch={h * 0.42} broken={false} u={u} fill="#1a2234" light="#c98a63" />
        <Column x={w * 0.17} base={h * 0.86} cw={S * 0.05} ch={h * 0.33} broken u={u} fill="#1a2234" light="#c98a63" />
        <Column x={w * 0.9} base={h * 0.88} cw={S * 0.045} ch={h * 0.22} broken u={u} fill="#1a2234" light="#c98a63" />
        {Array.from({length: 6}, (_, i) => {
          const r = rng(`rub${i}`);
          return <rect key={i} x={w * (0.25 + r() * 0.6)} y={h * (0.86 + r() * 0.05)} width={(20 + r() * 50) * u} height={(10 + r() * 18) * u} fill="#161d2c" transform={`rotate(${r() * 20 - 10})`} />;
        })}
      </g>
      <rect y={h * 0.9} width={w} height={h * 0.1} fill="#121826" />
      <rect width={w} height={h} filter="url(#tk-dk-grain)" style={{mixBlendMode: 'multiply'}} />
    </svg>
  );
};

/** saturated comic-room palette with halftone dots (video12) */
const Comic: React.FC<{drift: number}> = ({drift}) => {
  const frame = useCurrentFrame();
  const {w, h, u} = useStage();
  const dot = 9 * u;
  const sway = Math.sin(frame * 0.02 * drift * 10) * 20 * u;
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="tk-cm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a2aa6" />
          <stop offset="0.5" stopColor="#6a3cc8" />
          <stop offset="1" stopColor="#d9508f" />
        </linearGradient>
        <pattern id="tk-cm-dots" width={dot} height={dot} patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
          <circle cx={dot / 2} cy={dot / 2} r={dot * 0.24} fill="#1b0f4a" />
        </pattern>
        <pattern id="tk-cm-dots2" width={dot} height={dot} patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
          <circle cx={dot / 2} cy={dot / 2} r={dot * 0.3} fill="#ffd1ec" />
        </pattern>
        <radialGradient id="tk-cm-light" cx="0.7" cy="0.25" r="0.6">
          <stop offset="0" stopColor="#ffb3d6" stopOpacity={0.7} />
          <stop offset="1" stopColor="#ffb3d6" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#tk-cm-bg)" />
      {/* wall panels / floor */}
      <rect x={w * 0.62 + sway} y={h * 0.08} width={w * 0.22} height={h * 0.38} fill="#f08bb8" opacity={0.55} rx={8 * u} />
      <rect x={w * 0.64 + sway} y={h * 0.1} width={w * 0.18} height={h * 0.34} fill="#ffd36e" opacity={0.35} />
      <path d={`M0 ${h * 0.68} L ${w} ${h * 0.6} L ${w} ${h} L 0 ${h} Z`} fill="#2a1f86" />
      <path d={`M0 ${h * 0.68} L ${w} ${h * 0.6} L ${w} ${h * 0.63} L 0 ${h * 0.71} Z`} fill="#8d6cf0" opacity={0.7} />
      {Array.from({length: 9}, (_, i) => (
        <line key={i} x1={w * (i / 8)} y1={h * (0.68 - 0.08 * (i / 8))} x2={w * (i / 8) * 1.6 - w * 0.3} y2={h} stroke="#4a3bc0" strokeWidth={3 * u} />
      ))}
      <rect width={w} height={h} fill="url(#tk-cm-light)" />
      <rect width={w} height={h} fill="url(#tk-cm-dots)" opacity={0.28} />
      <rect x={w * 0.55} y={0} width={w * 0.45} height={h * 0.5} fill="url(#tk-cm-dots2)" opacity={0.18} />
    </svg>
  );
};

/** pixel-art aurora night over the sea (video21) */
const Aurora: React.FC<{drift: number}> = ({drift}) => {
  const frame = useCurrentFrame();
  const {w, h, u} = useStage();
  const px = 8 * u;
  const hz = h * 0.62;
  const cols = Math.ceil(w / px);
  const stars = React.useMemo(() => {
    const r = rng('tk-stars');
    return Array.from({length: 70}, () => ({x: r(), y: r() * 0.55, b: r()}));
  }, []);
  const t = frame * drift * 0.05;
  const curtains: React.ReactNode[] = [];
  for (let c = 0; c < cols; c += 1) {
    const x = c * px;
    const v = n2('aur', c * 0.035, t) * 0.5 + 0.5;
    const v2 = n2('aur2', c * 0.09, t * 1.6) * 0.5 + 0.5;
    const top = h * (0.08 + 0.18 * v2);
    const len = h * (0.18 + 0.32 * v);
    const steps = 6;
    for (let s = 0; s < steps; s++) {
      const y0 = Math.round((top + (len * s) / steps) / px) * px;
      const band = Math.pow(clamp(n2('aurB', c * 0.012, t * 0.5) * 0.9 + 0.55), 2.2);
      const op = (0.04 + 0.75 * Math.pow(v, 1.6) * band) * (1 - s / steps) * (s === 0 ? 0.6 : 1);
      curtains.push(<rect key={`${c}-${s}`} x={x} y={y0} width={px} height={Math.ceil(len / steps / px) * px} fill={s < 2 ? '#7ff2c2' : '#2fae8a'} opacity={op} />);
    }
  }
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}} shapeRendering="crispEdges">
      <defs>
        <linearGradient id="tk-au-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b2427" />
          <stop offset="0.6" stopColor="#14453f" />
          <stop offset="1" stopColor="#1c3a4a" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="url(#tk-au-sky)" />
      {stars.map((s, i) => (
        <rect key={i} x={Math.round((s.x * w) / px) * px} y={Math.round((s.y * h) / px) * px} width={px / 2} height={px / 2} fill="#d9fff1" opacity={0.3 + 0.7 * Math.abs(Math.sin(frame * 0.07 + s.b * 9))} />
      ))}
      {curtains}
      <rect y={hz} width={w} height={h - hz} fill="#0f1c33" />
      {Array.from({length: 14}, (_, i) => {
        const r = rng(`floe${i}`);
        const fw = Math.round(((60 + r() * 220) * u) / px) * px;
        const fx = Math.round(((r() * w * 1.2 - w * 0.1 - frame * drift * 0.5 * u) % (w * 1.2)) / px) * px;
        const fy = Math.round((hz + (0.02 + r() * 0.3) * h) / px) * px;
        return <rect key={i} x={fx} y={fy} width={fw} height={px * (1 + Math.floor(r() * 2))} fill={r() > 0.5 ? '#2c7f75' : '#3d6f88'} opacity={0.8} />;
      })}
      {/* distant ship silhouette */}
      <g fill="#1d1712">
        <rect x={w * 0.38} y={hz - 7 * px} width={w * 0.26} height={6 * px} />
        <rect x={w * 0.45} y={hz - 13 * px} width={3 * px} height={6 * px} />
        {[0.42, 0.52, 0.6].map((m, i) => (
          <rect key={i} x={w * m} y={hz - 7 * px - h * 0.28} width={px * 0.75} height={h * 0.28} />
        ))}
      </g>
      {Array.from({length: 9}, (_, i) => (
        <rect key={i} x={w * 0.4 + i * w * 0.025} y={hz - 4 * px} width={px * 0.75} height={px * 0.75} fill="#f0b45e" opacity={0.9} />
      ))}
    </svg>
  );
};

/** deep ocean water column; `depth` 0 (surface) .. 1 (abyss) (video23) */
export const OceanBackdrop: React.FC<{depth?: number; snow?: boolean}> = ({depth = 0.2, snow = true}) => {
  const frame = useCurrentFrame();
  const {w, h, u} = useStage();
  const d = clamp(depth);
  const top = mixHex('#3fa0bf', '#03080d', Math.pow(d, 0.6));
  const bot = mixHex('#0b3d55', '#010305', Math.pow(d, 0.5));
  const parts = React.useMemo(() => {
    const r = rng('tk-snow');
    return Array.from({length: 120}, () => ({x: r(), y: r(), s: r(), v: 0.3 + r()}));
  }, []);
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="tk-oc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bot} />
        </linearGradient>
        <linearGradient id="tk-oc-ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bff3ff" stopOpacity={0.35} />
          <stop offset="1" stopColor="#bff3ff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="url(#tk-oc)" />
      {d < 0.5 &&
        Array.from({length: 6}, (_, i) => {
          const x = w * (0.1 + i * 0.17) + Math.sin(frame * 0.02 + i) * 30 * u;
          return <path key={i} d={`M${x} 0 L${x + 60 * u} 0 L${x + 260 * u} ${h} L${x + 120 * u} ${h} Z`} fill="url(#tk-oc-ray)" opacity={(1 - d * 2) * (0.4 + 0.3 * Math.sin(frame * 0.05 + i * 1.7))} />;
        })}
      {snow &&
        parts.map((p, i) => {
          const y = ((p.y * h - frame * p.v * 1.2 * u) % h + h) % h;
          const x = p.x * w + Math.sin(frame * 0.03 + i) * 6 * u;
          return <circle key={i} cx={x} cy={y} r={(0.8 + p.s * 2.2) * u} fill="#d8f1ff" opacity={0.12 + p.s * 0.3} />;
        })}
    </svg>
  );
};

/** dark warm interior lit by a candle pool with dust motes (video14 Rembrandt era) */
const Warm: React.FC<{drift: number}> = ({drift}) => {
  const frame = useCurrentFrame();
  const {w, h, u} = useStage();
  const motes = React.useMemo(() => {
    const r = rng('tk-motes');
    return Array.from({length: 60}, () => ({x: r(), y: r(), s: r()}));
  }, []);
  const flick = 1 + 0.04 * Math.sin(frame * 0.6) + 0.03 * Math.sin(frame * 1.7);
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="tk-wm-pool" cx="0.35" cy="0.62" r="0.55">
          <stop offset="0" stopColor="#c9883a" stopOpacity={0.85} />
          <stop offset="0.45" stopColor="#5a3a1c" stopOpacity={0.6} />
          <stop offset="1" stopColor="#120c08" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="#17110c" />
      <rect y={h * 0.66} width={w} height={h * 0.34} fill="#241910" />
      {Array.from({length: 7}, (_, i) => (
        <line key={i} x1={0} y1={h * (0.7 + i * 0.045)} x2={w} y2={h * (0.7 + i * 0.045)} stroke="#38281a" strokeWidth={2 * u} />
      ))}
      <path d={`M${w * 0.5} ${h * 0.66} V ${h * 0.25} A ${w * 0.1} ${w * 0.1} 0 0 1 ${w * 0.7} ${h * 0.25} V ${h * 0.66} Z`} fill="#0d0907" />
      <rect x={w * 0.08} y={h * 0.14} width={w * 0.12} height={h * 0.28} fill="#2a1e13" stroke="#4d3920" strokeWidth={6 * u} />
      <rect width={w} height={h} fill="url(#tk-wm-pool)" opacity={flick} />
      {motes.map((m, i) => {
        const x = m.x * w + Math.sin(frame * 0.01 * drift * 40 + i) * 20 * u;
        const y = ((m.y * h - frame * 0.25 * u * (0.5 + m.s)) % h + h) % h;
        return <circle key={i} cx={x} cy={y} r={(1 + m.s * 1.8) * u} fill="#f3d9a4" opacity={0.15 + 0.35 * m.s * (1 - Math.abs(m.x - 0.35))} />;
      })}
    </svg>
  );
};

const Ink: React.FC = () => {
  const {w, h, u} = useStage();
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="tk-ink-v" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0" stopColor="#0f1118" />
          <stop offset="1" stopColor="#05060a" />
        </radialGradient>
        <pattern id="tk-ink-scan" width={4 * u} height={4 * u} patternUnits="userSpaceOnUse">
          <rect width={4 * u} height={1 * u} fill="#15161B" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#tk-ink-v)" />
      <rect width={w} height={h} fill="url(#tk-ink-scan)" opacity={0.6} />
    </svg>
  );
};

/** full-frame backdrop: a public/ image with a slow push, or a procedural stand-in */
export const Backdrop: React.FC<{kind: BackdropKind; src?: string; drift?: number; color?: string; depth?: number; push?: number}> = ({kind, src, drift = 1, color, depth, push = 0.06}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useStage();
  if (src) {
    const s = 1 + push * (frame / Math.max(1, durationInFrames));
    return (
      <AbsoluteFill style={{background: color ?? '#000', overflow: 'hidden'}}>
        <Img src={resolveSrc(src)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${s})`}} />
      </AbsoluteFill>
    );
  }
  // 'none' with no colour = transparent, so text motions can sit on top of other layers / host content
  return (
    <AbsoluteFill style={{background: color ?? (kind === 'none' ? 'transparent' : '#000')}}>
      {kind === 'dunes' && <Dunes drift={drift} />}
      {kind === 'peaks' && <Peaks drift={drift} />}
      {kind === 'dusk' && <Dusk drift={drift} />}
      {kind === 'comic' && <Comic drift={drift} />}
      {kind === 'aurora' && <Aurora drift={drift} />}
      {kind === 'ocean' && <OceanBackdrop depth={depth} />}
      {kind === 'warm' && <Warm drift={drift} />}
      {kind === 'cream' && <AbsoluteFill style={{background: color ?? '#EEEBDE'}} />}
      {kind === 'ink' && <Ink />}
    </AbsoluteFill>
  );
};

/** mix two #rrggbb colours */
export const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (sh: number) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, clamp(t)));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
};
