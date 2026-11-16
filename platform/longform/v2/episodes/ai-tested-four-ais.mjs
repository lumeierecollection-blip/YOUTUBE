// AI Tested long-form, 16 Nov 2026: "We Gave Free AIs the Same 5 Jobs. One Took 7 Minutes."
// Why this replaces fable-trust-v2: the owner rejected it ("it just made the same video over again"). Side by side with its reference
// (AI Search, S7lpCyZSdJQ, 388k views) the reference is ~73% screen recordings of models actually being used: prompt typed, answer streaming,
// the thing it built running. Ours was page captures. This episode IS a real test: every model run below was made on GitHub by
// scripts/clone/demo-record.mjs (job file data/clone/media/ai-tested-four-ais.json), screen-recorded, and its full answer, timing and stop
// reason logged in data/clone/runs/ai-tested-four-ais/<run>.json. Pass/fail per run: data/clone/runs/ai-tested-four-ais/VERDICTS.json
// (criterion stated on screen). Model facts: the providers' own pages, fetched 16 Nov 2026 (SOURCES).
// Structure kept from the reference: hook with the result -> what we test and how -> each task: prompt typed, answer streams, result runs,
// side-by-side -> totals -> verdict with limits -> comment question. Shots cut every 3-5 s (Seq parts weighted by sentence length).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const DIR = "data/clone/runs/ai-tested-four-ais";
const RUN = (n) => JSON.parse(readFileSync(join(ROOT, DIR, `${n}.json`), "utf8"));
const V = JSON.parse(readFileSync(join(ROOT, DIR, "VERDICTS.json"), "utf8")).runs;
const CLIP = (n, kind = "app") => `lf2/ai-tested/clips/ai-tested-four-ais/${n}-${kind}.mp4`;
const sec = (n) => RUN(n).generation_ms / 1000;
const say = (s) => (s < 10 ? s.toFixed(1) : String(Math.round(s))); // spoken/printed seconds
const TASKS = ["snake", "solar", "hexagon", "cave", "city"];
const M = { gemini: { label: "Gemini 3.8 Flash", maker: "Google" }, gptoss: { label: "gpt-oss-120b", maker: "OpenAI" }, gptoss20: { label: "gpt-oss-20b", maker: "OpenAI" } };
const SCORED = Object.keys(M);
const total = (m) => TASKS.reduce((s, t) => s + sec(`${t}-${m}`), 0);
const score = (m) => TASKS.filter((t) => V[`${t}-${m}`].pass).length;
const FOOT = "Live run · recorded 16 Nov 2026 · same prompt, one try, no edits";

// where each app draws on its page (from the recordings): zoom toward it so the result fills the shot
const FRAME = {
  "snake-gemini": [1.9, 2.1, "50% 48%"], "snake-gptoss20": [2.0, 2.2, "50% 30%"], "hexagon-gemini": [1.7, 1.85, "50% 55%"],
  "hexagon-gptoss20": [1.8, 1.95, "50% 50%"], "solar-gptoss20": [1.7, 1.85, "34% 30%"], "cave-gptoss20": [2.0, 2.15, "0% 4%"], "city-gptoss20": [2.0, 2.15, "0% 100%"],
};
const app = (n, extra = {}) => { const [a, b, focus] = FRAME[n] || [1.0, 1.08, "50% 50%"], m = n.split("-")[1], s = sec(n);
  return { type: "run", video: CLIP(n), videoLen: 12.5, start: 1.5, zoom: [a, b], focus, label: M[m]?.label, tag: `${say(s)} s`, ok: V[n]?.pass, foot: FOOT, ...extra }; };
const chat = (n, start = 4.5, extra = {}) => ({ type: "run", video: CLIP(n, "chat"), videoLen: 20, start, zoom: [1.3, 1.42], focus: "50% 38%", label: M[n.split("-")[1]]?.label, model: RUN(n).model, foot: FOOT, ...extra });
const typing = (n) => ({ type: "run", video: CLIP(n, "chat"), videoLen: 20, start: 0.4, zoom: [1.45, 1.55], focus: "50% 96%", foot: FOOT });
const quad = (t, title) => ({ type: "quad", title, foot: FOOT, cells: SCORED.map((m) => ({ video: CLIP(`${t}-${m}`), videoLen: 12.5, label: M[m].label, tag: V[`${t}-${m}`].pass ? `ran · ${say(sec(`${t}-${m}`))} s` : `failed · ${say(sec(`${t}-${m}`))} s`, ok: V[`${t}-${m}`].pass })) });

const P = (vo, scene) => ({ vo, scene });
let n = 0;
const beat = (part, ref, src, pill, parts) => ({ id: `A${String(++n).padStart(2, "0")}`, part, ref, src, vo: parts.map((p) => p.vo).join(" "),
  scene: { type: "seq", pill, parts: parts.map((p) => ({ w: p.vo.length, scene: p.scene })) } });

export const SOURCES = {
  RUNS: { title: "Our recorded runs (GitHub Actions run 43782353533 log has the Gemini 429/503 rejections): prompts, full answers, timings and stop reasons (data/clone/runs/ai-tested-four-ais), verdicts (VERDICTS.json)", url: "https://github.com/lumeierecollection-blip/YOUTUBE/tree/media/ai-tested-four-ais/data/clone/runs/ai-tested-four-ais", retrieved: "2026-11-16" },
  GEM: { title: "Google AI Studio: Gemini 3.8 Flash model page", url: "https://aistudio.google.com/docs/models/gemini-3.8-flash", retrieved: "2026-11-16" },
  OSS: { title: "Groq: openai/gpt-oss-120b model page", url: "https://console.groq.com/docs/model/openai/gpt-oss-120b", retrieved: "2026-11-16" },
  OSS20: { title: "Groq: openai/gpt-oss-20b model page", url: "https://console.groq.com/docs/model/openai/gpt-oss-20b", retrieved: "2026-11-16" },
  QWEN: { title: "Groq: qwen/qwen3.8-27b model page", url: "https://console.groq.com/docs/model/qwen/qwen3.8-27b", retrieved: "2026-11-16" },
  REF: { title: "Structure reference (not a fact source): AI Search, Claude Fable 5.2 is on steroids", url: "https://www.youtube.com/watch?v=S7lpCyZSdJQ", retrieved: "2026-11-15" },
};

const FAST = SCORED.flatMap((m) => TASKS.map((t) => `${t}-${m}`)).sort((x, y) => sec(x) - sec(y))[0]; // the quickest single answer, from the logs
const chars = (m) => TASKS.reduce((n, t) => n + RUN(`${t}-${m}`).answer.length, 0), CH = (m) => chars(m).toLocaleString("en-GB");
const G = total("gemini"), O = total("gptoss"), O20 = total("gptoss20");
const mins = (s) => `${Math.floor(s / 60)} minutes and ${Math.round(s % 60)} seconds`;

export const EPISODE = {
  channel: "ai-tested", slug: "four-ais", title: "We Gave Free AIs the Same 5 Jobs. One Took 7 Minutes.", target_minutes: 7,
  sound: { bed: "MUSIC_DOC_WINTER", bed_rel_db: -22, dip_scenes: ["verdict"] },
  xfade: 0.04,
  beats: [
    beat("the result first", "S7lpCyZSdJQ 0:00: open on the model's output running", ["RUNS"], "LIVE TEST", [
      P("We gave free AI models from Google and OpenAI the exact same five jobs, and recorded every answer as it happened.", app("city-gemini")),
      P(`One of them answered a job in ${say(sec(FAST))} seconds.`, chat(FAST, 4.2)),
      P(`Another needed ${Math.round(sec("city-gemini"))} seconds for a single job.`, chat("city-gemini", 6)),
      P(`Only one built all ${TASKS.length}.`, quad("hexagon", "Same prompt · one try each")),
    ]),
    beat("the rules", "S7lpCyZSdJQ 0:20: the promise and the test", ["RUNS"], "THE RULES", [
      P("The rules are simple. Every model gets the same prompt, word for word.", typing("snake-gemini")),
      P("It gets one try, and we don't fix anything.", chat("snake-gptoss", 4.2)),
      P("Whatever comes back, we open in a browser and record.", app("snake-gptoss")),
      P("It passes if the page shows what we asked for, running on its own.",
        { type: "flow", title: "How we score", steps: [{ title: "Same prompt", text: "Word for word, every model" }, { title: "One try", text: "No edits, no second go" }, { title: "Open it", text: "Recorded in a browser" }, { title: "Pass?", text: "Shows what was asked, running on its own" }], foot: FOOT }),
    ]),
    beat("the contenders", "S7lpCyZSdJQ 25:15: the specs from the official page", ["GEM"], "GEMINI", [
      P("First, Gemini 3.8 Flash.", { type: "stat", value: 1048576, label: "tokens of input it accepts", sub: "Gemini 3.8 Flash · Google's model page", foot: "Source: aistudio.google.com/docs/models/gemini-3.8-flash · fetched 16 Nov 2026" }),
      P("Google calls it its most intelligent Flash model, built for software engineering and agents.", chat("solar-gemini", 5)),
    ]),
    beat("the contenders", "S7lpCyZSdJQ 25:56: specs and price", ["OSS", "OSS20"], "OPENAI", [
      P("Then two of OpenAI's open-weight models, both run on Groq.", chat("hexagon-gptoss", 4.2)),
      P("gpt-oss-120b has a hundred and twenty billion parameters, about five billion active at a time.",
        { type: "bars", title: "Parameters", sub: "billions · total and active per step · Groq's model pages", unit: "B", decimals: 1, bars: [{ label: "gpt-oss-120b total", value: 120, hi: true }, { label: "120b active", value: 5.1 }, { label: "gpt-oss-20b total", value: 20, hi: true, color: "#9ad1ff" }, { label: "20b active", value: 3.6 }], foot: "Source: console.groq.com model pages · fetched 16 Nov 2026" }),
      P("Its smaller sibling, gpt-oss-20b, has twenty billion, and Groq lists it at about a thousand tokens a second.",
        { type: "bars", title: "Speed Groq lists", sub: "tokens per second", unit: "", decimals: 0, bars: [{ label: "gpt-oss-120b", value: 500 }, { label: "gpt-oss-20b", value: 1000, hi: true }], foot: "Source: console.groq.com model pages · fetched 16 Nov 2026" }),
    ]),
    // Each job: the ask (prompt typing), one answer streaming, each model's result in its own shot, then all three side by side.
    // Lines are hand-written from VERDICTS.json notes and the recordings; every time and length is read from the run logs.
    ...TASKS.map((t, i) => {
      const r = (m) => `${t}-${m}`, s = (m) => say(sec(r(m))), len = (m) => RUN(r(m)).answer.length.toLocaleString("en-GB");
      const J = {
        snake: { title: "Job 1 · a Snake game that plays itself", ask: "Job one. A Snake game in a single file, where the snake steers itself toward the food, with no one at the keys.",
          stream: () => `gpt-oss-120b streamed back ${len("gptoss")} characters of code in ${s("gptoss")} seconds.`,
          g: () => `Gemini took ${s("gemini")} seconds. Its snake hunts the food on a neat little board, and the score climbs.`,
          o: () => `gpt-oss-120b's version plays too, and the score reaches five, but it is drawn across the whole page in tiny squares.`,
          o20: () => `gpt-oss-20b, ${s("gptoss20")} seconds, puts its snake on a small black board. It plays.` },
        solar: { title: "Job 2 · an animated solar system", ask: "Job two. An animated solar system: the Sun and eight labelled planets, orbiting at different speeds, over a starfield.",
          stream: () => `Gemini wrote ${len("gemini")} characters for this one, in ${s("gemini")} seconds.`,
          g: () => `Its planets sit on faint orbit rings, Saturn has its ring, and each one moves at its own speed.`,
          o: () => `gpt-oss-120b drew the Sun, the planets, the labels and the rings in ${s("gptoss")} seconds. Then nothing moved. Two seconds in and eleven seconds in, the frames are identical.`,
          o20: () => `gpt-oss-20b starts its planets in a straight line and lets them fan out, slowly, at different speeds. The labels overlap, but it does what was asked.` },
        hexagon: { title: "Job 3 · ten balls in a spinning hexagon", ask: "Job three, a classic test for these models. Ten balls bouncing under gravity inside a spinning hexagon, hitting the walls and each other.",
          stream: () => `This prompt drew the longest answer from gpt-oss-120b: ${len("gptoss")} characters.`,
          g: () => `Gemini, ${s("gemini")} seconds: ten coloured balls tumble around the bottom as the walls turn.`,
          o: () => `gpt-oss-120b gets it right in ${s("gptoss")} seconds. Ten balls, gravity, a turning hexagon.`,
          o20: () => `gpt-oss-20b's hexagon spins, but there is one ball inside it, not ten. That is a fail.` },
        cave: { title: "Job 4 · a ship that flies itself through a cave", ask: "Job four. A side-scrolling cave, a ship that steers itself between the ceiling and the floor, and a distance counter.",
          stream: () => `Gemini's answer took ${s("gemini")} seconds to arrive.`,
          g: () => `It shows a ship weaving between two glowing walls that change shape as they scroll.`,
          o: () => `gpt-oss-120b, ${s("gptoss")} seconds: a wave-shaped tunnel, a ship, and the metres ticking up.`,
          o20: () => `gpt-oss-20b draws thinner walls and a red dot for a ship, but the cave scrolls and the counter climbs past a thousand.` },
        city: { title: "Job 5 · a city through a full day and night", ask: "Job five. A city skyline that runs through a whole day and night every ten seconds, with the sun, the moon, stars, and windows lighting up.",
          stream: () => `Gemini spent ${s("gemini")} seconds on this one, its slowest answer of the test.`,
          g: () => `The sky fades from blue to purple, the moon comes up, and the windows light floor by floor.`,
          o: () => `gpt-oss-120b, ${s("gptoss")} seconds: tall pale towers, a crescent moon, stars, and the windows switching on at night.`,
          o20: () => `gpt-oss-20b does the full cycle too, though it draws the whole city in one small corner of the page.` },
      }[t];
      const passN = SCORED.filter((m) => V[r(m)].pass).length;
      const streamOf = { snake: "gptoss", solar: "gemini", hexagon: "gptoss", cave: "gemini", city: "gemini" }[t];
      return beat(`job ${i + 1}`, "S7lpCyZSdJQ: each demo = prompt typed, answer streams, output running", ["RUNS"], J.title.split(" · ")[0].toUpperCase(), [
        P(J.ask, typing(r("gemini"))),
        P(J.stream(), chat(r(streamOf), 5)),
        P(J.g(), app(r("gemini"))),
        P(J.o(), app(r("gptoss"))),
        P(J.o20(), app(r("gptoss20"))),
        P(passN === SCORED.length ? `All ${passN} pass this one.` : `${passN} of ${SCORED.length} pass this one.`, quad(t, J.title)),
      ]);
    }),
    beat("the one we could not score", "honest limit of the test", ["QWEN", "RUNS"], "QWEN 3.8", [
      P("We also tried Alibaba's Qwen 3.8, a twenty-seven billion parameter model.", chat("snake-qwen", 4.5, { label: "Qwen 3.8 27B", model: "qwen/qwen3.8-27b" })),
      P("On our free tier, Groq rejected its requests as too large, so we had to cap its answers at six thousand tokens.", { type: "stat", value: 6000, label: "tokens: the most Qwen could answer on our free tier", sub: "the default request was rejected as 'Request too large'", foot: "Source: our run logs (Groq error messages), 16 Nov 2026" }),
      P("Qwen writes long code, and every one of its answers hit that limit before it finished.", chat("city-qwen", 9, { label: "Qwen 3.8 27B", model: "stopped: length limit", ok: false })),
      P("That is a limit of our account, not a fair test of the model, so it is not in the score.", { type: "verdict", line: "Qwen: not scored", points: ["Every answer cut off by our tier's limit"], limits: ["Not a judgement of the model itself"], foot: FOOT }),
    ]),
    beat("the totals", "S7lpCyZSdJQ: the numbers panel before the verdict", ["RUNS"], "RESULTS", [
      P(`Add it up. Gemini passed ${score("gemini")} of ${TASKS.length}.`, { type: "compare", title: "Jobs passed", cols: SCORED.map((m) => ({ title: M[m].label, best: score(m) === Math.max(...SCORED.map(score)), prompt: M[m].maker, rows: [{ label: "passed", right: score(m), of: TASKS.length }] })), foot: FOOT }),
      P(`Both OpenAI models passed ${score("gptoss")} and ${score("gptoss20")}.`, quad("solar", "The job that split them")),
      P(`But Gemini's five answers took ${mins(G)} in total.`, { type: "bars", title: "Total time for all five answers", sub: "seconds, measured from request to last word", unit: " s", decimals: 0, bars: [{ label: "Gemini 3.8 Flash", value: G, hi: true }, { label: "gpt-oss-120b", value: O }, { label: "gpt-oss-20b", value: O20 }], foot: FOOT }),
      P(`The OpenAI models needed ${Math.round(O)} and ${Math.round(O20)} seconds for all five.`, app("city-gptoss")),
    ]),
    beat("why the gap", "S7lpCyZSdJQ: explaining the numbers before the verdict", ["OSS", "OSS20", "RUNS"], "WHY THE GAP", [
      P("Why such a gap? Part of it is the hardware the models ran on. Groq lists gpt-oss-120b at about five hundred tokens a second, and the 20b at about a thousand.",
        { type: "bars", title: "Speed Groq lists", sub: "tokens per second · Groq's model pages", unit: "", decimals: 0, bars: [{ label: "gpt-oss-120b", value: 500, hi: true }, { label: "gpt-oss-20b", value: 1000, hi: true }], foot: "Source: console.groq.com model pages · fetched 16 Nov 2026" }),
      P(`Part of it is how much each one wrote. Gemini's five answers came to ${CH("gemini")} characters. The two OpenAI models wrote ${CH("gptoss")} and ${CH("gptoss20")}.`,
        { type: "bars", title: "Characters written, all five jobs", sub: "from our run logs", unit: "", decimals: 0, bars: SCORED.map((m) => ({ label: M[m].label, value: chars(m), hi: m === "gemini" })), foot: FOOT }),
      P("And part of it is the free tier. For every one of the five jobs, Google turned our request down at least four times, for rate limits or high demand, before one went through. Our clock only ran on the attempt that worked.", chat("cave-gemini", 7)),
      P("So these times tell you what this free setup felt like, not how fast each model is everywhere.", app("cave-gptoss")),
    ]),
    beat("verdict", "S7lpCyZSdJQ: the verdict and where the limits are", ["RUNS"], "VERDICT", [
      P("So fast is not the same as finished. The quickest answers still needed checking, because one froze and one built a single ball instead of ten.", app("hexagon-gptoss20")),
      P("And the slowest model was the only one that never failed.",
        { type: "verdict", line: "Fast isn't finished. Check what it builds.", points: [`Gemini 3.8 Flash: ${score("gemini")}/5, ${Math.round(G)} s in total`, `gpt-oss-120b: ${score("gptoss")}/5, ${Math.round(O)} s`, `gpt-oss-20b: ${score("gptoss20")}/5, ${Math.round(O20)} s`],
          limits: ["One try per model, five jobs only", "Free tiers: time includes the service, not only the model", "Pass/fail judged by eye from the recordings"], foot: FOOT }),
      P("Which job should we give them next? Tell us in the comments.", app("solar-gemini")),
    ]),
  ],
  thumbs: [{ name: "thumb1-four-ais", big: "Same 5 jobs.\nOne took", num: String(Math.round(G / 60)), numLabel: "minutes. It was the only one to finish all 5.", small: "TESTED" }],
};
