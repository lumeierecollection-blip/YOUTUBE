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
import { callGemini as callGeminiApi } from "../src/lib/gemini-client.js";
import { forcedOllama, callOllamaOnly, callLLM, isProviderError } from "../src/lib/llm.js";
import { createRequire as createRequireGroq } from "node:module";
const { callGroq } = createRequireGroq(import.meta.url)("./groq-client.cjs");
import { LIBRARY_NAMES } from "../src/skills/remotion-render/visual/library-names.js";
import { resolveRegion } from "../src/skills/remotion-render/visual/geo-regions.js";

const { enforceCaps, describe: describeMechanisms, TYPOGRAPHY } = createRequire(import.meta.url)("./plan-caps.cjs");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
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
// real region; a cutout must name one object. Anything else becomes TYPE.
export const VISUAL_TYPES = ["PHOTO", "CUTOUT", "COUNTER", "BAR", "PIE", "LINE", "GAUGE", "MAP", "PROCESS", "TYPE"];
const TYPE_CAPABILITY = { PHOTO: "revelation", CUTOUT: "revelation", COUNTER: "evidence", BAR: "comparison", PIE: "population", LINE: "growth", GAUGE: "accumulation", MAP: "contrast", PROCESS: "causation" };

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
export function checkEntities(list, sentence) {
  const kept = [], dropped = [];
  for (const e of Array.isArray(list) ? list : []) {
    const type = String(e?.type || "").toLowerCase();
    const name = String(e?.name || "").trim();
    if (!name || !["person", "place", "organization"].includes(type)) { dropped.push(`${type || "?"} "${name}": no type/name`); continue; }
    if (!entityNamedInSentence(name, sentence)) { dropped.push(`${type} "${name}": not named in the sentence`); continue; }
    if (!kept.some((k) => k.name.toLowerCase() === name.toLowerCase())) kept.push({ type, name });
  }
  return { kept, dropped };
}
function sentenceNumbers(text) {
  return new Set((String(text || "").match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => Number(n.replace(/,/g, ""))));
}
// What a beat's sentence can ground, for the gate-repair prompt: its
// numbers (years and counts under 2 are not counter values), whether it
// states a percentage, and any known place (resolveRegion, 1-3 word spans).
export function groundedOptions(sentence) {
  const text = String(sentence || "");
  const nums = [...sentenceNumbers(text)];
  const counts = nums.filter((n) => n >= 2 && !(Number.isInteger(n) && n >= 1000 && n <= 2099));
  const pct = (text.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:%|percent\b)/gi) || []).map((m) => Number(m.replace(/[^\d.]/g, ""))).filter((n) => n > 0 && n <= 100);
  const words = text.split(/[^A-Za-z.'-]+/).filter(Boolean);
  const places = new Set();
  for (let i = 0; i < words.length; i++) for (let k = 3; k >= 1; k--) {
    const span = words.slice(i, i + k).join(" ").replace(/[.]$/, "");
    if (k <= words.length - i && /^[A-Z]/.test(span) && resolveRegion(span)) places.add(span);
  }
  const allowed = ["TYPE", "CUTOUT"];
  if (counts.length) allowed.push("COUNTER");
  if (pct.length) allowed.push("PIE", "GAUGE");
  if (nums.length >= 2) allowed.push("BAR", "LINE");
  if (places.size) allowed.push("MAP");
  allowed.push("PROCESS");
  const proper = text.split(/\s+/).slice(1).some((w) => /^[A-Z][a-z]+/.test(w.replace(/^[^A-Za-z]+/, "")));
  if (proper) allowed.push("PHOTO");
  return { counts, percents: pct, places: [...places], allowed };
}

function numIn(v, nums) {
  const m = String(v ?? "").match(/\d[\d,]*(?:\.\d+)?/);
  return m ? nums.has(Number(m[0].replace(/,/g, ""))) : false;
}
// ── CUTOUT must name an object the sentence names ────────────────────
// Owner's rule: a cutout shows the literal object the sentence is about —
// not its topic, not a metaphor. Run 36397373831 ch-44 drew a camera for
// "strategic advantage", bills for "the foundation", a gavel for
// "negotiation tactics". The gate: after dropping a container phrase
// ("stack of") and anything from the first preposition on ("signature ON
// contract paper"), the object's head noun must appear in the sentence — or
// the word just before it (a compound: "dollar bills" for "$2 billion"),
// unless that word is a proper name ("Miami skyline" for "... in the Miami
// office" is rejected: the skyline is not in the sentence). Words match on
// a crude stem: signature/signed -> sign, bills -> bill, a shared prefix of
// 5+ letters (robot/robotic). "$" reads as "dollar".
// Where this stops: it proves the object's NAME is in the sentence, not that
// the thing is photographable ("background check" passes it — the prompt,
// the fetch, rembg and the beat check catch that), and it rejects inferred
// objects the sentence does not name ("fingerprint card" for "do a
// background check").
const CUTOUT_CONTAINERS = new Set(["stack", "pile", "piece", "pieces", "pair", "set", "group", "bunch", "bundle", "roll", "sheet", "box", "handful", "row", "stacks", "piles"]);
const CUTOUT_PREPOSITIONS = new Set(["on", "in", "with", "at", "from", "by", "for", "of", "under", "over", "near", "beside", "against", "inside", "into", "onto", "showing"]);
const CUTOUT_FILLER = new Set(["a", "an", "the", "single", "small", "large", "big", "old", "new", "close", "closeup", "up", "view", "photo", "isolated", "white", "background", "object", "item", "thing", "and"]);
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
export function cutoutNamedInSentence(object, sentence) {
  const raw = String(sentence || "").replace(/\$/g, " dollar ");
  const toks = raw.split(/[^A-Za-z0-9']+/).filter(Boolean);
  const sent = toks.map((t, i) => ({ stem: stemWord(t), proper: i > 0 && /^[A-Z]/.test(t) && !/^[A-Z]+$/.test(t) }));
  let words = String(object || "").split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9'-]/g, "")).filter(Boolean);
  if (words.length > 2 && CUTOUT_CONTAINERS.has(words[0].toLowerCase()) && words[1].toLowerCase() === "of") words = words.slice(2);
  const cut = words.findIndex((w) => CUTOUT_PREPOSITIONS.has(w.toLowerCase()));
  const np = (cut >= 0 ? words.slice(0, cut) : words).filter((w) => !CUTOUT_FILLER.has(w.toLowerCase()));
  if (!np.length) return { ok: false, why: `CUTOUT "${object}" names no object` };
  const head = stemWord(np[np.length - 1]), mod = np.length > 1 ? stemWord(np[np.length - 2]) : null;
  if (sent.some((t) => stemMatch(head, t.stem))) return { ok: true, matched: np[np.length - 1] };
  if (mod && sent.some((t) => !t.proper && stemMatch(mod, t.stem))) return { ok: true, matched: np[np.length - 2] };
  return { ok: false, why: `CUTOUT "${object}" is not named in the sentence (a cutout shows the literal object the sentence names)` };
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
    if (!["person", "place", "organization"].includes(type)) return bad(`PHOTO entity "${ent}" has no type (person / place / organization) in named_entities`);
    return { type: t, data: { entity: ent, entity_type: type } };
  }
  if (t === "PROCESS") {
    const nodes = (Array.isArray(d.nodes) ? d.nodes : []).map((n) => String(n?.label ?? n ?? "").trim()).filter(Boolean).slice(0, 3);
    if (nodes.length < 2) return bad("PROCESS needs 2-3 nodes");
    const off = nodes.find((n) => n.split(/\s+/).length > 3 || !leadInFromSentence(n, sentence));
    if (off) return bad(`PROCESS node "${off}" is not 1-3 words from the sentence`);
    return { type: t, data: { nodes } };
  }
  if (t === "CUTOUT") {
    // A cutout is a photographed physical object: "scale of justice icon",
    // "padlock icon", "document cutout" (run 36388470508) searched for the
    // word "icon"/"cutout", and the fetcher rejects icons by design.
    const obj = String(d.object || b.cutout_query || "")
      .replace(/\b(icons?|symbols?|illustrations?|graphics?|cutouts?|clip ?art|vectors?|logos?|emojis?|pictograms?|drawings?|isolated|white background|png)\b/gi, " ")
      .replace(/\s+/g, " ").trim();
    if (!obj) return bad("CUTOUT without an object");
    const named = cutoutNamedInSentence(obj, sentence);
    return named.ok ? { type: t, data: { object: obj } } : bad(named.why);
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
    const vs = String(d.value), m = vs.match(/\d[\d,]*(?:\.\d+)?/);
    const n = m ? Number(m[0].replace(/,/g, "")) : NaN;
    const scaled = m ? /^\s*(thousand|million|billion|trillion|bn|mn|k|m|b)\b/i.test(vs.slice(m.index + m[0].length)) : false;
    if (n < 2 && !scaled && !vs.includes("%")) return bad(`COUNTER value "${d.value}" is a count of ${n}: a 0 -> ${n} roll shows no figure`);
    // A year is a date, not a quantity: rolling 0 -> 1938 showed "1009" and
    // "366" mid-roll and the review called them wrong figures (run
    // 36419295509 ch-2: FLSA 1938, OSHA 1970, ADA 1990). The headline keeps
    // the year.
    if (/^\s*(1[0-9]{3}|20[0-9]{2})s?\s*$/.test(vs)) return bad(`COUNTER value "${d.value}" is a year: a date, not a count to roll up`);
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
function buildPlanPrompt(sentences, corrections, channelId) {
  // Same formula as plan-caps.cjs capLimits(): TYPOGRAPHY <= min(2, floor(0.4n)).
  const typoMax = Math.min(2, Math.max(1, Math.floor(sentences.length * 0.4)));
  const niche = NICHE_DRAWINGS[String(channelId ?? "").replace(/^ch-?0*/i, "")];
  const nicheBlock = niche
    ? `- DRAWINGS OFTEN USEFUL ON THIS CHANNEL (from the LIBRARY). Each is ONLY
  correct when the sentence's subject IS that object — this list is not a
  menu of props for the topic: ${niche.map((n) => `"${n}"`).join(", ")}.`
    : "";
  const sentenceList = sentences.map((s, i) =>
    `[${i}] (${s.start.toFixed(1)}s-${s.end.toFixed(1)}s) "${s.text}"`
  ).join("\n");

  let correctionBlock = "";
  if (corrections?.length) {
    correctionBlock = `\n\nPREVIOUS REVIEW CORRECTIONS — apply these fixes:\n` +
      corrections.map((c) => `  ${c.scene || c.beat}: ${c.problem} → Fix: ${c.fix || c.action}`).join("\n") +
      `\n\nAdjust your plan to address every correction above.\n`;
  }

  const CAPABILITIES = compactCapabilityDigest();

  return `You are the VISUAL DIRECTOR for a YouTube Shorts video (vertical 1080x1920, ~60s).

THE FUNDAMENTAL RULE: Never visualize a sentence. Visualize what the sentence is DOING.
The video is not a collection of scenes — it is one continuous visual argument.

For each sentence, answer these questions BEFORE choosing visual events:
- What is the IMPORTANT OBJECT in this sentence?
- What ACTION happens to it?
- What CHANGES?
- What should the viewer UNDERSTAND without audio?
- What can be SHOWN instead of told?
- What should REMAIN from the previous beat?

VISUAL HEADLINE RULES:
- The on-screen text is NOT the transcript. It is ONE SHORT VISUAL THOUGHT (max 5-6 words).
- Typography should behave like a designed object, not a document.
- Numbers must have physical meaning — don't just float "22.4 WEEKS" alone.
- Example: Transcript "Only forty-seven percent of Americans can handle a four-hundred-dollar emergency" → Visual headline: "47% CAN'T COVER $400"

## VISUAL CAPABILITIES — what you compose from

Instead of picking a mechanism, you describe VISUAL EVENTS. The system maps your events to buildable primitives.

${CAPABILITIES}

## THE STYLE — full-canvas editorial motion graphics (NO paper, NO cards)

Every beat is designed for the WHOLE 1080x1920 frame on an off-white
studio ground (soft shadows). There is no container, no card, no page:
the composition IS the frame, and it transforms from beat to beat
(Bloomberg / NYT / Vox / Johnny Harris). Clean, minimal, editorial. Each
beat is ONE of four compositions — the system draws it from your fields:

  TYPE-FULL     the statement fills the frame (huge, stacked), or ONE
                number at 300-500 px with a small label (visual_type TYPE
                or COUNTER). Hooks, emphasis, turns, the close.
  DATA-FULL     the chart IS the composition: bars ~60% of the frame
                height, a donut across the frame, a line across the full
                width, a gauge as a half circle across the frame, a map
                (visual_type BAR / PIE / LINE / GAUGE / MAP).
  SCENE-FULL    a REAL photograph fills the frame, headline over it
                (visual_type PHOTO — a named person, place or organization;
                or CUTOUT — one physical object, large on the studio).
  PROCESS-FULL  2-3 labelled nodes with thick arrows drawing between them
                (visual_type PROCESS) — cause, effect, sequence, flow.

Transitions between beats, the word caption at the bottom, grain and the
camera are added by the system.

## HOW TO WRITE A BEAT

  "kind": "EDITORIAL" | "TYPE"
  "canvas_composition": "TYPE-FULL" | "DATA-FULL" | "SCENE-FULL" | "PROCESS-FULL"
                  (it must agree with visual_type as listed above; the
                  system derives it from the CHECKED visual_type)
  "lead_in":      2-4 words FROM THIS BEAT'S OWN SENTENCE, lowercase, shown
                  small above the headline. Or null. (Enforced: a lead-in
                  whose words are not in its sentence is dropped.)
  "headline":     2-6 words, NEVER a full sentence. Its words come from the
                  sentence, and it says only what the sentence says: never
                  add a claim, promise or judgement it does not make
                  ("GUARANTEED", "BEST", "FAILS") — a checker rejects that.
  "emphasis_word": one word of the headline, or null
  "visual_type":  ONE of PHOTO | CUTOUT | COUNTER | BAR | PIE | LINE | GAUGE | MAP | PROCESS | TYPE
  "data":         by type (numbers EXACTLY as the sentence says them — a
                  number the sentence does not say is rejected and the beat
                  becomes TYPE):
    PHOTO    {"entity": "David Einhorn"}  a person, place or organization
             the sentence NAMES, exactly as it appears in "named_entities".
             The system fetches a real, verified photo of THAT entity; if
             none exists the beat is drawn as TYPE — never a stand-in.
    CUTOUT   {"object": "drink can"}   ONE physical object THE SENTENCE
             NAMES — see "CUTOUT RULE" below.
    COUNTER  {"value": "1.4 billion", "label": "brand value"}
    BAR      {"bars": [{"label": "2019", "value": "3 million"}, {"label": "2024", "value": "1.4 billion"}]}
    PIE      {"percent": 25, "label": "of global oil"}
    LINE     {"points": [{"label": "2019", "value": "3 million"}, {"label": "2024", "value": "1.4 billion"}]}
    GAUGE    {"percent": 88, "label": "feel financial stress"}
    MAP      {"place": "Iran"}   a country or US state named in the sentence
    PROCESS  {"nodes": ["higher rates", "rent", "savings"]}  2-3 nodes of
             1-3 words each, every word FROM THE SENTENCE, in the order the
             sentence gives the cause -> effect / sequence.
    TYPE     {} — full-frame typography only
  "named_entities": every person, place and organization the sentence
                  NAMES, as written in it, with its FULL name ("Tesla, Inc."
                  not "Tesla", "Federal Reserve" not "the Fed" when the
                  sentence says "Federal Reserve"):
                  [{"type": "person"|"place"|"organization", "name": "..."}]
                  — [] when it names none. Never an entity it does not name.
  "motion_tier":  "micro" | "medium" | "major". Most beats "medium". EXACTLY
                  2 or 3 beats in the video are "major": the hook (beat 0),
                  the pivot (the turn in the argument), and/or the close.
                  "micro" for a quiet beat that should hold still.
  "camera_focus": optional, 1-2 events moving the camera THROUGH the
                  information: [{"at_percent": 0.4, "target": "number"},
                  {"at_percent": 0.75, "target": "full"}]. targets: number,
                  chart, headline, photo, left, right, top, bottom, node0,
                  node1, node2, full. Omit for a single slow push.
  "persists_from": the index of the PREVIOUS beat when this beat continues
                  its element (the same number, chart or photo carried on
                  and transformed), else null.
  "match_cut_prev": true when this beat shares its subject or number with
                  the previous beat and that element should stay fixed in
                  place across the cut, else false.

Worked example. Sentence: "Liquid Death went from three million dollars to
a 1.4 billion dollar brand."
  { "kind": "EDITORIAL", "canvas_composition": "DATA-FULL", "visual_type": "BAR",
    "lead_in": "went from", "headline": "billion dollar brand", "emphasis_word": "billion",
    "data": {"bars": [{"label": "before", "value": "three million"}, {"label": "now", "value": "1.4 billion"}]},
    "named_entities": [{"type": "organization", "name": "Liquid Death"}],
    "motion_tier": "medium", "camera_focus": [{"at_percent": 0.5, "target": "chart"}],
    "persists_from": null, "match_cut_prev": false }

PHOTO RULE (enforced in code): "entity" must be one of this beat's
named_entities, and its name must appear in the sentence. Use PHOTO when
the sentence is ABOUT a named person, place or organization (what they
did, where it happened) — the viewer should SEE them. At least one beat
should be a PHOTO when the script names anyone or anywhere. A number in
the same sentence may still be better as COUNTER/BAR: choose what the
sentence is about.

CUTOUT RULE (enforced in code: an object the sentence does not name turns
the beat into TYPE).
If the beat's visual type is CUTOUT, "object" (the cutout query) must name
an object that appears literally in the sentence. Not the topic of the
sentence. Not an idea related to the sentence. The thing itself.
  Sentence: "Before signing, do a background check."
    "background check"           -> REJECT. It's an idea.
    "magnifying glass document"  -> REJECT. It's a metaphor.
  Sentence: "The company spent $2 billion on the deal."  -> COUNTER first;
    "stack of hundred dollar bills"  -> would be a valid cutout.
  Sentence: "Robotic arms now weld 40% of the frames."  -> GAUGE or COUNTER
  first; "robotic arm" would be a valid cutout.
The object must be ONE object, never a person (use PHOTO for a named
person), a screen, a chart, an icon or a drawing, and never something too
large to isolate: a building, factory, room, street or landscape.

PROCESS RULE (enforced in code): every node's words are in the sentence,
and the sentence really describes a cause -> effect, a sequence or a flow
("higher rates raise rent, and rent cuts savings"). Not for a list.

Rules that are enforced, not advisory:
- Choose the visual type that most directly shows what the sentence is
  about: a number -> COUNTER, BAR, PIE, LINE or GAUGE; a named person,
  place or organization -> PHOTO (or MAP for a country / US state); a
  physical object -> CUTOUT; a cause/effect or sequence -> PROCESS; an
  abstract claim with none of these -> TYPE.
- BAR/LINE need two or more numbers the sentence says; PIE/GAUGE need a
  percentage it says. Otherwise COUNTER (one number) or TYPE.
- VARY the compositions: never the same composition three beats in a row.
- The "kind" TYPE, the kinetic hook/closer, is limited to ${typoMax >= 2 ? `beat 0 and beat ${sentences.length - 1}` : "beat 0"}; the system
  turns any other TYPE beat into a typography-only EDITORIAL beat.
- For a TYPE beat set "capabilities": ["typographic_emphasis"] and fill
  "typography_direction" with the headline as its phrase.

NARRATIVE TYPOGRAPHY — READ THIS BEFORE WRITING ANY TYPOGRAPHY BEAT.

Typography is NARRATIVE EMPHASIS, NOT HEADLINE DESIGN. The narrator explains,
the visual demonstrates, the typography EMPHASISES — the three layers must not
repeat each other. A typography beat should make the viewer think "what is the
narrator saying? — oh, I see what the visual is showing me."

It must NEVER look like: a news headline, an article title, a presentation
slide, a title card, a lower third, a subtitle/caption track, a paragraph, a
thumbnail, or a section heading.

HARD RULES (a plan that breaks these is rejected before rendering):
- ONE LINE. Never two lines, never a headline + subheadline, never stacked
  text, never a title + supporting sentence. If the phrase will not fit on one
  line, WRITE A SHORTER PHRASE — do not expect the renderer to shrink it.
- 2-7 WORDS. 8-9 is unusual. More than ${TYPO_HARD_MAX_WORDS} words is narration, not emphasis.
- ONE THOUGHT, centred in the frame.
- NEVER the narration verbatim, and never a near-restatement of it. Typography
  is not a transcript and not subtitles.
- NO generic headline/topic labels: "The Problem", "The Solution", "The Hidden
  Cost", "Why This Happens", "The Psychology Behind It", "Financial Mistakes",
  "Consumer Behavior" — these are prohibited unless the phrase genuinely
  functions as spoken narrative emphasis.
- The phrase animates as ONE object. Do not ask for word-by-word/karaoke reveal.

GOOD (narrative emphasis):   "Why does this keep happening?" · "You barely
notice it." · "One purchase at a time." · "Do I need it?" · "$34 MILLION" ·
"Need it — or want it?"
BAD (headline/subtitle):     "The Hidden Psychological Cost Of Modern Consumer
Behavior" · "THE SHOCKING TRUTH ABOUT WHY PEOPLE KEEP SPENDING" · "Most people
don't realize how much money they're losing every month"

TYPOGRAPHY IS SELECTIVE, NOT THE DEFAULT. The rhythm is:
HOOK (one centred line) -> VISUAL STORYTELLING (no text) -> RE-HOOK (one line
at a real turn in the narration) -> VISUAL CONSEQUENCE -> maybe a KEY FACT
("$34 MILLION") -> back to visual storytelling.
Do NOT put typography in every beat. TEXT -> TEXT -> TEXT -> TEXT is a failure.

ANTI-LAZINESS: typography is NOT the fallback for a beat you did not look
for a drawing for — search the LIBRARY for the sentence's subject first. But
when no drawing depicts the subject, TYPOGRAPHY is the right answer and an
unrelated drawing is the wrong one.

THE GRAPH / NUMBER RULE (this is what makes videos feel generic — obey it):
- A number appearing in a sentence is NOT a reason to reach for evidence. Ask
  what the number MEANS and show that: "$1,400 drained per year" is money leaving a
  wallet (depletion), "gas up 24.6%" is a pump price climbing (growth),
  "50% vs 66%" is two things of different size (comparison).
- Reach for a chart/bar/figure ONLY when the sentence is genuinely ABOUT quantitative
  comparison, trend, or measurement AND no physical/spatial form communicates it better.
- If removing the narration would leave only a floating number or a headline, the visual
  is decorative — pick an object-first event instead.

THE MUTED TEST: for every beat, if the viewer had no audio, would the visual still carry
real information — an object, a change, a comparison, a consequence? If it would look
identical under almost any other sentence, it is monoculture. Reject it and re-choose.

DISTRIBUTION RULES (a plan that violates these will be rejected downstream):
- Across the whole video, AT MOST ~1 in 3 beats may be TEXT-FORWARD (typographic_emphasis
  + evidence combined). The majority MUST be object-first visual events.
- typographic_emphasis is for the opening hook and the closing CTA — typically 2 beats total,
  rarely more. Do not use it for ordinary statements; find what the statement SHOWS.
- NEVER repeat the same visual event more than twice in a row, and do not alternate
  headline/figure/headline/figure — that reads as one template on repeat.
- Use AT LEAST 5 distinct visual events across the video, drawn mostly from the object-first
  family. Consecutive beats should differ in VISUAL FORM, not just in event name.
- The first beat MUST be a strong hook; the last beat a clear CTA or payoff.
- Use carries_forward when an object continues (a sum shown, then consumed) so the visual
  argument flows rather than resetting each beat.

YOU ARE A DIRECTOR, NOT A TEMPLATE PICKER. For every beat you must write real
direction — describe the visual EVENT, not "which template". The "direction"
block below is the AUTHORITATIVE intent: after the video renders, you will be
shown the actual frames and asked whether they executed exactly this direction,
so make it specific and answerable. Lazy direction ("show a graph of the
numbers", "display the text") is structurally invalid — fill every field
concretely:
- subject: what the composition primitives LITERALLY show on screen (e.g. "A gauge
  showing 3.4%", "Two bars labelled Annual and Core", "A stack of 3 blocks") —
  NOT a real-world scene description. The renderer draws abstract shapes, not
  photographs.
- environment: where this lives (dim archival desk; clean data void; a kitchen counter).
- action_start / action_end: the visual STATE at the beat's start and at its end —
  what physically changes across the ~4s (one claim form -> a towering stack).
- camera: what the camera does (hold; slow push-in on the total; track back as the
  stack grows; orbit).
- motion: how things move and with what weight (claims land faster and heavier;
  a number ticks up then slams; a bar cracks and shards fall).
- typography: the ONLY text on screen and where (e.g. "$34 MILLION", upper third) —
  never the sentence.
- sound: the semantic accent this beat wants (paper impacts; a lock snap; silence).
- consequence: what the viewer should FEEL/understand from the visual event.
- muted_read: what a viewer with NO audio would understand from this beat alone.
- why_visual: why THIS visual represents THIS narration and could not be swapped
  onto any other sentence.
- graph_justified: true ONLY if the beat is genuinely about quantitative
  comparison/trend/measurement AND no physical form communicates it better;
  otherwise false. If false, you may not choose evidence as a bar/graph.

DO NOT pick a familiar event merely because it is easy to render. Direct the
strongest visual event first; capabilities are only the closest EXECUTION mapping for
the renderer, and the post-render review will check whether the render actually
delivered your directed event.

CRITICAL: The direction.subject MUST describe what the composition will
literally show on screen — NOT a real-world scene that cannot be rendered.
If the composition is {kind: "library_shape", name: "phone showing a budgeting
app", label: "Monarch Money"}, direction.subject is "A phone showing a budgeting
app labelled Monarch Money" — NOT "a person happily managing money at home".
The renderer draws the LIBRARY drawing, not photographs; the review compares
direction.subject against what actually renders.

FOR EVERY BEAT THAT PUTS TEXT ON SCREEN (typographic_emphasis capability, or any beat whose
direction.typography is not "none") you MUST fill "typography_direction":
  phrase              the EXACT short phrase, one line, 2-7 words
  why                 why this phrase matters to the narration
  moment              one of: ${TYPO_MOMENTS.join(" | ")}
  single_line         must be true
  not_a_headline      must be true — confirm it is narrative emphasis, not a title/label
  not_a_transcript    must be true — confirm it is not the narration restated
  relation_to_visual  how the phrase relates to (and does NOT merely describe) the visual
For beats with NO on-screen text, set "typography_direction": null.

SCRIPT SENTENCES:
${sentenceList}
${correctionBlock}
Respond ONLY with JSON (no markdown fences):
{
  "beats": [
    {
      "index": 0,
      "visual_headline": "<SHORT on-screen text — NOT the transcript, max 5-6 words>",
      "sentence_subject": "<the one concrete person/place/object/app the sentence is about, or null if the sentence names none (then this beat is TYPOGRAPHY)>",
      "reason": "<what the sentence is DOING and why this visual shows it>",
      "emphasis_words": ["<key words to highlight>"],
      "visual_events": [
        {
          "type": "<growth|depletion|comparison|revelation|structure_break|accumulation|population|evidence|contrast|causation>",
          "label": "<optional label for the event>",
          "magnitude": "<optional number/value if applicable>"
        }
      ],
      "capabilities": ["<list of capabilities used: growth, depletion, comparison, etc.>"],
      "objects": {
        "label_a": "<for contrast: before label>",
        "label_b": "<for contrast: after label>",
        "figure": "<for evidence: the number>",
        "cause": "<for causation: cause label>",
        "effect": "<for causation: effect label>"
      },
      "kind": "<EDITORIAL | TYPE>",
      "lead_in": "<2-4 words from this beat's own sentence, lowercase, or null>",
      "headline": "<2-4 words, never a full sentence>",
      "emphasis_word": "<one headline word, or null>",
      "canvas_composition": "<TYPE-FULL | DATA-FULL | SCENE-FULL | PROCESS-FULL>",
      "visual_type": "<PHOTO | CUTOUT | COUNTER | BAR | PIE | LINE | GAUGE | MAP | PROCESS | TYPE>",
      "data": { "<fields for the visual_type, see above>": "..." },
      "named_entities": [{ "type": "<person | place | organization>", "name": "<as named in the sentence>" }],
      "motion_tier": "<micro | medium | major>",
      "camera_focus": [{ "at_percent": 0.4, "target": "<number | chart | headline | photo | left | right | top | bottom | node0 | node1 | node2 | full>" }],
      "persists_from": null,
      "match_cut_prev": false,
      "carries_forward": "<object/concept that persists into the next beat, or null>",
      "emotional_weight": "<calm|building|sharp|heavy|urgent>",
      "typography_direction": {
        "phrase": "<exact one-line phrase, 2-7 words — or omit this whole object if the beat has no text>",
        "why": "<why this phrase matters to the narration>",
        "moment": "<hook|re_hook|key_fact|contradiction|question|statement>",
        "single_line": true,
        "not_a_headline": true,
        "not_a_transcript": true,
        "relation_to_visual": "<how it relates to the visual scene without describing it>"
      },
      "direction": {
        "narrative_purpose": "<what this beat must accomplish in the argument>",
        "subject": "<LITERALLY what the composition primitives show — not a real-world scene>",
        "environment": "<where it lives>",
        "action_start": "<visual state at beat start>",
        "action_end": "<visual state at beat end>",
        "camera": "<hold|push_in|pull_back|track|orbit|tilt — what it does>",
        "motion": "<how things move and with what weight>",
        "typography": "<the only on-screen text and its position, or 'none'>",
        "sound": "<semantic sound accent, or 'silence'>",
        "consequence": "<what the viewer should feel/understand>",
        "muted_read": "<what a viewer with no audio understands from this beat>",
        "why_visual": "<why this visual is specific to THIS narration>",
        "graph_justified": false
      }
    }
  ]
}`;
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
  const strictPrompt = prompt + "\n\nReturn ONLY one JSON object whose top-level key is \"beats\" (an array with exactly " + sentences.length + " entries, one per sentence, in order). No prose, no markdown fences, no other top-level keys.";
  const okBeats = (r) => Array.isArray(r?.beats) && r.beats.length === sentences.length;
  let geminiResult = null, geminiFailure = null, planSource = "gemini";
  if (forced) {
    console.error("[planner] ollama (FORCE_PLANNER=ollama — Gemini not called)");
  } else {
    geminiResult = normalizePlanResponse(await callGeminiApi([{ role: "user", content: prompt }], { maxTokens, temperature: 0.2, tag: "planner" }));
    if (geminiResult?.source === "gemini" && geminiResult.error) {
      geminiFailure = geminiResult.error;
    } else if (!okBeats(geminiResult)) {
      // CI runs showed Gemini intermittently answering without a top-level
      // "beats" key, or with a beat count that shifts every beat onto the
      // wrong line (run 36362576442 ch-26). One strict, uncached retry.
      console.error(`Gemini plan attempt 1 ${geminiResult?.beats ? `has ${geminiResult.beats.length} beats for ${sentences.length} sentences` : `had no 'beats' — got: ${describeShape(geminiResult)}`}. Retrying once uncached.`);
      geminiResult = normalizePlanResponse(await callGeminiApi([{ role: "user", content: strictPrompt }], { maxTokens, temperature: 0.2, noCache: true, tag: "planner" }));
      if (geminiResult?.source === "gemini" && geminiResult.error) geminiFailure = geminiResult.error;
      else if (!okBeats(geminiResult)) geminiFailure = geminiResult?.beats ? `beat count ${geminiResult.beats.length} != ${sentences.length}` : "no_beats";
    }
  }
  // Second tier: Groq ($GROQ_TEXT_MODEL, default openai/gpt-oss-120b), the same strict prompt.
  if (!forced && geminiFailure) {
    console.error(`[planner] gemini: ${geminiFailure} → groq${geminiResult?.detail ? ` (${String(geminiResult.detail).slice(0, 120)})` : ""}`);
    const t0 = Date.now();
    const g = normalizePlanResponse(await callGroq([{ role: "user", content: strictPrompt }], { maxTokens, temperature: 0.2 }));
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
    if (okBeats(geminiResult)) console.log(`[planner] plan from ollama (${process.env.OLLAMA_TEXT_MODEL || "qwen2.5:7b"}, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    else console.error(`[planner] ollama gave no usable plan: ${describeShape(geminiResult)} — no further fallback`);
  }

  if (geminiResult?.beats && geminiResult.beats.length !== sentences.length) {
    console.error(`Visual plan failed: ${geminiResult.beats.length} beats for ${sentences.length} sentences after the retry — not padding or trimming it`);
    process.exit(1);
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
  if (planSource !== "ollama" && !forcedOllama()) {
    const rejected = [];
    for (const b of plan.beats) {
      if (b.visual_type === undefined) continue;
      const sentenceText = sentences[b.index]?.text || sentences[plan.beats.indexOf(b)]?.text || "";
      const v = checkVisual(b, sentenceText);
      if (v.why) rejected.push({ b, sentenceText, why: v.why, asked: String(b.visual_type).toUpperCase(), opts: groundedOptions(sentenceText) });
    }
    const worth = rejected;
    if (worth.length) {
      const lines = worth.map((r) => `Beat ${r.b.index}. Sentence: "${r.sentenceText}"
  Rejected: ${r.asked} — ${r.why}
  Numbers you may use: ${r.opts.counts.join(", ") || "none"} | Percentages: ${r.opts.percents.join(", ") || "none"} | Known places: ${r.opts.places.join(", ") || "none"}
  Allowed visual_type: ${r.opts.allowed.join(", ")}`).join("\n\n");
      const repairPrompt = `A code check rejected the visuals below. Replace each one with a visual_type and data that PASS the check, using ONLY what the sentence itself says.

The check (it runs on your answer):
- CUTOUT {"object": "..."}: ONE physical object whose words appear literally in the sentence. Copy the words. A topic, an idea, a company or a person is not an object. If the sentence names no physical object, do not use CUTOUT.
- COUNTER {"value": "...", "label": "..."}: value is one of "Numbers you may use", written as in the sentence.
- PIE / GAUGE {"percent": n, "label": "..."}: n is one of the listed percentages.
- BAR {"bars": [{"label","value"}]} / LINE {"points": [{"label","value"}]}: every value is a number in the sentence; LINE needs 2+.
- MAP {"place": "..."}: one of the listed known places.
- PHOTO {"entity": "..."}: a person, place or organization the sentence NAMES, written as in the sentence; add it to "named_entities" too.
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
        const v = checkVisual(cand, r.sentenceText);
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

  const planRuleIssues = [];
  // ── BUILD EACH BEAT'S COMPOSITION FROM ITS FIELDS (real-asset pipeline) ──
  // The model no longer composes. A VISUAL beat is { concept, asset_query,
  // fallback_drawing, caption, number }; its composition is built here as
  // the fallback drawing (+ a counter for a named number). The asset
  // resolver in render-and-qa.js replaces the drawing with a real photo when
  // the concept resolves. A composition the model wrote anyway is ignored.
  // A TYPE beat gets no composition and the typographic_emphasis capability.
  let lastPercentType = null;
  for (const b of plan.beats) {
    // visual_type (planner's choice), checked against the sentence.
    if (b.visual_type !== undefined) {
      const sentenceText = sentences[b.index]?.text || sentences[plan.beats.indexOf(b)]?.text || "";
      const v = checkVisual(b, sentenceText);
      if (v.why) console.warn(`::warning::[plan] beat ${b.index}: ${b.visual_type} -> TYPE (${v.why})`);
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
      b.cutout_query = v.type === "CUTOUT" ? v.data.object : null;
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
      if (!["micro", "medium", "major"].includes(b.motion_tier)) b.motion_tier = "medium";
      b.camera_focus = (Array.isArray(b.camera_focus) ? b.camera_focus : [])
        .map((f) => ({ at_percent: Math.max(0.05, Math.min(0.9, Number(f?.at_percent))), target: String(f?.target || "").toLowerCase() }))
        .filter((f) => Number.isFinite(f.at_percent) && TARGETS.has(f.target)).slice(0, 2);
      if (!b.camera_focus.length) b.camera_focus = null;
      b.persists_from = Number(b.persists_from) === i - 1 && i > 0 ? i - 1 : null;
      b.match_cut_prev = !!b.match_cut_prev && i > 0;
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

main().catch((e) => {
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
