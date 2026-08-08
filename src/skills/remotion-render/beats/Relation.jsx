import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { D, MG_TYPE } from "../compositions/beats.js";
import Layer from "../layers/Layer.jsx";
import { Node } from "../primitives/Node.jsx";

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

/** D2.2 RISE — translateY +24 → 0 over D.base, opacity 0 → 1 over D.short. */
function riseStyle(frame, start, offsetPx = 24) {
  const rel = frame - start;
  const opacity = ease(rel, [0, D.short], [0, 1], E_OUT);
  const yPx = offsetPx * (1 - ease(rel, [0, D.base], [0, 1], E_OUT));
  return yPx === 0 ? { opacity } : { opacity, translate: `0 ${yPx}px` };
}

// ── Peer-lane geometry ─ legacy RelationScene (motion-graphics.jsx:844-896),
//    re-expressed against the compiled stage rect (stage.w = 840 shortform).
const RELATION_INSET = 200; // node centres sit 200 px in from the stage edges (48+200=248 / 888-200=688)
const NODE_RADIUS = 44; // A5.1 r 44 → 88×88 box (Node.jsx)
const CONNECTOR_STROKE = 4; // F6 — 4 px stroke
const CONNECTOR_DRAW_FRAMES = 14; // A4/F6 draw — over legacy D.large=12, settles before the headline's tA+18 RISE
const LABEL_GAP = 16; // legacy mg.jsx:895 — 666 + 44 + 16
const LABEL_WIDTH = 240; // legacy mg.jsx:896
const LABEL_OFFSET = 24; // D2.2 RISE offset

/** Progress-proportional stroke-dash for a straight line (F6 DASH → DRAW). */
function evolvePath(progress, path) {
  const len = Math.hypot(
    parseFloat(path.match(/M ([\d.]+) ([\d.]+)/)[1]) - parseFloat(path.match(/L ([\d.]+) ([\d.]+)/)[1]),
    parseFloat(path.match(/M [\d.]+ ([\d.]+)/)[1]) - parseFloat(path.match(/L [\d.]+ ([\d.]+)/)[1])
  );
  return {
    strokeDasharray: `${len} ${len}`,
    strokeDashoffset: (1 - progress) * len,
  };
}

/**
 * RELATION — two passive nodes (A: pop at frame 0, B: pop at tA−4) at the
 * stage's horizontal insets, a 4 px connector that draws tA+4 → tA+17
 * (14 frames), and underlines beneath each node that fade in with the
 * headline's RISE window (tA+18..tA+26, D.large+6). Headline layer rides the
 * compiled rect (RISE@anchor+18 → settles tA+27).
 */
export function Relation({
  rects = {},
  stage,
  colors,
  anchorFrame = 0,
  frame: frameProp,
  left = "Spending",
  right = "inflation",
  relation = "drives",
  fontFamily = "Inter",
  ...rest
}) {
  const frame = frameProp ?? useCurrentFrame();
  const tA = Math.max(anchorFrame, 0);
  const bStart = Math.max(tA - D.micro, 0);
  const headline = rects.headline;
  const stageCY = stage.y + stage.h / 2;
  const ax = stage.x + RELATION_INSET;
  const bx = stage.x + stage.w - RELATION_INSET;

  const connStart = tA + D.micro; // tA+4
  const connProg = ease(frame - connStart, [0, CONNECTOR_DRAW_FRAMES - 1], [0, 1], E_OUT);
  const aPop = popStyle(frame, 0);
  const bPop = popStyle(frame, bStart);

  const labelY = stageCY + NODE_RADIUS + LABEL_GAP;
  const aLabelStyle = { opacity: ease(frame, [0, D.base], [0, 1], E_OUT) };
  const bLabelStyle = riseStyle(frame, bStart + D.short);

  const path = `M ${ax + NODE_RADIUS} ${stageCY} L ${bx - NODE_RADIUS} ${stageCY}`;
  const dash = connProg > 0 ? evolvePath(connProg, path) : { strokeDasharray: "0 0", strokeDashoffset: 0 };

  const labelBase = {
    position: "absolute",
    top: labelY,
    translate: "-50% 0",
    width: LABEL_WIDTH,
    fontWeight: 400, // MG_TYPE support — w400
    fontSize: MG_TYPE.support,
    textAlign: "center",
    whiteSpace: "nowrap",
  };

  return (
    <div {...rest} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
      <div
        data-role="node-a"
        style={{
          position: "absolute",
          left: ax - NODE_RADIUS,
          top: stageCY - NODE_RADIUS,
          width: NODE_RADIUS * 2,
          height: NODE_RADIUS * 2,
          opacity: aPop.opacity,
          ...(aPop.scale ? { scale: aPop.scale } : null),
          transformOrigin: aPop.transformOrigin,
        }}
      >
        <Node colors={colors} />
      </div>

      <div
        data-role="node-b"
        style={{
          position: "absolute",
          left: bx - NODE_RADIUS,
          top: stageCY - NODE_RADIUS,
          width: NODE_RADIUS * 2,
          height: NODE_RADIUS * 2,
          opacity: bPop.opacity,
          ...(bPop.scale ? { scale: bPop.scale } : null),
          transformOrigin: bPop.transformOrigin,
        }}
      >
        <Node colors={colors} />
      </div>

      {connProg > 0 ? (
        <svg
          data-role="connector"
          width="100%"
          height="100%"
          style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
        >
          <path
            d={path}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={CONNECTOR_STROKE}
            strokeLinecap="round"
            strokeDasharray={dash.strokeDasharray}
            strokeDashoffset={dash.strokeDashoffset}
          />
        </svg>
      ) : null}

      <div data-role="label-a" style={{ ...labelBase, left: ax, color: colors.textDim, ...aLabelStyle }}>
        {left}
      </div>
      <div data-role="label-b" style={{ ...labelBase, left: bx, color: colors.textPrimary, ...bLabelStyle }}>
        {right}
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

export default Relation;
