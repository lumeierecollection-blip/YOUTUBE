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
import { popEntrances, numberMode, ENTRANCES } from "../src/skills/remotion-render/visual/kinetic.js";
import { canvasLayout, normalizeCanvas, compositionFor, splitHeadline, TOP } from "../src/skills/remotion-render/visual/canvas-layout.js";
import { ROLE_HEADLINE } from "../src/skills/remotion-render/visual/typography.js";

const summary = (b) => Object.entries(b).map(([k, v]) => `${k}=${k === "exit" ? `${v.id}(${v.element})` : v}`).join(", ") || "(no animated element)";

// The number's animation id, in animations.js's vocabulary: an odometer roll
// after the pop, or the pop alone.
const NUM_ANIM = { pop_roll: "ROLL_DIGIT", pop: "SNAP_IN" };
const wordsOf = (b) => (b?.words ? b.words : String((b?.lines || []).join(" ")).split(" ").filter(Boolean).map((t) => ({ text: t })));

/**
 * The beat's statement entrance (canvas.text_entrance, from the planner),
 * checked against the video: POP_HARD only on the hook (first beat) or the
 * CTA (last) — which pop hard by default; POP_LETTER on one TYPE statement a
 * video; POP_WORD_STACK only on a TYPE statement of 2-5 words whose stack
 * (one row per word, rising from the last line) stays below the top margin.
 * Anything refused is logged and becomes the default.
 */
function beatStyle(c, B, i, n, used, log) {
  const want = String(c.text_entrance || "").toUpperCase();
  const edge = i === 0 || i === n - 1;
  if (!want) return null;
  const why = !ENTRANCES.includes(want) ? "not a pop entrance"
    : want === "POP_HARD" && !edge ? "POP_HARD is for the hook / CTA only"
    : want === "POP_LETTER" && !B.statement ? "POP_LETTER needs a TYPE statement"
    : want === "POP_LETTER" && used.letter ? "POP_LETTER is used at most once a video"
    : want === "POP_WORD_STACK" && !B.statement ? "POP_WORD_STACK needs a TYPE statement"
    : want === "POP_WORD_STACK" && !stackFits(B.statement) ? "the word stack would not fit the frame"
    : null;
  if (why) { log(`[kinetic] beat ${i}: text_entrance ${want} refused (${why})`); return null; }
  if (want === "POP_LETTER") used.letter = true;
  return want;
}
function stackFits(st) {
  const n = wordsOf(st).length, lh = st.size * ROLE_HEADLINE.lineHeight;
  const lastRow = st.y + ((st.rows || st.lines || []).length - 1) * lh;
  return n >= 2 && n <= 5 && lastRow - (n - 1) * lh >= TOP;
}

/**
 * Kinetic type, pop family only (kinetic.js popEntrances): the emphasis word
 * pops with POP_EMPHASIS, other headline / statement words with the beat's
 * style (POP_STANDARD by default, POP_HARD on the hook / CTA), kickers and
 * labels POP_SOFT. A number pops then rolls (a year or article number pops
 * and never rolls). The planner's block headline / kicker / label picks and
 * text exits are dropped; the number pick is replaced by the pop mode.
 */
export function assignKinetics(beats, { seed = "", log = () => {} } = {}) {
  const used = { letter: false };
  beats.forEach((b, i) => {
    const c = normalizeCanvas(b.canvas, i), L = canvasLayout(c), B = L.boxes;
    const edge = i === 0 || i === beats.length - 1;
    const style = beatStyle(c, B, i, beats.length, used, log);
    const k = { seed, edge, style: style || (edge ? "POP_HARD" : "POP_STANDARD"), entrances: {}, number: null };
    for (const role of ["headline", "statement", "kicker", "label"]) {
      if (!B[role] || !B[role].lines?.length) continue;
      const group = role === "kicker" || role === "label" ? "label" : "headline";
      // POP_LETTER / POP_WORD_STACK are for the statement; a header headline on that beat pops standard.
      const st = (style === "POP_LETTER" || style === "POP_WORD_STACK") && role !== "statement" ? null : style;
      k.entrances[role] = popEntrances(wordsOf(B[role]), { group, style: st, edge });
    }
    // A donut / gauge figure is its percent (data.percent, not data.value).
    if (B.number) k.number = numberMode(c.data?.value ?? (c.data?.percent != null ? `${c.data.percent}%` : undefined));
    b.canvas.kinetic = k;
    b.canvas.text_entrance = style;
    const anim = { ...(b.canvas.anim || {}) };
    for (const r of ["headline", "kicker", "label", "exit"]) delete anim[r];
    if (k.number) anim.number = NUM_ANIM[k.number];
    b.canvas.anim = anim;
    log(`[kinetic] beat ${i}: ${Object.entries(k.entrances).map(([r, e]) => `${r}=[${e.join(",")}]`).join(" ") || "(no text)"}${k.number ? ` number=${k.number}` : ""}${edge ? " EDGE" : ""}`);
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
