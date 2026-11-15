// AI Tested long-form REBUILD, 15 Nov 2026: "The Most Accurate AI Still Guesses When It Doesn't Know".
// Replaces ai-tested-ai-bubble (owner: "just one page and there's no movement or motion"; its reference, How Money Works WXV9emaUeo0, was the wrong kind of video).
// CLONE of AI Search, "Claude Fable 5.2 is on steroids" (S7lpCyZSdJQ, 388k views, 4 days old at selection; faceless model test):
//   measured 1,966 s, 165 hard cuts, median shot 4.2 s (output/fresh-cycle-2026-11-14/rebuild/ai/CLONE-SPEC.md).
//   Its order, kept: hook "they just dropped a new model" + promise (specs, cost, benchmarks) -> what it can do -> the official page with lines
//   highlighted -> the claimed breakthroughs (Fermat, devices, robots, physics) -> the self-reported table -> the independent Artificial Analysis
//   numbers (cost per task, time per task, Omniscience accuracy and hallucination rate) -> verdict -> where the limits are -> comment question.
// Not copied: its own hands-on demos (we did not run the model; we show what the two sources report instead), its sponsor read, Anthropic's videos.
// Rhythm: every beat is a Seq of one-sentence shots (hard cuts), so the picture changes every 3-5 s; page shots scroll, push in and draw a box.
// Facts: ONLY from two pages fetched and captured 15 Nov 2026 (Playwright, platform/longform/v2/capture.mjs; jobs and raw captures in
// output/fresh-cycle-2026-11-14/rebuild/ai/cap, page text in .../rebuild/ai/src):
//   AN = Anthropic's launch post (company-reported; every figure from it is said to be Anthropic's), AA = Artificial Analysis model page and
//   AA-Omniscience page (independent benchmark). The 59% / 11% / 70% / 50% hallucination-rate bars were read off AA's rendered chart (aao-1.png).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const R = JSON.parse(readFileSync(join(ROOT, "data/longform/ai-tested/fable52/rects.json"), "utf8"));
const IW = 2560, IH = 2880, VW = 1760, VH = 900, FIT = VW / IW;
const URL = { anth: "anthropic.com/news/claude-fable-and-mythos-5-2", aam: "artificialanalysis.ai/models/claude-fable-5-2", aao: "artificialanalysis.ai/evaluations/omniscience" };
const FAN = "Source: Anthropic launch post, 9 Nov 2026 (company-reported) · captured 15 Nov 2026", FAA = "Source: Artificial Analysis (independent benchmark) · captured 15 Nov 2026";
const clampC = (c, z) => ({ x: Math.min(Math.max(c.x, VW / 2 / z), IW - VW / 2 / z), y: Math.min(Math.max(c.y, VH / 2 / z), IH - VH / 2 / z) });
const box = (rects) => { const x0 = Math.min(...rects.map((r) => r.x)), x1 = Math.max(...rects.map((r) => r.x + r.w)), y0 = Math.min(...rects.map((r) => r.y)), y1 = Math.max(...rects.map((r) => r.y + r.h)); return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0 }; };
const pageOf = (file) => (file.includes("-aam-") ? "aam" : file.includes("-aao-") ? "aao" : "anth");

/** A captured page: it scrolls to the line (camera travels down or up the capture), pushes in, the box draws, then a slow drift keeps it moving. */
function page(keys, labels = [], zoom) {
  keys = [].concat(keys);
  const file = R[keys[0]].file, all = keys.flatMap((k) => R[k].rects), c = box(all), z = zoom || Math.min(1.25, Math.max(FIT * 1.15, (VW * 0.8) / c.w));
  const startY = c.y > IH / 2 ? VH / 2 / FIT : IH - VH / 2 / FIT, a = clampC({ x: IW / 2, y: startY }, FIT), b = clampC({ x: IW / 2, y: c.y }, FIT), d = clampC(c, z), e = clampC(c, z * 1.1);
  return { type: "browser", image: { file, w: IW, h: IH }, url: URL[pageOf(file)], foot: pageOf(file) === "anth" ? FAN : FAA,
    cam: [{ f: 0, ...a, zoom: FIT }, { f: 34, ...b, zoom: FIT }, { f: 60, ...d, zoom: z }, { f: 330, ...e, zoom: z * 1.1 }],
    boxes: keys.map((k, i) => ({ rects: R[k].rects, from: 50 + i * 40, label: labels[i] })) };
}
/** A page with no line to mark: a scroll over the capture (used to show where on the page we are). */
const scroll = (file, down = true) => ({ type: "browser", image: { file: `lf2/ai-tested/f52-${file}.jpg`, w: IW, h: IH }, url: URL[pageOf(file)], foot: pageOf(file) === "aao" || pageOf(file) === "aam" ? FAA : FAN,
  cam: [{ f: 0, x: IW / 2, y: down ? VH / 2 / FIT : IH - VH / 2 / FIT, zoom: FIT }, { f: 150, x: IW / 2, y: down ? IH - VH / 2 / FIT : VH / 2 / FIT, zoom: FIT * 1.06 }] });
const P = (vo, scene) => ({ vo, scene });
/** Second shot of a long page sentence: a hard cut to a tight, slowly drifting close-up of the marked line (the reference cuts in on highlights the same way). */
const closeup = (sc) => { const k = sc.cam[2], bw = box(sc.boxes.flatMap((b) => b.rects)).w, z = Math.max(k.zoom, Math.min(1.9, k.zoom * 1.6, (VW * 0.9) / (bw + 40))), c = clampC(k, z), c2 = clampC(k, z * 1.08);
  return { ...sc, dim: 0.8, cam: [{ f: 0, ...c, zoom: z }, { f: 240, ...c2, zoom: z * 1.08 }], boxes: sc.boxes.map((bx, i) => ({ ...bx, from: 0 + i * 8 })) }; }; // dimmed: the cut from the white page must read as a new picture (shots.py missed white-to-white cuts in run 43719357524)
const SPLIT = 72; // characters, about 4.5 s of voice: a page sentence longer than this gets a second, closer shot
let n = 0;
const beat = (part, ref, src, pill, parts) => ({ id: `F${String(++n).padStart(2, "0")}`, part, ref, src, vo: parts.map((p) => p.vo).join(" "),
  scene: { type: "seq", pill, parts: parts.flatMap((p) => p.scene.type === "browser" && p.scene.boxes && p.vo.length > SPLIT
    ? [{ w: p.vo.length * 0.55, scene: p.scene }, { w: p.vo.length * 0.45, scene: closeup(p.scene) }]
    : p.scene.type === "browser" && !p.scene.boxes && p.vo.length > SPLIT * 1.4 ? [{ w: p.vo.length / 2, scene: p.scene }, { w: p.vo.length / 2, scene: { ...p.scene, cam: [...p.scene.cam].reverse().map((c, i) => ({ ...c, f: i * 150, zoom: c.zoom * 1.35 })) } }]
    : [{ w: p.vo.length, scene: p.scene }]) } });

export const SOURCES = {
  AN: { title: "Anthropic: Introducing Claude Fable 5.2 and Claude Mythos 5.2 (launch post, company-reported figures)", url: "https://www.anthropic.com/news/claude-fable-and-mythos-5-2", retrieved: "2026-11-15" },
  AA: { title: "Artificial Analysis: Claude Fable 5.2 model page (independent: intelligence index, price, cost and time per task, tokens)", url: "https://artificialanalysis.ai/models/claude-fable-5-2", retrieved: "2026-11-15" },
  AO: { title: "Artificial Analysis: AA-Omniscience v1.1 knowledge and hallucination benchmark (independent)", url: "https://artificialanalysis.ai/evaluations/omniscience", retrieved: "2026-11-15" },
  REF: { title: "Structure reference (not a fact source): AI Search, Claude Fable 5.2 is on steroids", url: "https://www.youtube.com/watch?v=S7lpCyZSdJQ", retrieved: "2026-11-15" },
};

export const EPISODE = {
  channel: "ai-tested", slug: "fable-trust-v2", title: "The Most Accurate AI Still Guesses When It Doesn't Know", target_minutes: 8,
  sound: { bed: "MUSIC_DOC_WINTER", bed_rel_db: -21, dip_scenes: ["verdict"] },
  xfade: 0.04, // beats join with a hard cut, like the shots inside them (render-episode and make-meta read this)
  beats: [
    beat("the claim", "S7lpCyZSdJQ 0:00: a new model just dropped, here is what we will test", ["AN", "AO"], "THE CLAIM", [
      P("On the launch page for Anthropic's newest model, a tester says it admits when it doesn't know something.", { type: "quote", who: "Adhyyan Sekhsaria", org: "Cognition · quoted on Anthropic's launch page", foot: FAN,
        text: "Claude Fable 5.2 says it doesn't know things instead of hallucinating.", hl: ["says it doesn't know things instead of hallucinating."] }), // the page shows this quote in a carousel tab that the capture could not open

      P("An independent benchmark of three thousand questions measured exactly that.", page("rewards", ["AA-Omniscience"])),
      P("When this model did not get an answer right,", page("fable59", ["Claude Fable 5.2"], 0.95)),
      P("fifty-nine percent of the time it gave a wrong answer instead of saying it didn't know.",
        { type: "stat", value: 59, suffix: "%", label: "of its non-correct answers were wrong answers, not \"I don't know\"", sub: "AA-Omniscience hallucination rate · Claude Fable 5.2 (max)", foot: FAA }),
    ]),
    beat("the claim", "S7lpCyZSdJQ 0:11: the promise of the video", ["AO"], "THE CLAIM", [
      P("And yet the same benchmark gave it the highest accuracy, seventy-nine percent.", page("acc79", ["Highest accuracy: 79%"])),
      P("Both numbers are true at once.", { type: "bars", title: "Claude Fable 5.2 on AA-Omniscience", sub: "two different measures of the same 3,000 questions", decimals: 0, max: 100,
        bars: [{ label: "Accuracy (higher is better)", value: 79, hi: true }, { label: "Hallucination rate (lower is better)", value: 59, hi: true, color: "#FF4D5E" }], foot: FAA }),
      P("So here is what Anthropic says Claude Fable 5.2 can do,", scroll("anth-1")),
      P("what independent tests found, and how far that means you can trust it.",
        { type: "flow", title: "In this video", steps: [{ title: "What Anthropic says", text: "Its launch post, line by line" }, { title: "What was measured", text: "Artificial Analysis, independent" }, { title: "How far to trust it", text: "What the two together mean" }] }),
    ]),
    beat("what it is", "S7lpCyZSdJQ 25:15: the official page", ["AN", "AA"], "WHAT IT IS", [
      P("Claude Fable 5.2 was released on November the ninth, 2026.", scroll("anth-0")),
      P("Anthropic says Fable and a second model, Mythos 5.2, are the same underlying model.", page("same", ["Same underlying model"])),
      P("Fable carries safeguards against cybersecurity and biology misuse, so it is offered to all users.",
        { type: "flow", title: "One model, two names", steps: [{ title: "Fable 5.2", text: "Cyber and biology safeguards; available to all users" }, { title: "Mythos 5.2", text: "Fewer safeguards; vetted organisations through verification programmes" }] }),
      P("Mythos goes only to vetted organisations.", scroll("anth-16", false)),
    ]),
    beat("what it is", "S7lpCyZSdJQ 25:56: speed and price from the page", ["AN", "AA"], "PRICE", [
      P("Anthropic says it is up to thirty percent faster than the previous Fable.", page("fast", ["Up to 30% faster"])),
      P("It costs eight dollars per million tokens in, and forty dollars per million tokens out.", page("price", ["$8 in · $40 out"])),
      P("Artificial Analysis lists the median at two dollars and ten dollars.", { type: "bars", title: "Price per million tokens", sub: "Claude Fable 5.2 against the median listed by Artificial Analysis", prefix: "$", unit: "", decimals: 0,
        bars: [{ label: "Fable 5.2 · input", value: 8, hi: true }, { label: "Median · input", value: 2 }, { label: "Fable 5.2 · output", value: 40, hi: true }, { label: "Median · output", value: 10 }], foot: FAA }),
    ]),
    beat("what Anthropic says it did", "S7lpCyZSdJQ 0:51-25:00: what it can do (their demos; ours: what the page reports)", ["AN"], "WHAT IT DID", [
      P("Most of the launch page is a list of things Anthropic says the model has already done.", scroll("anth-15")),
      P("One engineer gave it the task of designing an operating system, starting from an empty folder.", page("os", ["From an empty folder"])),
      P("It coordinated over a thousand sub-agents for eight days,",
        { type: "stat", value: 1000, prefix: "", suffix: "+", label: "sub-agents, working for eight days", sub: "Anthropic's account of the experiment", foot: FAN }),
      P("and Anthropic says the result boots on a laptop.", scroll("anth-5")),
    ]),
    beat("what Anthropic says it did", "S7lpCyZSdJQ 26:22: Fermat's Last Theorem", ["AN"], "WHAT IT DID", [
      P("Anthropic says over ninety percent of the changes merged into its core codebase are now written by Claude, with human guidance.", page("code90", ["Over 90%"])),
      P("A team of a thousand Fable agents turned the proof of Fermat's Last Theorem into a form a computer can check, in thirty hours.", page("fermat", ["30 hours"])),
      P("With the same setup, its everyday model, Opus 5.5, had finished twenty-six percent after eighteen hours.", page("resumed", ["18 hours"], 0.95)),
      P("By then, Fable 5.2 had finished eighty-six percent.", { type: "bars", title: "Fermat formalization done after 18 hours", sub: "about 1,000 agents each, one run per model (Anthropic's figure)", decimals: 0, max: 100,
        bars: [{ label: "Fable 5.2", value: 86, hi: true }, { label: "Opus 5.5", value: 26 }], foot: FAN }),
    ]),
    beat("what Anthropic says it did", "S7lpCyZSdJQ 27:00: the three devices", ["AN"], "WHAT IT DID", [
      P("From a one-paragraph prompt, it designed three electronic devices: a voice-assistant hub, a speakerphone and a handheld virtual pet.", scroll("anth-10", false)),
      P("All three worked without needing any electrical modifications, the page says.", page("devices", ["All three worked"])),
      P("Anthropic says it solved two open problems in theoretical physics, both about black holes.", page("physics", ["Two open problems"])),
      P("And it accurately modelled twenty-eight of the thirty-four virus shells it attempted, a kind used to deliver gene therapies.", page("capsid", ["28 of 34"])),
    ]),
    beat("what Anthropic says it did", "S7lpCyZSdJQ 27:22: robots and the RoboDojo chart", ["AN"], "ROBOTS", [
      P("On a test of controlling a simulated two-armed robot, Anthropic reports sixty-four point nine percent.", page("robo", ["64.9%"])),
      P("That is more than double GPT-6 Astra, and the previous Fable.", { type: "bars", title: "RoboDojo Sim, average success", sub: "highest effort, run by Anthropic for every model", decimals: 1,
        bars: [{ label: "Fable 5.2", value: 64.9, hi: true }, { label: "Opus 5.5", value: 39.4 }, { label: "Gemini 4 Argon", value: 34.2 }, { label: "GPT-6 Astra", value: 29.8 }, { label: "Fable 5.1", value: 27.6 }], foot: FAN }),
    ]),
    beat("the company's scorecard", "S7lpCyZSdJQ 27:58: the self-reported benchmark table", ["AN"], "SCORECARD", [
      P("Then comes the benchmark table, where Anthropic says the model is a step above Opus 5.5 in almost everything it evaluated.", page("step", ["A step above Opus 5.5"])),
      P("On FrontierCode, which checks whether its code changes would be merged by open-source maintainers, it scores forty-nine point one percent.", page("f491", ["49.1%"], 1.2)),
      P("Ahead of Opus 5.5, GPT-6 Astra and Gemini 4 Carbon.", { type: "bars", title: "FrontierCode 2.0", sub: "Anthropic's table, highest effort unless noted", decimals: 1,
        bars: [{ label: "Fable 5.2", value: 49.1, hi: true }, { label: "Opus 5.5", value: 45.5 }, { label: "GPT-6 Astra", value: 42.8 }, { label: "Gemini 4 Carbon", value: 41.1 }, { label: "Fable 5.1", value: 32.4 }], foot: FAN }),
    ]),
    beat("the company's scorecard", "S7lpCyZSdJQ 30:52: the remote labor index", ["AN"], "SCORECARD", [
      P("The biggest gap is on a knowledge-work test called the Remote Labor Index.", page("rli", ["Remote Labor Index"], 1.1)),
      P("Forty-one point three percent, about double every other model in the table.", { type: "bars", title: "Remote Labor Index", sub: "Anthropic's table", decimals: 1,
        bars: [{ label: "Fable 5.2", value: 41.3, hi: true }, { label: "Opus 5.5", value: 21.3 }, { label: "GPT-6 Astra", value: 20.8 }, { label: "Fable 5.1", value: 17.9 }], foot: FAN }),
    ]),
    beat("the trust claims", "S7lpCyZSdJQ 29:16: honesty, as the company measures it", ["AN"], "HONESTY", [
      P("Every number so far comes from Anthropic. So what does it say about honesty?", scroll("anth-13")),
      P("It ran an automated audit across about nineteen hundred scenarios. On the overall misbehaviour score, lower is better.", page("m267", ["Mythos 5.2: 2.67, lower is better"], 1.0)),
      P("Mythos 5.2 scored two point six seven, against three point two eight for Mythos 5.1.", { type: "bars", title: "Automated behavioral audit", sub: "overall misaligned behavior score, 1 to 10", lower: true, unit: "", decimals: 2, max: 4,
        bars: [{ label: "Mythos 5.1", value: 3.28 }, { label: "Sonnet 5.5", value: 3.1 }, { label: "Opus 5.5", value: 2.79 }, { label: "Mythos 5.2", value: 2.67, hi: true }], foot: FAN }),
      P("Hallucinating inputs, and falsely claiming to have finished a task, were both lower, it says.", page("hallin", ["Both lower"])),
    ]),
    beat("the trust claims", "S7lpCyZSdJQ: testers' verdicts", ["AN"], "TESTERS", [
      P("A tester from Cognition wrote that it says it doesn't know things instead of hallucinating.", { type: "quote", who: "Adhyyan Sekhsaria", org: "Cognition · quoted on Anthropic's launch page", foot: FAN,
        text: "Claude Fable 5.2 says it doesn't know things instead of hallucinating. At one point it told me its last estimate was wrong and that it wouldn't give a number until it had measured the change.", hl: ["says it doesn't know things instead of hallucinating."] }),
      P("Oracle reported that two other models wrote database queries that ran,", { type: "quote", who: "Liyu Gong", org: "Oracle · quoted on Anthropic's launch page", foot: FAN,
        text: "The SQL generated by two other models also ran successfully, but incorrectly summed country-level summary amounts, producing values 5–8x the expected amounts.", hl: ["producing values 5–8x the expected amounts."] }),
      P("but gave totals five to eight times too large.", { type: "stat", value: 8, prefix: "5–", suffix: "x", label: "the expected totals, from two other models' SQL", sub: "Oracle, quoted on Anthropic's launch page; Fable 5.2's SQL returned the expected results", foot: FAN }),
      P("And one security tester found earlier models overstated about one finding in twenty. Mythos 5.2 overstated none.", page("overst", ["1 in 20 overstated"])),
    ]),
    beat("the independent test", "S7lpCyZSdJQ 28:14: the Artificial Analysis numbers", ["AA"], "INDEPENDENT", [
      P("Those quotes were chosen by Anthropic. Artificial Analysis, an independent benchmarking site, runs its own tests.", scroll("aam-0")),
      P("Its intelligence index gives Fable 5.2 a score of sixty-five.", page("s65", ["65"])),
      P("The median for comparable models is forty-one.", { type: "stat", value: 65, label: "Artificial Analysis Intelligence Index", sub: "Claude Fable 5.2 (max)", vs: { mine: "Fable 5.2", label: "Median, comparable models", value: 41 }, foot: FAA }),
    ]),
    beat("the independent test", "S7lpCyZSdJQ 28:29: the cost per task", ["AA"], "COST", [
      P("But each task in that index cost twenty-six dollars and fifty-four cents to run.", page("c2654", ["$26.54 per task"])),
      P("Each one took forty-four and a half minutes, against a median of thirteen point three.", { type: "stat", value: 44.5, decimals: 1, suffix: " min", label: "per Intelligence Index task", vs: { mine: "Fable 5.2 (max)", label: "Median, comparable models", value: 13.3 }, foot: FAA }),
      P("And it used two hundred and seventy-five million tokens, more than three times the median.", { type: "stat", value: 275, suffix: "M", label: "tokens to run the Intelligence Index", vs: { mine: "Fable 5.2 (max)", label: "Median", value: 77.3 }, decimals: 0, foot: FAA }),
    ]),
    beat("the independent test", "S7lpCyZSdJQ 29:16: omniscience score and hallucination rate", ["AO"], "OMNISCIENCE", [
      P("Then there is AA-Omniscience: three thousand questions across six domains. It rewards accuracy and punishes bad guesses.", page("rewards", ["Rewards accuracy, punishes bad guesses"])),
      P("Fable 5.2 had the highest accuracy, seventy-nine percent.", page("acc79", ["79%"])),
      P("The hallucination rate asks something else: when the model did not get it right, how often did it answer wrongly instead of admitting it didn't know?", page("halldef", ["Wrong answers ÷ all non-correct answers"], 1.05)),
    ]),
    beat("the independent test", "S7lpCyZSdJQ 29:28: the hallucination chart", ["AO"], "HALLUCINATION", [
      P("For Fable 5.2 at its maximum setting, that was fifty-nine percent.", page("fable59", ["Fable 5.2: 59%"], 0.95)),
      P("Google's Gemini 4 Carbon, at its high setting, was at eleven percent.", page("carbon11", ["Gemini 4 Carbon (high): 11%"], 0.95)),
      P("Fable 5.2 is better than the previous Fable, at seventy, but well behind the best.", { type: "bars", title: "AA-Omniscience hallucination rate", sub: "wrong answers as a share of all non-correct answers", lower: true, decimals: 0, max: 100,
        bars: [{ label: "Gemini 4 Carbon (high)", value: 11 }, { label: "Opus 5.5 (max)", value: 50 }, { label: "GPT-6 Astra (max)", value: 50 }, { label: "Fable 5.2 (max)", value: 59, hi: true, color: "#FF4D5E" }, { label: "Fable 5.1 (max)", value: 70 }], foot: FAA }),
      P("The lowest on the whole page, four percent, was Gemini 4 Carbon at its medium setting.", page("low4", ["Lowest: 4%"])),
    ]),
    beat("what it means", "S7lpCyZSdJQ 29:41: what the benchmark really measures", ["AO", "AN"], "WHAT IT MEANS", [
      P("So it gets more right than any other model on the test.", { type: "stat", value: 79, suffix: "%", label: "accuracy, the highest on AA-Omniscience", sub: "Claude Fable 5.2 (max)", foot: FAA }),
      P("But when it doesn't know, it more often guesses than says so.",
        { type: "flow", title: "The same model, two findings", steps: [{ title: "Knows the most", text: "79% accuracy, the highest on AA-Omniscience" }, { title: "Guesses when unsure", text: "59% of its non-correct answers were wrong answers" }, { title: "So", text: "Check the answers it gives" }] }),
      P("That does not cancel the tester's quote.", { type: "quote", who: "Adhyyan Sekhsaria", org: "Cognition · quoted on Anthropic's launch page", foot: FAN,
        text: "Claude Fable 5.2 says it doesn't know things instead of hallucinating.", hl: ["says it doesn't know things instead of hallucinating."] }),
      P("One person's sessions and three thousand fixed questions measure different things.",
        { type: "flow", title: "Two kinds of evidence", steps: [{ title: "A tester's sessions", text: "Quoted on Anthropic's launch page" }, { title: "3,000 fixed questions", text: "Artificial Analysis, scored the same way for every model" }] }),
    ]),
    beat("what Anthropic admits", "S7lpCyZSdJQ 25:22: the lines the company itself flags", ["AN"], "LIMITS", [
      P("Anthropic's page is careful here too. It says no single test can tell how a model will behave once it is deployed.", page("nosingle", ["No single test"])),
      P("It says these models voice suspicion that they are being evaluated more often than any of its recent models.", page("suspic", ["Suspect they are being tested"])),
      P("And that building evaluations that catch every failure remains unsolved.", page("problem", ["Remains unsolved"])),
    ]),
    beat("what Anthropic admits", "S7lpCyZSdJQ: safety numbers on the page", ["AN"], "SANDBOX", [
      P("In a test where the sandbox had a deliberate weakness, Mythos 5.2 used files or credentials placed outside it in three point one percent of scenarios.", page("sandbox", ["3.1% of scenarios"])),
      P("Down from twenty-one percent for Mythos 5.1, and thirty-nine for Mythos 5.", { type: "bars", title: "Used credentials or files outside the sandbox", sub: "share of about 1,800 scenarios (Anthropic)", lower: true, decimals: 1,
        bars: [{ label: "Mythos 5", value: 39 }, { label: "Mythos 5.1", value: 21 }, { label: "Sonnet 5.5", value: 5.1 }, { label: "Opus 5.5", value: 3.3 }, { label: "Mythos 5.2", value: 3.1, hi: true }], foot: FAN }),
      P("The outside evaluators who tested the model did not review the launch post, and do not necessarily agree with its claims.", page("none", ["Not reviewed by outside evaluators"])),
    ]),
    beat("the limits you will hit", "S7lpCyZSdJQ 25:38 and 31:46: the deliberate limits and usage caps", ["AN"], "LIMITS", [
      P("Some limits are deliberate. Anthropic says it held back the model's advances in research that could most directly speed up AI development.", page("limit", ["Limited on purpose"])),
      P("Its safeguards block high-risk cyber work and most research biology.",
        { type: "flow", title: "What Fable 5.2's safeguards block", steps: [{ title: "Cybersecurity", text: "Penetration testing, exploit generation, binary-based vulnerability work" }, { title: "Biology", text: "Most tasks in research biology" }] }),
      P("A blocked query is answered by an older model instead.",
        { type: "flow", title: "When Fable 5.2 blocks a query", steps: [{ title: "Cybersecurity", text: "Answered by Opus 4.8 instead" }, { title: "Biology", text: "Answered by Opus 5 instead" }] }),
      P("Anthropic says that happens about fifty-five percent less often than with the previous Fable.", page("blocks", ["About 55% fewer blocks"])),
      P("And on Pro plans, Fable can use up to half of the weekly usage limit.", page("w50", ["Up to 50% of weekly limits"])),
    ]),
    beat("the answer", "S7lpCyZSdJQ 31:10: the verdict", ["AN", "AA", "AO"], "VERDICT", [
      P("So here is where that leaves it. On these numbers, Fable 5.2 gets more right than any model tested,", { type: "verdict", line: "Knows the most. Still guesses when it doesn't.",
        points: ["79% accuracy on AA-Omniscience, the highest", "59% hallucination rate (Gemini 4 Carbon, high: 11%)", "$26.54 and 44.5 minutes per index task", "The launch-page benchmarks are Anthropic's own"],
        limits: ["We did not run the model ourselves", "Two sources: Anthropic and Artificial Analysis", "Captured 15 Nov 2026; scores change as tests are re-run"], foot: "Sources: Anthropic launch post; Artificial Analysis · captured 15 Nov 2026" }),
      P("but it is expensive and slow.", { type: "stat", value: 26.54, decimals: 2, prefix: "$", label: "and 44.5 minutes per Intelligence Index task", sub: "Artificial Analysis", foot: FAA }),
      P("When it doesn't know, it more often guesses than says so.", page("fable59", ["59%"], 0.95)),
      P("Use it for hard problems, and check what it tells you.",
        { type: "flow", title: "How to use it", steps: [{ title: "Hard problems", text: "Where its accuracy lead matters" }, { title: "Check the answer", text: "It guesses more than it abstains" }, { title: "Watch the cost", text: "$26.54 per index task" }] }),
    ]),
    beat("close", "channel format: a question in the close", [], "YOUR TURN", [
      P("If the model that knows the most still guesses when it doesn't, how would you check its answers? Tell us in the comments.",
        { type: "quote", who: "AI Tested", org: "our question to you", text: "If the model that knows the most still guesses when it doesn't, how would you check its answers?", hl: ["how would you check its answers?"] }),
      P("Every number in this video comes from two pages, and both are linked in the description.",
        { type: "flow", title: "Where this came from", steps: [{ title: "Anthropic", text: "Launch post, 9 Nov 2026 (company-reported)" }, { title: "Artificial Analysis", text: "Model page and AA-Omniscience (independent)" }] }),
    ]),
  ],
  thumbs: [{ name: "thumb1-fable", big: "Most accurate AI\nstill guesses", num: "59%", numLabel: "wrong instead of \"I don't know\"", small: "tested" }],
};

// Alternate light and dark pictures at every cut, so that each cut reads as a new picture. Run 43719357524 had 107 planned cuts; shots.py
// (scene score > 0.3) found 33: white page to white page and dark card to dark card scored too low. Each shot is set light or dark, opposite
// to the shot before it: a dark page is dimmed around its box from the first frame, a light card is the dark card inverted. Unboxed pages
// stay as captured (inverting a photo gives a negative), so they are always light and the shot before one is made dark.
{
  const shots = EPISODE.beats.flatMap((b) => b.scene.parts.map((p) => p.scene));
  const fixed = (s) => s && s.type === "browser" && !s.boxes?.length;
  const set = (s, dark) => {
    if (s.type === "browser") { s.dim = dark ? 0.8 : 0.38; if (dark) s.boxes = s.boxes.map((bx) => ({ ...bx, from: Math.min(bx.from, -14) })); }
    else s.invert = !dark;
  };
  let prev = null;
  shots.forEach((s, i) => {
    let dark = false;
    if (!fixed(s)) { dark = prev === null ? true : !prev; if (fixed(shots[i + 1])) dark = true; set(s, dark); }
    prev = dark;
  });
}
