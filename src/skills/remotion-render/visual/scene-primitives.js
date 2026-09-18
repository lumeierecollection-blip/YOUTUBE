/**
 * SCENE PRIMITIVES — the vocabulary Gemini composes with.
 *
 * Plain .js, no JSX, no deps, same reason as narrative-typography.js,
 * scene-text.js and plan-adjustments.js: the Remotion bundle imports it, the
 * node side imports it, and the tests import it, so the vocabulary cannot
 * drift between the thing that declares a scene and the thing that draws it.
 *
 * WHY THIS REPLACES THE MECHANISM LIBRARY
 *
 * The directed renderer had NINE hardcoded scene functions — TypographyScene,
 * StateChangeScene, ConsumptionScene, and six more — and every video was
 * assembled from those nine. All nine draw text plus a couple of simple
 * shapes on a flat ground, so every frame came out ~90% empty and every
 * video looked like the last one.
 *
 * Gemini said so, unanimously: across runs 35293642808, 35317469026 and
 * 35319923732, SIXTEEN OF SIXTEEN verdicts attributed the failure to
 * RENDER_TECHNICAL — "template monoculture... repetitive text-heavy headline
 * slides and abstract charts instead of a continuous visual argument". Its
 * direction was not the problem; the nine tiles it had to build from were.
 * Re-planning inside that vocabulary could not converge, which is exactly
 * what three correction attempts per channel kept demonstrating.
 *
 * THE TRADE THIS MODULE MAKES
 *
 * Gemini stops choosing a mechanism from an enum and instead COMPOSES a
 * scene from parts: what objects are on screen, how many, where, how they
 * move. That is real freedom over composition.
 *
 * But it composes from a DECLARED set of parts, and that is deliberate. A
 * model describing scenes with no idea what is buildable produces directives
 * the system cannot execute — the exact failure this pipeline already had
 * when REMOVE_TYPOGRAPHY applied, verified, and was silently undone by the
 * renderer. Every declaration here is buildable by construction, and
 * validateScene() proves it before a frame is rendered.
 *
 * TWO GUARANTEES
 *
 *   BUILDABLE  every primitive, anchor and motion named in a declaration
 *              exists, and its parameters are in range.
 *   OCCUPIED   the declaration fills enough of the frame. This is the
 *              anti-void rule, and it is measured, not requested: the
 *              defect being fixed is literally "one line of text in an
 *              empty frame", so a scene that would render mostly empty is
 *              INVALID rather than merely discouraged.
 */

/* ── Canvas and safe area (mirrors layout/slots.js) ──────────────────── */

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

/**
 * The shorts safe rect. Asymmetric on purpose — YouTube's action buttons run
 * down the right edge, so content sits left of true centre.
 */
export const SAFE = { left: 48, right: 888, top: 288, bottom: 1248 };
export const SAFE_W = SAFE.right - SAFE.left;   // 840
export const SAFE_H = SAFE.bottom - SAFE.top;   // 960

/* ── Anchors ─────────────────────────────────────────────────────────── */

/**
 * Named positions inside the safe rect, as fractions. Gemini names an anchor
 * rather than computing pixels, so a scene cannot be declared off-screen.
 */
export const ANCHORS = {
  center:       { x: 0.50, y: 0.50 },
  top:          { x: 0.50, y: 0.14 },
  bottom:       { x: 0.50, y: 0.86 },
  left:         { x: 0.18, y: 0.50 },
  right:        { x: 0.82, y: 0.50 },
  top_left:     { x: 0.18, y: 0.14 },
  top_right:    { x: 0.82, y: 0.14 },
  bottom_left:  { x: 0.18, y: 0.86 },
  bottom_right: { x: 0.82, y: 0.86 },
  upper_third:  { x: 0.50, y: 0.28 },
  lower_third:  { x: 0.50, y: 0.72 },
  full:         { x: 0.50, y: 0.50 },   // occupies the whole rect
};

export function anchorPoint(name) {
  const a = ANCHORS[name] || ANCHORS.center;
  return { x: SAFE.left + SAFE_W * a.x, y: SAFE.top + SAFE_H * a.y };
}

/* ── Motions ─────────────────────────────────────────────────────────── */

/**
 * How a primitive behaves over its beat. Motion is declarative so the
 * renderer owns the easing and the settle point — and so nothing can
 * animate opacity down to a permanent fraction, which is how translucent
 * text kept failing the contrast gate (COL-24).
 */
export const MOTIONS = [
  "appear",    // fade/scale in, then hold
  "rise",      // enter from below
  "grow",      // scale or extend from zero to final
  "drain",     // fill level falls
  "fill",      // fill level rises
  "fall",      // pieces detach and drop
  "strike",    // a line sweeps across it
  "split",     // separates into parts
  "count",     // numeric roll-up
  "reveal",    // masked wipe
  "hold",      // static presence
];

export function isMotion(m) {
  return MOTIONS.includes(m);
}

/* ── Primitives ──────────────────────────────────────────────────────── */

/**
 * The buildable parts.
 *
 * `area` is the fraction of the SAFE RECT one unit of this primitive covers
 * at scale 1. It is what makes the occupancy rule measurable rather than a
 * matter of opinion. Values are deliberately conservative — they describe
 * ink on screen, not bounding boxes.
 *
 * `countable` primitives repeat (`count`), and their coverage scales with it.
 */
export const PRIMITIVES = {
  block:    { area: 0.030, countable: true,  maxCount: 60, labelable: true,
              note: "a solid rectangle; stacks, falls, breaks apart" },
  stack:    { area: 0.180, countable: true,  maxCount: 24, labelable: true,
              note: "a column of blocks — quantity you can see accumulate" },
  bar:      { area: 0.090, countable: true,  maxCount: 12, labelable: true,
              note: "proportional length; comparison without a chart frame" },
  vessel:   { area: 0.220, countable: true,  maxCount: 6,  labelable: true,
              note: "a container with a fill level; drains or fills" },
  document: { area: 0.260, countable: true,  maxCount: 8,  labelable: true,
              note: "a page or sheet; can tear, stamp, highlight" },
  grid:     { area: 0.380, countable: false, labelable: true,
              note: "a field of cells; scale and proportion at a glance" },
  gauge:    { area: 0.200, countable: true,  maxCount: 4,  labelable: true,
              note: "circular meter with a reading" },
  figure:   { area: 0.130, countable: false, labelable: true,
              note: "one large number — the evidence itself" },
  counter:  { area: 0.110, countable: false, labelable: true,
              note: "a number that rolls up or down" },
  silhouette: { area: 0.150, countable: true, maxCount: 20, labelable: true,
              note: "a human/object outline; population, crowd, scale" },
  arrow:    { area: 0.040, countable: true,  maxCount: 8,  labelable: false,
              note: "directional connector between objects" },
  rule:     { area: 0.015, countable: true,  maxCount: 6,  labelable: false,
              note: "a dividing line; structure, not decoration" },
  field:    { area: 0.450, countable: false, labelable: false,
              note: "a textured ground plane — depth so objects are not floating in void" },
};

export function isPrimitive(kind) {
  return Object.prototype.hasOwnProperty.call(PRIMITIVES, kind);
}

/**
 * Width:height ratio each primitive wants. Layout lives here rather than in
 * the renderer so the validator and the renderer agree on where an object
 * lands — the same single-source rule that keeps the manifest and the
 * renderer from disagreeing about text.
 */
export const ASPECT = {
  block: 1.4, stack: 0.45, bar: 3.2, vessel: 0.55, document: 0.72,
  grid: 1.1, gauge: 1, figure: 2.6, counter: 2.2, silhouette: 0.45,
  arrow: 1, rule: 12, field: 1.6,
};

/**
 * The rect an object occupies inside the safe area, from its anchor, its
 * primitive's natural area, and its scale. Clamped so nothing can be
 * declared outside the safe rect.
 */
export function objectRect(obj) {
  const spec = PRIMITIVES[obj.kind];
  if (!spec) return null;
  const count = spec.countable ? Math.max(1, Math.min(spec.maxCount, obj.count || 1)) : 1;
  const scale = typeof obj.scale === "number" ? Math.max(0.2, Math.min(2, obj.scale)) : 1;

  // `field` is a ground plane: it always spans the rect.
  if (obj.kind === "field") {
    return { x: SAFE.left, y: SAFE.top, w: SAFE_W, h: SAFE_H };
  }

  const areaPx = spec.area * Math.sqrt(count) * scale * SAFE_W * SAFE_H;
  const aspect = ASPECT[obj.kind] || 1;
  let w = Math.sqrt(areaPx * aspect);
  let h = w / aspect;
  w = Math.min(w, SAFE_W);
  h = Math.min(h, SAFE_H);

  const c = anchorPoint(obj.anchor || "center");
  let x = c.x - w / 2;
  let y = c.y - h / 2;
  // Keep it inside the safe rect rather than letting an anchor push it out.
  x = Math.max(SAFE.left, Math.min(x, SAFE.right - w));
  y = Math.max(SAFE.top, Math.min(y, SAFE.bottom - h));
  return { x, y, w, h };
}

/** Every primitive name, for prompts and error messages. */
export function primitiveNames() {
  return Object.keys(PRIMITIVES);
}

/* ── Layout ──────────────────────────────────────────────────────────── */

/**
 * Place every object in a NON-OVERLAPPING rect.
 *
 * objectRect() alone is not enough: it honours an anchor, and two objects
 * that both want "center" (or that want anchors whose natural sizes
 * overlap) end up drawn on top of each other. The first composed preview
 * did exactly that — a `grid` and ten `silhouette`s blended into an
 * unreadable blob, and a label landed inside the object it belonged to.
 *
 * So layout is a slot assignment, not a free placement. The safe rect is
 * divided into as many columns/rows as there are placeable objects, each
 * object takes the slot nearest its requested anchor, and its natural size
 * is fitted INSIDE that slot. A `field` is not placeable — it is the ground
 * and always spans everything.
 *
 * Returns [{ obj, rect, slot }] in declaration order, so draw order (and
 * therefore z-order) is preserved.
 */
export function layoutScene(objects) {
  const list = objects || [];
  const ground = list.filter((o) => o && o.kind === "field");
  const placeable = list.filter((o) => o && o.kind !== "field" && PRIMITIVES[o.kind]);

  const n = placeable.length;
  // Arrangement: keep it coarse. More than 6 objects in one frame is
  // clutter, and the validator warns about it separately.
  const cols = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(n / cols));
  const pad = 18;
  const slotW = (SAFE_W - pad * (cols - 1)) / cols;
  const slotH = (SAFE_H - pad * (rows - 1)) / rows;

  // Rank slots by distance to each object's anchor, then assign greedily so
  // a requested anchor is honoured when it can be.
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({
        i: slots.length,
        x: SAFE.left + c * (slotW + pad),
        y: SAFE.top + r * (slotH + pad),
        w: slotW, h: slotH,
        cx: SAFE.left + c * (slotW + pad) + slotW / 2,
        cy: SAFE.top + r * (slotH + pad) + slotH / 2,
        taken: false,
      });
    }
  }

  const out = [];
  for (const o of ground) {
    out.push({ obj: o, rect: { x: SAFE.left, y: SAFE.top, w: SAFE_W, h: SAFE_H }, slot: null });
  }

  for (const o of placeable) {
    const want = anchorPoint(o.anchor || "center");
    let best = null, bestD = Infinity;
    for (const s of slots) {
      if (s.taken) continue;
      const d = (s.cx - want.x) ** 2 + (s.cy - want.y) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best) best = slots[0];
    best.taken = true;

    // Fit the object's natural aspect inside its slot, leaving room under
    // it for a label when it has one.
    const spec = PRIMITIVES[o.kind];
    const aspect = ASPECT[o.kind] || 1;
    const labelRoom = spec.labelable && o.label ? 54 : 0;
    const availH = Math.max(40, best.h - labelRoom);
    const scale = typeof o.scale === "number" ? Math.max(0.2, Math.min(2, o.scale)) : 1;
    let w = best.w * Math.min(1, scale);
    let h = w / aspect;
    if (h > availH) { h = availH; w = h * aspect; }
    w = Math.min(w, best.w);
    const x = best.x + (best.w - w) / 2;
    const y = best.y + (availH - h) / 2;
    out.push({ obj: o, rect: { x, y, w, h }, slot: best.i });
  }

  // Preserve declaration order for z-index.
  const order = new Map(list.map((o, i) => [o, i]));
  out.sort((a, b) => (order.get(a.obj) ?? 0) - (order.get(b.obj) ?? 0));
  return out;
}

/* ── Occupancy ───────────────────────────────────────────────────────── */

/**
 * Minimum fraction of the safe rect a scene must cover.
 *
 * Derived from the defect, not chosen for taste. The rejected renders put a
 * single text line on an otherwise empty frame; measured against the safe
 * rect, one narrative line covers roughly 0.06-0.13. A floor of 0.35 makes
 * that scene INVALID, which is the point — "floating text in a void" stops
 * being expressible.
 *
 * Not higher, because a deliberately spare frame is a legitimate choice and
 * over-filling is its own kind of slop.
 */
export const MIN_SCENE_COVERAGE = 0.35;

/** Above this a scene is cluttered rather than composed. */
export const MAX_SCENE_COVERAGE = 0.92;

/**
 * Estimated fraction of the safe rect a declaration covers.
 *
 * Coverage is summed and then damped, because objects overlap and a naive
 * sum would let ten small primitives claim a full frame they do not fill.
 * The damping is intentionally pessimistic: it is better to reject a scene
 * that would have been fine than to ship another empty one.
 */
export function estimateCoverage(objects) {
  let sum = 0;
  for (const o of objects || []) {
    const spec = PRIMITIVES[o.kind];
    if (!spec) continue;
    const count = spec.countable ? Math.max(1, Math.min(spec.maxCount, o.count || 1)) : 1;
    const scale = typeof o.scale === "number" ? Math.max(0.2, Math.min(2, o.scale)) : 1;
    // A repeated primitive does not cover count x area — the repeats sit in
    // one arrangement. sqrt keeps growth real but sublinear.
    sum += spec.area * Math.sqrt(count) * scale;
  }
  // Soft saturation: approaches 1 without exceeding it.
  return +(1 - Math.exp(-sum)).toFixed(3);
}

/* ── Validation ──────────────────────────────────────────────────────── */

/**
 * Is this scene declaration BUILDABLE and OCCUPIED?
 *
 * Returns { ok, errors, warnings, coverage }. Errors mean the renderer
 * cannot or must not draw it; the caller is expected to reject the scene and
 * tell Gemini exactly what to change, the same contract as
 * plan-adjustments.js. Nothing here is silently repaired — a scene the
 * system quietly "fixes" is how enforcement became invisible before.
 */
/**
 * Strip fields a primitive cannot use but which change nothing.
 *
 * `count: 1` on a non-countable is a no-op — one of a thing is one of a
 * thing. A `label` on a primitive that draws no label simply is not drawn.
 * Neither alters the intended output, so neither should reject a beat.
 *
 * This distinction was learned expensively. The prompt's JSON example
 * showed every field on every object, so the model put `count: 1` and a
 * label on `field`, and the validator rejected 0/6 beats in run
 * 35356611503 — a 100% fallback rate caused by cosmetic redundancy, not by
 * a single genuine composition error. The prompt example is fixed too, but
 * a contract that fails on a harmless extra key is too brittle to survive
 * a model's paraphrasing.
 *
 * What stays an ERROR is anything that changes the intent: `count: 5` on a
 * non-countable means the model wanted five and would get one.
 */
export function normalizeScene(scene) {
  const objects = (scene && scene.objects) || [];
  const dropped = [];
  const cleaned = objects.map((o, i) => {
    if (!o || typeof o !== "object") return o;
    const spec = PRIMITIVES[o.kind];
    if (!spec) return o;
    const out = { ...o };
    if (out.count !== undefined && !spec.countable && out.count === 1) {
      delete out.count;
      dropped.push(`objects[${i}]: dropped redundant count:1 on "${o.kind}" (not countable)`);
    }
    if (out.label !== undefined && out.label !== null && !spec.labelable) {
      delete out.label;
      dropped.push(`objects[${i}]: dropped label on "${o.kind}" (draws no label)`);
    }
    return out;
  });
  return { scene: { ...scene, objects: cleaned }, dropped };
}

export function validateScene(rawScene) {
  // Normalise first: harmless redundancy becomes a warning, never a reject.
  const { scene, dropped } = normalizeScene(rawScene);
  const errors = [];
  const warnings = [...dropped];
  const objects = (scene && scene.objects) || [];

  if (!scene || typeof scene !== "object") {
    return { ok: false, errors: ["scene is not an object"], warnings, coverage: 0 };
  }
  if (!Array.isArray(scene.objects) || objects.length === 0) {
    errors.push("scene.objects is empty — a beat with no objects is the empty frame this vocabulary exists to prevent");
  }

  objects.forEach((o, i) => {
    const at = `objects[${i}]`;
    if (!o || typeof o !== "object") { errors.push(`${at}: not an object`); return; }

    if (!isPrimitive(o.kind)) {
      errors.push(`${at}: unknown primitive "${o.kind}" — use one of: ${primitiveNames().join(", ")}`);
      return;
    }
    const spec = PRIMITIVES[o.kind];

    if (o.anchor !== undefined && !ANCHORS[o.anchor]) {
      errors.push(`${at}: unknown anchor "${o.anchor}" — use one of: ${Object.keys(ANCHORS).join(", ")}`);
    }
    if (o.motion !== undefined && !isMotion(o.motion)) {
      errors.push(`${at}: unknown motion "${o.motion}" — use one of: ${MOTIONS.join(", ")}`);
    }
    if (o.count !== undefined) {
      if (!Number.isInteger(o.count) || o.count < 1) {
        errors.push(`${at}: count must be a positive integer`);
      } else if (!spec.countable) {
        // count:1 was already normalised away; anything above 1 is a real
        // mismatch between what was asked for and what would be drawn.
        errors.push(`${at}: "${o.kind}" is not countable but count is ${o.count} — only one is ever drawn, so use a countable primitive (block, stack, bar, silhouette) or drop count`);
      } else if (o.count > spec.maxCount) {
        errors.push(`${at}: count ${o.count} exceeds max ${spec.maxCount} for "${o.kind}"`);
      }
    }
    if (o.scale !== undefined && (typeof o.scale !== "number" || o.scale < 0.2 || o.scale > 2)) {
      errors.push(`${at}: scale must be a number between 0.2 and 2`);
    }
    // A label on an unlabelable primitive was already normalised away; if
    // one survives here the primitive table and the normaliser disagree,
    // which is a bug worth surfacing rather than a direction error.
    if (o.label !== undefined && o.label !== null && !spec.labelable) {
      errors.push(`${at}: "${o.kind}" cannot carry a label and normalisation did not strip it`);
    }
  });

  const coverage = estimateCoverage(objects);
  if (objects.length && coverage < MIN_SCENE_COVERAGE) {
    errors.push(
      `scene covers only ${(coverage * 100).toFixed(0)}% of the frame (minimum ${(MIN_SCENE_COVERAGE * 100).toFixed(0)}%) — ` +
      `this is the empty-frame defect: add objects, raise a count, or use a larger primitive (grid, field, document, vessel)`
    );
  }
  if (coverage > MAX_SCENE_COVERAGE) {
    warnings.push(`scene covers ${(coverage * 100).toFixed(0)}% — likely cluttered`);
  }

  // Text is emphasis, never the scene. A declaration whose only content is
  // labels is the void frame wearing a different hat.
  const labelled = objects.filter((o) => o.label && String(o.label).trim()).length;
  if (objects.length && labelled === objects.length && objects.length > 2) {
    warnings.push("every object is labelled — labels should mark the few that need naming, not all of them");
  }

  return { ok: errors.length === 0, errors, warnings, coverage };
}

/**
 * A compact, human- and model-readable description of the vocabulary, for
 * the planning prompt. Generated from PRIMITIVES so the prompt can never
 * advertise a part that does not exist — the drift that put three
 * conflicting word budgets in three files.
 */
export function vocabularyDigest() {
  const lines = ["PRIMITIVES (kind — what it is):"];
  for (const [kind, s] of Object.entries(PRIMITIVES)) {
    const c = s.countable ? `, count 1-${s.maxCount}` : "";
    const l = s.labelable ? ", labelable" : "";
    lines.push(`  ${kind} — ${s.note}${c}${l}`);
  }
  lines.push("", `ANCHORS: ${Object.keys(ANCHORS).join(", ")}`);
  lines.push(`MOTIONS: ${MOTIONS.join(", ")}`);
  lines.push("", `A scene must cover at least ${(MIN_SCENE_COVERAGE * 100).toFixed(0)}% of the frame.`);
  return lines.join("\n");
}
