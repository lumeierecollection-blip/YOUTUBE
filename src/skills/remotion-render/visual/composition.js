/**
 * The art-direction layer.
 *
 * PURE module — no React, no Remotion, no model call. Runs in node so the
 * decisions it makes can be tested and measured without rendering.
 *
 *   strategy + beat  ->  [ composition.js ]  ->  a SHOT
 *
 * WHY THIS EXISTS
 *
 * The renderer reached the point where every strategy chose the right
 * SUBJECT and then drew it the same way: a hairline diagram, centred, on
 * empty ground. Measured across 23 rendered anchor frames, fifteen of
 * sixteen scenes covered under 5% of the frame and centred within a few
 * percent of the same point (cx 0.43). The one exception was
 * GEOSPATIAL_RADIUS at 47.5% ink, full-bleed — and it is the one scene
 * nobody called a template.
 *
 * The difference was never the subject. It was that the map had been given
 * an environment, depth, scale and a camera, and the others had not. Those
 * are art-direction decisions, they are the same four decisions every time,
 * and nothing in the codebase owned them. So each scene improvised, and
 * improvising with the same primitives produces the same picture.
 *
 * This module owns them:
 *
 *   MATERIAL  what world is this made of        (drives ground AND sound)
 *   FRAMING   where in the 9:16 frame it sits   (not automatically centre)
 *   DEPTH     how many planes, and their drift  (parallax, occlusion)
 *   CAMERA    what the camera does, and WHY     (a move needs a reason)
 *
 * DETERMINISM IS NOT OPTIONAL. Every decision below is a pure function of
 * the strategy, the beat's own semantics and its variant ordinal. Same
 * script, same pixels. There is no Math.random in this file and there must
 * never be: a render that shuffles between runs cannot be reviewed, diffed
 * or regression-tested.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not make scenes bigger. "Scale every scene to 150%" would have
 * been the cheap reading of the ink measurement and it would have produced
 * larger templates. Framing here is asymmetric and varied ON PURPOSE, and
 * some shots are deliberately sparse — a quiet frame is a legitimate
 * choice, an accidentally tiny one is not.
 */

/**
 * The materials a shot can be made of.
 *
 * This is the single most load-bearing idea in the file, because material
 * is what a viewer reads before they read anything else — paper does not
 * behave like a machine, and a map does not behave like a field of force.
 * It also crosses into audio: visual/sound-design.js resolves cues by
 * material, so a document beat gets paper and a process beat gets
 * mechanism rather than every beat getting the same interface click.
 */
export const MATERIALS = {
  /** Ground you look down at. Streets, blocks, terrain. */
  TERRAIN: "terrain",
  /** Physical paper: pages, folds, print, annotation. */
  PAPER: "paper",
  /** Mechanism: parts that move because something drives them. */
  MECHANISM: "mechanism",
  /** Quantity you can pile, pour, weigh. */
  SUBSTANCE: "substance",
  /** A field with forces in it — pressure, attraction, propagation. */
  FIELD: "field",
  /** A real screen. Rectangles are CORRECT here and nowhere else by default. */
  INTERFACE: "interface",
  /** Photographic evidence. */
  FOOTAGE: "footage",
  /** Open space with atmosphere and distance. */
  ATMOSPHERE: "atmosphere",
};

const M = MATERIALS;

/**
 * What each strategy is made of.
 *
 * Note how few of these are INTERFACE. That is the point: the old renderer
 * drew rectangles for everything, which silently claimed that a court
 * ruling, a bottleneck and a pile of money are all screens. Eight of
 * sixteen scenes measured rectangle-dominant. Only INTERFACE_SIMULATION —
 * and PAPER's page edge — has any business being a rectangle.
 */
const STRATEGY_MATERIAL = {
  GEOSPATIAL_RADIUS: M.TERRAIN,
  ACCUMULATION: M.SUBSTANCE,
  TRANSFORMATION: M.MECHANISM,
  COMPARISON: M.FIELD,
  DATA_CHART: M.SUBSTANCE,
  TIMELINE: M.ATMOSPHERE,
  PROCESS: M.MECHANISM,
  CAUSE_EFFECT: M.FIELD,
  RELATIONSHIP: M.FIELD,
  BEFORE_AFTER: M.MECHANISM,
  DOCUMENT_EVIDENCE: M.PAPER,
  IMAGE_EVIDENCE: M.FOOTAGE,
  INTERFACE_SIMULATION: M.INTERFACE,
  SCALE_COMPARISON: M.ATMOSPHERE,
  VISUAL_METAPHOR: M.FIELD,
  CINEMATIC_STATEMENT: M.ATMOSPHERE,
};

/**
 * FRAMINGS — where the subject sits, and how much frame it takes.
 *
 * `anchor` is the subject's centre in normalised frame coordinates.
 * `coverage` is the share of the frame's shorter axis the subject should
 * span — the direct answer to the 0.2%-ink measurement.
 * `bleed` means the environment runs past the frame edge, which is most of
 * what separates "a shot" from "a diagram on a page".
 *
 * The vertical anchors are chosen against a 9:16 frame where the top ~15%
 * and bottom ~20% are dead zones (platform chrome), so nothing sits at
 * 0.5 by default. Real framing puts the subject off centre.
 */
export const FRAMINGS = {
  /** Looking down at ground that continues past every edge. */
  IMMERSIVE: { id: "immersive", anchor: [0.5, 0.46], coverage: 1.0, bleed: true },
  /** Subject high, weight below it — reads as "this sits on something". */
  GROUNDED: { id: "grounded", anchor: [0.5, 0.4], coverage: 0.82, bleed: true },
  /** Off-centre left, space to the right for the thing it acts on. */
  ACTING_LEFT: { id: "acting-left", anchor: [0.34, 0.45], coverage: 0.74, bleed: false },
  /** Mirror: the subject is the receiver, the space to its left is cause. */
  ACTING_RIGHT: { id: "acting-right", anchor: [0.66, 0.45], coverage: 0.74, bleed: false },
  /** Vertical stack that runs off the top and bottom — depth, not a list. */
  COLUMNAR: { id: "columnar", anchor: [0.44, 0.5], coverage: 0.9, bleed: true },
  /** Wide and shallow, subject low, sky above: distance and time. */
  HORIZON: { id: "horizon", anchor: [0.5, 0.58], coverage: 0.96, bleed: true },
  /** One object held large and close. */
  CLOSE: { id: "close", anchor: [0.48, 0.44], coverage: 0.86, bleed: false },
  /** Deliberately small in a large empty field — only where silence is the point. */
  ISOLATED: { id: "isolated", anchor: [0.42, 0.38], coverage: 0.4, bleed: false },
};

const F = FRAMINGS;

/**
 * Framing options per strategy, in preference order.
 *
 * More than one entry means the variant ordinal picks between them, so the
 * second use of a strategy in a video is framed differently from the first.
 * That is the deterministic answer to "ten beats all look like the same
 * card": not different content in the same frame, a different frame.
 */
const STRATEGY_FRAMINGS = {
  GEOSPATIAL_RADIUS: [F.IMMERSIVE],
  ACCUMULATION: [F.GROUNDED, F.COLUMNAR],
  TRANSFORMATION: [F.ACTING_LEFT, F.COLUMNAR],
  COMPARISON: [F.HORIZON, F.ACTING_LEFT],
  // HORIZON first, not GROUNDED: sharing a material with ACCUMULATION is
  // fine, sharing the whole shot signature is not — the collision check
  // caught them as one picture. A chart is read ACROSS a field of values;
  // a pile is read as weight sitting on ground.
  DATA_CHART: [F.HORIZON, F.GROUNDED],
  TIMELINE: [F.HORIZON, F.COLUMNAR],
  PROCESS: [F.COLUMNAR, F.ACTING_LEFT],
  CAUSE_EFFECT: [F.ACTING_LEFT, F.COLUMNAR],
  // CLOSE first, for the same reason against VISUAL_METAPHOR: a
  // relationship is read from among the parties, a metaphor is a field
  // acting on a subject from outside it.
  RELATIONSHIP: [F.CLOSE, F.IMMERSIVE],
  BEFORE_AFTER: [F.ACTING_RIGHT, F.HORIZON],
  DOCUMENT_EVIDENCE: [F.CLOSE, F.GROUNDED],
  IMAGE_EVIDENCE: [F.IMMERSIVE],
  INTERFACE_SIMULATION: [F.CLOSE],
  SCALE_COMPARISON: [F.HORIZON, F.GROUNDED],
  VISUAL_METAPHOR: [F.IMMERSIVE, F.CLOSE],
  // The terminal fallback gets a real shot, not a card. ISOLATED is the one
  // place a sparse frame is the intent rather than an accident: nothing
  // richer was readable, so the composition is atmosphere and distance.
  CINEMATIC_STATEMENT: [F.HORIZON, F.ISOLATED],
};

/**
 * CAMERA MOVES. Each carries the reason it is allowed to exist.
 *
 * `from`/`to` are {scale, x, y} in frame units, applied over the beat by
 * the scene's own state progress — never by raw frame count, so a 2s beat
 * and a 12s beat perform the same move at their own pace (the SRT timing
 * contract is upstream and stays intact).
 *
 * A move with no reason is decoration, and decoration is what makes
 * generated video look generated. `HOLD` exists because most shots should
 * not move at all.
 */
export const CAMERA_MOVES = {
  HOLD: { id: "hold", from: { scale: 1, x: 0, y: 0 }, to: { scale: 1, x: 0, y: 0 }, reason: "the composition is already saying it; movement would be noise" },
  PUSH: { id: "push", from: { scale: 1, x: 0, y: 0 }, to: { scale: 1.16, x: 0, y: -0.01 }, reason: "attention narrows onto one thing" },
  PULL: { id: "pull", from: { scale: 1.34, x: 0, y: 0 }, to: { scale: 1, x: 0, y: 0 }, reason: "the scope turns out to be larger than the subject" },
  TRACK_RIGHT: { id: "track-right", from: { scale: 1.06, x: 0.1, y: 0 }, to: { scale: 1.06, x: -0.1, y: 0 }, reason: "the eye follows something moving downstream" },
  DESCEND: { id: "descend", from: { scale: 1.1, x: 0, y: -0.09 }, to: { scale: 1.05, x: 0, y: 0.06 }, reason: "the frame travels down a sequence" },
  DRIFT: { id: "drift", from: { scale: 1.04, x: 0.018, y: 0 }, to: { scale: 1.06, x: -0.018, y: -0.008 }, reason: "a held shot breathes rather than freezing" },
};

const C = CAMERA_MOVES;

/**
 * Camera per strategy. Deliberately mostly DRIFT or HOLD.
 *
 * A renderer where every scene pushes in is exactly as templated as one
 * where every scene is a centred rectangle — it just costs more frames to
 * notice. The moves below are the ones whose reason survives being asked
 * out loud: PROCESS descends because a sequence runs downward,
 * SCALE_COMPARISON pulls because the reveal IS the scope, CAUSE_EFFECT
 * tracks because causality has a direction.
 */
const STRATEGY_CAMERA = {
  GEOSPATIAL_RADIUS: C.PULL,
  ACCUMULATION: C.DRIFT,
  TRANSFORMATION: C.TRACK_RIGHT,
  COMPARISON: C.DRIFT,
  DATA_CHART: C.TRACK_RIGHT,
  TIMELINE: C.TRACK_RIGHT,
  PROCESS: C.DESCEND,
  CAUSE_EFFECT: C.TRACK_RIGHT,
  RELATIONSHIP: C.DRIFT,
  BEFORE_AFTER: C.DRIFT,
  DOCUMENT_EVIDENCE: C.PUSH,
  IMAGE_EVIDENCE: C.DRIFT,
  INTERFACE_SIMULATION: C.HOLD,
  SCALE_COMPARISON: C.PULL,
  VISUAL_METAPHOR: C.DRIFT,
  CINEMATIC_STATEMENT: C.DRIFT,
};

/**
 * Depth budget: how many planes the shot has, and how fast each one moves
 * relative to the camera.
 *
 * Parallax factors below 1 are behind the subject and lag; above 1 are in
 * front and lead. A shot with one plane is flat by definition, which is
 * most of why a hairline diagram on black reads as a diagram.
 */
export const DEPTH_PROFILES = {
  FLAT: { id: "flat", planes: [{ name: "subject", parallax: 1 }] },
  LAYERED: {
    id: "layered",
    planes: [
      { name: "background", parallax: 0.35 },
      { name: "subject", parallax: 1 },
      { name: "foreground", parallax: 1.35 },
    ],
  },
  DEEP: {
    id: "deep",
    planes: [
      { name: "far", parallax: 0.2 },
      { name: "background", parallax: 0.45 },
      { name: "subject", parallax: 1 },
      { name: "foreground", parallax: 1.5 },
    ],
  },
};

const D = DEPTH_PROFILES;

const STRATEGY_DEPTH = {
  GEOSPATIAL_RADIUS: D.DEEP,
  ACCUMULATION: D.LAYERED,
  TRANSFORMATION: D.LAYERED,
  COMPARISON: D.LAYERED,
  DATA_CHART: D.LAYERED,
  TIMELINE: D.DEEP,
  PROCESS: D.LAYERED,
  CAUSE_EFFECT: D.LAYERED,
  RELATIONSHIP: D.LAYERED,
  BEFORE_AFTER: D.LAYERED,
  DOCUMENT_EVIDENCE: D.LAYERED,
  IMAGE_EVIDENCE: D.LAYERED,
  // A screen is genuinely flat. Faking depth on it would be the same lie as
  // drawing a rectangle for a bottleneck.
  INTERFACE_SIMULATION: D.FLAT,
  SCALE_COMPARISON: D.DEEP,
  VISUAL_METAPHOR: D.LAYERED,
  CINEMATIC_STATEMENT: D.DEEP,
};

/**
 * Compose the shot for one beat.
 *
 * Returns a plain object the scene components read. Everything here is
 * derived — nothing is stored, nothing is cached, and calling it twice with
 * the same beat returns the same shot.
 */
export function composeShot(strategy, plan, opts = {}) {
  const material = STRATEGY_MATERIAL[strategy] || M.ATMOSPHERE;
  const options = STRATEGY_FRAMINGS[strategy] || [F.GROUNDED];

  // The variant ordinal is assigned by mg-package.js across a strategy's
  // uses in one video, so the second COMPARISON in a script is framed
  // differently from the first without anything being random.
  const variant = Number.isFinite(plan && plan.variant) ? plan.variant : 0;
  const framing = options[variant % options.length];

  const camera = STRATEGY_CAMERA[strategy] || C.DRIFT;
  const depth = STRATEGY_DEPTH[strategy] || D.LAYERED;

  return {
    material,
    framing,
    camera,
    depth,
    // Handy derived values so scenes do not each recompute them slightly
    // differently, which is how the cx-0.43 monoculture happened.
    anchorX: framing.anchor[0],
    anchorY: framing.anchor[1],
    coverage: framing.coverage,
    bleed: framing.bleed,
    planes: depth.planes,
    variant,
  };
}

/** Every strategy the shot composer knows about. */
export function composedStrategies() {
  return Object.keys(STRATEGY_MATERIAL);
}

/**
 * Guard: the four tables must cover the same strategies as the registry.
 *
 * A strategy missing from STRATEGY_MATERIAL silently falls back to
 * ATMOSPHERE and a strategy missing from STRATEGY_FRAMINGS silently falls
 * back to GROUNDED — which is exactly the "everything looks the same"
 * failure this module exists to end, arriving quietly through a default.
 */
export function assertCompositionIsComplete(strategies) {
  const failures = [];
  for (const name of Object.keys(strategies)) {
    if (!STRATEGY_MATERIAL[name]) failures.push(`${name} has no material`);
    if (!STRATEGY_FRAMINGS[name]) failures.push(`${name} has no framing`);
    if (!STRATEGY_CAMERA[name]) failures.push(`${name} has no camera`);
    if (!STRATEGY_DEPTH[name]) failures.push(`${name} has no depth profile`);
  }
  for (const name of Object.keys(STRATEGY_MATERIAL)) {
    if (!strategies[name]) failures.push(`${name} is composed but not a registered strategy`);
  }
  return { pass: failures.length === 0, failures };
}

/**
 * Diagnostic: how many strategies share a whole shot signature.
 *
 * Two strategies with the same material, framing, camera and depth will
 * look alike however different their subjects are. This is the structural
 * half of the template check — the pixel half lives in qa-scripts.
 */
export function shotSignatures(strategies) {
  const byShot = {};
  for (const name of Object.keys(strategies)) {
    const s = composeShot(name, { variant: 0 });
    const key = `${s.material}|${s.framing.id}|${s.camera.id}|${s.depth.id}`;
    (byShot[key] = byShot[key] || []).push(name);
  }
  return byShot;
}
