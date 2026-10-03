#!/usr/bin/env node
/**
 * Script VOICE validator (owner's spec 2026-10-03, "fix the script voice", B.4).
 *
 *   node scripts/validate-script-voice.cjs <channel> <script.json> [research.json]
 *     exit 0 = PASS, 2 = FAIL. "  - " lines are the re-ask feedback.
 *
 * Per sentence: no banned opening (first words), no full person name first, <= 25 words,
 * no banned phrase, names at least one person / place / organization / number / object
 * (validate-script.cjs specificsOf), no passive "X was done by Y", and no two consecutive
 * sentences starting with the same word. Per script: at most ONE sentence starts with a
 * person's name.
 *
 * Person names come from the research artifact (named_entities with kind "person"), so a
 * sentence opening "Federal Reserve…" is not mistaken for a person. Without the research,
 * the name-start checks cannot run and say so. Lexical, not semantic: it catches the wire
 * voice ("Jerome Powell said… Powell also noted…"), not every flat sentence.
 */
const { readFileSync } = require("node:fs");
const { sentences, specificsOf, isTurnLine } = require("./validate-script.cjs");

const BANNED_OPENINGS = ["according to", "in a statement", "officials said", "the report states", "the report", "data shows", "this trend", "experts say", "let's dive into", "let us dive into", "here's why", "here is why", "here's what happened", "let me tell you", "have you ever wondered"];
const BANNED_PHRASES = ["this trend is expected to", "it's important to", "it is important to", "in today's world", "the key takeaway is", "industry leaders are", "as we look ahead", "it remains to be seen", "only time will tell", "at the end of the day", "here's what nobody tells you", "not gonna lie", "let me be honest", "experts say", "let's dive into"];
const norm = (s) => String(s || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const firstWord = (s) => (norm(s).trim().match(/^["'(]*([\p{L}\p{N}$%'-]+)/u) || [])[1]?.toLowerCase() || "";

function peopleOf(research) {
  return (research?.named_entities || []).filter((e) => String(e?.kind || e?.type || "").toLowerCase() === "person").map((e) => String(e.name || "").trim()).filter(Boolean);
}

/** { full, any } — the sentence opens with a person's full name / with any part of one. */
function personStart(sentence, people) {
  const s = norm(sentence).trim().replace(/^["'(]+/, "");
  for (const p of people) {
    const parts = p.split(/\s+/).filter((w) => w.length > 1);
    if (parts.length >= 2 && s.toLowerCase().startsWith(p.toLowerCase())) return { full: true, any: true, name: p };
    const head = (s.match(/^[\p{L}'.-]+/u) || [""])[0].replace(/'s$/i, "");
    if (head && parts.some((w) => w.toLowerCase() === head.toLowerCase())) return { full: false, any: true, name: p };
  }
  return { full: false, any: false };
}

function validateVoice(script, research = null) {
  const text = (script.sections || []).map((x) => x.voiceover || "").join(" ");
  const sents = sentences(text);
  const people = peopleOf(research);
  const ents = new Set((research?.named_entities || []).flatMap((e) => String(e?.name || "").split(/\s+/)).map((w) => w.toLowerCase()).filter(Boolean));
  const rows = [];
  let nameStarts = 0;
  sents.forEach((s, i) => {
    const fails = [];
    const low = norm(s).toLowerCase().trim();
    const op = BANNED_OPENINGS.find((o) => low.replace(/^["'(]+/, "").startsWith(o));
    if (op) fails.push(`banned opening "${op}"`);
    const ps = personStart(s, people);
    if (ps.full) fails.push(`starts with a person's full name ("${ps.name}")`);
    if (ps.any) nameStarts++;
    const wc = s.split(/\s+/).filter(Boolean).length;
    if (wc > 25) fails.push(`${wc} words (> 25)`);
    const bp = BANNED_PHRASES.filter((p) => low.includes(p));
    for (const p of bp) fails.push(`banned phrase "${p}"`);
    const sp = specificsOf(s, { entities: ents });
    if (sp.names.length + sp.numbers.length + sp.objects.length === 0 && !isTurnLine(s)) fails.push("names no person, place, organization, number or object");
    if (/\b(was|were|is|are|been|being)\s+\w+(?:ed|en)\s+by\b/i.test(s)) fails.push("passive voice (… was done by …)");
    if (i > 0 && firstWord(s) && firstWord(s) === firstWord(sents[i - 1])) fails.push(`starts with the same word as the sentence before ("${firstWord(s)}")`);
    rows.push({ i: i + 1, sentence: s, words: wc, fails });
  });
  const scriptFails = [];
  if (people.length && nameStarts > 1) scriptFails.push(`${nameStarts} sentences start with a person's name (max 1)`);
  const failures = rows.reduce((n, r) => n + r.fails.length, 0) + scriptFails.length;
  return { rows, nameStarts, peopleKnown: people.length > 0, scriptFails, failures, pass: failures === 0,
    banned: rows.reduce((n, r) => n + r.fails.filter((f) => /^banned/.test(f)).length, 0), long: rows.filter((r) => r.words > 25).length };
}

function feedbackLines(r) {
  const out = [];
  for (const row of r.rows) for (const f of row.fails) out.push(`  - VOICE: sentence ${row.i} "${row.sentence}" — ${f}. Rewrite it so it sounds like a person talking: vary the subject, no wire-service opening, under 25 words, naming something from the research.`);
  for (const f of r.scriptFails) out.push(`  - VOICE: ${f}. A person's name may START at most one sentence; open the others with a pronoun, an action, a place, a number, a time, a question or an object.`);
  return out;
}

module.exports = { validateVoice, feedbackLines, BANNED_OPENINGS, BANNED_PHRASES, personStart };

if (require.main === module) {
  const [ch, scriptPath, researchPath] = process.argv.slice(2);
  const script = JSON.parse(readFileSync(scriptPath, "utf8"));
  let research = null;
  try { if (researchPath) research = JSON.parse(readFileSync(researchPath, "utf8")); } catch {}
  const r = validateVoice(script, research);
  for (const row of r.rows) for (const f of row.fails) console.log(`[script] ch-${ch}: sentence ${row.i} "${row.sentence.slice(0, 60)}${row.sentence.length > 60 ? "…" : ""}" FAIL: ${f}`);
  console.log(`[script] ch-${ch}: voice — ${r.rows.length} sentences, ${r.banned} banned, ${r.long} over 25 words, ${r.nameStarts} name-start(s)${r.peopleKnown ? "" : " (no person entities in the research: name checks not applicable)"}, ${r.failures} failure(s) → ${r.pass ? "PASS" : "FAIL"}`);
  for (const l of feedbackLines(r)) console.log(l);
  process.exit(r.pass ? 0 : 2);
}
