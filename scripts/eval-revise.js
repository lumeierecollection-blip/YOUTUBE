/**
 * eval-revise.js — the eval loop's revise() step: decide, per beat Layer 3 flagged, whether a
 * field-level layout patch fixes something a viewer can SEE, and return that patch or nothing.
 *
 * Before this the call site's revise() returned `{ planPatch: null }`, so once Layer 3's timestamps
 * resolved to beats (67f6a8a) the loop stopped at "planner returned no partial plan patch" — live
 * could not act (HANDOFF 7.33).
 *
 * The model is asked with REVISE_PROMPT (the owner's text, verbatim) and the facts of each flagged
 * beat. Its answer is NOT trusted: validatePatch() re-checks every gate in code —
 *   - anti-churn: a video that passed Layer 1 at or above the acceptance band is not revised; only
 *     flagged beats; at most 2 per video;
 *   - Gate 1: every change names a visible consequence, in words — a score, an axis or a number is
 *     not a visible consequence;
 *   - Gate 2: the patch is a layout change only, and canvasLayout() must draw it AS GIVEN — used on
 *     both axes, no easing, nothing rejected (so inside the table's bottom limit, the span margin and
 *     the zone edges, the checks it already runs); and it must move something (a patch that changes
 *     nothing visible is churn);
 *   - the planner's side is kept: a slot it aligned left / right is not flipped.
 * An empty patch is a valid, expected answer — the video ships as rendered.
 */
import { canvasLayout, normalizeCanvas, flattenBoxes, contentBounds } from "../src/skills/remotion-render/visual/canvas-layout.js";
import { ACCEPT_THRESHOLD } from "./eval-retry-loop.js";

export const MAX_REVISED_BEATS = 2;

export const REVISE_PROMPT = `You are revising a single rendered beat of a short-form video. You receive:
- the beat's plan (visual id, layout slot, text, timing)
- the rendered canvas facts: what the table actually drew (box span, ink span,
  bottom bound), and which axes the planner's layout kept
- Layer 1 result and Layer 3 per-axis scores for this beat, with the judge's
  ground and the channel's style spec
- the beat_index, so you revise the beat the timestamp actually points at

Revise only if BOTH gates pass.

GATE 1 — VISIBLE CONSEQUENCE.
State, in one sentence, what a viewer sees that is wrong. It must be
observable in a single frame without measuring. "Headline collides with the
number" passes. "Composition scored 6.4" fails. "Style coherence is 0.3 below
the run mean" fails. If you cannot name the visible defect, return no patch.

GATE 2 — LEGAL PATCH EXISTS.
The fix must be a field-level change (layout slot, vertical move, text fit)
that stays inside the table's own bounds: never below its bottom limit, never
outside the span margin, never past a zone edge including cutout shadows.
If the only fix is a full re-plan, a new visual, or an illegal position,
return no patch.

ANTI-CHURN.
- If the beat passed Layer 1 and its Layer 3 axes are at or above the run's
  acceptance band, leave it alone. Passing beats are not revised.
- Do not chase score points. The aggregate is a floor, not a target. A change
  that moves a score without changing what a viewer sees is rejected.
- Revise at most the beats the judge flagged as weak, and at most 2 per video.
- Prefer preserving the planner's intent: keep the side it chose, keep its
  vertical move unless Layer 1 requires otherwise. Ease, don't overwrite.

OUTPUT.
Return a patch of the flagged fields only, plus for each field:
- the visible consequence you are fixing
- the old value, the new value, and the axis or gate that forced it
If no beat clears both gates, return an empty patch with the reason. An empty
patch is a valid, expected result — it means the video already ships.

Do not re-render to find out. Decide from the facts given.`;

// The machine-readable answer the pipeline can apply. Only a layout patch is applicable here: the
// renderer fits text to its box itself, and changing a headline's WORDS would change what the video
// claims (CLAUDE.md: every claim traces to the research), so a text patch is not accepted.
export const OUTPUT_FORMAT = `Answer with ONE JSON object, no prose:
{"patches": [{"beat_index": <int>, "layout": {"cols": <int>, "rows": <int>, "slots": [{"id", "col", "row", "col_span", "row_span", "align", "v_align"} | {"id", "x", "y", "w", "h"}]},
  "changes": [{"field": "layout.slots[<id>]", "visible_consequence": "<one sentence a viewer would notice>", "old": <old slot or null>, "new": <new slot>, "forced_by": "<axis or gate>"}]}],
 "reason": "<why these beats, or why the patch is empty>"}
"layout" is the beat's COMPLETE new layout (slots for the elements you place). The only applicable field is the layout; return no patch for a defect a layout cannot fix.`;

export const canvasOf = (beat) => beat?.canvas || beat?.scene?.canvas || null;
const boxMap = (L) => Object.fromEntries(flattenBoxes(L.boxes).map(([k, b]) => [k, [b.x, b.y, b.w, b.h]]));
const spanOf = (L) => (L.boxes?.photo ? null : +((contentBounds(L)?.h ?? 0) / 1920).toFixed(3));

/** Everything the reviser is told about one flagged beat. */
export function beatFacts({ plan, beatIndex, manifest, inkSpans, layer1, layer3, weakBeats, styleSpec, judgeSpec }) {
  const beat = plan?.beats?.[beatIndex];
  const c = canvasOf(beat);
  if (!c) return null;
  const rendered = canvasLayout(normalizeCanvas(c, beatIndex));
  const table = canvasLayout(normalizeCanvas({ ...c, layout: undefined }, beatIndex));
  const bottoms = flattenBoxes(table.boxes).filter(([k]) => k !== "photo").map(([, b]) => b.y + b.h);
  const mb = manifest?.beats?.[beatIndex];
  return {
    beat_index: beatIndex,
    plan: {
      composition: rendered.composition, hero: rendered.hero,
      text: { headline: c.headline || null, lead_in: c.lead_in || null },
      timing: mb ? { start_sec: mb.start_sec, duration_sec: mb.duration_sec } : null,
      planner_layout: c.layout || null,
    },
    rendered: {
      boxes: boxMap(rendered),
      table_boxes: boxMap(table),
      box_span: spanOf(rendered), table_box_span: spanOf(table),
      ink_span: Number.isFinite(inkSpans?.[beatIndex]) ? inkSpans[beatIndex] : null,
      bottom_bound: bottoms.length ? Math.min(1340, Math.max(Math.max(...bottoms), 1316)) : 1340,
      planner_layout_kept: rendered.layout ? { used: rendered.layout.used, axes: rendered.layout.axes, vertical_kept: rendered.layout.y_blend ?? (rendered.layout.axes === "xy" ? 1 : 0), rejected: rendered.layout.rejected } : null,
    },
    layer1: layer1 || null,
    layer3: {
      aggregate_local: layer3?.aggregate_local ?? null, axes: layer3?.axes ?? null,
      flagged: (weakBeats || []).filter((w) => w.beat_index === beatIndex).map((w) => ({ timestamp: w.timestamp, axis: w.axis, element: w.element, finding: w.finding, reason: w.reason || null })),
    },
    acceptance_band: ACCEPT_THRESHOLD,
    judge_ground: judgeSpec ? { bg_mode: judgeSpec.bg_mode ?? null, bg: judgeSpec.colors?.bg ?? null } : null,
    style_spec: styleSpec || null,
  };
}

export function buildRevisePrompt(facts) {
  return `${REVISE_PROMPT}\n\n${OUTPUT_FORMAT}\n\nFACTS (one entry per flagged beat):\n${JSON.stringify(facts, null, 1)}`;
}

const SCORE_TALK = /\b(score|scored|scores|aggregate|axis|axes|mean|band|points?|rating|rated)\b|\d+\.\d+/i;

/** Re-check every gate in code. Returns { accepted: [{beat_index, layout, changes}], rejected: [{beat_index, why}], reason }. */
export function validatePatch(raw, { plan, flagged, layer1Pass, aggregate }) {
  const rejected = [];
  if (layer1Pass && Number.isFinite(aggregate) && aggregate >= ACCEPT_THRESHOLD) return { accepted: [], rejected, reason: `passes Layer 1 at ${aggregate} >= ${ACCEPT_THRESHOLD}: not revised (anti-churn)` };
  const patches = Array.isArray(raw?.patches) ? raw.patches : [];
  if (!patches.length) return { accepted: [], rejected, reason: String(raw?.reason || raw?.error || "the reviser returned no patch") };
  const accepted = [];
  for (const p of patches) {
    const i = Number(p?.beat_index);
    const no = (why) => rejected.push({ beat_index: Number.isInteger(i) ? i : p?.beat_index ?? null, why });
    if (!Number.isInteger(i) || !flagged.includes(i)) { no("not a beat Layer 3 flagged"); continue; }
    if (accepted.length >= MAX_REVISED_BEATS) { no(`more than ${MAX_REVISED_BEATS} beats per video`); continue; }
    const extra = Object.keys(p).filter((k) => !["beat_index", "layout", "changes"].includes(k));
    if (extra.length) { no(`fields other than the layout (${extra.join(", ")})`); continue; }
    if (!p.layout || !Array.isArray(p.layout.slots) || !p.layout.slots.length) { no("no layout slots"); continue; }
    const changes = Array.isArray(p.changes) ? p.changes : [];
    if (!changes.length) { no("no change described"); continue; }
    const bad = changes.find((ch) => !String(ch?.visible_consequence || "").trim() || SCORE_TALK.test(String(ch.visible_consequence)));
    if (bad) { no(`gate 1: "${bad?.visible_consequence || ""}" is not a visible consequence`); continue; }
    const c = canvasOf(plan?.beats?.[i]);
    if (!c) { no("no canvas for the beat"); continue; }
    // The planner's side: a slot it aligned left / right is not flipped.
    const sideOf = (lay) => Object.fromEntries((lay?.slots || []).filter((s) => s?.align === "left" || s?.align === "right").map((s) => [String(s.id), s.align]));
    const before = sideOf(c.layout), after = sideOf(p.layout);
    const flipped = Object.keys(after).filter((k) => before[k] && before[k] !== after[k]);
    if (flipped.length) { no(`flips the planner's side for ${flipped.join(", ")}`); continue; }
    const now = canvasLayout(normalizeCanvas(c, i));
    const next = canvasLayout(normalizeCanvas({ ...c, layout: p.layout }, i));
    const lo = next.layout || {};
    if (!lo.used || lo.axes !== "xy" || lo.y_blend || (lo.rejected || []).length) { no(`gate 2: not drawable as given (${(lo.rejected || []).join("; ") || `axes ${lo.axes}, eased ${lo.y_blend ?? "-"}`})`); continue; }
    if (JSON.stringify(boxMap(next)) === JSON.stringify(boxMap(now))) { no("changes nothing a viewer sees"); continue; }
    accepted.push({ beat_index: i, layout: p.layout, changes });
  }
  return { accepted, rejected, reason: accepted.length ? String(raw?.reason || "") : rejected.length ? "every proposed patch failed a gate" : String(raw?.reason || "no patch") };
}

/**
 * The revise() the eval loop calls. Returns { planPatch, changedBeats, record }: planPatch null when
 * nothing clears the gates (the video ships as rendered).
 */
export async function reviseBeats({ plan, weakBeats, manifest, inkSpans, layer1, layer3, styleSpec, judgeSpec, callModel, log = () => {} }) {
  const flagged = [...new Set((weakBeats || []).filter((w) => Number.isInteger(w?.beat_index) && !w.unresolved).map((w) => w.beat_index))];
  const layer1Pass = !!layer1?.pass;
  const aggregate = Number(layer3?.aggregate_local);
  const record = { flagged, model: null, accepted: [], rejected: [], reason: null };
  if (!flagged.length) { record.reason = "no flagged beat has a beat_index"; return { planPatch: null, changedBeats: [], record }; }
  if (layer1Pass && Number.isFinite(aggregate) && aggregate >= ACCEPT_THRESHOLD) { record.reason = `passes Layer 1 at ${aggregate}: not revised`; return { planPatch: null, changedBeats: [], record }; }
  const facts = flagged.map((i) => beatFacts({ plan, beatIndex: i, manifest, inkSpans, layer1, layer3, weakBeats, styleSpec, judgeSpec })).filter(Boolean);
  let raw;
  try { raw = await callModel(buildRevisePrompt(facts)); } catch (e) { raw = { error: e.message }; }
  record.model = raw && typeof raw === "object" ? { patches: raw.patches ?? null, reason: raw.reason ?? raw.error ?? null } : null;
  const v = validatePatch(raw, { plan, flagged, layer1Pass, aggregate });
  Object.assign(record, { accepted: v.accepted, rejected: v.rejected, reason: v.reason });
  for (const r of v.rejected) log(`[revise] beat ${r.beat_index}: patch rejected — ${r.why}`);
  if (!v.accepted.length) { log(`[revise] empty patch — ${v.reason}`); return { planPatch: null, changedBeats: [], record }; }
  const planPatch = structuredClone(plan);
  for (const a of v.accepted) {
    const b = planPatch.beats[a.beat_index];
    b.layout = a.layout;
    const c = canvasOf(b);
    if (c) c.layout = a.layout;
    for (const ch of a.changes) log(`[revise] beat ${a.beat_index}: ${ch.visible_consequence} — ${ch.field}: ${JSON.stringify(ch.old)} -> ${JSON.stringify(ch.new)} (${ch.forced_by || "-"})`);
  }
  return { planPatch, changedBeats: v.accepted.map((a) => a.beat_index), record };
}
