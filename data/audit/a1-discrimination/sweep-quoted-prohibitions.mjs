/**
 * Sweep for the "quoted prohibition" bug class in every prompt string that reaches the model.
 *
 * The bug: prose that MENTIONS a prohibition, a forbidden word, or a "do not" while telling
 * the model the thing is allowed (or was removed). A model pattern-matches phrasing, not
 * framing, so naming "do not call it empty" inside a sentence that says empty is fine
 * reinstalls the inhibition. One instance was found and fixed during the clause-#3 work (a
 * comment accidentally placed inside the template literal); this checks for others, and for
 * prohibitions that were never removed.
 *
 * Scope: every string literal in gemini-frame-review.js that is pushed into a model message,
 * plus every description/prompt field in config/visual-bible.json.
 *
 * This is a LINTER, not a judgement. It reports candidates; each needs a human read to say
 * whether the mention is a shield (delete it), a legitimate instruction (keep it), or a
 * description of a removed clause (delete it — that is the bug).
 */
import { readFileSync } from "node:fs";

const REVIEWER = "scripts/gemini-frame-review.js";
const BIBLE = "config/visual-bible.json";

// A prohibition MENTION: the sentence talks about a prohibition rather than stating one.
const MENTION = [
  { re: /\bdo not call\b/i, why: "names a 'do not call' prohibition" },
  { re: /\bis not a defect\b/i, why: "names the 'not a defect' exemption" },
  { re: /\bnever list\b/i, why: "names a 'never list' instruction" },
  { re: /\bnot noise in this style\b/i, why: "names the noise exemption" },
  { re: /\bthe clause (that|this) (used to|previously)\b/i, why: "narrates a removed clause" },
  { re: /\b(used to be|was removed|is no longer|previously) (call|forbid|prohibit|exempt)/i, why: "narrates a removed prohibition" },
  { re: /\bdo not treat .{0,40} as a defect\b/i, why: "names a defect exemption" },
  { re: /\bnever\b.{0,60}\b(as (a|an) )\w+/i, why: "may forbid a noun mid-sentence" },
  { re: /\bpage furniture\b/i, why: "names the 'page furniture' exemption" },
];

const src = readFileSync(REVIEWER, "utf8");
const bible = JSON.parse(readFileSync(BIBLE, "utf8"));

/** Pull the template-literal / string bodies that are pushed as model text. */
function promptStrings(text) {
  const out = [];
  const push = /content\.push\(\{\s*type:\s*"text"\s*,\s*text:\s*"((?:[^"\\]|\\.)*)"\s*\}\)/g;
  let m;
  while ((m = push.exec(text))) out.push({ where: `content.push near offset ${m.index}`, body: m[1] });
  // PAPER_RUBRIC replacement strings (the restated rubric).
  const rubric = /^\s*"\d+\.\s[A-Z][^"]*:\s([^"]*)"\],?\s*$/gm;
  while ((m = rubric.exec(text))) out.push({ where: "PAPER_RUBRIC replacement", body: m[1] });
  return out;
}

const sentences = (s) => s.replace(/\\n/g, " ").split(/(?<=[.;])\s+/);

let hits = 0;
const report = (where, text, label) => {
  for (const s of sentences(text)) {
    for (const { re, why } of MENTION) {
      if (re.test(s)) {
        hits++;
        console.log(`\n[${label}] ${where}\n  ${why}\n  > ${s.trim().slice(0, 240)}`);
      }
    }
  }
};

for (const { where, body } of promptStrings(src)) report(where, body, "reviewer prompt");

for (const [id, rule] of Object.entries(bible.rules || {})) {
  for (const field of ["description", "pass", "fail_if", "question", "flag", "avoid", "treatment"]) {
    if (typeof rule[field] === "string") report(`bible rule ${id}.${field}`, rule[field], "bible");
  }
}
for (const [name, test] of Object.entries(bible.quality_tests || {})) {
  for (const field of ["question", "fail_if", "pass", "flag"]) {
    if (typeof test[field] === "string") report(`bible quality_tests.${name}.${field}`, test[field], "bible");
  }
}
for (const [k, v] of Object.entries(bible.prompts || {})) {
  if (typeof v === "string") report(`bible prompts.${k}`, v, "bible");
}
for (const [k, v] of Object.entries(bible.principles || {})) {
  if (typeof v === "string") report(`bible principles.${k}`, v, "bible");
}

console.log(`\n${hits} candidate mention(s). Each needs a human read: shield (delete), legitimate instruction (keep), or narration of a removed clause (delete — that is the bug).`);
console.log("A prohibition stated as a live instruction is FINE and is not matched here; this sweep only flags prohibitions being TALKED ABOUT.");