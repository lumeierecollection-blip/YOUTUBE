/**
 * Concepts -> visuals (owner's brief, 2026-10-02: "the PNGs exist but the
 * renderer still draws nothing for them").
 *
 * A beat's sentence names things — money, a court, a padlock, a warning. A
 * concept is one of the cutout library's names (scripts/cutout-specs.json),
 * and maps to a class (concept-classes.js):
 *   CUTOUT  -> a PNG fetched and verified for the beat (public/cutouts-live/)
 *   SYMBOL  -> the drawn SVG (visual/symbols/)
 *   SCENE   -> nothing on its own (no generic scene-photo source), reported
 *
 * Grounding (CLAUDE.md): a concept is kept only when the sentence NAMES it.
 * A photographed object (a cutout) needs every word of its own name in the
 * sentence ("gavel" needs "gavel"; "dollar-bill" needs "dollar" and "bill"):
 * thematic words ("law" for a gavel) grounded a gavel on a sentence about a
 * credit law, a symbol for the idea, not the object (CI run 37012196580 ch-2
 * beat 8). A drawn symbol keeps its event words (SYMBOL_WORDS). The planner
 * may propose concepts, but a proposal the sentence does not name is
 * dropped, and nothing is added from general knowledge.
 *
 * Pure: no file access, so the renderer bundle can import it. Node callers
 * pass the specs (cutout-specs.json) and the library (index.json +
 * verified.json) in.
 *
 * Where this stops: trigger words are a word list, not language
 * understanding; a concept phrased in other words is missed, and a listed
 * word used in another sense ("key" = important) can match. The symbol words
 * are kept to unambiguous event verbs for that reason.
 */
import { SYMBOLS, SCENES, classOf } from "./concept-classes.js";

// Symbols are drawn for an EVENT the sentence states, not for the bare shape
// word: "up" / "cut" / "sign" alone are too common to mean an arrow.
export const SYMBOL_WORDS = Object.freeze({
  "upward-arrow": ["rise", "rises", "rose", "risen", "rising", "increase", "increased", "increases", "surge", "surged", "soar", "soared", "grew", "growth", "jump", "jumped", "climb", "climbed"],
  "downward-arrow": ["fall", "falls", "fell", "fallen", "drop", "dropped", "drops", "decline", "declined", "plunge", "plunged", "slump", "slumped", "shrank", "decrease", "decreased"],
  "warning-triangle": ["warning", "warned", "warns", "warn", "hazard", "danger", "dangerous"],
  "checkmark": ["approved", "approves", "approval", "confirmed", "verified", "cleared"],
  "crosshair": ["target", "targets", "targeted", "targeting"],
  "radar": ["radar", "surveillance", "monitored", "monitoring"],
  "broken-chain": ["breach", "breached", "severed", "disrupted", "disruption", "broken"],
  "dollar-sign": ["dollar", "dollars", "usd"],
});
export const MAX_CONCEPTS = 3;
// Not objects: a free-form concept containing one of these is dropped (a camera cannot photograph "economy").
export const ABSTRACT = new Set(["economy", "growth", "policy", "market", "markets", "impact", "strategy", "strategies", "plan", "law", "laws", "rights", "right", "risk", "crisis", "future", "change", "changes", "rule", "rules", "system", "process", "issue", "problem", "idea", "value", "trend", "trends", "debate", "conflict", "tension", "tensions", "security", "inflation", "demand", "supply", "cost", "costs", "price", "prices", "rate", "rates", "trust", "fraud", "scheme", "case", "decision", "ruling", "study", "report", "data", "research"]);    // one primary + up to two secondary

const words = (s) => new Set(String(s || "").toLowerCase().replace(/[$]/g, " dollar ").split(/[^a-z0-9]+/).filter(Boolean)
  .flatMap((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? [w, w.slice(0, -1)] : [w])));

/** The words a sentence must contain to name a concept: a symbol's event words (any one), an object's own name (every part). */
function namesIt(name, ws, specs) {
  const has = (t) => ws.findIndex((w) => w === t || (w.length > 3 && w.endsWith("s") && w.slice(0, -1) === t));
  if (SYMBOL_WORDS[name]) { const at = ws.findIndex((w) => SYMBOL_WORDS[name].includes(w)); return at; }
  const parts = String(name).split("-").filter((w) => w.length >= 3);
  if (!parts.length) return -1;
  const at = parts.map(has);
  return at.every((i) => i >= 0) ? Math.min(...at) : -1;
}

/** Concepts the sentence names, in the order their first word appears. */
export function conceptsInSentence(sentence, specs = []) {
  const ws = String(sentence || "").toLowerCase().replace(/[$]/g, " dollar ").split(/[^a-z0-9]+/).filter(Boolean);
  const names = [...new Set([...specs.map((s) => s.name), ...SYMBOLS])];
  const hits = [];
  for (const n of names) {
    const at = namesIt(n, ws, specs);
    if (at >= 0) hits.push({ name: n, at });
  }
  // One sentence word names one concept: "bank" is a bank building OR a bank
  // statement, not both (the first in spec order keeps it).
  const byWord = new Map();
  for (const h of hits) if (!byWord.has(h.at)) byWord.set(h.at, h);
  return [...byWord.values()].sort((a, b) => a.at - b.at).map((h) => h.name);
}

/**
 * The planner's concepts, checked: a known name whose trigger word is in the
 * sentence. Unknown or ungrounded proposals are dropped (and returned in
 * `dropped`); when none survive, the sentence's own concepts are used.
 */
export function validateConcepts(planned, sentence, specs = []) {
  const known = new Set([...specs.map((s) => s.name), ...SYMBOLS]);
  const sw = words(sentence);
  const kept = [], dropped = [];
  for (const raw of Array.isArray(planned) ? planned : []) {
    const n = String(raw || "").toLowerCase().trim();
    if (!known.has(n)) {
      // A free-form object (owner's spec 2026-10-02: "the sentence names an
      // object -> a cutout"): a 1-3 word noun phrase whose every word is a
      // word of the sentence ("solar panel", "shipping container"). Fetched
      // live and verified like any other; never a library name.
      const fw = String(n).replace(/-/g, " ").split(/\s+/).filter(Boolean);
      if (!fw.some((w) => ABSTRACT.has(w)) && fw.length >= 1 && fw.length <= 3 && fw.every((w) => /^[a-z][a-z'-]*$/.test(w)) && fw.filter((w) => w.length >= 3).length && fw.every((w) => w.length < 3 || sw.has(w) || (w.endsWith("s") && sw.has(w.slice(0, -1))))) {
        const ff = fw.join(" ");
        if (!kept.includes(ff)) kept.push(ff);
        continue;
      }
      dropped.push(`${n}: not a concept name and not an object the sentence names`);
      continue;
    }
    if (namesIt(n, String(sentence || "").toLowerCase().replace(/[$]/g, " dollar ").split(/[^a-z0-9]+/).filter(Boolean), specs) < 0) { dropped.push(`${n}: the sentence does not name it`); continue; }
    if (!kept.includes(n)) kept.push(n);
  }
  const concepts = (kept.length ? kept : conceptsInSentence(sentence, specs)).slice(0, MAX_CONCEPTS);
  return { concepts, dropped, from: kept.length ? "planner" : "sentence" };
}

/**
 * Concepts -> drawable visuals. `library`: [{ name, file, width, height }]
 * of VERIFIED cutouts only (index.json entries whose verified.json verdict is
 * MATCH and whose PNG exists). A cutout name without a library entry, and a
 * scene, draw nothing (reported in `skipped`). At most MAX_CONCEPTS; the
 * first is the primary.
 */
export function visualsFor(concepts, library = []) {
  const names = library.map((c) => c.name);
  const out = [], skipped = [];
  for (const n of concepts || []) {
    const cls = classOf(n, names);
    if (cls === "cutout") {
      const c = library.find((x) => x.name === n);
      out.push({ name: n, class: "cutout", asset: c.file, w: c.width || 1, h: c.height || 1 });
    } else if (cls === "symbol") out.push({ name: n, class: "symbol", w: 1, h: 1 });
    else skipped.push(`${n}: ${SCENES.includes(n) ? "scene (no scene-photo source)" : "no verified cutout in the library"}`);
    if (out.length >= MAX_CONCEPTS) break;
  }
  return { visuals: out, skipped };
}
