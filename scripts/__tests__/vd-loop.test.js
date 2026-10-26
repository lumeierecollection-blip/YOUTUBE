// Visual-director loop: bounds, only REBUILD/DELETE beats re-directed, others untouched, materials redirect, comparison.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLoop, spliceBeats, beatsToRebuild, essentialMissing, finalStatus, parseGateFailures } from "../visual-director/loop.mjs";

const mkBeat = (i, tag) => ({ beat_index: i, sentence: `S${i}.`, t_start: i * 2, t_end: i * 2 + 2, mute_test: "something visible here",
  semantic: { subject: "x", state: null, action: null, relationship: null, change: null, consequence: null, environment: null },
  visual_question: "how to show this sentence?", mechanism: { family: "reveal", construction: `construction ${tag} for beat ${i}`, why: "because it reveals" },
  shots: [{ id: `b${i}s1`, duration_s: 2, camera: { move: "pull-out", from: "close", to: "wide", motivation: "reveal" }, action: "the thing is revealed",
    materials: [{ id: "m", kind: "photo", must_show: "the real thing", why: "needed", search: ["q"] }] }] });

/** Fake steps. `verdicts[round][beat]` scripts the critic; `missing` scripts the materials report for round 0's first resolve. */
function fakes({ verdicts, missing = [], n = 4 }) {
  const calls = { direct: [], render: 0, critic: [], resolve: 0 };
  let directCount = 0;
  const steps = {
    direct: async ({ out, critique, beats }) => {
      directCount++;
      calls.direct.push({ critique: !!critique, beats: beats ? [...beats] : null });
      // The fake director rewrites EVERY beat when re-directing, to prove the loop splices only the targets.
      writeFileSync(out, JSON.stringify({ schema_version: 1, channel_id: "4", script: "s.json", beats: Array.from({ length: n }, (_, i) => mkBeat(i, `v${directCount}`)) }));
      return { ok: true, status: 0 };
    },
    gate: async () => ({ ok: true, status: 0, stdout: "", stderr: "" }),
    resolve: async ({ direction, out, report }) => {
      calls.resolve++;
      writeFileSync(out, readFileSync(direction));
      writeFileSync(report, JSON.stringify({ beats: Array.from({ length: n }, (_, i) => ({ beat_index: i, essential_missing: calls.resolve === 1 && missing.includes(i) ? ["the real thing"] : [] })) }));
      return { ok: true, status: 0 };
    },
    render: async ({ out }) => { calls.render++; writeFileSync(out, "mp4"); return { ok: true, status: 0 }; },
    frames: async ({ outDir, direction }) => ({ sheet: join(outDir, "contact-sheet.jpg"), strips: Object.fromEntries(direction.beats.map((b) => [b.beat_index, join(outDir, `strips/beat-${b.beat_index}.jpg`)])), frames: [] }),
    critic: async ({ direction, round }) => {
      calls.critic.push(round);
      const v = verdicts[Math.min(round, verdicts.length - 1)];
      return { round, status: "complete", scenes: direction.beats.map((b) => ({ beat_index: b.beat_index, status: "answered", effective_verdict: v[b.beat_index],
        answer: { verdict: v[b.beat_index], what_to_change: v[b.beat_index] === "REBUILD" ? "show the actual object" : null, delete_reason: v[b.beat_index] === "DELETE" ? "wrong idea entirely" : null, visibly_happening: "stuff" } })),
        whole_video: { status: "answered", answer: { template_alternation: "partly", whole_mute_test: "no" } } };
    },
  };
  return { steps, calls };
}
const base = () => ({ script: "s.json", research: "r.json", tts: "tts", channel: "4", outDir: mkdtempSync(join(tmpdir(), "vdl-")) });

test("stops at VD_MAX_ROUNDS even when scenes keep failing", async () => {
  const { steps, calls } = fakes({ verdicts: [["REBUILD", "KEEP", "DELETE", "KEEP"]] });
  const rep = await runLoop({ ...base(), maxRounds: 2, steps });
  assert.equal(rep.rounds.length, 3); // round 0 + 2 rebuild rounds
  assert.equal(calls.render, 3);
  assert.match(rep.stop_reason, /VD_MAX_ROUNDS 2/);
  assert.deepEqual(rep.final.map((f) => f.status), ["unresolved", "kept", "unresolved", "kept"]);
});

test("only REBUILD/DELETE beats are re-directed; KEEP beats stay byte-identical", async () => {
  const { steps, calls } = fakes({ verdicts: [["KEEP", "REBUILD", "KEEP", "DELETE"], ["KEEP", "KEEP", "KEEP", "KEEP"]] });
  const o = base();
  const rep = await runLoop({ ...o, maxRounds: 2, steps });
  assert.deepEqual(calls.direct.map((c) => c.beats), [null, [1, 3]]);
  const r0 = JSON.parse(readFileSync(join(o.outDir, "round-0", "direction.json")));
  const r1 = JSON.parse(readFileSync(join(o.outDir, "round-1", "direction.json")));
  assert.deepEqual(r1.beats[0], r0.beats[0]);
  assert.deepEqual(r1.beats[2], r0.beats[2]);
  assert.notDeepEqual(r1.beats[1].mechanism, r0.beats[1].mechanism);
  assert.equal(r1.beats[1].status, "rebuilt");
  assert.equal(r1.beats[3].critic_history[0].verdict, "DELETE");
  assert.equal(rep.rounds.length, 2);
  assert.equal(rep.stop_reason, "no scene needs rebuilding");
  assert.deepEqual(rep.final.map((f) => f.status), ["kept", "rebuilt", "kept", "rebuilt"]);
});

test("VD_MAX_MS stops before a rebuild round", async () => {
  const { steps, calls } = fakes({ verdicts: [["REBUILD", "REBUILD", "REBUILD", "REBUILD"]] });
  let t = 0; const clock = () => (t += 1000);
  const rep = await runLoop({ ...base(), maxRounds: 5, maxMs: 1500, steps, clock });
  assert.equal(calls.render, 1);
  assert.match(rep.stop_reason, /VD_MAX_MS/);
});

test("materials essential_missing beats go back to the director before render", async () => {
  const { steps, calls } = fakes({ verdicts: [["KEEP", "KEEP", "KEEP", "KEEP"]], missing: [2] });
  const o = base();
  const rep = await runLoop({ ...o, maxRounds: 2, steps });
  assert.deepEqual(calls.direct.map((c) => c.beats), [null, [2]]);
  assert.equal(calls.render, 1);
  assert.deepEqual(rep.rounds[0].materials_redirected, [2]);
  const mc = JSON.parse(readFileSync(join(o.outDir, "round-0", "materials-critique.json")));
  assert.equal(mc.scenes[0].beat_index, 2);
  assert.match(mc.scenes[0].answer.what_to_change, /the real thing/);
});

test("a scene the critic did not answer ends unresolved, never kept", () => {
  const rounds = [{ round: 0, rebuilt: [], critic: { scenes: [{ beat_index: 0, status: "not_run", reason: "no key", effective_verdict: null }, { beat_index: 1, effective_verdict: "KEEP" }] } }];
  const f = finalStatus(rounds, [0, 1]);
  assert.equal(f[0].status, "unresolved"); assert.match(f[0].reason, /no key/);
  assert.equal(f[1].status, "kept");
  assert.deepEqual(beatsToRebuild(rounds[0].critic), []);
});

test("comparison.md lists each round's contact sheet and old vs new strips for rebuilt scenes", async () => {
  const { steps } = fakes({ verdicts: [["KEEP", "DELETE", "KEEP", "KEEP"], ["KEEP", "KEEP", "KEEP", "KEEP"]] });
  const o = base();
  await runLoop({ ...o, maxRounds: 2, steps });
  const md = readFileSync(join(o.outDir, "comparison.md"), "utf8");
  assert.match(md, /round 0: `round-0\/frames\/contact-sheet\.jpg`/);
  assert.match(md, /round 1: `round-1\/frames\/contact-sheet\.jpg`/);
  assert.match(md, /### b1: round 0 -> round 1/);
  assert.match(md, /old strip: `round-0\/frames\/strips\/beat-1\.jpg` - verdict DELETE/);
  assert.match(md, /DELETE - wrong idea entirely/);
  assert.match(md, /new strip: `round-1\/frames\/strips\/beat-1\.jpg` - verdict KEEP/);
  assert.match(md, /\| b1 \| DELETE \| KEEP \(rebuilt\) \| rebuilt \|/);
  assert.match(md, /template alternation: partly/);
  assert.ok(existsSync(join(o.outDir, "loop-report.json")));
});

test("re-direct gets the previous direction at --out (direct.mjs re-directs in place)", async () => {
  const { steps } = fakes({ verdicts: [["KEEP", "REBUILD", "KEEP", "KEEP"], ["KEEP", "KEEP", "KEEP", "KEEP"]] });
  const seen = [];
  const inner = steps.direct;
  steps.direct = async (a) => { if (a.critique) seen.push(existsSync(a.out) ? JSON.parse(readFileSync(a.out)).beats.length : 0); return inner(a); };
  await runLoop({ ...base(), maxRounds: 1, steps });
  assert.deepEqual(seen, [4]);
});

test("gate: enforce stops before render; record renders, marks the round and keeps the failures", async () => {
  const gateOut = "[vd-gate] beat 3 camera-motivation: \"push in\" is not motivated by the sentence\n[vd-gate] beat * family-share: 1 family for 4 beats\n[vd-gate] 2 failure(s)\n";
  const a = fakes({ verdicts: [["KEEP", "KEEP", "KEEP", "KEEP"]] });
  a.steps.gate = async () => ({ ok: false, status: 1, stdout: gateOut, stderr: "" });
  const rep = await runLoop({ ...base(), steps: a.steps });
  assert.equal(a.calls.render, 0); assert.match(rep.stop_reason, /gate/);
  assert.deepEqual(rep.rounds[0].gate_failures.map((f) => `${f.beat_index}:${f.rule}`), ["3:camera-motivation", "null:family-share"]);
  const b = fakes({ verdicts: [["KEEP", "KEEP", "KEEP", "KEEP"]] });
  b.steps.gate = a.steps.gate;
  const rep2 = await runLoop({ ...base(), steps: b.steps, gateMode: "record" });
  assert.equal(b.calls.render, 1); assert.equal(rep2.rounds[0].gate_recorded_only, true);
  // A recorded gate failure must reach the production terminal state, not vanish.
  assert.equal(rep2.rounds[0].gate_failures.length, 2);
});

test("parseGateFailures ignores the summary line and keeps beat/rule/detail", () => {
  const out = parseGateFailures("[vd-gate] beat 0 schema: /beats/0 must have required property 'shots'\n[vd-gate] 1 failure(s)");
  assert.deepEqual(out, [{ beat_index: 0, rule: "schema", detail: "/beats/0 must have required property 'shots'" }]);
  assert.deepEqual(parseGateFailures("nothing"), []);
});

test("helpers: splice reports beats the director failed to return; essentialMissing tolerates shapes", () => {
  const prev = { beats: [mkBeat(0, "a"), mkBeat(1, "a")] };
  const s = spliceBeats(prev, { beats: [mkBeat(0, "b")] }, [0, 1]);
  assert.deepEqual(s.missing, [1]);
  assert.equal(s.direction.beats[1], prev.beats[1]);
  assert.deepEqual(essentialMissing([{ beat_index: 3, essential_missing: ["x"] }, { beat_index: 4 }]), [{ beat_index: 3, missing: ["x"] }]);
});
