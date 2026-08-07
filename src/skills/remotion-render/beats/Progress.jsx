/**
 * beats/Progress.jsx — the PROGRESS chart motion (audit-motion stage 8,
 * LAYOUT-SYSTEM §8.4 step 6: "beats/Progress.jsx first"). The first beat
 * component: it mounts the same tree the static primitive renders
 * (primitives/Chart.jsx) and animates it.
 *
 *   <Layer rect={…} enter={…} exit={…}>
 *     <Progress chart={rect.chart} colors={colors} unit="%" anchorFrame={tA} />
 *   </Layer>
 *
 * Contract — consumes ONLY the compiler's resolved interior geometry (the
 * `chart` object compile.js chartRect emits: axisY, gridX, barAreaTop, bars[],
 * gutters, highlightIndex, axisLabelRight) plus the beat's timing inputs
 * (`anchorFrame` = the beat-relative anchor token frame tA; `frame` defaults
 * to useCurrentFrame(), exactly like Layer.jsx). Like Chart.jsx, this file
 * NEVER recomputes a coordinate from raw data — every position/width derives
 * from the compiled chart; the wrapping Layer owns position (§4.2).
 *
 * Motion — DETAIL-REFERENCE A4 §PROGRESS (221-236) + MANUAL E3.4/E3.5/F5,
 * on the compiled geometry (frame numbers are beat-relative):
 *   [0,10]   baseline rule DRAW (E.out) — extends left→right, then static
 *            (A5: the axis is a reference frame; it never moves after its draw)
 *   8+3·i    gridline i DRAW 10f each (the live chart has exactly THREE
 *            gridlines at 25/50/75 % of the plot — SFR-motion-5; the A4
 *            draft's fourth start is not in the live geometry)
 *   16       axis label (the unit) RISE — Layer.jsx D2.2 values (offset 24,
 *            E.out; the compiled chart has one axis label — §4 observation 4)
 *   tA−4+7·i bar i GROW — spring {damping:13.9, stiffness:180} (A3.1:
 *            ζ = 13.9/(2·√180) = 0.518, ≈15 % overshoot; EMERGENT duration,
 *            no durationInFrames — A3.4/A3.5; settles ≈21f at Remotion's
 *            0.005 threshold); the bar's bottom stays pinned to the axis at
 *            every frame (L8 by construction, like Chart.jsx)
 *   bar+0    the value counter runs WITH the bar — the SAME spring scalar p
 *            (A2.1, never a second interpolation); raised floor with the
 *            target's digit count (A2.3, ENC-26); separators from frame 0
 *            (A2.4, ENC-28); decimals fixed at compile time by the target's
 *            own precision (A2.5); clamped at the target — it never counts to
 *            a value that isn't in beat.data, and holds there through the
 *            overshoot transient (A2.6)
 *   bar+12   that bar's label RISE (drag 12) — Layer.jsx D2.2 values
 *   hl+24    highlight settle — the highlight bar's fill takes `accent` as a
 *            hard 1-frame switch (L7 one accent per frame; fill ONLY — values
 *            stay textPrimary, borders stay stroke, ENC-15), and the settle
 *            click ui/click_004.ogg at −22 dB fires on that same frame (E4.2,
 *            E4.3 — the frame the visual lands, never on the word)
 *
 * Nothing moves after the accent lands (A4.1 hold; A5 — no perpetual sine on
 * the focal bar, no axis/gridline re-animation, no letter-spacing/weight/
 * radius animation). DOM order below IS the E3.4 construction order and the
 * tree is identical to Chart.jsx's at rest; the `data-*` attributes are
 * measurement hooks for the Tier-2 probe (data/audit/8) with zero layout
 * effect.
 *
 * Honesty (LAYOUT-SYSTEM §8.3): ZERO raw layout coordinates — no 48/88/432/
 * 896/840/1920-style px literals anywhere. Every bare integer is a frame
 * count (the A4 table); every other number is a named constant, mirrored
 * verbatim from Chart.jsx (BAR_RADIUS 8, STROKE 2, BASELINE_STROKE 4,
 * GRID_OPACITY 0.3, VALUE_GAP 8, BAR_LABEL_TOP 16, AXIS_LABEL_GAP 12) or
 * Layer.jsx (RISE_OFFSET 24, E_OUT), or taken from the A2/A3/A4/E4 tables
 * (SPRING_CONFIG, DECADE, DRAW_END, CLICK_DB). Typography values (weights,
 * tracking, line-height) mirror Chart.jsx verbatim.
 */

import React from "react";
import {
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { D, MG_TYPE } from "../compositions/beats.js";

// ── Mirrored from the static primitive (Chart.jsx:48-67) — verbatim values,
//    so the animated tree and the static tree are identical at rest.
//    Chart.jsx does not export these (and is another lane's file).
const BAR_RADIUS = 8; // A5.3 bar-top radius set
const STROKE = 2; // bar border + gridline stroke width
const BASELINE_STROKE = 4; // axis rule width (mg.jsx:753)
const GRID_LINES = [0.25, 0.5, 0.75]; // 25/50/75 % of the plot height
const GRID_OPACITY = 0.3;
const VALUE_GAP = 8; // value clearance from the bar top (ENC-14)
const BAR_LABEL_TOP = 16; // label clearance below the axis
const AXIS_LABEL_GAP = 12; // L10 — label right edge = gridX − 12
const VALUE_MIN_BAR = MG_TYPE.value + 2 * VALUE_GAP; // tall enough to hold its value

// ── Mirrored from layers/Layer.jsx (D2.2) — the same easing and RISE offset,
//    so the beat's rises are numerically identical to Layer's.
const E_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const RISE_OFFSET = 24;

// ── A4 §PROGRESS frame table (DETAIL-REFERENCE.md A4 221-236). Every bare
//    integer here is a frame count — the only kind §8.3 allows bare.
const BASELINE_DRAW_FRAMES = 10;
const GRIDLINE_START = 8;
const GRIDLINE_DRAW_FRAMES = 10;
const GRIDLINE_STAGGER = 3;
const AXIS_LABEL_AT = 16;
const GROW_STAGGER = 7; // FINISH-SPEC R4.1: 7f on a ~20f grow = 0.35 ratio
const LABEL_DRAG = 12; // bar+12 — that bar's label RISE (drag 12)
const ACCENT_AT = 24; // highlight settle = highlightStart + 24 (mg.jsx:765)

// ── A3.1 chart-grow spring — ζ = 13.9/(2·√180) = 0.518, ≈15 % overshoot.
//    EMERGENT duration (A3.4/A3.5 — no durationInFrames; the A4 table's
//    "~20" is the measured natural settle at Remotion's 0.005 threshold).
const SPRING_CONFIG = { damping: 13.9, stiffness: 180 };

// ── A2.3/A2.4 — the decimal-base digit floor and the full-draw percent.
const DECADE = 10; // 10^(digits−1): the raised floor's base (A2.3)
const DRAW_END = 100; // percent — a drawn line's full width at rest

// ── E4.2 — the settle click, vendored + license-clear, −22 dB.
const CLICK_DB = -22;
const CLICK_FILE = "sfx/ui/click_004.ogg";

/** interpolate with mandatory easing + both clamps (Rule 1.5 / D1.1-D1.2) —
 *  mirrors layers/Layer.jsx:95-101. */
function ease(frame, inputRange, outputRange) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E_OUT,
  });
}

/** Chart.jsx fmtValue mirror (Chart.jsx:71-75) — the rest-state formatting
 *  the counter must match exactly (integers exact, ≤1 decimal otherwise). */
function fmtValue(v) {
  if (!Number.isFinite(v)) return "0";
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/**
 * A2 counter text — one scalar, one interpolation:
 *   A2.1  same spring scalar p as the bar height (the caller passes it);
 *   A2.3  raised floor with the target's digit count — 10^(digits−1) when the
 *         value is ≥ DECADE, else 0 — so the formatted length never changes
 *         mid-count (ENC-26);
 *   A2.4  every intermediate value goes through fmtValue (thousands
 *         separators from frame 0, ENC-28);
 *   A2.5  the decimal place is fixed at compile time by the TARGET's own
 *         precision (integers count whole numbers; others to 1 decimal, the
 *         same ceiling as fmtValue);
 *   A2.6  clamped at the target — the counter never reads a value that is not
 *         in beat.data, and holds at it through the 15 % overshoot transient
 *         (the bar still overshoots per A3.1 — the counter does not follow).
 * At p = 1 the result is exactly Chart.jsx fmtValue(bar.value).
 */
function counterText(value, p) {
  const digits = String(Math.abs(Math.trunc(value))).length;
  const floor = value >= DECADE ? DECADE ** (digits - 1) : 0;
  const shown = Math.min(value, floor + (value - floor) * p);
  const rounded = Number.isInteger(value)
    ? Math.round(shown)
    : Math.round(shown * DECADE) / DECADE;
  return fmtValue(rounded);
}

/** E4.2 gain — matches the live renderer (motion-graphics.jsx:116). */
function dbToVolume(db) {
  return Math.pow(DECADE, db / 20);
}

/**
 * @param {object} props
 * @param {object} props.chart        compiled chart object (compile.js chartRect)
 * @param {object} props.colors       palette roles (paletteFromHues keys)
 * @param {string} [props.unit]       axis-label text (spec content.unit)
 * @param {number} [props.anchorFrame] beat-relative anchor token frame (tA) —
 *                                    default 0 (bars grow from frame 0)
 * @param {number} [props.frame]      beat-relative frame (default useCurrentFrame)
 */
export function Progress({ chart, colors, unit, anchorFrame = 0, frame: frameProp, ...rest }) {
  const frame = frameProp ?? useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!chart || !Array.isArray(chart.bars)) return null;

  const plotH = chart.axisY - chart.barAreaTop; // compiled — never recomputed
  const tA = Math.max(anchorFrame, 0);
  const growStart = (i) => Math.max(tA - D.micro, 0) + i * GROW_STAGGER;
  const highlightStart = chart.highlightIndex >= 0 ? growStart(chart.highlightIndex) : -1;
  const accentAt = highlightStart >= 0 ? highlightStart + ACCENT_AT : -1;
  const accentOn = accentAt >= 0 && frame >= accentAt;

  // A4 construction rows — baseline, gridlines, axis label.
  const baselineP = ease(frame, [0, BASELINE_DRAW_FRAMES], [0, 1]);
  const gridlineP = (i) =>
    ease(frame - (GRIDLINE_START + i * GRIDLINE_STAGGER), [0, GRIDLINE_DRAW_FRAMES], [0, 1]);
  const axisLabelP = ease(frame - AXIS_LABEL_AT, [0, D.base], [0, 1]);
  const axisLabelOpacity = ease(frame - AXIS_LABEL_AT, [0, D.short], [0, 1]);

  return (
    <div
      {...rest}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "visible",
      }}
    >
      {/* E3.4 order 1 — the baseline rule DRAWs [0,10] (extends left→right like
          the legacy mg.jsx:745-758, on the compiled axis at the box bottom). */}
      <div
        data-role="baseline"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: BASELINE_STROKE,
          width: `${DRAW_END * baselineP}%`,
          backgroundColor: colors.stroke,
        }}
      />

      {/* E3.4 order 2 — horizontal gridlines at 25/50/75 % of the plot, DRAW
          10f each from 8+3·i (the live chart has exactly three — SFR-motion-5). */}
      {GRID_LINES.map((g, i) => (
        <div
          key={g}
          data-role="gridline"
          style={{
            position: "absolute",
            left: 0,
            top: plotH * g,
            height: STROKE,
            width: `${DRAW_END * gridlineP(i)}%`,
            backgroundColor: colors.stroke,
            opacity: GRID_OPACITY,
          }}
        />
      ))}

      {/* E3.4 order 3 — the axis label (the unit). RISE at 16 (D2.2 values:
          translateY +24 → 0 over D.base, opacity 0 → 1 over D.short, E.out).
          Placement identical to Chart.jsx — right edge exactly 12 px left of
          the gridline (L10), vertically centred on the plot (E3.5). */}
      {unit ? (
        <div
          data-role="axis-label"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: `calc(100% + ${AXIS_LABEL_GAP}px)`,
            display: "flex",
            alignItems: "center",
            opacity: axisLabelOpacity,
            translate: `0px ${RISE_OFFSET * (1 - axisLabelP)}px`,
          }}
        >
          <span
            style={{
              fontSize: MG_TYPE.label,
              fontWeight: 700,
              letterSpacing: 2,
              color: colors.textDim,
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {unit}
          </span>
        </div>
      ) : null}

      {/* E3.4 order 4 — bars. Each bar GROWs (bottom pinned to the axis — L8
          holds at every frame, by construction), its value counts with the
          SAME spring scalar p (A2.1), and its label RISEs at bar+12. The
          highlight bar's fill takes accent as a 1-frame switch at hl+24 (L7;
          fill only — ENC-15). */}
      {chart.bars.map((bar, i) => {
        const start = growStart(i);
        const p = spring({ frame: frame - start, fps, config: SPRING_CONFIG });
        if (p <= 0) return null; // the bar does not exist until it GROWs (E3.4)
        const H = bar.h * p; // current height — bar.bottom === axisY at every frame
        const top = chart.axisY - H - chart.barAreaTop;
        const left = bar.x - chart.gridX;
        const valueInside = bar.h >= VALUE_MIN_BAR;
        const fill = bar.highlight && accentOn ? colors.accent : colors.surface;
        const labelP = ease(frame - (start + LABEL_DRAG), [0, D.base], [0, 1]);
        const labelOpacity = ease(frame - (start + LABEL_DRAG), [0, D.short], [0, 1]);
        return (
          <div key={i} data-bar-group={i}>
            {/* the bar — surface except the data-flagged highlight (ENC-15);
                the growing top rides up from the axis to its compiled y */}
            <div
              data-bar-id={i}
              style={{
                position: "absolute",
                left,
                top,
                width: bar.w,
                height: H,
                boxSizing: "border-box",
                backgroundColor: fill,
                border: `${STROKE}px solid ${colors.stroke}`,
                borderRadius: `${BAR_RADIUS}px ${BAR_RADIUS}px 0 0`,
              }}
            >
              {/* the value — on the bar (C2.5/E3.5); clearance ≤24 px (ENC-14).
                  Placement mirrors Chart.jsx (valueInside → top edge; a short
                  bar → above its FINAL top, riding up with the growing bar). */}
              <div
                data-value-id={i}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontWeight: 800,
                  fontSize: MG_TYPE.value,
                  lineHeight: 1,
                  color: colors.textPrimary,
                  fontVariantNumeric: "tabular-nums",
                  ...(valueInside ? { top: VALUE_GAP } : { bottom: H + VALUE_GAP }),
                }}
              >
                {counterText(bar.value, p)}
              </div>
            </div>
            {/* the label — under its bar, below the axis (E3.5), RISE at
                bar+12 (drag 12) with D2.2 values */}
            <div
              data-label-id={i}
              style={{
                position: "absolute",
                left,
                width: bar.w,
                top: plotH + BAR_LABEL_TOP,
                textAlign: "center",
                fontWeight: 700,
                fontSize: MG_TYPE.label,
                letterSpacing: 2,
                color: colors.textDim,
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
                opacity: labelOpacity,
                translate: `0px ${RISE_OFFSET * (1 - labelP)}px`,
              }}
            >
              {bar.label}
            </div>
          </div>
        );
      })}

      {/* E4.2/E4.3 — the settle click fires on the frame the highlight bar's
          accent lands (highlightStart + 24), never on the word. One SFX per
          beat (E4.1). */}
      {accentAt >= 0 ? (
        <Sequence from={accentAt}>
          <Audio src={staticFile(CLICK_FILE)} volume={dbToVolume(CLICK_DB)} />
        </Sequence>
      ) : null}
    </div>
  );
}

export default Progress;
