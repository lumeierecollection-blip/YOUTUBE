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

function editorialColors(colors, rawPalette, bgMode) {
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
  const isWhite = bgMode === "white";
  const bgColor = isWhite ? "#FFFFFF" : sorted[0];
  const subdued = all.find((c) => {
    return contrastRatio(c, bgColor) >= 4.5 && lum(c) < 0.7 && c !== colors.accent;
  }) || sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.6))];
  const safeSubdued = contrastRatio(subdued, bgColor) >= 4.5
    ? subdued : (all.find((c) => contrastRatio(c, bgColor) >= 4.5) || sorted[sorted.length - 1]);
  return {
    bg: bgColor,
    depth: sorted[1] || sorted[0],
    surface: sorted[sorted.length - 1],
    text: isWhite ? sorted[0] : sorted[sorted.length - 1],
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
   TYPOGRAPHY SCENE — phrase-based, not word-by-word

   The bible says: "animate the meaningful unit" and
   "word → word → word is exactly how the video starts looking AI-generated"

   So: the full phrase appears as one unit, with emphasis words
   highlighted. The entrance is a single, clean animation.
   ══════════════════════════════════════════════════════════════════════ */

function TypographyScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor(scene.mechanism, beat.emotional_weight);
  const headline = beat.text || "";
  if (!headline) return null;

  const allWords = headline.split(/\s+/);
  const { rows, size } = layoutWords(allWords, SAFE_W * 0.9, SAFE_H * 0.45);
  const emphSet = new Set((scene.typography?.emphasis_words || []).map((w) => w.toLowerCase()));
  const isQuestion = scene.typography?.style === "question";
  const isImperative = scene.typography?.style === "imperative";

  const enterP = ease(clamp01(local / 14));
  const fadeOut = clamp01((p - 0.92) / 0.08);
  const holdP = clamp01((local - 14) / 20);

  return (
    <div style={{
      position: "absolute", left: S.left, width: SAFE_W,
      top: S.top + SAFE_H * 0.18,
      fontFamily: `${font}, sans-serif`, fontWeight: isImperative ? 900 : 800,
      fontSize: size, lineHeight: LH, letterSpacing: -size * 0.02,
      opacity: enterP * (1 - fadeOut),
      fontStyle: isQuestion ? "italic" : "normal",
      transform: `translateY(${(1 - enterP) * size * 0.5}px)`,
    }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ whiteSpace: "nowrap", overflow: "hidden" }}>
          {row.map((word, wi) => {
            const isEmph = emphSet.has(word.toLowerCase().replace(/[^a-z0-9]/g, ""));
            const emphScale = isEmph && holdP > 0 ? 1 + holdP * 0.04 : 1;
            return (
              <span key={wi} style={{
                display: "inline-block", marginRight: size * 0.24,
                color: isEmph ? ed.accent : ed.text,
                transform: `scale(${emphScale})`,
                transformOrigin: "bottom left",
              }}>{word}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MECHANISM SCENES

   Bible rules applied:
   - No separate caption/headline — text is part of the composition
   - Numbers must have physical meaning
   - Objects interact with typography
   ══════════════════════════════════════════════════════════════════════ */

function SurfaceBeneathScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("SURFACE_AND_BENEATH", beat.emotional_weight);
  const objs = scene.objects || [];
  const surface = findObj(objs, "surface", "official", "headline");
  const beneath = findObj(objs, "beneath", "hidden", "reality");
  const beneathObj = beneath !== surface ? beneath : (objs[1] || {});

  const surfaceLabel = surface.label || "?";
  const matCats = {
    money: ["HOUSING", "FOOD", "TRANSPORT"],
    fuel: ["REGULAR", "PREMIUM", "DIESEL"],
    food: ["GROCERIES", "DINING", "DELIVERY"],
    housing: ["RENT", "UTILITIES", "INSURANCE"],
  };
  const categories = beneathObj.categories || matCats[scene.material] || ["SEGMENT 1", "SEGMENT 2", "SEGMENT 3"];

  const enterP = ease(clamp01(p / 0.2));
  const revealP = ease(clamp01((p - 0.3) / 0.35));
  const fadeOut = clamp01((p - 0.92) / 0.08);

  const catBarW = SAFE_W * 0.7;
  const catBarH = 60;
  const catStartY = SAFE_H * 0.42;

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
        <g transform={`translate(0, ${-revealP * SAFE_H * 0.1})`} opacity={enterP * (1 - revealP * 0.35)}>
          <StatisticCallout
            x={SAFE_W * 0.1} y={SAFE_H * 0.12}
            value={surfaceLabel} label={surface.context || ""}
            source={(scene.subject || "REPORTED").toUpperCase()} ed={ed} font={font} highlighted={false} />
        </g>
        {revealP > 0 && (
          <line x1={SAFE_W * 0.08} y1={SAFE_H * 0.42} x2={SAFE_W * 0.08 + SAFE_W * 0.84 * revealP} y2={SAFE_H * 0.42}
            stroke={ed.accent} strokeWidth={2} opacity={revealP * 0.35} strokeDasharray="8 6" />
        )}
        {revealP > 0 && categories.map((cat, i) => {
          const catP = ease(clamp01((revealP - i * 0.15) / 0.4));
          const barY = catStartY + i * (catBarH + 30);
          const barFill = (0.4 + i * 0.2) * catP;
          return (
            <g key={i} opacity={catP} transform={`translate(${(1 - catP) * 40}, 0)`}>
              <rect x={SAFE_W * 0.1} y={barY} width={catBarW * barFill} height={catBarH}
                rx={4} fill={ed.accent} opacity={0.55 + i * 0.1} />
              <text x={SAFE_W * 0.1 + 14} y={barY + catBarH / 2 + 6}
                fontFamily={`${font}, sans-serif`} fontWeight={700}
                fontSize={20} fill={ed.text} opacity={catP * 0.9} letterSpacing={2}>{cat}</text>
              <text x={SAFE_W * 0.1 + catBarW * barFill + 14} y={barY + catBarH / 2 + 6}
                fontFamily={`${font}, monospace`} fontWeight={800}
                fontSize={22} fill={ed.accent} opacity={catP}>
                {Math.round(barFill * 100)}%
              </text>
            </g>
          );
        })}
        {revealP > 0.3 && (
          <text x={SAFE_W * 0.1} y={catStartY + categories.length * (catBarH + 30) + 40}
            fontFamily={`${font}, sans-serif`} fontWeight={600}
            fontSize={22} fill={ed.text} opacity={ease(clamp01((revealP - 0.3) / 0.3)) * 0.6}>
            {beneathObj.label || "REALITY"}
          </text>
        )}
      </svg>
    </div>
  );
}

function ProportionalScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("PROPORTIONAL_OBJECTS", beat.emotional_weight);
  const objs = scene.objects || [];
  const a = objs[0] || {};
  const b = objs[1] || {};
  const headline = beat.text || "";
  const parts = headline.split(/\bvs\.?\b|\bVS\.?\b/i);
  const fallbackA = parts[0]?.trim() || "?";
  const fallbackB = parts[1]?.trim() || "?";

  const enterP = ease(clamp01(p / 0.2));
  const growP = ease(clamp01((p - 0.15) / 0.5));
  const fadeOut = clamp01((p - 0.92) / 0.08);

  const labelA = (a.label && a.label !== "A") ? a.label : fallbackA;
  const labelB = (b.label && b.label !== "B") ? b.label : fallbackB;
  const rawNameA = a.context || a.role || "";
  const rawNameB = b.context || b.role || "";
  const nameA = rawNameA !== labelA ? rawNameA.toUpperCase() : "";
  const nameB = rawNameB !== labelB ? rawNameB.toUpperCase() : "";

  const numA = parseFloat(String(labelA).replace(/[^0-9.]/g, "")) || 1;
  const numB = parseFloat(String(labelB).replace(/[^0-9.]/g, "")) || 1;
  const maxVal = Math.max(numA, numB);
  const ratioA = numA / maxVal;
  const ratioB = numB / maxVal;

  const barMaxW = SAFE_W * 0.74;
  const barH = 100;
  const barX = SAFE_W * 0.06;
  const barY1 = SAFE_H * 0.10;
  const barY2 = SAFE_H * 0.44;
  const szA = fitFontSize(labelA, SAFE_W * 0.28, 56, 22);
  const szB = fitFontSize(labelB, SAFE_W * 0.28, 56, 22);

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
        <g opacity={enterP}>
          {nameA && <text x={barX} y={barY1 - 16}
            fontFamily={`${font}, sans-serif`} fontWeight={600}
            fontSize={18} fill={ed.text} opacity={0.6} letterSpacing={2}>{nameA}</text>}
          <rect x={barX} y={barY1} width={barMaxW} height={barH}
            rx={6} fill={ed.surface} opacity={0.1} />
          <rect x={barX} y={barY1} width={barMaxW * ratioA * growP} height={barH}
            rx={6} fill={ed.accent} opacity={0.55} />
          <rect x={barX} y={barY1} width={barMaxW * ratioA * growP} height={barH}
            rx={6} fill="none" stroke={ed.accent} strokeWidth={2.5} opacity={growP * 0.65} />
          {growP > 0.3 && (() => {
            const tX = barX + barMaxW * ratioA * growP + 14;
            const overflows = tX + emW(labelA) * szA > SAFE_W - 10;
            return (
              <text x={overflows ? barX + barMaxW * ratioA * growP - 14 : tX}
                y={barY1 + barH / 2 + szA * 0.35}
                textAnchor={overflows ? "end" : "start"}
                fontFamily={`${font}, sans-serif`} fontWeight={900}
                fontSize={szA} fill={ed.accent} opacity={growP}
                fontVariantNumeric="tabular-nums">{labelA}</text>
            );
          })()}
        </g>
        <g opacity={enterP}>
          {nameB && <text x={barX} y={barY2 - 16}
            fontFamily={`${font}, sans-serif`} fontWeight={600}
            fontSize={18} fill={ed.text} opacity={0.6} letterSpacing={2}>{nameB}</text>}
          <rect x={barX} y={barY2} width={barMaxW} height={barH}
            rx={6} fill={ed.surface} opacity={0.1} />
          <rect x={barX} y={barY2} width={barMaxW * ratioB * growP} height={barH}
            rx={6} fill={ed.subdued} opacity={0.55} />
          <rect x={barX} y={barY2} width={barMaxW * ratioB * growP} height={barH}
            rx={6} fill="none" stroke={ed.subdued} strokeWidth={2} opacity={growP * 0.65} />
          {growP > 0.3 && (() => {
            const tX = barX + barMaxW * ratioB * growP + 14;
            const overflows = tX + emW(labelB) * szB > SAFE_W - 10;
            return (
              <text x={overflows ? barX + barMaxW * ratioB * growP - 14 : tX}
                y={barY2 + barH / 2 + szB * 0.35}
                textAnchor={overflows ? "end" : "start"}
                fontFamily={`${font}, sans-serif`} fontWeight={900}
                fontSize={szB} fill={ed.text} opacity={growP * 0.8}
                fontVariantNumeric="tabular-nums">{labelB}</text>
            );
          })()}
        </g>
        {growP > 0.6 && ratioA !== ratioB && (() => {
          const shorter = Math.min(ratioA, ratioB);
          return (
            <line x1={barX + barMaxW * shorter} y1={barY1 + barH + 4}
              x2={barX + barMaxW * shorter} y2={barY2 - 4}
              stroke={ed.subdued} strokeWidth={1} opacity={ease(clamp01((growP - 0.6) / 0.3)) * 0.2}
              strokeDasharray="4 4" />
          );
        })()}
        {growP > 0.7 && (() => {
          const ratio = Math.max(numA, numB) / Math.min(numA, numB);
          const diffLabel = ratio >= 1.5 ? `${ratio.toFixed(1)}×` : numA !== numB ? `+${Math.round(Math.abs(numA - numB))}` : "=";
          const p2 = ease(clamp01((growP - 0.7) / 0.3));
          return (
            <g opacity={p2}>
              <line x1={barX} y1={SAFE_H * 0.68} x2={barX + barMaxW * p2} y2={SAFE_H * 0.68}
                stroke={ed.subdued} strokeWidth={1} opacity={0.12} strokeDasharray="6 4" />
              <rect x={SAFE_W * 0.18} y={SAFE_H * 0.73} width={SAFE_W * 0.64} height={SAFE_H * 0.18}
                rx={10} fill={ed.surface} opacity={0.06} />
              <text x={SAFE_W / 2} y={SAFE_H * 0.84} textAnchor="middle"
                fontFamily={`${font}, sans-serif`} fontWeight={900}
                fontSize={56} fill={ed.accent} opacity={1}
                fontVariantNumeric="tabular-nums">{diffLabel}</text>
              <text x={SAFE_W / 2} y={SAFE_H * 0.92} textAnchor="middle"
                fontFamily={`${font}, monospace`} fontWeight={500}
                fontSize={13} fill={ed.text} opacity={0.5}
                letterSpacing={4}>DIFFERENCE</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

function GrowthScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("PHYSICAL_GROWTH", beat.emotional_weight);
  const objs = scene.objects || [];
  const subject = findObj(objs, "growing", "subject", "thing");
  const magnitude = findObj(objs, "magnitude", "amount", "value");

  const growP = ease(clamp01(p / 0.55));
  const labelP = ease(clamp01((p - 0.5) / 0.3));
  const fadeOut = clamp01((p - 0.92) / 0.08);

  const isFuel = scene.material === "fuel" || subject.appearance === "fuel_gauge";
  const isFood = scene.material === "food" || subject.appearance === "receipt";

  if (isFuel) {
    return (
      <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
        <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
          <FuelGauge
            cx={SAFE_W / 2} cy={SAFE_H * 0.42} r={SAFE_W * 0.38}
            fill={growP * 0.88} label={subject.label || "GASOLINE"}
            reading={labelP > 0.2 ? (magnitude.label || "") : ""}
            readingOpacity={labelP}
            ed={ed} font={font} />
          {growP > 0.6 && (
            <g opacity={ease(clamp01((growP - 0.6) / 0.3)) * 0.5}>
              <line x1={SAFE_W * 0.72} y1={SAFE_H * 0.55} x2={SAFE_W * 0.72} y2={SAFE_H * 0.35}
                stroke={ed.accent} strokeWidth={3} strokeLinecap="round" />
              <polygon points={`${SAFE_W * 0.72},${SAFE_H * 0.33} ${SAFE_W * 0.72 - 8},${SAFE_H * 0.37} ${SAFE_W * 0.72 + 8},${SAFE_H * 0.37}`}
                fill={ed.accent} />
            </g>
          )}
        </svg>
      </div>
    );
  }

  if (isFood) {
    const items = [
      { name: "Bread", price: "$4.89" },
      { name: "Milk", price: "$5.49" },
      { name: "Eggs (doz)", price: "$6.79" },
      { name: "Chicken", price: "$9.99" },
      { name: "Produce", price: "$12.49" },
    ];
    return (
      <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
        <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
          <g opacity={growP}>
            <ReceiptSheet x={SAFE_W * 0.12} y={SAFE_H * 0.04} w={SAFE_W * 0.76} h={SAFE_H * 0.75}
              items={items} total="$39.65" growth={labelP > 0.3 ? (magnitude.label || "32%") : null}
              growthP={growP} ed={ed} font={font} />
          </g>
        </svg>
      </div>
    );
  }

  const colW = SAFE_W * 0.38;
  const colH = SAFE_H * 0.78;
  const colX = SAFE_W / 2 - colW / 2;
  const colY = SAFE_H * 0.04;
  const fillH = colH * growP;
  const magText = magnitude.label || beat.text || "";
  const magSz = fitFontSize(magText, SAFE_W * 0.35, 64, 24);
  const subText = subject.label || "";
  const subSz = fitFontSize(subText, SAFE_W * 0.6, 24, 14);

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
        <rect x={colX} y={colY} width={colW} height={colH}
          rx={8} fill={ed.surface} opacity={0.15} />
        <rect x={colX} y={colY + colH - fillH} width={colW} height={fillH}
          rx={8} fill={ed.accent} opacity={0.55 + growP * 0.15} />
        <rect x={colX} y={colY + colH - fillH} width={colW} height={fillH}
          rx={6} fill="none" stroke={ed.accent} strokeWidth={2.5} opacity={growP * 0.65} />
        {[0.25, 0.5, 0.75, 1.0].map((t) => (
          <g key={t}>
            <line x1={colX - 18} y1={colY + colH * (1 - t)} x2={colX} y2={colY + colH * (1 - t)}
              stroke={ed.subdued} strokeWidth={1.5} opacity={0.4} />
            <text x={colX - 22} y={colY + colH * (1 - t) + 5} textAnchor="end"
              fontFamily={`${font}, monospace`} fontWeight={500}
              fontSize={12} fill={ed.text} opacity={0.45}>{Math.round(t * 100)}%</text>
          </g>
        ))}
        <line x1={colX + colW} y1={colY + colH - fillH}
          x2={colX + colW + 14} y2={colY + colH - fillH}
          stroke={ed.accent} strokeWidth={2} opacity={growP * 0.6} />
        {labelP > 0.2 && (
          <text x={colX + colW + 20} y={colY + colH - fillH + magSz * 0.35}
            fontFamily={`${font}, sans-serif`} fontWeight={900}
            fontSize={magSz} fill={ed.accent}
            fontVariantNumeric="tabular-nums" opacity={labelP}>{magText}</text>
        )}
        <text x={SAFE_W / 2} y={colY + colH + 48} textAnchor="middle"
          fontFamily={`${font}, sans-serif`} fontWeight={700}
          fontSize={Math.max(subSz, 22)} fill={ed.text} opacity={growP * 0.7}
          letterSpacing={3}>{subText.toUpperCase()}</text>
      </svg>
    </div>
  );
}

function BreakdownScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("STRUCTURAL_BREAKDOWN", beat.emotional_weight);
  const fadeOut = clamp01((p - 0.92) / 0.08);
  const buildP = ease(clamp01(p / 0.2));
  const breakP = ease(clamp01((p - 0.3) / 0.5));
  const isBudget = scene.material === "money" || /budget|fifty|thirty|twenty|50.30.20/i.test(beat.text);

  if (isBudget) {
    const segments = [
      { label: "NEEDS", pct: "50%", ratio: 0.5, color: ed.accent, fillOp: 0.3 },
      { label: "WANTS", pct: "30%", ratio: 0.3, color: ed.subdued, fillOp: 0.25 },
      { label: "SAVE", pct: "20%", ratio: 0.2, color: ed.text, fillOp: 0.15 },
    ];
    return (
      <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: (1 - fadeOut) * buildP }}>
        <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
          <text x={SAFE_W * 0.08} y={SAFE_H * 0.1}
            fontFamily={`${font}, monospace`} fontWeight={600}
            fontSize={16} fill={ed.text} opacity={0.5} letterSpacing={3}>50 / 30 / 20 RULE</text>
          <BudgetBar x={SAFE_W * 0.06} y={SAFE_H * 0.18} w={SAFE_W * 0.88} h={70}
            segments={segments} broken={breakP} ed={ed} font={font} />
          {breakP > 0.6 && (
            <g opacity={ease(clamp01((breakP - 0.6) / 0.3)) * 0.6}>
              <text x={SAFE_W / 2} y={SAFE_H * 0.48} textAnchor="middle"
                fontFamily={`${font}, sans-serif`} fontWeight={900}
                fontSize={64} fill={ed.accent} letterSpacing={12}
                transform={`rotate(-8, ${SAFE_W / 2}, ${SAFE_H * 0.48})`}>BROKEN</text>
            </g>
          )}
        </svg>
      </div>
    );
  }

  const subject = scene.subject || "CPI";
  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: (1 - fadeOut) * buildP }}>
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
        <DocumentPage x={SAFE_W * 0.1} y={SAFE_H * 0.05} w={SAFE_W * 0.8} h={SAFE_H * 0.65}
          title={subject.toUpperCase()} lineCount={10} highlight={breakP < 0.4}
          torn={breakP} ed={ed} font={font} />
      </svg>
    </div>
  );
}

function EvidenceFigureScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("EVIDENCE_FIGURE", beat.emotional_weight);
  const figure = findObj(scene.objects || [], "evidence", "evidential", "figure") || {};
  const label = figure.label || scene.subject || "";
  const ctx = figure.context || scene.subject || "";
  const isFood = scene.material === "food";

  const enterP = ease(clamp01(p / 0.3));
  const fadeOut = clamp01((p - 0.92) / 0.08);

  if (isFood) {
    const items = [
      { name: "Groceries 2020", price: "$152" },
      { name: "Groceries 2026", price: "$201" },
    ];
    return (
      <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
        <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
          <g opacity={enterP}>
            <ReceiptSheet x={SAFE_W * 0.12} y={SAFE_H * 0.06} w={SAFE_W * 0.76} h={SAFE_H * 0.5}
              items={items} total={label || "32%"} growth={label}
              growthP={enterP} ed={ed} font={font} />
          </g>
        </svg>
      </div>
    );
  }

  const isPct = /%/.test(label);
  const numVal = parseFloat(String(label).replace(/[^0-9.]/g, "")) || 0;
  const fillRatio = isPct ? clamp01(numVal / 100) : 0.65;
  const labelSz = fitFontSize(label, SAFE_W * 0.5, 96, 28);
  const ctxLabel = ctx !== label ? ctx : "";
  const ctxSz = ctxLabel ? fitFontSize(ctxLabel, SAFE_W * 0.7, 24, 14) : 0;

  const barX = SAFE_W * 0.08;
  const barW = SAFE_W * 0.84;
  const barY = SAFE_H * 0.42;
  const barH = 56;
  const markX = barX + barW * fillRatio * enterP;

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
        <g opacity={enterP}>
          {scene.material === "document" && (
            <text x={barX} y={SAFE_H * 0.15}
              fontFamily={`${font}, monospace`} fontWeight={500}
              fontSize={13} fill={ed.text} opacity={0.45} letterSpacing={3}>SOURCE</text>
          )}
          <rect x={barX} y={barY} width={barW} height={barH}
            rx={8} fill={ed.surface} opacity={0.1} />
          <rect x={barX} y={barY} width={barW * fillRatio * enterP} height={barH}
            rx={8} fill={ed.accent} opacity={0.6} />
          <line x1={markX} y1={barY - 28} x2={markX} y2={barY + barH + 28}
            stroke={ed.accent} strokeWidth={3} opacity={enterP * 0.8} />
          <text x={markX} y={barY - 48}
            textAnchor="middle" fontFamily={`${font}, sans-serif`} fontWeight={900}
            fontSize={labelSz} fill={ed.accent}
            fontVariantNumeric="tabular-nums">{label}</text>
          {ctxLabel && (
            <text x={markX} y={barY + barH + 56}
              textAnchor="middle" fontFamily={`${font}, sans-serif`} fontWeight={500}
              fontSize={ctxSz} fill={ed.text} opacity={0.55}>{ctxLabel}</text>
          )}
          {isPct && (
            <>
              <text x={barX} y={barY + barH + 36}
                fontFamily={`${font}, monospace`} fontWeight={500}
                fontSize={14} fill={ed.text} opacity={0.4}>0</text>
              <text x={barX + barW} y={barY + barH + 36}
                textAnchor="end" fontFamily={`${font}, monospace`} fontWeight={500}
                fontSize={14} fill={ed.text} opacity={0.4}>100%</text>
            </>
          )}
          <rect x={barX} y={SAFE_H * 0.68} width={barW} height={SAFE_H * 0.24}
            rx={10} fill={ed.surface} opacity={0.05} />
          <line x1={barX} y1={SAFE_H * 0.68} x2={barX + barW} y2={SAFE_H * 0.68}
            stroke={ed.subdued} strokeWidth={1} opacity={0.1} />
          <text x={SAFE_W / 2} y={SAFE_H * 0.80} textAnchor="middle"
            fontFamily={`${font}, sans-serif`} fontWeight={800}
            fontSize={Math.round(labelSz * 0.65)} fill={ed.accent} opacity={enterP * 0.9}
            fontVariantNumeric="tabular-nums">{label}</text>
          {scene.subject && (
            <text x={SAFE_W / 2} y={SAFE_H * 0.88} textAnchor="middle"
              fontFamily={`${font}, monospace`} fontWeight={500}
              fontSize={14} fill={ed.text} opacity={0.45}
              letterSpacing={3}>{(scene.subject || "").toUpperCase()}</text>
          )}
        </g>
      </svg>
    </div>
  );
}

function ActionConsequenceScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("ACTION_CONSEQUENCE", beat.emotional_weight);
  const objs = scene.objects || [];
  const cause = findObj(objs, "cause", "force", "action");
  const effect = cause === findObj(objs, "consequence", "effect", "result")
    ? (objs[1] || {}) : findObj(objs, "consequence", "effect", "result");

  const causeP = ease(clamp01(p / 0.3));
  const connectP = ease(clamp01((p - 0.2) / 0.25));
  const effectP = ease(clamp01((p - 0.4) / 0.35));
  const fadeOut = clamp01((p - 0.92) / 0.08);

  const causeLabel = cause.label || "";
  const effectLabel = effect.label || "";
  const causeSz = fitFontSize(causeLabel, SAFE_W * 0.72, 56, 22);
  const effectSz = fitFontSize(effectLabel, SAFE_W * 0.72, 60, 24);

  const panelX = SAFE_W * 0.06;
  const panelW = SAFE_W * 0.88;
  const causeY = SAFE_H * 0.06;
  const effectY = SAFE_H * 0.50;

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      <div style={{
        position: "absolute", left: panelX, width: panelW,
        top: causeY, opacity: causeP, borderRadius: 6, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: ed.surface, opacity: 0.12, borderRadius: 6,
        }} />
        <div style={{
          position: "absolute", left: 0, top: 0, width: 8, height: "100%",
          background: ed.surface, opacity: 0.35, borderRadius: "6px 0 0 6px",
        }} />
        <div style={{
          padding: "32px 24px 32px 28px",
          fontFamily: `${font}, sans-serif`, fontWeight: 800,
          fontSize: causeSz, lineHeight: 1.25, color: ed.text,
        }}>{causeLabel}</div>
      </div>

      <svg width={SAFE_W} height={SAFE_H}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <line x1={panelX + 4} y1={SAFE_H * 0.28}
          x2={panelX + 4} y2={SAFE_H * 0.28 + (effectY - SAFE_H * 0.28 - 8) * connectP}
          stroke={ed.accent} strokeWidth={4} opacity={connectP * 0.7} />
        {connectP > 0.6 && (
          <polygon
            points={`${panelX + 4},${effectY - 4} ${panelX - 6},${effectY - 16} ${panelX + 14},${effectY - 16}`}
            fill={ed.accent} opacity={connectP * 0.7} />
        )}
      </svg>

      <div style={{
        position: "absolute", left: panelX, width: panelW,
        top: effectY, opacity: effectP, borderRadius: 6, overflow: "hidden",
        transform: `translateY(${(1 - effectP) * 16}px)`,
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: ed.accent, opacity: 0.12, borderRadius: 6,
        }} />
        <div style={{
          position: "absolute", left: 0, top: 0, width: 8, height: "100%",
          background: ed.accent, opacity: 0.5, borderRadius: "6px 0 0 6px",
        }} />
        <div style={{
          padding: "32px 24px 32px 28px",
          fontFamily: `${font}, sans-serif`, fontWeight: 900,
          fontSize: effectSz, lineHeight: 1.25, color: ed.accent,
        }}>{effectLabel}</div>
      </div>

      {effectP > 0.5 && (
        <div style={{
          position: "absolute", left: panelX, width: panelW,
          top: SAFE_H * 0.84,
          opacity: ease(clamp01((effectP - 0.5) / 0.4)) * 0.7,
        }}>
          <div style={{
            borderTop: `1px solid ${ed.text}`,
            paddingTop: 14,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{
              fontFamily: `${font}, monospace`, fontWeight: 500,
              fontSize: 12, color: ed.text, letterSpacing: 3,
              textTransform: "uppercase", opacity: 0.6,
            }}>{"CAUSE → EFFECT"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ConsumptionScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("VISIBLE_CONSUMPTION", beat.emotional_weight);
  const objs = scene.objects || [];
  const consumed = findObj(objs, "consumed", "portion", "swallow");
  const fillRatio = consumed.final_state?.fill || 0.62;

  const buildP = ease(clamp01(p / 0.15));
  const consumeP = ease(clamp01((p - 0.15) / 0.55));
  const fadeOut = clamp01((p - 0.92) / 0.08);

  const segments = [
    { label: "NEEDS", pct: `${Math.round(fillRatio * 100)}%`, ratio: fillRatio, color: ed.accent, fillOp: 0.35 },
    { label: "WANTS", pct: "", ratio: (1 - fillRatio) * 0.6, color: ed.subdued, fillOp: 0.15 },
    { label: "SAVE", pct: "", ratio: (1 - fillRatio) * 0.4, color: ed.text, fillOp: 0.08 },
  ];

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: (1 - fadeOut) * buildP }}>
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
        <text x={SAFE_W * 0.08} y={SAFE_H * 0.14}
          fontFamily={`${font}, monospace`} fontWeight={600}
          fontSize={16} fill={ed.text} opacity={0.5} letterSpacing={3}>HOUSEHOLD INCOME</text>
        <BudgetBar x={SAFE_W * 0.06} y={SAFE_H * 0.2} w={SAFE_W * 0.88} h={100}
          segments={segments} consumed={consumeP} ed={ed} font={font} />
        {consumeP > 0.5 && (
          <g opacity={ease(clamp01((consumeP - 0.5) / 0.3))}>
            <line x1={SAFE_W * 0.8} y1={SAFE_H * 0.2 + 108}
              x2={SAFE_W * 0.8} y2={SAFE_H * 0.2 + 155}
              stroke={ed.subdued} strokeWidth={1.5} opacity={0.5} />
            <text x={SAFE_W * 0.8} y={SAFE_H * 0.2 + 180}
              textAnchor="middle" fontFamily={`${font}, sans-serif`} fontWeight={700}
              fontSize={22} fill={ed.text} opacity={0.6}>
              {`${Math.round((1 - fillRatio) * 100)}% left`}
            </text>
          </g>
        )}
        {consumeP > 0.7 && (() => {
          const cLabel = consumed.label || beat.text || `${Math.round(fillRatio * 100)}%`;
          const cSz = fitFontSize(cLabel, SAFE_W * 0.84, 72, 28);
          return (
            <text x={SAFE_W * 0.08} y={SAFE_H * 0.48} textAnchor="start"
              fontFamily={`${font}, sans-serif`} fontWeight={900}
              fontSize={cSz} fill={ed.accent} opacity={ease(clamp01((consumeP - 0.7) / 0.25))}>
              {cLabel}
            </text>
          );
        })()}
        {consumeP > 0.8 && (() => {
          const dp = ease(clamp01((consumeP - 0.8) / 0.2));
          const cats = [
            { label: "HOUSING", ratio: 0.35, op: 0.6 },
            { label: "TRANSPORT", ratio: 0.22, op: 0.5 },
            { label: "FOOD", ratio: 0.18, op: 0.45 },
          ];
          return (
            <g opacity={dp}>
              <line x1={SAFE_W * 0.08} y1={SAFE_H * 0.58} x2={SAFE_W * 0.92} y2={SAFE_H * 0.58}
                stroke={ed.subdued} strokeWidth={1} opacity={0.12} />
              <text x={SAFE_W * 0.08} y={SAFE_H * 0.64}
                fontFamily={`${font}, monospace`} fontWeight={500}
                fontSize={12} fill={ed.text} opacity={0.5} letterSpacing={3}>BREAKDOWN</text>
              {cats.map((c, i) => {
                const cy = SAFE_H * 0.68 + i * 64;
                return (
                  <g key={i}>
                    <rect x={SAFE_W * 0.08} y={cy} width={SAFE_W * 0.74 * c.ratio * dp} height={44}
                      rx={4} fill={ed.accent} opacity={c.op} />
                    <text x={SAFE_W * 0.08 + 12} y={cy + 28}
                      fontFamily={`${font}, sans-serif`} fontWeight={700}
                      fontSize={15} fill={ed.text} opacity={dp * 0.85}
                      letterSpacing={2}>{c.label}</text>
                    <text x={SAFE_W * 0.08 + SAFE_W * 0.74 * c.ratio * dp + 12} y={cy + 28}
                      fontFamily={`${font}, monospace`} fontWeight={800}
                      fontSize={16} fill={ed.accent} opacity={dp}>
                      {Math.round(c.ratio * fillRatio * 100)}%
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

function StateChangeScene({ beat, p, local, ed, font, scene }) {
  const ease = easeFor("STATE_CHANGE", beat.emotional_weight);
  const objs = scene.objects || [];
  const expected = findObj(objs, "expected", "before", "old");
  const actual = expected === findObj(objs, "actual", "after", "new", "true")
    ? (objs[1] || {}) : findObj(objs, "actual", "after", "new", "true");

  const showExpected = ease(clamp01(p / 0.2));
  const strikeP = ease(clamp01((p - 0.25) / 0.2));
  const divideP = ease(clamp01((p - 0.3) / 0.15));
  const showActual = ease(clamp01((p - 0.4) / 0.3));
  const fadeOut = clamp01((p - 0.92) / 0.08);

  const expLabel = expected.label || "";
  const actLabel = actual.label || "";
  const expSz = fitFontSize(expLabel, SAFE_W * 0.72, 56, 22);
  const actSz = fitFontSize(actLabel, SAFE_W * 0.72, 64, 24);

  const panelX = SAFE_W * 0.06;
  const panelW = SAFE_W * 0.88;

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      <div style={{
        position: "absolute", left: panelX, width: panelW,
        top: SAFE_H * 0.14, opacity: showExpected, borderRadius: 6, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: ed.surface, opacity: 0.12 * (1 - strikeP * 0.5), borderRadius: 6,
        }} />
        <div style={{
          padding: "32px 24px",
          fontFamily: `${font}, sans-serif`, fontWeight: 700,
          fontSize: expSz, lineHeight: 1.3, color: ed.text,
          textDecoration: strikeP > 0.5 ? "line-through" : "none",
          textDecorationColor: ed.accent,
          textDecorationThickness: 3,
          opacity: 1 - strikeP * 0.25,
        }}>{expLabel}</div>
      </div>

      <svg width={SAFE_W} height={SAFE_H}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <line x1={panelX} y1={SAFE_H * 0.40}
          x2={panelX + panelW * divideP} y2={SAFE_H * 0.40}
          stroke={ed.accent} strokeWidth={3} opacity={divideP * 0.55} />
      </svg>

      <div style={{
        position: "absolute", left: panelX, width: panelW,
        top: SAFE_H * 0.50, opacity: showActual, borderRadius: 6, overflow: "hidden",
        transform: `translateY(${(1 - showActual) * 20}px)`,
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: ed.accent, opacity: 0.12, borderRadius: 6,
        }} />
        <div style={{
          position: "absolute", left: 0, top: 0, width: 8, height: "100%",
          background: ed.accent, opacity: 0.5, borderRadius: "6px 0 0 6px",
        }} />
        <div style={{
          padding: "32px 24px 32px 28px",
          fontFamily: `${font}, sans-serif`, fontWeight: 900,
          fontSize: actSz, lineHeight: 1.3, color: ed.accent,
        }}>{actLabel}</div>
      </div>

      {showActual > 0.5 && (
        <div style={{
          position: "absolute", left: panelX, width: panelW,
          top: SAFE_H * 0.86,
          opacity: ease(clamp01((showActual - 0.5) / 0.4)) * 0.7,
        }}>
          <div style={{
            borderTop: `1px solid ${ed.text}`,
            paddingTop: 14,
            fontFamily: `${font}, monospace`, fontWeight: 500,
            fontSize: 12, color: ed.text, letterSpacing: 3,
            textTransform: "uppercase", opacity: 0.6,
          }}>{"EXPECTED → ACTUAL"}</div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CAMERA WRAPPER
   ══════════════════════════════════════════════════════════════════════ */

function cameraTransform(camera, progress) {
  return "none";
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
  const ed = editorialColors(colors, plan.palette, plan.bgMode);
  const { beat, p, local, prev, beatIndex } = beatAt(plan, frame);
  const scene = beat.scene || {};
  const isTypographyOnly = scene.mechanism === "TYPOGRAPHY";
  const tOpacity = transitionOpacity(beat, local, beatIndex);

  const prevScene = prev?.scene || {};
  const showPrevEcho = prev && local < TRANSITION_FRAMES && beatIndex > 0;
  const prevEchoOpacity = showPrevEcho ? clamp01(1 - local / TRANSITION_FRAMES) * 0.4 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: ed.bg }}>
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
