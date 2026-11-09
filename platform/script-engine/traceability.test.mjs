/**
 * Script -> scene -> visual traceability, and duration across script, narration and MP4.
 * The claims are the REAL workers research (fixtures/real/workers.research.json). The scene plans and the audio and
 * video durations are CONSTRUCTED: no scene plan or MP4 exists for the failing scripts, so each defect is built in
 * deliberately and labelled by what it breaks.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { durationProblems, estimateSeconds, capacityWords, wpmFrom, DEFAULT_WPM } from "./duration.mjs";
import { scriptTraceability, sceneTraceability, sceneSeeds } from "./traceability.mjs";
import { workersGood } from "./testkit.mjs";

const { pkg, claims, ids } = workersGood();
const url = claims.find((c) => c.claim_id === ids.us).source_url;
const scene = (n, from, to, extra = {}) => {
  const run = pkg.sentences.slice(from, to);
  return { scene_id: `scene-${n}`, narration: run.map((s) => s.text).join(" "), main_point: run[0].role, visual_objective: "Show the rates the narration states", treatment: "bars", background: "white", skill: "chart", assets: [], animation: "bars appear", on_screen_text: run.map((s) => s.on_screen_text), claim_ids: [...new Set(run.flatMap((s) => s.claim_ids))], data_sources: [...new Set(run.flatMap((s) => s.claim_ids).map((id) => claims.find((c) => c.claim_id === id).source_url))], transition: "cut", ...extra };
};
const plan = (scenes) => ({ channel: "world-view", production_run: "constructed", format: "short", scenes });
const CHART = { type: "bar", unit: "percent", axis_min: 0, series: [{ label: "U.S. workers asked back", value: 19 }, { label: "United Kingdom workers asked back", value: 13 }, { label: "Combined United States and United Kingdom workers asked back", value: 16 }] };
const good = () => plan([scene(1, 0, 3, { chart: CHART }), scene(2, 3, 4)]);
const rules = (p) => sceneTraceability(p, pkg, claims).map((f) => `${f.rule} ${f.severity}`);
const problems = (p) => sceneTraceability(p, pkg, claims);

test("script traceability: the good script has no open finding; seeds carry the claims and timings", () => {
  assert.deepEqual(scriptTraceability(pkg, claims).filter((f) => f.severity !== "minor"), []);
  const { seeds } = sceneSeeds(pkg, { wpm: 150 }, { channel: "world-view", production_run: "t" });
  assert.equal(seeds.length, 4);
  assert.deepEqual(seeds[0].claim_ids, [ids.us]);
  assert.deepEqual(seeds[0].data_sources, [url]);
  assert.ok(seeds[1].start_s >= seeds[0].end_s - 0.05);
});

test("script traceability: figures, names, quotations and strong verbs must come from the sentence's claims", () => {
  const bad = structuredClone(pkg);
  bad.sentences[1].text = "In Canada, the rate was always 13 percent, and 41 percent said \"we were all asked to come back by the same boss\".";
  const f = scriptTraceability(bad, claims);
  assert.ok(f.some((x) => x.rule === "TRC-03" && /figure 41/.test(x.problem)), "invented figure");
  assert.ok(f.some((x) => x.rule === "TRC-04" && /Canada/.test(x.problem)), "invented name");
  assert.ok(f.some((x) => x.rule === "TRC-06" && /always/.test(x.problem)), "verb stronger than the claim");
  assert.ok(f.some((x) => x.rule === "TRC-05" && x.severity === "critical"), "quotation not verbatim in any excerpt");
  const missing = structuredClone(pkg);
  missing.sentences[0].claim_ids = ["c999"];
  assert.ok(scriptTraceability(missing, claims).some((x) => x.rule === "TRC-01"));
});

test("a scene plan that matches the script and its claims passes, chart included", () => {
  assert.deepEqual(problems(good()), []);
});

test("CONSTRUCTED visual/narration mismatch: scene narration that is not the script's words", () => {
  const p = good();
  p.scenes[1].narration = "So the U.S. rate is far higher than the combined rate.";
  assert.ok(rules(p).includes("SCN-01 critical"));
});

test("CONSTRUCTED visual/narration mismatch: a sentence in no scene, and claims dropped or invented by a scene", () => {
  const p = good();
  p.scenes.pop();
  assert.ok(problems(p).some((f) => f.rule === "SCN-01" && /is in no scene/.test(f.problem)));
  const q = good();
  q.scenes[0].claim_ids = q.scenes[0].claim_ids.slice(1).concat("c999");
  const r = problems(q);
  assert.ok(r.some((f) => f.rule === "SCN-02" && /unknown claim c999/.test(f.problem)));
  assert.ok(r.some((f) => f.rule === "SCN-02" && /drops claim/.test(f.problem)));
  const w = good();
  w.scenes[1].claim_ids = [ids.uk, ...w.scenes[1].claim_ids];
  assert.ok(problems(w).some((f) => f.rule === "SCN-02" && /none of its sentences rests on/.test(f.problem)));
});

test("CONSTRUCTED incorrect chart unit: 19 plotted as dollars when the claim says percent", () => {
  const p = good();
  p.scenes[0].chart = { ...CHART, unit: "USD" };
  const f = problems(p).filter((x) => x.rule === "SCN-05");
  assert.ok(f.length >= 3 && f.every((x) => x.severity === "critical" && /Chart plots \d+ as "USD" but the claim gives it as %/.test(x.problem)), JSON.stringify(f.map((x) => x.problem)));
});

test("CONSTRUCTED incorrect chart label: the United Kingdom's label on the U.S. value", () => {
  const p = good();
  p.scenes[0].chart = { ...CHART, series: [{ label: "United Kingdom workers asked back", value: 19 }, CHART.series[1], CHART.series[2]] };
  const f = problems(p).filter((x) => x.rule === "SCN-05");
  assert.ok(f.some((x) => /label "United Kingdom workers asked back" does not match/.test(x.problem) && /19/.test(x.problem)), JSON.stringify(f));
});

test("CONSTRUCTED chart: a value in no claim, and a bar axis that does not start at zero", () => {
  const p = good();
  p.scenes[0].chart = { ...CHART, axis_min: 10, series: [...CHART.series.slice(0, 2), { label: "Combined", value: 21 }] };
  const f = problems(p).filter((x) => x.rule === "SCN-05");
  assert.ok(f.some((x) => /value 21/.test(x.problem) && x.severity === "critical"));
  assert.ok(f.some((x) => /starts at 10/.test(x.problem)));
});

test("CONSTRUCTED visual implies what the claims do not establish: an unsourced figure, wrong unit, name and trend on screen", () => {
  const p = good();
  p.scenes[1].on_screen_text = ["Canada: 12%", "$19", "25%"];
  p.scenes[1].animation = "the line is rising sharply";
  const f = problems(p).filter((x) => x.rule === "SCN-04").map((x) => x.problem).join(" | ");
  assert.match(f, /figure 25 is in neither/);
  assert.match(f, /"\$19" has unit "usd"/);
  assert.match(f, /name "Canada"/);
  assert.match(f, /implies a trend/);
});

test("CONSTRUCTED data source: a source URL that is not a source of the scene's claims", () => {
  const p = good();
  p.scenes[1].data_sources = ["https://example.test/not-a-source"];
  assert.ok(rules(p).includes("SCN-03 major"));
});

test("duration: the estimate comes from measured words per minute; the default is labelled as a default", () => {
  assert.equal(estimateSeconds(Array(60).fill("w").join(" "), 180), 20);
  assert.equal(capacityWords(27, 180), 81);
  assert.deepEqual(wpmFrom(null), { wpm: DEFAULT_WPM, source: "default", voice: null });
  assert.equal(wpmFrom({ voice: "v", wpm: 171.2, source: "measured" }).source, "measured");
});

test("CONSTRUCTED duration mismatch between script, narration and MP4 (no MP4 exists for the failing scripts; numbers are constructed)", () => {
  const ok = durationProblems({ estimate_s: 27, narration_s: 27.8, mp4_s: 28.2, max_s: 29, min_s: 18 });
  assert.deepEqual(ok, []);
  const drift = durationProblems({ estimate_s: 27, narration_s: 41.3, mp4_s: 41.5, max_s: 29, min_s: 18 });
  assert.ok(drift.some((d) => /measured narration is 41.3s against an estimate of 27s/.test(d.problem)));
  assert.ok(drift.some((d) => d.severity === "critical" && /narration runs 41.3s/.test(d.problem)));
  assert.ok(drift.some((d) => d.severity === "critical" && /MP4 runs 41.5s/.test(d.problem)));
  const apart = durationProblems({ estimate_s: 27, narration_s: 27, mp4_s: 29.5, max_s: 29, min_s: 18 });
  assert.ok(apart.some((d) => /MP4 \(29.5s\) and the narration \(27s\) differ/.test(d.problem)));
  assert.ok(durationProblems({ estimate_s: 12, max_s: 29, min_s: 18 }).some((d) => /minimum is 18s/.test(d.problem)));
  assert.ok(durationProblems({ estimate_s: 31.6, max_s: 29 }).every((d) => /Narrow the story/.test(d.fix)), "the fix is never 'speak faster'");
});
