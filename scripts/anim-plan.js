/**
 * Runs the animation planner (visual/animation-plan.js) over a plan, at the two
 * times it matters:
 *   previewAnimations(beats)        planner time (gemini-visual-plan.js): on the
 *                                   planned beats, so the plan carries
 *                                   `recent_animations` and the [anim] log shows
 *                                   what each beat will do.
 *   assignCanvasAnimations(beats)   resolve time (render-and-qa.js): on the
 *                                   FINAL canvases (a photo that did not resolve
 *                                   is TYPE...), which is
 *                                   what the renderer draws — sets canvas.anim.
 * The choices are the same function's; only the input (planned vs resolved)
 * differs, and the resolver's is authoritative.
 */
import { animationsFor, itemOf } from "../src/skills/remotion-render/visual/animation-plan.js";
import { pickEntrances, numberMode } from "../src/skills/remotion-render/visual/kinetic.js";
import { canvasLayout, normalizeCanvas, compositionFor, splitHeadline } from "../src/skills/remotion-render/visual/canvas-layout.js";

const summary = (b) => Object.entries(b).map(([k, v]) => `${k}=${k === "exit" ? `${v.id}(${v.element})` : v}`).join(", ") || "(no animated element)";

const NUM_ANIM = { count_up: "COUNT_UP", scale_impact: "SCALE_IMPACT", flip_digits: "ROLL_DIGIT" };
const wordsIn = (b) => (b?.words ? b.words.length : String((b?.lines || []).join(" ")).split(" ").filter(Boolean).length);

/**
 * Kinetic type: one entrance per WORD (kinetic.js pickEntrances), chained
 * beat to beat so a word position never repeats its entrance in the next
 * beat and, while an unused one is left, never within the video; the number
 * mode (count_up / scale_impact / flip_digits; a year or article number never
 * counts); the hook (first beat) and CTA (last) as the cross-frame
 * composition. Text roles carry no block animation any more: the planner's
 * headline / kicker / label picks and text exits are dropped, the number pick
 * is replaced by the kinetic mode.
 */
export function assignKinetics(beats, { seed = "", log = () => {} } = {}) {
  const prev = {}, history = {};
  let prevMode = null;
  beats.forEach((b, i) => {
    const c = normalizeCanvas(b.canvas, i), L = canvasLayout(c), B = L.boxes;
    const k = { seed, cross: (i === 0 || i === beats.length - 1) && !!B.statement && !B.number && !B.statement.rotate, entrances: {}, number: null };
    const group = { headline: "headline", statement: "headline", kicker: "label", label: "label" };
    for (const role of ["headline", "statement", "kicker", "label"]) {
      if (!B[role] || !B[role].lines?.length) continue;
      const g = group[role] + (role === "statement" ? "S" : "");
      const n = wordsIn(B[role]);
      const hist = history[g] || (history[g] = []);
      const picks = pickEntrances(n, { seed: `${seed}|${role}`, beat: i, prev: prev[g] || [], history: hist });
      picks.forEach((e, j) => (hist[j] = [...(hist[j] || []), e]));
      prev[g] = picks;
      k.entrances[role] = picks;
    }
    if (B.number) { k.number = numberMode(c.data?.value, { beat: i, seed, prev: prevMode }); prevMode = k.number; }
    b.canvas.kinetic = k;
    const anim = { ...(b.canvas.anim || {}) };
    for (const r of ["headline", "kicker", "label", "exit"]) delete anim[r];
    if (k.number) anim.number = NUM_ANIM[k.number];
    b.canvas.anim = anim;
    log(`[kinetic] beat ${i}: ${Object.entries(k.entrances).map(([r, e]) => `${r}=[${e.join(",")}]`).join(" ") || "(no text)"}${k.number ? ` number=${k.number}` : ""}${k.cross ? " CROSS" : ""}`);
  });
}

/** Beats' resolved canvases -> canvas.anim; returns the run. */
export function assignCanvasAnimations(beats, { seed = "", log = () => {} } = {}) {
  const items = beats.map((b, i) => {
    const c = normalizeCanvas(b.canvas, i);
    return itemOf(c, canvasLayout(c), { last: i === beats.length - 1 });
  });
  const run = animationsFor(items, { seed, log: (m) => log(m) });
  beats.forEach((b, i) => { b.canvas.anim = run.beats[i]; b.recent_animations = run.recent[i]; });
  assignKinetics(beats, { seed, log });
  return run;
}

/** Planned beats -> a preview (the same rules on the planned visuals); sets beat.animations and plan-level recent_animations. */
export function previewAnimations(beats, { seed = "", log = () => {} } = {}) {
  const items = beats.map((b, i) => {
    const vt = String(b.visual_type || "TYPE").toUpperCase();
    const image = ["PHOTO", "DOCUMENT", "MONEY"].includes(vt);
    const c = normalizeCanvas({
      visual_type: vt, data: vt === "TYPE" ? null : b.data || null, lead_in: b.lead_in || null, headline: b.headline || b.caption || "", emphasis_word: b.emphasis_word || null,
      // Assume an image resolves; the resolver has the last word.
      photo: image ? { asset: "planned", entity: b.data?.entity || null } : null,
      motion_tier: b.motion_tier || "medium",
      composition: compositionFor(vt, image, { split: b.type_layout === "split" && !!splitHeadline(b.headline) }),
    }, i);
    return itemOf(c, canvasLayout(c), { last: i === beats.length - 1 });
  });
  const run = animationsFor(items, { seed, log });
  beats.forEach((b, i) => { b.animations = run.beats[i]; b.recent_animations = run.recent[i]; });
  return run;
}
export { summary };
