/**
 * Runs the animation planner (visual/animation-plan.js) over a plan, at the two
 * times it matters:
 *   previewAnimations(beats)        planner time (gemini-visual-plan.js): on the
 *                                   planned beats, so the plan carries
 *                                   `recent_animations` and the [anim] log shows
 *                                   what each beat will do.
 *   assignCanvasAnimations(beats)   resolve time (render-and-qa.js): on the
 *                                   FINAL canvases (a photo that did not resolve
 *                                   is TYPE, a token had no room...), which is
 *                                   what the renderer draws — sets canvas.anim.
 * The choices are the same function's; only the input (planned vs resolved)
 * differs, and the resolver's is authoritative.
 */
import { animationsFor, itemOf } from "../src/skills/remotion-render/visual/animation-plan.js";
import { canvasLayout, normalizeCanvas, compositionFor, splitHeadline } from "../src/skills/remotion-render/visual/canvas-layout.js";

const summary = (b) => Object.entries(b).map(([k, v]) => `${k}=${k === "exit" ? `${v.id}(${v.element})` : v}`).join(", ") || "(no animated element)";

/** Beats' resolved canvases -> canvas.anim; returns the run. */
export function assignCanvasAnimations(beats, { seed = "", log = () => {} } = {}) {
  const items = beats.map((b, i) => {
    const c = normalizeCanvas(b.canvas, i);
    return itemOf(c, canvasLayout(c), { last: i === beats.length - 1 });
  });
  const run = animationsFor(items, { seed, log: (m) => log(m) });
  beats.forEach((b, i) => { b.canvas.anim = run.beats[i]; b.recent_animations = run.recent[i]; });
  return run;
}

/** Planned beats -> a preview (the same rules on the planned visuals); sets beat.animations and plan-level recent_animations. */
export function previewAnimations(beats, { seed = "", log = () => {} } = {}) {
  const items = beats.map((b, i) => {
    const vt = String(b.visual_type || "TYPE").toUpperCase();
    const image = ["PHOTO", "CUTOUT", "DOCUMENT", "MONEY"].includes(vt);
    const c = normalizeCanvas({
      visual_type: vt, data: vt === "TYPE" ? null : b.data || null, lead_in: b.lead_in || null, headline: b.headline || b.caption || "", emphasis_word: b.emphasis_word || null,
      // Assume an image resolves; the resolver has the last word.
      photo: image && vt !== "CUTOUT" ? { asset: "planned", entity: b.data?.entity || null } : null, cutout: vt === "CUTOUT" ? { asset: "planned", isolated: true } : null,
      motion_tier: b.motion_tier || "medium", tokens: [],
      composition: compositionFor(vt, image, { split: b.type_layout === "split" && !!splitHeadline(b.headline) }),
    }, i);
    return itemOf(c, canvasLayout(c), { last: i === beats.length - 1 });
  });
  const run = animationsFor(items, { seed, log });
  beats.forEach((b, i) => { b.animations = run.beats[i]; b.recent_animations = run.recent[i]; });
  return run;
}
export { summary };
