/**
 * AI Tested Short for the long-form "We Gave Free AIs the Same 5 Jobs. One Took 7 Minutes."
 * Every number is read from our own recorded run logs (data/clone/runs/ai-tested-four-ais: <job>-<ai>.json and VERDICTS.json); nothing is
 * typed in. Qwen was not scored (VERDICTS.json "excluded"), so the Short compares the three AIs that were. "Free" is the long-form's own
 * framing (free tiers), not something the logs record.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";

const DIR = join(ROOT, "data/clone/runs/ai-tested-four-ais");
const rd = (f) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const REPO_URL = "https://github.com/lumeierecollection-blip/YOUTUBE/tree/media/ai-tested-four-ais/data/clone/runs/ai-tested-four-ais";
const TITLE = "We Gave Free AIs the Same 5 Jobs. One Took 7 Minutes.";
const JOBS = [["snake", "Snake"], ["solar", "Solar system"], ["hexagon", "Hexagon balls"], ["cave", "Cave flyer"], ["city", "Day-night city"]];
const AIS = [{ key: "gemini", who: "gemini", name: "Gemini 3.8 Flash" }, { key: "gptoss", who: "openai", name: "gpt-oss-120b" }, { key: "gptoss20", who: "openai", name: "gpt-oss-20b" }];
const HEAD = { "solar-gemini": "Runs", "solar-gptoss": "Nothing moves", "hexagon-gemini": "10 balls", "hexagon-gptoss20": "1 ball, not 10" };

export function load() {
  const V = rd("VERDICTS.json").runs, FR = rd("FRAMES.json");
  const runs = {};
  for (const [j] of JOBS) for (const a of AIS) { const n = `${j}-${a.key}`, r = rd(`${n}.json`); runs[n] = { clip: `${n}-app`, seconds: r.generation_ms / 1000, model: r.model, pass: V[n].pass, note: V[n].note, headline: HEAD[n] || (V[n].pass ? "Works" : "Fails"), zoom: [FR[n][0], FR[n][1]], focus: FR[n][2] }; }
  const models = AIS.map((a) => { const results = JOBS.map(([j]) => ({ id: j, pass: runs[`${j}-${a.key}`].pass })); return { id: a.key, key: a.key, who: a.who, name: a.name, seconds: JOBS.reduce((s, [j]) => s + runs[`${j}-${a.key}`].seconds, 0), passed: results.filter((r) => r.pass).length, results }; });
  const jobs = JOBS.map(([id, label]) => ({ id, label, title: { solar: "Solar system job", hexagon: "Hexagon job: 10 balls" }[id] || label, zoom: runs[`${id}-gemini`].zoom, focus: runs[`${id}-gemini`].focus, runs: { gemini: runs[`${id}-gemini`], gptoss: runs[`${id}-gptoss`], gptoss20: runs[`${id}-gptoss20`] } }));
  return { models, jobs, runs };
}

export function plan() {
  const { models, jobs, runs } = load(), [g, o1, o2] = models, date = "2026-11-16";
  const gs = Math.round(g.seconds), o1s = Math.round(o1.seconds), o2s = Math.round(o2.seconds);
  // The lines below spell numbers out for the voice; these checks stop the script drifting from the logs.
  if (gs !== 434 || o1s !== 19 || o2s !== 16 || g.passed !== 5 || o1.passed !== 4 || o2.passed !== 4) throw new Error(`logs no longer match the script: ${gs} ${o1s} ${o2s} ${g.passed}/${o1.passed}/${o2.passed}`);
  if (!(runs["solar-gptoss"].pass === false && runs["solar-gemini"].pass && runs["hexagon-gptoss20"].pass === false && runs["hexagon-gemini"].pass)) throw new Error("verdicts changed");
  const claim = (claim_id, text) => ({ claim_id, claim: text, source_id: "s1", source_url: REPO_URL, published: date, excerpt: text, confidence: "high", context: "Measured in our own recorded runs on 16 Nov 2026: one try per AI per job, generation time from each run's generation_ms, pass/fail judged from the screen recording (VERDICTS.json). Qwen 3.8 27B was not scored. Results can differ between runs." });
  const sec = (m) => m.seconds.toFixed(1);
  const claims = [
    claim("tasks", `Three AIs (${models.map((m) => m.name).join(", ")}) were each given the same five jobs (${jobs.map((j) => j.label).join(", ")}) with the same prompt, one try each.`),
    claim("tg", `${g.name} took ${sec(g)} s in total to write the five jobs.`),
    claim("to1", `${o1.name} took ${sec(o1)} s in total for the five jobs.`),
    claim("to2", `${o2.name} took ${sec(o2)} s in total for the five jobs.`),
    claim("solarG", `Solar system, ${g.name}: ${runs["solar-gemini"].note}.`),
    claim("solarO", `Solar system, ${o1.name}: ${runs["solar-gptoss"].note}.`),
    claim("hexG", `Hexagon, ${g.name}: ${runs["hexagon-gemini"].note}.`),
    claim("hexS", `Hexagon, ${o2.name}: ${runs["hexagon-gptoss20"].note}.`),
    claim("score", `Jobs that worked: ${g.name} ${g.passed} of 5, ${o1.name} ${o1.passed} of 5, ${o2.name} ${o2.passed} of 5.`),
  ];
  const V = (text, ...claim_ids) => ({ text, claim_ids });
  const NR = { allow_no_claim: true, editorial: "question or call to action drawn from the measured results" };
  const slots = [
    { id: "hook", scene: 0, variants: [V("Seven minutes, or nineteen seconds: which AI would you trust?", "tg", "to1")] },
    { id: "tasks", scene: 1, variants: [V("We gave three free AIs the same five coding jobs.", "tasks"), V("Three free AIs, the same five jobs.", "tasks")] },
    { id: "solarG", scene: 2, variants: [V("Gemini's solar system runs, every planet moving.", "solarG"), V("Gemini's solar system runs.", "solarG")] },
    { id: "solarO", scene: 3, variants: [V("The big gpt-oss drew a solar system that never moved.", "solarO"), V("The big gpt-oss one never moved.", "solarO")] },
    { id: "hexG", scene: 4, variants: [V("Then ten balls in a spinning hexagon, which Gemini got right.", "hexG"), V("Gemini's hexagon had ten balls.", "hexG")] },
    { id: "hexS", scene: 5, variants: [V("The small gpt-oss had a hexagon with one ball.", "hexS"), V("The small gpt-oss had one ball.", "hexS")] },
    { id: "time", scene: 6, variants: [V("Gemini took four hundred thirty-four seconds for all five.", "tg"), V("Gemini took four hundred thirty-four seconds.", "tg")] },
    { id: "fast", scene: 7, optional: true, variants: [V("The two gpt-oss models each finished in under twenty seconds.", "to1", "to2")] },
    { id: "score", scene: 8, variants: [V("Gemini passed five of five, the fast ones four.", "score")] },
    { id: "q", scene: 9, ...NR, variants: [V("Is fast good enough when it gets one wrong?", "score"), V("Fast, or finished?", "score")] },
    { id: "cta", scene: 10, ...NR, variants: [V("The full test is on our channel.")] },
    { id: "loop", scene: 11, ...NR, variants: [V("Seven minutes, or nineteen seconds?")] },
  ];
  const scenes = [
    { kind: "hookF", treatment: "number-bars", objective: "Open on the three AIs with their measured total times, the 434 s bar dwarfing the other two", background: "white" },
    { kind: "jobsF", treatment: "recordings-grid", objective: "Show the five real recorded apps of the five jobs", background: "white" },
    { kind: "soloF", job: "solar", model: "gemini", treatment: "recording", objective: "Show Gemini's real solar-system recording running", background: "white" },
    { kind: "duelF", job: "solar", other: "gptoss", treatment: "split-recordings", objective: "Show the same job by gpt-oss-120b, frozen, under Gemini's", background: "white" },
    { kind: "soloF", job: "hexagon", model: "gemini", treatment: "recording", objective: "Show Gemini's real hexagon recording with ten balls", background: "white" },
    { kind: "duelF", job: "hexagon", other: "gptoss20", treatment: "split-recordings", objective: "Show gpt-oss-20b's single ball under Gemini's ten", background: "white" },
    { kind: "timeF", show: 1, treatment: "bar-chart", objective: "Bars of total time on one scale: 434 s against 19 s and 16 s", background: "white" },
    { kind: "fastF", show: 3, animFrom: 1, treatment: "bar-chart", objective: "Add the two fast AIs to the same scale: 19 s and 16 s", background: "white" },
    { kind: "scoreF", treatment: "pass-grid", objective: "One square per job per AI, with the failed jobs named", background: "white" },
    { kind: "questionF", treatment: "verdict-panel", objective: "Ask whether fast is good enough, with 4 of 5 in 19 s against 5 of 5 in 434 s", background: "accent panel" },
    { kind: "ctaF", treatment: "title-card", objective: "Point to the full test on the channel with the long-form title", background: "white" },
    { kind: "hookF", loop: true, treatment: "number-bars", objective: "Return to the opening picture so the replay joins up", background: "white" },
  ];
  return { claims, slots, scenes, data: { date, title: TITLE, models, jobs }, sources: [{ source_id: "s1", url: REPO_URL, published: date, title: "AI Tested four-AIs run logs: <job>-<ai>.json, VERDICTS.json" }] };
}
