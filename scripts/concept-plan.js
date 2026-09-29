/**
 * Concepts for a plan's beats (Fix 1). Two steps, each pure over the beats so
 * they are unit-tested (scripts/test-concept-plan.mjs):
 *
 *   planConcepts(beats)          planner time (gemini-visual-plan.js): every
 *                                beat's `concepts` = the sentence's concepts —
 *                                the lexicon's plus the model's grounded
 *                                proposals (concept-visuals.js). A proposal
 *                                whose word is not in the sentence is dropped.
 *   assignConceptTokens(beats)   resolve time (render-and-qa.js): once each
 *                                beat's composition is known, choose the (at
 *                                most 2) tokens it draws, skipping what the
 *                                composition already shows (a real photo of
 *                                the named entity...), and record on
 *                                beat.canvas.tokens; a token the layout has no
 *                                room for is dropped and logged.
 */
import { mergeConcepts, pickConcepts } from "../src/skills/remotion-render/visual/concept-visuals.js";
import { canvasLayout, normalizeCanvas } from "../src/skills/remotion-render/visual/canvas-layout.js";

const CURRENCY = /[$€£¥₹]/;

export function planConcepts(beats, log = () => {}) {
  for (const b of beats) {
    const sentence = b.narration || "";
    const before = Array.isArray(b.concepts) ? b.concepts.length : 0;
    b.concepts = mergeConcepts(sentence, { proposed: b.concepts, namedEntities: b.named_entities }).map(({ word, kind }) => ({ word, kind }));
    log(`[concept] beat ${b.index ?? "?"}: ${b.concepts.length ? b.concepts.map((c) => `"${c.word}"→${c.kind}`).join(", ") : "no concept named in the sentence"}${before ? ` (model proposed ${before})` : ""}`);
  }
  return beats;
}

/**
 * Drawn line icons (Lucide) are RETIRED as concept visuals: the owner's brief
 * (2026-09-29, "real PNG cutouts, not drawn icons") wants photographs of the
 * objects, isolated onto transparent PNGs (public/cutouts/, built by
 * scripts/build-cutout-library.mjs). Until that library exists a beat draws no
 * concept visual — the number and label alone — rather than a drawing. The
 * icon path below is kept only so the layout mechanics stay tested
 * (`enabled: true`, tests only); it is not reachable from the pipeline.
 */
export const ICON_TOKENS_ENABLED = false;

/** The tokens each resolved beat draws; sets beat.canvas.concepts / .tokens. Returns a report. */
export function assignConceptTokens(beats, log = () => {}, { enabled = ICON_TOKENS_ENABLED } = {}) {
  const report = { withToken: 0, none: 0, noRoom: 0, beats: [] };
  beats.forEach((b, i) => {
    const c = b.canvas;
    if (!c) return;
    if (!enabled) {
      c.concepts = (Array.isArray(b.concepts) ? b.concepts : []).map(({ word, kind }) => ({ word, kind }));
      c.tokens = [];
      report.none++;
      log(`[concept] beat ${i} ${c.composition}: ${c.concepts.length ? c.concepts.map((x) => `"${x.word}"→${x.kind}`).join(", ") : "no concept named"} — no visual yet (the PNG cutout library is not built)`);
      report.beats.push({ beat: i, composition: c.composition, tokens: [], concepts: c.concepts.length });
      return;
    }
    const sentence = b.narration || "";
    const concepts = Array.isArray(b.concepts) && b.concepts.length ? b.concepts : mergeConcepts(sentence, { namedEntities: b.named_entities });
    const numberShowsCurrency = CURRENCY.test(String(c.data?.value ?? "")) || (String(c.visual_type).toUpperCase() === "COUNTER" && CURRENCY.test(sentence));
    const wanted = pickConcepts(concepts, { beat: { composition: c.composition, visual_type: c.visual_type, photo: c.photo }, sentence, numberShowsCurrency });
    c.concepts = concepts.map(({ word, kind }) => ({ word, kind }));
    c.tokens = wanted;
    let placed = wanted;
    if (wanted.length) {
      const L = canvasLayout(normalizeCanvas(c, i));
      placed = wanted.filter((_, k) => L.boxes[`token${k}`]);
      if (placed.length < wanted.length) {
        const gone = wanted.filter((_, k) => !L.boxes[`token${k}`]).map((t) => `${t.kind}=${t.icon}`);
        log(`[concept] beat ${i} ${c.composition}: no room for ${gone.join(", ")} — the composition's own visual carries the beat`);
        // Keep the placed ones in slots 0..n-1 (layout numbers them in order).
        c.tokens = placed;
        if (!placed.length) report.noRoom++;
      }
    }
    const shown = placed.map((t) => `${t.kind}=${t.icon} (${t.role})`);
    if (placed.length) report.withToken++;
    else if (!wanted.length) report.none++;
    log(`[concept] beat ${i} ${c.composition}: ${shown.length ? shown.join(", ") : concepts.length ? "concepts named but the composition already shows them" : "no concept named"}`);
    report.beats.push({ beat: i, composition: c.composition, tokens: placed.map((t) => t.kind), concepts: c.concepts.length });
  });
  return report;
}
