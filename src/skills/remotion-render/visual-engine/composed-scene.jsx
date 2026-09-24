/**
 * COMPOSED SCENE — one renderer for any declaration Gemini composes.
 *
 * This replaces the nine hardcoded scene functions in directed-scene.jsx
 * (TypographyScene, StateChangeScene, ConsumptionScene, ...). Those nine
 * were the entire visual vocabulary, they all drew text plus a shape or two
 * on a flat ground, and sixteen of sixteen Gemini verdicts across runs
 * 35293648208, 35317469026 and 35319923732 blamed exactly that:
 * "template monoculture... repetitive text-heavy headline slides".
 *
 * There is no per-mechanism function here on purpose. A scene is a list of
 * primitives with anchors, counts and motions; this file knows how to draw
 * each primitive and how to apply each motion, and composition is Gemini's
 * job. Adding a mechanism no longer means adding a function.
 *
 * TEXT RULES CARRIED OVER — these were expensive to learn:
 *  - labels use ed.quiet / ed.accentText, which are contrast-validated
 *    (scene-text.js). Never a bright fill at reduced alpha: a settled
 *    translucent glyph measured 2.30:1 and failed the gate (COL-24).
 *  - alpha animates ENTRANCES only and settles at 1. A constant sub-1
 *    multiplier never reaches full opacity at any point in the beat.
 *  - no invented fallback text. If a label is absent the object renders
 *    unlabelled — "GASOLINE", "REPORTED FIGURE", "EXPECTED" and friends were
 *    all removed for fabricating on-screen content.
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, Easing } from "remotion";
import {
  SAFE, SAFE_W, SAFE_H, CANVAS_W, CANVAS_H,
  PRIMITIVES, layoutScene, MAP_DRAWINGS,
} from "../visual/scene-primitives.js";
import { fitSingleLine, TYPO_LINE_HEIGHT } from "../visual/narrative-typography.js";
import { ICON_SET } from "../visual/icon-set.js";
import { ObjectShape, knownObjects } from "../compositions/objects/index.jsx";
import { LIBRARY_NAMES } from "../visual/library-names.js";

// The planner validates library_shape names against LIBRARY_NAMES, a list
// generated from the registerObject() calls. If that list and the live
// registry ever disagree, a validated plan could name a drawing that does
// not exist (or miss one that does). Checked once, when this module loads,
// and loud: this is the one-time log line for what the library exposes.
{
  const live = knownObjects();
  const missing = LIBRARY_NAMES.filter((n) => !live.includes(n));
  const extra = live.filter((n) => !LIBRARY_NAMES.includes(n));
  if (missing.length || extra.length) {
    throw new Error(
      `library-names.js is out of step with the object registry — run visual/build-library-names.mjs. ` +
      `missing from registry: [${missing.join(", ")}]; not in library-names.js: [${extra.join(", ")}]`
    );
  }
  console.log(`[composed-scene] library_shape: ${live.length} drawings available`);
}

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => Easing.bezier(0.22, 0.9, 0.3, 1)(clamp01(t));

/* ── Motion ──────────────────────────────────────────────────────────── */

/**
 * Resolve a motion into the transform values a primitive needs.
 *
 * `enter` ramps over the first 22% of the beat and then stays at 1 — never a
 * fraction, so a sampled frame at any settled point is fully opaque. The
 * frame auditor samples 82% through each beat for the same reason.
 */
function motionState(motion, p) {
  // Defend against a non-finite p. clamp01(NaN) is NaN, not 0 or 1, so a
  // NaN progress silently dimmed every composed object to ~13% rather than
  // failing — found by pixel bisection, not by reading the code. A broken
  // progress now renders SETTLED (fully opaque) instead of nearly invisible.
  const prog = Number.isFinite(p) ? p : 1;
  const enter = ease(clamp01(prog / 0.22));
  const act = ease(clamp01((prog - 0.2) / 0.55));   // the primitive's own action
  const s = { enter, act, opacity: enter, dy: 0, scale: 1, fill: 1, strike: 0, shed: 0 };

  switch (motion) {
    case "rise":   s.dy = (1 - enter) * 56; break;
    case "grow":   s.scale = 0.2 + 0.8 * act; break;
    // Settle at a MEANINGFUL level, never 0 or 1. A vessel that drains to
    // completely empty reads as an empty box rather than as consumption —
    // the first composed preview did exactly that.
    case "drain":  s.fill = 1 - act * 0.7; break;
    case "fill":   s.fill = 0.15 + act * 0.7; break;
    // A PARTIAL shed. `fall` used to settle at 1, which removed every
    // piece — so a 10-silhouette group rendered as ten faded ghosts and the
    // emphasis colour never appeared. Losing 45% reads as loss; losing
    // everything reads as an empty frame.
    case "fall":   s.shed = act * 0.45; break;
    case "strike": s.strike = act; break;
    case "split":  s.shed = act * 0.5; break;
    case "count":  s.fill = act; break;
    case "reveal": s.fill = act; break;
    case "appear":
    case "hold":
    default: break;
  }
  return s;
}

/* ── Label ───────────────────────────────────────────────────────────── */

/**
 * A label attached to an object. One line, contrast-validated colour, full
 * opacity once entered. Absent label renders nothing at all.
 */
function Label({ text, rect, ed, font, m, accent }) {
  const str = String(text == null ? "" : text).trim();
  if (!str) return null;
  const maxW = Math.min(rect.w * 1.35, SAFE_W * 0.86);
  const fit = fitSingleLine(str, maxW, 64);
  if (!fit.text) return null;
  return (
    <div style={{
      position: "absolute",
      left: rect.x, top: rect.y + rect.h + 12,
      width: maxW,
      opacity: m.enter,
      color: accent ? ed.accentText : ed.quiet,
      font: `600 ${fit.size}px ${font}, sans-serif`,
      lineHeight: TYPO_LINE_HEIGHT,
      whiteSpace: "nowrap",
      letterSpacing: -fit.size * 0.012,
    }}>{fit.text}</div>
  );
}

/* ── Primitive drawings ──────────────────────────────────────────────── */

function Field({ rect, ed, m }) {
  // A ground plane so objects are not floating in a void. Low-contrast
  // structure, never text.
  const step = 96;
  const lines = [];
  for (let y = rect.y + step; y < rect.y + rect.h; y += step) {
    lines.push(<line key={`h${y}`} x1={rect.x} y1={y} x2={rect.x + rect.w} y2={y}
      stroke={ed.depth} strokeWidth={1} />);
  }
  for (let x = rect.x + step; x < rect.x + rect.w; x += step) {
    lines.push(<line key={`v${x}`} x1={x} y1={rect.y} x2={x} y2={rect.y + rect.h}
      stroke={ed.depth} strokeWidth={1} />);
  }
  return <g opacity={m.enter * 0.9}>
    <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={ed.depth} opacity={0.35} />
    {lines}
  </g>;
}

function Blocks({ obj, rect, ed, m, accent }) {
  const n = Math.max(1, Math.min(60, obj.count || 1));
  const cols = Math.ceil(Math.sqrt(n * 1.6));
  const rows = Math.ceil(n / cols);
  const gap = 6;
  const bw = (rect.w - gap * (cols - 1)) / cols;
  const bh = (rect.h - gap * (rows - 1)) / rows;
  const cells = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    // `fall`: the last `shed` fraction detaches and drops away.
    const shedIdx = n - Math.round(m.shed * n);
    const gone = i >= shedIdx;
    const drop = gone ? (1 - (shedIdx ? i / n : 0)) * 260 * m.shed : 0;
    cells.push(
      <rect key={i}
        x={rect.x + c * (bw + gap)}
        y={rect.y + r * (bh + gap) + drop}
        width={Math.max(2, bw)} height={Math.max(2, bh)}
        rx={2}
        fill={gone ? ed.quiet : (accent ? ed.accentText : ed.surface)}
        opacity={gone ? 0.35 : 1} />
    );
  }
  return <g opacity={m.enter} transform={`translate(0,${m.dy})`}>{cells}</g>;
}

function Stack({ obj, rect, ed, m, accent }) {
  const n = Math.max(1, Math.min(24, obj.count || 1));
  const gap = 5;
  const bh = (rect.h - gap * (n - 1)) / n;
  // How many blocks are "filled in" — only motions that drive a LEVEL
  // reduce it. The previous expression tried to infer that from m.fill and
  // m.act and got it wrong: every block took the dimmed branch, so a
  // 12-block stack rendered at 0.12 opacity. Measured from the pixels —
  // [45,29,42] is exactly #f87e90 composited at 0.12 over the ground, which
  // is what localised it after reading the code twice did not.
  const LEVEL_MOTIONS = new Set(["fill", "drain", "count", "reveal"]);
  const level = LEVEL_MOTIONS.has(obj.motion) ? m.fill : 1;
  const shown = Math.max(1, Math.round(n * level));
  const items = [];
  for (let i = 0; i < n; i++) {
    const fromBottom = n - 1 - i;
    const visible = fromBottom < shown;
    items.push(
      <rect key={i}
        x={rect.x} y={rect.y + i * (bh + gap)}
        width={rect.w} height={Math.max(2, bh)} rx={2}
        fill={accent ? ed.accentText : ed.surface}
        opacity={visible ? 1 : 0.12} />
    );
  }
  return <g opacity={m.enter} transform={`translate(0,${m.dy})`}>{items}</g>;
}

function Bars({ obj, rect, ed, m, accent }) {
  const n = Math.max(1, Math.min(12, obj.count || 1));
  const gap = 14;
  const bh = (rect.h - gap * (n - 1)) / n;
  const items = [];
  for (let i = 0; i < n; i++) {
    // Descending proportions read as a comparison without inventing values.
    const frac = 1 - (i / Math.max(1, n)) * 0.55;
    const w = rect.w * frac * (m.scale === 1 ? 1 : m.scale);
    items.push(
      <g key={i}>
        <rect x={rect.x} y={rect.y + i * (bh + gap)} width={rect.w} height={Math.max(2, bh)}
          fill={ed.depth} opacity={0.5} />
        <rect x={rect.x} y={rect.y + i * (bh + gap)} width={Math.max(2, w)} height={Math.max(2, bh)}
          fill={i === 0 && accent ? ed.accentText : ed.surface} opacity={i === 0 ? 1 : 0.8} />
      </g>
    );
  }
  return <g opacity={m.enter} transform={`translate(0,${m.dy})`}>{items}</g>;
}

function Vessel({ obj, rect, ed, m, accent }) {
  const level = clamp01(m.fill);
  const fh = rect.h * level;
  const ticks = [0.25, 0.5, 0.75].map((t) => (
    <line key={t} x1={rect.x - 12} y1={rect.y + rect.h * (1 - t)} x2={rect.x - 2} y2={rect.y + rect.h * (1 - t)}
      stroke={ed.quiet} strokeWidth={2} />
  ));
  return (
    <g opacity={m.enter} transform={`translate(0,${m.dy})`}>
      {ticks}
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h}
        fill="none" stroke={ed.quiet} strokeWidth={3} />
      <rect x={rect.x + 3} y={rect.y + (rect.h - fh)} width={rect.w - 6} height={Math.max(0, fh - 3)}
        fill={accent ? ed.accentText : ed.surface} />
      <line x1={rect.x - 10} y1={rect.y + (rect.h - fh)} x2={rect.x + rect.w + 10} y2={rect.y + (rect.h - fh)}
        stroke={accent ? ed.accentText : ed.surface} strokeWidth={3} />
    </g>
  );
}

function Documents({ obj, rect, ed, m, accent }) {
  const n = Math.max(1, Math.min(8, obj.count || 1));
  const pages = [];
  for (let i = 0; i < n; i++) {
    const off = i * 14;
    const tear = m.shed * (i + 1) * 26;
    const lines = [];
    const pw = rect.w - off * 2;
    for (let l = 0; l < 7; l++) {
      lines.push(<rect key={l} x={rect.x + off + 18} y={rect.y + off + 30 + l * 22}
        width={pw * (l === 6 ? 0.45 : 0.78)} height={5} rx={2} fill={ed.textDark} opacity={0.35} />);
    }
    pages.push(
      <g key={i} transform={`translate(${off + tear}, ${off - tear * 0.3}) rotate(${m.shed * (i - n / 2) * 3}, ${rect.x + rect.w / 2}, ${rect.y + rect.h / 2})`}>
        <rect x={rect.x} y={rect.y} width={pw} height={rect.h - off * 2}
          fill={ed.surface} opacity={0.95} />
        {lines}
        {accent && i === 0 && (
          <rect x={rect.x + 18} y={rect.y + 30} width={pw * 0.5} height={5} rx={2} fill={ed.accent} />
        )}
      </g>
    );
  }
  return <g opacity={m.enter} transform={`translate(0,${m.dy})`}>{pages}</g>;
}

function Grid({ obj, rect, ed, m, accent }) {
  const cols = 10, rows = 10;
  const gap = 4;
  const cw = (rect.w - gap * (cols - 1)) / cols;
  const ch = (rect.h - gap * (rows - 1)) / rows;
  const total = cols * rows;
  const lit = Math.round(total * (m.fill === 1 ? 1 : m.fill));
  const cells = [];
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const on = i < lit;
    cells.push(<rect key={i}
      x={rect.x + c * (cw + gap)} y={rect.y + r * (ch + gap)}
      width={Math.max(1, cw)} height={Math.max(1, ch)} rx={1}
      fill={on ? (accent ? ed.accentText : ed.surface) : ed.depth}
      opacity={on ? 1 : 0.55} />);
  }
  return <g opacity={m.enter} transform={`translate(0,${m.dy})`}>{cells}</g>;
}

function Gauges({ obj, rect, ed, m, accent }) {
  const n = Math.max(1, Math.min(4, obj.count || 1));
  const r = Math.min(rect.w / (n * 2.2), rect.h / 2.2);
  const items = [];
  for (let i = 0; i < n; i++) {
    const cx = rect.x + r + i * (r * 2.2);
    const cy = rect.y + rect.h / 2;
    const frac = clamp01(m.fill === 1 ? 0.72 : m.fill);
    const a0 = Math.PI * 0.75, a1 = a0 + Math.PI * 1.5 * frac;
    const arc = (a) => `${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`;
    items.push(
      <g key={i}>
        <path d={`M ${arc(a0)} A ${r} ${r} 0 ${Math.PI * 1.5 > Math.PI ? 1 : 0} 1 ${arc(a0 + Math.PI * 1.5)}`}
          fill="none" stroke={ed.depth} strokeWidth={r * 0.22} strokeLinecap="round" />
        <path d={`M ${arc(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${arc(a1)}`}
          fill="none" stroke={accent ? ed.accentText : ed.surface} strokeWidth={r * 0.22} strokeLinecap="round" />
      </g>
    );
  }
  return <g opacity={m.enter} transform={`translate(0,${m.dy})`}>{items}</g>;
}

function Silhouettes({ obj, rect, ed, m, accent }) {
  const n = Math.max(1, Math.min(20, obj.count || 1));
  // Size the figure to fit BOTH the column width and the row height.
  // Using row height alone made each figure taller than its column was
  // wide, so ten silhouettes overlapped into an unreadable mush — visible
  // in the first composed preview.
  const cols = Math.min(n, 6);
  const rows = Math.ceil(n / cols);
  const cw = rect.w / cols, chh = rect.h / rows;
  const items = [];
  const shedIdx = n - Math.round(m.shed * n);
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const x = rect.x + c * cw + cw * 0.5;
    const y = rect.y + r * chh;
    // aspect ~0.45 (w:h), so height is capped by width * 2.2 as well.
    const hh = Math.min(chh * 0.86, cw * 2.0);
    const gone = i >= shedIdx;
    items.push(
      <g key={i} opacity={gone ? 0.25 : 1} transform={gone ? `translate(0,${m.shed * 90})` : undefined}>
        <circle cx={x} cy={y + hh * 0.16} r={hh * 0.15} fill={gone ? ed.quiet : (accent ? ed.accentText : ed.surface)} />
        <rect x={x - hh * 0.17} y={y + hh * 0.34} width={hh * 0.34} height={hh * 0.58} rx={hh * 0.12}
          fill={gone ? ed.quiet : (accent ? ed.accentText : ed.surface)} />
      </g>
    );
  }
  return <g opacity={m.enter} transform={`translate(0,${m.dy})`}>{items}</g>;
}

/**
 * icon — a vendored Lucide pictogram (MOTION-GRAPHICS-MANUAL §A4), drawn
 * from its own geometry so stroke and colour obey the manual:
 *  - §A4.3: apparent stroke 6-12 px at 1080 wide, so the stroke-width
 *    attribute is recomputed from the rendered size (target 10 px).
 *  - §A4.5: text colour by default, accent only on the emphasis object.
 * validateScene() rejects an unknown icon name before render; if one still
 * arrives here it throws rather than drawing a substitute.
 */
function Icons({ obj, rect, ed, m, accent }) {
  const els = ICON_SET[obj.icon];
  if (!els) throw new Error(`No icon "${obj.icon}" in the vendored set`);
  const n = Math.max(1, Math.min(3, obj.count || 1));
  const cw = rect.w / n;
  const size = Math.min(cw * 0.9, rect.h) * (m.scale === 1 ? 1 : m.scale);
  const stroke = (10 * 24) / Math.max(1, size);   // §A4.3: 10 px apparent
  const color = accent ? ed.accentText : ed.text;
  const shedIdx = n - Math.round(m.shed * n);
  const items = [];
  for (let i = 0; i < n; i++) {
    const x = rect.x + cw * i + (cw - size) / 2;
    const y = rect.y + (rect.h - size) / 2;
    const gone = i >= shedIdx;
    items.push(
      <g key={i} opacity={gone ? 0.25 : 1}
        transform={`translate(${x},${y + (gone ? m.shed * 90 : 0)}) scale(${size / 24})`}
        fill="none" stroke={gone ? ed.quiet : color} strokeWidth={stroke}
        strokeLinecap="round" strokeLinejoin="round">
        {els.map(([tag, attrs], k) => React.createElement(tag, { key: k, ...attrs }))}
      </g>
    );
  }
  return <g opacity={m.enter} transform={`translate(0,${m.dy})`}>{items}</g>;
}

/**
 * library_shape — one drawing from the procedural object library
 * (compositions/objects/*.jsx), drawn unchanged into the rect the layout
 * assigned. The drawings keep their own stroke weights; only the palette is
 * translated, from this renderer's contrast-validated roles to the
 * library's (palette-roles.js vocabulary), using no colour that is not
 * already in `ed`:
 *   ground   = ed.bg            onGround = ed.text (validated against bg)
 *   accent   = ed.accentText    (validated against bg)
 *   paper/ink: a light ground uses bg as paper and text as ink (sheets read
 *   by their outline, as on ch-01); a dark ground inverts that.
 * An unknown name throws inside ObjectShape — no substitute drawing.
 */
function relLum(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return 1;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function LibraryShape({ obj, rect, ed, m, p, font }) {
  const light = relLum(ed.bg) > 0.5;
  const colors = {
    ground: ed.bg,
    onGround: ed.text,
    accent: ed.accentText,
    paper: light ? ed.bg : ed.text,
    ink: light ? ed.text : ed.bg,
  };
  const s = m.scale === 1 ? 1 : m.scale;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  return (
    <g opacity={m.enter}
      transform={`translate(0,${m.dy}) translate(${cx},${cy}) scale(${s}) translate(${-cx},${-cy})`}>
      <ObjectShape name={obj.name} box={rect} colors={colors} p={Number.isFinite(p) ? p : 1}
        params={{ label: obj.label, count: obj.count, font }} />
    </g>
  );
}

function Arrows({ obj, rect, ed, m }) {
  const n = Math.max(1, Math.min(8, obj.count || 1));
  const items = [];
  for (let i = 0; i < n; i++) {
    const y = rect.y + (rect.h / (n + 1)) * (i + 1);
    const len = rect.w * (m.scale === 1 ? 1 : m.scale);
    items.push(
      <g key={i}>
        <line x1={rect.x} y1={y} x2={rect.x + len - 14} y2={y}
          stroke={ed.accent} strokeWidth={4} strokeLinecap="round" />
        <polygon points={`${rect.x + len},${y} ${rect.x + len - 18},${y - 10} ${rect.x + len - 18},${y + 10}`}
          fill={ed.accent} />
      </g>
    );
  }
  return <g opacity={m.enter}>{items}</g>;
}

function Rules({ obj, rect, ed, m }) {
  const n = Math.max(1, Math.min(6, obj.count || 1));
  const items = [];
  for (let i = 0; i < n; i++) {
    const y = rect.y + (rect.h / Math.max(1, n)) * i;
    items.push(<rect key={i} x={rect.x} y={y} width={rect.w * (m.scale === 1 ? 1 : m.scale)} height={3}
      fill={ed.accent} />);
  }
  return <g opacity={m.enter}>{items}</g>;
}

/** figure / counter — a number IS the object, drawn large. */
function Numeral({ obj, rect, ed, m, font, accent }) {
  const raw = String(obj.label == null ? "" : obj.label).trim();
  if (!raw) return null;
  const fit = fitSingleLine(raw, rect.w * 1.2, rect.h);
  return (
    <div style={{
      position: "absolute",
      left: rect.x, top: rect.y,
      width: rect.w * 1.2, height: rect.h,
      display: "flex", alignItems: "center",
      opacity: m.enter,
      color: accent ? ed.accentText : ed.text,
      font: `900 ${Math.max(fit.size, 64)}px ${font}, sans-serif`,
      letterSpacing: -fit.size * 0.02,
      whiteSpace: "nowrap",
      fontVariantNumeric: "tabular-nums",
    }}>{fit.text}</div>
  );
}

const DRAW_SVG = {
  field: Field, block: Blocks, stack: Stack, bar: Bars, vessel: Vessel,
  document: Documents, grid: Grid, gauge: Gauges, silhouette: Silhouettes,
  arrow: Arrows, rule: Rules, icon: Icons, library_shape: LibraryShape,
};
const DRAW_HTML = { figure: Numeral, counter: Numeral };

/* ── The scene ───────────────────────────────────────────────────────── */

/**
 * Draw a validated scene declaration.
 *
 * Objects render in declaration order, so a `field` declared first sits
 * behind everything — which is how a composition stops reading as objects
 * floating in a void. `accent` marks the ONE object carrying the beat;
 * everything else is structure.
 */
export function ComposedScene({ scene, p, ed, font }) {
  const objects = (scene && scene.objects) || [];
  const svgParts = [];
  const htmlParts = [];

  // layoutScene assigns NON-OVERLAPPING rects. Placing objects from their
  // anchors alone let two objects claim the same space: the first composed
  // preview drew a grid and ten silhouettes on top of each other as an
  // unreadable blob, with the label inside the object it named.
  layoutScene(objects).forEach(({ obj, rect }, i) => {
    const m = motionState(obj.motion || "appear", p);
    const accent = !!obj.emphasis;
    const Svg = DRAW_SVG[obj.kind];
    const Html = DRAW_HTML[obj.kind];

    if (Svg) {
      svgParts.push(<Svg key={`s${i}`} obj={obj} rect={rect} ed={ed} m={m} p={p} accent={accent} font={font} />);
      if (m.strike > 0) {
        svgParts.push(
          <line key={`k${i}`} x1={rect.x} y1={rect.y + rect.h / 2}
            x2={rect.x + rect.w * m.strike} y2={rect.y + rect.h / 2}
            stroke={ed.accent} strokeWidth={5} />
        );
      }
    }
    if (Html) {
      htmlParts.push(<Html key={`h${i}`} obj={obj} rect={rect} ed={ed} m={m} accent={accent} font={font} />);
    }
    // Labels are HTML so they use the same text pipeline as narrative
    // typography (one line, fitted, validated colour).
    // A map draws its own label on a leader line (maps.jsx); a second label
    // under the slot would repeat it.
    const drawsOwnLabel = obj.kind === "library_shape" && MAP_DRAWINGS.includes(obj.name);
    if (PRIMITIVES[obj.kind]?.labelable && obj.label && !Html && !drawsOwnLabel) {
      htmlParts.push(<Label key={`l${i}`} text={obj.label} rect={rect} ed={ed} font={font} m={m} accent={accent} />);
    }
  });

  return (
    <>
      <svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{ position: "absolute", left: 0, top: 0 }}>
        {svgParts}
      </svg>
      {htmlParts}
    </>
  );
}

export default ComposedScene;
