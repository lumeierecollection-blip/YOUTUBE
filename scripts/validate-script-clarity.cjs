#!/usr/bin/env node
/**
 * Script CLARITY (owner, 2026-10-16: "make sure that the script actually makes sense ... there's a lot of ambiguity and there is no open, closed type of
 * thing where we get the answer to the question ... the main parts ... things that give enough context").
 *
 * Two readers, both feeding the script stage's ONE re-ask (validate-script-story.cjs -> repair-sentences.mjs), in the "  - " line format it repairs:
 *
 *   1. WORD TESTS (here, no model):
 *      EMPTY     a sentence that only comments ("That's a shocking reality.", "That's the specific action you can take." — board 38831133468 ch-44)
 *                and names nothing: no name, no number, no object. A short turn line ("That's the trap.") is allowed: it is the narrative hinge.
 *      DANGLING  "he / she / him / her / his" before the script has named any person ("Yet as soon as she started, the dream unraveled." — same board,
 *                no woman was ever named).
 *   2. A VIEWER'S READ (scripts/check-script-clarity.mjs, Gemini): someone who knows nothing reads the script and says what happened, who / where / when,
 *      the question the script opens and whether the script answers it, and every sentence a viewer cannot follow. Gemini unavailable -> only the word
 *      tests run, and that is logged.
 *
 * Where it stops: the word tests are lists, not grammar; "they" / "it" are not checked (too often legitimate). The viewer's read is a model's opinion; it
 * steers ONE repair, it is not a proof that the script is clear.
 */
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");
const { sentences, specificsOf, isTurnLine } = require("./validate-script.cjs");

const OPENER = /^(that's|that is|this is|it's|it is|here's|here is|what a|such a|that was|this was|it was)\b/i;
const PRONOUN = /\b(she|he|her|his|him|hers|herself|himself)\b/i;

function rowsOf(script) {
  const rows = [];
  for (const sec of script.sections || []) for (const s of sentences(sec.voiceover || "")) rows.push({ n: rows.length + 1, beat: sec.id, text: s });
  return rows;
}

/** The word tests. Returns [{ n, text, why }]. */
function wordTests(script, research) {
  const rows = rowsOf(script);
  const people = ((research && research.named_entities) || []).filter((e) => e && e.kind === "person").map((e) => String(e.name));
  const problems = [];
  let personNamed = false;
  for (const r of rows) {
    const sp = specificsOf(r.text);
    const namesNothing = !sp.names.length && !sp.numbers.length && !sp.objects.length;
    if (OPENER.test(r.text.trim()) && namesNothing && !isTurnLine(r.text)) {
      problems.push({ n: r.n, text: r.text, why: "it only comments and names nothing — a viewer learns nothing from it. Replace it with the next fact of the story (who did what, the number, the result), or CUT it" });
    }
    const pro = r.text.match(PRONOUN);
    if (pro) {
      const before = r.text.slice(0, pro.index);
      const namedHere = people.some((p) => before.includes(p.split(/\s+/).pop())) || sp.names.some((nm) => before.includes(nm) && /\s/.test(nm));
      if (!personNamed && !namedHere) problems.push({ n: r.n, text: r.text, why: `"${pro[0]}" — no person has been named yet, so the viewer cannot tell who this is. Name the person (full name the first time)` });
    }
    if (people.some((p) => r.text.includes(p.split(/\s+/).pop())) || sp.names.some((nm) => /\s/.test(nm))) personNamed = true;
  }
  return problems;
}

/** The viewer's read through Gemini (a child process: this module is synchronous). null when it could not run. */
function viewerRead(scriptPath, researchPath) {
  const r = spawnSync(process.execPath, [join(__dirname, "check-script-clarity.mjs"), scriptPath, researchPath || ""], { encoding: "utf8", timeout: 120000 });
  try { return JSON.parse(String(r.stdout || "").trim().split("\n").pop()); } catch { return null; }
}

/** Everything, as the re-ask's "  - " lines plus a log. */
function validateClarity(script, research, { scriptPath = null, researchPath = null, useModel = true } = {}) {
  const word = wordTests(script, research);
  const lines = word.map((p) => `  - CLARITY: sentence ${p.n} "${p.text}" — ${p.why}.`);
  const log = [`[clarity] word tests: ${word.length} problem(s)`];
  let view = null;
  if (useModel && scriptPath) {
    view = viewerRead(scriptPath, researchPath);
    if (!view || view.error) log.push(`[clarity] viewer read unavailable (${view ? view.error : "no answer"}) — word tests only`);
    else {
      log.push(`[clarity] viewer read: what happened = ${view.what_happened || "(not stated)"}; question = ${view.question || "(none)"}; answered = ${view.answered}`);
      if (!view.what_happened) lines.push(`  - NARRATIVE: SETUP never says what happened (who did what, where, when) — a viewer who knows nothing cannot follow the story. Make the first setup sentence state the event from the research.`);
      if (view.question && !view.answered) lines.push(`  - NARRATIVE: PAYOFF does not answer the question the script opens ("${view.question}"). The payoff must state the answer plainly, from the research; if the research does not hold the answer, rewrite the setup question into one the research DOES answer.`);
      for (const p of view.unclear || []) if (p && Number(p.n) > 0) lines.push(`  - CLARITY: sentence ${Number(p.n)} "${String(p.text || "").slice(0, 160)}" — ${String(p.why || "unclear to a viewer").slice(0, 200)}. Rewrite it so a viewer who knows nothing follows it (name who or what, explain the term in a few words), or CUT it if it repeats an earlier sentence.`);
    }
  }
  return { pass: lines.length === 0, lines, log, word, view };
}

module.exports = { validateClarity, wordTests, rowsOf };

if (require.main === module) {
  const { readFileSync } = require("node:fs");
  const [scriptPath, researchPath] = process.argv.slice(2);
  const script = JSON.parse(readFileSync(scriptPath, "utf8"));
  let research = null; try { research = researchPath ? JSON.parse(readFileSync(researchPath, "utf8")) : null; } catch {}
  const r = validateClarity(script, research, { scriptPath, researchPath });
  for (const l of [...r.log, ...r.lines]) console.log(l);
  process.exit(r.pass ? 0 : 2);
}
