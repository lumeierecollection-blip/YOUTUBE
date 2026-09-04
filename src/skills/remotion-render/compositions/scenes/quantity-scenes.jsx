import React from "react";
import { useCurrentFrame } from "remotion";
import {
  CANVAS_W, CANVAS_H, STAGE_CX, SAFE, CAPTION_RESERVE_Y, Label, Figure, Rule,
  ease, seeded, useStateProgress, useValueProgress, EASE_OUT, EASE_IN_OUT,
} from "./primitives.jsx";
import { progressOf, reached } from "../../visual/states.js";
import { shotFrame } from "./stage.jsx";
import { StackedMass } from "./elements/chart.jsx";
// remocn number treatments — see REMOCN-COMPONENTS.md for the per-page
// verified install command behind each of these four.
import { RollingNumber } from "../../components/remocn/rolling-number";
import { NumberWheel } from "../../components/remocn/number-wheel";
import { SlotMachineRoll } from "../../components/remocn/slot-machine-roll";
import { MatrixDecode } from "../../components/remocn/matrix-decode";

/**
 * Quantity scenes — the four ways this renderer explains a NUMBER.
 *
 * PART 6 is the whole reason this file exists: `HERO_NUMBER` used to mean
 * "giant numeral, unit underneath, caption below". A magnitude now has to
 * pick the concept it lives inside:
 *
 *   many small -> one total          AccumulationScene
 *   one value  -> another value      TransformationScene
 *   this one   vs that one           ComparisonScene / DataChartScene
 *   how big is it, really            ScaleComparisonScene
 *
 * Every counter in this file is positioned as a LABEL on a drawn quantity,
 * never centred as the composition.
 */

/**
 * Currency handling. `unit` arrives either as a symbol (from "$500") or as
 * the spoken word (from "five hundred dollars"), because scripts are
 * written to be read aloud. Both have to produce the same rendered figure.
 */
function isMoney(unit) {
  return /[$£€]/.test(String(unit || "")) || /dollar|pound|euro|cent|usd|gbp/i.test(String(unit || ""));
}
/** A value formatter that respects the unit, for use as Figure's `format`. */
function figureFormat(unit) {
  const sym = currencySymbol(unit);
  const pct = /%|percent/i.test(String(unit || ""));
  return (v) => `${sym}${Math.round(v).toLocaleString("en-US")}${pct ? "%" : ""}`;
}

function currencySymbol(unit) {
  const u = String(unit || "");
  const sym = u.match(/[$£€]/);
  if (sym) return sym[0];
  if (/pound|gbp/i.test(u)) return "£";
  if (/euro/i.test(u)) return "€";
  if (/dollar|cent|usd/i.test(u)) return "$";
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// NUMBER TREATMENTS — how a figure ARRIVES at its value.
//
// The settle-in that already lived in this file is `Figure` with a progress
// `p`: the value counts up through its formatter and lands. That stays the
// default and is untouched — every existing call site keeps its exact
// behaviour, because a beat with no declared treatment renders the same
// pixels it did before.
//
// These four are alternatives, from the remocn registry, installed and
// verified per-component against their own doc pages (see
// REMOCN-COMPONENTS.md for each install command and the diff against the
// registry source). They are wired here rather than in primitives.jsx
// because choosing a treatment is a QUANTITY-SCENE decision; `Figure` stays
// a dumb positioned numeral.
//
// Selection is deterministic. `beat.visualPlan.numberTreatment` names one
// explicitly when the director asks for it; otherwise a beat keeps the
// settle-in default. Nothing is chosen at random, so a re-render of the same
// beat produces the same treatment.
//
// All four take just a value or a string and render only the digits, so the
// surrounding layout — position, unit, halo, alignment — is still this
// file's job, exactly as with `Figure`.
// ─────────────────────────────────────────────────────────────────────────────

export const NUMBER_TREATMENTS = ["settle", "rolling", "number-wheel", "slot-machine", "matrix-decode"];

/**
 * Which treatment this beat asked for. Unknown or absent → "settle", so a
 * typo in a plan degrades to the existing behaviour instead of rendering
 * nothing.
 */
export function numberTreatmentOf(beat) {
  const asked = beat && beat.visualPlan && beat.visualPlan.numberTreatment;
  return NUMBER_TREATMENTS.includes(asked) ? asked : "settle";
}

/**
 * A figure with a treatment. Drop-in for `Figure`: same positioning props,
 * same unit rendering, same halo. Only the digits' arrival differs.
 */
export function TreatedFigure({
  x, y, value, unit = "", p = 1, color, size = 64, fontFamily, align = "left", format, halo = null,
  treatment = "settle",
}) {
  if (treatment === "settle") {
    return (
      <Figure x={x} y={y} value={value} unit={unit} p={p} color={color} size={size}
        fontFamily={fontFamily} align={align} format={format} halo={halo} />
    );
  }
  const fmt = typeof format === "function" ? format : (v) => Math.round(v).toLocaleString("en-US");
  const shell = {
    position: "absolute", left: x, top: y, color, fontFamily,
    textShadow: halo ? `0 0 12px ${halo}, 0 0 7px ${halo}, 0 0 4px ${halo}` : undefined,
    transform: align === "center" ? "translateX(-50%)" : align === "right" ? "translateX(-100%)" : "none",
    display: "flex", alignItems: "baseline", gap: size * 0.1,
  };
  let digits = null;
  if (treatment === "rolling") {
    digits = <RollingNumber from={0} to={value} fontSize={size} color={color} />;
  } else if (treatment === "number-wheel") {
    digits = <NumberWheel from={0} to={value} fontSize={size} color={color} />;
  } else if (treatment === "slot-machine") {
    digits = <SlotMachineRoll from={fmt(0, value)} to={fmt(value, value)} fontSize={size} color={color} fontWeight={800} />;
  } else if (treatment === "matrix-decode") {
    digits = <MatrixDecode text={String(fmt(value, value))} fontSize={size} color={color} fontWeight={800} />;
  }
  /**
   * A rendered frame caught a real integration bug here: RollingNumber,
   * NumberWheel and MatrixDecode are each built on Remotion's
   * `AbsoluteFill` (`position:absolute; inset:0`, filling the nearest
   * positioned ancestor) — correct for each as a standalone component,
   * per their own doc pages. But `shell` below is an unsized flex row, so
   * its only IN-FLOW child was the `unit` span, and `shell` shrank to
   * fit just that. The absolutely-positioned digits then filled that
   * tiny box and, being a POSITIONED element, painted ON TOP of the
   * `unit` span regardless of JSX order (position:absolute always paints
   * above position:static siblings) — a beat with a unit (SCALE_
   * COMPARISON's "%", ACCUMULATION's currency) rendered the digits with
   * the unit invisibly buried underneath. `digitBox` below gives the
   * fill-based treatments a real, estimated-from-the-string size to fill
   * instead of a collapsed one; `position: relative` on both children
   * makes them both POSITIONED, so DOM order (unit after digits) decides
   * paint order and the unit stacks visibly on top.
   */
  const digitsText = String(fmt(value, value));
  const digitBox = { position: "relative", width: digitsText.length * size * 0.62, height: size * 1.3 };
  return (
    <div style={shell}>
      <div style={digitBox}>{digits}</div>
      {unit ? <span style={{ position: "relative", fontSize: size * 0.42, fontWeight: 700 }}>{unit}</span> : null}
    </div>
  );
}

// DataGauge/ValueGauge/gaugeFits are deleted. Pulling DataGauge in — because
// it was the one lifeprompt DataAnimations component that took a real value —
// was reaching for an available component rather than asking what a specific
// beat needed: it rendered floating in empty space with no ground under it,
// and ScaleComparisonScene below no longer needs a second treatment branch at
// all. See CHECK-REGISTER and this file's ScaleComparisonScene for what
// replaced it.

// ─────────────────────────────────────────────────────────────────────────────
// ACCUMULATION — many small things becoming one consequential total.
// "Twenty small purchases quietly became $500."
// ─────────────────────────────────────────────────────────────────────────────
export function AccumulationScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};

  const total = Number.isFinite(sup.total) ? sup.total : (Number.isFinite(sup.value) ? sup.value : 0);
  const count = Math.max(1, Math.round(sup.count || 0));
  const symbol = currencySymbol(sup.unit);
  const unit = isMoney(sup.unit) ? "" : String(sup.unit || "");

  /**
   * THE PILE AND THE LEDGER ARE BOTH GONE.
   *
   * This used to drop `count` discrete rectangles into a tray (or, in the
   * ledger variant, stack them as rows down a rule) — deterministic jitter,
   * real container sizing, a lean toward the result figure on collapse, all
   * built across several passes (PART 13, PART 15) to make a heap of
   * identical boxes read as "real" rather than "a spreadsheet." None of that
   * effort changes what a muted viewer sees: identical rectangular units,
   * stacked, one of them optionally carrying a currency glyph — "money as
   * stacked identical rectangles," named directly on this rebuild's deletion
   * list. Polishing the box is not the fix; the box is the problem.
   *
   * ACCUMULATION's actual claim is arithmetic: many small amounts summed
   * into one total. The most literal, least invented way to show a sum
   * arriving is the sum itself arriving — the total counting up on screen,
   * using the number-treatment machinery this file already has (settle's
   * own frame-driven, clamped-[0,1] multiply in Figure, or one of the
   * remocn roll treatments' own from-0-to-value animation). No metaphor
   * object stands between the claim and the number; the number IS the
   * object, and its own arrival is the accumulation.
   */
  const pGrow = progressOf(states, "accumulate", frame);
  const pTotal = useStateProgress(states, "total");
  const collapsed = reached(states, "total", frame);
  const g = collapsed ? 1 : ease(pGrow, EASE_IN_OUT);

  // Camera earned per beat from its own seed (PART 4) — a result this size
  // can honestly take a slight push as it settles, but not on every beat,
  // or "push on settle" just becomes the next universal formula.
  const camera = seeded((beat.startFrame || 1) * 5 + 3);
  const cameraScale = camera < 0.4 ? 1 : 1 + 0.05 * ease(pTotal, EASE_IN_OUT);

  // GROUNDED and COLUMNAR (composition.js's two real framings for this
  // strategy) place the subject at genuinely different anchors and
  // coverage — GROUNDED sits high and wide, COLUMNAR sits lower and
  // narrower, the frame carrying more headroom above the total. The
  // number's own position and scale come from that shot, not a fixed
  // centre point, so the strategy's two declared variants are two actual
  // compositions rather than one shot with a coat of paint (the
  // composition-variants check this file used to fail before this).
  const f = shotFrame(plan.shot || null);
  const shotScale = plan.shot ? Math.min(1.15, Math.max(0.85, (plan.shot.coverage || 0.9) / 0.9)) : 1;
  const scale = cameraScale * shotScale;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: f.cx, top: f.cy, transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})` }}>
        <TreatedFigure treatment={numberTreatmentOf(beat)}
          x={0} y={0}
          value={total} unit={unit} p={g} color={colors.accent}
          size={110} align="center" fontFamily={fontFamily}
          format={(v) => `${symbol}${Math.round(v).toLocaleString("en-US")}`}
        />
        {/* Only label a count the script actually stated (supporting.countKnown)
            — the real fact behind the sum, not an invented denominator. */}
        {sup.countKnown ? (
          <Label
            x={0} y={96}
            text={`FROM ${count} SEPARATE AMOUNTS`}
            color={colors.textDim} size={24} tracking={2.6} align="center"
            opacity={ease(pTotal, EASE_IN_OUT)} fontFamily={fontFamily}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORMATION — a value becoming another, with the mechanism visible.
// "Debt increased from $10,000 to $18,000."
// ─────────────────────────────────────────────────────────────────────────────
export function TransformationScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const f = shotFrame(plan.shot || null);

  const from = Number.isFinite(sup.from) ? sup.from : 0;
  const to = Number.isFinite(sup.to) ? sup.to : from;
  const rising = to >= from;
  const unit = String(sup.unit || "");
  const symbol = currencySymbol(unit);
  const labels = Array.isArray(sup.labels) ? sup.labels : null;

  const pEst = useStateProgress(states, "establish");
  const pPressure = useStateProgress(states, "pressure");
  const pGrow = progressOf(states, "grow", frame);
  const pSettle = useStateProgress(states, "settle");

  const x0 = f.x + f.w * 0.12;
  const x1 = f.x + f.w * 0.88;
  const baseY = f.cy + f.h * 0.42;
  const topY = f.cy - f.h * 0.34;
  const span = x1 - x0;
  const g = ease(pGrow, EASE_IN_OUT);
  const current = from + (to - from) * g;

  const yFor = (v) => {
    const lo = Math.min(from, to) * 0.82;
    const hi = Math.max(from, to) * 1.06 || 1;
    return baseY - ((v - lo) / (hi - lo || 1)) * (baseY - topY);
  };

  // The plotted path, sampled — a real curve of the value over the span.
  const pts = [];
  const steps = 44;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (t > g) break;
    // Compounding curves; a linear move stays straight.
    const shaped = Math.pow(t, rising ? 1.55 : 0.75);
    pts.push([x0 + span * t, yFor(from + (to - from) * shaped)]);
  }
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const head = pts.length ? pts[pts.length - 1] : [x0, yFor(from)];

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Baseline + the starting level, held as a reference all the way through */}
      <Rule x={x0} y={baseY} w={span} p={pEst} color={colors.stroke} thickness={2} />
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <line x1={x0} y1={yFor(from)} x2={x0 + span * ease(pEst)} y2={yFor(from)}
          stroke={colors.stroke} strokeWidth={1.5} strokeDasharray="7 9" opacity={0.6} />

        {/* The force acting on the value — repeated pressure marks, one per
            interval. This is the "mechanism" half of a transformation:
            without it the viewer sees a line move for no reason. */}
        {pPressure > 0
          ? Array.from({ length: 6 }).map((_, i) => {
              const t = (i + 1) / 7;
              const a = ease(Math.max(0, Math.min(1, pPressure * 2 - i * 0.16)));
              if (a <= 0.01) return null;
              const px = x0 + span * t;
              return (
                <g key={i} opacity={a * 0.85}>
                  <line x1={px} y1={yFor(from) + 6} x2={px} y2={yFor(from) - 26} stroke={colors.accent} strokeWidth={2} />
                  <polygon
                    points={`${px - 5},${yFor(from) - 24} ${px + 5},${yFor(from) - 24} ${px},${yFor(from) - 36}`}
                    fill={colors.accent}
                  />
                </g>
              );
            })
          : null}

        {/* The change ITSELF, as area — not just a line reporting the value.
            A 4px path measured 0.6% ink and answered "what value" without
            answering "how much changed". Closing the path back to the
            starting level and filling it makes the accumulated change a
            real shape: it grows exactly as fast as the plotted curve does,
            because it is bounded by the same points. */}
        {pts.length > 1 ? (
          <path
            d={`${d} L ${head[0].toFixed(1)} ${yFor(from).toFixed(1)} L ${x0} ${yFor(from).toFixed(1)} Z`}
            fill={colors.accent} fillOpacity={0.15} stroke="none"
          />
        ) : null}
        {pts.length > 1 ? <path d={d} fill="none" stroke={colors.accent} strokeWidth={4} /> : null}
        {/* MorphShape — a rounded rectangle interpolating its own height and
            corner radius — is gone. The reasoning behind it ("the object
            itself should change") was sound, but the object doing the
            changing is the CURVE, which already plots the real value at
            every frame; the rect riding its head was a second invented
            object marking a point the curve and the adjacent figure both
            already mark. A plain point ON the real plotted line is the
            literal marker a line chart actually uses, not a shape standing
            in for the value beside it. */}
        {pGrow > 0 ? (
          <circle cx={head[0]} cy={head[1]} r={7 + 3 * ease(pGrow)} fill={colors.accent} />
        ) : null}

        {/* The gap between where it started and where it ended */}
        {pSettle > 0 ? (
          <line
            x1={x1} y1={yFor(from)} x2={x1} y2={yFor(from) + (yFor(to) - yFor(from)) * ease(pSettle)}
            stroke={colors.accent} strokeWidth={2} strokeDasharray="5 5"
          />
        ) : null}
      </svg>

      <TreatedFigure treatment={numberTreatmentOf(beat)} x={x0} y={yFor(from) + 16} value={from} p={pEst} color={colors.textDim} size={38}
        fontFamily={fontFamily} format={(v) => `${symbol}${Math.round(v).toLocaleString("en-US")}`} />
      {labels && labels[0] ? (
        <Label x={x0} y={baseY + 20} text={String(labels[0]).toUpperCase()} color={colors.textDim} size={24} tracking={2.2} opacity={pEst} fontFamily={fontFamily} />
      ) : null}

      {pGrow > 0 ? (
        <TreatedFigure treatment={numberTreatmentOf(beat)} x={head[0] + 18} y={head[1] - 26} value={current} p={1} color={colors.accent} size={46}
          fontFamily={fontFamily} format={(v) => `${symbol}${Math.round(v).toLocaleString("en-US")}`} />
      ) : null}
      {labels && labels[1] ? (
        <Label x={x1} y={baseY + 20} text={String(labels[1]).toUpperCase()} color={colors.textDim} size={24} tracking={2.2} align="right" opacity={pSettle} fontFamily={fontFamily} />
      ) : null}

      {pSettle > 0 && to !== from ? (
        <Label
          x={x1 + 14} y={(yFor(from) + yFor(to)) / 2 - 14}
          text={`${rising ? "+" : "-"}${symbol}${Math.abs(Math.round(to - from)).toLocaleString("en-US")}`}
          color={colors.accent} size={30} tracking={0.5} opacity={pSettle} fontFamily={fontFamily}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPARISON — two quantities measured against each other, in proportion.
// Distinct from DataChartScene: this is a HEAD-TO-HEAD of two things, drawn
// as opposing masses, not a series plotted on a shared axis.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Glyph-width estimate for the clamp below (Label/Figure have no measurement
 * pass, so width has to be estimated from the string).
 *
 * MEASURED, NOT INHERITED. This started at 0.56 — the value
 * structure-scenes.jsx uses for its uppercase labels — and the frame-bounds
 * gate caught the consequence on a real render: "$340" at `maxSize` (128px)
 * measured 338px of actual ink, a ratio of 0.660, so a clamp built on 0.56
 * under-reserved by ~18% and let the figure land at x=17 against a
 * SAFE.left of 48. `Figure` sets fontWeight 800 with tabular-nums, which is
 * simply wider per glyph than the tracked uppercase labels 0.56 was fitted
 * to; the same number cannot serve both. 0.70 keeps headroom over the
 * measured 0.660, and over-reserving is the safe direction here — it only
 * ever pulls a figure further inside the frame.
 */
const COMPARISON_GLYPH_W = 0.70;
// The label drawn under each figure, as actually passed to <Label> below.
const LABEL_SIZE = 24;
const LABEL_TRACKING = 2.2;
export function ComparisonScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const f = shotFrame(plan.shot || null);
  const series = (sup.series || []).slice(0, 2);

  // Two opposed POSITIONS rather than two magnitudes. Same concept (X set
  // against Y), rendered in the register the evidence supports — the
  // alternative would be inventing bar values for a sentence that never
  // stated any.
  if (sup.qualitative && series.length < 2) {
    return <OppositionComparison beat={beat} sup={sup} states={states} f={f} colors={colors} fontFamily={fontFamily} />;
  }
  if (series.length < 2) return null;

  const [a, b] = series;
  const max = Math.max(Math.abs(a.value), Math.abs(b.value)) || 1;

  const pLeft = useStateProgress(states, "left");
  const pRight = useStateProgress(states, "right");
  const pGap = useStateProgress(states, "gap");
  const pVerdict = useStateProgress(states, "verdict");

  const fmt = figureFormat(sup.unit);
  const cx = f.cx;
  const halfSpan = f.w * 0.28;
  const winner = Math.abs(a.value) >= Math.abs(b.value) ? "a" : "b";

  /**
   * THE SEESAW IS GONE.
   *
   * BalanceBeam (elements/balance.jsx) drew a fulcrum, a tilting beam and
   * two hanging pans, tilt driven by the real value delta — the geometry
   * was earnest, but cold on a rendered frame it is still "comparison
   * illustrated as a seesaw," named directly on the deletion list. The
   * apparatus was never the evidence; `a.value` and `b.value` were.
   *
   * So the apparatus is gone and the two real numbers carry the comparison
   * directly, through their own typographic size — same principle as
   * ScaleComparisonScene's rewrite: a bigger number IS bigger, not a bigger
   * number NEXT TO a bar that says so. `winner`'s figure lands in the
   * channel accent once both have settled; that is the only ornament.
   */
  const baseSize = 56, maxSize = 128;
  const sizeFor = (v) => baseSize + (maxSize - baseSize) * (Math.abs(v) / max);
  const cy = f.cy;

  /**
   * BOTH FIGURES ARE SCALED DOWN UNTIL THE PAIR FITS. THEY NEVER OVERLAP.
   *
   * Sizing each figure from its own magnitude, then clamping each into
   * SAFE independently, can demand more width than SAFE has — and the
   * clamp's only remaining move was to pull the two centres together until
   * they collided. A rendered frame showed exactly that: "215" printed
   * through "13,600", with "AVALANCHE DEBATE" and "CHOOSING COSTS"
   * overlapping under them. Two numbers on top of each other are less
   * readable than two smaller numbers side by side, and the whole point of
   * this scene is that the reader can compare them.
   *
   * So the pair is measured first and scaled to fit as a unit. The RATIO
   * between the two sizes is preserved, which is what carries the
   * comparison — shrinking both by the same factor keeps "this one is much
   * bigger" exactly as true, it just says it at a size the frame has room
   * for. The frame-bounds gate cannot catch this case (overlap is not an
   * out-of-frame violation), so it is handled here by construction rather
   * than left to be found on a later render.
   */
  const GAP = 24;
  const fitScale = (() => {
    const wOf = (s, size) => {
      const fig = String(fmt(s.value)).length * size * COMPARISON_GLYPH_W;
      const lab = String(s.label || "").toUpperCase().slice(0, 18);
      return Math.max(fig, lab ? lab.length * (LABEL_SIZE * COMPARISON_GLYPH_W + LABEL_TRACKING) : 0);
    };
    const need = wOf(a, sizeFor(a.value)) + wOf(b, sizeFor(b.value)) + GAP;
    const have = SAFE.right - SAFE.left;
    // Only ever shrinks. A pair that already fits is untouched.
    return need > have ? have / need : 1;
  })();
  const sizeA = sizeFor(a.value) * fitScale;
  const sizeB = sizeFor(b.value) * fitScale;

  /**
   * CLAMPED INTO THE SAFE RECT, NOT JUST SPACED FROM THE CENTRE.
   *
   * A rendered frame caught the actual defect this glyph-count estimate
   * (same technique structure-scenes.jsx already uses for TimelineScene's
   * event label and CircuitProcess's claim) exists to prevent: on
   * HORIZON framing (coverage 0.96, bleed) a `halfSpan` of `f.w * 0.28`
   * put the larger figure's centre at x=857 of a 1080-wide canvas, and at
   * `maxSize` (128px) a 6-digit value like "13,600" is ~430px wide — its
   * right half alone ran past the canvas edge, past even SAFE.right.
   * Each side is now clamped so ITS OWN text, at ITS OWN size, stays
   * inside SAFE — magnitude can make one figure much bigger than the
   * other, but never bigger than the frame has room for.
   */
  const halfTextW = (text, size) => (String(text).length * size * COMPARISON_GLYPH_W) / 2;
  /**
   * RESERVE FOR THE WIDEST THING DRAWN AT THIS x, NOT JUST THE FIGURE.
   *
   * Each side draws a figure AND a label under it, both centred on the same
   * x. Clamping on the figure alone leaves a long label free to overhang —
   * and at the small end (`baseSize` 56, e.g. "$0" = 2 glyphs) an 18-char
   * label is comfortably the wider of the two. Whichever is wider is what
   * the margin has to hold.
   */
  const labelOf = (s) => String(s.label || "").toUpperCase().slice(0, 18);
  // The label shrinks with the pair too. Scaling only the figures would
  // leave a label-dominated pair (a short value under a long name) still
  // wider than SAFE, which is the same collision by another route.
  const labelSize = LABEL_SIZE * fitScale;
  const halfLabelW = (s) => {
    const t = labelOf(s);
    return t ? (t.length * (labelSize * COMPARISON_GLYPH_W + LABEL_TRACKING)) / 2 : 0;
  };
  const aHalfW = Math.max(halfTextW(fmt(a.value), sizeA), halfLabelW(a));
  const bHalfW = Math.max(halfTextW(fmt(b.value), sizeB), halfLabelW(b));
  const gap = GAP;
  // The most the two centres can be pushed apart while BOTH texts still
  // land inside SAFE — the hard ceiling. Below that, spread them enough
  // that the two texts don't overlap each other; when even SAFE itself
  // isn't wide enough for both at a comfortable gap, staying inside SAFE
  // wins (Math.min is outermost) over the two texts touching.
  const safeBound = Math.min(cx - SAFE.left - aHalfW, SAFE.right - cx - bHalfW);
  const minHalfSpan = (aHalfW + bHalfW) / 2 + gap;
  const clampedHalfSpan = Math.min(safeBound, Math.max(minHalfSpan, halfSpan));
  const leftX = cx - clampedHalfSpan;
  const rightX = cx + clampedHalfSpan;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: leftX, top: cy, transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <TreatedFigure treatment={numberTreatmentOf(beat)} x={0} y={0} value={a.value} p={pLeft}
          color={pVerdict > 0 && winner === "a" ? colors.accent : colors.textPrimary}
          size={sizeA} align="center" fontFamily={fontFamily} format={fmt} />
        {/* OFFSET ON THE LABEL, NOT A marginTop WRAPPER.
            `Label` renders position:absolute, so it is out of flow and a
            margin on its parent moves nothing — both labels were landing at
            the wrapper origin, printed straight across their own figure
            ("MINIMUM ONLY" through "$340" on a rendered frame). The drop has
            to be the label's own `y`. */}
        <Label x={0} y={sizeA * 1.08} text={labelOf(a)}
          color={colors.textDim} size={labelSize} tracking={LABEL_TRACKING} align="center" opacity={pLeft} fontFamily={fontFamily} />
      </div>

      {/* Driven by `right`, the anchored state, ON PURPOSE — the second
          value has to exist by the frame the contrast is spoken, not just
          the first. */}
      <div style={{ position: "absolute", left: rightX, top: cy, transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <TreatedFigure treatment={numberTreatmentOf(beat)} x={0} y={0} value={b.value} p={pRight}
          color={pVerdict > 0 && winner === "b" ? colors.accent : colors.textPrimary}
          size={sizeB} align="center" fontFamily={fontFamily} format={fmt} />
        <Label x={0} y={sizeB * 1.08} text={labelOf(b)}
          color={colors.textDim} size={labelSize} tracking={LABEL_TRACKING} align="center" opacity={pRight} fontFamily={fontFamily} />
      </div>

      {pGap > 0 ? (
        <Label x={cx} y={cy + Math.max(sizeA, sizeB) * 0.55 + 60}
          text={`${fmt(Math.abs(a.value - b.value))} APART`}
          color={colors.accent} size={26} tracking={1.8} align="center" opacity={pGap} fontFamily={fontFamily} />
      ) : null}
    </div>
  );
}

/**
 * The qualitative register of COMPARISON: two stated positions under load,
 * meeting along a seam. No numbers are shown because none were stated.
 *
 * TWO THINGS WERE WRONG WITH THE FIRST VERSION.
 *
 * The first was fatal and shipped: it read `f.w`, `f.cx` and `f.h` while
 * `f` was never a parameter and never declared anywhere in the module — a
 * guaranteed ReferenceError the moment a qualitative comparison rendered.
 * Nothing caught it. The text-based checks do not model scope, the esbuild
 * parse only proves syntax, the whole-graph bundle treats a free identifier
 * as a global, and no clip I had rendered took this branch. `f` is now
 * passed in from the caller, which already computes it, and
 * `visual/scope-check.js` (VIS-24) exists so the next one cannot ship.
 *
 * The second was that it drew two rounded rectangles with text inside them
 * and a dashed line between: cards. The whole point of this renderer is
 * that a disagreement is not two boxes. COMPARISON's material is FIELD —
 * isolines of a potential — so an opposition is two bodies of pressure
 * meeting along a seam, and the disagreement is the seam FAILING TO LINE
 * UP: the strata on one side do not continue into the other. That is a
 * picture of a disagreement rather than a diagram labelled BUT.
 */
function OppositionComparison({ beat, sup, states, f, colors, fontFamily }) {
  const pLeft = useStateProgress(states, "left");
  // THE SECOND SIDE LANDS ON THE ANCHOR RATHER THAN STARTING THERE.
  //
  // `right` is this strategy's anchored state, so driving the opposing mass
  // from its own progress meant that at the anchor — the frame where the
  // contrast word is spoken — only ONE side existed. A rendered frame of
  // the ch-02 opposition beat showed exactly that: the left mass, the seam,
  // and nothing opposing it.
  //
  // This is safe here and NOT in the quantitative branch above: an
  // opposition prints no figure, so there is no number that could end up
  // contradicting a mass it labels.
  const pRight = useValueProgress(states);
  const pGap = useStateProgress(states, "gap");
  const pVerdict = useStateProgress(states, "verdict");

  const shot = (beat.visualPlan && beat.visualPlan.shot) || null;
  const eLeft = ease(pLeft), eRight = ease(pRight), eGap = ease(pGap), eVerdict = ease(pVerdict);

  // The seam sits where the FRAMING puts the subject, so the two masses are
  // deliberately unequal on the ACTING_LEFT variant and even on HORIZON.
  // That asymmetry is the composition doing work; a seam always at the
  // middle is the thing that makes two uses of a strategy look identical.
  const seamX = f.cx;
  const top = Math.max(SAFE.top + 20, f.cy - f.h * 0.42);
  const bottom = Math.min(SAFE.bottom - CAPTION_RESERVE_Y - 150, f.cy + f.h * 0.42);
  const height = Math.max(160, bottom - top);
  const leftEdge = Math.max(-40, seamX - f.w * 0.62);
  const rightEdge = Math.min(CANVAS_W + 40, seamX + f.w * 0.62);

  // Strata: the same layering on both sides, so the eye reads them as ONE
  // body until the seam displaces. Count is fixed, not derived from any
  // stated quantity — nothing here claims to measure anything.
  //
  // WAS 9 separated HAIRLINES (1.5-3.7px) with real canvas gaps between
  // them — read cold, thin ruled lines in a void, not rock. Real strata are
  // FILLED BANDS with thickness; a stratum drawn as a line is the one
  // metaphor in this file that had a literal, filled, "just draw it"
  // answer sitting unused. Fewer, thicker, filled bands read as a rock face;
  // the same nine hairlines never could, because 3px is 0.28% of the frame
  // width whatever it is staged on (register 3.12.6).
  const STRATA = 6;
  const bandH = height / STRATA;
  // How far the right-hand mass has slipped against the left. This is the
  // disagreement, and it arrives on `gap`.
  const slip = height * 0.075 * eGap;

  const strata = [];
  for (let i = 0; i < STRATA; i++) {
    const t = (i + 0.5) / STRATA;
    const bandTop = top + i * bandH;
    // Left mass establishes on `left`, right on `right` (the anchor), each
    // growing outward from the seam so the seam is the origin of both.
    const lp = ease(Math.max(0, Math.min(1, pLeft * 1.9 - t * 0.5)));
    const rp = ease(Math.max(0, Math.min(1, pRight * 1.9 - t * 0.5)));
    // Alternating tone within one ink, so adjacent bands read as distinct
    // layers of the same rock rather than one flat block.
    const bandTone = 0.2 + (i % 2 === 0 ? 0.09 : 0);
    if (lp > 0.01) {
      const w = (seamX - leftEdge) * lp;
      strata.push(
        <rect key={`l${i}`}
          x={seamX - w} y={bandTop} width={w} height={bandH}
          fill={colors.stroke} fillOpacity={bandTone * (pVerdict > 0 ? 0.45 : 1)} />
      );
      strata.push(
        <line key={`le${i}`} x1={seamX - w} y1={bandTop} x2={seamX} y2={bandTop}
          stroke={colors.stroke} strokeWidth={1} opacity={0.25 * lp} />
      );
    }
    if (rp > 0.01) {
      const w = (rightEdge - seamX) * rp;
      strata.push(
        <rect key={`r${i}`}
          x={seamX} y={bandTop + slip} width={w} height={bandH}
          fill={pVerdict > 0 ? colors.accent : colors.stroke}
          fillOpacity={pVerdict > 0 ? bandTone * 1.7 : bandTone * 1.15} />
      );
      strata.push(
        <line key={`re${i}`} x1={seamX} y1={bandTop + slip} x2={seamX + w} y2={bandTop + slip}
          stroke={pVerdict > 0 ? colors.accent : colors.stroke} strokeWidth={1} opacity={0.3 * rp} />
      );
    }
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {strata}

        {/* THE SEAM. Present from the moment there are two sides — an
            opposition has a boundary before either side is filled in. A
            rendered frame of the old ch-02 opposition beat showed one box
            with four words in it on the anchor, i.e. narration on a
            background, which is exactly the failure this rebuild removes. */}
        <line x1={seamX} y1={top - 30} x2={seamX} y2={top - 30 + (height + 60) * Math.max(eLeft, 0.02)}
          stroke={colors.stroke} strokeWidth={2} opacity={0.5} />

        {/* On `gap` the seam becomes the fault it always was: it thickens,
            takes the accent, and the right mass is already displaced along
            it. Nothing is labelled; the offset IS the disagreement. */}
        {pGap > 0 ? (
          <>
            <line x1={seamX} y1={top - 30} x2={seamX} y2={top - 30 + (height + 60) * eGap}
              stroke={colors.accent} strokeWidth={4} />
            {/* Shear marks where the strata fail to meet — short ticks at
                the offset, the way a slipped fault is actually read. */}
            {Array.from({ length: 4 }).map((_, i) => {
              const y = top + height * (0.2 + i * 0.2) + slip / 2;
              return (
                <line key={`s${i}`} x1={seamX - 16} y1={y} x2={seamX + 16} y2={y - slip * 0.9}
                  stroke={colors.accent} strokeWidth={2} opacity={0.7 * eGap} />
              );
            })}
          </>
        ) : null}

        {/* On `verdict` the right mass encroaches: its strata continue PAST
            the seam into the left mass's ground. One side gives way. */}
        {pVerdict > 0 ? (
          Array.from({ length: 4 }).map((_, i) => {
            const y = top + height * (0.28 + i * 0.16) + slip;
            return (
              <line key={`e${i}`} x1={seamX} y1={y} x2={seamX - f.w * 0.2 * eVerdict} y2={y}
                stroke={colors.accent} strokeWidth={3} opacity={0.85} />
            );
          })
        ) : null}
      </svg>

      {/* Each position sits CLEAR OF its own mass, not inside it.
          A rendered frame had the left mass's strata drawn straight through
          "GOVERNMENT ARGUED / SHORT-TERM LOCATION" — seven rules struck
          through two lines of type — because the copy was placed at the
          same `top` the strata start from. The masses meet in the middle of
          the frame, so the words go above and below them: statement, the
          fault between them, counter-statement, read top to bottom.
          Positioned by their outer edges so a phrase that wraps grows away
          from the strata rather than into them. */}
      <div style={{
        position: "absolute",
        left: Math.max(SAFE.left, seamX - f.w * 0.58), width: Math.max(180, f.w * 0.5),
        bottom: CANVAS_H - (top - 22),
        textAlign: "right", paddingRight: 26,
        color: colors.textPrimary, fontFamily, fontWeight: 700, fontSize: 36, lineHeight: 1.25,
        opacity: eLeft * (pVerdict > 0 ? 0.5 : 1),
      }}>{sup.leftPhrase || ""}</div>

      {pRight > 0 ? (
        <div style={{
          position: "absolute",
          left: Math.min(seamX + 26, SAFE.right - 200), width: Math.max(180, Math.min(f.w * 0.5, SAFE.right - seamX - 26)),
          top: bottom + slip + 26,
          color: colors.textPrimary, fontFamily, fontWeight: 800, fontSize: 38, lineHeight: 1.25,
          opacity: eRight,
          transform: `translateY(${(1 - eRight) * 16}px)`,
        }}>{sup.rightPhrase || ""}</div>
      ) : null}

      {/* The pivot word rides ON the fault, at the offset, where the
          disagreement physically is. One word, not two column headers. */}
      {pGap > 0 ? (
        <Label
          x={seamX} y={top + height * 0.5 + slip / 2 - 16}
          text={String(sup.pivot || "BUT").toUpperCase()}
          color={colors.accent} size={26} weight={800} tracking={3}
          align="center" opacity={eGap} fontFamily={fontFamily} halo={colors.bg} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA_CHART — real series on a zero-origin axis.
// Keeps the honesty rules the register already enforces (ENC-10 zero origin,
// ENC-09 <=5 points, ENC-14 values adjacent to their bar).
// ─────────────────────────────────────────────────────────────────────────────
export function DataChartScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const f = shotFrame(plan.shot || null);
  const series = (sup.series || []).slice(0, 5);
  if (series.length < 2) return null;

  const pAxis = useStateProgress(states, "axis");
  const pBars = progressOf(states, "bars", frame);
  const pHi = useStateProgress(states, "highlight");
  const pRead = useStateProgress(states, "read");

  const chartFmt = figureFormat(sup.unit);
  const max = Math.max(...series.map((s) => Math.abs(s.value))) || 1;
  const axisY = f.cy + f.h * 0.4;
  const x0 = f.x + f.w * 0.14;
  const w = f.w * 0.72;
  const maxH = f.h * 0.74;
  const gap = 26;
  const barW = (w - gap * (series.length - 1)) / series.length;
  const hiIdx = Math.max(series.findIndex((s) => s.highlight), 0);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* ENC-10 — the axis is the zero line, always drawn. */}
      <Rule x={x0} y={axisY} w={w} p={pAxis} color={colors.stroke} thickness={2} />
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {series.map((s, i) => {
          const grow = ease(Math.max(0, Math.min(1, pBars * series.length - i * 0.5)), EASE_OUT);
          const h = (Math.abs(s.value) / max) * maxH * grow;
          const x = x0 + i * (barW + gap);
          const isHi = i === hiIdx && pHi > 0;
          // A stack of discrete counted units (elements/chart.jsx), not a
          // flat rect and not a fake-3D-bevelled block — the
          // highlighted/neutral colour distinction (accent vs ink) is the
          // series' real hierarchy, not a decoration on top of it.
          return (
            <StackedMass key={i} x={x} w={barW} baseY={axisY} h={h} colors={colors}
              color={isHi ? colors.accent : colors.stroke}
              emphasis={isHi ? 1 : 0.5} dim={pHi > 0 && !isHi} />
          );
        })}
      </svg>
      {series.map((s, i) => {
        const grow = ease(Math.max(0, Math.min(1, pBars * series.length - i * 0.5)), EASE_OUT);
        const h = (Math.abs(s.value) / max) * maxH * grow;
        const x = x0 + i * (barW + gap) + barW / 2;
        return (
          <React.Fragment key={i}>
            {/* ENC-14 — the value sits adjacent to ITS bar, not in a legend */}
            <TreatedFigure treatment={numberTreatmentOf(beat)} x={x} y={axisY - h - 50} value={s.value} p={grow}
              color={i === hiIdx && pHi > 0 ? colors.accent : colors.textPrimary}
              size={38} align="center" fontFamily={fontFamily} format={chartFmt} />
            <Label x={x} y={axisY + 18} text={String(s.label || "").toUpperCase().slice(0, 14)}
              color={colors.textDim} size={22} tracking={1.8} align="center"
              opacity={Math.max(pRead, grow)} fontFamily={fontFamily} />
          </React.Fragment>
        );
      })}
      {sup.unit ? (
        <Label x={x0} y={axisY - maxH - 66} text={String(sup.unit).toUpperCase()}
          color={colors.textDim} size={22} tracking={2.4} opacity={pAxis} fontFamily={fontFamily} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCALE_COMPARISON — the last resort for a bare magnitude, and still not a
// naked numeral: the value grows against a reference quantity so the viewer
// sees HOW BIG, not just WHAT.
// ─────────────────────────────────────────────────────────────────────────────
export function ScaleComparisonScene({ beat, colors, fontFamily }) {
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const value = Number.isFinite(sup.value) ? sup.value : 0;
  const unit = String(sup.unit || "");

  // THE INVENTED GAUGE AND THE INVENTED GRID ARE BOTH GONE.
  //
  // director.js only ever computes `value` and `unit` for this strategy
  // (visual/director.js's SCALE_COMPARISON case) — there has never been a
  // real reference quantity to compare against. The deleted code rendered
  // "reference"/"read" states anyway: a 100-square grid filling in against a
  // MeasureBracket, captioned "N% OF THE FIELD" — a phrase invented for the
  // caption, not present in any script. A percentage version of the same
  // idea (DataGauge, lifeprompt) replaced it for a while; that was reaching
  // for an available component rather than asking what THIS beat needs, and
  // it rendered in an empty void with no reference to it either.
  //
  // strategies.js states this strategy's real intent: "how big a number is,
  // against something that gives it size." With no second quantity to set
  // beside it, the only thing that can honestly give a number size is its
  // OWN typographic size — so the number's scale on screen IS the magnitude,
  // not a shape standing in for it. A small number renders small and settles
  // quickly; a large one grows to fill real space and takes longer arriving.
  // `grow` is this strategy's ANCHORED state (strategies.js), so driving
  // size from progress THROUGH `grow` itself put the number at its
  // smallest at frame 0 of `grow` — which IS the anchor frame, the exact
  // moment the narration names the value. A rendered frame caught it: at
  // the anchor, `size` was still near its 40px floor, all but invisible.
  // `useValueProgress` counts from the beat's own first frame and reaches
  // exactly 1 at the anchor instead (primitives.jsx) — the same fix
  // CAUSE_EFFECT's gate and GEOSPATIAL_RADIUS's boundary already use for
  // the identical reason.
  const pGrow = useValueProgress(states);
  const g = ease(pGrow, EASE_IN_OUT);

  // log-scaled so a value of 7 and a value of 13,600 both land somewhere
  // readable on screen instead of one being illegibly tiny or the other
  // blowing past the frame — the comparison is in the RATIO of sizes across
  // a video's beats, not a literal pixels-per-unit mapping.
  const magnitude = Math.log10(Math.max(Math.abs(value), 1) + 1);
  const targetSize = Math.max(96, Math.min(320, 70 + magnitude * 62));
  const size = 40 + (targetSize - 40) * g;

  // Camera: earned per beat from its own seed, not one push applied to every
  // instance of this scene. A number whose whole point is its SIZE is one of
  // the few cases a slow push-in genuinely serves the idea (making it fill
  // more of the frame as it grows); held and a light pull-back are the other
  // two honest readings, so growth alone never becomes the only camera this
  // scene ever gets.
  const camera = seeded((beat.startFrame || 1) * 3 + 1);
  const cameraScale =
    camera < 0.34 ? 1 : camera < 0.67 ? 1 + 0.08 * g : 1.1 - 0.08 * g;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* x/y are 0,0, not STAGE_CX/CANVAS_H/2 — a CSS `transform` (the
          camera scale below) makes this div a containing block for its
          absolutely-positioned Figure, so a non-zero x/y here double-
          offsets against the centring flexbox already did. A rendered
          frame caught this exactly: at STAGE_CX/CANVAS_H/2 the figure
          landed off-canvas, invisible for the beat's entire duration, not
          just at the anchor. Same fix as AccumulationScene's wrapper. */}
      <div style={{ transform: `scale(${cameraScale.toFixed(3)})` }}>
        <TreatedFigure
          treatment={numberTreatmentOf(beat)}
          x={0} y={0}
          value={value} unit={unit}
          p={g} color={colors.accent} size={size} align="center" fontFamily={fontFamily}
        />
      </div>
    </div>
  );
}
