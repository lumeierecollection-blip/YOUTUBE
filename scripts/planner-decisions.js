/**
 * The planner (gemini-visual-plan.js) is told what a channel looks like and decides, beat by
 * beat, the ground, the type, the motion tier and the composition. The helpers here are the
 * parts of that which are pure enough to test without a model:
 *
 *   applyMotionTiers     keep the planner's own tiers; the old 2-3 majors rule only when it marked none
 *   normalizeGrounds     the planner's `ground` -> a hex, or the default white, logged
 *   compositionsUsed     how often each composition is drawn, and whether one dominates
 */
import { resolveGround } from "../src/skills/remotion-render/visual/backgrounds.js";

/**
 * Motion tiers: the planner's own. Any number of beats may be "major", up to all of them. Only when
 * the planner marked NONE does the old rule apply (2-3 majors, 1 under 4 beats: the hook, then the
 * close, then the middle) so a plan that said nothing still renders with some emphasis.
 * Mutates and returns { majors, defaulted }.
 */
export function applyMotionTiers(beats, log = () => {}) {
  const n = beats.length;
  for (const b of beats) if (!["micro", "medium", "major"].includes(b.motion_tier)) b.motion_tier = "medium";
  const majors = () => beats.map((b, i) => (b.motion_tier === "major" ? i : -1)).filter((i) => i >= 0);
  let m = majors();
  let defaulted = false;
  if (!m.length && n) {
    defaulted = true;
    const lo = n >= 4 ? 2 : 1;
    for (const i of [0, n - 1, Math.floor(n / 2)]) {
      if (m.length >= lo) break;
      if (i >= 0 && i < n && beats[i].motion_tier !== "major") { beats[i].motion_tier = "major"; m.push(i); log(`[plan] beat ${i}: motion_tier -> major (the planner marked none; the default is ${lo}-3)`); }
    }
  }
  return { majors: majors(), defaulted };
}

/**
 * Resolve every beat's `ground` (hex | "white" | "transparent" | a description) and write the result
 * back: `ground` becomes "white" or a hex, `ground_source` says how it was read. A ground that
 * cannot be read keeps the default and is logged as ground_unparsed — never a failure.
 */
export function normalizeGrounds(beats, log = () => {}) {
  const counts = {};
  beats.forEach((b, i) => {
    const wrote = b.ground;
    const g = resolveGround(wrote);
    b.ground = g.hex || "white";
    b.ground_source = g.source;
    const key = g.hex || "white";
    counts[key] = (counts[key] || 0) + 1;
    if (g.source === "unparsed") log(`[plan] beat ${b.index ?? i}: ground_unparsed — ${g.note}; the default white is used`);
    else if (g.source === "transparent") log(`[plan] beat ${b.index ?? i}: ground "transparent" -> white (${g.note})`);
    else if (g.hex) log(`[plan] beat ${b.index ?? i}: ground ${JSON.stringify(wrote)} -> ${g.hex} (${g.source}${g.dark ? ", dark: light ink" : ""})`);
  });
  return counts;
}

/**
 * { counts, share, top, topShare, templated } for a list of composition names.
 * `templated` is true when one composition fills more than `limit` of the beats — a signal to
 * REPORT (templating), never something this code corrects.
 */
export function compositionsUsed(compositions, limit = 0.6) {
  const counts = {};
  for (const c of compositions) counts[c] = (counts[c] || 0) + 1;
  const n = compositions.length;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [top, topN] = entries[0] || [null, 0];
  return { counts, n, top, topShare: n ? topN / n : 0, templated: n > 0 && topN / n > limit };
}

/**
 * After the challenger's re-plan: a beat the challenger did NOT block that came back without a
 * layout gets the layout the planner itself gave it in the first plan. The re-plan answers the
 * corrections and drops optional fields it was not asked about (CI runs 37705693390, 37713312537,
 * 37718157561: first plan 9/9 and 10/10 layouts, re-plan 0) — this keeps the planner's own earlier
 * decision; it invents nothing. A blocked beat is left as re-planned. Returns the carried indices.
 */
export function carryPlannerLayouts(firstPlan, replanned, blocked = []) {
  const skip = new Set(blocked.map(Number));
  const carried = [];
  (replanned?.beats || []).forEach((b, i) => {
    const prev = firstPlan?.beats?.[i];
    const idx = Number.isInteger(b?.index) ? b.index : i;
    if (skip.has(idx) || b?.layout || !prev?.layout || !Array.isArray(prev.layout.slots) || !prev.layout.slots.length) return;
    b.layout = structuredClone(prev.layout);
    carried.push(idx);
  });
  return carried;
}
