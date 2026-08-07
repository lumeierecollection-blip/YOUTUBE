/**
 * primitives/Chart.jsx — MANUAL E3/F5 + LAYOUT-SYSTEM §3.6: the compiled chart.
 *
 *   <Layer rect={…}> <Chart chart={rect.chart} colors={colors} unit="%" /> </Layer>
 *
 * Contract: consumes ONLY the compiler's resolved interior geometry
 * (compile.js chartRect — the `chart` object on the compiled rect):
 *   { axisY, gridX, barAreaTop, barW, gutter,
 *     bars: [{ label, value, x, w, h, y, bottom, highlight }],
 *     gutters, highlightIndex, axisLabelRight }
 * Every coordinate is already resolved by the compiler (R1–R4; L8 bar bottoms
 * == axis, L9 equal gutters, L10 axis-label gap 12 px are guarantees of that
 * compilation). THIS FILE NEVER recomputes a coordinate from raw data and
 * never positions itself — the wrapping Layer owns position (§4.2, like
 * Rule/Chip/Panel/Icon). `unit` is the axis-label text (the spec layer's
 * content.unit, passed by the style component, mirroring Icon's sw prop).
 *
 * Static renderer: motion is owned by beats/Progress.jsx (audit-motion lane)
 * — baseline/gridlines/axis label draw first, then bars grow (E3.4). DOM
 * order below IS that construction order, so the animated beat can mount the
 * same tree and animate it.
 *
 * Honesty (CHECK-REGISTER §3.5, stage 8):
 *   - ENC-14 — value labels are ON their bar (C2.5/E3.5), 8 px inside the
 *     top edge; a bar too short to hold a 72 px value (min bar height is
 *     the compiler's 8 px floor) gets the value 8 px above its top. Both
 *     clearances ≤ 24 px (VALUE_GAP) — the "56 px above" float that failed
 *     ENC-14 is gone.
 *   - ENC-15 — colour never encodes magnitude: every bar is `surface` except
 *     the single `highlight` bar, which is `accent` — driven by
 *     chart.highlightIndex / bar.highlight from the DATA (C2.7), never by
 *     value rank. Values are `textPrimary` on every bar.
 *   - ENC-11/12 — bars are flat rects on a shared baseline: side-by-side,
 *     equal-width segments of the same bar, with no circular, area, or
 *     volume encoding anywhere in this file (grep-verified by the stage-8
 *     gate).
 *   - Zero raw hex literals — every colour comes from the `colors` prop
 *     (palette roles: stroke, surface, accent, textPrimary, textDim).
 *   - A5.2 — flat fills only, no depth effects.
 *
 * Radius set A5.3: bar corners are 8 px, top corners only — the bottom edge
 * sits square on the axis (the baseline join must stay flush).
 */

import React from "react";
import { MG_TYPE } from "../compositions/beats.js";

/** A5.3 radius-set value for bar tops. */
const BAR_RADIUS = 8;
/** Bar border + gridline stroke width (mg.jsx ProgressScene: 2). */
const STROKE = 2;
/** Baseline stroke width (mg.jsx:753 — 4 px structural rule). */
const BASELINE_STROKE = 4;
/** Horizontal gridlines at 25/50/75 % of the plot height (mg.jsx:724). */
const GRID_LINES = [0.25, 0.5, 0.75];
const GRID_OPACITY = 0.3;
/** Value-label clearance from the bar top — ≤24 px (ENC-14). Effective DOM
 *  gap is 10 px (8 + the bar's 2 px border). */
const VALUE_GAP = 8;
/** Bar height that can hold the 72 px value + top/bottom clearance. */
const VALUE_MIN_BAR = MG_TYPE.value + 2 * VALUE_GAP;
/** Bar-label clearance below the axis (mg.jsx:804 — baselineY + 16). */
const BAR_LABEL_TOP = 16;
/** Axis-label gap from the gridline (L10 — compile.js:241 axisLabelRight =
 *  gridX − 12). Rendered as `right: calc(100% + 12px)`: the label's right
 *  edge lands exactly 12 px LEFT of the plot's left edge (= gridX). */
const AXIS_LABEL_GAP = 12;

/** E3.1 / ENC-28 — thousands separators from the start, so the digit count
 *  never changes while the value counts (mg.jsx:127-131). */
function fmtValue(v) {
  if (!Number.isFinite(v)) return "0";
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/**
 * @param {object} props
 * @param {object} props.chart    the compiled chart object (compile.js chartRect)
 * @param {object} props.colors   palette roles (paletteFromHues keys)
 * @param {string} [props.unit]   axis-label text (spec content.unit)
 */
export function Chart({ chart, colors, unit, ...rest }) {
  if (!chart || !Array.isArray(chart.bars)) return null;
  const plotH = chart.axisY - chart.barAreaTop; // compiled — never recomputed
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
      {/* E3.4 order 1 — baseline (the axis). The compiler guarantees every
          bar.bottom === axisY (L8); the 4 px stroke sits at the box bottom
          which IS axisY (chart.y = barAreaTop, chart.h = plotH). */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: BASELINE_STROKE,
          backgroundColor: colors.stroke,
        }}
      />

      {/* E3.4 order 2 — horizontal gridlines at 25/50/75 % (mg.jsx:724-744). */}
      {GRID_LINES.map((g) => (
        <div
          key={g}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: plotH * g,
            height: STROKE,
            backgroundColor: colors.stroke,
            opacity: GRID_OPACITY,
          }}
        />
      ))}

      {/* E3.4 order 3 — axis label (the unit). Right edge exactly 12 px left
          of the gridline (L10 — axisLabelRight = gridX − 12). Vertically
          centred on the plot, adjacent to the y-axis (E3.5). */}
      {unit ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: `calc(100% + ${AXIS_LABEL_GAP}px)`,
            display: "flex",
            alignItems: "center",
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

      {/* E3.4 order 4 — bars (each: rect, then its value, then its label).
          Bars sit exactly on the axis (bottom = axisY, L8); the highlight
          bar is the one accent element of the frame (L7, C2.7). */}
      {chart.bars.map((bar, i) => {
        // Position relative to the Layer box (chart.x = gridX, chart.y = barAreaTop).
        const left = bar.x - chart.gridX;
        const top = bar.y - chart.barAreaTop;
        const fill = bar.highlight ? colors.accent : colors.surface;
        const valueInside = bar.h >= VALUE_MIN_BAR;
        return (
          <div key={i}>
            {/* the bar — surface except the data-flagged highlight (ENC-15) */}
            <div
              style={{
                position: "absolute",
                left,
                top,
                width: bar.w,
                height: bar.h,
                boxSizing: "border-box",
                backgroundColor: fill,
                border: `${STROKE}px solid ${colors.stroke}`,
                borderRadius: `${BAR_RADIUS}px ${BAR_RADIUS}px 0 0`,
              }}
            >
              {/* the value — on the bar (C2.5/E3.5); clearance ≤24 px (ENC-14) */}
              <div
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
                  ...(valueInside ? { top: VALUE_GAP } : { bottom: bar.h + VALUE_GAP }),
                }}
              >
                {fmtValue(bar.value)}
              </div>
            </div>
            {/* the label — under its bar, below the axis (§0.4, E3.5) */}
            <div
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
              }}
            >
              {bar.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Chart;
