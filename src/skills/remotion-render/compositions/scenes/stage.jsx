import React from "react";
import { useCurrentFrame } from "remotion";
import { CANVAS_W, CANVAS_H, ease, seeded, EASE_IN_OUT } from "./primitives.jsx";
import { progressOf } from "../../visual/states.js";
import { planeOffset } from "../../visual/composition.js";

/**
 * Art-direction primitives: the things that turn a subject into a SHOT.
 *
 * primitives.jsx holds DRAWING tools — a rule, a label, a figure. This file
 * holds STAGING tools — ground to stand on, planes to sit between, a camera
 * to look through. The distinction matters because the renderer's problem
 * was never that it lacked shapes. It had shapes. It lacked a stage, so
 * every scene drew its shapes at the same size in the middle of nothing,
 * and sixteen different subjects came out looking like one template.
 *
 * WHAT A SCENE IS SUPPOSED TO DO WITH THESE
 *
 *   <Shot shot={shot} states={states}>      // camera + framing
 *     <Ground material={shot.material} />   // what world this is
 *     <Plane depth="background">…</Plane>   // things that lag
 *     <Plane depth="subject">…</Plane>      // the thing itself
 *     <Plane depth="foreground">…</Plane>   // things that lead
 *   </Shot>
 *
 * The shot comes from visual/composition.js, which is pure and decides
 * material/framing/camera/depth deterministically per beat.
 *
 * A NOTE ON RESTRAINT
 *
 * Everything here is deliberately quiet: grounds are texture at 3-8%
 * opacity, parallax is a few pixels, the default camera move is a drift of
 * about 2% scale. The failure mode on the other side of "looks templated"
 * is "looks like a screensaver", and glow, particles and constant zoom get
 * there fast. If an element here is visible as an effect rather than as
 * the world the subject lives in, it is turned up too far.
 */

const FPS = 30;

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Progress through the beat, 0..1, for camera purposes.
 *
 * Driven by the beat's own state span rather than a frame count, so the
 * same move reads correctly on a 2s beat and a 12s beat. This is what keeps
 * the SRT timing contract intact through the new composition layer: nothing
 * here invents a duration.
 */
function useShotProgress(states, durationInFrames) {
  const frame = useCurrentFrame();
  const total = durationInFrames || (states && states.length ? states[states.length - 1].endFrame : 0);
  if (!total) return 0;
  return Math.max(0, Math.min(1, frame / total));
}

/**
 * The camera. Applies the shot's move plus the framing's anchor offset.
 *
 * The anchor is the reason this is not just a zoom: FRAMINGS place the
 * subject off-centre on purpose, and every scene inheriting that from one
 * place is what stops the cx-0.43 monoculture the pixel audit found.
 */
export function Shot({ shot, states, durationInFrames, children }) {
  const p = useShotProgress(states, durationInFrames);
  const e = ease(p, EASE_IN_OUT);
  const cam = shot.camera;

  const scale = cam.from.scale + (cam.to.scale - cam.from.scale) * e;
  const dx = (cam.from.x + (cam.to.x - cam.from.x) * e) * CANVAS_W;
  const dy = (cam.from.y + (cam.to.y - cam.from.y) * e) * CANVAS_H;

  /**
   * ONLY THE CAMERA IS APPLIED HERE. The framing anchor is NOT.
   *
   * A first version translated the whole world by (anchorX - 0.5), and a
   * rendered frame showed why that is wrong: CAUSE_EFFECT already draws
   * lanes spanning the full canvas width, so shifting it 173px left pushed
   * its own label off the edge — "SECOND STAGE HOLDING" rendered as
   * "HOLDING".
   *
   * The anchor is an instruction TO the scene about where to put its
   * subject, not a transform applied on top of a composition that has
   * already placed itself. Scenes read shot.anchorX / anchorY / coverage
   * and lay out against them; the stage moves the camera and nothing else.
   */

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
          transformOrigin: "50% 50%",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A depth plane. Lags or leads the camera, AND carries a depth anchor.
 *
 * PARALLAX ALONE IS NOT DEPTH. `vendor/video-shotcraft`'s depth-layer
 * reference states the failure directly: without a blur / desaturation
 * anchor, offset layers read as stickers sliding around rather than as
 * distance. An earlier version of this component applied only the
 * translation, which is exactly that. Each plane now also carries the blur,
 * saturation and opacity that make its distance legible — and the SUBJECT
 * plane is always perfectly sharp, because that is the layer being read.
 *
 * The parallax gradients live in visual/composition.js and are >= 2x
 * between adjacent planes, per the same reference: below that the eye does
 * not separate them at all.
 */
export function Plane({ shot, depth = "subject", states, durationInFrames, children }) {
  const p = useShotProgress(states, durationInFrames);
  const e = ease(p, EASE_IN_OUT);
  // A beat can reach a scene with no shot — scenes/index.jsx renders the
  // component bare in that case. Depth without a camera is nothing to
  // offset against, so the plane passes its children straight through
  // rather than throwing on `shot.planes`.
  if (!shot) return <div style={{ position: "absolute", inset: 0 }}>{children}</div>;
  const plane = (shot.planes || []).find((x) => x.name === depth);
  // Differential against the subject plane; the camera already moved
  // everything, this only adds what depth would add. The maths lives in
  // visual/composition.js so a test can exercise the real function — and
  // because the first version of it had the sign inverted, which sent far
  // planes racing ahead of the camera and foreground planes backwards.
  const { x: offX, y: offY } = planeOffset(shot, depth, e);

  const blur = plane ? plane.blur || 0 : 0;
  const saturate = plane && plane.saturate != null ? plane.saturate : 1;
  const opacity = plane && plane.opacity != null ? plane.opacity : 1;
  // Built as a string rather than always emitting `filter`: a filter of
  // "none" is free, but `blur(0px) saturate(1)` still forces the subject
  // layer through a compositing pass it does not need, and this renders on
  // software WebGL.
  const parts = [];
  if (blur > 0) parts.push(`blur(${blur}px)`);
  if (saturate !== 1) parts.push(`saturate(${saturate})`);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translate(${offX}px, ${offY}px)`,
        filter: parts.length ? parts.join(" ") : undefined,
        opacity,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The rect a scene's subject should occupy, from the shot.
 *
 * WHY THIS EXISTS AS A HELPER
 *
 * An audit found only two of sixteen scenes reading shot.coverage or
 * shot.anchorY; the other fourteen laid out against hardcoded pixel
 * constants. They inherited ground, camera and falloff from the router and
 * still drew their subject at the same size in the same place, which is
 * most of why the composition layer had not yet changed their measured ink.
 *
 * Converting a scene by hand is a per-file negotiation with whatever
 * constants it happened to pick. This turns it into one call: ask for the
 * frame, lay out inside it. `bleed` framings deliberately return a rect
 * LARGER than the canvas, because a world that stops at the frame edge
 * reads as a diagram on a page.
 */
export function shotFrame(shot) {
  if (!shot) {
    return { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H, cx: CANVAS_W / 2, cy: CANVAS_H / 2 };
  }
  const cov = shot.coverage;
  // Width is driven by coverage against the frame's short axis; height
  // follows the subject band rather than the whole 9:16, because a subject
  // that fills 1920px tall is not composed, it is stretched.
  const w = CANVAS_W * (shot.bleed ? Math.max(cov, 1.05) : cov);
  const h = CANVAS_H * 0.46 * (shot.bleed ? Math.max(cov, 1.05) : cov);
  const cx = CANVAS_W * shot.anchorX;
  const cy = CANVAS_H * shot.anchorY;
  return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUND — what the world is made of
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The environment layer, one per material.
 *
 * This is the single biggest change to how a frame reads. A subject on flat
 * black is a diagram; the same subject on ground that continues past the
 * frame edge is a shot. Every ground here is generated deterministically
 * from `seeded` — no Math.random, so the same beat renders identically.
 *
 * `p` fades the ground in with the scene's first state so it establishes
 * rather than being simply present.
 *
 * ALPHAS ROUGHLY DOUBLED after looking at rendered frames. The first pass
 * set these at 2-8% "so the ground is texture, not decoration", and the
 * result on real frames is that the ground contributes essentially nothing:
 * at 5% a stroke lands ~12/255 from the background, below the threshold at
 * which the frame audit counts a pixel as ink at all, on light and dark
 * channels alike. A world the viewer cannot see is not a world — it is the
 * same subject floating in the same void, with a comment claiming
 * otherwise. Still deliberately quiet; the ceiling is "you notice it if you
 * look for it", not "you notice it".
 */
export function Ground({ material, colors, p = 1, seed = 1 }) {
  const a = ease(p);
  switch (material) {
    case "paper":
      return <PaperGround colors={colors} a={a} seed={seed} />;
    case "mechanism":
      return <MechanismGround colors={colors} a={a} seed={seed} />;
    case "substance":
      return <SubstanceGround colors={colors} a={a} />;
    case "field":
      return <FieldGround colors={colors} a={a} seed={seed} />;
    case "atmosphere":
      return <AtmosphereGround colors={colors} a={a} seed={seed} />;
    case "interface":
    case "footage":
    case "terrain":
      // These three build their own world: the map draws streets, the
      // interface draws real chrome, footage is a photograph. Adding a
      // generic ground under them would be decoration on top of a world
      // that already exists.
      return null;
    default:
      return null;
  }
}

/** Paper: a sheet's grain and the shadow of the stack under it. */
function PaperGround({ colors, a, seed }) {
  const lines = [];
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * CANVAS_H + seeded(seed * 7 + i) * 14;
    lines.push(
      <line key={i} x1={0} y1={y} x2={CANVAS_W} y2={y}
        stroke={colors.stroke} strokeWidth={1} opacity={0.05 * a} />
    );
  }
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
      {lines}
      {/* Falloff toward the edges, as if the sheet is lit from above. */}
      <defs>
        <radialGradient id="paper-fall" cx="50%" cy="42%" r="72%">
          <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.1 * a} />
          <stop offset="100%" stopColor={colors.bg} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="url(#paper-fall)" />
    </svg>
  );
}

/** Mechanism: a faint machine bed — rails and register marks, not a grid. */
function MechanismGround({ colors, a, seed }) {
  const marks = [];
  for (let i = 0; i < 18; i++) {
    const y = 120 + i * 104 + seeded(seed * 3 + i) * 26;
    const w = 26 + seeded(seed * 11 + i) * 44;
    marks.push(
      <line key={`l${i}`} x1={0} y1={y} x2={w} y2={y}
        stroke={colors.stroke} strokeWidth={2} opacity={0.11 * a} />
    );
    marks.push(
      <line key={`r${i}`} x1={CANVAS_W - w} y1={y} x2={CANVAS_W} y2={y}
        stroke={colors.stroke} strokeWidth={2} opacity={0.11 * a} />
    );
  }
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
      {marks}
    </svg>
  );
}

/** Substance: a floor with weight — a horizon the pile sits on. */
function SubstanceGround({ colors, a }) {
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <linearGradient id="sub-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.bg} stopOpacity={0} />
          <stop offset="100%" stopColor={colors.stroke} stopOpacity={0.14 * a} />
        </linearGradient>
      </defs>
      <rect x={0} y={CANVAS_H * 0.46} width={CANVAS_W} height={CANVAS_H * 0.54} fill="url(#sub-floor)" />
    </svg>
  );
}

/** Field: isolines of a potential — where force lives. */
function FieldGround({ colors, a, seed }) {
  const rings = [];
  const cx = CANVAS_W * 0.5;
  const cy = CANVAS_H * 0.46;
  for (let i = 1; i <= 9; i++) {
    const r = i * 148 + seeded(seed * 5 + i) * 30;
    rings.push(
      <ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.82}
        fill="none" stroke={colors.stroke} strokeWidth={1.5}
        opacity={0.11 * a * (1 - i / 12)} />
    );
  }
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {rings}
    </svg>
  );
}

/** Atmosphere: distance. A horizon and depth haze, nothing else. */
function AtmosphereGround({ colors, a, seed }) {
  const horizonY = CANVAS_H * 0.6;
  const marks = [];
  for (let i = 0; i < 14; i++) {
    const t = i / 14;
    const y = horizonY + Math.pow(t, 2.1) * (CANVAS_H - horizonY);
    marks.push(
      <line key={i} x1={0} y1={y} x2={CANVAS_W} y2={y}
        stroke={colors.stroke} strokeWidth={1} opacity={0.11 * a * (0.3 + t * 0.7)} />
    );
  }
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <linearGradient id="atmo-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.1 * a} />
          <stop offset="55%" stopColor={colors.bg} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={CANVAS_W} height={horizonY} fill="url(#atmo-haze)" />
      <line x1={0} y1={horizonY} x2={CANVAS_W} y2={horizonY}
        stroke={colors.stroke} strokeWidth={1.5} opacity={0.3 * a} />
      {marks}
      {/* Deterministic distant markers — scale cues, not decoration. */}
      {Array.from({ length: 7 }).map((_, i) => {
        const x = seeded(seed * 13 + i) * CANVAS_W;
        const h = 12 + seeded(seed * 17 + i) * 30;
        return (
          <line key={`d${i}`} x1={x} y1={horizonY} x2={x} y2={horizonY - h}
            stroke={colors.stroke} strokeWidth={1.5} opacity={0.22 * a} />
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW — the connective tissue that is NOT an arrow between two boxes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A curved path between two points, drawn progressively.
 *
 * Exists so scenes stop reaching for a straight line plus a triangle. A
 * flow that bends reads as something travelling; a straight line with an
 * arrowhead reads as a flowchart, and the audit found that exact
 * line+polygon pair shared across PROCESS, CAUSE_EFFECT and BEFORE_AFTER.
 *
 * `bow` is the perpendicular offset of the control point. Sign matters:
 * alternating it down a sequence is what makes a chain look routed rather
 * than stacked.
 */
export function FlowPath({ from, to, p = 1, bow = 90, color, width = 3, dashed = false, opacity = 1 }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular, normalised.
  const cx = mx + (-dy / len) * bow;
  const cy = my + (dx / len) * bow;
  const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  // Quadratic arc length is close enough to the control polygon for a
  // dash-based reveal at these scales.
  const approx = Math.hypot(cx - x1, cy - y1) + Math.hypot(x2 - cx, y2 - cy);
  const shown = approx * ease(p);
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      opacity={opacity}
      strokeDasharray={dashed ? `${10} ${9}` : `${shown} ${approx}`}
      strokeDashoffset={dashed ? 0 : 0}
    />
  );
}

/**
 * Something travelling along that path.
 *
 * The point of a process is that a THING moves through it. This returns the
 * position at t so a scene can put any object there — a document, a token,
 * a volume of money — rather than lighting up the next box in a row.
 */
export function pointOnFlow(from, to, bow, t) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bow;
  const cy = my + (dx / len) * bow;
  const u = 1 - t;
  return [
    u * u * x1 + 2 * u * t * cx + t * t * x2,
    u * u * y1 + 2 * u * t * cy + t * t * y2,
  ];
}

/**
 * Light falloff toward the frame edges.
 *
 * Cheap, and it does more for "this is a shot" than any amount of motion:
 * an evenly lit rectangle of content is a slide, a frame with a centre of
 * attention is a photograph. Kept very low — this should never read as a
 * vignette effect.
 */
export function Falloff({ colors, strength = 0.5 }) {
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      <defs>
        <radialGradient id="shot-falloff" cx="50%" cy="45%" r="70%">
          <stop offset="55%" stopColor={colors.bg} stopOpacity={0} />
          <stop offset="100%" stopColor={colors.bg} stopOpacity={strength} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="url(#shot-falloff)" />
    </svg>
  );
}

/** Progress through a named state — re-exported so scenes import one module. */
export function stateProgress(states, key, frame) {
  return progressOf(states, key, frame);
}

export { FPS };
