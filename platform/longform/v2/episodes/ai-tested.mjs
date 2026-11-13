// AI Tested long-form sample: "At What Size Does AI Multiplication Break? We Tested It". The evidence is our own test, run on GitHub
// Actions (platform/longform/experiments/multiply.mjs; .github/workflows/longform-experiment.yml): the same 115 seeded problems sent to every
// model that answered on the day, every reply marked by BigInt code. Raw replies: data/longform/ai-tested/multiply-run1.json, -run2.json.
// Limits, shown in the verdict scene: two small "Lite" models completed the test; the biggest model we tried ran out of free quota after a
// few answers; ten problems per size (five for "show your working"); one attempt each at temperature 0; results can change with versions.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const run = (n) => JSON.parse(readFileSync(join(ROOT, `data/longform/ai-tested/multiply-run${n}.json`), "utf8"));
const R1 = run(1), R2 = run(2), M35 = R1.models.find((m) => m.id === "gemini-3.5-flash-lite"), M31 = R2.models.find((m) => m.id === "gemini-3.1-flash-lite"), GEM = R2.models.find((m) => m.id === "gemma-4-26b-a4b-it");
const direct = (m, n) => m.answers.filter((a) => a.mode === "direct" && a.digits === n), worked = (m, n) => m.answers.filter((a) => a.mode === "worked" && a.digits === n);
const pct = (xs) => Math.round((xs.filter((a) => a.ok).length / xs.length) * 100);
const sizes = [2, 3, 4, 5, 6, 7, 8, 9, 10], big = [6, 7, 8, 9, 10];
const miss10 = direct(M35, 10).find((a) => !a.ok), miss8 = direct(M31, 8).find((a) => !a.ok), ok2 = direct(M31, 2)[0], w8 = worked(M31, 8).find((a) => a.ok);
const caps = JSON.parse(readFileSync(join(ROOT, "src/skills/remotion-render/public/lf2/ai-tested/gemini-models.json"), "utf8"));
const S2 = 2, r31 = caps.rects["Gemini 3.1 Flash-Lite"][0], r35 = caps.rects["Gemini 3.5 Flash"][0];
const rect = (r, wOverride) => [{ x: r.x * S2, y: r.y * S2, w: (wOverride || r.w) * S2, h: r.h * S2 }];
const SET = (m, mode) => [["model", m.id], ["temperature", "0"], ["attempts", "1 per problem"], ["format", mode === "worked" ? "steps, then ANSWER:" : "number only"], ["marked by", "BigInt code"]];
const tail = (s, n) => s.split("\n").filter((l) => l.trim()).slice(-n).join("\n");

export const SOURCES = {
  RUN1: { title: "AI Tested multiplication test, run 1 (GitHub Actions)", url: R1.run_url, date: R1.date, file: "data/longform/ai-tested/multiply-run1.json" },
  RUN2: { title: "AI Tested multiplication test, run 2 (GitHub Actions)", url: R2.run_url, date: R2.date, file: "data/longform/ai-tested/multiply-run2.json" },
  FF: { title: "Dziri et al. (2023), Faith and Fate: Limits of Transformers on Compositionality (arXiv 2305.18654, NeurIPS 2023)", url: "https://arxiv.org/abs/2305.18654" },
  MODELS: { title: "Google AI Studio: Models (captured 13 Nov 2026)", url: "https://aistudio.google.com/docs/models" },
};
const PILL = "MULTIPLICATION TEST";
// On-screen footers name the run by number only (no account or repository name in the picture).
const RUN1 = `test run 1 · GitHub Actions run ${R1.run_url.split("/").pop()} · ${R1.date.slice(0, 10)}`, RUN2 = `test run 2 · GitHub Actions run ${R2.run_url.split("/").pop()} · ${R2.date.slice(0, 10)}`;

export const EPISODE = {
  channel: "ai-tested", slug: "multiplication", title: "At What Size Does AI Multiplication Break? We Tested It", target_minutes: 9,
  beats: [
    { id: "A01", part: "cold open", ref: "AI Search: open on the result itself, real output on screen", src: ["RUN1"], frames: [30, 90],
      vo: `We asked an AI model to multiply two ten-digit numbers. It answered instantly, with the right number of digits, and the first four of them right. Everything after that was wrong.`,
      scene: { type: "miss", a: miss10.a, b: miss10.b, answer: miss10.answer, correct: miss10.correct, model: M35.id, lead: "One reply from our test", pill: PILL, foot: RUN1 } },
    { id: "A02", part: "cold open", ref: "cUeZMUGCxrw: the result next to the settings that produced it", src: ["RUN2"], frames: [70],
      vo: "With small numbers, the same kind of model is perfect. So where does it break? We sent a hundred and fifteen multiplications to every model we could reach, and checked every answer with code.",
      scene: { type: "chat", model: M31.id, settings: SET(M31, "direct"), prompt: `What is ${ok2.a} × ${ok2.b}? Reply with only the number, no words and no working.`, reply: ok2.reply, correct: ok2.correct, answer: ok2.answer, ok: ok2.ok, pill: PILL, foot: RUN2 } },
    { id: "A03", part: "cold open", ref: "tDWtcyeNNew: chart with the result drawn on", src: ["RUN1", "RUN2"], frames: [150],
      vo: "This is the short answer. At two digits, both models got everything right. By six digits, neither got a single one.",
      scene: { type: "accuracy", title: "Right answers, by size of the numbers", sub: "Answer only, no working · 10 problems per size", xLabel: "digits in each number", pill: PILL, foot: "runs 43343589332 and 43346149304",
        series: [{ name: "3.5 Flash-Lite", points: sizes.map((n) => [n, pct(direct(M35, n))]), color: "#FF4D5E" }, { name: "3.1 Flash-Lite", points: sizes.map((n) => [n, pct(direct(M31, n))]), color: "#2BD9FE", lift: 22, dy: 30 }] } },
    { id: "A04", part: "the test", ref: "h5zkzon0gM4: explainer diagram after the demo", src: ["RUN1"], frames: [130],
      vo: "Here is how the test worked. A fixed seed generated pairs of random numbers from two to ten digits long, ten pairs at each size. Every model got the identical prompt. Code worked out the exact product, and a reply was right only if it matched every digit.",
      scene: { type: "flow", title: "How the test works", pill: PILL, steps: [{ title: "Seeded numbers", text: "Pairs of random 2- to 10-digit numbers; 10 per size; the same for every model." }, { title: "One prompt", text: "\"Reply with only the number.\" Temperature 0, one attempt." }, { title: "Exact answer", text: "Computed in code with BigInt, so no rounding." }, { title: "Marked", text: "Right only if every digit matches. Every reply is kept." }] } },
    {id: "A04b",part: "the test",ref: "Our method card: what counts as right",src: ["RUN1"],frames: [130],vo: "Two rules kept the test fair. First, one attempt per problem at temperature zero, the setting that makes a model pick its most likely answer, so nothing was retried until it came out right. Second, an answer was only right if every digit matched. A reply with one wrong digit in the middle counts as wrong, because in a bank statement or a spreadsheet it would be.",scene: {type: "flow",title: "The two rules",pill: "MULTIPLICATION TEST",steps: [{title: "One attempt",text: "Temperature 0. No retries, except on a network error."},{title: "Every digit",text: "Partly right is wrong. Code compares the full number."},{title: "Every reply kept",text: "Raw replies are stored with the run, so any result can be checked."}]}},
    { id: "A05", part: "the test", ref: "1Aqhg0FVm-w: the real page, pushed in, a highlight box on the line under discussion", src: ["MODELS"], frames: [20, 110],
      vo: "Two models finished the whole test: Google's Gemini 3.5 Flash-Lite and 3.1 Flash-Lite, the small, fast end of the Gemini range. The larger 3.5 Flash ran out of free quota after a few answers, so it is not in the results.",
      scene: { type: "browser", image: { file: "lf2/ai-tested/gemini-models-2.jpg", w: 2880, h: 1800 }, url: "aistudio.google.com/docs/models", pill: "MODELS TESTED", foot: "Captured 13 Nov 2026 with Playwright (platform/longform/v2/capture.mjs)",
        cam: [{ f: 0, x: 1440, y: 900, zoom: 1760 / 2880 }, { f: 60, x: 1000, y: 1250, zoom: 1.05 }], boxes: [{ rects: rect(r35, 150), from: 50, label: "Tested · run 1" }, { rects: rect(r31), from: 80, label: "Tested · run 2" }],
        cursor: [{ f: 30, x: 1700, y: 1600 }, { f: 75, x: 1290, y: 1420, click: true }] } },
    { id: "A06", part: "the test", ref: "Real terminal output, typed as run (terminal-inserts skill)", src: ["RUN2"], frames: [200],
      vo: "This is the runner's own log from the second run. Every model the key could reach was tried. Some refused with errors or quota limits. What finished is what we report.",
      scene: { type: "terminal", title: "github actions · longform-experiment · run 2", command: "node platform/longform/experiments/multiply.mjs output/longform-experiment/multiply.json", pill: PILL, foot: RUN2,
        output: [{ text: "models: gemini-3.5-flash, gemini-2.5-flash, gemma-4-26b-a4b-it, gemma-4-31b-it, gemini-3.1-flash-lite, ..." }, { text: "gemini-3.5-flash DROPPED: no Gemini key left for this model after 2 answers", color: "#FF4D5E" }, { text: "gemini-2.5-flash DROPPED: HTTP 404 after 0 answers", color: "#FF4D5E" }, { text: "gemma-4-26b-a4b-it complete", color: "#FFD23F" }, { text: "gemma-4-31b-it DROPPED: HTTP 500 after 23 answers", color: "#FF4D5E" }, { text: "gemini-3.1-flash-lite complete", color: "#2FBF71", bold: true }] } },
    { id: "A07", part: "where it breaks", ref: "Our grid: every single answer shown, nothing averaged away", src: ["RUN2"], frames: [100],
      vo: "Here is every answer from 3.1 Flash-Lite. Green is right, red is wrong. Ten out of ten at two digits. Eight at three and at four. One at five. From six digits on, nothing.",
      scene: { type: "grid", title: "3.1 Flash-Lite · every answer · number only", pill: PILL, foot: RUN2, rows: sizes.map((n) => ({ label: `${n} digits`, cells: direct(M31, n).map((a) => a.ok) })) } },
    { id: "A08", part: "where it breaks", ref: "cUeZMUGCxrw: the reply beside its settings; our digit-by-digit check", src: ["RUN2"], frames: [150],
      vo: "And the wrong answers are not random. This eight-digit product has sixteen digits, and so does the model's answer. The first four digits are right. Then it drifts.",
      scene: { type: "chat", model: M31.id, settings: SET(M31, "direct"), prompt: `What is ${miss8.a} × ${miss8.b}? Reply with only the number, no words and no working.`, reply: miss8.reply, correct: miss8.correct, answer: miss8.answer, ok: false, pill: PILL, foot: RUN2 } },
    { id: "A09", part: "where it breaks", ref: "Our measurement, stated with its count", src: ["RUN1", "RUN2"], frames: [60],
      vo: "That pattern held across the board. Of the hundred wrong answers at six digits and above, from both models, every single one had exactly the right length. And in eighty-two of them, at least the first four digits were right too.",
      scene: { type: "verdict", line: "100 wrong answers. All 100 had the right number of digits.", points: ["Both models, 6 to 10 digits, answer only", "82 of 100 had at least the first 4 digits right"], limits: ["Counted by code from the raw replies in run 1 and run 2", "Two models; 50 wrong answers each at 6+ digits"], pill: PILL } },
    {id: "A09b",part: "where it breaks",ref: "Explainer after the demo (h5zkzon0gM4), with a published source",src: ["FF"],frames: [130],vo: "Why would a model that writes fluent essays fail at long multiplication? Researchers have studied exactly this. A 2023 paper called Faith and Fate tested large language models on multi-digit multiplication and other step-by-step problems. Its authors concluded that the models tend to solve them by matching patterns they have seen, rather than by carrying out the procedure, and that accuracy can drop quickly as the number of steps grows. Long multiplication has a lot of steps.",scene: {type: "flow",title: "What researchers found (Dziri et al., 2023)",pill: "WHY IT BREAKS",foot: "arXiv 2305.18654 · Faith and Fate: Limits of Transformers on Compositionality",steps: [{title: "Many steps",text: "Multi-digit multiplication is a chain of partial products and carries."},{title: "Pattern matching",text: "Models tend to match familiar sub-patterns rather than run the procedure."},{title: "Errors compound",text: "The more steps, the faster accuracy decays."}]}},
    { id: "A10", part: "the fix", ref: "cUeZMUGCxrw: the same task under two settings, side by side, column titles", src: ["RUN1", "RUN2"], frames: [110],
      vo: "Then we asked the same questions again, but let the model show its working. Same problems, five per size from six digits up. The difference is enormous.",
      scene: { type: "compare", title: "3.1 Flash-Lite · the same 25 problems, two ways", pill: PILL, foot: RUN2, cols: [
        { title: "Number only", prompt: "\"Reply with only the number.\"", rows: big.map((n) => ({ label: `${n} digits`, right: direct(M31, n).slice(0, 5).filter((a) => a.ok).length, of: 5 })) },
        { title: "Show your working", prompt: "\"Work it out step by step, then ANSWER: <number>\"", best: true, rows: big.map((n) => ({ label: `${n} digits`, right: M31.worked[n].right, of: M31.worked[n].of })) }] } },
    { id: "A11", part: "the fix", ref: "cUeZMUGCxrw: the real reply shown in full beside its settings", src: ["RUN2"], frames: [200],
      vo: "This is what working looks like: the model breaks the problem into partial products, adds them up, and gets all sixteen digits right.",
      scene: { type: "chat", model: M31.id, settings: SET(M31, "worked"), prompt: `What is ${w8.a} × ${w8.b}? Work it out step by step, then give the final answer on the last line as: ANSWER: <number>`, reply: tail(w8.reply, 9), correct: w8.correct, answer: w8.answer, ok: true, pill: PILL, foot: `${RUN2} · last lines of the reply` } },
    { id: "A12", part: "the fix", ref: "tDWtcyeNNew: two lines, the better one outlined", src: ["RUN1", "RUN2"], frames: [160],
      vo: "With working, 3.1 Flash-Lite got twenty-one of twenty-five right at six digits and above, and 3.5 Flash-Lite got thirteen. Without working, both got none of the same problems.",
      scene: { type: "accuracy", title: "With working vs number only (6–10 digits)", sub: "5 problems per size; the same problems in both conditions", xLabel: "digits in each number", pill: PILL, foot: "runs 43343589332 and 43346149304",
        series: [{ name: "Number only", points: big.map((n) => [n, pct(direct(M31, n).slice(0, 5))]), color: "#FF4D5E" }, { name: "3.5 · working", points: big.map((n) => [n, Math.round((M35.worked[n].right / 5) * 100)]), color: "#cfd5dd", dy: 30 }, { name: "3.1 · working", points: big.map((n) => [n, Math.round((M31.worked[n].right / 5) * 100)]), color: "#2BD9FE", best: true, lift: 24, dy: -12 }] } },
    {id: "A12b",part: "the fix",ref: "Our grid: every answer, the same problems with working",src: ["RUN2"],frames: [100],vo: "Here are those same twenty-five problems for 3.1 Flash-Lite, answered with working. Every one of the six- and seven-digit products is right. It starts to slip at eight digits, and at ten it gets three of five. Showing the steps does not make the model perfect. It makes the model do the procedure, and the procedure works far more often than the guess.",scene: {type: "grid",title: "3.1 Flash-Lite · with working · same problems",pill: "MULTIPLICATION TEST",foot: RUN2,rows: big.map((n) => ({ label: `${n} digits`, cells: worked(M31, n).map((a) => a.ok) }))}},
    { id: "A13", part: "a different failure", ref: "Reply beside its settings; our format check", src: ["RUN2"], frames: [200],
      vo: "One model failed in a different way. Gemma 4, Google's open model, was told to reply with only the number. In all ninety cases it wrote other text, usually its working, instead, so by the test's rule every answer counts as wrong. That is a test of following instructions, not of arithmetic, and we report it separately.",
      scene: { type: "chat", model: GEM.id, settings: SET(GEM, "direct"), prompt: `What is ${direct(GEM, 2)[0].a} × ${direct(GEM, 2)[0].b}? Reply with only the number, no words and no working.`, reply: direct(GEM, 2)[0].reply, correct: direct(GEM, 2)[0].correct, answer: direct(GEM, 2)[0].answer, ok: false, pill: "FORMAT FAILURE", foot: `${RUN2} · reply cut at 200 characters when stored` } },
    { id: "A14", part: "verdict", ref: "Verdict with its limits listed, so the claim does not grow", src: ["RUN1", "RUN2"], frames: [90],
      vo: "So, the verdict. Asked for just the number, these small models are perfect at two digits, start slipping at three and four, and get nothing right at six and above. Let them show their working and most of that accuracy comes back. If you need exact arithmetic from a model like these, ask for the steps.",
      scene: { type: "verdict", line: "Number only: perfect at 2 digits, zero from 6. With working: mostly right up to 10.", points: ["0 of 50 right at 6–10 digits, number only (each model)", "21 of 25 (3.1) and 13 of 25 (3.5) with working"], limits: ["Two small \"Lite\" models finished; larger models hit quota or errors", "10 problems per size (5 with working); one attempt each", "Run on 13 Nov 2026; model versions change"], pill: "VERDICT" } },
  ],
  transitions: [
    { name: "tx1-miss-to-chat", a: "A01", b: "A02", kind: "blurwhip", dir: "left", dur: 12, aAt: 110, note: "blur whip from the wrong digits to the clean 2-digit answer" },
    { name: "tx2-browser-push", a: "A05", b: "A06", kind: "push", dir: "up", dur: 14, aAt: 120, note: "page pushes up into the terminal" },
    { name: "tx3-grid-to-chat", a: "A07", b: "A08", kind: "zoomthrough", dur: 18, aAt: 110, note: "zoom through the red cells into one wrong reply" },
  ],
  thumbs: [
    { name: "thumb1-wrong", big: "AI can't\nmultiply?", small: "WRONG", a: miss8.a, b: miss8.b, answer: miss8.answer, correct: miss8.correct },
    { name: "thumb2-digits", big: "Breaks at\n6 digits", small: "0 / 50", ...(({ a, b, answer, correct }) => ({ a, b, answer, correct }))(direct(M35, 6).find((x) => !x.ok)) },
    { name: "thumb3-fix", big: "The fix:\nshow working", small: "21 / 25", a: w8.a, b: w8.b, answer: w8.answer, correct: w8.correct },
  ],
};
