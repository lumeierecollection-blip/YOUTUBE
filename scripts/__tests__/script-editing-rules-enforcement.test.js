// Which short-video-scripter / yt-hook-scripter rules the pipeline enforces in code, and which it only asks for in
// prompts/write-script.md. These tests pin the CURRENT state so a change to it is deliberate. They do not add gates:
// a new blocker would raise the script rejection rate, which is already the problem being recovered from.
//
//   Enforced as a BLOCKER:   SCR-16 duration; SCR-17 STRICT (ch-02, ch-48 only); SCR-18 near-miss names.
//   Enforced as a MAJOR:     SCR-17 soft (non-rejecting: gate-script runs without --strict in daily-pipeline-v2.yml).
//   Prompt-only (no code):   hook 9-12 words, re-hook flip, payoff sentence count, close echoes the hook,
//                            first setup sentence proves the hook, escalation, one idea per sentence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { wordsOnlyShare } from "../gate-script.js";
import { strictUngroundableSentences } from "../strict-visual.mjs";

const gate = readFileSync(new URL("../gate-script.js", import.meta.url), "utf8");
const gateCode = gate.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const schema = JSON.parse(readFileSync(new URL("../../schemas/script.directed.json", import.meta.url), "utf8"));
const prompt = readFileSync(new URL("../../prompts/write-script.md", import.meta.url), "utf8");

test("the hook rules the prompt states are present in the prompt", () => {
  assert.match(prompt, /HOOK:\s+9.12 words/);
  assert.match(prompt, /RE-HOOK:\s+9.14 words/);
  assert.match(prompt, /Close on the loop or the act/);
});

test("KNOWN LIMIT: the hook word count is not gated; the schema bounds it only in characters", () => {
  assert.equal(schema.properties.hook.minLength, 30);
  assert.equal(schema.properties.hook.maxLength, 220);
  assert.equal(schema.properties.hook.minWords, undefined);
  assert.doesNotMatch(gateCode, /hook/i, "if a hook word-count check is added, replace this test with positive and negative cases");
});

test("KNOWN LIMIT: nothing checks that the close echoes the hook or that the first setup sentence proves it", () => {
  assert.doesNotMatch(gateCode, /rehook|re-hook|echo/i);
});

test("SCR-17 soft: a run of abstract sentences is measured, and a figure, date or mid-sentence name counts as showable", () => {
  const vague = [{ voiceover: "That changes everything. It really matters. Nobody saw it coming. Things got worse." }];
  const v = wordsOnlyShare(vague);
  assert.deepEqual([v.bare.length, v.run], [4, 4]);
  const shown = [{ voiceover: "Banks held $352 million. Then Powell raised rates. It ended in March. Nobody saw it." }];
  assert.deepEqual(wordsOnlyShare(shown).bare, ["Nobody saw it."]);
});

test("SCR-17 soft is a MAJOR, never a blocker, for a channel without strict_visual", () => {
  const block = gate.slice(gate.indexOf("SCR-17 (soft)"), gate.indexOf("SCR-17 STRICT"));
  assert.match(block, /majors\.push\(`SCR-17/);
  assert.doesNotMatch(block, /blockers\.push/);
});

test("SCR-17 STRICT is a blocker and only runs for strict_visual channels", () => {
  const i = gate.indexOf("if (channel.strict_visual)");
  assert.ok(i > 0);
  assert.match(gate.slice(i, i + 700), /blockers\.push\(\s*`SCR-17 STRICT/);
});

test("SCR-17 STRICT rejects an abstract sentence and accepts one that grounds a figure", () => {
  const bad = ["The platform simply works better this way.", "It keeps going."];
  const good = "In 2026 the team shipped it.";
  assert.deepEqual(strictUngroundableSentences([...bad, good]), bad);
});

test("KNOWN LIMIT: a feeling-hook that happens to contain a mid-sentence capital passes SCR-17 soft", () => {
  // The heuristic cannot tell a drawable name from a capitalised word, so "what Apple did will terrify you" counts as showable.
  const feeling = [{ voiceover: "You will not believe what Apple did next." }];
  assert.equal(wordsOnlyShare(feeling).bare.length, 0);
});
