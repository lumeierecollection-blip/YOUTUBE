#!/usr/bin/env node
/**
 * Gemini Visual Planner — pre-render direction.
 *
 * Gemini reads the full script and voiceover timing, then decides for
 * each beat: what visual headline to show (NOT the transcript), what
 * treatment/mechanism to use, and why. The output is a visual-plan.json
 * that the render system consumes to override the default director.
 *
 * Usage:
 *   node scripts/gemini-visual-plan.js --script <path> --srt <path> --channel <id> --out <plan.json>
 *   node scripts/gemini-visual-plan.js --script <path> --srt <path> --channel <id> --out <plan.json> --corrections <prev-review.json>
 *
 * --corrections   Feed the previous Gemini review's corrections back in
 *                 so the plan is refined rather than regenerated.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
// The vocabulary is GENERATED into the prompt from scene-primitives.js, never
// restated by hand. Hand-maintained duplicates are what put three
// conflicting word budgets in three files and cost two channels their runs.
import {
  vocabularyDigest, validateScene,
} from "../src/skills/remotion-render/visual/scene-primitives.js";
import {
  condenseToPhrase, validateNarrativePhrase, wordCount, toSingleLine,
  TYPO_TARGET_MAX_WORDS, TYPO_HARD_MAX_WORDS, TYPO_MOMENTS, TYPO_MAX_BEAT_SHARE,
} from "../src/skills/remotion-render/visual/narrative-typography.js";
import {
  compactCapabilityDigest, compileScene, isMechanismBased, mechanismToCapability,
} from "../src/skills/remotion-render/visual/capability-compiler.js";
import { callGemini as callGeminiApi, createCachedContent } from "../src/lib/gemini-client.js";
import { forcedOllama, callOllamaOnly, callLLM, isProviderError } from "../src/lib/llm.js";
import { createRequire as createRequireGroq } from "node:module";
const { callGroq } = createRequireGroq(import.meta.url)("./groq-client.cjs");
import { LIBRARY_NAMES } from "../src/skills/remotion-render/visual/library-names.js";
import { validateConcepts } from "../src/skills/remotion-render/visual/concept-visuals.js";
import { SYMBOLS as CONCEPT_SYMBOLS } from "../src/skills/remotion-render/visual/concept-classes.js";
import { resolveRegion } from "../src/skills/remotion-render/visual/geo-regions.js";
const { resolveEntity, resolveDocument, resolveMoney, qualifyEntity } = createRequire(import.meta.url)("./entity-assets.cjs");
import { enforceRotation, candidatesFor } from "./composition-rotation.js";
import { previewAnimations } from "./anim-plan.js";
import { compositionFor, splitHeadline } from "../src/skills/remotion-render/visual/canvas-layout.js";
import { flowNodes, FLOW_WORDS, listItemsOf, timelineOf, compareOf, documentNameOf, moneyObjectOf, quantitiesOf, statedPercentsOf, knownPlacesOf } from "./canvas-grounding.js";

const { enforceCaps, describe: describeMechanisms, TYPOGRAPHY } = createRequire(import.meta.url)("./plan-caps.cjs");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
// The concept names (the cutout library's specs + the drawn symbols).
const CUTOUT_SPECS = (() => { try { return JSON.parse(readFileSync(join(ROOT, "scripts", "cutout-specs.json"), "utf8")).specs || []; } catch { return []; } })();
const CONCEPT_NAMES = [...new Set([...CUTOUT_SPECS.map((s) => s.name), ...CONCEPT_SYMBOLS])];
// docs/REFERENCE-STYLE.md (the paper reference) is no longer embedded: the
// full-canvas rebuild (2026-09-29) replaced the paper style; the prompt
// states the full-canvas grammar itself.

/**
 * Enforce the narrative-typography contract on a returned plan, in place.
 *
 * Deterministic repair, not advice: any phrase that will go on screen is
 * normalised to ONE line within the word budget, and the reasons it was
 * out of contract are recorded so the post-render review and the local
 * auditor can attribute the failure. Semantic quality ("is this a GOOD
 * piece of emphasis?") stays with Gemini — this only fixes what is
 * measurable.
 */
function enforceTypographyContract(beats, sentences) {
  const repaired = [];
  const violations = [];
  let textBeats = 0;

  beats.forEach((b, i) => {
    const narration = sentences[i]?.text || null;
    const td = b.typography_direction && typeof b.typography_direction === "object"
      ? b.typography_direction : null;
    const hasText = !!(td?.phrase) || b.mechanism === "TYPOGRAPHY"
      || (b.direction?.typography && String(b.direction.typography).toLowerCase() !== "none");
    if (!hasText) {
      // A beat with no on-screen text must not carry a stale phrase.
      b.typography_direction = null;
      return;
    }
    textBeats++;

    const source = td?.phrase || b.visual_headline || b.direction?.typography || "";
    const check = validateNarrativePhrase(source, { narration });
    const finalPhrase = check.ok ? toSingleLine(source) : check.normalized;

    if (!check.ok || finalPhrase !== toSingleLine(source)) {
      repaired.push({ index: i, before: toSingleLine(source), after: finalPhrase, reasons: check.reasons });
    }
    if (!check.ok) violations.push({ index: i, reasons: check.reasons });

    // The renderer draws beat.text / visual_headline, so both carry the
    // corrected single-line phrase.
    b.visual_headline = finalPhrase;
    b.typography_direction = {
      phrase: finalPhrase,
      why: td?.why || null,
      moment: TYPO_MOMENTS.includes(td?.moment) ? td.moment : "statement",
      single_line: true,
      not_a_headline: true,
      not_a_transcript: true,
      relation_to_visual: td?.relation_to_visual || null,
      enforced: !check.ok ? check.reasons : undefined,
    };
    if (b.direction) b.direction.typography = finalPhrase;
  });

  return {
    textBeats,
    textBeatShare: beats.length ? textBeats / beats.length : 0,
    repaired, violations,
  };
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}

function parseSrt(srtText) {
  return srtText.split(/\n\n+/).map((block) => {
    const lines = block.trim().split("\n");
    if (lines.length < 3) return null;
    const [start, end] = lines[1].split(" --> ").map((t) => {
      const [h, m, rest] = t.trim().split(":");
      const [s, ms] = rest.split(",");
      return (+h * 3600) + (+m * 60) + +s + +ms / 1000;
    });
    return { start, end, text: lines.slice(2).join(" ") };
  }).filter(Boolean);
}

// Interpolated into the prompt below. It was computed and never used, so
// Gemini composed without ever seeing the primitive, anchor or motion
// names — run 35933424177 dropped 5/6 ch-1 compositions for invented words
// like motion "converge".
const VOCABULARY = vocabularyDigest();
{
  const lib = VOCABULARY.split("\n").find((l) => l.startsWith("LIBRARY"));
  console.log(`[vocab] library_shape exposes ${lib ? lib.split(" | ").length : 0} drawings to the planner`);
}

// Subject-appropriate drawings per priority channel, ALL taken from the
// library registry (checked below at load — a misspelt or invented name
// throws before any prompt is built). Shown to the planner ahead of the full
// LIBRARY list so it sees the options that depict ITS niche's subjects.
// Why: run 36343146799 — ch-1 had "phone showing a budgeting app" for a
// sentence about finance apps and picked "date marker"; ch-9 had the maps for
// a border war and picked "case file folder". Other channels get the full
// list only.
const NICHE_DRAWINGS = {
  "1": ["phone showing a budgeting app", "calculator", "ledger notebook", "bank statement", "receipt", "balance sheet", "cash notes", "calendar grid", "plan comparison rows", "clock face"],
  "2": ["court document", "legal document", "case file folder", "courthouse column", "evidence exhibit", "gavel", "constitutional text", "enrollment form", "handwritten letter", "prison window"],
  "9": ["map-region-highlight", "map-route", "map-markers", "map-outline", "national border line", "territory fill", "earth globe", "satellite terrain", "archival map sheet", "stone monument", "supply route"],
  "26": ["money trail", "cash notes", "bank statement", "balance sheet", "red string", "evidence exhibit", "share price line", "stock ticker tape", "office tower", "pinned photograph", "receipt", "supply route"],
  "44": ["figure silhouette", "office tower", "application window", "prompt field", "output transcript", "answer frame", "question line", "handwritten letter", "cursor pointer", "checklist rule", "clock face"],
  "48": ["conveyor belt", "robot arm", "gear train", "machine housing", "component part", "bolt joint", "blueprint sheet", "cross section", "gauge dial", "product silhouette", "checklist rule", "scale bar"],
};
for (const [ch, names] of Object.entries(NICHE_DRAWINGS)) {
  const bad = names.filter((n) => !LIBRARY_NAMES.includes(n));
  if (bad.length) throw new Error(`NICHE_DRAWINGS ch-${ch}: not in the object library: ${bad.join(", ")}`);
}

// ── VISUAL TYPE: the planner picks it, code checks its data ──────────
// CLAUDE.md hard rule: nothing on screen that the source did not say. Every
// number a chart draws must appear in the sentence; a map's place must be a
// real region. Anything else becomes TYPE.
export const VISUAL_TYPES = ["PHOTO", "COUNTER", "BAR", "PIE", "LINE", "GAUGE", "MAP", "PROCESS", "LIST", "TIMELINE", "COMPARE", "DOCUMENT", "MONEY", "TYPE"];
const TYPE_CAPABILITY = { PHOTO: "revelation", COUNTER: "evidence", BAR: "comparison", PIE: "population", LINE: "growth", GAUGE: "accumulation", MAP: "contrast", PROCESS: "causation",
  LIST: "evidence", TIMELINE: "growth", COMPARE: "comparison", DOCUMENT: "revelation", MONEY: "evidence" };

// ── named entities: only what the sentence NAMES ─────────────────────
// Each entity's name must appear in its sentence: every content word of the
// name (the same crude stem as the cutout / lead-in gates). An entity the
// sentence does not name is dropped — its photo would be a claim the
// narration never makes.
export function entityNamedInSentence(name, sentence) {
  const sent = String(sentence || "").replace(/\$/g, " dollar ").split(/[^A-Za-z0-9']+/).filter(Boolean).map(stemWord);
  const words = String(name || "").split(/[^A-Za-z0-9']+/).map((w) => w.toLowerCase()).filter((w) => w && !LEAD_FUNCTION.has(w) && !["inc", "corp", "co", "llc", "ltd", "plc"].includes(w));
  return words.length > 0 && words.every((w) => { const st = stemWord(w); return sent.some((t) => stemMatch(st, t)); });
}
// Words that state a flow, and the nodes it connects, live in
// canvas-grounding.js (shared with the composition rotation); re-exported so
// the planner's tests keep importing flowNodes from here.
export { flowNodes };

// The figure a checked visual draws, as a comparable key ("$388M" and
// "$388 million" -> "388000000"), or null for a visual without one figure.
export function figureKey(v) {
  if (!v || v.type !== "COUNTER" && v.type !== "PIE" && v.type !== "GAUGE") return null;
  const raw = v.type === "COUNTER" ? String(v.data?.value || "") : String(v.data?.percent ?? "");
  const m = raw.match(/\d[\d,]*(?:\.\d+)?/);
  if (!m) return null;
  let n = Number(m[0].replace(/,/g, ""));
  const rest = raw.slice(m.index + m[0].length).toLowerCase();
  const sc = rest.match(/^\s*(thousand|million|billion|trillion|k|m|bn|b)\b/);
  if (sc) n *= { thousand: 1e3, k: 1e3, million: 1e6, m: 1e6, billion: 1e9, bn: 1e9, b: 1e9, trillion: 1e12 }[sc[1]];
  return `${v.type === "COUNTER" && !/%/.test(raw) ? "n" : "%"}${n}`;
}

// Entity types (owner's scene-resolver spec 2026-10-02): the real-world ones
// are sourced from Wikipedia / Wikimedia, an object from Pixabay, a number is
// drawn (scripts/resolve-scene.cjs).
// part B (2026-10-03): company and institution; "organization" is still read (older plans) as an institution.
export const ENTITY_TYPES = ["person", "company", "institution", "place", "building", "object", "number", "organization"];
export function checkEntities(list, sentence) {
  const kept = [], dropped = [];
  for (const e of Array.isArray(list) ? list : []) {
    const type = String(e?.type || "").toLowerCase();
    const name = String(e?.name || "").trim();
    if (!name || !ENTITY_TYPES.includes(type)) { dropped.push(`${type || "?"} "${name}": no type/name`); continue; }
    const t = type === "organization" ? "institution" : type;
    if (!entityNamedInSentence(name, sentence)) { dropped.push(`${t} "${name}": not named in the sentence`); continue; }
    if (!kept.some((k) => k.name.toLowerCase() === name.toLowerCase())) kept.push({ type: t, name });
  }
  return { kept, dropped };
}
// Numbers a sentence SPELLS ("six distinct levels", "forty-two", "three
// million") are its figures as much as "6" is — run 36506838927 ch-44 said
// "six distinct levels" and no chart gate could see it. Parsed, not guessed:
// only number words, in a run, are read.
const NUM_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const NUM_SCALES = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };
export function wordNumbers(text) {
  const out = [];
  const toks = String(text || "").toLowerCase().replace(/-/g, " ").split(/[^a-z]+/).filter(Boolean);
  let cur = null, total = 0;
  const flush = () => { if (cur !== null || total) out.push(total + (cur || 0)); cur = null; total = 0; };
  for (const t of toks) {
    if (t in NUM_WORDS) cur = (cur || 0) + NUM_WORDS[t];
    else if (t === "hundred" && cur !== null) cur *= 100;
    else if (t in NUM_SCALES && cur !== null) { total += cur * NUM_SCALES[t]; cur = null; }
    else if (t === "and" && (cur !== null || total)) continue;
    else flush();
  }
  flush();
  return out.filter((n) => Number.isFinite(n) && n > 0);
}
function sentenceNumbers(text) {
  const digits = (String(text || "").match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => Number(n.replace(/,/g, "")));
  return new Set([...digits, ...wordNumbers(text)]);
}
// What a beat's sentence can ground, for the gate-repair prompt: its
// numbers (years and counts under 2 are not counter values), whether it
// states a percentage, and any known place (resolveRegion, 1-3 word spans).
export function groundedOptions(sentence) {
  const text = String(sentence || "");
  const nums = [...sentenceNumbers(text)];
  const counts = nums.filter((n) => n >= 2 && !(Number.isInteger(n) && n >= 1000 && n <= 2099) && !isIdentifierNumber(String(n), text));
  const pct = (text.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:%|percent\b)/gi) || []).map((m) => Number(m.replace(/[^\d.]/g, ""))).filter((n) => n > 0 && n <= 100);
  const words = text.split(/[^A-Za-z.'-]+/).filter(Boolean);
  const places = new Set();
  for (let i = 0; i < words.length; i++) for (let k = 3; k >= 1; k--) {
    const span = words.slice(i, i + k).join(" ").replace(/[.]$/, "");
    if (k <= words.length - i && /^[A-Z]/.test(span) && resolveRegion(span)) places.add(span);
  }
  const allowed = ["TYPE"];
  if (counts.length) allowed.push("COUNTER");
  if (pct.length) allowed.push("PIE", "GAUGE");
  if (nums.length >= 2) allowed.push("BAR", "LINE");
  if (places.size) allowed.push("MAP");
  if (FLOW_WORDS.test(text)) allowed.push("PROCESS");
  if (listItemsOf(text)) allowed.push("LIST");
  if (timelineOf(text)) allowed.push("TIMELINE");
  if (compareOf(text)) allowed.push("COMPARE");
  if (documentNameOf(text)) allowed.push("DOCUMENT");
  if (moneyObjectOf(text)) allowed.push("MONEY");
  const proper = text.split(/\s+/).slice(1).some((w) => /^[A-Z][a-z]+/.test(w.replace(/^[^A-Za-z]+/, "")));
  if (proper) allowed.push("PHOTO");
  return { counts, percents: pct, places: [...places], allowed };
}

// "Article 10", "Section 357-A", "Rule 10b-5", "Resolution 2231", "No. 7",
// "Phase 2": the number is a name. True when the value carries a letter
// suffix ("357-A") or the sentence writes the number right after such a word.
const ID_WORDS = /\b(article|articles|section|sections|sec\.?|rule|rules|chapter|clause|title|amendment|resolution|regulation|order|act|bill|case|docket|no\.?|number|#|part|schedule|phase|stage|level|tier|form|flight|route|highway|interstate|model|version|article\s+no\.?|paragraph|para|subsection|item|exhibit|appendix|annex|protocol)\s*$/i;
// TWO-NUMBER RULE (owner's spec 2026-10-03, part D): a sentence with a comparison word and
// TWO DISTINCT comparable numbers is a DATA-FULL chart. Returns those numbers, or null —
// a single number is a COUNTER, not this rule. Not counted: a bare year ("in 2019"), an
// identifier ("Section 230", "Form 1099"). Spelled numbers count ("ten to twenty-two").
const COMPARE_WORDS = /\b(more|less|fewer|than|versus|vs\.?|higher|lower|grew|grow|grows|fell|fall|falls|rose|rise|rises|dropped|drop|drops|doubled|halved|increased|increase|increases|decreased|decrease|decreases|compared to|compared with|from)\b/i;
export function comparisonNumbers(sentence) {
  const text = String(sentence || "");
  if (!COMPARE_WORDS.test(text)) return null;
  const vals = [];
  for (const m of text.matchAll(/\$?\d[\d,]*(?:\.\d+)?\s*(?:%|percent|million|billion|trillion|thousand|k\b)?/gi)) {
    const raw = m[0].trim();
    const n = Number(raw.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n)) continue;
    if (/^(19|20)\d{2}$/.test(raw) || isIdentifierNumber(raw, text)) continue;   // a year, an identifier
    vals.push(raw.toLowerCase());
  }
  // A spelled year ("by twenty twenty-six" -> 2026) is a date, not a compared quantity
  // (CI run 37108869325 ch-44: "20% vs 2026").
  // "twenty twenty-six" is read by wordNumbers as 20 + 26: such a year is cut out first.
  const noYears = text.replace(/\b(nineteen|twenty)[\s-]+(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|oh)(?:[\s-]+(one|two|three|four|five|six|seven|eight|nine))?\b/gi, " ");
  for (const w of wordNumbers(noYears)) if (!(w >= 1900 && w <= 2099)) vals.push(String(w));
  const distinct = [...new Set(vals.map((v) => v.replace(/[\s,$]/g, "")))];
  return distinct.length >= 2 ? distinct : null;
}
const CHART_TYPES = ["BAR", "LINE", "PIE", "GAUGE"];

export function isIdentifierNumber(value, sentence) {
  const v = String(value || "").trim();
  if (/^\d+[-–]?[A-Za-z]{1,2}$/.test(v) && !/^\d+\s*(k|m|b|bn|mn|x)$/i.test(v)) return true;
  const m = v.match(/\d[\d,]*(?:\.\d+)?/);
  if (!m) return false;
  const esc = m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\d.,])${esc}(?![\\d,])`, "g");
  const text = String(sentence || "");
  let hit, any = false, allId = true;
  while ((hit = re.exec(text))) { any = true; if (!ID_WORDS.test(text.slice(0, hit.index + hit[1].length))) allId = false; }
  return any && allId;
}

function numIn(v, nums) {
  const m = String(v ?? "").match(/\d[\d,]*(?:\.\d+)?/);
  if (m) return nums.has(Number(m[0].replace(/,/g, "")));
  const w = wordNumbers(v);
  return w.length > 0 && nums.has(w[0]);
}
// A crude word stem shared by the lead-in and headline gates (signature/signed -> sign, bills -> bill, a shared prefix of 5+ letters).
function stemWord(w) {
  let x = String(w || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const suf of ["ations", "ation", "atures", "ature", "ments", "ment", "ings", "ing", "ers", "er", "ies", "es", "ed"]) {
    if (x.length - suf.length >= 4 && x.endsWith(suf)) return x.slice(0, -suf.length);
  }
  // A plain plural: arms -> arm, keys -> key (not glass -> glas).
  if (x.length >= 4 && x.endsWith("s") && !x.endsWith("ss")) return x.slice(0, -1);
  return x;
}
function stemMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short);
}
// ── The lead-in comes from the beat's own sentence ────────────────────
// Run 36405739332 ch-48 put the REFERENCE's example lead-ins on its own
// beats ("watch how", "they are selling", "to the tagline", "by being
// impossible DIGITAL TWIN 10%") — words its narration never says. A
// lead-in's content words must all be in the sentence (same crude stem as
// the cutout gate); function words are free. An ungrounded lead-in is
// dropped, never rewritten (nothing on screen the source did not say).
const LEAD_FUNCTION = new Set(["a", "an", "the", "of", "to", "for", "in", "on", "at", "by", "and", "or", "but", "so", "as", "is", "are",
  "was", "were", "be", "been", "it", "its", "this", "that", "these", "those", "how", "what", "why", "with", "from", "into", "over",
  "than", "then", "they", "we", "you", "our", "their", "your", "i", "he", "she", "his", "her", "them", "us", "who", "which", "will",
  "can", "not", "no", "just", "now", "all", "more", "most"]);
export function leadInFromSentence(lead, sentence) {
  const sent = String(sentence || "").replace(/\$/g, " dollar ").split(/[^A-Za-z0-9']+/).filter(Boolean).map(stemWord);
  // Split exactly like the sentence (hyphens and slashes separate words), so
  // "stay-or-pay" in a lead-in matches "stay-or-pay" in the sentence — it was
  // collapsed to "stayorpay" and never matched (found 2026-09-29).
  const words = String(lead || "").split(/[^A-Za-z0-9']+/).map((w) => w.toLowerCase()).filter(Boolean);
  const content = words.filter((w) => !LEAD_FUNCTION.has(w));
  return content.every((w) => { const st = stemWord(w); return sent.some((t) => stemMatch(st, t)); });
}

/**
 * Zones (owner's rule, 2026-10-02; canvas-layout.js ZONES): the plan declares
 * headline_zone / chart_zone / caption_zone per beat. Checked here:
 *   caption_zone   always "bottom" (the renderer's caption band)
 *   headline_zone  "top" | "middle"; chart_zone "top" | "middle"
 *   a beat with a headline AND a chart / map / number: different zones —
 *   the same zone is a REJECTED declaration
 *   the swap (chart top, headline middle) only for COUNTER (NUMBER-FULL is
 *   the one composition laid out both ways)
 * A rejected or missing declaration is replaced by the canonical zones
 * (headline top, chart middle, caption bottom) and logged — not re-asked:
 * these beats have no re-plan loop of their own (the challenger's is the
 * only one). The layout and local-audit zones-no-overlap enforce the zones
 * whatever the plan says, so a bad declaration cannot render overlapping.
 */
const ZONE_CHART_TYPES = new Set(["COUNTER", "BAR", "PIE", "LINE", "GAUGE", "MAP", "PROCESS", "LIST", "TIMELINE", "COMPARE"]);
export function checkZones(b) {
  const z = (v) => String(v || "").toLowerCase().trim();
  const hz = z(b.headline_zone), cz = z(b.chart_zone), kz = z(b.caption_zone);
  const vt = String(b.visual_type || "").toUpperCase();
  const hasChart = ZONE_CHART_TYPES.has(vt), hasHead = !!String(b.headline || "").trim();
  let why = null;
  if (!hz || !cz || !kz) why = "zones missing";
  else if (kz !== "bottom") why = `caption_zone "${kz}" (the caption is always bottom)`;
  else if (![hz, cz].every((x) => x === "top" || x === "middle")) why = `headline_zone "${hz}" / chart_zone "${cz}" (bottom is the caption's)`;
  else if (hasChart && hasHead && hz === cz) why = `REJECTED: headline and ${vt.toLowerCase()} both in the ${hz} zone`;
  else if (hz === "middle" && cz === "top" && vt !== "COUNTER") why = `the swap (chart top, headline middle) is laid out only for COUNTER, not ${vt}`;
  if (why) {
    if (why !== "zones missing") console.warn(`::warning::[plan] beat ${b.index}: zones ${why} — set to headline top / chart middle / caption bottom`);
    b.headline_zone = "top"; b.chart_zone = "middle"; b.caption_zone = "bottom";
    return { ok: false, why };
  }
  b.headline_zone = hz; b.chart_zone = cz; b.caption_zone = "bottom";
  return { ok: true, why: null };
}

export function checkVisual(b, sentence) {
  const t = String(b.visual_type || "").toUpperCase();
  const d = b.data || {};
  const nums = sentenceNumbers(sentence);
  const bad = (why) => ({ type: "TYPE", data: null, why });
  if (!VISUAL_TYPES.includes(t)) return bad(`unknown visual_type "${b.visual_type}"`);
  if (t === "TYPE") return { type: "TYPE", data: null };
  if (t === "PHOTO") {
    const ent = String(d.entity || "").trim();
    if (!ent) return bad("PHOTO without an entity");
    if (!entityNamedInSentence(ent, sentence)) return bad(`PHOTO entity "${ent}" is not named in the sentence`);
    const listed = (Array.isArray(b.named_entities) ? b.named_entities : []).find((e) => String(e?.name || "").trim().toLowerCase() === ent.toLowerCase());
    const type = String(listed?.type || d.entity_type || "").toLowerCase();
    if (!["person", "place", "building", "organization", "company", "institution"].includes(type)) return bad(`PHOTO entity "${ent}" has no type (person / place / building / company / institution) in named_entities`);
    return { type: t, data: { entity: ent, entity_type: type } };
  }
  if (t === "PROCESS") {
    const nodes = (Array.isArray(d.nodes) ? d.nodes : []).map((n) => String(n?.label ?? n ?? "").trim()).filter(Boolean).slice(0, 3);
    if (nodes.length < 2) return bad("PROCESS needs 2-3 nodes");
    const off = nodes.find((n) => n.split(/\s+/).length > 3 || !leadInFromSentence(n, sentence));
    if (off) return bad(`PROCESS node "${off}" is not 1-3 words from the sentence`);
    // The sentence must STATE a flow — a cause, a result, a sequence. Run
    // 36504143080 ch-2 drew "rights -> civilians -> protected" and "police
    // encounters -> legal boundaries" for sentences with no flow in them, and
    // the beat check rightly called them abstract circles.
    if (!FLOW_WORDS.test(String(sentence || ""))) return bad("PROCESS: the sentence states no cause, result or sequence");
    return { type: t, data: { nodes } };
  }
  // The compositions read from the sentence itself (canvas-grounding.js): a
  // LIST / TIMELINE / COMPARE / DOCUMENT / MONEY beat is valid exactly when the
  // sentence states one, and its data is THE EXTRACTOR'S — a slice of the
  // sentence — whatever the model wrote. The model chooses the type; it cannot
  // put words on screen the sentence does not say.
  if (t === "LIST") {
    const li = listItemsOf(sentence);
    return li ? { type: t, data: { items: li.items, lead: li.lead || null } } : bad("LIST: the sentence states no enumeration of 3-5 short items");
  }
  if (t === "TIMELINE") {
    const tl = timelineOf(sentence);
    if (!tl) return bad("TIMELINE: the sentence states fewer than two dated events");
    const yr = (x) => Number((String(x).match(/(?:19|20)\d{2}/) || [0])[0]);
    return { type: t, data: { markers: [...tl].sort((a, c) => yr(a.date) - yr(c.date)) } };
  }
  if (t === "COMPARE") {
    const cmp = compareOf(sentence);
    return cmp ? { type: t, data: { a: cmp.a, b: cmp.b, relation: cmp.relation, subject: cmp.subject } } : bad("COMPARE: the sentence sets no two figures against each other");
  }
  if (t === "DOCUMENT") {
    const name = documentNameOf(sentence);
    return name ? { type: t, data: { name } } : bad("DOCUMENT: the sentence names no legal instrument or case");
  }
  if (t === "MONEY") {
    const object = moneyObjectOf(sentence);
    if (!object) return bad("MONEY: the sentence names no money object (cash, coins, a receipt, a currency)");
    const fig = quantitiesOf(sentence).find((q) => /[$€£₹]|\b(?:thousand|million|billion|trillion)\b/i.test(q.value));
    return { type: t, data: { object, value: fig ? fig.value : null } };
  }
  if (t === "MAP") {
    const place = String(d.place || "").trim();
    return place && resolveRegion(place) ? { type: t, data: { place } } : bad(`MAP place "${place}" is not a known region`);
  }
  if (t === "COUNTER") {
    if (!numIn(d.value, nums)) return bad(`COUNTER value "${d.value}" is not in the sentence`);
    // A count under 2 with no scale word ("1x", "1") rolls 0 -> 1 and shows
    // nothing: run 36411079375 ch-9 drew "1x intensity level" from a script
    // line "Fighting intensity has reached 1 times" and the review called the
    // "0x counter nonsensical". Percentages and scaled figures ("1.4
    // billion") are unaffected.
    // A value in words ("six") is drawn as its figure ("6").
    const vs0 = String(d.value);
    const vs = /\d/.test(vs0) ? vs0 : (wordNumbers(vs0)[0] !== undefined ? String(wordNumbers(vs0)[0]) : vs0), m = vs.match(/\d[\d,]*(?:\.\d+)?/);
    const n = m ? Number(m[0].replace(/,/g, "")) : NaN;
    const scaled = m ? /^\s*(thousand|million|billion|trillion|bn|mn|k|m|b)\b/i.test(vs.slice(m.index + m[0].length)) : false;
    if (n < 2 && !scaled && !vs.includes("%")) return bad(`COUNTER value "${d.value}" is a count of ${n}: a 0 -> ${n} roll shows no figure`);
    // A year is a date, not a quantity. Rolling 0 -> 1938 showed "1009" and
    // "366" mid-roll and the review called them wrong figures (run
    // 36419295509 ch-2), so a year was refused. The renderer now SNAPS a year in
    // (numberParts isQuantity=false: 0.15 s, scale from 0.92) instead of
    // counting it, so a year is a legitimate hero number — "1938" over "the year
    // the law passed". An identifier ("Article 10") is still refused:
    // a number that NAMES something is not a quantity (run 36509937804 ch-9
    // rolled 0 -> 10 for "Article 10", ch-2 drew "357-A" for "Section 357-A").
    if (isIdentifierNumber(vs, sentence)) return bad(`COUNTER value "${d.value}" is an identifier (an article / section / rule number), not a count`);
    // The figure as the SENTENCE writes it — its currency sign and scale
    // word / letter included. Run 36498049819 ch-26 drew a bare "352" beside
    // "hit five blockchains" where the sentence said "$352 million": the
    // planner's value had dropped the unit. The sentence's own expression
    // around the same number replaces a shorter value (never a longer one).
    const numRaw = m[0];
    const esc = numRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const around = String(sentence || "").match(new RegExp(`([$€£]\\s?)?${esc}(\\s?(?:%|percent\\b|thousand\\b|million\\b|billion\\b|trillion\\b|[kKmMbB]\\b))?`));
    const value = around && around[0].trim().length > vs.replace(/\s+/g, " ").trim().length ? around[0].trim() : vs;
    return { type: t, data: { value, label: d.label || null } };
  }
  if (t === "PIE" || t === "GAUGE") {
    const pct = Number(String(d.percent ?? "").replace(/[^\d.]/g, ""));
    // The figure must be a PERCENTAGE the sentence states ("40%", "40
    // percent"), not any number in it: "increasing in 2 jurisdictions"
    // passed as a 2% gauge before this (found 2026-09-28 testing the gate
    // repair) — a claim the sentence does not make.
    const statedPct = groundedOptions(sentence).percents;
    return Number.isFinite(pct) && pct > 0 && pct <= 100 && statedPct.includes(pct) ? { type: t, data: { percent: pct, label: d.label || null } } : bad(`${t} percent "${d.percent}" is not a percentage the sentence states`);
  }
  if (t === "BAR") {
    const bars = (Array.isArray(d.bars) ? d.bars : []).slice(0, 5);
    // One bar compares nothing: run 36509937804 ch-48 drew a lone "500
    // million" bar (canvas-coverage 53%). It is the sentence's one figure —
    // drawn as that figure, through the COUNTER gate.
    if (bars.length === 1) return checkVisual({ visual_type: "COUNTER", data: { value: bars[0]?.value, label: bars[0]?.label } }, sentence);
    return bars.length && bars.every((x) => numIn(x.value, nums)) ? { type: t, data: { bars: bars.map((x) => ({ label: String(x.label || ""), value: String(x.value) })) } } : bad("BAR values not all in the sentence");
  }
  if (t === "LINE") {
    const pts = (Array.isArray(d.points) ? d.points : []).slice(0, 8);
    return pts.length >= 2 && pts.every((x) => numIn(x.value, nums)) ? { type: t, data: { points: pts.map((x) => ({ label: String(x.label || ""), value: String(x.value) })) } } : bad("LINE needs 2+ points, all from the sentence");
  }
  return bad("unhandled");
}

// REFERENCE: docs/MOTION-GRAPHICS-SPEC.md defines the target beat (2-4 s,
// one drawing, build -> hold -> caption -> hold; 8-12 beats; forbidden
// list). NOT yet applied to the prompt below -- its §0 lists where today's
// output differs. Change this prompt toward that spec, not away from it.
// (Pointed to from here, not from the prompt text: Gemini cannot open a
// repo file, so a path inside the prompt would do nothing.)
// The planner prompt, in two parts (owner's token spec 2026-10-03, part A):
//   static   the rules, the compositions, the fields and ONE worked beat
//            (prompts/scene-example.json, embedded: the model cannot open a
//            file). Identical for every video, so Gemini caches it once per
//            run (gemini-client.js createCachedContent) and bills it at ~25%.
//   dynamic  this video's sentences and any review corrections.
// It was ~8,800 tokens (9 sentences) with eight worked examples, an essay on
// narrative typography, a 13-field "direction" block nothing on the canvas
// path reads, and prohibitions the code enforces anyway (the resolver never
// fetches a person from a stock site, the verifier takes MATCH only, the
// layout fills the middle zone). Every rule the model needs to DECIDE is kept.
const SCENE_EXAMPLE = (() => { try { return JSON.parse(readFileSync(join(ROOT, "prompts", "scene-example.json"), "utf-8")); } catch { return null; } })();
export function buildPlanPromptParts(sentences, corrections, channelId) {
  // Same formula as plan-caps.cjs capLimits(): TYPOGRAPHY <= min(2, floor(0.4n)).
  const typoMax = Math.min(2, Math.max(1, Math.floor(sentences.length * 0.4)));
  const last = sentences.length - 1;
  const example = SCENE_EXAMPLE
    ? `EXAMPLE — sentence "${SCENE_EXAMPLE.sentence}" -> ${JSON.stringify(SCENE_EXAMPLE.beat)}`
    : "";
  const staticPart = `You are the VISUAL DIRECTOR of a vertical (1080x1920, ~60 s) YouTube Short. Visualize what each sentence DOES — its object, the action, what changes, what a viewer with NO audio would understand — as one continuous visual argument, not separate scenes.

STYLE: full-frame editorial motion graphics on uniform white; a serif headline in sentence case (never all caps), oversized numerals, small sans labels; asymmetric layouts. Transitions, captions and camera are added by the system.

SCENE AND COMPOSITION (one rule). "scene_description" says in plain English what the viewer sees: name the subject literally (the person, the place, the object the sentence names), its place on screen (top / center / bottom / full-frame), its scale (small label, hero number, full-bleed) and the mood. A number -> a large number display; a process -> the flow; only a purely abstract sentence -> kinetic typography. Then "visual_type" + "data" choose ONE composition (never the same twice in a row — prefer the specific to the generic):
  TYPE (TYPE-FULL / TYPE-SPLIT) — a statement: the hook, a turn, the close.
  COUNTER {"value","label"} (NUMBER-FULL) — one figure the sentence says.
  BAR {"bars":[{"label","value"}]} / LINE {"points":[{"label","value"}]} — two or more figures it says. PIE / GAUGE {"percent","label"} — a percentage it says. (DATA-FULL)
  PHOTO {"entity"} — a real, verified photo of a named person (PORTRAIT), place (SCENE-FULL) or building / company / institution (ARCHITECTURE). The entity must be in named_entities and named in the sentence; with no verified photo the system draws its name.
  DOCUMENT {"name"} — a named law or case. MONEY {"object","value"} — a money object or amount; pick the object the sentence means: dollar bill (its denomination), stack of bills, banded cash bundle, single coin, stack of coins, wallet with cash, empty wallet, savings jar, piggy bank, cracked piggy bank, receipt, bank statement, credit card.
  MAP {"place"} — a country or US state it names.
  PROCESS {"nodes":[2-3 nodes of 1-3 words, every word from the sentence, cause -> effect order]} — only a stated cause/effect or sequence, not a list.
  TIMELINE {} (2+ dated events) · COMPARE {} (two figures against each other) · LIST {} (3-5 items) — the system reads these from the sentence.
Numbers exactly as the sentence says them; a number it does not say is rejected.

CHOOSING (enforced: if fewer than 60% of the beats between the hook and the close are visual the plan is sent back, and a TYPE beat whose sentence grounds a visual is converted). For each content beat, in order: two comparable numbers -> a chart (rule below); one number -> COUNTER; a place -> MAP or PHOTO; a person / company / institution / building -> PHOTO; a physical object -> list it in "concepts"; a cause or sequence -> PROCESS; dated events -> TIMELINE; an enumeration -> LIST; a change -> LINE / BAR / COMPARE; only if none applies -> TYPE. Beat 0 is a strong hook, the last beat a clear close or payoff; when the script names anyone or anywhere, at least one beat is a PHOTO. A number is shown for what it MEANS: a chart only when the sentence is about quantity, comparison or trend, never as decoration.
TWO-NUMBER RULE: a sentence with TWO DISTINCT comparable numbers and a comparison word (more, less, than, versus, higher, lower, grew, fell, rose, dropped, doubled, halved, increased, decreased, compared to — e.g. "rose from 3.8% to 4.3%", "10 million vs 22 million") is DATA-FULL: LINE for one thing over time, BAR for two categories, PIE for parts of a whole, GAUGE for a percentage change. Never TYPE or PHOTO. One number alone is a COUNTER, not this rule.

ENTITIES. "named_entities": everything the sentence NAMES that the scene shows, written as in the sentence, full name, no bracketed acronym: [{"type": "person"|"company"|"institution"|"place"|"building"|"object"|"number", "name"}] — company = a business ("Engel", "Bosch", "Fisher Phillips"); institution = an agency, court, standards body, trade show or international body ("SEC", "Hannover Messe", "ISO"); object = a physical thing; number = a figure it states. "entity_anchor_word": the ONE word of the sentence naming the main entity ("Powell", "courthouse", "347") — its visual pops when it is spoken; null if none. "concepts": up to 3 physical objects the sentence names, the LITERAL object never a symbol for an idea ("Equipping officers with gloves" -> ["gloves"], not "shield"); a name from CONCEPTS or a 1-3 word noun phrase of the sentence's own words; never a person, never an idea. CONCEPTS: ${CONCEPT_NAMES.join(", ")}

TEXT. "headline": 2-6 words FROM the sentence, never a full sentence, never a claim it does not make. "lead_in": 2-4 of the sentence's words, lowercase, or null. "emphasis_word": one headline word or null. "kind": "TYPE" only for beat 0${typoMax >= 2 ? ` and beat ${last}` : ""} (the hook${typoMax >= 2 ? " and the close" : ""}); every other beat "EDITORIAL". "typography_direction" only where text IS the beat (the hook, the close, a real turn): {"phrase": one line, 2-7 words, never the narration or a near-restatement, never a topic label like "The Problem", "moment": "hook"|"re_hook"|"key_fact"|"contradiction"|"question"|"statement"}; otherwise null. Typography is selective: at most ~1 in 3 beats text-forward.

MOTION. "motion_tier": "micro"|"medium"|"major" — EXACTLY 2-3 "major" (the hook, the pivot, the close), most "medium". "camera_focus": null or 1-2 [{"at_percent": 0.05-0.9, "target": number|chart|headline|photo|left|right|top|bottom|node0|node1|node2|full}]. "headline_zone" / "chart_zone": "top" / "middle", never the same (a COUNTER may swap: number "top", headline "middle"); "caption_zone": "bottom". "persists_from": the previous beat's index when this beat carries its element on, else null; "match_cut_prev": true when it shares that element. "text_entrance": omit, or POP_SOFT (a quiet beat) | POP_HARD (beat 0 or the last only) | POP_LETTER (at most one beat) | POP_WORD_STACK (a 2-5 word TYPE statement). "visual_events": [{"type": growth|depletion|comparison|revelation|structure_break|accumulation|population|evidence|contrast|causation, "label", "magnitude"}] — at least 5 distinct types across the video, never the same event 3 times in a row; "capabilities": the event types used (+ "typographic_emphasis" on a TYPE beat); "objects": {"label_a","label_b"} for contrast, {"figure"} for evidence, {"cause","effect"} for causation, else {}.

${example}

Respond ONLY with JSON (no markdown): {"beats":[ one object per sentence, in order, shaped like the example ]}`;
  let dynamicPart = `SCRIPT SENTENCES:\n${sentences.map((s, i) => `[${i}] (${s.start.toFixed(1)}s-${s.end.toFixed(1)}s) "${s.text}"`).join("\n")}`;
  if (corrections?.length) {
    dynamicPart += `\n\nPREVIOUS REVIEW CORRECTIONS — apply every fix:\n` +
      corrections.map((c) => `  ${c.scene || c.beat}: ${c.problem} → Fix: ${c.fix || c.action}`).join("\n");
  }
  void channelId;
  return { staticPart, dynamicPart };
}

function buildPlanPrompt(sentences, corrections, channelId) {
  const { staticPart, dynamicPart } = buildPlanPromptParts(sentences, corrections, channelId);
  return `${staticPart}\n\n${dynamicPart}`;
}

async function main() {
  const scriptPath = arg("script");
  const srtPath = arg("srt");
  const channelId = arg("channel");
  const outPath = arg("out");
  const correctionsPath = arg("corrections");

  if (!scriptPath || !outPath) {
    console.error("Usage: gemini-visual-plan.js --script <path> --srt <path> --channel <id> --out <plan.json>");
    process.exit(2);
  }

  let sentences = [];
  const srt = srtPath && existsSync(srtPath) ? srtPath : (srtPath ? join(ROOT, srtPath) : null);
  if (srt && existsSync(srt)) {
    sentences = parseSrt(readFileSync(srt, "utf-8").replace(/\r\n/g, "\n"));
    console.log(`SRT loaded: ${sentences.length} sentences`);
  } else {
    const scriptData = JSON.parse(readFileSync(join(ROOT, scriptPath), "utf-8"));
    const text = scriptData.voiceover_text || scriptData.script || "";
    sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10).map((s, i) => ({
      start: i * 5, end: (i + 1) * 5, text: s.trim(),
    }));
    console.log(`Script parsed: ${sentences.length} sentences (no SRT)`);
  }

  if (!sentences.length) {
    console.error("No sentences found in script/SRT.");
    process.exit(2);
  }

  let corrections = null;
  if (correctionsPath && existsSync(correctionsPath)) {
    const review = JSON.parse(readFileSync(correctionsPath, "utf-8"));
    corrections = review.corrections || review.wholeVideoResult?.corrections || [];
    if (corrections.length) {
      console.log(`Applying ${corrections.length} correction(s) from previous review`);
    }
  }

  console.log(`Requesting visual plan for ${sentences.length} beats (${forcedOllama() ? "ollama only: FORCE_PLANNER=ollama" : "gemini, ollama if gemini cannot answer"})...`);
  const prompt = buildPlanPrompt(sentences, corrections, channelId);
  // Context caching (owner's token spec 2026-10-03, A.1): the static part is uploaded once
  // and referenced; each Gemini call then sends only this video's sentences.
  const { staticPart, dynamicPart } = buildPlanPromptParts(sentences, corrections, channelId);
  const estTok = (t) => Math.ceil(String(t || "").length / 3.6);
  let geminiCache = null;
  if (!forcedOllama()) {
    const cc = createCachedContent(staticPart);
    if (cc.name) { geminiCache = cc; console.log(`[planner] ch-${channelId}: gemini context cache ${cc.name} (${cc.tokens ?? "?"} tokens, key ${cc.keyIndex + 1}, ttl 1 h)`); }
    else console.log(`[planner] gemini caching unavailable, using full prompt (${cc.error})`);
  }
  console.log(`[planner] ch-${channelId}: prompt ~${estTok(prompt).toLocaleString("en-US")} tokens (static ~${estTok(staticPart).toLocaleString("en-US")}, dynamic ~${estTok(dynamicPart).toLocaleString("en-US")}; est. at 3.6 chars/token)`);
  // A.5: after every planner call — the provider's own counts when it reports them.
  const logTokens = (r, provider, promptText) => {
    const u = r?._usage;
    const pt = u?.prompt_tokens ?? estTok(promptText);
    const cached = u?.prompt_tokens_details?.cached_tokens ?? (u?.cache_used ? estTok(staticPart) : 0);
    const out = u?.completion_tokens ?? (r && !r.error ? estTok(JSON.stringify(r)) : 0);
    console.log(`[planner] ch-${channelId}: ${provider} prompt ${Number(pt).toLocaleString("en-US")} tokens${u ? "" : " (est.)"} (cached: ${Number(cached).toLocaleString("en-US")}), response ${Number(out).toLocaleString("en-US")} tokens`);
  };
  const cacheFor = (extra = "") => (geminiCache ? { name: geminiCache.name, keyIndex: geminiCache.keyIndex, messages: [{ role: "user", content: dynamicPart + extra }] } : undefined);
  // Token budget scales with beat count so the JSON never truncates
  // mid-object (a 51-beat script once came back as "Unexpected end of JSON
  // input"). Each beat now carries the full director "direction" block
  // (~13 fields), so the per-beat budget is much larger than the old
  // headline-only estimate — ~600 tokens/beat plus headroom, capped at
  // 16384. A script needing more beats than that fits is a pacing problem
  // in the script/caption split, not something to fix here.
  // Raised from 600/beat: QA run 35931611864 got '{ "beats": [...' that
  // would not parse on 4 of 6 channels (5-6 beats, 5000-5600 tokens) — the
  // answer is cut off at the budget. describeShape() logs the answer's
  // length and tail so a cut-off is visible in the log, not guessed.
  const maxTokens = Math.min(16384, 2000 + sentences.length * 1500);
  // PROVIDERS: Gemini first, local Ollama (qwen2.5:7b via
  // scripts/ollama-client.cjs, /api/generate, format "json") when Gemini
  // cannot answer — the SAME prompt, so the plan has the same schema.
  //   - FORCE_PLANNER=ollama: Gemini is never called.
  //   - Gemini quota_exhausted / unavailable / any provider error: straight
  //     to Ollama (a spent quota resets in ~24 h; it is not retried).
  //   - Gemini answered but without usable beats (a bare array, prose, a
  //     wrong beat count): the one strict, uncached retry to Gemini, as
  //     before — then Ollama.
  //   - Ollama gets the same one strict retry for a wrong beat count.
  // There is no rule-based third link (scripts/local-visual-plan.cjs was
  // retired — data/ci-runs/blocked-planner-local-fallback.txt).
  const forced = forcedOllama();
  const strictSuffix = "\n\nReturn ONLY one JSON object whose top-level key is \"beats\" (an array with exactly " + sentences.length + " entries, one per sentence, in order). No prose, no markdown fences, no other top-level keys.";
  const strictPrompt = prompt + strictSuffix;
  const okBeats = (r) => Array.isArray(r?.beats) && r.beats.length === sentences.length;
  let geminiResult = null, geminiFailure = null, planSource = "gemini";
  if (forced) {
    console.error("[planner] ollama (FORCE_PLANNER=ollama — Gemini not called)");
  } else {
    geminiResult = normalizePlanResponse(await callGeminiApi([{ role: "user", content: prompt }], { maxTokens, temperature: 0.2, tag: "planner", cache: cacheFor() }));
    logTokens(geminiResult, "gemini", prompt);
    if (geminiResult?.source === "gemini" && geminiResult.error) {
      geminiFailure = geminiResult.error;
    } else if (!okBeats(geminiResult)) {
      // CI runs showed Gemini intermittently answering without a top-level
      // "beats" key, or with a beat count that shifts every beat onto the
      // wrong line (run 36362576442 ch-26). One strict, uncached retry.
      console.error(`Gemini plan attempt 1 ${geminiResult?.beats ? `has ${geminiResult.beats.length} beats for ${sentences.length} sentences` : `had no 'beats' — got: ${describeShape(geminiResult)}`}. Retrying once uncached.`);
      geminiResult = normalizePlanResponse(await callGeminiApi([{ role: "user", content: strictPrompt }], { maxTokens, temperature: 0.2, noCache: true, tag: "planner", cache: cacheFor(strictSuffix) }));
      logTokens(geminiResult, "gemini (strict retry)", strictPrompt);
      if (geminiResult?.source === "gemini" && geminiResult.error) geminiFailure = geminiResult.error;
      else if (!okBeats(geminiResult)) geminiFailure = geminiResult?.beats ? `beat count ${geminiResult.beats.length} != ${sentences.length}` : "no_beats";
    }
  }
  // Second tier: Groq ($GROQ_TEXT_MODEL, default openai/gpt-oss-120b), the same strict prompt.
  if (!forced && geminiFailure) {
    console.error(`[planner] gemini: ${geminiFailure} → groq${geminiResult?.detail ? ` (${String(geminiResult.detail).slice(0, 120)})` : ""}`);
    const t0 = Date.now();
    // Groq's free tier counts prompt + max_tokens against ~8,000 tokens a minute: the answer
    // budget is what is left (a 15,500-token request was refused as "too large", 413).
    const groqMax = Math.max(1500, Math.min(maxTokens, 7900 - estTok(strictPrompt)));
    const g = normalizePlanResponse(await callGroq([{ role: "user", content: strictPrompt }], { maxTokens: groqMax, temperature: 0.2 }));
    logTokens(g, `groq (max_tokens ${groqMax})`, strictPrompt);
    if (okBeats(g)) {
      geminiResult = g; geminiFailure = null; planSource = "groq";
      console.log(`[planner] plan from groq (${process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-120b"}, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    } else {
      const why = g?.source === "groq" && g.error ? g.error : g?.beats ? `beat count ${g.beats.length} != ${sentences.length}` : "no_beats";
      console.error(`[planner] groq: ${why} → ollama${g?.detail ? ` (${String(g.detail).slice(0, 120)})` : ""}`);
      geminiResult = g;
    }
  }
  if (forced || geminiFailure) {
    planSource = "ollama";
    const t0 = Date.now();
    // The strict one-beat-per-sentence instruction goes on the FIRST local
    // call: in run 36431582306 qwen2.5:7b answered the plain prompt with ONE
    // beat on every channel, so each paid a second 10-25 min call.
    geminiResult = normalizePlanResponse(await callOllamaOnly([{ role: "user", content: strictPrompt }], { maxTokens, temperature: 0.2, capKind: "plan" }, "planner"));
    if (!okBeats(geminiResult) && !(geminiResult?.source === "ollama" && geminiResult.error)) {
      console.error(`[planner] ollama plan ${geminiResult?.beats ? `has ${geminiResult.beats.length} beats for ${sentences.length} sentences` : `had no 'beats' — got: ${describeShape(geminiResult)}`} — one strict retry`);
      geminiResult = normalizePlanResponse(await callOllamaOnly([{ role: "user", content: strictPrompt }], { maxTokens, temperature: 0.2, capKind: "plan" }, "planner"));
    }
    logTokens(geminiResult, "ollama", strictPrompt);
    if (okBeats(geminiResult)) console.log(`[planner] plan from ollama (${process.env.OLLAMA_TEXT_MODEL || "qwen2.5:7b"}, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    else console.error(`[planner] ollama gave no usable plan: ${describeShape(geminiResult)} — no further fallback`);
  }

  if (geminiResult?.beats && geminiResult.beats.length !== sentences.length) {
    console.error(`Visual plan failed: ${geminiResult.beats.length} beats for ${sentences.length} sentences after the retry — not padding or trimming it`);
    process.exit(1);
  }
  // ── VISUAL-FIRST RATIO (owner's spec 2026-10-02) ──────────────────────
  // Content beats (not the hook, not the CTA): >= 60% visual. A beat is
  // visual when its visual_type is not TYPE, or when it names an object in
  // "concepts" (shown as an isolated photograph). Under 60%: the plan is
  // rejected and the same provider is re-asked ONCE with the constraint
  // emphasized; the better of the two plans is kept (the resolver then
  // converts any TYPE beat whose sentence grounds a visual).
  const visualRatio = (r) => {
    const content = (r?.beats || []).slice(1, -1);
    const vis = content.filter((b) => String(b.visual_type || "TYPE").toUpperCase() !== "TYPE" || (Array.isArray(b.concepts) && b.concepts.length)).length;
    return { vis, type: content.length - vis, share: content.length ? vis / content.length : 1 };
  };
  // TWO-NUMBER RULE (part D.3): a beat whose sentence compares two distinct numbers must be a
  // DATA-FULL chart (BAR / LINE / PIE / GAUGE). Violations join the same one re-ask.
  const twoNumber = (r) => (r?.beats || []).map((b, i) => ({ i: b.index ?? i, nums: comparisonNumbers(sentences[b.index ?? i]?.text), vt: String(b.visual_type || "TYPE").toUpperCase() }))
    .filter((x) => x.nums && !CHART_TYPES.includes(x.vt));
  if (okBeats(geminiResult)) {
    for (const x of (geminiResult.beats || []).map((b, i) => ({ i: b.index ?? i, nums: comparisonNumbers(sentences[b.index ?? i]?.text), vt: String(b.visual_type || "TYPE").toUpperCase() })).filter((x) => x.nums)) {
      console.log(`[plan] beat ${x.i}: two-number comparison (${x.nums.join(" vs ")}) -> ${CHART_TYPES.includes(x.vt) ? `DATA-FULL ${x.vt}, as the rule requires` : `${x.vt}: violates the two-number rule`}`);
    }
  }
  if (okBeats(geminiResult) && (sentences.length >= 4 || twoNumber(geminiResult).length)) {
    let rr = visualRatio(geminiResult);
    let tn = twoNumber(geminiResult);
    const ratioOk = (x) => sentences.length < 4 || x.share >= 0.6;
    console.log(`[plan] beat ratio: ${rr.vis} visual / ${rr.type} type (${(rr.share * 100).toFixed(0)}% visual, ${ratioOk(rr) ? "passes" : "fails — re-asking once"})${tn.length ? `; two-number rule broken on beat(s) ${tn.map((x) => x.i).join(", ")} — re-asking once` : ""}`);
    if (!ratioOk(rr) || tn.length) {
      const why = [];
      if (!ratioOk(rr)) why.push(`your plan made only ${(rr.share * 100).toFixed(0)}% of the content beats visual. At least 60% of the beats between the hook and the close MUST be visual (COUNTER, BAR, PIE, LINE, GAUGE, MAP, PROCESS, TIMELINE, COMPARE, LIST, PHOTO — or a TYPE beat that lists a named physical object in "concepts"). Walk the decision order for every content beat: a number, a place, a person, an object, a process, a change — TYPE only when none applies. Only what each sentence actually states.`);
      if (tn.length) why.push(`TWO-NUMBER RULE: ${tn.map((x) => `beat ${x.i} compares ${x.nums.join(" and ")} but is ${x.vt}`).join("; ")}. Each of these beats must be a DATA-FULL chart — LINE (one thing over time), BAR (two categories), PIE (parts of a whole) or GAUGE (a percentage change) — with those numbers exactly as the sentence says them.`);
      const emph = prompt + `\n\nREJECTED: ${why.join("\n")}` + strictPrompt.slice(prompt.length);
      const ask = planSource === "groq" ? () => callGroq([{ role: "user", content: emph }], { maxTokens, temperature: 0.2 })
        : planSource === "ollama" ? () => callOllamaOnly([{ role: "user", content: emph }], { maxTokens, temperature: 0.2, capKind: "plan" }, "planner")
        : () => callGeminiApi([{ role: "user", content: emph }], { maxTokens, temperature: 0.2, noCache: true, tag: "planner" });
      const again = normalizePlanResponse(await ask());
      if (okBeats(again)) {
        const r2 = visualRatio(again), t2 = twoNumber(again);
        console.log(`[plan] beat ratio after re-ask: ${r2.vis} visual / ${r2.type} type (${(r2.share * 100).toFixed(0)}% visual, ${ratioOk(r2) ? "passes" : "still under 60%"}); two-number violations ${tn.length} -> ${t2.length}`);
        // The better plan: fewer two-number violations first, then the higher visual share.
        if (t2.length < tn.length || (t2.length === tn.length && r2.share > rr.share)) { geminiResult = again; rr = r2; tn = t2; }
        if (tn.length) console.warn(`::warning::[plan] two-number rule still broken after the re-ask on beat(s) ${tn.map((x) => x.i).join(", ")}`);
      } else console.error(`[plan] re-ask gave no usable plan — keeping the first (${(rr.share * 100).toFixed(0)}% visual)`);
    }
  }
  const plan = geminiResult?.beats ? geminiResult : null;
  if (!plan || !plan.beats) {
    console.error(`Visual plan failed (gemini, then ollama): ${geminiResult?.error || "no 'beats' — got: " + describeShape(geminiResult)}`);
    process.exit(1);
  }

  // ── ENFORCE THE NARRATIVE-TYPOGRAPHY CONTRACT ─────────────────────────
  // The prose rules above are not trusted on their own. Every phrase the
  // plan puts on screen is normalised to a single line inside the word
  // budget, and blocking violations (headline/topic label, transcript
  // restatement, over-cap length) are reported and repaired here so the
  // renderer and the manifest both carry the corrected phrase.
  const typoReport = enforceTypographyContract(plan.beats, sentences);
  if (typoReport.repaired.length) {
    console.warn(`::warning::narrative-typography: repaired ${typoReport.repaired.length} phrase(s)`);
    for (const r of typoReport.repaired) {
      console.warn(`  beat ${r.index}: "${r.before}" -> "${r.after}"  (${r.reasons.join("; ")})`);
    }
  }
  if (typoReport.textBeatShare > TYPO_MAX_BEAT_SHARE) {
    console.warn(`::warning::narrative-typography: ${Math.round(typoReport.textBeatShare * 100)}% of beats carry on-screen text (max ${Math.round(TYPO_MAX_BEAT_SHARE * 100)}%) — typography should be selective, not the default`);
  }
  console.log(`Narrative typography: ${typoReport.textBeats}/${plan.beats.length} text beats, ${typoReport.repaired.length} repaired, ${typoReport.violations.length} violation(s)`);

  // ── COMPILE CAPABILITY-BASED DIRECTIVES ─────────────────────────────
  // Convert Gemini's creative visual specification into buildable scenes.
  // This is where the capability compiler validates and normalizes.
  const compilationReport = [];
  for (const b of plan.beats) {
    // Backward compatibility: convert mechanism-based to capability-based
    if (isMechanismBased(b) && !b.visual_events) {
      const converted = mechanismToCapability(b);
      if (converted) {
        b.visual_events = converted.visual_events;
        b.capabilities = converted.capabilities;
      }
    }

    // Compile the directive into a validated scene
    const { scene, warnings, errors } = compileScene(
      b,
      sentences[b.index]?.text || "",
      b.index,
      plan.beats.length
    );

    if (errors.length) {
      compilationReport.push({ beat: b.index, errors, warnings });
    }
    if (warnings.length) {
      for (const w of warnings) {
        console.warn(`::warning::beat ${b.index} compilation: ${w}`);
      }
    }

    // Attach compiled scene if available
    if (scene) {
      b.compiledScene = scene;
    }
  }
  console.log(`Capability compilation: ${compilationReport.length} issue(s) across ${plan.beats.length} beats`);

  // COMPOSITION VALIDATION — at plan time, before anything renders.
  //
  // A declaration the renderer cannot build is worth nothing, and an
  // unbuildable directive that still "applies" is the failure mode this
  // pipeline already had (REMOVE_TYPOGRAPHY applied, verified, and was
  // silently undone). So each beat's composition is checked here and the
  // errors become corrections for the next planning pass — which is where
  // RENDER_TECHNICAL finally becomes actionable instead of a verdict nobody
  // can act on.
  // Vocabulary synonyms Gemini keeps using, mapped to the primitive
  // vocabulary's own words (scene-primitives.js MOTIONS/ANCHORS). Run
  // 35835281167 rejected 15 compositions at render time for exactly these:
  // motion "static"/"none", anchor "ground". Only exact synonyms are mapped;
  // anything else still fails validation.
  const MOTION_SYNONYMS = { static: "hold", none: "hold", still: "hold", fixed: "hold", idle: "hold",
    growth: "grow", fade_in: "appear", fadein: "appear", slide_up: "rise", slide_down: "fall" };
  const ANCHOR_SYNONYMS = { ground: "bottom", floor: "bottom", middle: "center", centre: "center" };
  for (const b of plan.beats) {
    for (const o of b.composition?.objects || []) {
      const m = String(o.motion || "").toLowerCase();
      const a = String(o.anchor || "").toLowerCase();
      if (MOTION_SYNONYMS[m]) { console.log(`[vocab] beat ${b.index}: motion "${o.motion}" -> "${MOTION_SYNONYMS[m]}"`); o.motion = MOTION_SYNONYMS[m]; }
      if (ANCHOR_SYNONYMS[a]) { console.log(`[vocab] beat ${b.index}: anchor "${o.anchor}" -> "${ANCHOR_SYNONYMS[a]}"`); o.anchor = ANCHOR_SYNONYMS[a]; }
    }
  }

  // ── GATE REPAIR: one second chance for gate-rejected visuals ─────────
  // Run 36478456863 (ch-2/26/48): 11 of 17 rendered beats were planned as a
  // CUTOUT/COUNTER/chart, and checkVisual turned 6 of them into TYPE — each
  // rejection correct (a GAUGE "100" or BAR values the sentence never says,
  // a CUTOUT of an object it never names). With the TYPE beats the planner
  // chose itself, 12/17 beats rendered as typography. The prompt already
  // states these rules; the model breaks them anyway. So the rejected beats
  // go back ONCE, each with its exact rejection and the options its
  // sentence can actually ground (groundedOptions). Every answer goes
  // through the SAME checkVisual below — the gate is not loosened; an
  // answer that still fails is TYPE, as before. Not on a local-model plan
  // (another CPU-bound call), and not under FORCE_PLANNER=ollama.
  const imageView = new Map();      // beat index -> what its resolved photo shows (person / building / scene)
  if (planSource !== "ollama" && !forcedOllama()) {
    const rejected = [];
    // A PHOTO is only as good as the photo that exists: each PHOTO entity is
    // resolved NOW (scripts/entity-assets.cjs, cached for the render). No
    // verified photo -> the beat goes to the repair with that reason, while a
    // grounded alternative can still be chosen (run 36504143080 ch-26: all six
    // PHOTO beats fell back to type at render time -> 100% typography).
    const countries = plan.beats.flatMap((x) => (Array.isArray(x.named_entities) ? x.named_entities : []).filter((e) => String(e?.type).toLowerCase() === "place").map((e) => e.name)).filter((n) => resolveRegion(n));
    // DOCUMENT and MONEY need a real image exactly as PHOTO does: a scan of the
    // named instrument, a photograph of the money object. Resolved now; without
    // one the beat goes to the repair with that reason (and the type removed
    // from its allowed list) — never a stand-in image.
    const needImage = async (b, v, sentenceText) => {
      const r = v.type === "DOCUMENT" ? await resolveDocument({ name: v.data.name }) : await resolveMoney({ query: v.data.object });
      const what = v.type === "DOCUMENT" ? `the document "${v.data.name}"` : `"${v.data.object}"`;
      if (r.ok) { console.log(`[plan-image] beat ${b.index}: ${v.type} ${what} has a real ${v.type === "DOCUMENT" ? "scan" : "photo"} (${r.asset})`); return true; }
      console.log(`[plan-image] beat ${b.index}: ${v.type} ${what} — no real image (${String(r.why).slice(0, 140)})`);
      const opts = groundedOptions(sentenceText);
      opts.allowed = opts.allowed.filter((t) => t !== v.type);
      rejected.push({ b, sentenceText, asked: v.type, opts, why: `no real ${v.type === "DOCUMENT" ? "scan" : "photo"} of ${what} exists — choose another visual the sentence grounds` });
      return false;
    };
    for (const b of plan.beats) {
      if (b.visual_type === undefined) continue;
      const sentenceText = sentences[b.index]?.text || sentences[plan.beats.indexOf(b)]?.text || "";
      const v = checkVisual(b, sentenceText);
      if (v.why) { rejected.push({ b, sentenceText, why: v.why, asked: String(b.visual_type).toUpperCase(), opts: groundedOptions(sentenceText) }); continue; }
      if (v.type === "PHOTO") {
        const q = qualifyEntity({ type: v.data.entity_type, name: v.data.entity }, countries);
        const r = q.ent ? await resolveEntity({ type: q.ent.type, name: q.ent.name }) : { ok: false, why: q.note };
        if (r.ok) { imageView.set(b.index, r.view || "scene"); console.log(`[plan-photo] beat ${b.index}: ${v.data.entity_type} "${v.data.entity}" has a verified photo (${r.asset}, view ${r.view || "scene"})`); }
        else {
          console.log(`[plan-photo] beat ${b.index}: ${v.data.entity_type} "${v.data.entity}" — no verified photo (${String(r.why).slice(0, 140)})`);
          const opts = groundedOptions(sentenceText);
          opts.allowed = opts.allowed.filter((t) => t !== "PHOTO");
          rejected.push({ b, sentenceText, asked: "PHOTO", opts, why: `no real, verified photo of ${v.data.entity} exists — choose another visual the sentence grounds` });
        }
      } else if (v.type === "DOCUMENT" || v.type === "MONEY") {
        await needImage(b, v, sentenceText);
      }
    }
    // Variety: a video that is mostly typography is rejected by the review
    // (TEMPLATE_MONOCULTURE — run 36500636962 ch-26 71-85%, ch-44 80-90%).
    // When over 40% of beats are type (TYPE, or one big COUNTER), each pure
    // TYPE beat between the hook and the close is offered back too, with what
    // its sentence can ground. The same gate judges the answer; a sentence
    // that grounds nothing stays TYPE — nothing is invented to fill the frame.
    {
      const n = plan.beats.length;
      const vtOf = (b) => String(b.visual_type || "TYPE").toUpperCase();
      const typeish = plan.beats.filter((b) => ["TYPE", "COUNTER"].includes(vtOf(b))).length;
      if (n >= 4 && typeish / n > 0.4) {
        let added = 0;
        for (const [i, b] of plan.beats.entries()) {
          if (i === 0 || i === n - 1 || vtOf(b) !== "TYPE" || rejected.some((r) => r.b === b)) continue;
          const sentenceText = sentences[b.index]?.text || sentences[i]?.text || "";
          rejected.push({ b, sentenceText, asked: "TYPE", opts: groundedOptions(sentenceText),
            why: `${Math.round((100 * typeish) / n)}% of this video is typography — show this sentence as a PROCESS, a figure, a named entity's PHOTO or a MAP if it grounds one; TYPE only if it grounds none` });
          added++;
        }
        if (added) console.log(`[plan-repair] ${typeish}/${n} beats are typography — ${added} TYPE beat(s) offered back for a grounded visual`);
      }
    }
    const worth = rejected;
    if (worth.length) {
      const lines = worth.map((r) => `Beat ${r.b.index}. Sentence: "${r.sentenceText}"
  Rejected: ${r.asked} — ${r.why}
  Numbers you may use: ${r.opts.counts.join(", ") || "none"} | Percentages: ${r.opts.percents.join(", ") || "none"} | Known places: ${r.opts.places.join(", ") || "none"}
  Allowed visual_type: ${r.opts.allowed.join(", ")}`).join("\n\n");
      const repairPrompt = `A code check rejected the visuals below. Replace each one with a visual_type and data that PASS the check, using ONLY what the sentence itself says.

The check (it runs on your answer):
- COUNTER {"value": "...", "label": "..."}: value is one of "Numbers you may use", written as in the sentence.
- PIE / GAUGE {"percent": n, "label": "..."}: n is one of the listed percentages.
- BAR {"bars": [{"label","value"}]} / LINE {"points": [{"label","value"}]}: every value is a number in the sentence; LINE needs 2+.
- MAP {"place": "..."}: one of the listed known places.
- PHOTO {"entity": "..."}: a person, place or organization the sentence NAMES, written as in the sentence; add it to "named_entities" too.
- LIST / TIMELINE / COMPARE / DOCUMENT / MONEY: {} — the system reads the data from the sentence; choose one only when "Allowed visual_type" lists it.
- PROCESS {"nodes": ["...", "..."]}: 2-3 nodes of 1-3 words each, every word from the sentence (a cause -> effect or sequence).
- TYPE {}: when nothing above fits. TYPE is the honest answer for a sentence with no number, no percentage, no place and no physical object.

${lines}

Respond ONLY with JSON: {"beats":[{"index":<n>,"visual_type":"<one allowed type>","data":{...},"named_entities":[{"type":"person|place|organization","name":"..."}]}]} — one entry per beat above.`;
      const t0 = Date.now();
      const ans = await callLLM([{ role: "user", content: repairPrompt }], { maxTokens: 1500, temperature: 0 }, "plan-repair");
      const got = isProviderError(ans) ? [] : (Array.isArray(ans?.beats) ? ans.beats : Array.isArray(ans) ? ans : []);
      let fixed = 0;
      for (const r of worth) {
        const a = got.find((x) => Number(x?.index) === r.b.index);
        if (!a) { console.log(`[plan-repair] beat ${r.b.index}: ${r.asked} rejected, no replacement returned -> TYPE`); continue; }
        const cand = { visual_type: a.visual_type, data: a.data || {}, named_entities: [...(r.b.named_entities || []), ...(Array.isArray(a.named_entities) ? a.named_entities : [])] };
        const v0 = checkVisual(cand, r.sentenceText);
        // Repetition guard: run 36506838927 ch-26 — the repair turned five
        // beats into the same "$388M" counter. A figure another beat already
        // draws is refused here.
        const fk = figureKey(v0);
        const clash = fk && plan.beats.find((x) => x !== r.b && figureKey(checkVisual(x, sentences[x.index]?.text || "")) === fk);
        let v = clash ? { type: "TYPE", data: null, why: `the figure is already drawn in beat ${clash.index}` } : v0;
        // A PHOTO answer needs a real photo exactly like a planned one: run
        // 36509937804 ch-26 ("Kristopher Lunsford") and ch-44 ("Mike James
        // Ross") passed here, had no free photo, and fell back to type at
        // render time — after the repair could have chosen something else.
        if (!v.why && v.type === "PHOTO") {
          const q = qualifyEntity({ type: v.data.entity_type, name: v.data.entity }, countries);
          const pr = q.ent ? await resolveEntity({ type: q.ent.type, name: q.ent.name }) : { ok: false, why: q.note };
          if (!pr.ok) v = { type: "TYPE", data: null, why: `no verified photo of ${v.data.entity} (${String(pr.why).slice(0, 120)})` };
        }
        const t = String(a.visual_type || "").toUpperCase();
        if (!v.why && v.type !== "TYPE") {
          r.b.visual_type = v.type; r.b.data = v.data; fixed++;
          if (v.type === "PHOTO") r.b.named_entities = cand.named_entities;
          console.log(`[plan-repair] beat ${r.b.index}: ${r.asked} -> ${v.type} ${JSON.stringify(v.data)} (passed the gate)`);
        } else {
          console.log(`[plan-repair] beat ${r.b.index}: ${r.asked} -> ${t || "?"}${v.why ? ` still rejected (${v.why})` : " (TYPE)"}`);
        }
      }
      console.log(`[plan-repair] ${fixed}/${worth.length} rejected visual(s) replaced with a grounded one (${((Date.now() - t0) / 1000).toFixed(0)}s${isProviderError(ans) ? `, model: ${ans.error}` : ""})`);
    }
  }

  // ── FLOW -> PROCESS, deterministically ──────────────────────────────
  // A beat still TYPE (after the repair) whose sentence STATES a flow is
  // drawn as that flow: flowNodes() takes both nodes from the sentence's own
  // words around its flow word, so the PROCESS gate below passes by
  // construction and nothing is invented. Only while the video is over 40%
  // typography, and never the hook or the close (their type is the point).
  // Runs 36504143080 .. 36509937804: every TEMPLATE_MONOCULTURE rejection
  // had flow sentences drawn as type because the model paraphrased the nodes.
  {
    const n = plan.beats.length;
    const vtOf = (b) => String(b.visual_type || "TYPE").toUpperCase();
    const typeish = () => plan.beats.filter((b) => {
      const st = sentences[b.index]?.text || "";
      return vtOf(b) === "TYPE" || vtOf(b) === "COUNTER" || (b.visual_type !== undefined && checkVisual(b, st).why);
    }).length;
    for (const [i, b] of plan.beats.entries()) {
      if (n < 4 || typeish() / n <= 0.4) break;
      if (i === 0 || i === n - 1 || b.visual_type === undefined) continue;
      const st = sentences[b.index]?.text || sentences[i]?.text || "";
      if (vtOf(b) !== "TYPE" && !checkVisual(b, st).why) continue;
      const nodes = flowNodes(st);
      if (!nodes) continue;
      const cand = { visual_type: "PROCESS", data: { nodes } };
      if (checkVisual(cand, st).why) continue;
      console.log(`[plan-flow] beat ${b.index}: ${vtOf(b)} -> PROCESS ${JSON.stringify(nodes)} (the sentence states this flow)`);
      b.visual_type = "PROCESS"; b.data = { nodes };
    }
  }

  // ── NO REPEAT: never the same composition twice in a row ─────────────
  // (composition-rotation.js). A repeat is broken with what the SENTENCE
  // grounds — a timeline, a comparison, a list, a process, a map, a stated
  // percentage, a hero figure — and finally TYPE-SPLIT / TYPE-FULL; every
  // alternative goes through the same checkVisual. A repeat nothing can break
  // is logged and kept, never hidden.
  {
    const sentOf = (b, i) => sentences[b.index]?.text || sentences[i]?.text || "";
    const effective = (i) => {
      const b = plan.beats[i];
      const v = b.visual_type === undefined ? { type: "TYPE" } : checkVisual(b, sentOf(b, i));
      return v;
    };
    const compOf = (i) => {
      const b = plan.beats[i], v = effective(i);
      const image = ["PHOTO", "DOCUMENT", "MONEY"].includes(v.type);
      return compositionFor(v.type, image, { view: imageView.get(b.index) === "building" ? "building" : null, split: b.type_layout === "split" && !!splitHeadline(b.headline) });
    };
    const figureOthers = (i) => plan.beats.map((_, j) => (j === i ? null : figureKey(effective(j))));
    const rot = enforceRotation(plan.beats.length, {
      compositionOf: compOf,
      candidates: (i) => candidatesFor({ sentence: sentOf(plan.beats[i], i), headline: plan.beats[i].headline || "" }),
      accept: (i, alt) => {
        const b = plan.beats[i];
        const v = checkVisual({ visual_type: alt.visual_type, data: alt.data || {}, named_entities: b.named_entities }, sentOf(b, i));
        if (v.why || v.type !== alt.visual_type) return false;
        const fk = figureKey(v);
        return !(fk && figureOthers(i).includes(fk));
      },
      apply: (i, alt) => {
        const b = plan.beats[i], v = checkVisual({ visual_type: alt.visual_type, data: alt.data || {}, named_entities: b.named_entities }, sentOf(b, i));
        b.visual_type = v.type; b.data = v.data;
        if (alt.extra?.split) b.type_layout = "split"; else delete b.type_layout;
      },
      log: (m) => console.log(m),
    });
    if (rot.changes.length) console.log(`[plan] composition rotation: ${rot.changes.filter((c) => c.resolved).length} repeat(s) broken, ${rot.repeats.length} left (${plan.beats.map((_, i) => compOf(i)).join(", ")})`);
  }

  // Fix 2: every element of every beat gets an animation (visual/animation-plan.js:
  // one per element per beat, no family repeated on the same element in
  // consecutive beats, the last three beats' animations removed from the
  // choices). This is the plan's preview; the resolver re-runs it on the final
  // canvases (scripts/anim-plan.js) and its choice is the one rendered.
  {
    const run = previewAnimations(plan.beats, { seed: channelId, log: (m) => console.log(m) });
    if (run.relaxed.length) console.log(`[anim] relaxed: ${run.relaxed.join("; ")}`);
  }

  const planRuleIssues = [];
  // ── BUILD EACH BEAT'S COMPOSITION FROM ITS FIELDS (real-asset pipeline) ──
  // The model no longer composes. A VISUAL beat is { concept, asset_query,
  // fallback_drawing, caption, number }; its composition is built here as
  // the fallback drawing (+ a counter for a named number). The asset
  // resolver in render-and-qa.js replaces the drawing with a real photo when
  // the concept resolves. A composition the model wrote anyway is ignored.
  // A TYPE beat gets no composition and the typographic_emphasis capability.
  // The sentence each beat narrates (the resolver rebuilds the headline's sentence case from it).
  for (const b of plan.beats) b.narration = sentences[b.index]?.text || sentences[plan.beats.indexOf(b)]?.text || "";
  let lastPercentType = null;
  const figuresShown = new Map();
  for (const b of plan.beats) {
    // The sentence this beat narrates: the resolver rebuilds the headline's
    // sentence case from its casing (visual/typography.js sentenceCase).
    b.narration = sentences[b.index]?.text || sentences[plan.beats.indexOf(b)]?.text || "";
    // visual_type (planner's choice), checked against the sentence.
    if (b.visual_type !== undefined) {
      const sentenceText = sentences[b.index]?.text || sentences[plan.beats.indexOf(b)]?.text || "";
      const v = checkVisual(b, sentenceText);
      if (v.why) console.warn(`::warning::[plan] beat ${b.index}: ${b.visual_type} -> TYPE (${v.why})`);
      // One figure, one beat: the same number drawn again is repetition, not
      // information (the review failed ch-26 for five "$388M" counters).
      {
        const fk = figureKey(v);
        if (fk && figuresShown.has(fk)) {
          console.warn(`::warning::[plan] beat ${b.index}: ${v.type} repeats the figure of beat ${figuresShown.get(fk)} -> TYPE`);
          v.type = "TYPE"; v.data = null;
        } else if (fk) figuresShown.set(fk, b.index);
      }
      // Variety: a percentage is drawn as a PIE or a GAUGE — the same figure
      // and label either way. Run 36405739332 ch-48 drew gauge after gauge
      // and the review called it "excessive reuse of the exact same gauge".
      // When the previous percentage beat used this type, use the other.
      if ((v.type === "PIE" || v.type === "GAUGE") && lastPercentType === v.type) {
        const other = v.type === "PIE" ? "GAUGE" : "PIE";
        console.log(`[plan] beat ${b.index}: ${v.type} -> ${other} (variety: the previous percentage beat was also a ${v.type})`);
        v.type = other;
      }
      if (v.type === "PIE" || v.type === "GAUGE") lastPercentType = v.type;
      if (b.lead_in && !leadInFromSentence(b.lead_in, sentenceText)) {
        console.warn(`::warning::[plan] beat ${b.index}: lead-in "${b.lead_in}" is not from its sentence — dropped`);
        b.lead_in = null;
      }
      b.visual_type = v.type;
      b.data = v.data;
      b.kind = v.type === "TYPE" ? "TYPE" : "EDITORIAL";
      if (v.type !== "TYPE") b.capabilities = [TYPE_CAPABILITY[v.type]];
    }
    const kind = String(b.kind || (b.headline ? "EDITORIAL" : b.concept ? "VISUAL" : "")).toUpperCase();
    // Reference paper style: an EDITORIAL beat is drawn by PaperVideo from
    // its own fields (headline, cutout, shape) — it has no composition.
    if (kind === "EDITORIAL") {
      b.kind = "EDITORIAL";
      delete b.composition;
      if (!Array.isArray(b.capabilities) || !b.capabilities.length) b.capabilities = [b.number ? "evidence" : "revelation"];
      console.log(`[plan] beat ${b.index}: EDITORIAL ${b.visual_type || "?"} ${JSON.stringify(b.data || {})} lead="${b.lead_in || ""}" headline="${b.headline || ""}" shape=${b.abstract_shape || "-"}`);
      continue;
    }
    if (kind === "TYPE") {
      b.kind = "TYPE";
      // An explicit TYPOGRAPHY mechanism. Without it a TYPE beat compiled to
      // "CAPABILITY" with no objects, which BeatBody cannot render (it
      // throws), and the TYPOGRAPHY cap never counted it — it only ever saw
      // the hook. With it, the cap limits TYPE beats for real.
      b.mechanism = TYPOGRAPHY;
      delete b.composition;
      if (!Array.isArray(b.capabilities) || !b.capabilities.includes("typographic_emphasis")) {
        b.capabilities = ["typographic_emphasis", ...(Array.isArray(b.capabilities) ? b.capabilities : [])];
      }
      continue;
    }
    b.kind = "VISUAL";
    const caption = b.caption == null ? undefined : String(b.caption).trim() || undefined;
    const number = b.number == null ? null : String(b.number).trim();
    if (b.fallback_drawing) {
      const objects = [{ kind: "library_shape", name: String(b.fallback_drawing).trim(), anchor: "center", motion: "appear", label: caption, emphasis: true }];
      if (number && /\d/.test(number)) objects.push({ kind: "counter", label: number, anchor: "top_right", motion: "appear" });
      b.composition = { objects };
    } else {
      delete b.composition;
    }
    console.log(`[plan] beat ${b.index}: VISUAL concept="${String(b.concept || "").slice(0, 70)}" query="${b.asset_query || ""}" fallback="${b.fallback_drawing || "-"}"`);
    // The prompt's own rules, fed back to the corrective (plan-fix) pass
    // when broken — run 36357817392 ch-1: concepts "a financial benchmark
    // bar", "a case file folder and balance sheet", "a vessel of cash notes
    // draining" (drawing names, not photos) and fallback "vessel" (a
    // primitive, not a LIBRARY drawing).
    const conceptText = ` ${String(b.concept || "").toLowerCase()} `;
    // Only names that exist SOLELY as drawings — diagram shapes and
    // primitives. Library names that are ordinary objects ("receipt",
    // "calculator", "conveyor belt") are fine in a photo concept.
    const DRAWING_ONLY = ["benchmark bar", "concept node", "link path", "process arrow", "benefit rule", "checklist rule",
      "timeline rule", "load curve", "progress arc", "latency trace", "question line", "answer frame", "plan comparison rows",
      "stacked layer", "scale bar", "depth scale", "wire node", "vital trace", "date marker", "evidence tube", "resource site marker",
      "vessel", "gauge", "silhouette", "infographic", "diagram", "icon", "grid of", "node graph", "map sheet"];
    const named = DRAWING_ONLY.filter((n) => conceptText.includes(` ${n}`));
    if (named.length) {
      planRuleIssues.push({ beat: b.index, problem: `concept names a drawing/primitive (${named.slice(0, 3).join(", ")}), not something a camera could photograph`,
        fix: "rewrite \"concept\" and \"asset_query\" as a real photograph of where this happens; keep drawings only in \"fallback_drawing\"" });
    }
    if (b.fallback_drawing && !LIBRARY_NAMES.includes(String(b.fallback_drawing).trim())) {
      planRuleIssues.push({ beat: b.index, problem: `fallback_drawing "${b.fallback_drawing}" is not a LIBRARY drawing`,
        fix: "set \"fallback_drawing\" to an exact LIBRARY name that depicts the same subject" });
    }
  }

  const compositionIssues = [...planRuleIssues];
  let composedBeats = 0;
  for (const b of plan.beats) {
    if (b.kind === "EDITORIAL") continue;   // drawn by PaperVideo, not composed
    if (!b.composition || !Array.isArray(b.composition.objects) || !b.composition.objects.length) {
      compositionIssues.push({
        beat: b.index,
        problem: "no composition declared — the beat has nothing to render but text",
        fix: "give this VISUAL beat a real-image \"concept\", an \"asset_query\" and a \"fallback_drawing\" copied exactly from LIBRARY that depicts the same subject — or make it \"kind\": \"TYPE\" (at most 2 TYPE beats)",
      });
      continue;
    }
    const v = validateScene(b.composition);
    // Persist the normalised scene (e.g. "earth-globe" -> "earth globe") so
    // the plan file, the challenger and the renderer all see what was checked.
    if (v.scene) b.composition = v.scene;
    b.compositionCoverage = v.coverage;
    b.compositionValid = v.ok;
    if (!v.ok) {
      for (const e of v.errors) {
        compositionIssues.push({ beat: b.index, problem: e, fix: "re-compose this beat from the declared primitives" });
      }
    } else {
      composedBeats++;
    }
    for (const w of v.warnings) {
      console.warn(`::warning::beat ${b.index} composition: ${w}`);
    }
  }
  console.log(`Composition: ${composedBeats}/${plan.beats.length} beats buildable, ${compositionIssues.length} issue(s)`);
  for (const i of compositionIssues.slice(0, 10)) {
    console.warn(`  beat ${i.beat}: ${String(i.problem).split(" — ")[0]}`);
  }

  // ── CAPS: TYPOGRAPHY 1–2, NO MECHANISM OVER 40% ──────────────────────
  // Applied here, before the plan is written, not in the QA correction loop
  // (which --skip-qa bypasses). A beat's effective mechanism is the one the
  // director will render: its explicit `mechanism`, else the mechanism its
  // capability directive compiles to. A beat with neither cannot be
  // directed, so the plan is rejected rather than handed to the renderer.
  // compileScene() labels every capability-built scene "CAPABILITY" — a
  // placeholder, not what the beat shows. Counting that label made 6 of 7
  // beats one "mechanism" and the cap then forced them onto legacy scenes
  // (run 35817394030, ch-2). A capability beat is identified by its primary
  // capability instead.
  const effectiveOf = (b) => {
    if (b.mechanism) return b.mechanism;
    const m = b.compiledScene?.mechanism;
    if (!m) return null;
    if (m !== "CAPABILITY") return m;
    const cap = (b.capabilities || [])[0] || b.visual_events?.[0]?.type;
    return cap ? `CAPABILITY:${cap}` : null;
  };
  const effective = plan.beats.map(effectiveOf);
  const undirectable = effective.map((m, i) => (m ? -1 : i)).filter((i) => i >= 0);
  if (undirectable.length) {
    console.error(`Plan rejected: beat(s) ${undirectable.join(", ")} compile to no mechanism.`);
    process.exit(1);
  }
  let capped;
  try {
    capped = enforceCaps(effective);
  } catch (e) {
    console.error(`Plan rejected: ${e.message}`);
    process.exit(1);
  }
  for (const c of capped.changes) {
    const b = plan.beats[c.beat];
    // Setting `mechanism` routes this beat through applyDirective() with the
    // capped mechanism instead of the capability compiler.
    b.mechanism = c.to;
    b.cap_reassigned = { from: c.from, why: c.why };
    if (c.to === TYPOGRAPHY) {
      // A TYPOGRAPHY beat with no phrase would render an empty frame.
      const phrase = b.typography_direction?.phrase || b.visual_headline
        || (sentences[c.beat]?.text || "").split(/\s+/).slice(0, 6).join(" ");
      b.visual_headline = b.visual_headline || phrase;
      b.typography_direction = { ...(b.typography_direction || {}), phrase };
    }
    console.log(`[caps] beat ${c.beat}: ${c.from} -> ${c.to} (${c.why})`);
  }
  console.log(`Mechanisms after caps: ${describeMechanisms(capped.mechanisms)}`);

  // A TYPOGRAPHY beat renders the typography scene; a composition on it is
  // never drawn. Cap-reassigned hooks kept Gemini's composition, which then
  // failed the coverage floor at render time and was "rejected — falling
  // back to mechanism" (ch-48 beat 0, run 35833174133). Drop it here, and
  // drop its issues from the report.
  capped.mechanisms.forEach((m, i) => {
    const b = plan.beats[i];
    if (m === TYPOGRAPHY && b.composition) {
      b.composition = null;
      b.compositionValid = null;
    }
    // Keep `kind` in step with the capped mechanism, so the asset resolver
    // does not put a photo on a beat that renders as typography (the hook
    // is always TYPOGRAPHY), and a TYPE beat the cap moved to a legacy
    // mechanism (which draws abstract geometry) fails loudly instead.
    const movedFromTypo = capped.changes.some((c) => c.beat === i && c.from === TYPOGRAPHY && c.to !== TYPOGRAPHY);
    if (m === TYPOGRAPHY) {
      b.kind = "TYPE";
    } else if (b.kind === "TYPE" && movedFromTypo && plan.beats.some((x) => x.headline !== undefined)) {
      // Paper style: an over-cap TYPE beat simply becomes a typography-only
      // EDITORIAL paper beat — nothing is invented and nothing fails.
      console.warn(`::warning::[plan] beat ${b.index}: TYPE over the cap -> typography-only EDITORIAL paper beat`);
      b.kind = "EDITORIAL";
    } else if (b.kind === "TYPE" && movedFromTypo) {
      console.warn(`::warning::[plan] beat ${b.index}: TYPE reassigned to ${m} by the TYPOGRAPHY cap — it has no concept, so asset resolution will fail it`);
      b.kind = "VISUAL";
      // Raised as a composition issue so render-and-qa's plan-fix pass asks
      // the model for a VISUAL beat with a real concept, instead of the
      // resolver failing the whole channel (run 36355665493 ch-1 beat 4).
      compositionIssues.push({
        beat: b.index,
        problem: `TYPE beyond this video's TYPOGRAPHY limit (${capped.mechanisms.filter((x) => x === TYPOGRAPHY).length}) — the cap reassigned it`,
        fix: "make this beat \"kind\": \"VISUAL\" with a photographable \"concept\", an \"asset_query\" and a LIBRARY \"fallback_drawing\" of the same subject",
      });
    }
  });
  const typoBeats = new Set(capped.mechanisms.map((m, i) => (m === TYPOGRAPHY ? plan.beats[i].index ?? i : -1)));
  for (let k = compositionIssues.length - 1; k >= 0; k--) {
    if (typoBeats.has(compositionIssues[k].beat)) compositionIssues.splice(k, 1);
  }
  composedBeats = plan.beats.filter((b) => b.composition && b.compositionValid).length;

  // A composition that still fails validation is removed HERE, at plan
  // time, with its reason recorded on the beat (composition_dropped) and
  // counted in the plan. The beat renders its mechanism scene by plan
  // decision. Previously the renderer discovered the same thing at render
  // time and fell back silently mid-render.
  const dropped = [];
  for (const b of plan.beats) {
    if (b.composition && b.compositionValid === false) {
      const reasons = compositionIssues.filter((i) => i.beat === b.index).map((i) => String(i.problem).split(" — ")[0]);
      b.composition_dropped = { reasons, coverage: b.compositionCoverage ?? null };
      b.composition = null;
      dropped.push(b.index);
      console.log(`[plan] beat ${b.index}: composition dropped at plan time (${reasons[0] || "invalid"}) — renders its mechanism scene`);
    }
  }
  if (dropped.length) console.log(`[plan] ${dropped.length} composition(s) dropped at plan time: beats ${dropped.join(", ")}`);

  // ── FULL-CANVAS FIELDS, checked (2026-09-29) ─────────────────────────
  //   named_entities   only entities the sentence names (checkEntities)
  //   motion_tier      micro | medium | major; 2-3 "major" per video (1-3
  //                    under 4 beats): extra majors -> medium (latest first,
  //                    keeping the hook and the close); too few -> the hook,
  //                    then the close, then the widest composition change
  //   camera_focus     <= 2 events, at_percent 0.05-0.9, a known target
  //   persists_from    only the PREVIOUS beat's index; match_cut_prev boolean
  //   canvas_composition  recorded as the planner wrote it; the renderer
  //                    derives the composition from the CHECKED visual_type
  {
    const TARGETS = new Set(["number", "chart", "data", "headline", "text", "photo", "subject", "left", "right", "top", "bottom", "node0", "node1", "node2", "full"]);
    const n = plan.beats.length;
    for (const [i, b] of plan.beats.entries()) {
      const sentenceText = sentences[b.index]?.text || sentences[i]?.text || "";
      const ce = checkEntities(b.named_entities, sentenceText);
      for (const why of ce.dropped) console.warn(`::warning::[plan] beat ${b.index}: named entity ${why} — dropped`);
      b.named_entities = ce.kept;
      // What the viewer should see, in the planner's words (owner's spec
      // 2026-10-02). scripts/resolve-scene.cjs reads it with named_entities; a
      // proper name it mentions is used only when the SENTENCE names it too.
      b.scene_description = typeof b.scene_description === "string" && b.scene_description.trim() ? b.scene_description.trim().slice(0, 600) : null;
      if (!b.scene_description) console.warn(`::warning::[plan] beat ${b.index}: no scene_description`);
      // Fields the compact prompt no longer asks for (part A) but older code still reads
      // (visual-director.js applyDirective crashed on a missing visual_headline — CI run
      // 37108869325 ch-1): derived here from what the model did write.
      if (!b.visual_headline) b.visual_headline = b.headline || b.typography_direction?.phrase || "";
      if (!b.reason) b.reason = b.scene_description || "";
      if (!b.emotional_weight) b.emotional_weight = b.motion_tier === "major" ? "sharp" : "calm";
      if (b.carries_forward === undefined) b.carries_forward = null;
      // The word the entity visual pops on (render.js finds its spoken time). Kept only
      // when it is a word OF THE SENTENCE; otherwise the renderer derives it from the entity.
      {
        const aw = String(b.entity_anchor_word || "").trim().replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}]+$/gu, "");
        const words = sentenceText.toLowerCase().split(/[^\p{L}\p{N}$.']+/u).map((w) => w.replace(/^[$]|'s$|[.']+$/g, ""));
        b.entity_anchor_word = aw && words.includes(aw.toLowerCase().replace(/^[$]|'s$/g, "")) ? aw : null;
      }
      // A named object is a concept: the cutout path fetches it (Pixabay, verified).
      const objs = ce.kept.filter((e) => e.type === "object").map((e) => e.name.toLowerCase());
      if (objs.length) b.concepts = [...new Set([...objs, ...(Array.isArray(b.concepts) ? b.concepts : [])])];
      if (!["micro", "medium", "major"].includes(b.motion_tier)) b.motion_tier = "medium";
      b.camera_focus = (Array.isArray(b.camera_focus) ? b.camera_focus : [])
        .map((f) => ({ at_percent: Math.max(0.05, Math.min(0.9, Number(f?.at_percent))), target: String(f?.target || "").toLowerCase() }))
        .filter((f) => Number.isFinite(f.at_percent) && TARGETS.has(f.target)).slice(0, 2);
      if (!b.camera_focus.length) b.camera_focus = null;
      b.persists_from = Number(b.persists_from) === i - 1 && i > 0 ? i - 1 : null;
      b.match_cut_prev = !!b.match_cut_prev && i > 0;
      // Pop family only (visual/kinetic.js); the per-video limits are checked
      // on the final canvases by scripts/anim-plan.js.
      const te = String(b.text_entrance || "").toUpperCase().trim();
      b.text_entrance = ["POP_STANDARD", "POP_SOFT", "POP_EMPHASIS", "POP_HARD", "POP_LETTER", "POP_WORD_STACK"].includes(te) ? te : null;
      checkZones(b);
      // Concepts (visual/concept-visuals.js): only names the sentence names;
      // an ungrounded proposal is dropped, an empty list falls back to the
      // sentence's own concept words.
      const vc = validateConcepts(b.concepts, sentenceText, CUTOUT_SPECS);
      for (const why of vc.dropped) console.warn(`::warning::[plan] beat ${b.index}: concept ${why} — dropped`);
      b.concepts = vc.concepts;
    }
    const lo = n >= 4 ? 2 : 1;
    let majors = plan.beats.map((b, i) => (b.motion_tier === "major" ? i : -1)).filter((i) => i >= 0);
    const keep = new Set([0, n - 1]);
    while (majors.length > 3) {
      const drop = [...majors].reverse().find((i) => !keep.has(i)) ?? majors[majors.length - 1];
      plan.beats[drop].motion_tier = "medium";
      console.log(`[plan] beat ${drop}: motion_tier major -> medium (at most 3 major beats)`);
      majors = majors.filter((i) => i !== drop);
    }
    for (const i of [0, n - 1, Math.floor(n / 2)]) {
      if (majors.length >= lo) break;
      if (i >= 0 && i < n && plan.beats[i].motion_tier !== "major") {
        plan.beats[i].motion_tier = "major"; majors.push(i);
        console.log(`[plan] beat ${i}: motion_tier -> major (a video has ${lo}-3 major beats)`);
      }
    }
    console.log(`[plan] motion tiers: ${plan.beats.map((b) => ({ micro: "·", medium: "m", major: "M" })[b.motion_tier]).join("")} (${majors.length} major); entities: ${plan.beats.reduce((a, b) => a + b.named_entities.length, 0)}; camera focus on ${plan.beats.filter((b) => b.camera_focus).length} beat(s)`);
  }

  const result = {
    generatedAt: new Date().toISOString(),
    channel: channelId,
    // Which provider wrote the plan (render-and-qa.js logs it).
    source: planSource,
    iteration: corrections?.length ? "correction" : "initial",
    totalBeats: plan.beats.length,
    beats: plan.beats,
    composedBeats,
    compositionIssues,
    compilationReport,
    capabilityDistribution: {},
    mechanismDistribution: describeMechanisms(capped.mechanisms),
    compositionsDropped: dropped,
  };

  // Track capability usage instead of mechanism distribution
  for (const b of plan.beats) {
    const caps = b.capabilities || [];
    for (const cap of caps) {
      result.capabilityDistribution[cap] = (result.capabilityDistribution[cap] || 0) + 1;
    }
  }

  writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
  console.log(`Visual plan written: ${outPath}`);
  console.log(`  Beats: ${plan.beats.length}`);
  console.log(`  Capabilities: ${JSON.stringify(result.capabilityDistribution)}`);

  for (const b of plan.beats) {
    const caps = (b.capabilities || []).join(", ");
    console.log(`  [${b.index}] ${caps || "typography"}: "${b.visual_headline}" — ${b.reason}`);
  }
}

// Only as the CLI: importing the module (tests of the gates) runs nothing.
if (process.argv[1] && fileURLToPath(import.meta.url) === (await import("node:path")).resolve(process.argv[1])) main().catch((e) => {
  console.error(`Fatal error: ${e.message}`);
  process.exit(1);
});

// Gemini's structured-JSON output frequently carries a literal control
// character (newline, tab) inside a string value -- valid as text, invalid
// as JSON, where the spec requires \n / \t. A long "reason" or narrative
// field is exactly where the model is prone to this. Walks the text with a
// small string-aware state machine and escapes control characters found
// INSIDE a string literal only; everything outside a string (the
// insignificant whitespace JSON already allows between tokens) is left
// untouched, so this cannot turn valid JSON into something different.
function escapeStrayControlCharsInStrings(text) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = text.charCodeAt(i);
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === "\\") {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = false;
      } else if (code < 0x20) {
        out += code === 0x0a ? "\\n" : code === 0x0d ? "\\r" : code === 0x09 ? "\\t" : `\\u${code.toString(16).padStart(4, "0")}`;
      } else {
        out += ch;
      }
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}

// The second common LLM-JSON defect, distinct from the one above: a comma
// immediately before a closing `]`/`}`, which every major model occasionally
// emits when it lists items and stops without deleting the last separator.
// Strict JSON forbids it ("Unexpected token ']'" is V8's error for exactly
// this). Same string-aware walk as escapeStrayControlCharsInStrings so a
// comma that happens to sit inside a string value (part of real text, not
// JSON structure) is never touched.
function stripTrailingCommasOutsideStrings(text) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "]" || text[j] === "}") continue; // drop this comma
    }
    out += ch;
  }
  return out;
}

// The third defect, seen on CI run 36323786443 (ch-2, both attempts): an
// object key whose OPENING quote is missing -- `graph_justified": true`
// where `"graph_justified": true` was meant ("Expected double-quoted
// property name"). Also covers a key with no quotes at all. Only fires
// outside a string, directly after `{` or `,` (the only places a key can
// start), and only when the bare identifier is followed by `:` -- so a
// value like `true` / `false` / `null` in an array is never touched, and
// valid JSON (where the key already starts with `"`) passes through as-is.
function quoteBareKeysOutsideStrings(text) {
  let out = "";
  let inString = false;
  let escaped = false;
  let lastSignificant = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') { inString = false; lastSignificant = '"'; }
      continue;
    }
    if ((lastSignificant === "{" || lastSignificant === ",") && /[A-Za-z_]/.test(ch)) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)("?)(\s*):/.exec(text.slice(i));
      if (m) {
        out += `"${m[1]}"${m[3]}:`;
        i += m[0].length - 1;
        lastSignificant = ":";
        continue;
      }
    }
    if (ch === '"') inString = true;
    if (!/\s/.test(ch)) lastSignificant = ch;
    out += ch;
  }
  return out;
}

// Accepts the shapes Gemini has actually returned for a plan and maps each
// to {beats:[...]}; anything else is returned untouched so the caller fails.
//
// PART: when the embedded JSON fails to parse, this used to swallow the
// exception and fall through silently, so every parse failure surfaced to
// the caller as the generic "no beats" -- indistinguishable from Gemini
// never having sent JSON at all. Measured on CI run 36011611536: ch-1 and
// ch-2's retry both got real, complete-looking `{"beats": [...` text back
// (10971 and 13447 chars) and were still reported as no-beats. The actual
// parse errors were never logged, so there was nothing to fix.
//
// Now a parse failure retries against a chain of safe, targeted repairs --
// each one fixes a specific, well-known LLM-JSON defect and cannot change
// the meaning of text that was already valid. Run 36016703842 (after the
// first repair shipped) showed the SECOND defect this chain now also
// covers: ch-9's retry got 13480 real chars back and still failed with
// "Unexpected token ']'" -- a trailing comma the control-char pass doesn't
// touch. If every repair fails, the real SyntaxError is attached so
// describeShape can show it instead of an indistinguishable "no beats".
// Run 36405739332 ch-44: both attempts failed every repair with "Expected
// double-quoted property name" (line 39 col 9 of 11k chars) — a property
// name that is not a double-quoted string or a bare word: a // or /* */
// comment, or a 'single-quoted' key. The raw text was never logged, so the
// final failure now reports the text around the parse position.
function stripCommentsOutsideStrings(text) {
  let out = "", inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === "/" && text[i + 1] === "/") { while (i < text.length && text[i] !== "\n") i++; out += "\n"; continue; }
    if (ch === "/" && text[i + 1] === "*") { const end = text.indexOf("*/", i + 2); i = end < 0 ? text.length : end + 1; continue; }
    out += ch;
  }
  return out;
}
// Run 36419295509 ch-48 (now visible thanks to the logged context): a
// literal backslash-n BETWEEN two properties — `"building",\n      "typo…` —
// outside any string. Outside strings, \n \r \t become plain whitespace.
function unescapeStrayEscapesOutsideStrings(text) {
  let out = "", inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === "\\" && "nrt".includes(text[i + 1] || "")) { out += " "; i++; continue; }
    out += ch;
  }
  return out;
}
function quoteSingleQuotedKeysOutsideStrings(text) {
  let out = "", inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === "'") {
      const m = /^'([^'"\\\n]{1,64})'(\s*):/.exec(text.slice(i));
      if (m) { out += `"${m[1]}"${m[2]}:`; i += m[0].length - 1; continue; }
    }
    out += ch;
  }
  return out;
}
const JSON_REPAIRS = [
  (text) => text,
  escapeStrayControlCharsInStrings,
  (text) => stripTrailingCommasOutsideStrings(escapeStrayControlCharsInStrings(text)),
  (text) => quoteBareKeysOutsideStrings(stripTrailingCommasOutsideStrings(escapeStrayControlCharsInStrings(text))),
  (text) => quoteSingleQuotedKeysOutsideStrings(quoteBareKeysOutsideStrings(stripTrailingCommasOutsideStrings(
    escapeStrayControlCharsInStrings(stripCommentsOutsideStrings(unescapeStrayEscapesOutsideStrings(text)))))),
];

function normalizePlanResponse(r) {
  if (!r || r.error) return r;
  if (Array.isArray(r)) return { beats: r };
  if (Array.isArray(r.beats)) return r;
  if (typeof r.content === "string") {
    const m = r.content.match(/[\[{][\s\S]*[\]}]/);
    if (m) {
      let lastError = null, lastText = m[0];
      for (const repair of JSON_REPAIRS) {
        try {
          lastText = repair(m[0]);
          return normalizePlanResponse(JSON.parse(lastText));
        } catch (e) {
          lastError = e;
        }
      }
      const pos = Number((String(lastError?.message || "").match(/position (\d+)/) || [])[1]);
      const near = Number.isFinite(pos) ? ` near ${JSON.stringify(lastText.slice(Math.max(0, pos - 90), pos + 40))}` : "";
      return { ...r, _parseError: `${lastError.message}${near}` };
    }
    return r;
  }
  for (const v of Object.values(r)) {
    if (v && typeof v === "object" && !Array.isArray(v) && Array.isArray(v.beats)) return v;
  }
  return r;
}

function describeShape(r) {
  if (!r) return String(r);
  if (r.error) return "error " + String(r.error).slice(0, 200);
  if (typeof r.content === "string") {
    const parseNote = r._parseError ? ` [JSON parse failed: ${r._parseError}]` : "";
    return `text (${r.content.length} chars)${parseNote} ${JSON.stringify(r.content.slice(0, 120))} ... ends ${JSON.stringify(r.content.slice(-120))}`;
  }
  return (Array.isArray(r) ? "array" : "object keys [" + Object.keys(r).join(",") + "]");
}
