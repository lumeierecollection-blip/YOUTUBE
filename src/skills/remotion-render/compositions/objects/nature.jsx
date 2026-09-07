import React from "react";
import { registerObject } from "./registry.js";

/**
 * THE NATURAL-WORLD SET — caves, creatures, chemistry, depth, light.
 *
 * These exist because the test script talks about a cave and the library had
 * no cave. Asked for one it returned a legal document, because selection was
 * keyword-matching over a set of office and courtroom objects. A document
 * standing in for a cave is not a weak visual, it is a wrong one: with the
 * audio off it tells the viewer something false.
 *
 * The test every drawing here has to pass is the one in the brief. Audio off,
 * does this still say what the sentence said? A spider is drawn with eight
 * legs and no eyes because the sentence says blind spiders. A springtail has
 * its furcula because that is the animal named. Recognition is the whole job;
 * decoration is not part of it.
 *
 * Same contract as every other drawing: a box in frame pixels, the channel's
 * resolved palette, `p` through the beat, and everything stays inside the box.
 */

const rnd = (seed) => (((seed * 2654435761) >>> 8) % 1000) / 1000;

// ─────────────────────────────────────────────────────────────────────────────
// GEOLOGY — the cave itself, seen four ways.
// ─────────────────────────────────────────────────────────────────────────────

registerObject("cave entrance", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  // A mouth in a hillside: the rock is the frame, the dark is the subject.
  const mouth = `M${x + w * 0.28},${y + h * 0.92}
                 C${x + w * 0.26},${y + h * 0.5} ${x + w * 0.38},${y + h * 0.3} ${x + w * 0.5},${y + h * 0.3}
                 C${x + w * 0.62},${y + h * 0.3} ${x + w * 0.74},${y + h * 0.5} ${x + w * 0.72},${y + h * 0.92} Z`;
  return (
    <g>
      <path d={`M${x},${y + h * 0.92} L${x + w * 0.14},${y + h * 0.3} L${x + w * 0.34},${y + h * 0.52}
                L${x + w * 0.52},${y + h * 0.12} L${x + w * 0.72},${y + h * 0.46} L${x + w * 0.88},${y + h * 0.26}
                L${x + w},${y + h * 0.92} Z`}
        fill={colors.onGround} opacity={0.22} />
      <path d={mouth} fill="#000000" opacity={0.88} />
      {/* the dark deepens inward, which is what makes it a passage not a hole */}
      <path d={mouth} fill="none" stroke={colors.onGround} strokeWidth={3} opacity={0.55} />
      <ellipse cx={x + w * 0.5} cy={y + h * 0.62} rx={w * 0.13} ry={h * 0.16} fill="#000000" opacity={0.9} />
      {/* loose rock on the floor */}
      {[0.34, 0.46, 0.62].map((f, i) => (
        <ellipse key={i} cx={x + w * f} cy={y + h * (0.9 - i * 0.01)} rx={w * (0.035 + i * 0.01)} ry={h * 0.018}
          fill={colors.onGround} opacity={0.4} />
      ))}
      <line x1={x} y1={y + h * 0.92} x2={x + w} y2={y + h * 0.92} stroke={colors.onGround} strokeWidth={3} opacity={0.5} />
    </g>
  );
});

registerObject("cave cross section", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const voids = [[0.5, 0.52, 0.2, 0.11], [0.3, 0.72, 0.11, 0.07], [0.68, 0.78, 0.13, 0.06]];
  return (
    <g>
      {/* strata: a cut through ground, so depth is readable as depth */}
      {[0.14, 0.3, 0.46, 0.64, 0.82].map((f, i) => (
        <path key={i} d={`M${x},${y + h * f} Q${x + w * 0.3},${y + h * (f - 0.03)} ${x + w * 0.6},${y + h * (f + 0.02)} T${x + w},${y + h * (f - 0.01)}`}
          fill="none" stroke={colors.onGround} strokeWidth={2} opacity={0.2 + i * 0.05} />
      ))}
      <rect x={x} y={y + h * 0.14} width={w} height={h * 0.86} fill={colors.onGround} opacity={0.12} />
      {/* the chambers, linked by passages — a cave system, not one bubble */}
      {voids.map(([cx, cy, rx, ry], i) => (
        <ellipse key={i} cx={x + w * cx} cy={y + h * cy} rx={w * rx} ry={h * ry}
          fill="#000000" opacity={0.85 * Math.max(0, Math.min(1, p * 3 - i))} />
      ))}
      <path d={`M${x + w * 0.5},${y + h * 0.14} L${x + w * 0.5},${y + h * 0.42}`}
        stroke="#000000" strokeWidth={w * 0.03} opacity={0.8} />
      <path d={`M${x + w * 0.42},${y + h * 0.6} Q${x + w * 0.34},${y + h * 0.68} ${x + w * 0.32},${y + h * 0.7}`}
        stroke="#000000" strokeWidth={w * 0.026} fill="none" opacity={0.8} />
      <path d={`M${x + w * 0.62},${y + h * 0.6} Q${x + w * 0.68},${y + h * 0.72} ${x + w * 0.68},${y + h * 0.75}`}
        stroke="#000000" strokeWidth={w * 0.026} fill="none" opacity={0.8} />
      {/* the surface line, so "underground" is unambiguous */}
      <line x1={x} y1={y + h * 0.14} x2={x + w} y2={y + h * 0.14} stroke={colors.accent} strokeWidth={3.5} opacity={0.9} />
    </g>
  );
});

registerObject("depth scale", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const marks = 6;
  const reach = Math.max(0.1, Math.min(1, p * 1.2));
  return (
    <g>
      <line x1={x + w * 0.12} y1={y + h * 0.08} x2={x + w * 0.88} y2={y + h * 0.08}
        stroke={colors.accent} strokeWidth={4} opacity={0.9} />
      {/* the shaft descends as the beat runs: the measurement IS the motion */}
      <line x1={x + w * 0.3} y1={y + h * 0.08} x2={x + w * 0.3} y2={y + h * (0.08 + 0.84 * reach)}
        stroke={colors.onGround} strokeWidth={5} opacity={0.75} />
      {Array.from({ length: marks }).map((_, i) => {
        const f = 0.08 + (0.84 * (i + 1)) / marks;
        if (f > 0.08 + 0.84 * reach) return null;
        const major = i === marks - 1;
        return (
          <g key={i}>
            <line x1={x + w * 0.3} y1={y + h * f} x2={x + w * (major ? 0.72 : 0.5)} y2={y + h * f}
              stroke={major ? colors.accent : colors.onGround} strokeWidth={major ? 4 : 2} opacity={major ? 0.95 : 0.45} />
            <rect x={x + w * (major ? 0.74 : 0.52)} y={y + h * f - h * 0.012} width={w * (major ? 0.16 : 0.1)}
              height={Math.max(3, h * 0.024)} fill={major ? colors.accent : colors.onGround} opacity={major ? 0.9 : 0.4} />
          </g>
        );
      })}
      {/* the thing at the bottom of the shaft */}
      <circle cx={x + w * 0.3} cy={y + h * (0.08 + 0.84 * reach)} r={Math.max(6, w * 0.035)}
        fill={colors.accent} opacity={0.95} />
    </g>
  );
});

registerObject("rock strata", ({ box, colors }) => {
  const { x, y, w, h } = box;
  const bands = 6;
  return (
    <g>
      {Array.from({ length: bands }).map((_, i) => (
        <path key={i}
          d={`M${x},${y + (h * i) / bands} Q${x + w * 0.35},${y + (h * i) / bands - h * 0.03} ${x + w * 0.7},${y + (h * i) / bands + h * 0.02} T${x + w},${y + (h * i) / bands}
              L${x + w},${y + (h * (i + 1)) / bands} Q${x + w * 0.7},${y + (h * (i + 1)) / bands + h * 0.02} ${x + w * 0.35},${y + (h * (i + 1)) / bands - h * 0.03} T${x},${y + (h * (i + 1)) / bands} Z`}
          fill={i % 2 ? colors.onGround : colors.accent} opacity={i % 2 ? 0.16 + i * 0.05 : 0.2} />
      ))}
      {/* a fracture running through the beds */}
      <path d={`M${x + w * 0.62},${y} L${x + w * 0.56},${y + h * 0.4} L${x + w * 0.66},${y + h * 0.72} L${x + w * 0.6},${y + h}`}
        fill="none" stroke={colors.onGround} strokeWidth={2.5} opacity={0.45} />
    </g>
  );
});

registerObject("mineral crystal", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cx = x + w / 2;
  const grow = 0.4 + 0.6 * Math.max(0, Math.min(1, p * 1.3));
  const tip = y + h * (0.9 - 0.68 * grow);
  return (
    <g>
      {/* a hexagonal prism with a terminated point: a crystal, not a triangle */}
      <path d={`M${cx - w * 0.18},${y + h * 0.9} L${cx - w * 0.18},${(tip + y + h * 0.9) / 2}
                L${cx},${tip} L${cx + w * 0.18},${(tip + y + h * 0.9) / 2} L${cx + w * 0.18},${y + h * 0.9} Z`}
        fill={colors.accent} opacity={0.42} stroke={colors.accent} strokeWidth={3} />
      <line x1={cx} y1={tip} x2={cx} y2={y + h * 0.9} stroke={colors.onGround} strokeWidth={2} opacity={0.4} />
      {/* two smaller crystals in the cluster */}
      <path d={`M${cx - w * 0.36},${y + h * 0.9} L${cx - w * 0.36},${y + h * 0.66} L${cx - w * 0.26},${y + h * 0.54}
                L${cx - w * 0.16},${y + h * 0.66} L${cx - w * 0.16},${y + h * 0.9} Z`}
        fill={colors.accent} opacity={0.3} stroke={colors.accent} strokeWidth={2.4} />
      <path d={`M${cx + w * 0.18},${y + h * 0.9} L${cx + w * 0.18},${y + h * 0.72} L${cx + w * 0.28},${y + h * 0.6}
                L${cx + w * 0.38},${y + h * 0.72} L${cx + w * 0.38},${y + h * 0.9} Z`}
        fill={colors.accent} opacity={0.26} stroke={colors.accent} strokeWidth={2.4} />
      <line x1={x + w * 0.08} y1={y + h * 0.9} x2={x + w * 0.92} y2={y + h * 0.9}
        stroke={colors.onGround} strokeWidth={3} opacity={0.5} />
    </g>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LIGHT AND DARK — the thing this script is actually about.
// ─────────────────────────────────────────────────────────────────────────────

registerObject("sunlight", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cx = x + w / 2, cy = y + h * 0.26;
  const r = Math.min(w, h) * 0.14;
  const reach = Math.max(0.2, Math.min(1, p * 1.3));
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={colors.accent} opacity={0.95} />
      {/* rays that actually reach the ground: light arriving, not a sun icon */}
      {[-0.34, -0.17, 0, 0.17, 0.34].map((k, i) => (
        <path key={i}
          d={`M${cx + k * w * 0.3},${cy + r * 0.9} L${cx + k * w * 0.9},${cy + (h * 0.66) * reach}`}
          stroke={colors.accent} strokeWidth={Math.max(3, w * 0.018)} opacity={0.5 - Math.abs(k)} strokeLinecap="round" />
      ))}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <line key={i} x1={cx + Math.cos(a) * r * 1.3} y1={cy + Math.sin(a) * r * 1.3}
          x2={cx + Math.cos(a) * r * 1.75} y2={cy + Math.sin(a) * r * 1.75}
          stroke={colors.accent} strokeWidth={3} opacity={0.7} strokeLinecap="round" />;
      })}
      <line x1={x + w * 0.05} y1={y + h * 0.94} x2={x + w * 0.95} y2={y + h * 0.94}
        stroke={colors.onGround} strokeWidth={3} opacity={0.5} />
    </g>
  );
});

registerObject("no sunlight", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cx = x + w / 2, cy = y + h * 0.2;
  const r = Math.min(w, h) * 0.12;
  const block = Math.max(0, Math.min(1, p * 1.4));
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={colors.accent} opacity={0.5 * (1 - block * 0.7)} />
      {[-0.3, 0, 0.3].map((k, i) => (
        <line key={i} x1={cx + k * w * 0.24} y1={cy + r} x2={cx + k * w * 0.5} y2={y + h * 0.44}
          stroke={colors.accent} strokeWidth={4} opacity={0.45 * (1 - block * 0.8)} strokeLinecap="round" />
      ))}
      {/* the ground closes over: the light stops at a surface it cannot pass */}
      <rect x={x} y={y + h * 0.46} width={w} height={h * 0.54} fill={colors.onGround} opacity={0.24} />
      <line x1={x} y1={y + h * 0.46} x2={x + w} y2={y + h * 0.46} stroke={colors.onGround} strokeWidth={4} opacity={0.7} />
      <rect x={x + w * 0.16} y={y + h * 0.6} width={w * 0.68} height={h * 0.3} fill="#000000" opacity={0.85 * block} />
      {/* the barred circle: the standard mark for absence */}
      <circle cx={cx} cy={y + h * 0.75} r={Math.min(w, h) * 0.13} fill="none" stroke={colors.accent}
        strokeWidth={5} opacity={0.9 * block} />
      <line x1={cx - Math.min(w, h) * 0.09} y1={y + h * 0.75 - Math.min(w, h) * 0.09}
        x2={cx + Math.min(w, h) * 0.09} y2={y + h * 0.75 + Math.min(w, h) * 0.09}
        stroke={colors.accent} strokeWidth={5} opacity={0.9 * block} />
    </g>
  );
});

registerObject("total darkness", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const close = Math.max(0, Math.min(1, p * 1.2));
  const r = Math.min(w, h) * 0.46 * (1 - 0.86 * close);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#000000" opacity={0.9} />
      {/* an aperture closing to nothing — darkness arriving, not black paint */}
      <circle cx={x + w / 2} cy={y + h / 2} r={Math.max(0, r)} fill={colors.onGround} opacity={0.16} />
      <circle cx={x + w / 2} cy={y + h / 2} r={Math.max(0, r)} fill="none"
        stroke={colors.accent} strokeWidth={4} opacity={0.7 * (1 - close * 0.7)} />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={colors.onGround} strokeWidth={2} opacity={0.3} />
    </g>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LIFE — drawn as the specific animals the script names.
// ─────────────────────────────────────────────────────────────────────────────

registerObject("blind spider", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cx = x + w / 2, cy = y + h * 0.52;
  const br = Math.min(w, h) * 0.11;
  const step = Math.sin(p * Math.PI * 4) * 0.06;
  return (
    <g>
      {/* eight legs in two mirrored fours, jointed, which is what reads as spider */}
      {[-1, 1].map((s) => [0, 1, 2, 3].map((i) => {
        // Legs reached 0.98 of the half-width from centre, which is half a box
        // outside the box, and bled into both alphabetical neighbours in the
        // audit sheet. A spider's span is wide but it is not unbounded.
        const spread = 0.24 + i * 0.055 + (i % 2 ? step : -step);
        const kneeX = cx + s * w * (0.12 + i * 0.045);
        const kneeY = cy - h * (0.1 - i * 0.05);
        return (
          <path key={`${s}-${i}`}
            d={`M${cx + s * br * 0.6},${cy - h * 0.02 + i * h * 0.022} Q${kneeX},${kneeY} ${cx + s * w * spread},${cy + h * (0.14 + i * 0.04)}`}
            fill="none" stroke={colors.onGround} strokeWidth={Math.max(2.5, w * 0.014)} opacity={0.8} strokeLinecap="round" />
        );
      }))}
      <ellipse cx={cx} cy={cy + h * 0.06} rx={br * 1.5} ry={br * 1.75} fill={colors.onGround} opacity={0.75} />
      <ellipse cx={cx} cy={cy - h * 0.09} rx={br} ry={br * 0.8} fill={colors.onGround} opacity={0.9} />
      {/* no eyes: the sentence says blind, so the head carries none */}
      <path d={`M${cx - br * 0.5},${cy - h * 0.1} q${br * 0.5},${br * 0.35} ${br},0`}
        fill="none" stroke={colors.accent} strokeWidth={2.5} opacity={0.8} />
    </g>
  );
});

registerObject("eyeless leech", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const segs = 11;
  const wave = (t) => Math.sin(t * Math.PI * 2 + p * Math.PI * 2) * h * 0.1;
  return (
    <g>
      {Array.from({ length: segs }).map((_, i) => {
        const t = i / (segs - 1);
        const sx = x + w * (0.12 + t * 0.76);
        const sy = y + h * 0.5 + wave(t);
        const rr = Math.min(w, h) * (0.075 - Math.abs(t - 0.45) * 0.05);
        return <ellipse key={i} cx={sx} cy={sy} rx={rr * 1.1} ry={rr}
          fill={colors.onGround} opacity={0.55 + t * 0.3} />;
      })}
      {/* the sucker at the head end, which is the tell */}
      <ellipse cx={x + w * 0.88} cy={y + h * 0.5 + wave(1)} rx={Math.min(w, h) * 0.05} ry={Math.min(w, h) * 0.07}
        fill={colors.accent} opacity={0.9} />
      <line x1={x + w * 0.06} y1={y + h * 0.9} x2={x + w * 0.94} y2={y + h * 0.9}
        stroke={colors.onGround} strokeWidth={2.5} opacity={0.3} />
    </g>
  );
});

registerObject("pale centipede", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const segs = 13;
  const wave = (t) => Math.sin(t * Math.PI * 2.4 + p * Math.PI * 3) * h * 0.12;
  return (
    <g>
      {Array.from({ length: segs }).map((_, i) => {
        const t = i / (segs - 1);
        const sx = x + w * (0.1 + t * 0.8);
        const sy = y + h * 0.5 + wave(t);
        const rr = Math.min(w, h) * 0.05;
        return (
          <g key={i}>
            {/* a leg pair per segment: what makes it a centipede and not a worm */}
            <line x1={sx} y1={sy} x2={sx - w * 0.03} y2={sy - h * 0.13} stroke={colors.onGround} strokeWidth={2.4} opacity={0.7} />
            <line x1={sx} y1={sy} x2={sx - w * 0.03} y2={sy + h * 0.13} stroke={colors.onGround} strokeWidth={2.4} opacity={0.7} />
            <ellipse cx={sx} cy={sy} rx={rr * 1.2} ry={rr} fill={colors.paper} opacity={0.85} stroke={colors.onGround} strokeWidth={1.6} strokeOpacity={0.5} />
          </g>
        );
      })}
      {/* antennae */}
      {[-1, 1].map((s, i) => (
        <line key={i} x1={x + w * 0.9} y1={y + h * 0.5 + wave(1)} x2={x + w * 0.98} y2={y + h * 0.5 + wave(1) + s * h * 0.1}
          stroke={colors.accent} strokeWidth={2.6} opacity={0.85} />
      ))}
    </g>
  );
});

registerObject("springtail", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cx = x + w * 0.46, cy = y + h * 0.52;
  const br = Math.min(w, h) * 0.16;
  const spring = Math.max(0, Math.sin(p * Math.PI * 2));
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={br * 1.5} ry={br} fill={colors.onGround} opacity={0.8} />
      <circle cx={cx + br * 1.5} cy={cy - br * 0.2} r={br * 0.62} fill={colors.onGround} opacity={0.9} />
      {[-1, 1].map((s, i) => (
        <line key={i} x1={cx + br * 1.9} y1={cy - br * 0.35} x2={cx + br * 3} y2={cy - br * (0.9 + s * 0.6)}
          stroke={colors.onGround} strokeWidth={2.6} opacity={0.8} strokeLinecap="round" />
      ))}
      {[0, 1, 2].map((i) => [-1, 1].map((s) => (
        <line key={`${i}-${s}`} x1={cx + br * (i - 0.6)} y1={cy + br * 0.6} x2={cx + br * (i - 1)} y2={cy + br * (1.5 + 0.3 * s)}
          stroke={colors.onGround} strokeWidth={2.4} opacity={0.75} strokeLinecap="round" />
      )))}
      {/* the furcula: the tail-spring a springtail is named for, cocked then released */}
      <path d={`M${cx - br * 1.4},${cy + br * 0.35} q${-br * (1.2 + spring)},${br * (0.4 + spring * 1.2)} ${-br * (1.5 + spring * 1.6)},${-br * 0.2}`}
        fill="none" stroke={colors.accent} strokeWidth={Math.max(3, br * 0.24)} opacity={0.95} strokeLinecap="round" />
    </g>
  );
});

registerObject("bacteria colony", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 9;
  return (
    <g>
      {/* rod-shaped cells with a dividing pair: a colony that is multiplying */}
      {Array.from({ length: n }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * n - i));
        if (a <= 0) return null;
        const cx = x + w * (0.18 + rnd(i * 3 + 1) * 0.64);
        const cy = y + h * (0.2 + rnd(i * 5 + 2) * 0.6);
        const rot = rnd(i * 7 + 3) * 180;
        const rw = Math.min(w, h) * 0.15, rh = Math.min(w, h) * 0.062;
        return (
          <g key={i} transform={`rotate(${rot} ${cx} ${cy})`} opacity={a}>
            <rect x={cx - rw / 2} y={cy - rh / 2} width={rw} height={rh} rx={rh / 2}
              fill={i % 3 === 0 ? colors.accent : colors.onGround} opacity={i % 3 === 0 ? 0.9 : 0.6} />
            {i % 4 === 0 && <line x1={cx} y1={cy - rh / 2} x2={cx} y2={cy + rh / 2}
              stroke={colors.ground} strokeWidth={2} opacity={0.8} />}
          </g>
        );
      })}
    </g>
  );
});

registerObject("ecosystem web", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const nodes = [[0.5, 0.16], [0.82, 0.38], [0.7, 0.76], [0.3, 0.76], [0.18, 0.38], [0.5, 0.5]];
  const links = [[5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [0, 1], [1, 2], [2, 3], [3, 4], [4, 0]];
  const at = (i) => [x + w * nodes[i][0], y + h * nodes[i][1]];
  return (
    <g>
      {links.map(([a, b], i) => {
        const t = Math.max(0, Math.min(1, p * links.length - i));
        if (t <= 0) return null;
        const [ax, ay] = at(a), [bx, by] = at(b);
        return <line key={i} x1={ax} y1={ay} x2={ax + (bx - ax) * t} y2={ay + (by - ay) * t}
          stroke={colors.onGround} strokeWidth={2.4} opacity={0.45} />;
      })}
      {nodes.map((_, i) => {
        const [cx, cy] = at(i);
        const t = Math.max(0, Math.min(1, p * nodes.length - i));
        if (t <= 0) return null;
        const hub = i === nodes.length - 1;
        return <circle key={i} cx={cx} cy={cy} r={Math.min(w, h) * (hub ? 0.1 : 0.062)}
          fill={hub ? colors.accent : colors.onGround} opacity={(hub ? 0.95 : 0.7) * t} />;
      })}
    </g>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CHEMISTRY AND WATER
// ─────────────────────────────────────────────────────────────────────────────

registerObject("gas cloud", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const puffs = [[0.34, 0.5, 0.2], [0.5, 0.4, 0.24], [0.66, 0.52, 0.19], [0.44, 0.62, 0.17], [0.58, 0.64, 0.15]];
  const rise = Math.sin(p * Math.PI * 2) * h * 0.03;
  return (
    <g>
      {puffs.map(([cx, cy, r], i) => (
        <circle key={i} cx={x + w * cx} cy={y + h * cy + rise * (i % 2 ? 1 : -1)} r={Math.min(w, h) * r}
          fill={colors.accent} opacity={0.2 + i * 0.04} />
      ))}
      {/* molecules drifting in it, so it is a gas and not a cloud of paint */}
      {Array.from({ length: 7 }).map((_, i) => {
        const cx = x + w * (0.22 + rnd(i * 11 + 4) * 0.56);
        const cy = y + h * (0.3 + rnd(i * 13 + 5) * 0.42) + rise;
        const r = Math.min(w, h) * 0.026;
        return (
          <g key={i} opacity={0.85}>
            <circle cx={cx} cy={cy} r={r} fill={colors.onGround} />
            <circle cx={cx + r * 2} cy={cy - r * 1.1} r={r * 0.72} fill={colors.onGround} opacity={0.7} />
            <circle cx={cx - r * 2} cy={cy - r * 1.1} r={r * 0.72} fill={colors.onGround} opacity={0.7} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("oxygen gauge", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const bw = w * 0.26, bx = x + w * 0.2;
  const level = Math.max(0.02, Math.min(1, p)) * 0.07 * 3;
  return (
    <g>
      {/* a cylinder read against a full scale: 7% is only meaningful against 100% */}
      <rect x={bx} y={y + h * 0.08} width={bw} height={h * 0.84} rx={bw * 0.18}
        fill="none" stroke={colors.onGround} strokeWidth={4} opacity={0.7} />
      <rect x={bx + 4} y={y + h * (0.92 - 0.84 * level)} width={bw - 8} height={h * 0.84 * level}
        fill={colors.accent} opacity={0.9} />
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line x1={bx + bw} y1={y + h * (0.92 - 0.84 * f)} x2={bx + bw + w * 0.09} y2={y + h * (0.92 - 0.84 * f)}
            stroke={colors.onGround} strokeWidth={i % 2 ? 2 : 3.4} opacity={i % 2 ? 0.35 : 0.6} />
          <rect x={bx + bw + w * 0.12} y={y + h * (0.92 - 0.84 * f) - h * 0.012} width={w * (i % 2 ? 0.07 : 0.12)}
            height={Math.max(3, h * 0.024)} fill={colors.onGround} opacity={i % 2 ? 0.3 : 0.5} />
        </g>
      ))}
      {/* the level marker, on the reading */}
      <line x1={bx - w * 0.1} y1={y + h * (0.92 - 0.84 * level)} x2={bx} y2={y + h * (0.92 - 0.84 * level)}
        stroke={colors.accent} strokeWidth={4} opacity={0.95} />
    </g>
  );
});

registerObject("hydrothermal vent", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cx = x + w * 0.5;
  const plume = Math.max(0.2, Math.min(1, p * 1.2));
  return (
    <g>
      <rect x={x} y={y + h * 0.78} width={w} height={h * 0.22} fill={colors.onGround} opacity={0.2} />
      {/* the chimney */}
      <path d={`M${cx - w * 0.14},${y + h * 0.82} L${cx - w * 0.07},${y + h * 0.36} L${cx + w * 0.07},${y + h * 0.36} L${cx + w * 0.14},${y + h * 0.82} Z`}
        fill={colors.onGround} opacity={0.55} />
      <path d={`M${cx - w * 0.09},${y + h * 0.62} L${cx - w * 0.2},${y + h * 0.82} L${cx - w * 0.06},${y + h * 0.82} Z`}
        fill={colors.onGround} opacity={0.4} />
      {/* the black smoker plume, billowing upward */}
      {Array.from({ length: 6 }).map((_, i) => {
        const t = i / 5;
        // The plume used to clear the top of the box by 16px at full billow.
        return <circle key={i} cx={cx + Math.sin(t * 5 + p * 3) * w * 0.09 * t}
          cy={y + h * (0.34 - 0.22 * t * plume)} r={Math.min(w, h) * (0.045 + t * 0.05)}
          fill={colors.accent} opacity={0.5 - t * 0.36} />;
      })}
      <ellipse cx={cx} cy={y + h * 0.36} rx={w * 0.075} ry={h * 0.02} fill="#000000" opacity={0.7} />
    </g>
  );
});

registerObject("sea surface", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const sy = y + h * 0.42;
  const t = p * Math.PI * 2;
  return (
    <g>
      <rect x={x} y={sy} width={w} height={h - (sy - y)} fill={colors.accent} opacity={0.18} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i}
          d={`M${x},${sy + i * h * 0.13} Q${x + w * 0.25},${sy + i * h * 0.13 - h * 0.045 * Math.sin(t + i)} ${x + w * 0.5},${sy + i * h * 0.13}
              T${x + w},${sy + i * h * 0.13}`}
          fill="none" stroke={colors.onGround} strokeWidth={i === 0 ? 4 : 2.4} opacity={i === 0 ? 0.75 : 0.3} />
      ))}
      {/* the seabed, so this is a body of water rather than a pattern */}
      <path d={`M${x},${y + h} L${x},${y + h * 0.88} Q${x + w * 0.3},${y + h * 0.8} ${x + w * 0.6},${y + h * 0.9} T${x + w},${y + h * 0.86} L${x + w},${y + h} Z`}
        fill={colors.onGround} opacity={0.35} />
    </g>
  );
});

registerObject("earth globe", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const r = Math.min(w, h) * 0.44;
  const cx = x + w / 2, cy = y + h / 2;
  const spin = p * 40;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={colors.accent} opacity={0.28} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.onGround} strokeWidth={3} opacity={0.6} />
      {/* meridians and parallels turning: a globe, not a disc */}
      {[-0.6, -0.2, 0.2, 0.6].map((k, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={Math.abs(r * Math.cos((spin / 60 + k) * Math.PI))} ry={r}
          fill="none" stroke={colors.onGround} strokeWidth={1.8} opacity={0.32} />
      ))}
      {[-0.55, 0, 0.55].map((k, i) => (
        <ellipse key={`p${i}`} cx={cx} cy={cy + r * k} rx={r * Math.sqrt(Math.max(0, 1 - k * k))} ry={r * 0.09}
          fill="none" stroke={colors.onGround} strokeWidth={1.8} opacity={0.3} />
      ))}
      {/* a landmass, so it reads as Earth rather than a wireframe sphere */}
      <path d={`M${cx - r * 0.42},${cy - r * 0.2} q${r * 0.3},${-r * 0.25} ${r * 0.55},${r * 0.05}
                q${r * 0.12},${r * 0.3} ${-r * 0.2},${r * 0.42} q${-r * 0.4},${r * 0.05} ${-r * 0.35},${-r * 0.47} Z`}
        fill={colors.onGround} opacity={0.45} />
    </g>
  );
});

registerObject("cave worker", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cx = x + w * 0.44;
  const beam = Math.max(0.3, Math.min(1, p * 1.4));
  return (
    <g>
      {/* the lamp beam is the point: someone bringing light into the dark */}
      <path d={`M${cx + w * 0.08},${y + h * 0.2} L${x + w * 0.98},${y + h * (0.06 + 0.1)} L${x + w * 0.98},${y + h * 0.56} Z`}
        fill={colors.accent} opacity={0.22 * beam} />
      <ellipse cx={cx} cy={y + h * 0.2} rx={Math.min(w, h) * 0.11} ry={Math.min(w, h) * 0.1} fill={colors.onGround} opacity={0.85} />
      <path d={`M${cx - w * 0.13},${y + h * 0.17} a${w * 0.13},${h * 0.11} 0 0 1 ${w * 0.26},0 Z`}
        fill={colors.accent} opacity={0.8} />
      <circle cx={cx + w * 0.06} cy={y + h * 0.15} r={Math.min(w, h) * 0.032} fill={colors.accent} opacity={0.95} />
      <path d={`M${cx - w * 0.1},${y + h * 0.32} L${cx + w * 0.1},${y + h * 0.32} L${cx + w * 0.13},${y + h * 0.66} L${cx - w * 0.13},${y + h * 0.66} Z`}
        fill={colors.onGround} opacity={0.7} />
      {[-1, 1].map((s, i) => (
        <line key={i} x1={cx + s * w * 0.06} y1={y + h * 0.66} x2={cx + s * w * 0.1} y2={y + h * 0.94}
          stroke={colors.onGround} strokeWidth={Math.max(5, w * 0.035)} opacity={0.7} strokeLinecap="round" />
      ))}
      <line x1={cx + w * 0.1} y1={y + h * 0.4} x2={cx + w * 0.24} y2={y + h * 0.3}
        stroke={colors.onGround} strokeWidth={Math.max(4, w * 0.03)} opacity={0.7} strokeLinecap="round" />
    </g>
  );
});

registerObject("sealed entrance", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const seal = Math.max(0, Math.min(1, p * 1.3));
  return (
    <g>
      <path d={`M${x},${y + h * 0.92} L${x + w * 0.16},${y + h * 0.28} L${x + w * 0.5},${y + h * 0.08}
                L${x + w * 0.84},${y + h * 0.3} L${x + w},${y + h * 0.92} Z`}
        fill={colors.onGround} opacity={0.22} />
      <path d={`M${x + w * 0.32},${y + h * 0.92} C${x + w * 0.3},${y + h * 0.52} ${x + w * 0.4},${y + h * 0.38} ${x + w * 0.5},${y + h * 0.38}
                C${x + w * 0.6},${y + h * 0.38} ${x + w * 0.7},${y + h * 0.52} ${x + w * 0.68},${y + h * 0.92} Z`}
        fill="#000000" opacity={0.85} />
      {/* rock closing over the mouth — the cave being shut, over time */}
      <rect x={x + w * 0.3} y={y + h * (0.92 - 0.56 * seal)} width={w * 0.4} height={h * 0.56 * seal}
        fill={colors.onGround} opacity={0.6} />
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={i} x1={x + w * 0.3} y1={y + h * (0.92 - 0.56 * seal * ((i + 1) / 5))}
          x2={x + w * 0.7} y2={y + h * (0.92 - 0.56 * seal * ((i + 1) / 5))}
          stroke={colors.ground} strokeWidth={2} opacity={0.4} />
      ))}
      <line x1={x} y1={y + h * 0.92} x2={x + w} y2={y + h * 0.92} stroke={colors.onGround} strokeWidth={3} opacity={0.5} />
    </g>
  );
});
