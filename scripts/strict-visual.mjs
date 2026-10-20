/**
 * STRICT VISUAL — the owner's absolute frame rule for the failing channels only:
 *
 *   "every frame must have a visual asset (PNG, photo, logo, map, chart, cutout,
 *    graphic). No blank frames. No pure text cards."
 *
 * Scoped by `strict_visual: true` in config/channels.json (ch-02, ch-48 — the
 * channels the Gemini frame review kept rejecting as TEMPLATE_MONOCULTURE).
 * Channels without the flag (ch-01, ch-05, ch-09, ...) keep the old behaviour
 * exactly; this module is never consulted for them.
 *
 * What "a visual" means here, per beat:
 *   photo / logo / money object / drawn symbol / entity-art asset / figure  ->
 *   a real drawn thing; NUMBER-FULL, DATA-FULL, MAP-CENTERED, PROCESS-FULL,
 *   TIMELINE, COMPARISON-SPLIT, LIST-BUILD, SCENE-FULL, ARCHITECTURE,
 *   PORTRAIT, DOCUMENT, MONEY -> a figure the sentence's own words ground;
 *   TYPE-FULL with a name card or a date/organisation plate -> TEXT, illegal.
 *
 * When a text beat's sentence grounds a figure, the beat is upgraded to that
 * composition (groundedVisualFor below — every candidate passes the same
 * checkVisual gate the planner uses, so nothing on screen is invented).
 * When the sentence grounds nothing, there is no honest graphic to draw:
 * the caller must reject the beat/topic rather than invent an arrow, a
 * percentage or an icon (the owner's "never wrong" rule, composition-variety.js
 * fallback-5 comment). That rejection is the point — it forces the script
 * rewrite / the next topic instead of a text-only video.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkVisual } from "./gemini-visual-plan.js";
import { quantitiesOf, statedPercentsOf, timelineOf, listItemsOf, flowNodes, compareOf, documentNameOf, moneyObjectOf, knownPlacesOf } from "./canvas-grounding.js";
import { trendOf } from "./composition-variety.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The channels that carry the strict frame rule (config/channels.json strict_visual). */
let STRICT_CACHE = null;
export function strictVisualEnabled(channelId) {
  if (STRICT_CACHE === null) {
    try {
      const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
      const channels = data.channels || data;
      STRICT_CACHE = new Set(channels.filter((c) => c && c.strict_visual).map((c) => String(c.id)));
    } catch { STRICT_CACHE = new Set(); }
  }
  return STRICT_CACHE.has(String(channelId));
}

/**
 * The first grounded visual the sentence itself states, or null.
 * Every candidate is validated by checkVisual (the planner's own gate): a
 * figure that is not in the sentence, a map place the sentence does not name,
 * a process with no cause/sequence — all refused here, not drawn.
 */
export function groundedVisualFor(sentence, { entities = [] } = {}) {
  const st = String(sentence || "").trim();
  if (!st) return null;
  const tryC = (visual_type, data) => {
    const v = checkVisual({ visual_type, data, named_entities: entities }, st);
    return !v.why && v.type === visual_type ? { visual_type, data: v.data } : null;
  };
  // Strongest, most literal first: an enumeration, dated events, two compared
  // figures, a place, a percentage, the sentence's figures, a stated rise,
  // a stated cause/sequence — and MONEY / DOCUMENT last, because those two
  // extractors are the polysemy-prone ones ("missing checks" is a cheque to
  // the regex but an inspection to the sentence; a stated flow outranks them).
  const cmp = compareOf(st); if (cmp) { const c = tryC("COMPARE", { a: cmp.a, b: cmp.b, relation: cmp.relation, subject: cmp.subject }); if (c) return c; }
  const li = listItemsOf(st); if (li) { const c = tryC("LIST", { items: li.items, lead: li.lead || null }); if (c) return c; }
  const tl = timelineOf(st); if (tl) { const c = tryC("TIMELINE", { markers: tl }); if (c) return c; }
  const places = knownPlacesOf(st); if (places.length) { const c = tryC("MAP", { place: places[0] }); if (c) return c; }
  const pcts = statedPercentsOf(st);
  for (const p of pcts) {
    const pie = tryC("PIE", { percent: p }); if (pie) return pie;
    const gauge = tryC("GAUGE", { percent: p }); if (gauge) return gauge;
  }
  // Bare years chart poorly beside figures ("1998" as a bar next to "7.2%"):
  // they stay available as a hero COUNTER (the renderer snaps a year in), but
  // a chart is built from the sentence's measured figures only.
  const isYear = (q) => /^(?:19|20)\d{2}$/.test(String(q.value).replace(/\s/g, ""));
  // Two extractor leaks cleaned here (found testing the ch-2 MIT script):
  // a trailing comma ("28," / "2026," — "On August 28, 2026, ...") and a
  // number glued to letters, which quantitiesOf's own guard misses when the
  // match grabbed the leading space: "fail 3D printing" yielded two "3"
  // bars. "3D", "A24" name things; they are not figures.
  const cleanQty = (q) => {
    const v = String(q.value || "").trim().replace(/[,\s]+$/, "");
    if (!v) return null;
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`${esc}[A-Za-z]`).test(st) || new RegExp(`[A-Za-z]${esc}(?![\\d])`).test(st)) return null;
    return { value: v, label: q.label || null };
  };
  const qs = quantitiesOf(st).map(cleanQty).filter(Boolean);
  const figs = qs.filter((q) => !isYear(q));
  if (figs.length >= 2) { const c = tryC("BAR", { bars: figs.slice(0, 5).map((q) => ({ label: q.label || "", value: q.value })) }); if (c) return c; }
  for (const q of figs.concat(qs)) {
    const c = tryC("COUNTER", { value: q.value, label: q.label });
    if (c) return c;
  }
  const tr = trendOf(st); if (tr) { const c = tryC("TREND", { direction: tr.direction, label: tr.label }); if (c) return c; }
  const nodes = flowNodes(st); if (nodes) { const c = tryC("PROCESS", { nodes }); if (c) return c; }
  const money = moneyObjectOf(st); if (money) { const c = tryC("MONEY", { object: money }); if (c) return c; }
  const doc = documentNameOf(st); if (doc) { const c = tryC("DOCUMENT", { name: doc }); if (c) return c; }
  return null;
}

/** The compositions whose frame is a drawn figure, not typography. */
const VISUAL_COMPOSITIONS = new Set([
  "NUMBER-FULL", "DATA-FULL", "MAP-CENTERED", "PROCESS-FULL", "TIMELINE",
  "COMPARISON-SPLIT", "LIST-BUILD", "SCENE-FULL", "ARCHITECTURE", "PORTRAIT",
  "DOCUMENT", "MONEY",
]);

/**
 * Does this RESOLVED canvas draw a real visual? The same reading the frame
 * review's label uses (scripts/gemini-frame-review.js compositionLabelBase):
 * a plates row whose items carry no asset is the name in type, not a picture.
 */
export function canvasHasRealVisual(c) {
  if (!c) return false;
  if (c.photo && (c.photo.asset || c.photo.view)) return true;
  if ((c.concept_visuals || []).some((v) => v && (v.asset || v.logo || v.money || v.class === "symbol"))) return true;
  if (c.art) {
    // A flag / resolved logo plate carries an asset; a plates row carries
    // kinds + items (gemini-frame-review.js compositionLabelBase reads the
    // same fields). `figure` is the entity ladder's oversized numeral — the
    // renderer draws it, the frame rubric counts a big number as a visual; a
    // date / span / name plate is the name in type and is NOT a visual.
    if (c.art.asset) return true;
    const items = Array.isArray(c.art.items) ? c.art.items : [];
    const kinds = Array.isArray(c.art.kinds) ? c.art.kinds : (c.art.kind ? [c.art.kind] : []);
    if (items.some((it) => it && it.asset)) return true;
    if (kinds.includes("figure")) return true;
  }
  if ((c.clone_extra || []).some((v) => v && v.asset)) return true;
  if ((c.clone_props || []).some((v) => v && v.asset)) return true;
  return VISUAL_COMPOSITIONS.has(String(c.composition || ""));
}

/**
 * Walk a resolved plan; every beat without a real visual is either upgraded
 * to a grounded figure or reported as a failure. The CALLER applies upgrades
 * (it owns canvasContentFor) and must refuse to render when failures exist.
 *   -> { upgrades: [{beat, from, to, why}], failures: [{beat, sentence, reason}] }
 */
export function strictVisualAudit(beats = [], { log = () => {} } = {}) {
  const upgrades = [], failures = [];
  for (const b of beats) {
    const c = b.canvas || {};
    if (canvasHasRealVisual(c)) continue;
    const sentence = String(b.narration || c.sentence || "").trim();
    const g = groundedVisualFor(sentence, { entities: b.named_entities || [] });
    if (!g) {
      failures.push({
        beat: b.index ?? "?",
        sentence,
        reason: "the sentence states no figure, date, place, list, comparison, document, money object or cause/sequence — no grounded graphic exists for this beat",
      });
      continue;
    }
    // MONEY / DOCUMENT are drawn from a FETCHED banknote photo / document scan
    // (canvasContentFor degrades them to TYPE without one), and this audit runs
    // after the fetch stage — an upgrade here could pass the audit and still
    // render as type. The plan stage had its chance to fetch them; say so.
    if (g.visual_type === "MONEY" || g.visual_type === "DOCUMENT") {
      failures.push({
        beat: b.index ?? "?",
        sentence,
        reason: `the sentence grounds ${g.visual_type}, which is drawn from a fetched ${g.visual_type === "MONEY" ? "banknote photo" : "document scan"}; the beat resolved without one and the fetch stage is past`,
      });
      continue;
    }
    const why = `the sentence grounds ${g.visual_type}${g.data ? ` ${JSON.stringify(g.data).slice(0, 60)}` : ""}`;
    log(`[strict-visual] beat ${b.index ?? "?"}: ${c.composition || "TYPE"} has no visual — ${why}`);
    upgrades.push({ beat: b.index ?? "?", target: b, from: c.composition || "TYPE", to: g.visual_type, data: g.data, why });
  }
  return { upgrades, failures };
}

/**
 * STRICT SCRIPT CHECK (gate-script.js, strict channels only): every sentence
 * must ground a figure the frame can draw. A sentence that names a real,
 * resolvable entity is allowed through (a logo/photo is a visual); the plan
 * stage then fails the ones whose entity has no asset. Everything else is
 * returned so the script agent is re-asked with concrete lines to rewrite.
 */
export function strictUngroundableSentences(sentences = []) {
  const bad = [];
  for (const s of sentences) {
    const text = String(s || "").trim();
    if (!text) continue;
    if (groundedVisualFor(text)) continue;
    // A proper noun anywhere, sentence-initial included: the entity may resolve
    // to a real logo/photo at plan time (only the plan stage knows — it
    // fetches, and it fails the render when nothing resolves). The common
    // sentence starters are excluded ("The platform simply works" is not an
    // entity — it was caught in testing).
    const words = text.replace(/[.!?]+$/, "").split(/\s+/);
    const proper = words.some((w) => /^[A-Z][A-Za-z'’-]+$/.test(w) && !/^(The|This|That|These|Those|It|He|She|They|We|You|But|And|So|Then|Now|After|Before|In|On|At|For|With|From|A|An|Its|There|Here|When|While|If|As)$/.test(w));
    if (proper || /\d/.test(text)) continue;
    bad.push(text);
  }
  return bad;
}
