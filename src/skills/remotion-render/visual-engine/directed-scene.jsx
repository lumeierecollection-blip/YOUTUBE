import React from "react";
import { AbsoluteFill, useCurrentFrame, Easing } from "remotion";
import { paletteRoles } from "../visual/palette-roles.js";
import { SAFE_SHORTS } from "../layout/slots.js";

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const S = SAFE_SHORTS;
const SAFE_W = S.right - S.left;
const SAFE_H = S.bottom - S.top;

const ease = (t) => Easing.bezier(0.22, 0.9, 0.3, 1)(Math.max(0, Math.min(1, t)));
const easeIO = (t) => Easing.bezier(0.65, 0, 0.35, 1)(Math.max(0, Math.min(1, t)));
const clamp01 = (t) => Math.max(0, Math.min(1, t));

function beatAt(plan, frame) {
  const beats = plan.beats;
  let i = 0;
  while (i < beats.length - 1 && frame >= beats[i + 1].start_frame) i++;
  const b = beats[i];
  const p = clamp01((frame - b.start_frame) / Math.max(1, b.duration_frames));
  const local = frame - b.start_frame;
  return { beat: b, p, local };
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

/* ── Editorial palette ──────────────────────────────────────────────── */

function editorialColors(colors, rawPalette) {
  const lum = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  const chroma = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  };
  const all = [...rawPalette.primary, ...rawPalette.secondary];
  const sorted = [...all].sort((a, b) => lum(a) - lum(b));
  const subdued = all.find((c) => {
    const l = lum(c);
    return l > 0.25 && l < 0.7 && chroma(c) < 0.2 && c !== colors.accent;
  }) || sorted[Math.floor(sorted.length / 2)];
  return {
    bg: sorted[0],
    depth: sorted[1] || sorted[0],
    surface: sorted[sorted.length - 1],
    text: sorted[sorted.length - 1],
    textDark: sorted[0],
    accent: colors.accent,
    subdued,
  };
}

/* ── Subtle grid environment ────────────────────────────────────────── */

function EditorialGrid({ ed }) {
  const step = 120;
  const lines = [];
  for (let x = step; x < CANVAS_W; x += step) {
    lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={CANVAS_H}
      stroke={ed.text} strokeWidth={0.5} opacity={0.025} />);
  }
  for (let y = step; y < CANVAS_H; y += step) {
    lines.push(<line key={`h${y}`} x1={0} y1={y} x2={CANVAS_W} y2={y}
      stroke={ed.text} strokeWidth={0.5} opacity={0.025} />);
  }
  return (
    <svg width={CANVAS_W} height={CANVAS_H}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      {lines}
    </svg>
  );
}

/* ── Text layout ────────────────────────────────────────────────────── */

const LH = 1.18;
const MAX_SZ = 140;
const MIN_SZ = 36;
const WIDE = new Set("MWQ@%".split(""));
const NARROW = new Set("IJ1.,';:!|-".split(""));
const emW = (s) => [...s].reduce((w, c) => w + (WIDE.has(c) ? 0.88 : NARROW.has(c) ? 0.3 : 0.62), 0);

function layoutWords(words, maxW, maxH) {
  const ems = words.map((w) => emW(w) + 0.28);
  const totalEm = ems.reduce((a, b) => a + b, 0);
  const sz = Math.min(MAX_SZ, maxW / totalEm, maxH / LH);
  return { rows: [words], size: Math.max(MIN_SZ, sz) };
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

/* ══════════════════════════════════════════════════════════════════════
   MATERIAL OBJECTS — things that look like what they represent
   ══════════════════════════════════════════════════════════════════════ */

/* ── Fuel gauge ─────────────────────────────────────────────────────── */

function FuelGauge({ cx, cy, r, fill, label, reading, readingOpacity, ed, font }) {
  const startAngle = -210 * Math.PI / 180;
  const endAngle = 30 * Math.PI / 180;
  const range = endAngle - startAngle;
  const needleAngle = startAngle + range * Math.min(1, fill);

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

  const needleEnd = arcPt(needleAngle);
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
      {/* Danger zone arc */}
      <path d={dangerD} fill="none" stroke="#EF4444" strokeWidth={5} opacity={0.15} strokeLinecap="round" />
      {/* Track arc */}
      <path d={trackD} fill="none" stroke={ed.surface} strokeWidth={6} opacity={0.1} strokeLinecap="round" />
      {/* Filled arc */}
      {fill > 0 && (
        <path d={fillD} fill="none" stroke={ed.accent} strokeWidth={8} opacity={0.7} strokeLinecap="round" />
      )}
      {/* Tick marks */}
      {ticks.map((t, i) => (
        <line key={i} x1={t.inner.x} y1={t.inner.y} x2={t.outer.x} y2={t.outer.y}
          stroke={ed.surface} strokeWidth={2} opacity={0.2} />
      ))}
      {/* Inner ring */}
      <circle cx={cx} cy={cy} r={r * 0.12} fill={ed.depth} stroke={ed.surface} strokeWidth={1.5} opacity={0.3} />
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nEnd.x} y2={nEnd.y}
        stroke={ed.accent} strokeWidth={3.5} strokeLinecap="round" opacity={0.9} />
      <circle cx={cx} cy={cy} r={6} fill={ed.accent} />
      {/* Reading */}
      {reading && (
        <text x={cx} y={cy + r * 0.45} textAnchor="middle"
          fontFamily={`${font}, monospace`} fontWeight={900}
          fontSize={Math.min(72, r * 0.38)} fill={ed.accent}
          fontVariantNumeric="tabular-nums" opacity={readingOpacity ?? 1}>{reading}</text>
      )}
      {/* Domain label */}
      {label && (
        <text x={cx} y={cy + r * 0.65} textAnchor="middle"
          fontFamily={`${font}, sans-serif`} fontWeight={600}
          fontSize={22} fill={ed.subdued} opacity={0.45}
          letterSpacing={4}>{label}</text>
      )}
    </g>
  );
}

/* ── Receipt sheet ──────────────────────────────────────────────────── */

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

/* ── Statistic callout (editorial number presentation) ──────────────── */

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
          fontSize={13} fill={ed.subdued} opacity={0.4} letterSpacing={3}>{source}</text>
      )}
      <text x={x + 18} y={valueY}
        fontFamily={`${font}, sans-serif`} fontWeight={900}
        fontSize={sz} fill={highlighted ? ed.accent : ed.text}
        fontVariantNumeric="tabular-nums">{value}</text>
      {label && (
        <text x={x + 18} y={labelY}
          fontFamily={`${font}, sans-serif`} fontWeight={500}
          fontSize={20} fill={ed.subdued} opacity={0.5}>{label}</text>
      )}
    </g>
  );
}

/* ── Budget segmented bar ───────────────────────────────────────────── */

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
                  fontSize={Math.min(22, segW * 0.22)} fill={ed.text} opacity={opacity * 0.7}>
                  {seg.label}
                </text>
                <text x={segX + (isConsumed ? growW : segW) / 2} y={y + h / 2 + 18} textAnchor="middle"
                  fontFamily={`${font}, sans-serif`} fontWeight={600}
                  fontSize={Math.min(16, segW * 0.16)} fill={ed.text} opacity={opacity * 0.4}>
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

/* ── Document page ──────────────────────────────────────────────────── */

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
   CAPTION — spoken words appearing at the bottom
   ══════════════════════════════════════════════════════════════════════ */

function Caption({ beat, local, ed, font }) {
  const words = beat.words || [];
  if (!words.length) return null;
  const spoken = words.filter((w) => local >= w.frame).length;
  if (spoken === 0) return null;
  const fadeIn = clamp01(local / 8);
  const fadeOut = clamp01((local - beat.duration_frames * 0.95) / (beat.duration_frames * 0.05));
  if (fadeOut > 0.7) return null;
  if (fadeIn < 0.5) return null;
  return (
    <div style={{
      position: "absolute", left: S.left, width: SAFE_W,
      bottom: CANVAS_H - S.bottom + 40,
      fontFamily: `${font}, sans-serif`, fontWeight: 500,
      fontSize: 30, lineHeight: 1.35, opacity: fadeIn * (1 - fadeOut) * 0.6,
      color: ed.text, whiteSpace: "nowrap", overflow: "hidden",
    }}>
      {words.map((w, idx) => {
        if (local < w.frame) return null;
        const age = local - w.frame;
        const e = ease(age / 4);
        return (
          <span key={idx} style={{
            display: "inline", marginRight: "0.25em", opacity: Math.max(e, 0.85),
            color: idx === spoken - 1 ? ed.accent : ed.text,
          }}>{w.word} </span>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TYPOGRAPHY SCENE — kinetic text, now on dark editorial background
   ══════════════════════════════════════════════════════════════════════ */

function TypographyScene({ beat, p, local, ed, font, scene }) {
  const words = beat.words || [];
  if (!words.length) return null;
  const allWords = words.map((w) => w.word);
  const { rows, size } = layoutWords(allWords, SAFE_W * 0.9, SAFE_H * 0.55);
  const emphSet = new Set((scene.typography?.emphasis_words || []).map((w) => w.toLowerCase()));
  const spoken = words.filter((w) => local >= w.frame).length;
  const fadeOut = clamp01((p - 0.9) / 0.1);
  const isQuestion = scene.typography?.style === "question";
  const isImperative = scene.typography?.style === "imperative";

  let k = 0;
  return (
    <div style={{
      position: "absolute", left: S.left, width: SAFE_W,
      top: S.top + SAFE_H * 0.2,
      fontFamily: `${font}, sans-serif`, fontWeight: isImperative ? 900 : 800,
      fontSize: size, lineHeight: LH, letterSpacing: -size * 0.02,
      opacity: 1 - fadeOut,
      fontStyle: isQuestion ? "italic" : "normal",
      whiteSpace: "nowrap", overflow: "hidden",
    }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ whiteSpace: "nowrap" }}>
          {row.map((word) => {
            const idx = k++;
            const w = words[idx];
            if (!w || local < w.frame) return (
              <span key={idx} style={{ display: "inline-block", marginRight: size * 0.24, opacity: 0 }}>{word}</span>
            );
            const age = local - w.frame;
            const e = ease(age / 6);
            const isEmph = emphSet.has(word.toLowerCase().replace(/[^a-z]/g, ""));
            const isCurrent = idx === spoken - 1;
            return (
              <span key={idx} style={{
                display: "inline-block", marginRight: size * 0.24,
                transform: `translateY(${(1 - e) * size * 0.35}px)`,
                opacity: e,
                color: isCurrent ? ed.accent : isEmph ? ed.accent : ed.text,
              }}>{word}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MECHANISM SCENES — material-specific visual storytelling
   ══════════════════════════════════════════════════════════════════════ */

/* ── SURFACE_AND_BENEATH — official figure → reveal hidden reality ─── */

function SurfaceBeneathScene({ beat, p, local, ed, font, scene }) {
  const objs = scene.objects || [];
  const surface = findObj(objs, "surface", "official", "headline");
  const beneath = findObj(objs, "beneath", "hidden", "reality");
  const beneathObj = beneath !== surface ? beneath : (objs[1] || {});

  const surfaceLabel = surface.label || "?";
  const categories = beneathObj.categories || ["A", "B", "C"];

  const enterP = ease(clamp01(p / 0.2));
  const revealP = ease(clamp01((p - 0.3) / 0.35));
  const fadeOut = clamp01((p - 0.9) / 0.1);

  const catBarW = SAFE_W * 0.7;
  const catBarH = 36;
  const catStartY = SAFE_H * 0.52;

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
        {/* Official statistic — slides up as reveal happens */}
        <g transform={`translate(0, ${-revealP * SAFE_H * 0.1})`} opacity={enterP * (1 - revealP * 0.35)}>
          <StatisticCallout
            x={SAFE_W * 0.1} y={SAFE_H * 0.12}
            value={surfaceLabel} label={surface.source || "OFFICIAL HEADLINE"}
            source="CPI" ed={ed} font={font} highlighted={false} />
        </g>

        {/* Fracture line between official and reality */}
        {revealP > 0 && (
          <line x1={SAFE_W * 0.08} y1={SAFE_H * 0.42} x2={SAFE_W * 0.08 + SAFE_W * 0.84 * revealP} y2={SAFE_H * 0.42}
            stroke={ed.accent} strokeWidth={2} opacity={revealP * 0.35} strokeDasharray="8 6" />
        )}

        {/* Hidden reality — category bars emerge */}
        {revealP > 0 && categories.map((cat, i) => {
          const catP = ease(clamp01((revealP - i * 0.15) / 0.4));
          const barY = catStartY + i * (catBarH + 18);
          const barFill = (0.4 + i * 0.2) * catP;
          return (
            <g key={i} opacity={catP} transform={`translate(${(1 - catP) * 40}, 0)`}>
              <rect x={SAFE_W * 0.1} y={barY} width={catBarW * barFill} height={catBarH}
                rx={3} fill={ed.accent} opacity={0.25 + i * 0.08} />
              <text x={SAFE_W * 0.1 + 12} y={barY + catBarH / 2 + 5}
                fontFamily={`${font}, sans-serif`} fontWeight={700}
                fontSize={15} fill={ed.text} opacity={catP * 0.7} letterSpacing={2}>{cat}</text>
              <text x={SAFE_W * 0.1 + catBarW * barFill + 12} y={barY + catBarH / 2 + 5}
                fontFamily={`${font}, monospace`} fontWeight={800}
                fontSize={16} fill={ed.accent} opacity={catP * 0.8}>
                +{(20 + i * 12).toFixed(0)}%
              </text>
            </g>
          );
        })}

        {/* Label */}
        {revealP > 0.3 && (
          <text x={SAFE_W * 0.1} y={catStartY + categories.length * (catBarH + 18) + 30}
            fontFamily={`${font}, sans-serif`} fontWeight={600}
            fontSize={18} fill={ed.subdued} opacity={ease(clamp01((revealP - 0.3) / 0.3)) * 0.5}>
            {beneathObj.label || "THE REAL NUMBERS"}
          </text>
        )}
      </svg>
    </div>
  );
}

/* ── PROPORTIONAL_OBJECTS — two statistics compared editorially ──── */

function ProportionalScene({ beat, p, local, ed, font, scene }) {
  const objs = scene.objects || [];
  const a = objs[0] || {};
  const b = objs[1] || {};

  const enterA = ease(clamp01(p / 0.3));
  const enterB = ease(clamp01((p - 0.2) / 0.35));
  const fadeOut = clamp01((p - 0.9) / 0.1);

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
        <StatisticCallout x={SAFE_W * 0.08} y={SAFE_H * 0.12}
          value={a.label || "?"} label={a.context || "HEADLINE"} source="ANNUAL"
          ed={ed} font={font} highlighted={false} opacity={enterA} />
        <StatisticCallout x={SAFE_W * 0.08} y={SAFE_H * 0.42}
          value={b.label || "?"} label={b.context || "CORE"} source="CORE"
          ed={ed} font={font} highlighted={true} opacity={enterB} />
        {/* Divider */}
        <line x1={SAFE_W * 0.08} y1={SAFE_H * 0.38} x2={SAFE_W * 0.08 + SAFE_W * 0.7 * enterB} y2={SAFE_H * 0.38}
          stroke={ed.surface} strokeWidth={1} opacity={enterB * 0.1} />
      </svg>
    </div>
  );
}

/* ── PHYSICAL_GROWTH — material-specific growth visualization ──────── */

function GrowthScene({ beat, p, local, ed, font, scene }) {
  const objs = scene.objects || [];
  const subject = findObj(objs, "growing", "subject", "thing");
  const magnitude = findObj(objs, "magnitude", "amount", "value");

  const growP = ease(clamp01(p / 0.55));
  const labelP = ease(clamp01((p - 0.5) / 0.3));
  const fadeOut = clamp01((p - 0.9) / 0.1);

  const isFuel = scene.material === "fuel" || subject.appearance === "fuel_gauge";
  const isFood = scene.material === "food" || subject.appearance === "receipt";

  if (isFuel) {
    return (
      <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
        <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
          <FuelGauge
            cx={SAFE_W / 2} cy={SAFE_H * 0.38} r={SAFE_W * 0.34}
            fill={growP * 0.88} label={subject.label || "GASOLINE"}
            reading={labelP > 0.2 ? (magnitude.label || "") : ""}
            readingOpacity={labelP}
            ed={ed} font={font} />
          {/* Surge arrow */}
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
            <ReceiptSheet x={SAFE_W * 0.12} y={SAFE_H * 0.06} w={SAFE_W * 0.76} h={SAFE_H * 0.6}
              items={items} total="$39.65" growth={labelP > 0.3 ? (magnitude.label || "32%") : null}
              growthP={growP} ed={ed} font={font} />
          </g>
        </svg>
      </div>
    );
  }

  // Generic growth — an expanding mass with magnitude
  const massR = SAFE_W * 0.15 + SAFE_W * 0.22 * growP;
  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
        <circle cx={SAFE_W / 2} cy={SAFE_H * 0.38} r={massR}
          fill={ed.accent} opacity={0.12 + growP * 0.15} />
        <circle cx={SAFE_W / 2} cy={SAFE_H * 0.38} r={massR}
          fill="none" stroke={ed.accent} strokeWidth={3} opacity={growP * 0.4} />
        <text x={SAFE_W / 2} y={SAFE_H * 0.4} textAnchor="middle"
          fontFamily={`${font}, sans-serif`} fontWeight={900}
          fontSize={Math.min(80, massR * 0.6)} fill={ed.accent}
          fontVariantNumeric="tabular-nums" opacity={labelP}>{magnitude.label || ""}</text>
        <text x={SAFE_W / 2} y={SAFE_H * 0.4 + 40} textAnchor="middle"
          fontFamily={`${font}, sans-serif`} fontWeight={600}
          fontSize={22} fill={ed.subdued} opacity={growP * 0.5}>{subject.label || ""}</text>
      </svg>
    </div>
  );
}

/* ── STRUCTURAL_BREAKDOWN — document or budget fracturing ──────────── */

function BreakdownScene({ beat, p, local, ed, font, scene }) {
  const fadeOut = clamp01((p - 0.9) / 0.1);
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
          {/* Title */}
          <text x={SAFE_W * 0.08} y={SAFE_H * 0.1}
            fontFamily={`${font}, monospace`} fontWeight={600}
            fontSize={16} fill={ed.subdued} opacity={0.4} letterSpacing={3}>50 / 30 / 20 RULE</text>
          {/* Budget bar */}
          <BudgetBar x={SAFE_W * 0.06} y={SAFE_H * 0.18} w={SAFE_W * 0.88} h={70}
            segments={segments} broken={breakP} ed={ed} font={font} />
          {/* "BROKEN" stamp when broken enough */}
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

  // Document breakdown
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

/* ── EVIDENCE_FIGURE — a number in editorial context ─────────────── */

function EvidenceFigureScene({ beat, p, local, ed, font, scene }) {
  const figure = findObj(scene.objects || [], "evidence", "evidential", "figure") || {};
  const label = figure.label || scene.subject || "";
  const ctx = figure.context || scene.subject || "";

  const isFood = scene.material === "food";

  const enterP = ease(clamp01(p / 0.3));
  const fadeOut = clamp01((p - 0.9) / 0.1);

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

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
        <g opacity={enterP}>
          <StatisticCallout x={SAFE_W * 0.1} y={SAFE_H * 0.2}
            value={label} label={ctx !== label ? ctx : ""} source={scene.material === "document" ? "SOURCE" : ""}
            ed={ed} font={font} highlighted={true} />
        </g>
      </svg>
    </div>
  );
}

/* ── ACTION_CONSEQUENCE — cause → visible effect ─────────────────── */

function ActionConsequenceScene({ beat, p, local, ed, font, scene }) {
  const objs = scene.objects || [];
  const cause = findObj(objs, "cause", "force", "action");
  const effect = cause === findObj(objs, "consequence", "effect", "result")
    ? (objs[1] || {}) : findObj(objs, "consequence", "effect", "result");

  const causeP = ease(clamp01(p / 0.3));
  const arrowP = ease(clamp01((p - 0.25) / 0.2));
  const effectP = ease(clamp01((p - 0.4) / 0.35));
  const fadeOut = clamp01((p - 0.9) / 0.1);

  const causeLabel = cause.label || "";
  const effectLabel = effect.label || "";
  const causeSz = Math.min(48, SAFE_W * 0.8 / Math.max(1, causeLabel.length * 0.48));
  const effectSz = Math.min(52, SAFE_W * 0.8 / Math.max(1, effectLabel.length * 0.48));

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      {/* CAUSE */}
      <div style={{
        position: "absolute", left: SAFE_W * 0.06, width: SAFE_W * 0.88,
        top: SAFE_H * 0.1, opacity: causeP,
      }}>
        <div style={{
          padding: "18px 0 18px 24px",
          borderLeft: `4px solid ${ed.surface}`,
        }}>
          <div style={{
            fontFamily: `${font}, sans-serif`, fontWeight: 800,
            fontSize: causeSz, lineHeight: 1.25, color: ed.text,
          }}>{causeLabel}</div>
        </div>
      </div>

      {/* Arrow connector */}
      <svg width={SAFE_W} height={SAFE_H}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <line x1={SAFE_W * 0.06 + 26} y1={SAFE_H * 0.26}
          x2={SAFE_W * 0.06 + 26} y2={SAFE_H * 0.26 + SAFE_H * 0.16 * arrowP}
          stroke={ed.accent} strokeWidth={2.5} opacity={arrowP * 0.4} />
        {arrowP > 0.7 && (
          <polygon
            points={`${SAFE_W * 0.06 + 26},${SAFE_H * 0.44} ${SAFE_W * 0.06 + 18},${SAFE_H * 0.42} ${SAFE_W * 0.06 + 34},${SAFE_H * 0.42}`}
            fill={ed.accent} opacity={arrowP * 0.45} />
        )}
      </svg>

      {/* EFFECT */}
      <div style={{
        position: "absolute", left: SAFE_W * 0.06, width: SAFE_W * 0.88,
        top: SAFE_H * 0.46, opacity: effectP,
        transform: `translateY(${(1 - effectP) * 20}px)`,
      }}>
        <div style={{
          padding: "18px 0 18px 24px",
          borderLeft: `4px solid ${ed.accent}`,
        }}>
          <div style={{
            fontFamily: `${font}, sans-serif`, fontWeight: 800,
            fontSize: effectSz, lineHeight: 1.25, color: ed.accent,
          }}>{effectLabel}</div>
        </div>
      </div>
    </div>
  );
}

/* ── VISIBLE_CONSUMPTION — budget/income being consumed ──────────── */

function ConsumptionScene({ beat, p, local, ed, font, scene }) {
  const objs = scene.objects || [];
  const consumed = findObj(objs, "consumed", "portion", "swallow");
  const fillRatio = consumed.final_state?.fill || 0.62;

  const buildP = ease(clamp01(p / 0.15));
  const consumeP = ease(clamp01((p - 0.15) / 0.55));
  const fadeOut = clamp01((p - 0.9) / 0.1);

  const segments = [
    { label: "NEEDS", pct: `${Math.round(fillRatio * 100)}%`, ratio: fillRatio, color: ed.accent, fillOp: 0.35 },
    { label: "WANTS", pct: "", ratio: (1 - fillRatio) * 0.6, color: ed.subdued, fillOp: 0.15 },
    { label: "SAVE", pct: "", ratio: (1 - fillRatio) * 0.4, color: ed.text, fillOp: 0.08 },
  ];

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: (1 - fadeOut) * buildP }}>
      <svg width={SAFE_W} height={SAFE_H} viewBox={`0 0 ${SAFE_W} ${SAFE_H}`}>
        <text x={SAFE_W * 0.08} y={SAFE_H * 0.08}
          fontFamily={`${font}, monospace`} fontWeight={600}
          fontSize={14} fill={ed.subdued} opacity={0.35} letterSpacing={3}>HOUSEHOLD INCOME</text>
        <BudgetBar x={SAFE_W * 0.06} y={SAFE_H * 0.14} w={SAFE_W * 0.88} h={70}
          segments={segments} consumed={consumeP} ed={ed} font={font} />
        {/* Remaining sliver callout */}
        {consumeP > 0.5 && (
          <g opacity={ease(clamp01((consumeP - 0.5) / 0.3))}>
            <line x1={SAFE_W * 0.8} y1={SAFE_H * 0.14 + 75}
              x2={SAFE_W * 0.8} y2={SAFE_H * 0.14 + 120}
              stroke={ed.subdued} strokeWidth={1} opacity={0.3} />
            <text x={SAFE_W * 0.8} y={SAFE_H * 0.14 + 145}
              textAnchor="middle" fontFamily={`${font}, sans-serif`} fontWeight={700}
              fontSize={18} fill={ed.subdued} opacity={0.5}>
              {`${Math.round((1 - fillRatio) * 100)}% left`}
            </text>
          </g>
        )}
        {/* Consumption label */}
        {consumeP > 0.7 && (
          <text x={SAFE_W * 0.08} y={SAFE_H * 0.5} textAnchor="start"
            fontFamily={`${font}, sans-serif`} fontWeight={900}
            fontSize={56} fill={ed.accent} opacity={ease(clamp01((consumeP - 0.7) / 0.25)) * 0.7}>
            {consumed.label || `${Math.round(fillRatio * 100)}%`}
          </text>
        )}
      </svg>
    </div>
  );
}

/* ── STATE_CHANGE — A is replaced by B ──────────────────────────── */

function StateChangeScene({ beat, p, local, ed, font, scene }) {
  const objs = scene.objects || [];
  const expected = findObj(objs, "expected", "before", "old");
  const actual = expected === findObj(objs, "actual", "after", "new", "true")
    ? (objs[1] || {}) : findObj(objs, "actual", "after", "new", "true");

  const showExpected = ease(clamp01(p / 0.2));
  const strikeP = ease(clamp01((p - 0.25) / 0.2));
  const showActual = ease(clamp01((p - 0.4) / 0.3));
  const fadeOut = clamp01((p - 0.9) / 0.1);

  const expLabel = expected.label || "";
  const actLabel = actual.label || "";
  const expSz = Math.min(50, SAFE_W * 0.85 / Math.max(1, expLabel.length * 0.5));
  const actSz = Math.min(58, SAFE_W * 0.85 / Math.max(1, actLabel.length * 0.5));

  return (
    <div style={{ position: "absolute", left: S.left, top: S.top, width: SAFE_W, height: SAFE_H, opacity: 1 - fadeOut }}>
      {/* Expected — shown then struck */}
      <div style={{
        position: "absolute", left: SAFE_W * 0.06, width: SAFE_W * 0.88,
        top: SAFE_H * 0.18, opacity: showExpected,
      }}>
        <div style={{
          fontFamily: `${font}, sans-serif`, fontWeight: 700,
          fontSize: expSz, lineHeight: 1.3, color: ed.text,
          textDecoration: strikeP > 0.5 ? "line-through" : "none",
          textDecorationColor: ed.accent,
          textDecorationThickness: 3,
          opacity: 1 - strikeP * 0.45,
        }}>{expLabel}</div>
      </div>

      {/* Divider */}
      {showActual > 0 && (
        <svg width={SAFE_W} height={4}
          style={{ position: "absolute", left: 0, top: S.top + SAFE_H * 0.42 }}>
          <line x1={SAFE_W * 0.06} y1={2} x2={SAFE_W * 0.06 + SAFE_W * 0.8 * showActual} y2={2}
            stroke={ed.accent} strokeWidth={2} opacity={showActual * 0.25} />
        </svg>
      )}

      {/* Actual — appears below */}
      <div style={{
        position: "absolute", left: SAFE_W * 0.06, width: SAFE_W * 0.88,
        top: SAFE_H * 0.48, opacity: showActual,
        transform: `translateY(${(1 - showActual) * 24}px)`,
      }}>
        <div style={{
          fontFamily: `${font}, sans-serif`, fontWeight: 900,
          fontSize: actSz, lineHeight: 1.3, color: ed.accent,
        }}>{actLabel}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CAMERA WRAPPER
   ══════════════════════════════════════════════════════════════════════ */

function cameraTransform(camera, progress) {
  switch (camera) {
    case "push_in": return `scale(${1 + progress * 0.15})`;
    case "pull_back": return `scale(${1 - progress * 0.12})`;
    case "push_past": return `translateY(${-progress * 70}px)`;
    case "tilt_down": return `translateY(${progress * 55}px)`;
    case "widen": return `scale(${1 - progress * 0.08})`;
    default: return "none";
  }
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
   ══════════════════════════════════════════════════════════════════════ */

export function DirectedScene({ plan }) {
  const frame = useCurrentFrame();
  const colors = paletteRoles(plan.palette);
  const ed = editorialColors(colors, plan.palette);
  const { beat, p, local } = beatAt(plan, frame);
  const scene = beat.scene || {};
  const isTypographyOnly = scene.mechanism === "TYPOGRAPHY";
  const showCaption = scene.typography?.role !== "primary";

  return (
    <AbsoluteFill style={{ backgroundColor: ed.bg }}>
      <EditorialGrid ed={ed} />
      {isTypographyOnly && (
        <TypographyScene beat={beat} p={p} local={local}
          ed={ed} font={plan.fonts.primary} scene={scene} />
      )}
      {!isTypographyOnly && (
        <>
          <MechanismScene beat={beat} p={p} local={local}
            ed={ed} font={plan.fonts.primary} scene={scene} />
          {showCaption && (
            <Caption beat={beat} local={local}
              ed={ed} font={plan.fonts.secondary || plan.fonts.primary} />
          )}
        </>
      )}
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
