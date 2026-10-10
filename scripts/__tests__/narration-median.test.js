import test from "node:test";
import assert from "node:assert/strict";
import { medianRows, isFailing, judgeAudio } from "../narration-judge.mjs";

const cues = [{ start: 0, end: 2, text: "One." }];
const run = (score, sounds = "HUMAN", intonation = "VARIED", pauses = "NATURAL") => new Map([[0, { index: 0, score, sounds, intonation, pauses, why: `s${score}` }]]);
const verdict = (...runs) => isFailing(medianRows(cues, runs)[0]);

test("the bar is unchanged: one bad reading of good audio passes, a bad median fails", () => {
  assert.equal(verdict(run(7), run(5), run(7)), false);   // 7, 5, 7 -> median 7 passes
  assert.equal(verdict(run(5), run(7), run(5)), true);    // 5, 7, 5 -> median 5 fails
  assert.equal(verdict(run(6), run(6), run(9)), true);    // median 6 is below 7 however good the best reading
  assert.equal(verdict(run(8), run(8), run(8)), false);
});

test("labels are the majority of the readings, and the same three readings give the same row in any order", () => {
  const a = medianRows(cues, [run(8, "HUMAN"), run(8, "SYNTHETIC"), run(8, "HUMAN")])[0];
  assert.equal(a.sounds, "HUMAN");
  const flat = medianRows(cues, [run(8, "HUMAN", "FLAT"), run(8, "HUMAN", "FLAT"), run(8)])[0];
  assert.equal(flat.intonation, "FLAT");
  assert.equal(isFailing(flat), true);
  const x = medianRows(cues, [run(5), run(7), run(9)])[0], y = medianRows(cues, [run(9), run(5), run(7)])[0];
  assert.deepEqual([x.score, x.sounds], [y.score, y.sounds]);
  assert.deepEqual(x.scores, [5, 7, 9]);
});

test("three readings come from ONE model; fewer than three complete readings is 'could not run', never a verdict from one", async () => {
  const seen = [];
  const ask = async (_a, _p, { pin }) => { seen.push(pin); return { model: pin || "primary", out: { sentences: [{ index: 0, score: 8, sounds: "HUMAN", intonation: "VARIED", pauses: "NATURAL" }] } }; };
  const r = await judgeAudio("b64", cues, { ask });
  assert.equal(r.runs.length, 3);
  assert.deepEqual(seen, [null, "primary", "primary"]);
  let n = 0;
  const flaky = async (_a, _p, { pin }) => { if (++n > 1) throw new Error("503"); return { model: pin || "m", out: { sentences: [{ index: 0, score: 8, sounds: "HUMAN", intonation: "VARIED", pauses: "NATURAL" }] } }; };
  await assert.rejects(() => judgeAudio("b64", cues, { ask: flaky }), /only 1\/3 complete readings/);
});
