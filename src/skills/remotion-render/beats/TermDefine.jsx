import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { D } from "../compositions/beats.js";
import { ICON_SIZES } from "../compositions/mg-style.js";
import Layer from "../layers/Layer.jsx";
import { Icon, TraceIcon } from "../primitives/Icon.jsx";

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

// A4 TERM_DEFINE rule row: the underline draws under the term over 14 frames,
// starting at the compiled accent rect's `from` (tA+6). The input range is
// [0, RULE_DRAW_FRAMES - 1] so the draw completes exactly on the last frame
// of its 14-frame window (frame tA+19) — the "hold begins at tA+20" row is
// then pixel-identical to the frame before it (C17 29-vs-30 gate).
const RULE_DRAW_FRAMES = 14;

/**
 * TERM_DEFINE — icon (180, A4.4) pops at the stage centre, the term headline
 * RISE@anchor+0 rides the compiled headline rect, and the accent rule
 * (compiled accent rect, 4 px TYP-18 stroke) draws under the term.
 */
export function TermDefine({
  rects = {},
  stage,
  colors,
  anchorFrame = 0,
  frame: frameProp,
  icon = "lightbulb",
  trace = false,
  fontFamily = "Inter",
  ...rest
}) {
  const frame = frameProp ?? useCurrentFrame();
  const tA = Math.max(anchorFrame, 0);
  const start = Math.max(tA - D.micro, 0);
  const headline = rects.headline;
  const accent = rects.accent;
  const cx = stage.x + stage.w / 2;
  const cy = stage.y + stage.h / 2;
  const size = ICON_SIZES[2]; // 180 — A4.4 TERM_DEFINE
  const pop = popStyle(frame, start);

  const ruleStart = accent ? accent.from : start; // compiled accent DRAW from = tA+6
  const ruleP = accent ? ease(frame - ruleStart, [0, RULE_DRAW_FRAMES - 1], [0, 1], E_OUT) : 0;

  return (
    <div {...rest} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
      <div
        data-role="icon"
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          translate: "-50% -50%",
          width: size,
          height: size,
          opacity: pop.opacity,
          ...(pop.scale ? { scale: pop.scale } : null),
          transformOrigin: pop.transformOrigin,
        }}
      >
        {trace ? (
          <TraceIcon name={icon} size={size} color={colors.stroke} start={start} frame={frame} />
        ) : (
          <Icon name={icon} size={size} color={colors.stroke} />
        )}
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

      {accent ? (
        <Layer
          rect={accent}
          enter={accent.enter}
          exit={accent.exit}
          frame={frame}
          data-rect-id={accent.id}
          data-role={accent.role}
        >
          <div
            data-role="rule"
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: colors.accent,
              transformOrigin: "left center",
              scale: `${ruleP} 1`,
            }}
          />
        </Layer>
      ) : null}
    </div>
  );
}

export default TermDefine;
