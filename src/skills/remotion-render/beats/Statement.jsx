import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { D, MG_TYPE } from "../compositions/beats.js";
import { ICON_SIZES } from "../compositions/mg-style.js";
import Layer from "../layers/Layer.jsx";
import { Icon, TraceIcon } from "../primitives/Icon.jsx";

// ── Motion curves ─ Layer D2/D3 shared values (MANUAL D2 parameter tables;
//    Layer.jsx uses the same E_OUT, so settled states are numerically
//    identical to the compiled headline/accent layers).
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

/** D2.1 POP — scale 0 → 1.15 → 1.00 over D.base, opacity 0 → 1 over 3f (Layer.jsx:127-138). */
function popStyle(frame, start) {
  const rel = frame - start;
  const scale = easeScale(rel, [0, 5, D.base], [0, 1.15, 1], E_OUT);
  return {
    opacity: ease(rel, [0, 3], [0, 1], E_OUT),
    ...(scale !== 1 ? { scale } : null),
    transformOrigin: "center",
  };
}

/**
 * STATEMENT — the claim's lone-icon beat. The icon pops (D2.1) at the
 * stage's optical centre; the compiled headline layer (RISE@anchor+0,
 * rect.from = tA) fades/rises beneath the stage. Peer-lane geometry is
 * derived from the `stage` prop rect only (LAY-10: no raw pixel literals).
 */
export function Statement({
  rects = {},
  stage,
  colors,
  anchorFrame = 0,
  frame: frameProp,
  icon = "target",
  trace = false,
  fontFamily = "Inter",
  ...rest
}) {
  const frame = frameProp ?? useCurrentFrame();
  const tA = Math.max(anchorFrame, 0);
  const start = Math.max(tA - D.micro, 0);
  const headline = rects.headline;
  const cx = stage.x + stage.w / 2;
  const cy = stage.y + stage.h / 2;
  const size = ICON_SIZES[1]; // 120 — A4.4 STATEMENT
  const pop = popStyle(frame, start);

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
    </div>
  );
}

export default Statement;
