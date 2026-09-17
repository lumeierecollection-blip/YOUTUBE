import React from "react";
import { AbsoluteFill, useCurrentFrame, Easing } from "remotion";
import { paletteRoles } from "../visual/palette-roles.js";
import { SAFE_SHORTS } from "../layout/slots.js";
import {
  fitSingleLine, estimateEmWidth,
  TYPO_SAFE_WIDTH_FRACTION, TYPO_LINE_HEIGHT,
} from "../visual/narrative-typography.js";
import {
  ensureTextContrast, contrastRatio,
  TEXT_TARGET_CONTRAST, ACCENT_TEXT_TARGET_CONTRAST,
} from "../visual/scene-text.js";

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const S = SAFE_SHORTS;
const SAFE_W = S.right - S.left;
const SAFE_H = S.bottom - S.top;

const clamp01 = (t) => Math.max(0, Math.min(1, t));

/* ── Motion weight — different easing per semantic role ─────────────── */

const EASE = {
  default:  (t) => Easing.bezier(0.22, 0.9, 0.3, 1)(clamp01(t)),
  sharp:    (t) => Easing.bezier(0.16, 1, 0.3, 1)(clamp01(t)),
  heavy:    (t) => Easing.bezier(0.34, 0.8, 0.4, 1)(clamp01(t)),
  breathe:  (t) => Easing.bezier(0.45, 0.05, 0.35, 1)(clamp01(t)),
  decisive: (t) => Easing.bezier(0.0, 0.9, 0.1, 1)(clamp01(t)),
  loss:     (t) => Easing.bezier(0.55, 0.0, 0.68, 0.55)(clamp01(t)),
};

const WEIGHT_EASE = {
  calm: EASE.default,
  building: EASE.breathe,
  sharp: EASE.sharp,
  heavy: EASE.heavy,
  urgent: EASE.decisive,
};

function easeFor(mechanism, emotionalWeight) {
  if (emotionalWeight && WEIGHT_EASE[emotionalWeight]) return WEIGHT_EASE[emotionalWeight];
  switch (mechanism) {
    case "VISIBLE_CONSUMPTION": case "STRUCTURAL_BREAKDOWN": return EASE.loss;
    case "PHYSICAL_GROWTH": return EASE.breathe;
    case "ACTION_CONSEQUENCE": return EASE.sharp;
    case "STATE_CHANGE": return EASE.decisive;
    case "EVIDENCE_FIGURE": return EASE.heavy;
    default: return EASE.default;
  }
}

const easeIO = (t) => Easing.bezier(0.65, 0, 0.35, 1)(clamp01(t));

function beatAt(plan, frame) {
  const beats = plan.beats;
  let i = 0;
  while (i < beats.length - 1 && frame >= beats[i + 1].start_frame) i++;
  const b = beats[i];
  const p = clamp01((frame - b.start_frame) / Math.max(1, b.duration_frames));
  const local = frame - b.start_frame;
  const prev = i > 0 ? beats[i - 1] : null;
  return { beat: b, p, local, prev, beatIndex: i };
}

/* ── Editorial palette ──────────────────────────────────────────────── */

function editorialColors(colors, rawPalette) {
  const lum = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  // TRUE WCAG 2.1 relative-luminance contrast — the SAME formula the render
  // gate (scripts/frame-audit.js, COL-23) measures with. The previous
  // simplified (0.299R+.587G+.114B)/255 ratio disagreed with WCAG by enough
  // that a "subdued" it rated >=4.5 measured only ~4.1 WCAG at the gate, so
  // de-emphasized labels drawn in ed.subdued failed frame-audit on some
  // channels (ch2: glyph rgb(116,116,137), 4.10:1). Selecting subdued with
  // this formula and a safety margin keeps ed.subdued genuinely legible.
  const chan = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
  const relLum = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  };
  const contrastRatio = (a, b) => {
    const [hi, lo] = [relLum(a), relLum(b)].sort((p, q) => q - p);
    return (hi + 0.05) / (lo + 0.05);
  };
  const all = [...rawPalette.primary, ...rawPalette.secondary];
  const sorted = [...all].sort((a, b) => lum(a) - lum(b));
  const bgColor = sorted[0];
  const brightest = sorted[sorted.length - 1];
  // Margin over the 4.5 AA floor absorbs anti-aliasing (thin-glyph cores
  // measure a touch below the flat colour). Prefer the DIMMEST palette
  // colour that still clears the margin so subdued stays de-emphasized;
  // if nothing does, fall back to the brightest colour (always legible).
  const SUBDUED_MARGIN = 5.5;
  const subduedCandidates = all
    .filter((c) => c !== colors.accent && contrastRatio(c, bgColor) >= SUBDUED_MARGIN)
    .sort((a, b) => lum(a) - lum(b));
  const safeSubdued = subduedCandidates[0] || brightest;

  // TEXT ROLES vs FILL ROLES — these are not interchangeable.
  //
  // `accent` stays exactly as the channel declared it: it fills bars,
  // rules and strike-throughs, which are large solid areas whose sampled
  // colour is their real colour.
  //
  // `accentText` is the same hue raised until it clears
  // ACCENT_TEXT_TARGET_CONTRAST, because a GLYPH's sampled colour is not
  // its fill colour — anti-aliased edges and yuv420p chroma subsampling
  // pull it down by up to ~22% (see ANTIALIAS_SAMPLE_RATIO). Run
  // 35261545735 failed the gate on exactly this: ch2's declared #F5536B is
  // 5.74:1 flat and PASSES, but the same fill sampled 4.47:1 as a headline
  // glyph and 5.60:1 as a larger one. Giving glyphs headroom fixes the
  // render; relaxing the gate would only hide it.
  const accentText = ensureTextContrast(colors.accent, bgColor, ACCENT_TEXT_TARGET_CONTRAST);
  // Quiet text (eyebrows, ticks, units) is de-emphasised by COLOUR, never
  // by alpha — a translucent bright fill is what produced the 2.30:1
  // rgb(77,77,87) violation. Validated to the same glyph-aware target.
  const quietText = ensureTextContrast(safeSubdued, bgColor, TEXT_TARGET_CONTRAST);
  return {
    bg: bgColor,
    depth: sorted[1] || sorted[0],
    surface: brightest,
    text: brightest,
    textDark: sorted[0],
    accent: colors.accent,
    accentText,
    subdued: quietText,
    quiet: quietText,
  };
}

/* ── Text layout ────────────────────────────────────────────────────── */

// De-emphasized labels (eyebrows, annotations) are drawn in ed.subdued at
// FULL opacity, never in translucent ed.text. paletteRoles guarantees
// ed.subdued clears WCAG AA 4.5:1 against the channel ground. Translucent
// white was the old approach and it failed frame-audit (COL-23) on
// near-black channels: a thin, small, letter-spaced monospace glyph at
// even 0.62 opacity never reaches full pixel coverage, so its anti-aliased
// cores composite to ~rgb(71) on #000 (2.2:1) — below AA. A solid subdued
// colour has opaque cores that measure at the colour's own luminance.

// LH/emW now come from visual/narrative-typography.js so the planner, the
// renderer and the local auditor all measure text the same way.
const LH = TYPO_LINE_HEIGHT;
const MAX_SZ = 140;
const MIN_SZ = 28;
const emW = estimateEmWidth;

// layoutWords() — the old 1-or-2-row layout — is deliberately GONE. Its
// two-row fallback produced the "headline + supporting line" structure that
// narrative typography prohibits. TypographyScene now uses fitSingleLine(),
// which guarantees exactly one line and condenses instead of shrinking.

function fitFontSize(text, maxW, maxSz, minSz) {
  // Fit wins over the min-size floor (same rule as layoutWords): the size
  // is never allowed to exceed the value that fits maxW, so a long label
  // can't overflow its box. The floor only applies when it still fits.
  const em = emW(text);
  const fit = maxW / Math.max(0.5, em);
  return Math.min(fit, Math.max(minSz || 18, Math.min(maxSz || MAX_SZ, fit)));
}

function findObj(objects, ...hints) {
  if (!objects?.length) return {};
  for (const h of hints) {
    const found = objects.find((o) =>
      o.id === h || o.role === h ||
      (o.role && o.role.toLowerCase().includes(h)) ||
      (o.id && o.id.toLowerCase().includes(h)));
    if (found) return found;
  }
  return objects[0] || {};
}

/* ── Beat transition layer ─────────────────────────────────────────── */

const TRANSITION_FRAMES = 12;

function transitionOpacity(beat, local, beatIndex) {
  if (beatIndex === 0) {
    return clamp01(local / 3);
  }
  const enterP = clamp01(local / TRANSITION_FRAMES);
  const exitP = clamp01((local - beat.duration_frames + TRANSITION_FRAMES) / TRANSITION_FRAMES);
  return Math.min(enterP, 1 - exitP);
}

/* ══════════════════════════════════════════════════════════════════════
   MATERIAL OBJECTS — things that look like what they represent
   ══════════════════════════════════════════════════════════════════════ */

function FuelGauge({ cx, cy, r, fill, label, reading, readingOpacity, ed, font }) {
  const startAngle = -210 * Math.PI / 180;
  const endAngle = 30 * Math.PI / 180;
  const range = endAngle - startAngle;

  const arcPt = (angle) => ({
    x: cx + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r,
  });

  const segments = 80;
  let trackD = "";
  let fillD = "";
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + range * t;
    const pt = arcPt(a);
    const cmd = i === 0 ? "M" : "L";
    trackD += `${cmd}${pt.x.toFixed(1)},${pt.y.toFixed(1)} `;
    if (t <= fill) fillD += `${cmd}${pt.x.toFixed(1)},${pt.y.toFixed(1)} `;
  }

  const needleAngle = startAngle + range * Math.min(1, fill);
  const needleLen = r * 0.82;
  const nEnd = { x: cx + Math.cos(needleAngle) * needleLen, y: cy + Math.sin(needleAngle) * needleLen };

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const a = startAngle + range * t;
    return {
      inner: arcPt(a),
      outer: { x: cx + Math.cos(a) * (r + 14), y: cy + Math.sin(a) * (r + 14) },
    };
  });

  const dangerStart = 0.7;
  let dangerD = "";
  for (let i = 0; i <= 20; i++) {
    const t = dangerStart + (1 - dangerStart) * (i / 20);
    const a = startAngle + range * t;
    const pt = { x: cx + Math.cos(a) * (r + 6), y: cy + Math.sin(a) * (r + 6) };
    dangerD += `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)} `;
  }

  return (
    <g>
      <path d={dangerD} fill="none" stroke="#EF4444" strokeWidth={5} opacity={0.15} strokeLinecap="round" />
      <path d={trackD} fill="none" stroke={ed.surface} strokeWidth={6} opacity={0.1} strokeLinecap="round" />
      {fill > 0 && (
        <path d={fillD} fill="none" stroke={ed.accent} strokeWidth={8} opacity={0.7} strokeLinecap="round" />
      )}
      {ticks.map((t, i) => (
        <line key={i} x1={t.inner.x} y1={t.inner.y} x2={t.outer.x} y2={t.outer.y}
          stroke={ed.surface} strokeWidth={2} opacity={0.2} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.12} fill={ed.depth} stroke={ed.surface} strokeWidth={1.5} opacity={0.3} />
      <line x1={cx} y1={cy} x2={nEnd.x} y2={nEnd.y}
        stroke={ed.accent} strokeWidth={3.5} strokeLinecap="round" opacity={0.9} />
      <circle cx={cx} cy={cy} r={6} fill={ed.accent} />
      {reading && (
        <text x={cx} y={cy + r * 0.45} textAnchor="middle"
          fontFamily={`${font}, monospace`} fontWeight={900}
          fontSize={Math.min(72, r * 0.38)} fill={ed.accentText}
          fontVariantNumeric="tabular-nums" opacity={readingOpacity ?? 1}>{reading}</text>
      )}
      {label && (
        <text x={cx} y={cy + r * 0.65} textAnchor="middle"
          fontFamily={`${font}, sans-serif`} fontWeight={600}
          fontSize={22} fill={ed.subdued}
          letterSpacing={4}>{label}</text>
      )}
    </g>
  );
}

function ReceiptSheet({ x, y, w, h, items, total, growth, growthP, ed, font }) {
  const pad = 20;
  const lineH = 34;
  const zigH = 10;
  const zigW = 14;
  const nZig = Math.ceil(w / zigW);

  let topEdge = `M${x},${y + zigH}`;
  for (let i = 0; i < nZig; i++) {
    const lx = x + i * zigW;
    topEdge += ` L${lx + zigW / 2},${y} L${lx + zigW},${y + zigH}`;
  }
  topEdge += ` L${x + w},${y + h} L${x},${y + h} Z`;

  return (
    <g>
      <path d={topEdge} fill={ed.surface} opacity={0.92} />
      <text x={x + w / 2} y={y + zigH + 36} textAnchor="middle"
        fontFamily={`${font}, monospace`} fontWeight={700}
        fontSize={18} fill={ed.textDark} opacity={0.5} letterSpacing={3}>GROCERY RECEIPT</text>
      <line x1={x + pad} y1={y + zigH + 50} x2={x + w - pad} y2={y + zigH + 50}
        stroke={ed.textDark} strokeWidth={1} opacity={0.15} strokeDasharray="3 3" />
      {(items || []).map((item, i) => (
        <g key={i} opacity={Math.min(1, (growthP || 1) * 3 - i * 0.3)}>
          <text x={x + pad} y={y + zigH + 78 + i * lineH}
            fontFamily={`${font}, monospace`} fontWeight={400}
            fontSize={16} fill={ed.textDark} opacity={0.55}>{item.name}</text>
          <text x={x + w - pad} y={y + zigH + 78 + i * lineH} textAnchor="end"
            fontFamily={`${font}, monospace`} fontWeight={600}
            fontSize={16} fill={ed.textDark} opacity={0.7}>{item.price}</text>
        </g>
      ))}
      {total && (
        <>
          <line x1={x + pad} y1={y + h - 70} x2={x + w - pad} y2={y + h - 70}
            stroke={ed.textDark} strokeWidth={1.5} opacity={0.2} />
          <text x={x + pad} y={y + h - 42}
            fontFamily={`${font}, monospace`} fontWeight={700}
            fontSize={20} fill={ed.textDark} opacity={0.7}>TOTAL</text>
          <text x={x + w - pad} y={y + h - 42} textAnchor="end"
            fontFamily={`${font}, monospace`} fontWeight={900}
            fontSize={26} fill={ed.accent}>{total}</text>
        </>
      )}
      {growth && (
        <text x={x + w - pad} y={y + h - 14} textAnchor="end"
          fontFamily={`${font}, sans-serif`} fontWeight={800}
          fontSize={18} fill={ed.accent} opacity={0.75}>+{growth} vs 2020</text>
      )}
    </g>
  );
}

function StatisticCallout({ x, y, value, label, source, ed, font, highlighted, opacity: outerOp }) {
  const sz = Math.min(120, SAFE_W * 0.4 / Math.max(1, String(value).length * 0.45));
  const op = outerOp ?? 1;
  const sourceH = source ? 30 : 0;
  const valueY = y + sourceH + sz;
  const labelY = valueY + 28;
  const totalH = (label ? labelY : valueY) - y + 16;
  return (
    <g opacity={op}>
      <line x1={x} y1={y} x2={x} y2={y + totalH}
        stroke={highlighted ? ed.accent : ed.surface} strokeWidth={3} opacity={0.35} />
      {source && (
        <text x={x + 18} y={y + 16}
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={13} fill={ed.subdued} letterSpacing={3}>{source}</text>
      )}
      <text x={x + 18} y={valueY}
        fontFamily={`${font}, sans-serif`} fontWeight={900}
        fontSize={sz} fill={highlighted ? ed.accent : ed.text}
        fontVariantNumeric="tabular-nums">{value}</text>
      {label && (
        <text x={x + 18} y={labelY}
          fontFamily={`${font}, sans-serif`} fontWeight={500}
          fontSize={20} fill={ed.quiet}>{label}</text>
      )}
    </g>
  );
}

function BudgetBar({ x, y, w, h, segments, broken, consumed, ed, font }) {
  let xOff = 0;
  const brk = broken || 0;
  const con = consumed || 0;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4}
        fill="none" stroke={ed.surface} strokeWidth={2} opacity={0.12} />
      {(segments || []).map((seg, i) => {
        const segW = w * seg.ratio;
        const segX = x + xOff;
        const dy = brk > 0.1 && i > 0 ? brk * (i * 18 + Math.sin(i * 2.7) * 12) : 0;
        const rot = brk > 0.1 && i > 0 ? brk * (i % 2 ? 4 : -3) : 0;
        const opacity = con > 0 && i > 0 ? Math.max(0.1, 1 - con * (i * 0.5)) : 0.85;
        xOff += segW;
        const isConsumed = con > 0 && i === 0;
        const growW = isConsumed ? segW + (w - segW) * con : segW;
        return (
          <g key={i}
            transform={dy || rot ? `translate(0,${dy}) rotate(${rot},${segX + segW / 2},${y + h / 2})` : undefined}>
            <rect x={segX} y={y} width={Math.max(0, isConsumed ? growW : segW)} height={h}
              rx={3} fill={seg.color || ed.accent} opacity={opacity * (seg.fillOp || 0.3)} />
            {segW > 50 && (
              <>
                <text x={segX + (isConsumed ? growW : segW) / 2} y={y + h / 2 - 2} textAnchor="middle"
                  fontFamily={`${font}, sans-serif`} fontWeight={800}
                  fontSize={Math.min(22, segW * 0.22)} fill={ed.text} opacity={opacity * 0.85}>
                  {seg.label}
                </text>
                <text x={segX + (isConsumed ? growW : segW) / 2} y={y + h / 2 + 18} textAnchor="middle"
                  fontFamily={`${font}, sans-serif`} fontWeight={600}
                  fontSize={Math.min(16, segW * 0.16)} fill={ed.text} opacity={opacity * 0.65}>
                  {seg.pct}
                </text>
              </>
            )}
          </g>
        );
      })}
      {brk > 0.3 && (
        <>
          <line x1={x + w * 0.5} y1={y - 6} x2={x + w * 0.48} y2={y + h + 6}
            stroke={ed.accent} strokeWidth={2.5} opacity={brk * 0.5} strokeLinecap="round" />
          <line x1={x + w * 0.8} y1={y - 4} x2={x + w * 0.82} y2={y + h + 4}
            stroke={ed.accent} strokeWidth={2} opacity={brk * 0.35} strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

function DocumentPage({ x, y, w, h, title, lineCount, highlight, torn, ed, font }) {
  const pad = 22;
  const lc = lineCount || 9;
  const tornP = torn || 0;
  const tearOffset = (i) => tornP > 0.1 ? Math.sin(i * 1.7) * tornP * 14 : 0;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3}
        fill={ed.surface} opacity={0.9}
        transform={tornP > 0.3 ? `rotate(${tornP * 2.5},${x + w / 2},${y + h / 2})` : undefined} />
      {title && (
        <text x={x + w / 2} y={y + 44} textAnchor="middle"
          fontFamily={`${font}, monospace`} fontWeight={700}
          fontSize={Math.min(22, w / Math.max(1, title.length * 0.55))}
          fill={ed.textDark} opacity={0.65 * (1 - tornP * 0.4)}
          letterSpacing={2}
          textDecoration={tornP > 0.4 ? "line-through" : "none"}>{title}</text>
      )}
      <line x1={x + pad} y1={y + 58} x2={x + w - pad} y2={y + 58}
        stroke={ed.textDark} strokeWidth={1.5} opacity={0.15} />
      {Array.from({ length: lc }).map((_, i) => {
        const ly = y + 80 + i * ((h - 100) / lc);
        const shift = tearOffset(i);
        const fracture = tornP * (0.2 + (i / lc) * 0.8);
        const gapX = x + pad + (w - 2 * pad) * (0.3 + (i % 3) * 0.2);
        const gapW = (w - 2 * pad) * 0.12 * fracture;
        if (fracture > 0.15) {
          return (
            <g key={i}>
              <line x1={x + pad} y1={ly + shift * 0.6} x2={Math.min(gapX - gapW / 2, x + w - pad)} y2={ly + shift}
                stroke={ed.textDark} strokeWidth={2} opacity={0.12 * (1 - fracture * 0.5)} />
              <line x1={gapX + gapW / 2} y1={ly - shift * 0.4} x2={x + w - pad} y2={ly - shift * 0.7}
                stroke={ed.textDark} strokeWidth={2} opacity={0.08 * (1 - fracture * 0.3)} />
            </g>
          );
        }
        return (
          <line key={i} x1={x + pad} y1={ly} x2={x + w - pad} y2={ly}
            stroke={ed.textDark} strokeWidth={2} opacity={0.12} />
        );
      })}
      {highlight && (
        <rect x={x + pad} y={y + 80 + Math.floor(lc * 0.3) * ((h - 100) / lc) - 8}
          width={(w - 2 * pad) * 0.65} height={24}
          rx={2} fill={ed.accent} opacity={0.15} />
      )}
      {tornP > 0.25 && (
        <>
          <line x1={x + w * 0.3} y1={y + h * 0.15} x2={x + w * 0.5} y2={y + h * 0.85}
            stroke={ed.accent} strokeWidth={2.5} opacity={tornP * 0.4} strokeLinecap="round" />
          <line x1={x + w * 0.65} y1={y + h * 0.1} x2={x + w * 0.45} y2={y + h * 0.75}
            stroke={ed.accent} strokeWidth={2} opacity={tornP * 0.3} strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TYPOGRAPHY SCENE — one intentional phrase, not subtitles.

   Rule: typography appears because the WORDS ARE THE IDEA.
   No background panel. No floating card. Text IS the composition.
   ══════════════════════════════════════════════════════════════════════ */

function TypographyScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor(scene.mechanism, beat.emotional_weight);
  const phrase = beat.text || "";
  if (!phrase) return null;

  // NARRATIVE TYPOGRAPHY, not headline typography. The renderer's guarantee:
  // exactly ONE line, centred in the safe area, always inside the safe width.
  // fitSingleLine() (visual/narrative-typography.js) picks a size that cannot
  // make the line wider than the budget, and when a phrase would only fit by
  // shrinking below the readable floor it CONDENSES the phrase instead — the
  // direction's "rewrite rather than shrink until tiny" rule. The previous
  // implementation called layoutWords(), which fell back to TWO stacked rows
  // (headline + supporting line) for anything long; that structure is exactly
  // what this visual language prohibits, so it is gone.
  const fit = fitSingleLine(phrase, SAFE_W * TYPO_SAFE_WIDTH_FRACTION, SAFE_H * 0.42);
  const size = fit.size;
  const line = fit.text;
  if (!line) return null;
  const emphSet = new Set((scene.typography?.emphasis_words || []).map((w) => w.toLowerCase()));
  const isQuestion = scene.typography?.style === "question" || /\?\s*$/.test(line);
  const isImperative = scene.typography?.style === "imperative";

  // enterP still drives the slide-up entrance transform below — that's
  // real motion, not a duplicate of the beat crossfade. Its old partner
  // fadeOut (and the matching one in every other scene in this file) used
  // to ALSO multiply this container's opacity, stacking with the outer
  // per-beat tOpacity crossfade in DirectedScene. Two independent fades
  // compounding multiplicatively (e.g. 0.08 outer x 0.03 scene-level ≈
  // 0.003 combined) produced the near-black frames confirmed by real pixel
  // sampling of production QA frames and reproduced in isolation via
  // scripts/diag-render-frames.mjs (frame at local=1 of a beat: combined
  // opacity 0.003, pure black; local=75 mid-beat: opacity 1, renders
  // correctly). DirectedScene's tOpacity is the single beat-transition
  // fade now; every scene renders at full opacity internally.
  const enterP = ease(clamp01(local / 14));
  const holdP = clamp01((local - 14) / 20);

  return (
    // CENTRED BY DEFAULT — horizontally across the safe width and vertically
    // within the usable safe region. Narrative emphasis sits at the optical
    // centre of the frame; it is not a lower third, a title card or a
    // top-anchored headline. The whole phrase translates as ONE object
    // (TYP-08: no per-word/karaoke animation) — emphasis is carried by
    // colour, never by animating individual words independently.
    <div style={{
      position: "absolute",
      left: S.left, width: SAFE_W,
      top: S.top, height: SAFE_H,
      display: "flex", alignItems: "center", justifyContent: "center",
      transform: `translateY(${(1 - enterP) * size * 0.28}px)`,
    }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        maxWidth: SAFE_W * TYPO_SAFE_WIDTH_FRACTION,
      }}>
        <div style={{
          // nowrap + a fitted size = one line that cannot wrap or overflow.
          whiteSpace: "nowrap",
          textAlign: "center",
          fontFamily: `${font}, sans-serif`,
          fontWeight: isImperative ? 900 : 800,
          fontSize: size, lineHeight: TYPO_LINE_HEIGHT,
          letterSpacing: -size * 0.022,
          fontStyle: isQuestion ? "italic" : "normal",
          color: ed.text,
        }}>
          {line.split(" ").map((word, wi, arr) => {
            const isEmph = emphSet.has(word.toLowerCase().replace(/[^a-z0-9]/g, ""));
            return (
              <span key={wi} style={{ color: isEmph ? ed.accent : ed.text }}>
                {word}{wi < arr.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
        {/* Accent rule under the phrase — grounds it without boxing it. */}
        {holdP > 0.3 && (
          <div style={{
            marginTop: size * 0.34,
            width: `${holdP * 48}px`, height: 3,
            background: ed.accent, opacity: 0.7,
          }} />
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SCENE RENDERERS — SVG-native, full-canvas, no panel containers.

   Architecture rules:
   - No div panels with background fills (these are rectangular cards)
   - All compositions span the full SAFE_H (top to bottom)
   - Typography is embedded INTO visual objects, not floating above
   - The vertical 9:16 format is used intentionally (not 16:9 centered)
   - Objects embody meaning — they ARE what they represent
   ══════════════════════════════════════════════════════════════════════ */

/* ── SURFACE AND BENEATH ─────────────────────────────────────────────
   Mechanism: official figure (surface) is displaced upward as the
   reality beneath it is revealed. The surface is raw large text,
   not a card. The reveal is a vertical slide/split.
   ──────────────────────────────────────────────────────────────────── */

function SurfaceBeneathScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("SURFACE_AND_BENEATH", beat.emotional_weight);
  const objs = scene.objects || [];
  const surface = findObj(objs, "surface", "official", "headline");
  const beneath = findObj(objs, "beneath", "hidden", "reality");
  const beneathObj = beneath !== surface ? beneath : (objs[1] || {});

  const surfaceLabel = surface.label || beat.visual_headline || "";
  // Only render category LABELS the plan actually supplied (from real
  // researched breakdown data). This scene must never invent category names
  // or statistics: it used to fall back to hard-coded budgeting categories
  // (nonsensical on a fraud/geopolitics channel) or generic "SEGMENT 1/2/3",
  // and it printed fabricated "88% / 76% / 64%" percentages derived from a
  // layout constant — invented numbers presented as data, which violates
  // the repo's no-fabrication rule (CLAUDE.md). Absent real categories the
  // reveal is drawn as unlabeled magnitude strips (a qualitative "there is
  // more beneath the headline" gesture that asserts no specific figure).
  const realCategories = Array.isArray(beneathObj.categories) && beneathObj.categories.length
    ? beneathObj.categories.slice(0, 3)
    : null;
  const stripCount = realCategories ? realCategories.length : 3;

  const enterP = ease(clamp01(p / 0.22));
  // revealP: surface slides up, reality slides up from below
  const revealP = ease(clamp01((p - 0.30) / 0.38));

  // Official figure: large text, anchored to upper canvas
  const surfSz = fitFontSize(surfaceLabel, SAFE_W * 0.82, 120, 36);
  // Surface slides up as reality is revealed
  const surfSlideY = -revealP * SAFE_H * 0.18;

  // Reality items: full-width strips descending from midpoint
  const stripH = Math.min(90, (SAFE_H * 0.52) / Math.max(1, stripCount + 0.5));
  const stripGap = 14;
  const stripsTop = SAFE_H * 0.46;

  return (
    <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
      style={{ position: "absolute", left: S.left, top: S.top }}>

      {/* SURFACE: official figure as large raw text — no card */}
      <g transform={`translate(0, ${surfSlideY})`} opacity={enterP * (1 - revealP * 0.5)}>
        <text x={24} y={SAFE_H * 0.08}
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={12} fill={ed.subdued} letterSpacing={5}>
          {(scene.subject || "REPORTED FIGURE").toUpperCase()}
        </text>
        <text x={24} y={SAFE_H * 0.08 + surfSz * LH}
          fontFamily={`${font}, sans-serif`} fontWeight={900}
          fontSize={surfSz} fill={ed.text} fontVariantNumeric="tabular-nums">
          {surfaceLabel}
        </text>
      </g>

      {/* REVEAL SEAM: horizontal accent line that sweeps across */}
      {revealP > 0 && (
        <line
          x1={0} y1={SAFE_H * 0.44}
          x2={SAFE_W * revealP} y2={SAFE_H * 0.44}
          stroke={ed.accent} strokeWidth={3} opacity={revealP * 0.6} />
      )}

      {/* REALITY: descending full-width strips of decreasing length — a
          qualitative "layers beneath the surface" visual. Strip length
          encodes relative magnitude only; NO numeric percentage is drawn
          (that would be a fabricated statistic). A label is drawn only when
          the plan supplied a real one. */}
      {revealP > 0 && Array.from({ length: stripCount }).map((_, i) => {
        const cat = realCategories ? realCategories[i] : null;
        const catP = ease(clamp01((revealP - i * 0.14) / 0.4));
        const stripY = stripsTop + i * (stripH + stripGap);
        const fillRatio = 0.88 - i * 0.12;
        return (
          <g key={i} opacity={catP}>
            <rect x={0} y={stripY} width={SAFE_W * fillRatio * catP} height={stripH}
              fill={ed.accent} opacity={i === 0 ? 0.9 : 0.6 - i * 0.1} />
            {cat && (
              <text x={18} y={stripY + stripH * 0.62}
                fontFamily={`${font}, sans-serif`} fontWeight={700}
                fontSize={Math.min(22, stripH * 0.38)} fill={ed.bg} opacity={catP}>
                {cat}
              </text>
            )}
          </g>
        );
      })}

      {/* Label for what the strips reveal.
          The `|| "THE REAL PICTURE"` fallback is GONE: an invented headline
          standing in for missing plan content is fabricated on-screen text,
          and it is a section label besides. If the plan gave no label, the
          strips carry the beat unlabelled. Solid ed.quiet — the old
          constant 0.55 multiplier meant this never reached full opacity at
          any point in the beat. */}
      {revealP > 0.5 && beneathObj.label && (
        <text x={24} y={stripsTop + stripCount * (stripH + stripGap) + 36}
          fontFamily={`${font}, sans-serif`} fontWeight={600}
          fontSize={18} fill={ed.quiet}
          opacity={ease(clamp01((revealP - 0.5) / 0.3))}>
          {beneathObj.label}
        </text>
      )}
    </svg>
  );
}

/* ── PROPORTIONAL OBJECTS ────────────────────────────────────────────
   Two vertical columns growing from a shared baseline at the bottom.
   Heights are proportional to the actual values. The viewer sees the
   physical DIFFERENCE in scale, not a progress-bar approximation.
   ──────────────────────────────────────────────────────────────────── */

function ProportionalScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("PROPORTIONAL_OBJECTS", beat.emotional_weight);
  const objs = scene.objects || [];
  const a = objs[0] || {};
  const b = objs[1] || {};
  const headline = beat.text || "";
  const parts = headline.split(/\bvs\.?\b|\bVS\.?\b/i);
  const fallbackA = parts[0]?.trim() || "?";
  const fallbackB = parts[1]?.trim() || "?";

  const growP = ease(clamp01((p - 0.12) / 0.52));
  const diffP = ease(clamp01((p - 0.70) / 0.22));

  const labelA = (a.label && a.label !== "A") ? a.label : fallbackA;
  const labelB = (b.label && b.label !== "B") ? b.label : fallbackB;
  const rawNameA = a.context || a.role || "";
  const rawNameB = b.context || b.role || "";
  const nameA = (rawNameA && rawNameA !== labelA) ? rawNameA.toUpperCase().slice(0, 20) : "";
  const nameB = (rawNameB && rawNameB !== labelB) ? rawNameB.toUpperCase().slice(0, 20) : "";

  const parseNum = (label, ctx) => {
    const fromLabel = parseFloat(String(label).replace(/[^0-9.]/g, ""));
    if (!isNaN(fromLabel) && fromLabel > 0) return fromLabel;
    const fromCtx = parseFloat(String(ctx).replace(/[^0-9.]/g, ""));
    return (!isNaN(fromCtx) && fromCtx > 0) ? fromCtx : 1;
  };
  const numA = parseNum(labelA, rawNameA);
  const numB = parseNum(labelB, rawNameB);
  const maxVal = Math.max(numA, numB, 0.001);
  const ratioA = numA / maxVal;
  const ratioB = numB / maxVal;

  // Vertical columns layout
  const colW = SAFE_W * 0.32;
  const colGap = SAFE_W * 0.12;
  const colAX = SAFE_W * 0.08;
  const colBX = SAFE_W - SAFE_W * 0.08 - colW;
  const colMaxH = SAFE_H * 0.68;
  const baseline = SAFE_H * 0.86;

  const colAH = colMaxH * ratioA * growP;
  const colBH = colMaxH * ratioB * growP;

  // Value label sizes fitted to column width
  const szA = fitFontSize(labelA, colW * 1.1, 72, 22);
  const szB = fitFontSize(labelB, colW * 1.1, 72, 22);
  const nameSize = 13;

  const ratio = numA > 0 ? Math.max(numA, numB) / Math.min(numA, numB) : 1;
  const diffLabel = ratio >= 1.5 ? `${ratio.toFixed(1)}×` : numA !== numB ? `${Math.round(Math.abs(numA - numB))}` : "=";

  return (
    <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
      style={{ position: "absolute", left: S.left, top: S.top }}>

      {/* Column A (shorter/first value) */}
      {colAH > 0 && (
        <rect x={colAX} y={baseline - colAH} width={colW} height={colAH}
          fill={ed.subdued} opacity={0.75} />
      )}
      {/* Value label at top of column A */}
      {colAH > 40 && (
        <text x={colAX + colW / 2} y={baseline - colAH - 16}
          textAnchor="middle"
          fontFamily={`${font}, sans-serif`} fontWeight={900}
          fontSize={szA} fill={ed.text}
          fontVariantNumeric="tabular-nums" opacity={growP}>
          {labelA}
        </text>
      )}
      {/* Role label at base of column A */}
      <text x={colAX + colW / 2} y={baseline + 28}
        textAnchor="middle"
        fontFamily={`${font}, monospace`} fontWeight={600}
        fontSize={nameSize} fill={ed.subdued} letterSpacing={2}>
        {nameA || "A"}
      </text>

      {/* Column B (taller/second value) */}
      {colBH > 0 && (
        <rect x={colBX} y={baseline - colBH} width={colW} height={colBH}
          fill={ed.accent} opacity={0.9} />
      )}
      {/* Value label at top of column B */}
      {colBH > 40 && (
        <text x={colBX + colW / 2} y={baseline - colBH - 16}
          textAnchor="middle"
          fontFamily={`${font}, sans-serif`} fontWeight={900}
          fontSize={szB} fill={ed.accentText}
          fontVariantNumeric="tabular-nums" opacity={growP}>
          {labelB}
        </text>
      )}
      {/* Role label at base of column B */}
      <text x={colBX + colW / 2} y={baseline + 28}
        textAnchor="middle"
        fontFamily={`${font}, monospace`} fontWeight={600}
        fontSize={nameSize} fill={ed.subdued} letterSpacing={2}>
        {nameB || "B"}
      </text>

      {/* Shared baseline */}
      <line x1={colAX - 8} y1={baseline} x2={colBX + colW + 8} y2={baseline}
        stroke={ed.text} strokeWidth={2} opacity={0.2} />

      {/* Horizontal gap marker at top of shorter column */}
      {growP > 0.6 && ratioA !== ratioB && diffP > 0 && (() => {
        const shorterTop = baseline - Math.min(colAH, colBH);
        const tallerTop = baseline - Math.max(colAH, colBH);
        const gapCenterX = (colAX + colW + colBX) / 2;
        return (
          <g opacity={diffP}>
            {/* Vertical gap indicator lines */}
            <line x1={gapCenterX} y1={tallerTop} x2={gapCenterX} y2={shorterTop}
              stroke={ed.accent} strokeWidth={2} opacity={0.4} strokeDasharray="5 4" />
            {/* Difference value in the gap — no card container */}
            <text x={gapCenterX} y={(tallerTop + shorterTop) / 2 + 6}
              textAnchor="middle"
              fontFamily={`${font}, sans-serif`} fontWeight={900}
              fontSize={36} fill={ed.accentText}
              fontVariantNumeric="tabular-nums" opacity={diffP}>
              {diffLabel}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

/* ── PHYSICAL GROWTH ─────────────────────────────────────────────────
   A single vertical column rises from a baseline at the bottom.
   The column IS the growth — it physically occupies more vertical space
   as the value increases. The number appears at the column's top edge,
   attached to it, not floating above.

   Fuel: FuelGauge (good material object, keep)
   Food: ReceiptSheet (good material object, keep)
   Generic: vertical tower
   ──────────────────────────────────────────────────────────────────── */

function GrowthScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("PHYSICAL_GROWTH", beat.emotional_weight);
  const objs = scene.objects || [];
  const subject = findObj(objs, "growing", "subject", "thing");
  const magnitude = findObj(objs, "magnitude", "amount", "value");

  const growP = ease(clamp01((p - 0.06) / 0.56));
  const labelP = ease(clamp01((p - 0.50) / 0.32));

  const isFuel = scene.material === "fuel" || subject.appearance === "fuel_gauge";
  const isFood = scene.material === "food" || subject.appearance === "receipt";

  if (isFuel) {
    return (
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
        style={{ position: "absolute", left: S.left, top: S.top }}>
        <FuelGauge
          cx={SAFE_W / 2} cy={SAFE_H * 0.44} r={SAFE_W * 0.40}
          fill={growP * 0.90} label={subject.label || "GASOLINE"}
          reading={labelP > 0.2 ? (magnitude.label || "") : ""}
          readingOpacity={labelP}
          ed={ed} font={font} />
      </svg>
    );
  }

  if (isFood) {
    const items = [
      { name: "Bread", price: "$4.89" }, { name: "Milk", price: "$5.49" },
      { name: "Eggs (doz)", price: "$6.79" }, { name: "Chicken", price: "$9.99" },
      { name: "Produce", price: "$12.49" },
    ];
    return (
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
        style={{ position: "absolute", left: S.left, top: S.top }}>
        <g opacity={growP}>
          <ReceiptSheet x={SAFE_W * 0.10} y={SAFE_H * 0.04} w={SAFE_W * 0.80} h={SAFE_H * 0.76}
            items={items} total="$39.65" growth={labelP > 0.3 ? (magnitude.label || "32%") : null}
            growthP={growP} ed={ed} font={font} />
        </g>
      </svg>
    );
  }

  // GENERIC: vertical tower rising from baseline at the bottom.
  // The tower IS the growth. Its height encodes the value.
  const magText = magnitude.label || "";
  const subText = (subject.label || scene.subject || "").toUpperCase().slice(0, 24);

  const colW = SAFE_W * 0.44;
  const colX = (SAFE_W - colW) / 2;
  const colMaxH = SAFE_H * 0.72;
  const baseline = SAFE_H * 0.84;
  const fillH = colMaxH * growP;
  const colTop = baseline - fillH;

  // Number size fitted to column width, capped below the column height
  const magSz = fitFontSize(magText, colW * 0.88, Math.min(96, fillH * 0.55), 28);

  return (
    <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
      style={{ position: "absolute", left: S.left, top: S.top }}>

      {/* Eyebrow — what is growing */}
      {subText && (
        <text x={SAFE_W / 2} y={SAFE_H * 0.07} textAnchor="middle"
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={14} fill={ed.subdued} letterSpacing={4}>
          {subText}
        </text>
      )}

      {/* Tower — the dominant visual object */}
      {fillH > 0 && (
        <rect x={colX} y={colTop} width={colW} height={fillH}
          fill={ed.accent} opacity={0.92} />
      )}

      {/* Baseline */}
      <line x1={colX - 16} y1={baseline} x2={colX + colW + 16} y2={baseline}
        stroke={ed.text} strokeWidth={2} opacity={0.22} />

      {/* Scale ticks on left side of tower */}
      {[0.25, 0.5, 0.75, 1.0].map((t) => {
        const ty = baseline - colMaxH * t;
        return (
          <g key={t}>
            <line x1={colX - 20} y1={ty} x2={colX} y2={ty}
              stroke={ed.text} strokeWidth={1} opacity={0.2} />
            <text x={colX - 26} y={ty + 5} textAnchor="end"
              fontFamily={`${font}, monospace`} fontWeight={400}
              fontSize={12} fill={ed.subdued}>
              {`${Math.round(t * 100)}%`}
            </text>
          </g>
        );
      })}

      {/* Value label at top edge of tower — attached, not floating */}
      {magText && fillH > 24 && (
        <text x={colX + colW / 2} y={colTop - 14} textAnchor="middle"
          fontFamily={`${font}, sans-serif`} fontWeight={900}
          fontSize={magSz} fill={ed.accentText}
          fontVariantNumeric="tabular-nums" opacity={growP}>
          {magText}
        </text>
      )}

    </svg>
  );
}

/* ── STRUCTURAL BREAKDOWN ────────────────────────────────────────────
   A structured visual object fractures. For budget content the
   rule itself breaks apart. For document content the page tears.
   No outer card wrapper — the material object takes the full canvas.
   ──────────────────────────────────────────────────────────────────── */

function BreakdownScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("STRUCTURAL_BREAKDOWN", beat.emotional_weight);
  const breakP = ease(clamp01((p - 0.28) / 0.52));
  const isBudget = scene.material === "money" || /budget|fifty|thirty|twenty|50.30.20/i.test(beat.text);

  if (isBudget) {
    const segments = [
      { label: "NEEDS", pct: "50%", ratio: 0.5, color: ed.accent, fillOp: 0.35 },
      { label: "WANTS", pct: "30%", ratio: 0.3, color: ed.subdued, fillOp: 0.28 },
      { label: "SAVE", pct: "20%", ratio: 0.2, color: ed.text, fillOp: 0.18 },
    ];
    return (
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
        style={{ position: "absolute", left: S.left, top: S.top }}>
        <text x={24} y={SAFE_H * 0.09}
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={13} fill={ed.subdued} letterSpacing={5}>
          50 / 30 / 20 RULE
        </text>
        {/* Bar spans full safe width, tall enough to be the hero */}
        <BudgetBar x={0} y={SAFE_H * 0.16} w={SAFE_W} h={120}
          segments={segments} broken={breakP} ed={ed} font={font} />
        {breakP > 0.55 && (
          <g opacity={ease(clamp01((breakP - 0.55) / 0.3)) * 0.75}>
            <text x={SAFE_W / 2} y={SAFE_H * 0.52} textAnchor="middle"
              fontFamily={`${font}, sans-serif`} fontWeight={900}
              fontSize={80} fill={ed.accentText} letterSpacing={10}
              transform={`rotate(-6, ${SAFE_W / 2}, ${SAFE_H * 0.52})`}>
              BROKEN
            </text>
          </g>
        )}
      </svg>
    );
  }

  const subject = scene.subject || "CPI";
  return (
    <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
      style={{ position: "absolute", left: S.left, top: S.top }}>
      {/* DocumentPage takes nearly the full canvas height — it IS the visual */}
      <DocumentPage x={SAFE_W * 0.06} y={SAFE_H * 0.04} w={SAFE_W * 0.88} h={SAFE_H * 0.80}
        title={subject.toUpperCase()} lineCount={12} highlight={breakP < 0.35}
        torn={breakP} ed={ed} font={font} />
    </svg>
  );
}

/* ── EVIDENCE FIGURE ─────────────────────────────────────────────────
   The number IS the visual. It takes the dominant vertical space.
   A minimal grounding bar below shows its scale in context.
   No card container. The figure floats in the composition.
   ──────────────────────────────────────────────────────────────────── */

function EvidenceFigureScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("EVIDENCE_FIGURE", beat.emotional_weight);
  const figure = findObj(scene.objects || [], "evidence", "evidential", "figure") || {};
  const label = figure.label || scene.subject || "";
  const ctx = figure.context || scene.subject || "";
  const isFood = scene.material === "food";

  const enterP = ease(clamp01(p / 0.28));
  const groundP = ease(clamp01((p - 0.35) / 0.30));

  if (isFood) {
    const items = [
      { name: "Groceries 2020", price: "$152" },
      { name: "Groceries 2026", price: "$201" },
    ];
    return (
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
        style={{ position: "absolute", left: S.left, top: S.top }}>
        <g opacity={enterP}>
          <ReceiptSheet x={SAFE_W * 0.08} y={SAFE_H * 0.04} w={SAFE_W * 0.84} h={SAFE_H * 0.76}
            items={items} total={label || "32%"} growth={label}
            growthP={enterP} ed={ed} font={font} />
        </g>
      </svg>
    );
  }

  // The figure takes ~55% of the canvas height as raw text — it IS the visual
  const heroSz = fitFontSize(label, SAFE_W * 0.86, Math.min(180, SAFE_H * 0.44), 40);
  const ctxLabel = ctx !== label ? ctx : "";
  const ctxSz = ctxLabel ? Math.min(22, heroSz * 0.22) : 0;

  // Figure anchored to upper-center
  const figureTopY = SAFE_H * 0.14;
  const figureBaseY = figureTopY + heroSz * LH;

  // Grounding bar: thin, below the number, shows its scale
  const isPct = /%/.test(label);
  const numVal = parseFloat(String(label).replace(/[^0-9.]/g, "")) || 0;
  const fillRatio = isPct ? clamp01(numVal / 100) : 0.68;

  const barX = 24;
  const barW = SAFE_W - 48;
  const barY = figureBaseY + (ctxLabel ? ctxSz + 24 : 16);
  const barH = 28;
  const markX = barX + barW * fillRatio * groundP;

  return (
    <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
      style={{ position: "absolute", left: S.left, top: S.top }}>
      {/* Source eyebrow */}
      <text x={24} y={figureTopY - 16}
        fontFamily={`${font}, monospace`} fontWeight={500}
        fontSize={12} fill={ed.subdued} letterSpacing={5}>
        {(scene.subject || "").toUpperCase() || "DATA"}
      </text>

      {/* THE FIGURE — the dominant visual */}
      <text x={24} y={figureBaseY}
        fontFamily={`${font}, sans-serif`} fontWeight={900}
        fontSize={heroSz} fill={ed.accentText}
        fontVariantNumeric="tabular-nums"
        opacity={enterP}>
        {label}
      </text>

      {/* Context label immediately below the figure */}
      {ctxLabel && (
        <text x={24} y={figureBaseY + ctxSz + 4}
          fontFamily={`${font}, sans-serif`} fontWeight={500}
          fontSize={ctxSz} fill={ed.quiet} opacity={enterP}>
          {ctxLabel}
        </text>
      )}

      {/* Grounding scale bar — thin, attached to figure, not a container */}
      {groundP > 0 && (
        <>
          <rect x={barX} y={barY} width={barW} height={barH}
            fill={ed.surface} opacity={0.1} />
          <rect x={barX} y={barY} width={barW * fillRatio * groundP} height={barH}
            fill={ed.accent} opacity={0.85} />
          {/* Marker at the value position */}
          <line x1={markX} y1={barY - 12} x2={markX} y2={barY + barH + 12}
            stroke={ed.accent} strokeWidth={2.5} opacity={groundP * 0.7} />
          {isPct && (
            <>
              <text x={barX} y={barY + barH + 22}
                fontFamily={`${font}, monospace`} fontWeight={400}
                fontSize={12} fill={ed.subdued}>0</text>
              <text x={barX + barW} y={barY + barH + 22} textAnchor="end"
                fontFamily={`${font}, monospace`} fontWeight={400}
                fontSize={12} fill={ed.subdued}>100%</text>
            </>
          )}
        </>
      )}

    </svg>
  );
}

/* ── ACTION → CONSEQUENCE ────────────────────────────────────────────
   Cause text occupies upper canvas. A vertical connector draws itself
   downward. Effect text rises from lower canvas. No panels, no fills.
   The two text blocks ARE the visual — spatial separation + connector
   communicates the causal relationship.
   ──────────────────────────────────────────────────────────────────── */

function ActionConsequenceScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("ACTION_CONSEQUENCE", beat.emotional_weight);
  const objs = scene.objects || [];
  const cause = findObj(objs, "cause", "force", "action");
  const effect = cause === findObj(objs, "consequence", "effect", "result")
    ? (objs[1] || {}) : findObj(objs, "consequence", "effect", "result");

  const causeP = ease(clamp01(p / 0.28));
  const connectP = ease(clamp01((p - 0.18) / 0.28));
  const effectP = ease(clamp01((p - 0.42) / 0.32));

  const causeLabel = cause.label || beat.original_text || "";
  const effectLabel = effect.label || "";
  const causeSz = fitFontSize(causeLabel, SAFE_W - 48, Math.min(68, SAFE_H * 0.2), 24);
  const effectSz = fitFontSize(effectLabel, SAFE_W - 48, Math.min(84, SAFE_H * 0.22), 26);

  // Cause: anchored in upper third
  const causeLineCount = Math.ceil(causeLabel.length / 20);
  const causeBlockH = causeSz * LH * causeLineCount;
  const causeBaseY = SAFE_H * 0.08 + causeBlockH;

  // Connector: vertical line from below cause to above effect
  const connStartY = SAFE_H * 0.08 + causeBlockH + 24;
  const connEndY = SAFE_H * 0.52;
  const connCurrentY = connStartY + (connEndY - connStartY) * connectP;

  // Arrow at end of connector
  const arrowSize = 12;

  // Effect: occupies lower canvas — larger text, accent color
  const effectTopY = SAFE_H * 0.55;

  return (
    <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
      style={{ position: "absolute", left: S.left, top: S.top }}>

      {/* CAUSE: raw text in upper canvas, no container */}
      <text x={24} y={SAFE_H * 0.08}
        fontFamily={`${font}, sans-serif`} fontWeight={700}
        fontSize={causeSz} fill={ed.quiet} opacity={causeP}>
        {causeLabel.length > 28 ? causeLabel.slice(0, 28) + "…" : causeLabel}
      </text>

      {/* No "CAUSE" eyebrow. The arrow connector below already states the
          causal relation visually; the word only named the mechanism for
          the viewer (see scene-text.js ENGINE_VOCABULARY). */}

      {/* CONNECTOR: vertical line drawing itself downward */}
      {connectP > 0 && (
        <>
          <line
            x1={24 + causeSz * 0.5} y1={connStartY}
            x2={24 + causeSz * 0.5} y2={connCurrentY}
            stroke={ed.accent} strokeWidth={2.5}
            strokeDasharray="8 5"
            opacity={connectP * 0.7}
          />
          {/* Arrow tip appears when line fully drawn */}
          {connectP > 0.85 && (
            <polygon
              points={`${24 + causeSz * 0.5},${connEndY + arrowSize} ${24 + causeSz * 0.5 - arrowSize * 0.6},${connEndY - 2} ${24 + causeSz * 0.5 + arrowSize * 0.6},${connEndY - 2}`}
              fill={ed.accent}
              opacity={ease(clamp01((connectP - 0.85) / 0.15)) * 0.85}
            />
          )}
        </>
      )}

      {/* EFFECT: large, accent colored, rises from lower canvas */}
      <g opacity={effectP} transform={`translate(0, ${(1 - effectP) * 28})`}>
        {/* No "RESULT" eyebrow — same reason as the removed "CAUSE". */}
        <text x={24} y={effectTopY}
          fontFamily={`${font}, sans-serif`} fontWeight={900}
          fontSize={effectSz} fill={ed.accentText}>
          {effectLabel.length > 32 ? effectLabel.slice(0, 32) + "…" : effectLabel}
        </text>
        {/* Accent rule below effect text — grounds it */}
        <rect x={24} y={effectTopY + effectSz * 0.2}
          width={48 * effectP} height={3}
          fill={ed.accent} opacity={0.6} />
      </g>
    </svg>
  );
}

/* ── VISIBLE CONSUMPTION ─────────────────────────────────────────────
   A tall vessel occupying most of the canvas height drains from full
   to (1 - fillRatio) remaining. The consumed amount IS the label.
   Speed of drain communicates urgency. No BudgetBar pattern.
   No rounded corners on anything that functions as a container.
   ──────────────────────────────────────────────────────────────────── */

function ConsumptionScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("VISIBLE_CONSUMPTION", beat.emotional_weight);
  const objs = scene.objects || [];
  const consumed = findObj(objs, "consumed", "portion", "swallow");
  const fillRatio = consumed.final_state?.fill || 0.62;
  const consumedLabel = consumed.label || `${Math.round(fillRatio * 100)}%`;

  const drainP = ease(clamp01((p - 0.12) / 0.48));
  const labelP = ease(clamp01((p - 0.55) / 0.28));

  // Vessel: tall rectangle, left-anchored, 80% of canvas height
  const vesselX = 24;
  const vesselW = SAFE_W * 0.18;   // narrow column for substance
  const vesselH = SAFE_H * 0.78;
  const vesselY = SAFE_H * 0.10;

  // Drain: from full at top, draining to (1 - fillRatio) * vesselH remaining
  const drained = fillRatio;          // what's consumed
  // Fill starts at full, drains: currentFill = 1 - drainP * drained (shrinks top-down)
  const currentFillRatio = 1 - drainP * drained;
  const currentFillH = vesselH * currentFillRatio;
  const currentFillY = vesselY + (vesselH - currentFillH);

  // Consumed amount label: large text to the right of the vessel
  const labelSz = fitFontSize(consumedLabel, SAFE_W - vesselX - vesselW - 56, Math.min(160, SAFE_H * 0.45), 32);
  const labelX = vesselX + vesselW + 40;
  const labelY = SAFE_H * 0.42;

  // Unlabelled scale marks at quarters of the vessel. No `pct` field any
  // more — nothing prints a numeral (see the tick block below).
  const ticks = [0, 0.25, 0.5, 0.75, 1.0].map((t) => ({
    y: vesselY + vesselH * (1 - t),
  }));

  return (
    <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
      style={{ position: "absolute", left: S.left, top: S.top }}>

      {/* Vessel outline — no fill, just border */}
      <rect x={vesselX} y={vesselY} width={vesselW} height={vesselH}
        fill="none" stroke={ed.text} strokeWidth={2} opacity={0.2} />

      {/* Fluid fill — drains from top */}
      <rect x={vesselX + 2} y={currentFillY} width={vesselW - 4} height={currentFillH}
        fill={ed.accent} opacity={0.82} />

      {/* Unlabelled scale marks.
          The numerals are GONE, for two independent reasons.
          (1) GROUNDING: they were `Math.round(t * 100)%` against a
              `consumed.final_state.fill` that comes from the visual plan,
              not from research. Printing 0/25/50/75/100% axis labels and a
              "% LEFT" readout presents a model-chosen proportion as a
              measured statistic — the same fabricated-figure violation
              already removed from SurfaceBeneathScene.
          (2) GEOMETRY: anchored "end" at x=vesselX-18=6, "100%" extended
              to roughly x=-24 — off the safe rect and off the frame, which
              is the edgeBleed row the slop-check flagged. Run 35261545735
              frame-02 shows the digits clipped, leaving bare "%" marks.
          The drain still communicates proportion visually, which is this
          mechanism's actual job; it just no longer asserts a number. */}
      {ticks.map((t, i) => (
        <line key={i} x1={vesselX - 14} y1={t.y} x2={vesselX - 2} y2={t.y}
          stroke={ed.quiet} strokeWidth={1.5} />
      ))}

      {/* Drain level line: horizontal marker showing current fill */}
      {drainP > 0 && (
        <line x1={vesselX - 8} y1={currentFillY} x2={vesselX + vesselW + 8} y2={currentFillY}
          stroke={ed.accent} strokeWidth={2} opacity={0.6} />
      )}

      {/* Consumed amount, right of the vessel.
          The "CONSUMED" eyebrow is GONE: it was a hardcoded engine-
          vocabulary section label (see scene-text.js ENGINE_VOCABULARY),
          and the draining vessel beside it already says "consumed".
          The sub-line is GONE too: it was `consumed.context ||
          scene.subject`, and scene.subject is a raw topic fragment, which
          in run 35261545735 printed the meaningless "officers two" under
          the figure in translucent ed.text. A label that can render a
          sentence fragment is not a label. */}
      <g opacity={labelP} transform={`translate(0, ${(1 - labelP) * 24})`}>
        <text x={labelX} y={SAFE_H * 0.20 + labelSz * LH}
          fontFamily={`${font}, sans-serif`} fontWeight={900}
          fontSize={labelSz} fill={ed.accentText}
          fontVariantNumeric="tabular-nums">
          {consumedLabel}
        </text>
      </g>

      {/* The "N% LEFT" readout is deliberately absent — same grounding
          reason as the scale numerals above. `fillRatio` still drives the
          drain geometry, which shows the proportion without claiming it
          was measured. */}
    </svg>
  );
}

/* ── STATE CHANGE ────────────────────────────────────────────────────
   Before state occupies upper canvas: large text, muted.
   A strike-through line sweeps across it left to right.
   After state rises from lower canvas: large text, accent colored.
   No div panels, no background fills. The contrast between muted
   before and vivid after IS the state change.
   ──────────────────────────────────────────────────────────────────── */

function StateChangeScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("STATE_CHANGE", beat.emotional_weight);
  const objs = scene.objects || [];
  const expected = findObj(objs, "expected", "before", "old");
  const actual = expected === findObj(objs, "actual", "after", "new", "true")
    ? (objs[1] || {}) : findObj(objs, "actual", "after", "new", "true");

  const showExpected = ease(clamp01(p / 0.22));
  const strikeP = ease(clamp01((p - 0.26) / 0.22));
  const divideP = ease(clamp01((p - 0.36) / 0.14));
  const showActual = ease(clamp01((p - 0.44) / 0.32));

  const expLabel = expected.label || "";
  const actLabel = actual.label || "";
  // LABELS, NOT HEADLINES.
  //
  // These were 72px/900-weight and 96px/900-weight, which made this
  // mechanism a two-headline text slide: run 35261545735 frame-01 rendered
  // "The Full Encounter" over "Final Two Seconds" with three section
  // labels and NO object at all — typography standing in for a visual,
  // which is the one thing narrative typography must never do. The
  // displacement below is now carried by the two state BARS; the strings
  // label them at a size that reads as annotation, not as the beat.
  const expSz = fitFontSize(expLabel, SAFE_W - 48, Math.min(40, SAFE_H * 0.085), 22);
  const actSz = fitFontSize(actLabel, SAFE_W - 48, Math.min(48, SAFE_H * 0.10), 24);

  // Before text: upper canvas
  const beforeY = SAFE_H * 0.10;
  const beforeBaseY = beforeY + expSz * LH;

  // Strike-through: sweeps across the expected BAR at its mid-height
  const strikeY = beforeY + expSz * 1.6 * 0.5;

  // Divide line: at mid-canvas
  const divideY = SAFE_H * 0.50;

  // After text: lower canvas
  const afterY = SAFE_H * 0.56;

  return (
    <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
      style={{ position: "absolute", left: S.left, top: S.top }}>

      {/* EXPECTED STATE: a full-width bar — the thing being displaced.
          Its label is drawn in ed.quiet at FULL opacity. The old version
          used ed.text at 0.7 inside a 0.65 group = 0.455 effective, which
          composited to rgb(77,77,87) = 2.30:1 and failed the gate. Alpha
          here animates the ENTRANCE only and settles at 1. */}
      <g opacity={showExpected}>
        <rect x={24} y={beforeY} width={(SAFE_W - 48) * showExpected} height={expSz * 1.6}
          fill="none" stroke={ed.quiet} strokeWidth={2} />
        <text x={38} y={beforeY + expSz * 1.6 * 0.5 + expSz * 0.34}
          fontFamily={`${font}, sans-serif`} fontWeight={600}
          fontSize={expSz} fill={ed.quiet}>
          {expLabel}
        </text>
      </g>

      {/* STRIKE-THROUGH: sweeps left to right across before text */}
      {strikeP > 0 && (
        <line x1={24} y1={strikeY} x2={24 + (SAFE_W - 48) * strikeP} y2={strikeY}
          stroke={ed.accent} strokeWidth={4} opacity={strikeP * 0.9} />
      )}

      {/* DIVIDE LINE: accent bar at mid-canvas, sweeps right */}
      {divideP > 0 && (
        <rect x={0} y={divideY} width={SAFE_W * divideP} height={3}
          fill={ed.accent} opacity={divideP * 0.75} />
      )}

      {/* ACTUAL STATE: a solid accent bar rising from below — this is the
          displacement made visible, and it is what carries the beat. The
          label rides on it in accent-validated text. */}
      {/* Text stays on the PAGE ground, never knocked out of the bar:
          frame-audit models glyph contrast against the frame's dominant
          background, so dark knockout text on a bright bar measures as a
          near-black glyph on a near-black ground and fails a gate it
          should pass. The bar is a visual element beside the label. */}
      <g opacity={showActual} transform={`translate(0, ${(1 - showActual) * 32})`}>
        <rect x={24} y={afterY} width={(SAFE_W - 48) * showActual} height={10}
          fill={ed.accent} />
        <text x={24} y={afterY + 10 + actSz * 1.25}
          fontFamily={`${font}, sans-serif`} fontWeight={800}
          fontSize={actSz} fill={ed.accentText}>
          {actLabel}
        </text>
      </g>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CAMERA WRAPPER
   ══════════════════════════════════════════════════════════════════════ */

function cameraTransform(camera, progress) {
  switch (camera) {
    case "push_in": return `scale(${1 + progress * 0.08})`;
    case "pull_back": return `scale(${1 - progress * 0.06})`;
    case "push_past": return `translateY(${-progress * 40}px)`;
    case "tilt_down": return `translateY(${progress * 35}px)`;
    case "widen": return `scale(${1 - progress * 0.05})`;
    case "slow_drift": return `translate(${progress * 8}px, ${progress * 4}px)`;
    case "micro_pull": return `scale(${1 + progress * 0.03})`;
    default: return "none";
  }
}

function shotPhase(shots, p) {
  for (let i = shots.length - 1; i >= 0; i--) {
    if (p >= shots[i].phase) {
      const s = shots[i];
      const within = (p - s.phase) / Math.max(0.01, s.phaseDuration);
      return { shot: s, shotIndex: i, shotProgress: Math.min(1, within) };
    }
  }
  return { shot: shots[0], shotIndex: 0, shotProgress: 0 };
}

/* ══════════════════════════════════════════════════════════════════════
   MECHANISM DISPATCHER
   ══════════════════════════════════════════════════════════════════════ */

function MechanismScene({ beat, p, local, ed, font, scene }) {
  const shots = scene.shots || [{ phase: 0, phaseDuration: 1, camera: "hold" }];
  const { shot, shotProgress } = shotPhase(shots, p);
  const cam = cameraTransform(shot.camera, easeIO(shotProgress));

  const props = { beat, p, local, ed, font, scene };
  let content;

  switch (scene.mechanism) {
    case "SURFACE_AND_BENEATH":
      content = <SurfaceBeneathScene {...props} />;
      break;
    case "PROPORTIONAL_OBJECTS":
      content = <ProportionalScene {...props} />;
      break;
    case "PHYSICAL_GROWTH":
      content = <GrowthScene {...props} />;
      break;
    case "STRUCTURAL_BREAKDOWN":
      content = <BreakdownScene {...props} />;
      break;
    case "EVIDENCE_FIGURE":
      content = <EvidenceFigureScene {...props} />;
      break;
    case "ACTION_CONSEQUENCE":
      content = <ActionConsequenceScene {...props} />;
      break;
    case "VISIBLE_CONSUMPTION":
      content = <ConsumptionScene {...props} />;
      break;
    case "STATE_CHANGE":
      content = <StateChangeScene {...props} />;
      break;
    default:
      content = <TypographyScene {...props} />;
  }

  return (
    <div style={{
      position: "absolute", left: 0, top: 0,
      width: CANVAS_W, height: CANVAS_H,
      transform: cam, transformOrigin: "center center",
    }}>
      {content}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPOSITION

   Bible changes applied:
   - NO caption track (rule 2: zero word-for-word captions)
   - NO decorative grid (rule 17: no random decoration)
   - Crossfade transitions between beats (rule 13: transformations > cuts)
   - Motion weight varies by mechanism (rule 16)
   - Camera motion reduced to intentional levels (rule 15)
   ══════════════════════════════════════════════════════════════════════ */

export function DirectedScene({ plan }) {
  const frame = useCurrentFrame();
  const colors = paletteRoles(plan.palette);
  const ed = editorialColors(colors, plan.palette);
  const { beat, p, local, prev, beatIndex } = beatAt(plan, frame);
  const scene = beat.scene || {};
  const isTypographyOnly = scene.mechanism === "TYPOGRAPHY";
  const tOpacity = transitionOpacity(beat, local, beatIndex);

  const prevScene = prev?.scene || {};
  // Brief crossfade echo only: the outgoing beat lingers for the ~12-frame
  // transition and is gone once the incoming beat settles. This is the
  // ONLY cross-beat layer. A previous version also re-rendered the whole
  // prior scene at 0.22 opacity for the ENTIRE duration of any beat with
  // carries_forward set — two full compositions (both headlines included)
  // stacked for seconds at a time. Real QA frames showed the result as
  // muddy double-exposed text (e.g. a prior beat's headline printed across
  // the current beat's chart), which both hurt legibility and inflated the
  // whole-video reviewer's "headline monoculture" reading. carries_forward
  // is honored through the crossfade continuity, not a persistent overlay.
  const showPrevEcho = prev && local < TRANSITION_FRAMES && beatIndex > 0;
  const prevEchoOpacity = showPrevEcho ? clamp01(1 - local / TRANSITION_FRAMES) * 0.4 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: ed.bg }}>
      {/* Previous beat echo — fading out during the transition only */}
      {showPrevEcho && (
        <div style={{ position: "absolute", left: 0, top: 0, width: CANVAS_W, height: CANVAS_H, opacity: prevEchoOpacity }}>
          {prevScene.mechanism === "TYPOGRAPHY" ? (
            <TypographyScene beat={prev} p={1} local={prev.duration_frames}
              ed={ed} font={plan.fonts.primary} scene={prevScene} />
          ) : (
            <MechanismScene beat={prev} p={1} local={prev.duration_frames}
              ed={ed} font={plan.fonts.primary} scene={prevScene} />
          )}
        </div>
      )}

      {/* Current beat */}
      <div style={{ position: "absolute", left: 0, top: 0, width: CANVAS_W, height: CANVAS_H, opacity: tOpacity }}>
        {isTypographyOnly ? (
          <TypographyScene beat={beat} p={p} local={local}
            ed={ed} font={plan.fonts.primary} scene={scene} />
        ) : (
          <MechanismScene beat={beat} p={p} local={local}
            ed={ed} font={plan.fonts.primary} scene={scene} />
        )}
      </div>
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "DirectedShorts",
    component: DirectedScene,
    durationInFrames: 300,
    fps: 30,
    width: CANVAS_W,
    height: CANVAS_H,
    defaultProps: {
      plan: {
        beats: [{
          beat_id: "d0", start_frame: 0, duration_frames: 300, text: "",
          treatment: "TYPOGRAPHY", reason: "", visual_goal: "",
          typography_role: "primary", transition_in: "CUT",
          scene: { mechanism: "TYPOGRAPHY", narrative_role: "statement", subject: "", material: "abstract", objects: [], shots: [{ phase: 0, phaseDuration: 1, camera: "hold" }], typography: { role: "primary", style: "kinetic", emphasis_words: [] } },
          words: [],
        }],
        palette: { primary: ["#0F172A", "#1E293B", "#22C55E", "#FAFAFA"], secondary: ["#16A34A", "#94A3B8", "#F8FAFC"] },
        fonts: { primary: "Inter", secondary: "JetBrains Mono" },
      },
    },
  },
];
