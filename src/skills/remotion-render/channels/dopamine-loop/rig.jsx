// Dopamine Loop character rig, drawn from the owner's reference image: a plain black round head with a thin pale rim light,
// white crescent eyes, a black body silhouette, scribbled thoughts inside the head and a glowing heart in the chest.
//
// This is NOT a Rive file. No .riv asset exists in the repository and a .riv can only be authored in Rive's editor, so the rig is
// code-driven SVG with the same shape a Rive state machine would expose (mood, lean, tilt, arm angles, thought amount, heart state).
// A .riv drawn to the same proportions can replace <Figure> without changing any scene.
import React from "react";

export const INK = "#050505", RIM = "#A5A5AB", EYE = "#F4F4F4", HEART = "#FF2B2B", HEART_SOFT = "#FF8A7A";
const R = 110; // head radius, in rig units; everything else is measured from the head

/** Eyes sit 0.4 R either side of the head centre and 0.28 R below it, as in the reference. */
function Eye({ side, mood }) {
  const s = side, cx = s * 46, cy = 32;
  const g = (d) => <g transform={`translate(${cx} ${cy})`}>{d}</g>;
  // Sad: the outer corner sits low and the inner corner high, as in the reference, with two small lashes below.
  if (mood === "sad") { const o = s * 24, i = -s * 24; return g(<><path d={`M ${o} 14 L ${i} -18 Q ${-s * 8} 26 ${o} 14 Z`} fill={EYE} /><path d={`M ${s * 2} 30 l ${s * 5} 7 M ${s * -10} 28 l ${s * 5} 7`} stroke={EYE} strokeWidth={3} strokeLinecap="round" /></>); }
  if (mood === "tired") return g(<path d={`M -24 -2 L 24 -2 Q 0 14 -24 -2 Z`} fill={EYE} />);
  if (mood === "happy") return g(<path d={`M -22 8 Q 0 -16 22 8`} stroke={EYE} strokeWidth={8} fill="none" strokeLinecap="round" />);
  if (mood === "wide") return g(<><circle r={11} fill={EYE} /><circle r={4} cx={s * 2} cy={2} fill={INK} /></>);
  if (mood === "soft") return g(<path d={`M -22 2 L 22 2 Q 0 24 -22 2 Z`} fill={EYE} />);
  return g(<path d={`M -22 0 L 22 0 Q 0 22 -22 0 Z`} fill={EYE} />);
}

// A seeded scribble: the same thought always draws the same tangle, so scenes are repeatable frame to frame.
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function scribblePath(seed, n) {
  const rnd = mulberry(seed), pts = [];
  for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()); pts.push([Math.cos(a) * 66 * r, -44 + Math.sin(a) * 30 * r]); }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
  return d;
}

/** amount 0..1 reveals the tangle; calm 0..1 smooths it toward a loose, slow loop. */
function Scribble({ amount, calm = 0, seed = 7 }) {
  if (amount <= 0.01) return null;
  const tangle = scribblePath(seed, 56), loose = scribblePath(seed + 3, 9);
  return (
    <g fill="none" stroke={EYE} strokeLinecap="round">
      <path d={tangle} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - amount} strokeWidth={2.6} opacity={1 - calm * 0.75} />
      {calm > 0.05 && <path d={loose} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, amount)} strokeWidth={2.6} opacity={calm} />}
    </g>
  );
}

export function Heart({ state = "broken", pulse = 0, scale = 1 }) {
  const body = "M 0 22 C -36 -12 -32 -42 -12 -42 C -4 -42 0 -34 0 -30 C 0 -34 4 -42 12 -42 C 32 -42 36 -12 0 22 Z";
  const col = state === "whole" ? HEART_SOFT : HEART, glow = 10 + pulse * 10;
  return (
    <g transform={`scale(${scale})`} style={{ filter: `drop-shadow(0 0 ${glow}px ${col})` }}>
      {state === "broken" ? (
        <>
          <path d="M 0 22 C -36 -12 -32 -42 -12 -42 C -4 -42 0 -34 0 -30 L -6 -14 L 4 -2 L -4 10 Z" fill={col} transform="translate(-3 0) rotate(-4)" />
          <path d="M 0 -30 C 0 -34 4 -42 12 -42 C 32 -42 36 -12 0 22 L -4 10 L 4 -2 L -6 -14 Z" fill={col} transform="translate(3 2) rotate(4)" />
        </>
      ) : <path d={body} fill={col} />}
    </g>
  );
}

/**
 * Bust (head and shoulders) or full figure. Local origin is the head centre.
 * mood: sad | tired | neutral | soft | happy | wide
 * thought: 0..1 scribble amount, calm: 0..1 how far it has loosened
 */
export function Figure({ x = 0, y = 0, scale = 1, flip = 1, mood = "neutral", tilt = 0, lean = 0, thought = 0, calm = 0, heart = null, heartPulse = 0, body = "bust", arms = [8, -8], walk = 0, rim = RIM, opacity = 1, seed = 7 }) {
  const neck = R + 6, shoulder = R + 38;
  const torso = `M -120 ${shoulder + 20} Q -128 ${shoulder - 6} -70 ${shoulder - 8} L -26 ${neck - 4} L 26 ${neck - 4} L 70 ${shoulder - 8} Q 128 ${shoulder - 6} 120 ${shoulder + 20} L 108 ${shoulder + (body === "bust" ? 420 : 300)} L -108 ${shoulder + (body === "bust" ? 420 : 300)} Z`;
  const limb = (x1, y1, ang, len, w = 34) => { const rad = (ang * Math.PI) / 180; return <line x1={x1} y1={y1} x2={x1 + Math.sin(rad) * len} y2={y1 + Math.cos(rad) * len} stroke={INK} strokeWidth={w} strokeLinecap="round" />; };
  return (
    <g transform={`translate(${x} ${y}) scale(${scale * flip} ${scale})`} opacity={opacity}>
      <g transform={`rotate(${lean} 0 ${shoulder + 120})`}>
        {body === "full" && (
          <g>
            {limb(-40, shoulder + 290, walk * 14, 300, 44)}
            {limb(40, shoulder + 290, -walk * 14, 300, 44)}
          </g>
        )}
        <path d={torso} fill={INK} stroke={rim} strokeWidth={3} strokeOpacity={0.55} strokeLinejoin="round" />
        {body === "full" && <g>{limb(-104, shoulder + 14, arms[0], 250)}{limb(104, shoulder + 14, arms[1], 250)}</g>}
        {heart && <g transform={`translate(${-6} ${shoulder + 150})`}><Heart state={heart} pulse={heartPulse} /></g>}
        <g transform={`rotate(${tilt} 0 ${neck})`}>
          <rect x={-28} y={R - 14} width={56} height={44} fill={INK} />
          <circle r={R} fill={INK} stroke={rim} strokeWidth={3} strokeOpacity={0.6} />
          <Scribble amount={thought} calm={calm} seed={seed} />
          <Eye side={-1} mood={mood} />
          <Eye side={1} mood={mood} />
        </g>
      </g>
    </g>
  );
}

/** The reference's dark, soft-lit room. tint shifts the atmosphere: 0 = muted and cool, 1 = warm. */
export function Room({ tint = 0, w = 1080, h = 1920 }) {
  const mix = (a, b) => Math.round(a + (b - a) * tint);
  const centre = `rgb(${mix(48, 74)},${mix(49, 60)},${mix(54, 52)})`, edge = `rgb(${mix(8, 18)},${mix(8, 12)},${mix(10, 10)})`;
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs><radialGradient id="dl-room" cx="50%" cy="48%" r="75%"><stop offset="0%" stopColor={centre} /><stop offset="100%" stopColor={edge} /></radialGradient></defs>
      <rect width={w} height={h} fill="url(#dl-room)" />
    </svg>
  );
}
