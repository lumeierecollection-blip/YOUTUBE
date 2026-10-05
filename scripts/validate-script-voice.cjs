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
const STOPWORDS = new Set(["the", "and", "but", "because", "a", "an", "of", "to", "in", "for", "on", "with", "as", "at", "by", "from", "that", "this", "it", "is", "was", "are", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "shall"]);
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
  // The CLOSE beat's sentences are the viewer's action ("Report illegal tech smuggling to
  // federal authorities.", "Adopt collective leadership across your team today.") — a
  // narrative device like the setup's question; validate-script-narrative.cjs already requires
  // the close to be a specific action or number (CI run 37154369091: ch-26 / ch-44 / ch-2 closes).
  // Directed scripts (schemas/script.directed.json) number their sections sec_1..sec_N with
  // no id "close", so the id lookup alone never matched them and ch-2's closing
  // "Know your rights, and keep your data secure." was failed as naming nothing
  // (CI run 37297352662). Fix: use the section literally named "close" when there is
  // one, and otherwise the script's FINAL sentence (the positional close that
  // validate-script-narrative.cjs uses). Only the final sentence — never every
  // sentence of the last section, which for a single-section script is the whole
  // script and would exempt all of it.
  const secs = script.sections || [];
  const namedClose = secs.find((x) => x.id === "close");
  const closeSents = new Set(sentences((namedClose || {}).voiceover || "").map((s) => s.trim()));
  if (!namedClose && sents.length) closeSents.add(sents[sents.length - 1].trim());
  const people = peopleOf(research);
  const ents = new Set((research?.named_entities || []).flatMap((e) => String(e?.name || "").split(/\s+/)).map((w) => w.toLowerCase()).filter(Boolean));
  const rows = [];
  let nameStarts = 0;
  let fullNameStarts = 0;
  sents.forEach((s, i) => {
    const fails = [];
    const low = norm(s).toLowerCase().trim();
    const op = BANNED_OPENINGS.find((o) => low.replace(/^["'(]+/, "").startsWith(o));
    if (op) fails.push(`banned opening "${op}"`);
    const ps = personStart(s, people);
    // A single sentence opening with a person's full name is correct reporting,
    // not a defect. The rule is now a SCRIPT-level count (see scriptFails below),
    // so one attribution like ch-48's "Jan Sigmund announced these supply chain
    // updates from Schindellegi, Switzerland on October 2, 2026." passes while two
    // such openers still fail.
    if (ps.full) fullNameStarts++;
    if (ps.any) nameStarts++;
    const wc = s.split(/\s+/).filter(Boolean).length;
    if (wc > 25) fails.push(`${wc} words (> 25)`);
    const bp = BANNED_PHRASES.filter((p) => low.includes(p));
    for (const p of bp) fails.push(`banned phrase "${p}"`);
    const sp = specificsOf(s, { entities: ents });
    // A question of <= 15 words is a narrative device (the setup must END on one —
    // validate-script-narrative.cjs), not a wire sentence: ch-48's "Can a tiny workshop
    // outperform a sprawling industrial giant?" (9 words) skipped the channel in CI run
    // 37149091704 (owner's ruling 2026-10-03). Longer questions still must name something.
    const question = /\?\s*["')]*$/.test(s.trim()) && wc <= 15;
    // Owner's ruling 2026-10-05: a short sentence that BRIDGES two grounded
    // sentences need not name anything itself — its job is to connect them.
    // Exempt <= 12 words when the sentence before AND the sentence after each
    // carry a named entity from the research. ch-9's "The resulting demarcation
    // directly impacts regional stability." (CI run 37297352662) is this shape.
    const namesSomething = (t) => {
      if (!t) return false;
      const x = specificsOf(t, { entities: ents });
      return x.names.length + x.numbers.length + x.objects.length > 0;
    };
    const bridgeExempt = wc <= 12 && namesSomething(sents[i - 1]) && namesSomething(sents[i + 1]);
    if (sp.names.length + sp.numbers.length + sp.objects.length === 0 && !isTurnLine(s) && !question && !closeSents.has(s.trim()) && !bridgeExempt) fails.push("names no person, place, organization, number or object");
    if (/\b(was|were|is|are|been|being)\s+\w+(?:ed|en)\s+by\b/i.test(s)) fails.push("passive voice (… was done by …)");
    // Repeated opener (owner, 2026-10-05): fire only when the repeated word is a
    // FILLER ("the", "and", "because", "but" …). Naming the subject twice in a row
    // is correct writing — ch-44's "Clever …" / "Clever operates as Denmark's largest
    // …" (CI run 37297352662) — so a proper noun, a content word or a verb is exempt.
    if (i > 0 && firstWord(s) && firstWord(s) === firstWord(sents[i - 1]) && STOPWORDS.has(firstWord(s))) fails.push(`starts with the same word as the sentence before ("${firstWord(s)}")`);
    rows.push({ i: i + 1, sentence: s, words: wc, fails });
  });
  const scriptFails = [];
  // The full-name opener is a SCRIPT count (owner, 2026-10-05): ONE sentence may
  // open with a person's full name. Two or more is the wire-lead repetition the
  // rule was written for, and it still fails.
  if (people.length && fullNameStarts > 1) scriptFails.push(`${fullNameStarts} sentences start with a person's full name (max 1)`);
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
