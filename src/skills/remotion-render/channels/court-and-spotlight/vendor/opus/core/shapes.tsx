import React from 'react';

/** Shared SVG building blocks used across many motions. */

/** glossy 3D-ish sphere token with soft offset shadow (video4 listener / agents) */
export const GlossySphere: React.FC<{cx: number; cy: number; r: number; color?: string; light?: string; dark?: string; shadow?: string; id?: string; shadowOpacity?: number}> = ({
  cx,
  cy,
  r,
  color = '#3780E7',
  light = '#ABCFFF',
  dark = '#2B4681',
  shadow = '#C9BFD0',
  id = 'sph',
  shadowOpacity = 0.6,
}) => (
  <g>
    <defs>
      <radialGradient id={`${id}-g`} cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor={light} />
        <stop offset="45%" stopColor={color} />
        <stop offset="100%" stopColor={dark} />
      </radialGradient>
      <filter id={`${id}-b`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation={r * 0.35} />
      </filter>
    </defs>
    <ellipse cx={cx + r * 0.4} cy={cy + r * 0.55} rx={r * 1.05} ry={r * 0.8} fill={shadow} opacity={shadowOpacity} filter={`url(#${id}-b)`} />
    <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-g)`} />
    <circle cx={cx - r * 0.32} cy={cy - r * 0.36} r={r * 0.16} fill="#fff" opacity={0.85} />
  </g>
);

/** 4-point twinkle star (sparkles in videos 1, 4, 5, 13) */
export const Sparkle: React.FC<{x: number; y: number; size: number; color?: string; rotate?: number; opacity?: number}> = ({x, y, size, color = '#FFF6B0', rotate = 0, opacity = 1}) => {
  const s = size;
  const w = s * 0.18;
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate})`} opacity={opacity}>
      <path d={`M0,${-s} C${w},${-w} ${w},${-w} ${s},0 C${w},${w} ${w},${w} 0,${s} C${-w},${w} ${-w},${w} ${-s},0 C${-w},${-w} ${-w},${-w} 0,${-s} Z`} fill={color} style={{filter: `drop-shadow(0 0 ${s * 0.5}px ${color})`}} />
    </g>
  );
};

/** smooth closed path through points (Catmull-Rom -> cubic Bezier) */
export const smoothClosed = (pts: [number, number][]) => {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d += ` C ${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + ' Z';
};

/** smooth open path through points */
export const smoothOpen = (pts: [number, number][]) => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
};

/** polygon points string */
export const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** regular polygon / star vertices */
export const regular = (cx: number, cy: number, r: number, n: number, rot = -Math.PI / 2, inner?: number): [number, number][] => {
  const out: [number, number][] = [];
  const k = inner ? n * 2 : n;
  for (let i = 0; i < k; i++) {
    const rr = inner && i % 2 ? inner : r;
    const a = rot + (i / k) * Math.PI * 2;
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return out;
};

/** stroke draw-on helper: returns dash props for a path of known length */
export const drawOn = (length: number, t: number) => ({strokeDasharray: length, strokeDashoffset: length * (1 - t)});

/** diagonal hatch pattern def (video1 cast shadows, video20 pencil hatching, video22 coloured-pencil fills) */
export const HatchPattern: React.FC<{id: string; color?: string; gap?: number; width?: number; angle?: number; opacity?: number}> = ({id, color = '#000', gap = 8, width = 1.5, angle = 45, opacity = 1}) => (
  <defs>
    <pattern id={id} patternUnits="userSpaceOnUse" width={gap} height={gap} patternTransform={`rotate(${angle})`}>
      <line x1={0} y1={0} x2={0} y2={gap} stroke={color} strokeWidth={width} opacity={opacity} />
    </pattern>
  </defs>
);

/** dashed-arc / ring path helpers */
export const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${cx + Math.cos(a0) * r} ${cy + Math.sin(a0) * r} A ${r} ${r} 0 ${large} ${sweep} ${cx + Math.cos(a1) * r} ${cy + Math.sin(a1) * r}`;
};
