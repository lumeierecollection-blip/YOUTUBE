// AI Tested long form: "Gemini 4 Hydrogen Can Multiply 10-Digit Numbers. Here's the Proof". Chosen with the topic gate in docs/longform/CONTENT-SPEC.md: the trigger is a model that appeared on our API key
// this week (gemini-4-hydrogen; model list of 14 Nov 2026, platform/longform/experiments/list-models.mjs), the stake is "does the newest model still fail at arithmetic", the proof is our own test
// (ninety multiplications, every digit marked by BigInt code, every reply kept), and the winners in this niche are newest-model titles with a verdict (AI Search: "GPT-5 is a freak", "Deepseek strikes again").
// Visual identity: AI Search, "AI is reverse engineering everything" (h5zkzon0gM4, the highest-viewed fixed reference): the result first, the real prompt and reply on screen, counted results.
// Every number is COUNTED FROM the stored records and the module refuses to load if a claim in the script does not match them: data/longform/ai-tested/gemini4-hydrogen-run1-4096tokens.json (this run) and
// data/longform/ai-tested/multiply-run2.json (the earlier run on the same 115 problems: the test seed is fixed, and the module checks that the problems are identical).
// KNOWN LIMITS, shown on screen and in the description: the run used a 4,096-token output limit; two replies came back empty (no answer, not a wrong number); the "show your working" round was cut off by that
// limit and is NOT reported; one run at temperature 0; Gemini 4 Carbon and Argon could not be tested (HTTP 429, no quota on our key) and Gemini 3.8 Flash (HTTP 503).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const J = (f) => JSON.parse(readFileSync(join(ROOT, `data/longform/ai-tested/${f}`), "utf8"));
const run1 = J("gemini4-hydrogen-run1-4096tokens.json"), earlier = J("multiply-run2.json");
const H = run1.models.find((m) => m.id === "gemini-4-hydrogen"), O = earlier.models.find((m) => m.id === "gemini-3.1-flash-lite");
const key = (a) => `${a.mode}${a.digits}:${a.a}x${a.b}`;
const hm = new Map(H.answers.map((a) => [key(a), a]));
const need = (cond, msg) => { if (!cond) throw new Error(`gemini4 episode: ${msg}`); };
// same problems for both models, or the comparison is not allowed
need(O.answers.every((a) => hm.get(key(a))?.correct === a.correct), "the two runs did not use the same problems");

const directH = H.answers.filter((a) => a.mode === "direct"), directO = O.answers.filter((a) => a.mode === "direct");
const right = (rows, lo, hi) => rows.filter((a) => a.digits >= lo && a.digits <= hi && a.ok).length, count = (rows, lo, hi) => rows.filter((a) => a.digits >= lo && a.digits <= hi).length;
const empties = directH.filter((a) => !a.reply);
const H_all = right(directH, 2, 10), H_small = right(directH, 2, 5), H_big = right(directH, 6, 10), O_small = right(directO, 2, 5), O_big = right(directO, 6, 10);
need(H.complete && directH.length === 90, "the run is not complete");
need(H_all === 88 && empties.length === 2 && H_big === 48 && count(directH, 6, 10) === 50 && H_small === 40, `counts changed: ${H_all}, ${empties.length}, ${H_big}, ${H_small}`);
need(O_big === 0 && count(directO, 6, 10) === 50 && O_small === 27, `earlier-model counts changed: ${O_big}, ${O_small}`);
need(directH.filter((a) => !a.ok).every((a) => !a.reply), "a miss is a wrong number, not an empty reply; the script says all misses were empty replies");

const ex = directO.filter((a) => a.digits === 10 && !a.ok).map((a) => ({ o: a, h: hm.get(key(a)) })).find((x) => x.h && x.h.ok);
need(ex, "no 10-digit example where the older model missed and Gemini 4 was right");
const lead = [...ex.o.answer].findIndex((c, i) => c !== ex.o.correct[i]);
need(lead === 4 && ex.o.answer.length === ex.o.correct.length, `the older model's example does not match the script: ${lead}`);
need(ex.h.reply === ex.h.correct && ex.h.correct.length === 20, "Hydrogen's example is not 20 matching digits");
const foot1 = `GitHub Actions run ${String(run1.run_url).split("/").pop()} · ${String(run1.date).slice(0, 10)}`, foot0 = `GitHub Actions run ${String(earlier.run_url).split("/").pop()} · ${String(earlier.date).slice(0, 10)}`;
const SET = (m, extra = []) => [["model", m], ["temperature", "0"], ["mode", "number only"], ...extra];
const sizes = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const cellsOf = (d) => d.cells;

export const SOURCES = {
  H1: { title: "AI Tested multiplication test on Gemini 4 Hydrogen (GitHub Actions)", url: run1.run_url, retrieved: String(run1.date).slice(0, 10) },
  R2: { title: "AI Tested multiplication test, earlier run on Gemini 3.1 Flash-Lite, same 115 problems (GitHub Actions)", url: earlier.run_url, retrieved: String(earlier.date).slice(0, 10) },
  MODELS: { title: "Google AI Studio model list (models reachable on our key, 14 Nov 2026)", url: "https://ai.google.dev/gemini-api/docs/models", retrieved: "2026-11-14" },
};

export const EPISODE = {
  channel: "ai-tested", slug: "gemini4-multiply", title: "Gemini 4 Hydrogen Can Multiply 10-Digit Numbers. Here's the Proof", target_minutes: 4,
  beats: [
    { id: "G01", part: "cold open", ref: "h5zkzon0gM4: open on the result itself, a pill naming the test", src: ["H1"], frames: [200],
      vo: "Google's new Gemini 4 Hydrogen got almost every multiplication we gave it right, with no working shown, including ten-digit numbers times ten-digit numbers. We gave it ninety multiplications, from two digits to ten, and checked every digit with code. It got eighty-eight right. The other two came back empty.",
      scene: { type: "grid", title: "Gemini 4 Hydrogen · every answer · number only", pill: "NEW MODEL TEST", foot: `${foot1} · the 2 red cells are empty replies, not wrong digits`, rows: sizes.map((n) => ({ label: `${n} digits`, cells: directH.filter((a) => a.digits === n).map((a) => a.ok) })) } },
    { id: "G02", part: "cold open", ref: "h5zkzon0gM4: how the test works, in one diagram", src: ["H1", "R2"], frames: [200],
      vo: "Here is how the test worked. Ten problems at every size from two digits to ten. One attempt each, at temperature zero, answering with only the number. Code worked out the exact product, and a reply counted as right only if every digit matched.",
      scene: { type: "flow", title: "The test", pill: "HOW IT WAS MARKED", foot: "The same 115 problems were given to the earlier models", steps: [{ title: "Random pairs", text: "Ten per size, two to ten digits, from a fixed seed" }, { title: "One question", text: "“Reply with only the number.” One attempt, temperature 0" }, { title: "Marked by code", text: "The exact product is computed; every digit must match" }, { title: "Every reply kept", text: "The raw reply is stored with the run" }] } },
    { id: "G03", part: "the result", ref: "cUeZMUGCxrw: the same problems under two conditions, side by side", src: ["H1", "R2"], frames: [200],
      vo: `Now the comparison. Our earlier run on the small model Gemini 3.1 Flash-Lite got ${say(O_small)} of the first forty right, and then, from six digits up, none of fifty. Gemini 4 Hydrogen got all forty of the short ones, and ${say(H_big)} of the fifty from six to ten digits.`,
      scene: { type: "compare", title: "Same problems, two models", pill: "SAME 90 QUESTIONS", foot: `${foot1} · ${foot0}`, cols: [{ title: "Gemini 3.1 Flash-Lite (earlier run)", prompt: "Reply with only the number", best: false, rows: [{ label: "2 to 5 digits", right: O_small, of: 40 }, { label: "6 to 10 digits", right: O_big, of: 50 }] }, { title: "Gemini 4 Hydrogen", prompt: "Reply with only the number", best: true, rows: [{ label: "2 to 5 digits", right: H_small, of: 40 }, { label: "6 to 10 digits", right: H_big, of: 50 }] }] } },
    { id: "G04", part: "the result", ref: "cUeZMUGCxrw: the real prompt and the real reply", src: ["H1", "R2"], frames: [200],
      vo: `Here is one question both models got: a ten-digit number times another ten-digit number, shown on screen. The older model answered with the right number of digits, and the first four of them right. Everything after that was wrong.`,
      scene: { type: "miss", a: ex.o.a, b: ex.o.b, answer: ex.o.answer, correct: ex.o.correct, model: O.id, lead: "Gemini 3.1 Flash-Lite, same question", pill: "THE OLDER MODEL", foot: foot0 } },
    { id: "G05", part: "the result", ref: "cUeZMUGCxrw: the result next to the settings that produced it", src: ["H1"], frames: [220],
      vo: "Gemini 4 Hydrogen was asked exactly the same thing. It replied with the number and nothing else, and every one of its twenty digits matched.",
      scene: { type: "chat", model: H.id, settings: SET(H.id, [["max output", "4,096 tokens"]]), prompt: `What is ${ex.o.a} × ${ex.o.b}? Reply with only the number, no words and no working.`, reply: ex.h.reply, correct: ex.h.correct, answer: ex.h.answer, ok: true, pill: "GEMINI 4 HYDROGEN", foot: foot1 } },
    { id: "G06", part: "the limits", ref: "h5zkzon0gM4 13:08: the closing section; the verdict states its own limits", src: ["H1", "R2", "MODELS"], frames: [200],
      vo: "So, can it multiply? On this test, yes: eighty-eight of ninety right, and none of the misses was a wrong number. But this is one run, at temperature zero. Two replies came back empty. Our output limit cut off the round where we asked it to show its working, so we are not reporting that round. And Gemini 4 Carbon and Argon would not answer at all, because our key had no quota for them.",
      scene: { type: "verdict", line: "On this test, it can multiply.", points: [`${say(H_all)} of ninety right, number only`, `${say(H_big)} of fifty from six to ten digits`, `The earlier small model: none of fifty from six digits`, "No reply was a wrong number: the two misses were empty"], limits: ["One run, temperature 0, answer only", "4,096-token output limit; 2 replies came back empty", "The “show your working” round was cut off: not reported", "Carbon and Argon: no quota on our key (HTTP 429)", "Arithmetic only, not other tasks"], pill: "VERDICT", foot: "Source runs listed in the description" } },
  ],
  transitions: [
    { name: "tx1-grid-to-flow", a: "G01", b: "G02", kind: "push", dur: 14, aAt: 240, note: "push from the result to how it was marked" },
    { name: "tx2-miss-to-chat", a: "G04", b: "G05", kind: "blurwhip", dur: 12, aAt: 200, note: "blur whip from the older model's wrong digits to the new model's right ones" },
    { name: "tx3-compare-to-miss", a: "G03", b: "G04", kind: "dissolve", dur: 14, aAt: 200, note: "the counts dissolve into one real question" },
  ],
  thumbs: [
    { name: "thumb1-gemini4", big: "Gemini 4\nCan Multiply", num: H_big, of: count(directH, 6, 10), numLabel: "products right, 6 to 10 digits", small: "vs 0 of 50" },
    { name: "thumb2-before-after", big: "0 of 50\n→ 48 of 50", num: H_all, of: 90, numLabel: "right, number only", small: "new model" },
    { name: "thumb3-ten-digit", big: "Ten digits.\nEvery one.", num: 20, of: 20, numLabel: "digits right in one answer", small: "Gemini 4" },
  ],
};

function say(n) { const w = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five", "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty", "thirty-one", "thirty-two", "thirty-three", "thirty-four", "thirty-five", "thirty-six", "thirty-seven", "thirty-eight", "thirty-nine", "forty"]; if (n <= 40) return w[n]; const tens = { 4: "forty", 5: "fifty", 6: "sixty", 7: "seventy", 8: "eighty", 9: "ninety" }, t = Math.floor(n / 10), u = n % 10; return u ? `${tens[t]}-${w[u]}` : tens[t]; }
