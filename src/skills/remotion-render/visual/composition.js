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
/**
 * TWO RULES, TAKEN FROM `vendor/video-shotcraft` (Apache-2.0), which this
 * repo already vendors as a shot reference. Both are stated there as hard
 * numbers with the failure they prevent, and the first draft of this table
 * broke both.
 *
 * 1. THE GRADIENT BETWEEN ADJACENT PLANES MUST BE >= 2x, or the separation
 *    is not perceptible. The first draft used 0.35 / 1 / 1.35 and
 *    0.2 / 0.45 / 1 / 1.5 — the foreground steps were 1.35x and 1.5x, so
 *    the foreground plane was doing arithmetic and not much else.
 *
 * 2. PARALLAX ALONE IS NOT DEPTH. Without a blur / desaturation anchor the
 *    reference says layers read as stickers sliding around rather than as
 *    distance, which is exactly what an offset-only implementation gives
 *    you. So each plane carries its own `blur`, `saturate` and `opacity`,
 *    and the SUBJECT plane is always perfectly sharp — the viewer is
 *    reading it.
 *
 * The reference also caps depth at four planes; DEEP is at the cap.
 */
export const DEPTH_PROFILES = {
  FLAT: { id: "flat", planes: [{ name: "subject", parallax: 1, blur: 0, saturate: 1, opacity: 1 }] },
  LAYERED: {
    id: "layered",
    planes: [
      { name: "background", parallax: 0.32, blur: 2, saturate: 0.92, opacity: 0.85 },
      { name: "subject", parallax: 1, blur: 0, saturate: 1, opacity: 1 },
      { name: "foreground", parallax: 2.1, blur: 3, saturate: 1, opacity: 0.9 },
    ],
  },
  DEEP: {
    id: "deep",
    planes: [
      { name: "far", parallax: 0.14, blur: 3, saturate: 0.86, opacity: 0.7 },
      { name: "background", parallax: 0.34, blur: 2, saturate: 0.92, opacity: 0.85 },
      { name: "subject", parallax: 1, blur: 0, saturate: 1, opacity: 1 },
      { name: "foreground", parallax: 2.2, blur: 3.5, saturate: 1, opacity: 0.9 },
    ],
  },
};

/**
 * How far one depth plane must move IN ADDITION to the camera, at eased
 * progress `e` through the beat.
 *
 * THE SIGN HERE WAS WRONG AND THE DEPTH READ BACKWARDS. `Shot` translates
 * the whole world by the camera's travel, so content at parallax factor k
 * should end up having moved k times that travel; the plane therefore adds
 * `(k - 1) * travel`. The first version added `(k - 1) * travel * -1`,
 * which on TIMELINE's TRACK_RIGHT move sent the FAR plane 1.86x the
 * camera's distance (it should go 0.14x) and sent the FOREGROUND plane
 * BACKWARDS at -0.20x. Near and far were inverted, so every scene using
 * planes was reading its own depth inside out.
 *
 * PURE AND IN .js DELIBERATELY: the component that uses it is .jsx, which
 * node cannot import, and the last time geometry lived only in a component
 * the test re-derived it and drifted. One model, two callers.
 */
export function planeOffset(shot, depth, e) {
  if (!shot || !shot.camera) return { x: 0, y: 0, factor: 1 };
  const plane = (shot.planes || []).find((p) => p.name === depth);
  const factor = plane ? plane.parallax : 1;
  const cam = shot.camera;
  const travelX = (cam.to.x - cam.from.x) * 1080 * e;
  const travelY = (cam.to.y - cam.from.y) * 1920 * e;
  return { x: travelX * (factor - 1), y: travelY * (factor - 1), factor };
}

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
// ─────────────────────────────────────────────────────────────────────────────
// MOT-18 — motion blur only inside a transition subtree
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The primitives that count as MOTION blur in this composition graph,
 * distinct from DEPTH blur. The only blur today is DEPTH blur: the fixed
 * per-plane `blur` constants in DEPTH_PROFILES, applied by stage.jsx from the
 * resolved plane value — never a function of frame/progress, so it can never
 * read as motion. MOTION blur is temporal: Remotion's CameraMotionBlur
 * averages `samples` time-offset frames, so on a frame with no motion it
 * averages a frame with itself — a useless, colour-destructive smear of
 * what-did-not-move. The vendored shotcraft reference confines CameraMotionBlur
 * to camera-move / transition segments only (demos/transition/shot-transitions/
 * WhipPanReal.tsx: "blur 只包甩动段 ... 0–35 A hold → 35–43 甩(糊) → 43–120 B
 * hold(真静止)"). MOT-18: these may exist ONLY inside a transition subtree;
 * everywhere else (holds, subtitle stages, end card) they must be 0.
 */
/**
 * PHASE 4 SELF-MATCH FIX (data/audit/12/audit-motion.ledger.md): the probe
 * scans THIS file as part of the composition graph, so the three signal
 * tokens below are declared SPLIT and assembled from fragments at import
 * time. No signal token appears as a contiguous string anywhere in this
 * module's source text; FRAME_BLUR_RE is a literal whose own raw text can
 * never satisfy its pattern, and the comment above it never pairs a blur
 * call with a frame token — so the whole gate module scans clean. This
 * exemption is BYTE-LEVEL, not a region skip: a real violation planted on
 * ANY line of ANY file still matches the same regexes (probe fixture 4
 * plants one two lines after this block and asserts it is caught). A
 * regression that rewrites these declarations as naive literals re-fails
 * the probe loudly, which is the point.
 */
const MOTION_BLUR_SIGNAL_TOKENS = {
  package: '@remotion' + '/' + 'motion-blur',
  camera: '<' + 'CameraMotionBlur',
  trail: '<' + 'Trail',
};
export const MOTION_BLUR_SIGNALS = [
  { name: MOTION_BLUR_SIGNAL_TOKENS.package + ' package', re: new RegExp(MOTION_BLUR_SIGNAL_TOKENS.package) },
  { name: MOTION_BLUR_SIGNAL_TOKENS.camera + '>', re: new RegExp(MOTION_BLUR_SIGNAL_TOKENS.camera + '\\b') },
  { name: MOTION_BLUR_SIGNAL_TOKENS.trail + '> (motion-blur package)', re: new RegExp(MOTION_BLUR_SIGNAL_TOKENS.trail + '\\b') },
];

/**
 * A filter whose radius is driven by frame or progress (written in code as
 * `blur( ... )`) is a blur that follows motion — motion blur, which MOT-18
 * bans outside a transition subtree. The depth blur in stage.jsx is a
 * resolved constant after the "blur(" — it can never match this class.
 * A future mistake that animates that depth blur per frame turns a depth
 * anchor into motion blur, and this regex catches it.
 */
export const FRAME_BLUR_RE = /blur\(\s*.*?(?:interpolate\s*\(|ease\s*\(|progressOf\s*\(|Math\.(?:sin|cos)\s*\(|\bframe\b|\bp\b\s*[*+])/;

/**
 * Pure scanner: given one source file's text and whether that file is a
 * transition context, return its motion-blur signals, each tagged with line
 * and in/out of transition. Pure (takes text, not paths) so a test can feed
 * planted source and prove the scanner has teeth.
 */
export function scanMotionBlurSource(src, { isTransitionContext = false } = {}) {
  const hits = [];
  const lines = String(src).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const sig of MOTION_BLUR_SIGNALS) {
      if (sig.re.test(line)) hits.push({ line: i + 1, signal: sig.name, inTransition: isTransitionContext });
    }
    if (/blur\(/.test(line) && FRAME_BLUR_RE.test(line)) {
      hits.push({ line: i + 1, signal: "frame-driven blur (a blur that follows motion)", inTransition: isTransitionContext });
    }
  }
  return hits;
}

/**
 * A file path is a transition context when it is the transition subsystem
 * itself (a transition/presentation component, or the transition code in
 * beats.js). Every other file is by definition a hold/subtitle/resting
 * context, so a motion-blur signal there is OUTSIDE any transition subtree.
 */
export function isTransitionContextFile(filePath) {
  const base = String(filePath).toLowerCase().replace(/\\/g, "/");
  return /(?:^|\/)(?:transition|transitions|presentation|presentations)\b/.test(base);
}

/**
 * MOT-18 gate over the whole graph. `sourceMap` maps path -> source text.
 * Pass iff every motion-blur signal is inside a transition subtree
 * (outsideTransition === 0).
 */
export function gateMotionBlur(sourceMap) {
  const outside = [];
  const inside = [];
  let totalHits = 0;
  for (const [file, src] of Object.entries(sourceMap)) {
    const inTransition = isTransitionContextFile(file);
    for (const h of scanMotionBlurSource(src, { isTransitionContext: inTransition })) {
      totalHits += 1;
      (h.inTransition ? inside : outside).push({ file, ...h });
    }
  }
  return {
    pass: outside.length === 0,
    totalMotionBlur: totalHits,
    outsideTransition: outside.length,
    insideTransition: inside.length,
    detail: { inside, outside },
  };
}
