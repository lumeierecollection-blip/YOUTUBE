#!/usr/bin/env node
/**
 * Script specificity validator (owner's spec 2026-10-03, tasks 2.3 and 4).
 *
 *   node scripts/validate-script.cjs <channel> <script.json> [research.json]
 *     exit 0 = PASS, 2 = FAIL (the workflow re-asks once, then continues —
 *     this check never blocks a run). Lines starting "  - " are the feedback
 *     the script stage appends to the re-ask prompt.
 *
 * A sentence passes when it names something real and specific. Its score is the
 * number of distinct specifics it contains, capped at 3:
 *   - a proper name (a run of capitalized words: "Jerome Powell", "United States
 *     Supreme Court"; a sentence's first word counts only when it is part of a
 *     run, is capitalized elsewhere in the script, or is a research entity),
 *   - a number (digits, a spelled number, a currency amount, a percentage, a date),
 *   - a physical object from CONCRETE ("a gavel", "a $100 bill", "a warehouse").
 * FAIL when any sentence scores 0, the average is under 1.5, or a banned phrase
 * appears (task 2.3); or when concrete nouns are under 2x the abstract nouns
 * (task 4: "Engel represents a significant trend in the industry" names a
 * company and is still abstract).
 *
 * Where its guarantees stop: this is lexical, not semantic. A capitalized common
 * word mid-sentence ("the Hook") reads as a name, a concrete object outside
 * CONCRETE reads as nothing, and a sentence can name a real entity and still be
 * vague. It catches "Experts say this trend is significant" — the failure the
 * reviewer flagged — not every weak sentence. It never checks that a name is
 * TRUE; gate-script.js (SCR-14) and the research artifact own grounding.
 */
const { readFileSync } = require("node:fs");

// Task 2.2's banned list, plus the hook scripter's reveal bridges and sincerity
// openers (docs/SCRIPT-HOOK-FORMULAS.md §2). Matched case-insensitively,
// apostrophes normalized.
const BANNED = [
  "this trend is expected to", "experts say", "it's important to", "it is important to",
  "in today's world", "let's dive into", "let us dive into", "here's why", "here is why",
  "the key takeaway is", "industry leaders are",
  "here's what nobody tells you", "here is what nobody tells you", "not gonna lie", "let me be honest",
];

// Physical things a camera can photograph (task 4's examples first). Plurals are matched too.
const CONCRETE = [
  "courthouse", "gavel", "padlock", "warehouse", "factory", "bill", "banknote", "coin", "cash", "check", "cheque",
  "phone", "smartphone", "laptop", "computer", "server", "chip", "robot", "drone", "camera", "screen", "keyboard",
  "car", "truck", "bus", "train", "plane", "aircraft", "jet", "ship", "tanker", "boat", "rocket", "satellite", "bike", "tractor",
  "house", "home", "apartment", "building", "tower", "skyscraper", "office", "headquarters", "bank", "store", "shop", "mall",
  "school", "hospital", "clinic", "prison", "jail", "court", "courtroom", "station", "airport", "port", "harbor", "harbour",
  "bridge", "road", "highway", "street", "pipeline", "refinery", "mine", "dam", "plant", "mill", "farm", "field", "border", "wall",
  "steel", "oil", "gas", "gold", "silver", "copper", "lithium", "coal", "wheat", "rice", "corn", "coffee", "beef", "egg", "milk",
  "contract", "warrant", "subpoena", "indictment", "lawsuit", "ballot", "passport", "visa", "receipt", "invoice", "paycheck", "card",
  "battery", "engine", "tire", "panel", "turbine", "reactor", "weapon", "gun", "missile", "tank", "uniform", "badge", "helmet", "glove",
  "container", "package", "box", "crate", "pallet", "shelf", "desk", "chair", "door", "lock", "vault", "safe", "wallet",
  "medicine", "pill", "vaccine", "syringe", "app", "website", "email", "text message", "photo", "video", "map", "chart",
];
// Abstract nouns (task 4's examples first) — what an essay is made of, not what a camera sees.
const ABSTRACT = [
  "trend", "approach", "strategy", "strategies", "adoption", "importance", "significance", "potential", "future",
  "impact", "landscape", "journey", "ecosystem", "innovation", "transformation", "efficiency", "success", "mindset",
  "concept", "idea", "factor", "aspect", "challenge", "opportunity", "opportunities", "solution", "framework", "paradigm",
  "dynamics", "insight", "development", "progress", "situation", "issue", "benefit", "value", "quality", "stability",
  "freedom", "peace", "wellbeing", "well-being", "productivity", "leadership", "skill", "communication", "culture", "awareness",
  "knowledge", "understanding", "experience", "behavior", "behaviour", "habit", "decision", "uncertainty", "complexity",
  "balance", "growth", "change", "shift", "power", "role", "level", "way", "thing", "world", "industry", "sector", "space", "era", "age",
];
const SPELLED = "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|half|double|triple|dozen";
const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
// A sentence-initial word that is never a name on its own.
const STARTERS = new Set("a an the this that these those it its he she they we you i our your their his her my when while if but and or so yet because after before since as at in on for from with without by to of then now here there what why how who which where".split(" "));

// Plurals: -s / -es, and y -> -ies ("factory" -> "factories").
const nounRe = (list) => new RegExp(`\\b(?:${list.map((w) => (w.endsWith("y") ? `${w.slice(0, -1)}(?:y|ie)` : w).replace(/[-]/g, "[- ]?").replace(/\s+/g, "\\s+")).join("|")})(?:s|es)?\\b`, "gi");
const CONCRETE_RE = nounRe(CONCRETE), ABSTRACT_RE = nounRe(ABSTRACT);
const norm = (s) => String(s || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

/** Sentences of a voiceover (decimals, "U.S."-style abbreviations and "$1.5" are not breaks). */
function sentences(text) {
  const prot = norm(text)
    .replace(/\b([A-Z])\.(?=[A-Z]\.)/g, "$1\u0001").replace(/\b([A-Z])\.(?=\s+[A-Z][a-z])/g, (m, a, off, s) => (/[A-Z][.\u0001][A-Z]$/.test(s.slice(Math.max(0, off - 2), off + 1)) ? `${a}\u0001` : m))
    .replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Inc|Corp|Co|Ltd|vs|No|Gov|Sen|Rep|Gen|Lt|Col|Sgt|Prof)\./g, "$1\u0001")
    .replace(/(\d)\.(\d)/g, "$1\u0002$2");
  return prot.split(/(?<=[.!?])\s+(?=["'(]?[A-Z0-9$])/)
    .map((s) => s.replace(/\u0001/g, ".").replace(/\u0002/g, ".").trim())
    .filter((s) => /[A-Za-z0-9]/.test(s));
}

/** The distinct specifics a sentence names: { names, numbers, objects }. */
function specificsOf(sentence, ctx = {}) {
  const s = norm(sentence);
  const capsElsewhere = ctx.capsElsewhere || new Set(), entities = ctx.entities || new Set();
  // Proper names: runs of capitalized words ("of", "the", "and", "de" allowed inside a run).
  const names = [];
  const toks = s.split(/\s+/);
  let run = [], runStart = -1;
  const flush = () => {
    if (!run.length) return;
    const text = run.join(" ").replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
    const first = runStart === 0;
    const bare = text.replace(/'s$/, "");
    const ok = run.length > 1 || !first
      ? !(run.length === 1 && STARTERS.has(bare.toLowerCase()))
      : capsElsewhere.has(bare) || entities.has(bare.toLowerCase());
    // A one-word run that is only a sentence starter ("The") is not a name; "I" never is.
    if (ok && bare && bare !== "I" && !STARTERS.has(bare.toLowerCase())) names.push(bare);
    run = []; runStart = -1;
  };
  toks.forEach((t, i) => {
    const w = t.replace(/^["'(]+|[,.;:!?"')]+$/g, "");
    const isCap = /^[A-Z][\p{L}'.&-]*$/u.test(w) || /^[A-Z]{2,}s?$/.test(w);
    const joiner = run.length && /^(of|the|and|de|del|da|von|van|for|on)$/.test(w);
    if (isCap && !(i === 0 && STARTERS.has(w.toLowerCase()) && !/^[A-Z]{2,}$/.test(w))) { if (!run.length) runStart = i; run.push(w); }
    else if (joiner) run.push(w);
    else flush();
    if (/[,.;:!?)]$/.test(t)) flush();
  });
  flush();
  // Trailing joiners ("Bank of") are trimmed by the run text; drop duplicates.
  const cleanNames = [...new Set(names.map((n) => n.replace(/\s+(of|the|and|de|for|on)$/i, "")))];
  // Numbers: digits (with currency / percent / scale), spelled numbers, dates.
  const numbers = [];
  for (const m of s.matchAll(new RegExp(`\\$?\\d[\\d,]*(?:\\.\\d+)?(?:\\s*%|\\s*(?:percent|k|m|bn|million|billion|trillion|thousand)\\b)?|\\b(?:${SPELLED})(?:[\\s-]+(?:${SPELLED}|and))*\\b|\\b(?:${MONTHS})\\b`, "gi"))) {
    const v = m[0].trim().replace(/[,.]+$/, "");
    if (/^(one|a)$/i.test(v)) continue;          // "one of the", "a" — not a figure
    numbers.push(v.toLowerCase());
  }
  const objects = [...new Set([...s.matchAll(CONCRETE_RE)].map((m) => m[0].toLowerCase()))];
  return { names: cleanNames, numbers: [...new Set(numbers)], objects };
}

function abstractNouns(sentence) {
  return [...norm(sentence).matchAll(ABSTRACT_RE)].map((m) => m[0].toLowerCase());
}

/** The full report for a script object. */
function validateScript(script, research = null) {
  const text = (script.sections || []).map((x) => x.voiceover || "").join(" ");
  const sents = sentences(text);
  // A word capitalized mid-sentence anywhere in the script is a name when it starts one too.
  const capsElsewhere = new Set();
  for (const s of sents) s.split(/\s+/).slice(1).forEach((t) => { const w = t.replace(/^["'(]+|[,.;:!?"')]+$/g, "").replace(/'s$/, ""); if (/^[A-Z][a-z]/.test(w) && !STARTERS.has(w.toLowerCase())) capsElsewhere.add(w); });
  const entities = new Set();
  for (const e of research?.named_entities || []) for (const w of String(e?.name || e || "").split(/\s+/)) if (w) entities.add(w.toLowerCase());
  const rows = sents.map((s) => {
    const sp = specificsOf(s, { capsElsewhere, entities });
    const score = Math.min(3, sp.names.length + sp.numbers.length + sp.objects.length);
    return { sentence: s, score, ...sp, abstract: abstractNouns(s) };
  });
  const low = norm(text).toLowerCase();
  const banned = BANNED.filter((p) => low.includes(p));
  const avg = rows.length ? rows.reduce((a, r) => a + r.score, 0) / rows.length : 0;
  const concrete = rows.reduce((a, r) => a + r.names.length + r.objects.length, 0);
  const abstract = rows.reduce((a, r) => a + r.abstract.length, 0);
  const ratio = abstract ? concrete / abstract : Infinity;
  const zero = rows.filter((r) => r.score === 0);
  const specOk = !zero.length && avg >= 1.5 && !banned.length;
  const ratioOk = ratio >= 2;
  return { sentences: rows, avg, banned, zero, concrete, abstract, ratio, specOk, ratioOk, pass: specOk && ratioOk };
}

/** The "  - " feedback lines the script stage appends to its re-ask prompt. */
function feedbackLines(r) {
  const out = [];
  for (const z of r.zero) out.push(`  - SPECIFICITY: "${z.sentence}" names nothing specific. Rewrite it to name a person, place, organization, number or physical object FROM THE RESEARCH (key_facts / numbers / named_entities), or cut it. Never invent a name or a figure.`);
  if (r.avg < 1.5) out.push(`  - SPECIFICITY: the script averages ${r.avg.toFixed(2)} named specifics per sentence; it must average at least 1.5. Put a second research name or figure into the weakest sentences.`);
  for (const b of r.banned) out.push(`  - BANNED PHRASE: "${b}" — remove it; state the research fact directly instead.`);
  if (!r.ratioOk) {
    const words = [...new Set(r.sentences.flatMap((x) => x.abstract))].slice(0, 8).join(", ");
    out.push(`  - CONCRETE NOUNS: ${r.concrete} concrete vs ${r.abstract} abstract (ratio ${Number.isFinite(r.ratio) ? r.ratio.toFixed(1) : "inf"}, need >= 2.0). Replace abstract nouns (${words}) with the research's people, places, organizations and objects.`);
  }
  return out;
}

module.exports = { validateScript, feedbackLines, sentences, specificsOf, abstractNouns, BANNED };

if (require.main === module) {
  const [ch, scriptPath, researchPath] = process.argv.slice(2);
  if (!scriptPath) { console.error("usage: node scripts/validate-script.cjs <channel> <script.json> [research.json]"); process.exit(1); }
  const script = JSON.parse(readFileSync(scriptPath, "utf8"));
  let research = null;
  try { if (researchPath) research = JSON.parse(readFileSync(researchPath, "utf8")); } catch {}
  const r = validateScript(script, research);
  for (const x of r.sentences) console.log(`[script]   ${x.score}  ${x.sentence}${x.score ? `  (${[...x.names, ...x.numbers, ...x.objects].join("; ")})` : ""}`);
  console.log(`[script] ch-${ch}: ${r.sentences.length} sentences, avg score ${r.avg.toFixed(1)}, ${r.banned.length} banned phrase${r.banned.length === 1 ? "" : "s"}, ${r.specOk ? "PASS" : "FAIL"}`);
  console.log(`[script] ch-${ch}: ${r.concrete} concrete, ${r.abstract} abstract, ratio ${Number.isFinite(r.ratio) ? r.ratio.toFixed(1) : "inf"}, ${r.ratioOk ? "PASS" : "FAIL"}`);
  for (const l of feedbackLines(r)) console.log(l);
  process.exit(r.pass ? 0 : 2);
}
