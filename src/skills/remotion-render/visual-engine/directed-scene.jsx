import React from "react";
import { AbsoluteFill, useCurrentFrame, Easing } from "remotion";
import { paletteRoles } from "../visual/palette-roles.js";
import { SAFE_SHORTS } from "../layout/slots.js";

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
  const contrastRatio = (a, b) => {
    const la = lum(a) + 0.05, lb = lum(b) + 0.05;
    return la > lb ? la / lb : lb / la;
  };
  const all = [...rawPalette.primary, ...rawPalette.secondary];
  const sorted = [...all].sort((a, b) => lum(a) - lum(b));
  const bgColor = sorted[0];
  const subdued = all.find((c) => {
    return contrastRatio(c, bgColor) >= 4.5 && lum(c) < 0.7 && c !== colors.accent;
  }) || sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.6))];
  const safeSubdued = contrastRatio(subdued, bgColor) >= 4.5
    ? subdued : (all.find((c) => contrastRatio(c, bgColor) >= 4.5) || sorted[sorted.length - 1]);
  return {
    bg: bgColor,
    depth: sorted[1] || sorted[0],
    surface: sorted[sorted.length - 1],
    text: sorted[sorted.length - 1],
    textDark: sorted[0],
    accent: colors.accent,
    subdued: safeSubdued,
  };
}

/* ── Text layout ────────────────────────────────────────────────────── */

const LH = 1.18;
const MAX_SZ = 140;
const MIN_SZ = 28;
const WIDE = new Set("MWQ@%".split(""));
const NARROW = new Set("IJ1.,';:!|-".split(""));
const emW = (s) => [...String(s)].reduce((w, c) => w + (WIDE.has(c) ? 0.88 : NARROW.has(c) ? 0.3 : 0.62), 0);

function layoutWords(words, maxW, maxH) {
  const ems = words.map((w) => emW(w) + 0.28);
  const totalEm = ems.reduce((a, b) => a + b, 0);
  const singleSz = Math.min(MAX_SZ, maxW / totalEm, maxH / LH);
  if (singleSz >= MIN_SZ) return { rows: [words], size: Math.max(MIN_SZ, singleSz) };
  const mid = Math.ceil(words.length / 2);
  const row1 = words.slice(0, mid);
  const row2 = words.slice(mid);
  const em1 = row1.reduce((s, w) => s + emW(w) + 0.28, 0);
  const em2 = row2.reduce((s, w) => s + emW(w) + 0.28, 0);
  const widestEm = Math.max(em1, em2);
  const sz2 = Math.min(MAX_SZ, maxW / widestEm, maxH / (LH * 2));
  return { rows: [row1, row2], size: Math.max(MIN_SZ, sz2) };
}

function fitFontSize(text, maxW, maxSz, minSz) {
  const em = emW(text);
  return Math.max(minSz || MIN_SZ, Math.min(maxSz || MAX_SZ, maxW / Math.max(0.5, em)));
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
          fontSize={Math.min(72, r * 0.38)} fill={ed.accent}
          fontVariantNumeric="tabular-nums" opacity={readingOpacity ?? 1}>{reading}</text>
      )}
      {label && (
        <text x={cx} y={cy + r * 0.65} textAnchor="middle"
          fontFamily={`${font}, sans-serif`} fontWeight={600}
          fontSize={22} fill={ed.text} opacity={0.5}
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
          fontSize={13} fill={ed.text} opacity={0.5} letterSpacing={3}>{source}</text>
      )}
      <text x={x + 18} y={valueY}
        fontFamily={`${font}, sans-serif`} fontWeight={900}
        fontSize={sz} fill={highlighted ? ed.accent : ed.text}
        fontVariantNumeric="tabular-nums">{value}</text>
      {label && (
        <text x={x + 18} y={labelY}
          fontFamily={`${font}, sans-serif`} fontWeight={500}
          fontSize={20} fill={ed.text} opacity={0.55}>{label}</text>
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
  const headline = beat.text || "";
  if (!headline) return null;

  const allWords = headline.split(/\s+/);
  const { rows, size } = layoutWords(allWords, SAFE_W * 0.9, SAFE_H * 0.48);
  const emphSet = new Set((scene.typography?.emphasis_words || []).map((w) => w.toLowerCase()));
  const isQuestion = scene.typography?.style === "question";
  const isImperative = scene.typography?.style === "imperative";

  const enterP = ease(clamp01(local / 14));
  const fadeOut = clamp01((p - 0.92) / 0.08);
  const holdP = clamp01((local - 14) / 20);

  // Anchor to top-third: gives the vertical canvas room to breathe below
  const anchorY = S.top + SAFE_H * 0.22;

  return (
    <div style={{
      position: "absolute", left: S.left, width: SAFE_W,
      top: anchorY,
      opacity: enterP * (1 - fadeOut),
      transform: `translateY(${(1 - enterP) * size * 0.35}px)`,
    }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{
          whiteSpace: "nowrap", overflow: "visible",
          fontFamily: `${font}, sans-serif`,
          fontWeight: isImperative ? 900 : 800,
          fontSize: size, lineHeight: LH,
          letterSpacing: -size * 0.022,
          fontStyle: isQuestion ? "italic" : "normal",
        }}>
          {row.map((word, wi) => {
            const isEmph = emphSet.has(word.toLowerCase().replace(/[^a-z0-9]/g, ""));
            const emphScale = isEmph && holdP > 0 ? 1 + holdP * 0.04 : 1;
            return (
              <span key={wi} style={{
                display: "inline-block", marginRight: size * 0.22,
                color: isEmph ? ed.accent : ed.text,
                transform: `scale(${emphScale})`,
                transformOrigin: "bottom left",
              }}>{word}</span>
            );
          })}
        </div>
      ))}
      {/* Accent rule below text — grounds it without boxing it */}
      {holdP > 0.3 && (
        <div style={{
          marginTop: size * 0.4,
          width: `${holdP * 48}px`, height: 3,
          background: ed.accent, opacity: 0.7,
        }} />
      )}
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
  const matCats = {
    money: ["HOUSING COSTS", "FOOD & ESSENTIALS", "TRANSPORT"],
    fuel:  ["GASOLINE", "ENERGY BILLS", "TRANSPORT"],
    food:  ["GROCERIES", "DINING", "PRODUCE"],
    housing: ["RENT", "UTILITIES", "INSURANCE"],
  };
  const categories = beneathObj.categories || matCats[scene.material] || ["SEGMENT 1", "SEGMENT 2", "SEGMENT 3"];

  const enterP = ease(clamp01(p / 0.22));
  // revealP: surface slides up, reality slides up from below
  const revealP = ease(clamp01((p - 0.30) / 0.38));
  const fadeOut = clamp01((p - 0.92) / 0.08);

  // Official figure: large text, anchored to upper canvas
  const surfSz = fitFontSize(surfaceLabel, SAFE_W * 0.82, 120, 36);
  // Surface slides up as reality is revealed
  const surfSlideY = -revealP * SAFE_H * 0.18;

  // Reality items: full-width strips descending from midpoint
  const stripH = Math.min(90, (SAFE_H * 0.52) / Math.max(1, categories.length + 0.5));
  const stripGap = 14;
  const stripsTop = SAFE_H * 0.46;

  return (
    <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
      style={{ position: "absolute", left: S.left, top: S.top, opacity: 1 - fadeOut }}>

      {/* SURFACE: official figure as large raw text — no card */}
      <g transform={`translate(0, ${surfSlideY})`} opacity={enterP * (1 - revealP * 0.5)}>
        <text x={24} y={SAFE_H * 0.08}
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={12} fill={ed.text} opacity={0.45} letterSpacing={5}>
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

      {/* REALITY: full-width strips — no rounded corners, just raw shapes */}
      {revealP > 0 && categories.map((cat, i) => {
        const catP = ease(clamp01((revealP - i * 0.14) / 0.4));
        const stripY = stripsTop + i * (stripH + stripGap);
        // Vary the fill width per category to show relative magnitude
        const fillRatio = 0.88 - i * 0.12;
        return (
          <g key={i} opacity={catP}>
            {/* Strip background: full-width, raw rectangle */}
            <rect x={0} y={stripY} width={SAFE_W * fillRatio * catP} height={stripH}
              fill={ed.accent} opacity={i === 0 ? 0.9 : 0.6 - i * 0.1} />
            {/* Label integrated into strip */}
            <text x={18} y={stripY + stripH * 0.62}
              fontFamily={`${font}, sans-serif`} fontWeight={700}
              fontSize={Math.min(22, stripH * 0.38)} fill={ed.bg} opacity={catP}>
              {cat}
            </text>
            {/* Percentage at right edge */}
            <text x={SAFE_W * fillRatio * catP - 16} y={stripY + stripH * 0.62}
              textAnchor="end"
              fontFamily={`${font}, monospace`} fontWeight={800}
              fontSize={Math.min(18, stripH * 0.32)} fill={ed.bg} opacity={catP * 0.9}>
              {`${Math.round((fillRatio) * 100)}%`}
            </text>
          </g>
        );
      })}

      {/* REALITY label — below the strips */}
      {revealP > 0.5 && (
        <text x={24} y={stripsTop + categories.length * (stripH + stripGap) + 36}
          fontFamily={`${font}, sans-serif`} fontWeight={600}
          fontSize={18} fill={ed.text}
          opacity={ease(clamp01((revealP - 0.5) / 0.3)) * 0.55}>
          {beneathObj.label || "THE REAL PICTURE"}
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

  const enterP = ease(clamp01(p / 0.18));
  const growP = ease(clamp01((p - 0.12) / 0.52));
  const diffP = ease(clamp01((p - 0.70) / 0.22));
  const fadeOut = clamp01((p - 0.92) / 0.08);

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
      style={{ position: "absolute", left: S.left, top: S.top, opacity: (1 - fadeOut) * enterP }}>

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
        fontSize={nameSize} fill={ed.text} opacity={0.5} letterSpacing={2}>
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
          fontSize={szB} fill={ed.accent}
          fontVariantNumeric="tabular-nums" opacity={growP}>
          {labelB}
        </text>
      )}
      {/* Role label at base of column B */}
      <text x={colBX + colW / 2} y={baseline + 28}
        textAnchor="middle"
        fontFamily={`${font}, monospace`} fontWeight={600}
        fontSize={nameSize} fill={ed.text} opacity={0.5} letterSpacing={2}>
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
              fontSize={36} fill={ed.accent}
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
  const fadeOut = clamp01((p - 0.92) / 0.08);

  const isFuel = scene.material === "fuel" || subject.appearance === "fuel_gauge";
  const isFood = scene.material === "food" || subject.appearance === "receipt";

  if (isFuel) {
    return (
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
        style={{ position: "absolute", left: S.left, top: S.top, opacity: 1 - fadeOut }}>
        <FuelGauge
          cx={SAFE_W / 2} cy={SAFE_H * 0.44} r={SAFE_W * 0.40}
          fill={growP * 0.90} label={subject.label || "GASOLINE"}
          reading={labelP > 0.2 ? (magnitude.label || "") : ""}
          readingOpacity={labelP}
          ed={ed} font={font} />
        {labelP > 0.5 && (
          <text x={SAFE_W / 2} y={SAFE_H * 0.86} textAnchor="middle"
            fontFamily={`${font}, sans-serif`} fontWeight={600}
            fontSize={18} fill={ed.text} opacity={labelP * 0.55}>
            {beat.original_text || beat.text || ""}
          </text>
        )}
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
        style={{ position: "absolute", left: S.left, top: S.top, opacity: 1 - fadeOut }}>
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
      style={{ position: "absolute", left: S.left, top: S.top, opacity: (1 - fadeOut) * ease(clamp01(p / 0.06)) }}>

      {/* Eyebrow — what is growing */}
      {subText && (
        <text x={SAFE_W / 2} y={SAFE_H * 0.07} textAnchor="middle"
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={14} fill={ed.text} opacity={0.5} letterSpacing={4}>
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
              fontSize={12} fill={ed.text} opacity={0.3}>
              {`${Math.round(t * 100)}%`}
            </text>
          </g>
        );
      })}

      {/* Value label at top edge of tower — attached, not floating */}
      {magText && fillH > 24 && (
        <text x={colX + colW / 2} y={colTop - 14} textAnchor="middle"
          fontFamily={`${font}, sans-serif`} fontWeight={900}
          fontSize={magSz} fill={ed.accent}
          fontVariantNumeric="tabular-nums" opacity={growP}>
          {magText}
        </text>
      )}

      {/* Context label below baseline */}
      {labelP > 0.1 && (
        <text x={SAFE_W / 2} y={baseline + 44} textAnchor="middle"
          fontFamily={`${font}, sans-serif`} fontWeight={600}
          fontSize={18} fill={ed.text} opacity={labelP * 0.6}>
          {beat.original_text || beat.text || ""}
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
  const fadeOut = clamp01((p - 0.92) / 0.08);
  const buildP = ease(clamp01(p / 0.18));
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
        style={{ position: "absolute", left: S.left, top: S.top, opacity: (1 - fadeOut) * buildP }}>
        <text x={24} y={SAFE_H * 0.09}
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={13} fill={ed.text} opacity={0.45} letterSpacing={5}>
          50 / 30 / 20 RULE
        </text>
        {/* Bar spans full safe width, tall enough to be the hero */}
        <BudgetBar x={0} y={SAFE_H * 0.16} w={SAFE_W} h={120}
          segments={segments} broken={breakP} ed={ed} font={font} />
        {breakP > 0.55 && (
          <g opacity={ease(clamp01((breakP - 0.55) / 0.3)) * 0.75}>
            <text x={SAFE_W / 2} y={SAFE_H * 0.52} textAnchor="middle"
              fontFamily={`${font}, sans-serif`} fontWeight={900}
              fontSize={80} fill={ed.accent} letterSpacing={10}
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
      style={{ position: "absolute", left: S.left, top: S.top, opacity: (1 - fadeOut) * buildP }}>
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
  const fadeOut = clamp01((p - 0.92) / 0.08);

  if (isFood) {
    const items = [
      { name: "Groceries 2020", price: "$152" },
      { name: "Groceries 2026", price: "$201" },
    ];
    return (
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
        style={{ position: "absolute", left: S.left, top: S.top, opacity: 1 - fadeOut }}>
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
      style={{ position: "absolute", left: S.left, top: S.top, opacity: 1 - fadeOut }}>
      {/* Source eyebrow */}
      <text x={24} y={figureTopY - 16}
        fontFamily={`${font}, monospace`} fontWeight={500}
        fontSize={12} fill={ed.text} opacity={enterP * 0.45} letterSpacing={5}>
        {(scene.subject || "").toUpperCase() || "DATA"}
      </text>

      {/* THE FIGURE — the dominant visual */}
      <text x={24} y={figureBaseY}
        fontFamily={`${font}, sans-serif`} fontWeight={900}
        fontSize={heroSz} fill={ed.accent}
        fontVariantNumeric="tabular-nums"
        opacity={enterP}>
        {label}
      </text>

      {/* Context label immediately below the figure */}
      {ctxLabel && (
        <text x={24} y={figureBaseY + ctxSz + 4}
          fontFamily={`${font}, sans-serif`} fontWeight={500}
          fontSize={ctxSz} fill={ed.text} opacity={enterP * 0.6}>
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
                fontSize={12} fill={ed.text} opacity={0.35}>0</text>
              <text x={barX + barW} y={barY + barH + 22} textAnchor="end"
                fontFamily={`${font}, monospace`} fontWeight={400}
                fontSize={12} fill={ed.text} opacity={0.35}>100%</text>
            </>
          )}
        </>
      )}

      {/* Context narration below the bar */}
      {groundP > 0.5 && (
        <text x={24} y={barY + barH + 52}
          fontFamily={`${font}, sans-serif`} fontWeight={500}
          fontSize={16} fill={ed.text}
          opacity={ease(clamp01((groundP - 0.5) / 0.4)) * 0.6}>
          {beat.original_text || ""}
        </text>
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
  const fadeOut = clamp01((p - 0.92) / 0.08);

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
      style={{ position: "absolute", left: S.left, top: S.top, opacity: 1 - fadeOut }}>

      {/* CAUSE: raw text in upper canvas, no container */}
      <text x={24} y={SAFE_H * 0.08}
        fontFamily={`${font}, sans-serif`} fontWeight={700}
        fontSize={causeSz} fill={ed.text} opacity={causeP * 0.75}>
        {causeLabel.length > 28 ? causeLabel.slice(0, 28) + "…" : causeLabel}
      </text>

      {/* Eyebrow label for cause */}
      <text x={24} y={SAFE_H * 0.08 - causeSz * 0.18}
        fontFamily={`${font}, monospace`} fontWeight={500}
        fontSize={11} fill={ed.text} opacity={causeP * 0.4} letterSpacing={4}>
        CAUSE
      </text>

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
        <text x={24} y={effectTopY - 14}
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={11} fill={ed.accent} opacity={0.6} letterSpacing={4}>
          RESULT
        </text>
        <text x={24} y={effectTopY}
          fontFamily={`${font}, sans-serif`} fontWeight={900}
          fontSize={effectSz} fill={ed.accent}>
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

  const buildP = ease(clamp01(p / 0.12));
  const drainP = ease(clamp01((p - 0.12) / 0.48));
  const labelP = ease(clamp01((p - 0.55) / 0.28));
  const fadeOut = clamp01((p - 0.92) / 0.08);

  // Vessel: tall rectangle, left-anchored, 80% of canvas height
  const vesselX = 24;
  const vesselW = SAFE_W * 0.18;   // narrow column for substance
  const vesselH = SAFE_H * 0.78;
  const vesselY = SAFE_H * 0.10;

  // Drain: from full at top, draining to (1 - fillRatio) * vesselH remaining
  const remaining = (1 - fillRatio);  // what's left after consumption
  const drained = fillRatio;          // what's consumed
  // Fill starts at full, drains: currentFill = 1 - drainP * drained (shrinks top-down)
  const currentFillRatio = 1 - drainP * drained;
  const currentFillH = vesselH * currentFillRatio;
  const currentFillY = vesselY + (vesselH - currentFillH);

  // Consumed amount label: large text to the right of the vessel
  const labelSz = fitFontSize(consumedLabel, SAFE_W - vesselX - vesselW - 56, Math.min(160, SAFE_H * 0.45), 32);
  const labelX = vesselX + vesselW + 40;
  const labelY = SAFE_H * 0.42;

  // Drain speed annotation: "< 1 MONTH"
  const speedLabel = consumed.context || scene.subject || "";

  // Tick marks on the vessel at 25/50/75/100%
  const ticks = [0, 0.25, 0.5, 0.75, 1.0].map(t => ({
    y: vesselY + vesselH * (1 - t),
    pct: Math.round(t * 100),
  }));

  return (
    <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
      style={{ position: "absolute", left: S.left, top: S.top, opacity: (1 - fadeOut) * buildP }}>

      {/* Vessel outline — no fill, just border */}
      <rect x={vesselX} y={vesselY} width={vesselW} height={vesselH}
        fill="none" stroke={ed.text} strokeWidth={2} opacity={0.2} />

      {/* Fluid fill — drains from top */}
      <rect x={vesselX + 2} y={currentFillY} width={vesselW - 4} height={currentFillH}
        fill={ed.accent} opacity={0.82} />

      {/* Tick marks to the left of the vessel */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={vesselX - 14} y1={t.y} x2={vesselX - 2} y2={t.y}
            stroke={ed.text} strokeWidth={1.5} opacity={0.3} />
          <text x={vesselX - 18} y={t.y + 5} textAnchor="end"
            fontFamily={`${font}, monospace`} fontWeight={400}
            fontSize={11} fill={ed.text} opacity={0.3}>
            {t.pct}%
          </text>
        </g>
      ))}

      {/* Drain level line: horizontal marker showing current fill */}
      {drainP > 0 && (
        <line x1={vesselX - 8} y1={currentFillY} x2={vesselX + vesselW + 8} y2={currentFillY}
          stroke={ed.accent} strokeWidth={2} opacity={0.6} />
      )}

      {/* Consumed amount: large raw text, right of vessel */}
      <g opacity={labelP} transform={`translate(0, ${(1 - labelP) * 24})`}>
        <text x={labelX} y={SAFE_H * 0.20}
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={12} fill={ed.text} opacity={0.45} letterSpacing={4}>
          CONSUMED
        </text>
        <text x={labelX} y={SAFE_H * 0.20 + labelSz * LH}
          fontFamily={`${font}, sans-serif`} fontWeight={900}
          fontSize={labelSz} fill={ed.accent}
          fontVariantNumeric="tabular-nums">
          {consumedLabel}
        </text>
        {speedLabel && (
          <text x={labelX} y={SAFE_H * 0.20 + labelSz * LH + 28}
            fontFamily={`${font}, sans-serif`} fontWeight={500}
            fontSize={16} fill={ed.text} opacity={0.55}>
            {speedLabel}
          </text>
        )}
      </g>

      {/* Remaining label near the bottom of the vessel */}
      {drainP > 0.7 && (
        <text x={vesselX + vesselW / 2} y={vesselY + vesselH + 24}
          textAnchor="middle"
          fontFamily={`${font}, monospace`} fontWeight={600}
          fontSize={14} fill={ed.text} opacity={ease(clamp01((drainP - 0.7) / 0.3)) * 0.5}>
          {`${Math.round(remaining * 100)}% LEFT`}
        </text>
      )}
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
  const fadeOut = clamp01((p - 0.92) / 0.08);

  const expLabel = expected.label || "";
  const actLabel = actual.label || "";
  // Before: relatively large but muted — it's being displaced
  const expSz = fitFontSize(expLabel, SAFE_W - 48, Math.min(72, SAFE_H * 0.22), 24);
  // After: larger, more prominent — this is the truth
  const actSz = fitFontSize(actLabel, SAFE_W - 48, Math.min(96, SAFE_H * 0.30), 28);

  // Before text: upper canvas
  const beforeY = SAFE_H * 0.10;
  const beforeBaseY = beforeY + expSz * LH;

  // Strike-through: sweeps across the "before" text at mid-height
  const strikeY = beforeY + expSz * LH * 0.5;

  // Divide line: at mid-canvas
  const divideY = SAFE_H * 0.50;

  // After text: lower canvas
  const afterY = SAFE_H * 0.56;

  return (
    <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}
      style={{ position: "absolute", left: S.left, top: S.top, opacity: 1 - fadeOut }}>

      {/* BEFORE STATE: raw text, upper canvas, muted */}
      <g opacity={showExpected * (1 - strikeP * 0.35)}>
        <text x={24} y={beforeY - 14}
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={11} fill={ed.text} opacity={showExpected * 0.35} letterSpacing={4}>
          EXPECTED
        </text>
        <text x={24} y={beforeBaseY}
          fontFamily={`${font}, sans-serif`} fontWeight={700}
          fontSize={expSz} fill={ed.text} opacity={showExpected * 0.7}>
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

      {/* AFTER STATE: rises from below, accent colored, larger */}
      <g opacity={showActual} transform={`translate(0, ${(1 - showActual) * 32})`}>
        <text x={24} y={afterY}
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={11} fill={ed.accent} opacity={0.55} letterSpacing={4}>
          REALITY
        </text>
        <text x={24} y={afterY + actSz * LH}
          fontFamily={`${font}, sans-serif`} fontWeight={900}
          fontSize={actSz} fill={ed.accent}>
          {actLabel}
        </text>
        {/* Accent rule below after text */}
        <rect x={24} y={afterY + actSz * LH + 12}
          width={showActual * 56} height={3}
          fill={ed.accent} opacity={0.55} />
      </g>

      {/* Footer annotation */}
      {showActual > 0.5 && (
        <text x={24} y={SAFE_H * 0.97}
          fontFamily={`${font}, monospace`} fontWeight={500}
          fontSize={11} fill={ed.text}
          opacity={ease(clamp01((showActual - 0.5) / 0.4)) * 0.35}
          letterSpacing={3}>
          EXPECTED → ACTUAL
        </text>
      )}
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
  const showPrevEcho = prev && local < TRANSITION_FRAMES && beatIndex > 0;
  const prevEchoOpacity = showPrevEcho ? clamp01(1 - local / TRANSITION_FRAMES) * 0.4 : 0;

  // carries_forward: when the current beat explicitly inherits a visual object
  // from the prior beat, that object persists at reduced opacity throughout.
  // This differs from the transition echo (which is always brief).
  const carriesForward = beat.carries_forward;
  const showPersistent = carriesForward && prev && !showPrevEcho && beatIndex > 0;
  const persistOpacity = showPersistent ? 0.22 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: ed.bg }}>
      {/* Persistent carry-forward: prior beat's visual lingers at low opacity */}
      {showPersistent && (
        <div style={{ position: "absolute", left: 0, top: 0, width: CANVAS_W, height: CANVAS_H, opacity: persistOpacity, pointerEvents: "none" }}>
          {prevScene.mechanism === "TYPOGRAPHY" ? (
            <TypographyScene beat={prev} p={1} local={prev.duration_frames}
              ed={ed} font={plan.fonts.primary} scene={prevScene} />
          ) : (
            <MechanismScene beat={prev} p={1} local={prev.duration_frames}
              ed={ed} font={plan.fonts.primary} scene={prevScene} />
          )}
        </div>
      )}

      {/* Previous beat echo — fading out during transition */}
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
