#!/usr/bin/env node
/**
 * The script stage's three checks in one call (daily-pipeline-v2.yml "Write script"):
 *   specificity  scripts/validate-script.cjs            (every sentence names something; avg >= 1.5; concrete:abstract >= 2)
 *   voice        scripts/validate-script-voice.cjs      (banned openings, <= 25 words, name starts, …)
 *   narrative    scripts/validate-script-narrative.cjs  (hook / setup / re-hook / payoff / close)
 *
 *   node scripts/validate-script-story.cjs <channel> <script.json> [research.json] [--blocked <dir>]
 *     exit 0 = nothing blocking, 2 = narrative / specificity fail. Prints each
 *     validator's log and its "  - " feedback.
 *     --blocked <dir> (the check after the re-ask): failures write
 *     blocked-script-<narrative|specificity>-<ch>.txt and the run continues with the
 *     script. Owner's ruling 2026-10-05: VOICE IS A WARNING, NOT A GATE. It rejected
 *     ch-1, ch-9 and ch-49 on every run for a week across three prompts of prompt
 *     tuning. It still runs and still logs every failure, but it no longer sets the
 *     exit code (it never returns 3), so the workflow cannot take its
 *     "skip this channel" branch. blocked-voice-<ch>.txt is still written as a
 *     diagnostic and says the channel was NOT skipped.
 */
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const S = require("./validate-script.cjs");
const V = require("./validate-script-voice.cjs");
const N = require("./validate-script-narrative.cjs");

const args = process.argv.slice(2);
const bi = args.indexOf("--blocked");
const blockedDir = bi >= 0 ? args[bi + 1] : null;
// Without --blocked, bi is -1 and "i !== bi + 1" dropped args[0] (the channel): the first check
// of CI run 37141128792 read the script path as the channel and validated an empty script.
const [ch, scriptPath, researchPath] = bi < 0 ? args : args.filter((a, i) => i !== bi && i !== bi + 1);
const script = JSON.parse(readFileSync(scriptPath, "utf8"));
let research = null;
try { if (researchPath) research = JSON.parse(readFileSync(researchPath, "utf8")); } catch {}

const out = { specificity: [], voice: [], narrative: [] };
const s = S.validateScript(script, research);
out.specificity.push(`[script] ch-${ch}: ${s.sentences.length} sentences, avg score ${s.avg.toFixed(1)}, ${s.banned.length} banned phrase(s), ${s.specOk ? "PASS" : "FAIL"}`);
out.specificity.push(`[script] ch-${ch}: ${s.concrete} concrete, ${s.abstract} abstract, ratio ${Number.isFinite(s.ratio) ? s.ratio.toFixed(1) : "inf"}, ${s.ratioOk ? "PASS" : "FAIL"}`);
out.specificity.push(...S.feedbackLines(s));
const v = V.validateVoice(script, research);
for (const row of v.rows) for (const f of row.fails) out.voice.push(`[script] ch-${ch}: sentence ${row.i} "${row.sentence.slice(0, 60)}${row.sentence.length > 60 ? "…" : ""}" WARN: ${f}`);
out.voice.push(`[script] ch-${ch}: voice — ${v.rows.length} sentences, ${v.banned} banned, ${v.long} over 25 words, ${v.nameStarts} name-start(s), ${v.failures} warning(s)`);
out.voice.push(...V.feedbackLines(v));
const n = N.validateNarrative(script, research);
out.narrative.push(`[script] ch-${ch}: beats read by ${n.by}`);
out.narrative.push(N.summary(ch, n));
out.narrative.push(...N.feedbackLines(n));

for (const k of ["narrative", "voice", "specificity"]) for (const l of out[k]) console.log(l);
const failed = { narrative: !n.pass, voice: !v.pass, specificity: !s.pass };
// VOICE IS A WARNING, NOT A GATE (owner, 2026-10-05). It rejected ch-1, ch-9 and
// ch-49 on every run for a week across three prompts of prompt-tuning, and a
// channel that produces no video is worse than one with a flat-sounding line.
// It still runs and still logs every failure; it just no longer decides the
// exit code, so the workflow never takes its "skip this channel" branch.
// Narrative and specificity keep their existing behaviour: logged, and they set
// exit 2, which the workflow already treats as "continue with this script".
const hardFail = failed.narrative || failed.specificity;
const failures = (n.pass ? 0 : n.failures) + v.failures + (s.pass ? 0 : 1);
console.log(`[script] ch-${ch}: story checks — narrative ${n.pass ? "PASS" : "FAIL"}, voice ${v.pass ? "PASS" : "WARN"}, specificity ${s.pass ? "PASS" : "FAIL"} (${failures} issue(s))`);
if (failed.voice) console.log(`[voice] ch-${ch}: ${v.failures} warnings, continuing`);
if (failed.voice && blockedDir) {
  // Still recorded as a diagnostic, but the run is NOT stopped by it.
  mkdirSync(blockedDir, { recursive: true });
  const text = (script.sections || []).map((x) => `[${x.id}] ${x.voiceover}`).join("\n");
  writeFileSync(join(blockedDir, `blocked-voice-${ch}.txt`), `Script voice WARNINGS after the re-ask — ch-${ch}, ${scriptPath} (${new Date().toISOString()}). Voice is a warning, not a gate (owner, 2026-10-05): the channel was NOT skipped; it rendered and uploaded normally.\n\n${out.voice.join("\n")}\n\nScript:\n${text}\n`);
}
if (hardFail && blockedDir) {
  mkdirSync(blockedDir, { recursive: true });
  const text = (script.sections || []).map((x) => `[${x.id}] ${x.voiceover}`).join("\n");
  for (const k of ["narrative", "specificity"]) if (failed[k]) {
    writeFileSync(join(blockedDir, `blocked-script-${k}-${ch}.txt`), `Script ${k} FAIL after the re-ask — ch-${ch}, ${scriptPath} (${new Date().toISOString()}). The run continued with this script.\n\n${out[k].join("\n")}\n\nScript:\n${text}\n`);
  }
}
process.exit(hardFail ? 2 : 0);
