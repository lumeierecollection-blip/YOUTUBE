import React from "react";
import { Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
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

// D2.2 RISE — translateY +24 → 0 over D.base, opacity 0 → 1 over D.short.
function riseStyle(frame, start, offsetPx = 24) {
  return {
    opacity: ease(frame - start, [0, D.short], [0, 1], E_OUT),
    translate: `0px ${offsetPx * ease(frame - start, [0, D.base], [1, 0], E_OUT)}px`,
  };
}

// ── F7 treatment (E2.5/E2.6) — legacy ImageBeatScene (motion-graphics.jsx
//    945-992), re-expressed against the stage prop. The stage slot IS the
//    image slot (claim 9-07: "48,392,840,548 — the stage slot IS the image
//    slot"); every offset derives from the stage rect, no bare layout ints.
const IMAGE_RADIUS = 24; // F7 "radius 24"
const IMAGE_SATURATE = 0.35; // F7 "saturate(0.35)"
const IMAGE_TINT = 0.12; // F7 "accent overlay 0.12 opacity"
const CREDIT_INSET_X = 8; // F7 credit at stage.x + 8 (legacy 56 = 48 + 8)
const CREDIT_INSET_Y = 34; // F7 credit at stage.y + stage.h − 34 (legacy 906)
const PUSH_ENTRY = 1.05; // F7/legacy — entry scale, pushed to 1.00

/**
 * IMAGE_BEAT — claim 9-07: the photo fills the stage rect EXACTLY (radius 24,
 * overflow hidden), desaturated (saturate 0.35) with a 12 % accent tint
 * overlay; fades in over D.base (9 f) from tA−4 at scale 1.05, then pushes
 * 1.05 → 1.00 over D.push via Easing.spring({damping: 200}) (legacy: scale
 * 1.05 − push·0.05); a 32 px textDim credit line sits at the stage bottom-
 * left corner with riseStyle at start+D.short; the subject headline rides the
 * compiled rect via Layer (RISE@"anchor+6"); NO accent element (F7 "none" —
 * the tint overlay is a style, not an accent element).
 */
export function ImageBeat({
  rects = {},
  stage,
  colors,
  anchorFrame = 0,
  frame: frameProp,
  src = "",
  credit = "",
  fontFamily = "Inter",
  ...rest
}) {
  const frame = frameProp ?? useCurrentFrame();
  const headline = rects.headline;
  const start = Math.max((Number(anchorFrame) || 0) - D.micro, 0); // tA−4
  const push = Easing.spring({ damping: 200 })(ease(frame - start, [0, D.push], [0, 1], E_OUT));
  const imageOpacity = ease(frame - start, [0, D.base], [0, 1], E_OUT);
  const imageScale = PUSH_ENTRY - push * 0.05;

  return (
    <div {...rest} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
      <div
        data-role="image"
        style={{
          position: "absolute",
          left: stage.x,
          top: stage.y,
          width: stage.w,
          height: stage.h,
          borderRadius: IMAGE_RADIUS,
          overflow: "hidden",
          opacity: imageOpacity,
          scale: `${imageScale}`,
          transformOrigin: "center",
        }}
      >
        {src ? (
          // Plain <img> — legacy ImageBeatScene (motion-graphics.jsx:945-992)
          // uses plain <img> too; Remotion's <Img> throws on load failure,
          // which would hard-fail stills when a fixture asset is absent.
          <img
            src={staticFile(src)}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              filter: `saturate(${IMAGE_SATURATE})`,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: colors.accent,
            opacity: IMAGE_TINT,
          }}
        />
      </div>

      {credit ? (
        <div
          data-role="credit"
          style={{
            position: "absolute",
            left: stage.x + CREDIT_INSET_X,
            top: stage.y + stage.h - CREDIT_INSET_Y,
            fontSize: MG_TYPE.label, // 32 — w400, textDim
            fontWeight: 400,
            color: colors.textDim,
            fontFamily,
            whiteSpace: "nowrap",
            ...riseStyle(frame, start + D.short),
          }}
        >
          {credit}
        </div>
      ) : null}

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

export default ImageBeat;
