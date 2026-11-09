/**
 * r2-pr1-kit — shared helpers for the PR-1 batch (prompt-corpus techniques): kinetic-type-slam, character-rig-2d,
 * timeline-ruler, cursor-driver, pixel-sprite-scene, flow-diagram, card-stack-cascade, match-cut, ui-shape-morph,
 * paper-cutout-layers. Everything is a pure function of the frame (no canvas, no timers, no Math.random).
 *
 *  - text measuring (canvas measureText at render time, with a safe fallback)
 *  - cursor timeline: keyframes in % of the frame -> position / press / ripple / typed text, and `cursorEvents()` so
 *    host motions can key their own reactions off the click frames
 *  - closed-form spring step sums (many target changes, one value)
 *  - a small stroke icon set shared by cards / diagrams
 *  - pixel-art grids -> merged SVG rects
 *  - paper layers: deckled edge + soft drop shadow + a `paperShapes()` shape set
 */
import React from 'react';
import {Easing, spring, useCurrentFrame} from 'remotion';
import {clamp} from './ease';
import {useStage} from './stage';

// =================================================================================================================
// text measuring
// =================================================================================================================
let _ctx: CanvasRenderingContext2D | null | undefined;
const cleanFamily = (f: string) => f.replace(/^['"]|['"]$/g, '').split(',')[0].replace(/['"]/g, '').trim();

/** width in px of `text` at `size` px (measured with canvas when available; never cached across frames) */
export const measureText = (text: string, family: string, size: number, weight: number | string = 400) => {
  if (typeof document !== 'undefined') {
    if (_ctx === undefined) _ctx = document.createElement('canvas').getContext('2d');
    if (_ctx) {
      _ctx.font = `${weight} ${size}px "${cleanFamily(family)}", sans-serif`;
      const m = _ctx.measureText(text).width;
      if (m > 0) return m;
    }
  }
  return text.length * size * 0.62;
};

// =================================================================================================================
// maths
// =================================================================================================================
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** the UI move curve measured in the corpus: cubic-bezier(0.45, 0, 0.2, 1) */
export const uiMove = Easing.bezier(0.45, 0, 0.2, 1);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

export type SpringCfg = {damping: number; stiffness: number; mass?: number};
/** critically damped (≤ 3 % overshoot) spring used by the UI morphs */
export const CRIT: SpringCfg = {damping: 26, stiffness: 220, mass: 1};

/**
 * value of a quantity that jumps to a new target at each `times[i]`: sum of closed-form spring step responses,
 * so overlapping changes blend naturally. `values[0]` is the initial value (settled before times[0]).
 */
export const springSum = (frame: number, fps: number, times: number[], values: number[], cfg: SpringCfg | ((i: number, delta: number) => SpringCfg) = CRIT) => {
  let v = values[0] ?? 0;
  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (delta === 0) continue;
    const c = typeof cfg === 'function' ? cfg(i, delta) : cfg;
    const age = frame - (times[i - 1] ?? 0);
    if (age <= 0) continue;
    v += delta * spring({frame: age, fps, config: {damping: c.damping, stiffness: c.stiffness, mass: c.mass ?? 1}});
  }
  return v;
};

// =================================================================================================================
// cursor timeline
// =================================================================================================================
export type CursorAction = 'move' | 'click' | 'drag' | 'type';
export type CursorKey = {
  /** frame at which the cursor ARRIVES at (x, y) (and the click / typing begins) */
  frame: number;
  /** position in % of the frame */
  x: number;
  y: number;
  action?: CursorAction;
  /** text to type (action 'type') */
  text?: string;
  /** free label so a host can tell what was operated ('button', 'slider'...) */
  target?: string;
};

export type CursorEvent = {kind: 'click' | 'drag' | 'type'; frame: number; end: number; x: number; y: number; target?: string; text?: string};

const HOP = 18;
const actionLen = (k: CursorKey) => (k.action === 'click' ? 9 : k.action === 'type' ? (k.text?.length ?? 0) * 2 + 10 : k.action === 'drag' ? 4 : 0);

type Seg = {t0: number; t1: number; from: [number, number]; to: [number, number]; held: boolean; bow: number};
const buildSegs = (keys: CursorKey[]): Seg[] => {
  const segs: Seg[] = [];
  let prevEnd = keys[0]?.frame ?? 0;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    const p = keys[i - 1];
    const arrive = Math.max(k.frame, prevEnd + 4);
    const t0 = Math.max(prevEnd, arrive - HOP);
    segs.push({t0, t1: arrive, from: [p.x, p.y], to: [k.x, k.y], held: k.action === 'drag', bow: i % 2 ? 1 : -1});
    prevEnd = arrive + actionLen(k);
  }
  return segs;
};

/** every operated moment of a cursor track — host motions use this to key their own reactions */
export const cursorEvents = (keys: CursorKey[]): CursorEvent[] => {
  const out: CursorEvent[] = [];
  let prevEnd = keys[0]?.frame ?? 0;
  keys.forEach((k, i) => {
    const arrive = i === 0 ? k.frame : Math.max(k.frame, prevEnd + 4);
    const len = actionLen(k);
    if (k.action === 'click' || k.action === 'drag' || k.action === 'type') out.push({kind: k.action, frame: arrive, end: arrive + len, x: k.x, y: k.y, target: k.target, text: k.text});
    prevEnd = arrive + len;
  });
  return out;
};

export type CursorState = {
  /** position in px */
  x: number;
  y: number;
  /** 0..1 press amount (1 = fully pressed) */
  press: number;
  /** ripples: age in frames + origin px */
  ripples: {age: number; x: number; y: number}[];
  /** typed text so far when the cursor is typing */
  typing: {text: string; full: string; target?: string} | null;
  /** true while moving (so idle drift can be applied when false) */
  moving: boolean;
  /** drag in progress: 0..1 along its path, plus target */
  drag: {p: number; target?: string} | null;
};

/** evaluate the cursor at `frame` for a frame of w×h px (keys in %) */
export const cursorAt = (keys: CursorKey[], frame: number, w: number, h: number): CursorState => {
  if (!keys.length) return {x: w / 2, y: h / 2, press: 0, ripples: [], typing: null, moving: false, drag: null};
  const segs = buildSegs(keys);
  const evs = cursorEvents(keys);
  const px = (p: [number, number]): [number, number] => [(p[0] / 100) * w, (p[1] / 100) * h];
  let pos = px([keys[0].x, keys[0].y]);
  let moving = false;
  let drag: CursorState['drag'] = null;
  for (const s of segs) {
    if (frame >= s.t1) {
      pos = px(s.to);
      continue;
    }
    if (frame >= s.t0) {
      const a = px(s.from);
      const b = px(s.to);
      const p = uiMove(clamp01((frame - s.t0) / Math.max(1, s.t1 - s.t0)));
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const bow = s.held ? 0 : 0.07 * s.bow;
      const cxp = (a[0] + b[0]) / 2 - dy * bow;
      const cyp = (a[1] + b[1]) / 2 + dx * bow;
      const q = 1 - p;
      pos = [q * q * a[0] + 2 * q * p * cxp + p * p * b[0], q * q * a[1] + 2 * q * p * cyp + p * p * b[1]];
      moving = true;
      if (s.held) drag = {p, target: evs.find((e) => e.kind === 'drag' && Math.abs(e.frame - s.t1) < 1)?.target};
    }
    break;
  }
  // press amount: click = 6-frame dip, drag = held through its move
  let press = 0;
  const ripples: CursorState['ripples'] = [];
  let typing: CursorState['typing'] = null;
  for (const e of evs) {
    const age = frame - e.frame;
    if (e.kind === 'click') {
      if (age >= 0 && age < 6) press = Math.max(press, Math.sin((age / 6) * Math.PI));
      if (age >= 0 && age < 16) ripples.push({age, x: (e.x / 100) * w, y: (e.y / 100) * h});
    } else if (e.kind === 'drag') {
      const seg = segs.find((s) => s.held && Math.abs(s.t1 - e.frame) < 1);
      if (seg && frame >= seg.t0 && frame <= seg.t1 + 3) press = Math.max(press, 1);
      if (age >= 0 && age < 16) ripples.push({age, x: (e.x / 100) * w, y: (e.y / 100) * h});
    } else if (e.kind === 'type' && age >= 0) {
      const full = e.text ?? '';
      typing = {text: full.slice(0, clamp(Math.floor((age - 2) / 2), 0, full.length)), full, target: e.target};
    }
  }
  return {x: pos[0], y: pos[1], press, ripples, typing, moving, drag};
};

/** hook for host motions: the cursor's current state + the list of operated moments (clicks, drags, typing) */
export const useCursorEvents = (keys: CursorKey[]) => {
  const frame = useCurrentFrame();
  const {w, h} = useStage();
  return {events: cursorEvents(keys), state: cursorAt(keys, frame, w, h)};
};

/** macOS-style arrow, hand or touch dot. Drawn with its tip at (0,0); size in px of the arrow height. */
export const CursorGlyph: React.FC<{style: 'arrow' | 'hand' | 'touch'; size: number; color: string; press: number; rippleColor: string}> = ({style, size, color, press, rippleColor}) => {
  const s = size / 20;
  const sc = 1 - 0.12 * press;
  if (style === 'touch') {
    return (
      <g transform={`scale(${1 - 0.18 * press})`}>
        <circle r={size * 0.9} fill={rippleColor} opacity={0.28} />
        <circle r={size * 0.9} fill="none" stroke={color} strokeWidth={size * 0.08} opacity={0.75} />
        <circle r={size * 0.26} fill={color} opacity={0.9} />
      </g>
    );
  }
  if (style === 'hand') {
    return (
      <g transform={`scale(${s * sc}) translate(-7 -1)`} strokeLinejoin="round">
        <path
          d="M7 1.2c1 0 1.8.8 1.8 1.8v6.2l.4-.1c.9-.2 1.7.3 1.9 1.1l.5-.1c.9-.1 1.6.4 1.8 1.2l.3-.1c.9-.1 1.6.5 1.8 1.4.2 1.5.3 3-.3 4.8-.5 1.5-1.4 2.6-1.6 3.5H8.6c-.7-1.2-2.8-4.4-4-6.6-.5-.9.1-1.8 1-1.8.5 0 1 .2 1.4.7l.6.7V3c0-1 .5-1.8 1.4-1.8z"
          fill={color === '#111' || color === '#111111' ? '#fff' : '#fff'}
          stroke={color}
          strokeWidth={1.2}
        />
      </g>
    );
  }
  return (
    <g transform={`scale(${s * sc})`}>
      <path d="M0.5 0.5 L0.5 16.5 L4.6 12.9 L7.2 19 L9.8 17.9 L7.2 11.9 L12.6 11.9 Z" fill={color} stroke="#fff" strokeWidth={1.3} strokeLinejoin="round" />
    </g>
  );
};

/** an expanding ripple ring for a click (0 -> 48u, opacity .35 -> 0) */
export const RippleRing: React.FC<{x: number; y: number; age: number; u: number; color: string}> = ({x, y, age, u, color}) => {
  const t = clamp01(age / 14);
  return <circle cx={x} cy={y} r={48 * u * (1 - Math.pow(1 - t, 3))} fill="none" stroke={color} strokeWidth={3 * u} opacity={0.35 * (1 - t)} />;
};

// =================================================================================================================
// icons (24 grid, stroked)
// =================================================================================================================
export const ICON_NAMES = ['bolt', 'shield', 'chart', 'chat', 'globe', 'spark', 'lock', 'cog', 'user', 'db', 'cloud', 'star', 'queue', 'server', 'mail', 'check', 'play'] as const;

const ICON_PATHS: Record<string, React.ReactNode> = {
  bolt: <path d="M13 3 5 13.5h6L10 21l9-11h-6.2z" />,
  shield: <path d="M12 3 5 6v5.5c0 4.2 2.7 7.6 7 9.5 4.3-1.9 7-5.3 7-9.5V6z" />,
  chart: <path d="M4 20V4M4 20h16M8 16v-5M12.5 16V8M17 16v-8" />,
  chat: <path d="M4 5.5h16v10H12l-4.5 3.7V15.5H4z" />,
  globe: (
    <>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.100-3.800 8.500c-2.600-2.400-3.800-5.200-3.800-8.500s1.200-6.100 3.800-8.500z" />
    </>
  ),
  spark: <path d="M12 3.5c.6 4.6 2.400 6.400 7 7-4.600.6-6.400 2.400-7 7-.6-4.600-2.400-6.400-7-7 4.600-.6 6.400-2.400 7-7z" />,
  lock: (
    <>
      <rect x={5} y={10.5} width={14} height={9.5} rx={2.200} />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.500" />
    </>
  ),
  cog: (
    <>
      <circle cx={12} cy={12} r={3} />
      <path d="M12 3.500v2.600M12 17.900v2.600M3.500 12h2.600M17.900 12h2.600M6 6l1.800 1.800M16.200 16.200 18 18M18 6l-1.800 1.800M7.800 16.200 6 18" />
    </>
  ),
  user: (
    <>
      <circle cx={12} cy={8.500} r={3.800} />
      <path d="M4.500 20c.7-3.900 3.700-6 7.500-6s6.800 2.100 7.500 6" />
    </>
  ),
  db: (
    <>
      <ellipse cx={12} cy={6} rx={7} ry={2.800} />
      <path d="M5 6v12c0 1.500 3.100 2.800 7 2.800s7-1.300 7-2.800V6M5 12c0 1.500 3.100 2.800 7 2.800s7-1.300 7-2.800" />
    </>
  ),
  cloud: <path d="M7 18.500a4.500 4.500 0 0 1-.6-8.900A6 6 0 0 1 18 9.500a4.600 4.600 0 0 1-.5 9z" />,
  star: <path d="m12 3.500 2.700 5.600 6.100.8-4.500 4.200 1.100 6-5.400-3-5.400 3 1.100-6-4.500-4.200 6.100-.8z" />,
  queue: <path d="M4 7h16M4 12h16M4 17h10M17 15.500l2.500 1.500-2.500 1.500" />,
  server: (
    <>
      <rect x={4} y={4.500} width={16} height={6} rx={1.800} />
      <rect x={4} y={13.500} width={16} height={6} rx={1.800} />
      <path d="M7.500 7.500h.01M7.500 16.500h.01" />
    </>
  ),
  mail: (
    <>
      <rect x={3.500} y={5.500} width={17} height={13} rx={2} />
      <path d="m4 7.500 8 6 8-6" />
    </>
  ),
  check: <path d="m5 12.500 4.500 4.500L19 7.500" />,
  play: <path d="M8 5.500v13l11-6.500z" />,
};

export const Icon: React.FC<{name?: string; size: number; color: string; sw?: number; x?: number; y?: number}> = ({name = 'spark', size, color, sw = 1.8, x = 0, y = 0}) => (
  <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{overflow: 'visible'}}>
    {ICON_PATHS[name] ?? ICON_PATHS.spark}
  </svg>
);

/** HTML-flavoured icon (for DOM cards) */
export const IconBox: React.FC<{name?: string; size: number; color: string; sw?: number}> = ({name = 'spark', size, color, sw = 1.8}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{display: 'block'}}>
    {ICON_PATHS[name] ?? ICON_PATHS.spark}
  </svg>
);

// =================================================================================================================
// pixel art
// =================================================================================================================
export type PixelRun = {x: number; y: number; w: number; c: string};

/** art rows -> horizontal runs per colour (fewer SVG rects). `.` and ` ` are transparent. */
export const pixelRuns = (art: string[], pal: Record<string, string>, rim?: {color: string; side: 'left' | 'right'}): PixelRun[] => {
  const runs: PixelRun[] = [];
  const at = (x: number, y: number) => (art[y] && x >= 0 && x < art[y].length ? art[y][x] : '.');
  const opaque = (ch: string) => ch !== '.' && ch !== ' ' && pal[ch] !== undefined;
  art.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (!opaque(ch)) {
        x++;
        continue;
      }
      const colourAt = (xx: number) => {
        const c = at(xx, y);
        if (!opaque(c)) return null;
        if (rim && !opaque(at(rim.side === 'left' ? xx - 1 : xx + 1, y))) return rim.color;
        return pal[c];
      };
      const col = colourAt(x)!;
      let x2 = x + 1;
      while (x2 < row.length && colourAt(x2) === col) x2++;
      runs.push({x, y, w: x2 - x, c: col});
      x = x2;
    }
  });
  return runs;
};

export const PixelArt: React.FC<{art: string[]; pal: Record<string, string>; x: number; y: number; flip?: boolean; rim?: {color: string; side: 'left' | 'right'}}> = ({art, pal, x, y, flip, rim}) => {
  const runs = pixelRuns(art, pal, rim);
  const wd = art.reduce((m, r) => Math.max(m, r.length), 0);
  return (
    <g transform={flip ? `translate(${x + wd} ${y}) scale(-1 1)` : `translate(${x} ${y})`}>
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </g>
  );
};

// =================================================================================================================
// paper layers
// =================================================================================================================
export type PaperKind = 'rect' | 'circle' | 'hill' | 'wave' | 'cloud' | 'tree' | 'star' | 'blob' | 'sail' | 'ring';
export const PAPER_KINDS: PaperKind[] = ['rect', 'circle', 'hill', 'wave', 'cloud', 'tree', 'star', 'blob', 'sail', 'ring'];

const hash01 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** paper shape set drawn into the box (x, y, w, h in px) with `fill`; seeded wobble so each layer is unique */
export const paperShape = (kind: PaperKind, x: number, y: number, w: number, h: number, fill: string, seed = 1): React.ReactNode => {
  switch (kind) {
    case 'circle':
      return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill={fill} />;
    case 'ring': {
      const r = Math.min(w, h) / 2;
      return <circle cx={x + w / 2} cy={y + h / 2} r={r * 0.78} fill="none" stroke={fill} strokeWidth={r * 0.44} />;
    }
    case 'hill': {
      const n = 28;
      const a1 = 0.6 + hash01(seed) * 0.5;
      const ph = hash01(seed + 4) * 6;
      let d = `M ${x} ${y + h}`;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const bump = Math.sin(t * Math.PI) ** 1.2 * 0.78 + 0.18 * Math.sin(t * Math.PI * 2 * a1 + ph) * Math.sin(t * Math.PI);
        d += ` L ${x + w * t} ${y + h - h * clamp01(0.22 + bump)}`;
      }
      return <path d={`${d} L ${x + w} ${y + h} Z`} fill={fill} />;
    }
    case 'wave': {
      const n = 40;
      const cycles = 2 + Math.round(hash01(seed) * 2);
      let d = `M ${x} ${y + h}`;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        d += ` L ${x + w * t} ${y + h * 0.18 + Math.sin(t * Math.PI * 2 * cycles + hash01(seed + 2) * 6) * h * 0.14}`;
      }
      return <path d={`${d} L ${x + w} ${y + h} Z`} fill={fill} />;
    }
    case 'cloud': {
      const r = h / 2;
      return (
        <g fill={fill}>
          <rect x={x + r * 0.6} y={y + h * 0.45} width={w - r * 1.2} height={h * 0.55} rx={h * 0.27} />
          <circle cx={x + w * 0.3} cy={y + h * 0.5} r={h * 0.42} />
          <circle cx={x + w * 0.52} cy={y + h * 0.38} r={h * 0.5} />
          <circle cx={x + w * 0.74} cy={y + h * 0.52} r={h * 0.38} />
        </g>
      );
    }
    case 'tree':
      return (
        <g fill={fill}>
          <path d={`M ${x + w / 2} ${y} L ${x + w * 0.9} ${y + h * 0.5} L ${x + w * 0.1} ${y + h * 0.5} Z`} />
          <path d={`M ${x + w / 2} ${y + h * 0.28} L ${x + w} ${y + h * 0.82} L ${x} ${y + h * 0.82} Z`} />
          <rect x={x + w * 0.44} y={y + h * 0.8} width={w * 0.12} height={h * 0.2} />
        </g>
      );
    case 'star': {
      let d = '';
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 0.42 : 1;
        d += `${i ? 'L' : 'M'} ${x + w / 2 + Math.cos(a) * r * (w / 2)} ${y + h / 2 + Math.sin(a) * r * (h / 2)} `;
      }
      return <path d={`${d}Z`} fill={fill} strokeLinejoin="round" />;
    }
    case 'blob': {
      const n = 14;
      let d = '';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 0.8 + hash01(seed * 7 + i) * 0.2;
        d += `${i ? 'L' : 'M'} ${x + w / 2 + Math.cos(a) * r * (w / 2)} ${y + h / 2 + Math.sin(a) * r * (h / 2)} `;
      }
      return <path d={`${d}Z`} fill={fill} strokeLinejoin="round" />;
    }
    case 'sail':
      return (
        <g fill={fill}>
          <path d={`M ${x + w * 0.46} ${y} L ${x + w * 0.46} ${y + h * 0.72} L ${x + w * 0.04} ${y + h * 0.72} Z`} />
          <path d={`M ${x + w * 0.54} ${y + h * 0.1} L ${x + w * 0.54} ${y + h * 0.72} L ${x + w * 0.92} ${y + h * 0.72} Z`} />
          <path d={`M ${x} ${y + h * 0.78} L ${x + w} ${y + h * 0.78} L ${x + w * 0.84} ${y + h} L ${x + w * 0.16} ${y + h} Z`} />
        </g>
      );
    default:
      return <rect x={x} y={y} width={w} height={h} fill={fill} />;
  }
};

/** deckled-edge filter (turbulence displacement); draw layer shapes inside <g filter="url(#id)"> */
export const DeckleFilter: React.FC<{id: string; scale: number; freq?: number; seed?: number}> = ({id, scale, freq = 0.045, seed = 3}) => (
  <filter id={id} x="-3%" y="-3%" width="106%" height="106%" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={2} seed={seed} result="n" />
    <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} xChannelSelector="R" yChannelSelector="G" />
  </filter>
);

/** soft paper drop shadow offset growing with depth: 0 4px 8px rgba(0,0,0,.25) at depth 1 */
export const paperShadow = (depth: number, u: number, strength = 1) =>
  `drop-shadow(${(1.2 * depth * u).toFixed(2)}px ${(4 * depth * u).toFixed(2)}px ${(8 * Math.sqrt(Math.max(0.3, depth)) * u).toFixed(2)}px rgba(40,25,10,${(0.25 * strength).toFixed(3)}))`;
