// Visual-director critic: JSON validation, not_run path, no fabricated verdicts, escalation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCritic, validateScene, effectiveVerdict, buildScenePrompt } from "../visual-director/critic.mjs";
import { planFrameTimes } from "../visual-director/frames.mjs";

const beat = (i) => ({ beat_index: i, sentence: `Sentence ${i}.`, t_start: i * 3, t_end: i * 3 + 3, mute_test: "viewer sees the river of fire cross the bridge",
  mechanism: { family: "flow", construction: "fire crosses the bridge on the 1666 map", why: "shows spread" },
  shots: [{ id: `b${i}s1`, duration_s: 3, camera: { move: "push-in", from: "wide", to: "close", motivation: "follow the flow" }, action: "fire spreads along the street",
    materials: [{ id: "m1", kind: "map", must_show: "1666 map of London", why: "place", search: ["1666 London map"] }] }] });
const direction = { schema_version: 1, channel_id: "4", script: "s.json", beats: [beat(0), beat(1), beat(2)] };
const tmp = mkdtempSync(join(tmpdir(), "vdc-"));
const jpg = join(tmp, "x.jpg"); writeFileSync(jpg, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
const index = { frames: direction.beats.flatMap((b) => [{ beat_index: b.beat_index, kind: "start", file: jpg }]), strips: { 0: jpg, 1: jpg, 2: jpg }, sheet: jpg };
const good = (i, verdict = "KEEP", over = {}) => ({ beat_index: i, visibly_happening: "a map with flames moving east", relationship_communicated: "spread",
  understood_muted: "yes", template_or_decorative: { answer: "no", why: "built for this" }, material_believable_and_correct: { answer: "yes", why: "real map" },
  camera_contributes: { answer: "yes", why: "follows" }, verdict, what_to_change: verdict === "REBUILD" ? "show the bridge itself burning, not a label" : null,
  delete_reason: verdict === "DELETE" ? "a map does not convey the human cost at all" : null, ...over });
const whole = { template_alternation: "no", template_alternation_why: "varied", whole_mute_test: "partly", whole_mute_test_why: "follows the fire", worst_beats: [1] };

test("valid scene answers pass; missing fields and REBUILD without what_to_change fail", () => {
  assert.equal(validateScene(good(0)).valid, true);
  const { verdict, ...noVerdict } = good(0);
  assert.equal(validateScene(noVerdict).valid, false);
  assert.equal(validateScene(good(0, "REBUILD", { what_to_change: null })).valid, false);
  assert.equal(validateScene(good(0, "DELETE", { delete_reason: "" })).valid, false);
  assert.equal(validateScene(good(0, "MAYBE")).valid, false);
});

test("no key -> every scene not_run with a reason, verdict null (never fabricated)", async () => {
  const saved = {};
  for (const k of Object.keys(process.env)) if (/GEMINI|GOOGLE_GENERATIVE|OPENROUTER/.test(k)) { saved[k] = process.env[k]; delete process.env[k]; }
  try {
    const doc = await runCritic({ direction, index });
    assert.equal(doc.status, "not_run");
    assert.equal(doc.scenes.length, 3);
    for (const s of doc.scenes) { assert.equal(s.status, "not_run"); assert.equal(s.verdict, null); assert.equal(s.effective_verdict, null); assert.match(s.reason, /key/); }
    assert.equal(doc.whole_video.status, "not_run");
  } finally { Object.assign(process.env, saved); }
});

test("provider error -> not_run for that scene; others answered; usage and model recorded", async () => {
  const call = async (messages) => {
    const p = messages[0].content[0].text;
    if (p.includes("contact sheet")) return { value: whole, model: "fake-m", usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
    if (p.includes("Sentence 1.")) return { error: "quota_exhausted", detail: "429" };
    return { value: good(Number(p.match(/Sentence (\d)/)[1])), model: "fake-m", usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } };
  };
  const doc = await runCritic({ direction, index, call, model: "fake-m" });
  assert.equal(doc.status, "partial");
  assert.deepEqual(doc.scenes.map((s) => s.status), ["answered", "not_run", "answered"]);
  assert.equal(doc.scenes[1].verdict, null);
  assert.match(doc.scenes[1].reason, /quota_exhausted/);
  assert.equal(doc.scenes[0].model, "fake-m");
  assert.equal(doc.usage_total.total_tokens, 120 + 120 + 15);
  assert.equal(doc.whole_video.status, "answered");
});

test("invalid JSON gets one corrective retry, then recorded invalid with no verdict", async () => {
  let calls = 0;
  const call = async (messages) => { calls++; return messages[0].content[0].text.includes("contact sheet") ? { value: whole } : { value: { verdict: "KEEP" } }; };
  const doc = await runCritic({ direction: { ...direction, beats: [beat(0)] }, index, call });
  assert.equal(doc.scenes[0].status, "invalid");
  assert.equal(doc.scenes[0].attempts, 2);
  assert.equal(doc.scenes[0].effective_verdict, null);
  assert.equal(calls, 3);
});

test("retry that fixes the JSON is accepted", async () => {
  let n = 0;
  const call = async (messages) => messages[0].content[0].text.includes("contact sheet") ? { value: whole } : (++n === 1 ? { value: { verdict: "KEEP" } } : { value: good(0, "DELETE") });
  const doc = await runCritic({ direction: { ...direction, beats: [beat(0)] }, index, call });
  assert.equal(doc.scenes[0].status, "answered");
  assert.equal(doc.scenes[0].effective_verdict, "DELETE");
});

test("KEEP contradicted by the critic's own answers is escalated to REBUILD, with the reason recorded", () => {
  assert.deepEqual(effectiveVerdict(good(0)), { verdict: "KEEP", escalated: null });
  const e = effectiveVerdict(good(0, "KEEP", { template_or_decorative: { answer: "yes", why: "generic number card" } }));
  assert.equal(e.verdict, "REBUILD"); assert.match(e.escalated, /generic number card/);
  assert.equal(effectiveVerdict(good(0, "KEEP", { understood_muted: "no" })).verdict, "REBUILD");
  assert.equal(effectiveVerdict(good(0, "DELETE")).verdict, "DELETE");
  assert.equal(effectiveVerdict(null).verdict, null);
});

test("prompt offers DELETE and never asks to preserve work", () => {
  const p = buildScenePrompt(beat(0));
  assert.match(p, /DELETE/);
  assert.match(p, /not asked to save this scene/);
  assert.doesNotMatch(p, /preserve (the )?existing|keep as much/i);
  assert.match(p, /1666 map of London/);
});

test("frame plan: start/mid/end per shot and 0.5 s cadence, inside the beat", () => {
  const d = { beats: [{ beat_index: 0, t_start: 0, t_end: 3, shots: [{ id: "b0s1", duration_s: 1.5 }, { id: "b0s2", duration_s: 1.5 }] }] };
  const f = planFrameTimes(d);
  for (const id of ["b0s1", "b0s2"]) for (const k of ["start", "mid", "end"]) assert.ok(f.find((x) => x.shot_id === id && x.kind === k), `${id} ${k}`);
  assert.ok(f.filter((x) => x.kind === "cadence").length >= 4);
  assert.ok(f.every((x) => x.t >= 0 && x.t < 3));
  assert.equal(f.find((x) => x.shot_id === "b0s2" && x.kind === "start").t, 1.56);
});
