// Visual director: beat splitting/timing, schema, every hard gate, the corrective retry, and re-direct.
// No network: the model is an injected function. Fixtures: scripts/__tests__/fixtures/vd/director/
// (hand-made test data, labelled as such inside each file).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { gateDirection, schemaFailures, namedEntitiesIn, isQuantityComparison, implicatedBeats } from "../visual-director/gate.mjs";
import { sentenceSpans, splitNarration, readTimings, timedBeats, contextFor, direct, buildPrompt, beatSchemaForPrompt, normaliseBeat } from "../visual-director/direct.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const F = join(HERE, "fixtures", "vd", "director");
const SCRIPT = join(F, "script.json"), RESEARCH = join(F, "research.json"), TTS = join(F, "tts");
const good = () => JSON.parse(readFileSync(join(F, "good-direction.json"), "utf8"));
const ctx = () => contextFor({ scriptPath: SCRIPT, researchPath: RESEARCH, ttsDir: TTS }).gate;
const rules = (fails) => [...new Set(fails.map((f) => f.rule))].sort();
const failsOn = (d, rule) => gateDirection(d, ctx()).filter((f) => f.rule === rule);

// ── beats ─────────────────────────────────────────────────────────
test("splitting the committed Great Fire shorts script matches the voiceover's own split", () => {
  const script = JSON.parse(readFileSync(join(ROOT, "data", "research", "4", "great-fire-of-london-shorts-script.json"), "utf8"));
  const s = splitNarration(script).map((x) => x.text);
  assert.deepEqual(s, [
    "The Great Fire of London wasn't just a disaster—it was a story of human error, institutional failure, and remarkable resilience.",
    "From Samuel Pepys burying his cheese to the Lord Mayor's catastrophic decision-making, the fire reveals how a city's character is forged in crisis..",
    "Here's what nobody tells you.",
    // no full stop before the blank line: tts_words.py's \n\s*\n alternative ends the sentence there
    "The Great Fire of London started on September 2, 1666 in Thomas Farriner's bakery on Pudding Lane",
    "But here's the part that changes everything: The fire burned for 4 days, destroying 13,200 houses, 87 churches, and most of the City of London",
    "Follow for more stories history forgot.",
  ]);
  const t = timedBeats(script);
  assert.equal(t.source, "estimated");
  assert.match(t.warn, /ESTIMATED/);
  for (let i = 1; i < t.sentences.length; i++) assert.ok(t.sentences[i].start >= t.sentences[i - 1].end - 1e-9);
});

test("sentenceSpans keeps tts_words.py's abbreviation rule", () => {
  const text = "Dr. Smith met Mr. Jones in the U.S. on Monday. Then he left!\n\nA new paragraph";
  const parts = sentenceSpans(text).map(([a, b]) => text.slice(a, b).trim());
  assert.deepEqual(parts, ["Dr. Smith met Mr. Jones in the U.S. on Monday.", "Then he left!", "A new paragraph"]);
});

test("with --tts the voiceover's cues are the beats and their timings", () => {
  const t = readTimings(TTS, SCRIPT);
  assert.equal(t.sentences.length, 5);
  assert.deepEqual(t.sentences[1], { text: "In four days it destroyed 13,200 houses and 87 churches.", start: 3.4, end: 6.36 });
  assert.equal(t.voiceoverEnd, 14.76);
  const tb = timedBeats(JSON.parse(readFileSync(SCRIPT, "utf8")), t);
  assert.equal(tb.source, "tts");
  assert.equal(tb.warn, null, "the fixture's narration split agrees with its cues");
});

test("--tts with no words file fails loudly instead of modelling timings", () => {
  const empty = mkdtempSync(join(tmpdir(), "vd-tts-"));
  assert.throws(() => readTimings(empty, SCRIPT), /no script-vo-words\.json/);
});

// ── schema + gates ────────────────────────────────────────────────
test("the good fixture is schema-valid and passes every gate", () => {
  assert.deepEqual(schemaFailures(good()), []);
  assert.deepEqual(gateDirection(good(), ctx()), []);
});

test("schema: a beat with a 'visual type' field is rejected", () => {
  const d = good(); d.beats[2].visual_type = "bar-chart";
  const f = failsOn(d, "schema");
  assert.ok(f.length && f[0].beat_index === 2, JSON.stringify(f));
});

test("beat-count / sentence / timing", () => {
  let d = good(); d.beats.pop();
  assert.ok(failsOn(d, "beat-count").length);
  d = good(); d.beats[1].sentence = "A paraphrase of the sentence.";
  assert.equal(failsOn(d, "sentence")[0].beat_index, 1);
  d = good(); d.beats[4].t_end = 20; d.beats[4].shots[0].duration_s = 20 - d.beats[4].t_start;
  assert.match(failsOn(d, "timing")[0].detail, /past the voiceover end/);
  d = good(); d.beats[2].t_start = 1;
  assert.ok(failsOn(d, "timing").some((f) => f.beat_index === 2));
});

test("shot-id / shot-durations", () => {
  let d = good(); d.beats[3].shots[1].id = "b9s1";
  assert.equal(failsOn(d, "shot-id")[0].beat_index, 3);
  d = good(); d.beats[0].shots[0].duration_s = 9;
  assert.equal(failsOn(d, "shot-durations")[0].beat_index, 0);
});

test("statement-cap: 5 beats allow one statement beat", () => {
  const d = good(); d.beats[2].mechanism.family = "statement";
  const f = failsOn(d, "statement-cap");
  assert.deepEqual(f.map((x) => x.beat_index).sort(), [2, 4]);
});

test("family-share: no family on more than 40 % of beats", () => {
  const d = good();
  for (const i of [0, 2, 3]) d.beats[i].mechanism.family = "transfer";
  const f = failsOn(d, "family-share");
  assert.equal(f.length, 1); assert.equal(f[0].beat_index, null);
  assert.deepEqual(implicatedBeats(f, d), [2, 3], "the over-used family's later beats are sent back, the first kept");
});

test("adjacent-repeat: same family and same camera on neighbours", () => {
  const d = good(); d.beats[2].mechanism.family = "accumulation"; d.beats[2].shots[0].camera.move = "tilt";
  assert.equal(failsOn(d, "adjacent-repeat")[0].beat_index, 2);
});

test("data-unsourced / data-not-quantity / chart-outside-data", () => {
  let d = good(); d.beats[1].shots[0].materials[1].data.values[0].source_url = "https://made-up.example/stats";
  assert.match(failsOn(d, "data-unsourced")[0].detail, /not in the script's sources_used/);
  d = good(); d.beats[1].shots[0].materials[1].data = null;
  assert.match(failsOn(d, "data-unsourced")[0].detail, /no data.values/);
  d = good(); d.beats[2].shots[0].materials.push(JSON.parse(JSON.stringify(good().beats[1].shots[0].materials[1])));
  assert.equal(failsOn(d, "data-not-quantity")[0].beat_index, 2);
  d = good(); d.beats[2].mechanism.construction = "A bar chart of wind speed per day rises beside the painting of the fire.";
  assert.equal(failsOn(d, "chart-outside-data")[0].beat_index, 2);
  d = good(); d.beats[3].shots[0].action = "a timeline of the days slides under the portrait of Pepys";
  assert.equal(failsOn(d, "chart-outside-data")[0].beat_index, 3);
});

test("evidence-unsourced", () => {
  const d = good(); d.beats[0].evidence = ["https://en.wikipedia.org/wiki/Great_Fire_of_London"];
  assert.equal(failsOn(d, "evidence-unsourced")[0].beat_index, 0);
});

test("entity-unshown: a named person the sentence turns on must be in a must_show", () => {
  const d = good();
  d.beats[3].shots[0].materials[0].must_show = "a seventeenth-century gentleman in a wig";
  d.beats[3].shots[1].materials[0].must_show = "a handwritten diary page";
  const f = failsOn(d, "entity-unshown");
  assert.equal(f.length, 1); assert.match(f[0].detail, /Samuel Pepys/);
});

test("namedEntitiesIn / isQuantityComparison on real sentences", () => {
  assert.deepEqual(namedEntitiesIn("The Great Fire of London started on September 2, 1666 in Thomas Farriner's bakery on Pudding Lane"), ["Great Fire of London", "Thomas Farriner", "Pudding Lane"]);
  assert.deepEqual(namedEntitiesIn("From Samuel Pepys burying his cheese to the Lord Mayor's catastrophic decision-making."), ["Samuel Pepys", "Lord Mayor"]);
  assert.deepEqual(namedEntitiesIn("Here's what nobody tells you."), []);
  assert.equal(isQuantityComparison("It started on September 2, 1666 in a bakery"), false, "a date is not a quantity");
  assert.equal(isQuantityComparison("The fire burned for 4 days, destroying 13,200 houses, 87 churches"), true);
});

test("camera-motivation: reveal must go close -> wide; hold needs a reason; comparison needs A then B", () => {
  let d = good(); Object.assign(d.beats[0].shots[0].camera, { move: "push-in", from: "the whole map", to: "the bakery doorway" });
  assert.equal(failsOn(d, "camera-motivation")[0].beat_index, 0);
  d = good(); d.beats[4].shots[0].camera.motivation = "static shot";
  assert.equal(failsOn(d, "camera-motivation")[0].beat_index, 4);
  d = good(); d.beats[2].mechanism.family = "comparative-transformation"; d.beats[2].shots[0].camera.move = "push-in";
  assert.equal(failsOn(d, "camera-motivation")[0].beat_index, 2);
});

test("action-unanchored: text standing in for a picture", () => {
  const d = good(); d.beats[2].shots[0].action = "the words WEST WIND type on letter by letter";
  assert.equal(failsOn(d, "action-unanchored")[0].beat_index, 2);
});

test("reject-list: glows, particles, icons, cards", () => {
  const d = good(); d.beats[2].shots[0].action = "embers drift as particles over the painting while the smoke glows";
  d.beats[3].mechanism.construction = "An icon of a cheese wheel sits on an info card beside the portrait of Samuel Pepys.";
  const f = failsOn(d, "reject-list");
  assert.deepEqual([...new Set(f.map((x) => x.beat_index))], [2, 3]);
  assert.ok(f.some((x) => /particles/.test(x.detail)) && f.some((x) => /glow/.test(x.detail)) && f.some((x) => /icon/.test(x.detail)) && f.some((x) => /card/.test(x.detail)));
});

test("colour: no colour values or grades in a direction", () => {
  let d = good(); d.beats[0].shots[0].text.placement = "beside the lane in #D4A574";
  assert.equal(failsOn(d, "colour")[0].beat_index, 0);
  d = good(); d.beats[2].mechanism.construction = "The painting with a warm colour grade, tracked right-to-left across the burning skyline.";
  assert.equal(failsOn(d, "colour")[0].beat_index, 2);
});

test("gate.mjs CLI exits 0 on the good fixture and 1 with the failures printed", () => {
  const cli = join(ROOT, "scripts", "visual-director", "gate.mjs");
  const ok = spawnSync(process.execPath, [cli, "--direction", join(F, "good-direction.json"), "--script", SCRIPT, "--research", RESEARCH, "--tts", TTS], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr + ok.stdout);
  const bad = good(); bad.beats[2].shots[0].action = "particles glow";
  const p = join(mkdtempSync(join(tmpdir(), "vd-")), "bad.json"); writeFileSync(p, JSON.stringify(bad));
  const r = spawnSync(process.execPath, [cli, "--direction", p, "--script", SCRIPT, "--research", RESEARCH, "--tts", TTS], { encoding: "utf8" });
  assert.equal(r.status, 1); assert.match(r.stdout, /beat 2 reject-list/);
});

// ── the director with a mocked model ──────────────────────────────
// The mock answers with the good fixture's creative fields for whatever beats the prompt asks for,
// with ids/durations/timings deliberately wrong so the normalisation is exercised.
const targetsOf = (prompt) => [...prompt.split("## DIRECT THESE BEATS")[1].matchAll(/^beat_index (\d+)\s/gm)].map((m) => +m[1]);
const creative = (b) => { const o = JSON.parse(JSON.stringify(b)); delete o.status; o.t_start = 99; o.sentence = "wrong"; o.shots.forEach((s) => { s.id = "x"; s.duration_s = 1; }); return o; };
function mockModel(overrides = []) {
  const calls = [];
  const fn = async (messages) => {
    const prompt = messages[0].content; calls.push(prompt);
    const g = good(); const round = calls.length - 1;
    const tweak = overrides[round] || (() => {});
    return { beats: targetsOf(prompt).map((i) => { const b = creative(g.beats[i]); tweak(b, i); return b; }) };
  };
  fn.calls = calls;
  return fn;
}
const quiet = () => {};

test("direct(): a clean answer becomes the good direction (timings, ids, durations from the voiceover)", async () => {
  const m = mockModel();
  const { direction, failures } = await direct({ scriptPath: SCRIPT, researchPath: RESEARCH, ttsDir: TTS, channelId: "1", callModel: m, log: quiet, model: "fixture" });
  assert.deepEqual(failures, []);
  assert.equal(m.calls.length, 1);
  assert.deepEqual(schemaFailures(direction), []);
  assert.equal(JSON.stringify(direction.beats), JSON.stringify(good().beats));
  assert.equal(direction.gate_failures, undefined);
  // the prompt carries research facts WITH their URLs and the sources_used list
  assert.match(m.calls[0], /Pudding Lane in September 1666\. — https:\/\/www\.britannica\.com/);
  assert.match(m.calls[0], /SOURCES USED[\s\S]*museumoflondon/);
  assert.doesNotMatch(m.calls[0], /\{\{\w+\}\}/, "every template slot is filled");
});

test("direct(): gate failures get ONE corrective retry naming them; a fix is kept", async () => {
  const m = mockModel([(b, i) => { if (i === 2) b.shots[0].action = "particles drift over the painting"; }]);
  const { direction, failures } = await direct({ scriptPath: SCRIPT, researchPath: RESEARCH, ttsDir: TTS, channelId: "1", callModel: m, log: quiet, model: "fixture" });
  assert.equal(m.calls.length, 2);
  assert.deepEqual(targetsOf(m.calls[1]), [2], "only the failing beat is re-asked");
  assert.match(m.calls[1], /FAILED THESE CHECKS[\s\S]*beat 2 reject-list/);
  assert.deepEqual(failures, []);
  assert.equal(direction.beats[2].shots[0].action, good().beats[2].shots[0].action);
});

test("direct(): failures that survive the retry are written as gate_failures; no beat is dropped", async () => {
  const bad = (b, i) => { if (i === 3) b.shots[0].action = "an icon of a cheese wheel appears"; };
  const m = mockModel([bad, bad]);
  const { direction, failures } = await direct({ scriptPath: SCRIPT, researchPath: RESEARCH, ttsDir: TTS, channelId: "1", callModel: m, log: quiet, model: "fixture" });
  assert.equal(m.calls.length, 2);
  assert.equal(direction.beats.length, 5);
  assert.deepEqual(rules(direction.gate_failures), rules(failures));
  assert.ok(direction.gate_failures.every((f) => f.beat_index === 3));
  assert.ok(rules(failures).includes("reject-list"));
  assert.deepEqual(schemaFailures(direction), [], "gate_failures is part of the contract");
});

test("direct(): a schema failure that survives the retry fails loudly", async () => {
  const bad = (b, i) => { if (i === 0) delete b.mechanism; };
  const m = mockModel([bad, bad]);
  await assert.rejects(direct({ scriptPath: SCRIPT, researchPath: RESEARCH, ttsDir: TTS, channelId: "1", callModel: m, log: quiet, model: "fixture" }), (e) => /not schema-valid/.test(e.message) && e.direction?.gate_failures?.some((f) => f.rule === "schema"));
});

test("direct(): an unusable answer (wrong beat count) is retried once, then throws", async () => {
  const calls = [];
  const m = async (msgs) => { calls.push(msgs); return { beats: [] }; };
  await assert.rejects(direct({ scriptPath: SCRIPT, researchPath: RESEARCH, ttsDir: TTS, channelId: "1", callModel: m, log: quiet, model: "fixture" }), /no usable model answer/);
  assert.equal(calls.length, 2);
  const err = async () => ({ source: "gemini", error: "quota_exhausted", detail: "all keys" });
  await assert.rejects(direct({ scriptPath: SCRIPT, researchPath: RESEARCH, ttsDir: TTS, channelId: "1", callModel: err, log: quiet }), /quota_exhausted/);
});

test("re-direct: only the critiqued beats change; every other beat is byte-identical", async () => {
  const previous = good();
  const critique = { scenes: [{ beat_index: 2, verdict: "DELETE", reasons: ["the painting reads as decoration; nothing shows the wind moving the fire"] }] };
  const m = mockModel([(b, i) => { if (i === 2) { b.mechanism.construction = "Two engravings of the same street, before and after, the smoke in the second leaning west over the burned roofs."; b.shots[0].camera.move = "pan"; } }]);
  const { direction } = await direct({ scriptPath: SCRIPT, researchPath: RESEARCH, ttsDir: TTS, channelId: "1", previous, critique, beats: [2], callModel: m, log: quiet, model: "fixture" });
  assert.equal(m.calls.length, 1);
  assert.deepEqual(targetsOf(m.calls[0]), [2]);
  assert.match(m.calls[0], /Do NOT patch it/);
  assert.match(m.calls[0], /nothing shows the wind moving the fire/);
  assert.match(m.calls[0], /previous: flow — A painting of the fire/, "the old construction is shown so it is not repeated");
  for (const i of [0, 1, 3, 4]) assert.equal(JSON.stringify(direction.beats[i]), JSON.stringify(previous.beats[i]), `beat ${i} untouched`);
  assert.equal(direction.beats[2].status, "rebuilt");
  assert.equal(direction.beats[2].critic_history.length, 1);
  assert.equal(direction.beats[2].critic_history[0].verdict.verdict, "DELETE");
  assert.match(direction.beats[2].mechanism.construction, /^Two engravings/);
});

test("re-direct refuses beats outside the narration and a missing previous direction", async () => {
  const m = mockModel();
  await assert.rejects(direct({ scriptPath: SCRIPT, researchPath: RESEARCH, ttsDir: TTS, channelId: "1", previous: good(), critique: {}, beats: [9], callModel: m, log: quiet }), /outside/);
  await assert.rejects(direct({ scriptPath: SCRIPT, researchPath: RESEARCH, ttsDir: TTS, channelId: "1", previous: null, critique: {}, beats: [1], callModel: m, log: quiet }), /existing direction/);
});

test("prompt: beat schema has no director-forbidden fields; no colour from channels.json leaks in", () => {
  const s = beatSchemaForPrompt();
  assert.equal(s.properties.status, undefined);
  assert.equal(s.properties.shots.items.properties.materials.items.properties.resolved, undefined);
  const c = contextFor({ scriptPath: SCRIPT, researchPath: RESEARCH, ttsDir: TTS });
  const channels = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf8"));
  const ch = (Array.isArray(channels) ? channels : channels.channels).find((x) => String(x.id) === "1");
  const p = buildPrompt({ channel: ch, channelId: "1", sentences: c.sentences, targets: [0, 1], digest: c.digest, sourcesUsed: c.sourcesUsed, reference: null });
  assert.doesNotMatch(p.split("## Output")[0], /#[0-9a-f]{6}\b/i, "no hex colour in the prompt body");
  assert.match(p, /how do you make an absence visible/, "the worked example is present");
  assert.doesNotMatch(p.split("## DIRECT THESE BEATS")[1], /beat_index 2\s/);
});

test("normaliseBeat scales shot durations to the beat and renumbers ids", () => {
  const b = normaliseBeat({ shots: [{ id: "q", duration_s: 1 }, { id: "r", duration_s: 3 }] }, 7, { text: "x", start: 10, end: 12 });
  assert.deepEqual(b.shots.map((s) => [s.id, s.duration_s]), [["b7s0", 0.5], ["b7s1", 1.5]]);
  assert.equal(b.t_start, 10); assert.equal(b.status, "directed");
});
