import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { D, MG_TYPE } from "../compositions/beats.js";
import Layer from "../layers/Layer.jsx";

// ── Motion curves ─ Layer D2/D3 shared values (see Statement.jsx).
const E_OUT = Easing.bezier(0.16, 1, 0.3, 1);

function ease(frame, inputRange, outputRange, easing = E_OUT) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

function easeScale(frame, inputRange, outputRange, easing = E_OUT) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
    output: "perceptual-scale",
  });
}

/** D2.1 POP — see Statement.jsx. */
function popStyle(frame, start) {
  const rel = frame - start;
  const scale = easeScale(rel, [0, 5, D.base], [0, 1.15, 1], E_OUT);
  return {
    opacity: ease(rel, [0, 3], [0, 1], E_OUT),
    ...(scale !== 1 ? { scale } : null),
    transformOrigin: "center",
  };
}

// ── Peer-lane geometry ─ legacy ContrastScene (motion-graphics.jsx), fixed
//    F7 panels re-expressed against the compiled stage rect.
const PANEL_W = 360; // F7 fixed 360 (never w-compensated)
const PANEL_H = 320; // F7 fixed 320
const PANEL_TOP_OFFSET = 128; // legacy y 520 = stage.y + 128
const VALUE_FONT = 96; // F7 — panel value fs 96
const VALUE_POP_DELAY = D.micro; // value pops one beat after its panel
const PANEL_POP_DELAY = D.micro; // right panel enters one beat after the left

/** Number prefix of a value phrase ("12 percent" → "12"). */
function numericPrefix(text) {
  const m = String(text).match(/^-?[\d.,]+/);
  return m ? m[0] : String(text);
}

function panelGeometry(panel) {
  return {
    label1: { x: panel.x + 40, y: panel.y + 40, w: panel.w - 80, h: 56 },
    value: { x: panel.x, y: panel.y + 104, w: panel.w, h: 128 },
    label2: { x: panel.x + 40, y: panel.y + 240, w: panel.w - 80, h: 32 },
  };
}

const panelValueStyle = (colors, panel, pop) => ({
  position: "absolute",
  left: panel.x,
  top: panel.y + 104,
  width: panel.w,
  height: 128,
  fontSize: VALUE_FONT,
  fontWeight: 800,
  color: colors.accent,
  lineHeight: "128px",
  textAlign: "center",
  whiteSpace: "nowrap",
  opacity: pop.opacity,
  ...(pop.scale ? { scale: pop.scale } : null),
  transformOrigin: pop.transformOrigin,
});

/**
 * CONTRAST — two fixed 360×320 panels (F7) at the stage's left/right edges,
 * before panel pops at tA−4, after panel at tA; each value pops one beat
 * after its panel (D2.1). Labels sit top (fs 24 label) and bottom
 * (fs 24 body); values render the numeric prefix + unit. Headline rides
 * the compiled rect (RISE@anchor+0).
 */
export function Contrast({
  rects = {},
  stage,
  colors,
  anchorFrame = 0,
  frame: frameProp,
  before = "12 percent",
  after = "47 percent",
  unit = "%",
  fontFamily = "Inter",
  ...rest
}) {
  const frame = frameProp ?? useCurrentFrame();
  const tA = Math.max(anchorFrame, 0);
  const start = Math.max(tA - D.micro, 0);
  const headline = rects.headline;

  const py = stage.y + PANEL_TOP_OFFSET;
  const pa = { x: stage.x, y: py, w: PANEL_W, h: PANEL_H };
  const pb = { x: stage.x + stage.w - PANEL_W, y: py, w: PANEL_W, h: PANEL_H };

  const aPop = popStyle(frame, start);
  const bPop = popStyle(frame, start + PANEL_POP_DELAY);
  const aValuePop = popStyle(frame, start + VALUE_POP_DELAY);
  const bValuePop = popStyle(frame, start + PANEL_POP_DELAY + VALUE_POP_DELAY);

  const ga = panelGeometry(pa);
  const gb = panelGeometry(pb);

  const panelBox = (panel, pop) => ({
    position: "absolute",
    left: panel.x,
    top: panel.y,
    width: panel.w,
    height: panel.h,
    backgroundColor: colors.surface,
    border: "4px solid",
    borderColor: colors.stroke,
    boxSizing: "border-box",
    opacity: pop.opacity,
    ...(pop.scale ? { scale: pop.scale } : null),
    transformOrigin: pop.transformOrigin,
  });

  const labelStyle = (geom, color) => ({
    position: "absolute",
    left: geom.x,
    top: geom.y,
    width: geom.w,
    height: geom.h,
    fontSize: MG_TYPE.label, // 32
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: "uppercase",
    color,
    whiteSpace: "nowrap",
  });

  return (
    <div {...rest} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
      <div data-role="panel" data-side="before" style={panelBox(pa, aPop)}>
        <span data-role="label1" style={labelStyle(ga.label1, colors.textDim)}>
          {before}
        </span>
        <span data-role="value" data-value={numericPrefix(before) + unit} style={panelValueStyle(colors, pa, aValuePop)}>
          {numericPrefix(before)}
          {unit}
        </span>
        <span data-role="label2" style={labelStyle(ga.label2, colors.textPrimary)}>
          {before}
        </span>
      </div>

      <div data-role="panel" data-side="after" style={panelBox(pb, bPop)}>
        <span data-role="label1" style={labelStyle(gb.label1, colors.textDim)}>
          {after}
        </span>
        <span data-role="value" data-value={numericPrefix(after) + unit} style={panelValueStyle(colors, pb, bValuePop)}>
          {numericPrefix(after)}
          {unit}
        </span>
        <span data-role="label2" style={labelStyle(gb.label2, colors.textPrimary)}>
          {after}
        </span>
      </div>

      {headline ? (
        <Layer
          rect={headline}
          enter={headline.enter}
          exit={headline.exit}
          frame={frame}
          data-rect-id={headline.id}
          data-role={headline.role}
        >
          <span
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              fontSize: headline.fontSize,
              lineHeight: `${headline.h}px`,
              fontWeight: 800, // MG_TYPE headline — w800
              color: colors.textPrimary,
              whiteSpace: "nowrap",
              textAlign: "center",
            }}
          >
            {headline.text}
          </span>
        </Layer>
      ) : null}
    </div>
  );
}

export default Contrast;
