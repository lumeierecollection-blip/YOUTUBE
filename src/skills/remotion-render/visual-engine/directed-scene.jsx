import React from "react";
import { AbsoluteFill, useCurrentFrame, Easing } from "remotion";
import { paletteRoles } from "../visual/palette-roles.js";
import { SAFE_SHORTS } from "../layout/slots.js";

/**
 * DIRECTED SCENE — renders visual treatments selected by the Visual Director.
 *
 * Each beat carries a `treatment` that determines what appears on screen.
 * There is no fixed alternation. A sentence about erosion shows erosion.
 * A sentence that IS the point shows typography. The visual matches the
 * meaning, or it does not appear.
 *
 * Every component answers: "If the audio were muted, can I understand
 * what this scene is communicating?"
 */

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const S = SAFE_SHORTS;
const SAFE_W = S.right - S.left;
const SAFE_H = S.bottom - S.top;
const MID_X = S.left + SAFE_W / 2;
const MID_Y = S.top + SAFE_H / 2;

const EASE = Easing.bezier(0.2, 0.9, 0.3, 1);
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);

function at(plan, frame) {
  const beats = plan.beats;
  let i = 0;
  while (i < beats.length - 1 && frame >= beats[i + 1].start_frame) i++;
  const b = beats[i];
  const p = Math.max(0, Math.min(1, (frame - b.start_frame) / Math.max(1, b.duration_frames)));
  const local = frame - b.start_frame;
  return { beat: b, p, local };
}

/* ── Shared text helpers ────────────────────────────────────────────── */

const WIDE = new Set("MWQG@%".split(""));
const SEMI = new Set("LTFY".split(""));
const NARROW = new Set("IJ1.,';:!|-".split(""));
const emWidth = (s) => 1.03 * [...s].reduce(
  (w, c) => w + (WIDE.has(c) ? 0.92 : SEMI.has(c) ? 0.52 : NARROW.has(c) ? 0.3 : 0.68), 0);

const LH = 1.16;
const MAX_SIZE = 148;
const MIN_SIZE = 38;

function wrapInto(ems, n) {
  const total = ems.reduce((a, b) => a + b, 0);
  const target = total / n;
  const rows = [];
  let row = [], acc = 0;
  for (let i = 0; i < ems.length; i++) {
    const left = ems.length - i;
    const need = n - rows.length;
    if (row.length && (acc + ems[i] / 2 > target && need > 1) && left >= need) {
      rows.push(row); row = []; acc = 0;
    }
    row.push(i); acc += ems[i];
  }
  if (row.length) rows.push(row);
  return rows.length === n ? rows : null;
}

function layoutText(words, maxW, maxH) {
  const ems = words.map((w) => emWidth(w) + 0.3);
  let best = null;
  for (let n = 1; n <= Math.min(14, words.length); n++) {
    const idx = wrapInto(ems, n);
    if (!idx) continue;
    const widest = idx.reduce((m, r) => Math.max(m, r.reduce((a, i) => a + ems[i], 0)), 0.5);
    const size = Math.min(MAX_SIZE, maxW / widest, maxH / (n * LH));
    if (!best || size > best.size) best = { size, rows: idx.map((r) => r.map((i) => words[i])) };
  }
  if (!best) return { rows: [words], size: MIN_SIZE };
  return { rows: best.rows, size: Math.max(MIN_SIZE, best.size) };
}

/* ── Caption: spoken words building word-by-word ─────────────────── */

function Caption({ beat, local, colors, font, position }) {
  const words = beat.words || [];
  if (!words.length) return null;

  const captionSize = position === "bottom" ? 36 : 28;
  const spoken = words.filter((w) => local >= w.frame).length;
  const out = Math.max(0, Math.min(1, (local - beat.duration_frames * 0.92) / (beat.duration_frames * 0.08)));

  const top = position === "bottom"
    ? S.bottom - 120
    : S.top + 20;

  return (
    <div style={{
      position: "absolute", left: S.left, width: SAFE_W, top,
      fontFamily: `${font}, sans-serif`, fontWeight: 500,
      fontSize: captionSize, lineHeight: 1.3, opacity: (1 - out) * 0.65,
      color: colors.onGround,
    }}>
      {words.map((w, idx) => {
        const since = local - w.frame;
        if (since < 0) return null;
        const e = EASE(Math.min(1, (since + 1) / 5));
        return (
          <span key={idx} style={{
            display: "inline",
            marginRight: "0.25em",
            opacity: e,
            color: idx === spoken - 1 ? colors.accent : colors.onGround,
          }}>{w.word} </span>
        );
      })}
    </div>
  );
}

/* ── STATEMENT: typography IS the visual ─────────────────────────── */

function StatementTreatment({ beat, p, local, colors, font }) {
  const words = beat.words || [];
  if (!words.length) return null;
  const { rows, size } = layoutText(words.map((w) => w.word), SAFE_W, SAFE_H * 0.86);

  let k = 0;
  const spoken = words.filter((w) => local >= w.frame).length;
  const out = Math.max(0, Math.min(1, (local - beat.duration_frames * 0.9) / (beat.duration_frames * 0.1)));

  return (
    <div style={{
      position: "absolute", left: S.left, width: SAFE_W,
      top: MID_Y - (rows.length * size * LH) / 2,
      fontFamily: `${font}, sans-serif`, fontWeight: 800,
      fontSize: size, lineHeight: LH, letterSpacing: -size * 0.02,
      opacity: 1 - out,
    }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ whiteSpace: "nowrap" }}>
          {row.map((word) => {
            const idx = k++;
            const w = words[idx];
            const since = local - w.frame;
            if (since < 0) return null;
            const e = EASE(Math.min(1, (since + 1) / 7));
            const current = idx === spoken - 1;
            return (
              <span key={idx} style={{
                display: "inline-block",
                marginRight: size * 0.26,
                transform: `translateY(${(1 - e) * size * 0.55}px)`,
                opacity: e,
                color: current ? colors.accent : colors.onGround,
              }}>{word}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── QUANTITY: the number IS the information ──────────────────────── */

function QuantityTreatment({ beat, p, colors, font }) {
  const el = beat.elements;
  const num = el.number;
  const unit = el.unit || "";
  const context = el.context || "";

  const countTo = Number.isFinite(num) && num > 0
    ? Math.round(num * EASE_IO(Math.min(1, p / 0.7)))
    : null;
  const display = countTo !== null ? countTo.toLocaleString() : (el.raw || "");

  const numSize = Math.max(100, Math.min(320, SAFE_W / (String(display).length * 0.55)));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  const e = EASE(Math.min(1, p / 0.25));

  return (
    <div style={{ position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - numSize * 0.7, opacity: (1 - out) * e, textAlign: "center" }}>
      <div style={{
        color: colors.accent, fontFamily: `${font}, sans-serif`, fontWeight: 900,
        fontSize: numSize, fontVariantNumeric: "tabular-nums",
        letterSpacing: -numSize * 0.03,
      }}>
        {display}{unit && <span style={{ fontSize: numSize * 0.4, marginLeft: numSize * 0.08, color: colors.onGround }}>{unit}</span>}
      </div>
      {context && (
        <div style={{
          color: colors.onGround, opacity: 0.55, fontFamily: `${font}, sans-serif`,
          fontWeight: 500, fontSize: 32, marginTop: 16,
        }}>{context}</div>
      )}
    </div>
  );
}

/* ── EROSION / DEPLETION: something progressively loses ──────────── */

function ErosionTreatment({ beat, p, colors, font }) {
  const el = beat.elements;
  const label = (el.subject || el.verb || "").toUpperCase();
  const e = EASE(Math.min(1, p / 0.2));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  const fill = Math.max(0.08, 1 - EASE_IO(Math.min(1, p / 0.85)) * 0.82);
  const barW = SAFE_W * 0.8;
  const barH = 56;

  return (
    <div style={{ position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - 80, opacity: (1 - out) * e }}>
      {label && <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 800, fontSize: 48,
        color: colors.onGround, marginBottom: 32, letterSpacing: -1,
      }}>{label}</div>}
      <div style={{ width: barW, height: barH, borderRadius: barH / 2, background: colors.paper || "#2226", position: "relative", overflow: "hidden" }}>
        <div style={{
          width: `${fill * 100}%`, height: "100%", borderRadius: barH / 2,
          background: colors.accent, transition: "none",
        }} />
      </div>
      <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 600, fontSize: 28,
        color: colors.onGround, opacity: 0.5, marginTop: 16,
      }}>{el.verb || ""}</div>
    </div>
  );
}

/* ── GROWTH: something progressively increases ───────────────────── */

function GrowthTreatment({ beat, p, colors, font }) {
  const el = beat.elements;
  const label = (el.subject || el.verb || "").toUpperCase();
  const e = EASE(Math.min(1, p / 0.2));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  const fill = EASE_IO(Math.min(1, p / 0.85)) * 0.92 + 0.08;
  const barW = SAFE_W * 0.8;
  const barH = 56;

  const numDisplay = el.number || "";

  return (
    <div style={{ position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - 80, opacity: (1 - out) * e }}>
      {label && <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 800, fontSize: 48,
        color: colors.onGround, marginBottom: 32, letterSpacing: -1,
      }}>{label}</div>}
      <div style={{ width: barW, height: barH, borderRadius: barH / 2, background: colors.paper || "#2226", position: "relative", overflow: "hidden" }}>
        <div style={{
          width: `${fill * 100}%`, height: "100%", borderRadius: barH / 2,
          background: colors.accent,
        }} />
      </div>
      {numDisplay && <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 900, fontSize: 72,
        color: colors.accent, marginTop: 24,
      }}>{numDisplay}</div>}
    </div>
  );
}

/* ── VERSUS / COMPARISON: two things side by side ────────────────── */

function VersusTreatment({ beat, p, colors, font }) {
  const el = beat.elements;
  const e = EASE(Math.min(1, p / 0.3));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));

  const left = String(el.left || "").toUpperCase();
  const right = String(el.right || "").toUpperCase();
  const half = (SAFE_W - 40) / 2;
  const labelSize = Math.min(52, half / Math.max(1, Math.max(left.length, right.length) * 0.5));

  return (
    <div style={{ position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - 120, opacity: (1 - out), display: "flex", gap: 40 }}>
      <div style={{
        flex: 1, textAlign: "center",
        transform: `translateX(${(1 - e) * -60}px)`, opacity: e,
      }}>
        <div style={{
          width: "100%", height: 180, borderRadius: 16,
          background: colors.accent, opacity: 0.9,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: `${font}, sans-serif`, fontWeight: 800, fontSize: labelSize, color: colors.ground }}>{left}</span>
        </div>
      </div>
      <div style={{
        flex: 1, textAlign: "center",
        transform: `translateX(${(1 - e) * 60}px)`, opacity: e,
      }}>
        <div style={{
          width: "100%", height: 180, borderRadius: 16,
          background: colors.onGround, opacity: 0.15,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: `${font}, sans-serif`, fontWeight: 800, fontSize: labelSize, color: colors.onGround }}>{right}</span>
        </div>
      </div>
    </div>
  );
}

/* ── PROPORTION: two quantities at proportional scale ────────────── */

function ProportionTreatment({ beat, p, colors, font }) {
  const el = beat.elements;
  const e = EASE(Math.min(1, p / 0.3));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));

  const leftLabel = String(el.left?.label || "").toUpperCase();
  const rightLabel = String(el.right?.label || "").toUpperCase();
  const leftScale = el.left?.scale || 1;
  const rightScale = el.right?.scale || 0.6;
  const barW = SAFE_W * 0.8;
  const barH = 48;

  return (
    <div style={{ position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - 100, opacity: (1 - out) }}>
      <div style={{ marginBottom: 28, opacity: e }}>
        <div style={{ fontFamily: `${font}, sans-serif`, fontWeight: 700, fontSize: 28, color: colors.onGround, marginBottom: 8 }}>{leftLabel}</div>
        <div style={{ width: barW, height: barH, borderRadius: barH / 2, background: colors.paper || "#2226", overflow: "hidden" }}>
          <div style={{ width: `${leftScale * e * 100}%`, height: "100%", borderRadius: barH / 2, background: colors.accent }} />
        </div>
      </div>
      <div style={{ opacity: e }}>
        <div style={{ fontFamily: `${font}, sans-serif`, fontWeight: 700, fontSize: 28, color: colors.onGround, marginBottom: 8 }}>{rightLabel}</div>
        <div style={{ width: barW, height: barH, borderRadius: barH / 2, background: colors.paper || "#2226", overflow: "hidden" }}>
          <div style={{ width: `${rightScale * e * 100}%`, height: "100%", borderRadius: barH / 2, background: colors.onGround, opacity: 0.5 }} />
        </div>
      </div>
      {el.number && <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 900, fontSize: 56,
        color: colors.accent, marginTop: 28, opacity: e,
      }}>{el.number}</div>}
    </div>
  );
}

/* ── CAUSE_EFFECT: A → B ─────────────────────────────────────────── */

function CauseEffectTreatment({ beat, p, colors, font }) {
  const el = beat.elements;
  const e = EASE(Math.min(1, p / 0.3));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  const arrowProgress = EASE_IO(Math.min(1, (p - 0.15) / 0.4));

  const subject = (el.subject || "").toUpperCase();
  const causal = el.causal_word || "";
  const boxH = 140;
  const gap = 100;

  return (
    <div style={{ position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - boxH - gap / 2, opacity: (1 - out) }}>
      <div style={{
        width: SAFE_W * 0.7, height: boxH, borderRadius: 16,
        background: colors.onGround, opacity: e * 0.12,
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto",
      }}>
        <span style={{ fontFamily: `${font}, sans-serif`, fontWeight: 800, fontSize: 36, color: colors.onGround, opacity: e }}>{subject}</span>
      </div>
      <svg width={SAFE_W} height={gap} style={{ display: "block", margin: "0 auto" }}>
        <line x1={SAFE_W / 2} y1={10} x2={SAFE_W / 2} y2={10 + (gap - 30) * arrowProgress}
          stroke={colors.accent} strokeWidth={4} strokeLinecap="round" />
        {arrowProgress > 0.8 && <>
          <line x1={SAFE_W / 2 - 16} y1={gap - 30} x2={SAFE_W / 2} y2={gap - 10} stroke={colors.accent} strokeWidth={4} strokeLinecap="round" />
          <line x1={SAFE_W / 2 + 16} y1={gap - 30} x2={SAFE_W / 2} y2={gap - 10} stroke={colors.accent} strokeWidth={4} strokeLinecap="round" />
        </>}
      </svg>
      <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 600, fontSize: 24,
        color: colors.accent, textAlign: "center", opacity: arrowProgress,
      }}>{causal}</div>
    </div>
  );
}

/* ── CHANGE: a value moving from one state to another ────────────── */

function ChangeTreatment({ beat, p, colors, font }) {
  const el = beat.elements;
  const e = EASE(Math.min(1, p / 0.2));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  const direction = el.direction === "up" ? 1 : -1;

  const barW = SAFE_W * 0.6;
  const barH = 48;
  const startFill = direction > 0 ? 0.2 : 0.85;
  const endFill = direction > 0 ? 0.85 : 0.2;
  const currentFill = startFill + (endFill - startFill) * EASE_IO(Math.min(1, p / 0.8));

  return (
    <div style={{ position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - 80, opacity: (1 - out) * e, textAlign: "center" }}>
      {el.number && <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 900, fontSize: 72,
        color: colors.accent, marginBottom: 24,
      }}>{el.number}</div>}
      <div style={{ width: barW, height: barH, borderRadius: barH / 2, background: colors.paper || "#2226", overflow: "hidden", margin: "0 auto" }}>
        <div style={{ width: `${currentFill * 100}%`, height: "100%", borderRadius: barH / 2, background: colors.accent }} />
      </div>
      <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 600, fontSize: 28,
        color: colors.onGround, opacity: 0.5, marginTop: 16,
      }}>{direction > 0 ? "↑" : "↓"} {el.description || ""}</div>
    </div>
  );
}

/* ── SEQUENCE: ordered steps ─────────────────────────────────────── */

function SequenceTreatment({ beat, p, colors, font }) {
  const el = beat.elements;
  const e = EASE(Math.min(1, p / 0.25));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));

  const ordinal = (el.ordinal || "").toUpperCase();
  const subject = (el.subject || "").toUpperCase();

  return (
    <div style={{ position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - 100, opacity: (1 - out) * e }}>
      <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 900, fontSize: 120,
        color: colors.accent, opacity: 0.25, letterSpacing: -4,
      }}>{ordinal}</div>
      <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 800, fontSize: 52,
        color: colors.onGround, marginTop: -20, letterSpacing: -1,
      }}>{subject}</div>
    </div>
  );
}

/* ── REVEAL: progressive uncovering ──────────────────────────────── */

function RevealTreatment({ beat, p, local, colors, font }) {
  const el = beat.elements;
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  const revealProgress = EASE(Math.min(1, p / 0.5));

  const trigger = (el.trigger || "").toUpperCase();
  const subject = (el.subject || "").toUpperCase();

  return (
    <div style={{ position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - 80, opacity: 1 - out }}>
      <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 600, fontSize: 28,
        color: colors.accent, opacity: 0.7, marginBottom: 16,
      }}>{trigger}</div>
      <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 800, fontSize: 64,
        color: colors.onGround, letterSpacing: -2,
        clipPath: `inset(0 ${(1 - revealProgress) * 100}% 0 0)`,
      }}>{subject}</div>
      <div style={{
        width: `${revealProgress * 60}%`, height: 6, borderRadius: 3,
        background: colors.accent, marginTop: 24,
      }} />
    </div>
  );
}

/* ── CONSTRAINT: hitting a wall ──────────────────────────────────── */

function ConstraintTreatment({ beat, p, colors, font }) {
  const el = beat.elements;
  const e = EASE(Math.min(1, p / 0.2));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  const push = EASE_IO(Math.min(1, p / 0.6));

  const subject = (el.subject || "").toUpperCase();
  const barW = SAFE_W * 0.7;
  const wallX = barW * 0.75;

  return (
    <div style={{ position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - 60, opacity: (1 - out) * e }}>
      <svg width={barW} height={120}>
        <rect x={push * wallX - 30} y={20} width={60} height={80} rx={8}
          fill={colors.accent} opacity={0.9} />
        <line x1={wallX} y1={0} x2={wallX} y2={120}
          stroke={colors.onGround} strokeWidth={4} strokeDasharray="8 6" opacity={0.4} />
      </svg>
      <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 800, fontSize: 40,
        color: colors.onGround, marginTop: 16, letterSpacing: -1,
      }}>{subject}</div>
      <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 600, fontSize: 24,
        color: colors.onGround, opacity: 0.4, marginTop: 8,
      }}>{el.verb || ""}</div>
    </div>
  );
}

/* ── TRADEOFF: seesaw balance ────────────────────────────────────── */

function TradeoffTreatment({ beat, p, colors, font }) {
  const el = beat.elements;
  const e = EASE(Math.min(1, p / 0.25));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  const tilt = EASE_IO(Math.min(1, p / 0.7)) * 12;

  const subject = (el.subject || "").toUpperCase();

  return (
    <div style={{ position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - 60, opacity: (1 - out) * e, textAlign: "center" }}>
      <svg width={SAFE_W * 0.7} height={100} style={{ margin: "0 auto", display: "block" }}>
        <g transform={`rotate(${tilt} ${SAFE_W * 0.35} 50)`}>
          <line x1={40} y1={50} x2={SAFE_W * 0.7 - 40} y2={50}
            stroke={colors.onGround} strokeWidth={4} />
          <circle cx={80} cy={50} r={24} fill={colors.accent} />
          <circle cx={SAFE_W * 0.7 - 80} cy={50} r={24} fill={colors.onGround} opacity={0.3} />
        </g>
        <line x1={SAFE_W * 0.35} y1={50} x2={SAFE_W * 0.35} y2={100}
          stroke={colors.onGround} strokeWidth={4} />
      </svg>
      <div style={{
        fontFamily: `${font}, sans-serif`, fontWeight: 800, fontSize: 40,
        color: colors.onGround, marginTop: 20, letterSpacing: -1,
      }}>{subject}</div>
    </div>
  );
}

/* ── Treatment router ────────────────────────────────────────────── */

const TREATMENT_COMPONENTS = {
  STATEMENT: StatementTreatment,
  QUANTITY: QuantityTreatment,
  EROSION: ErosionTreatment,
  DEPLETION: ErosionTreatment,
  GROWTH: GrowthTreatment,
  VERSUS: VersusTreatment,
  PROPORTION: ProportionTreatment,
  CAUSE_EFFECT: CauseEffectTreatment,
  CHANGE: ChangeTreatment,
  SEQUENCE: SequenceTreatment,
  REVEAL: RevealTreatment,
  CONSTRAINT: ConstraintTreatment,
  TRADEOFF: TradeoffTreatment,
};

export function DirectedScene({ plan }) {
  const frame = useCurrentFrame();
  const colors = paletteRoles(plan.palette);
  const { beat, p, local } = at(plan, frame);

  const Treatment = TREATMENT_COMPONENTS[beat.treatment] || StatementTreatment;
  const showCaption = beat.typography_role !== "primary";

  return (
    <AbsoluteFill style={{ backgroundColor: colors.ground }}>
      <Treatment beat={beat} p={p} local={local} colors={colors} font={plan.fonts.primary} />
      {showCaption && <Caption beat={beat} local={local} colors={colors} font={plan.fonts.secondary || plan.fonts.primary} position="bottom" />}
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
        beats: [{ beat_id: "d0", start_frame: 0, duration_frames: 300, text: "", treatment: "STATEMENT", elements: { type: "statement", emphasis: "", reason: "" }, words: [], typography_role: "primary", transition_in: "CUT" }],
        palette: { primary: ["#1A1A2E", "#16213E", "#F5536B", "#0F0F1A"], secondary: ["#C81E3C", "#8892B0", "#E6E8EC"] },
        fonts: { primary: "DM Sans", secondary: "Noto Serif" },
      },
    },
  },
];
