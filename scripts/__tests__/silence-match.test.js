// silence-match: a video silence is a dropout only when it lies inside no voiceover pause, on the voiceover's clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clockOffset, unmatchedSilences } from "../lib/silence-match.mjs";

const sp = (a) => a.map(([start, end]) => ({ start, end, duration: end - start }));
// board 38742395747 ch-6, copied from the log: the video's pauses against the voiceover's (the voiceover scanned down to 0.2 s: its quiet lead-in 0-0.47 s)
const VID = sp([[0, 0.556562], [8.90404, 10.1703], [11.2517, 11.7634], [17.0612, 17.9301], [20.9387, 21.8137], [24.7981, 26.3101], [30.9665, 31.4955], [33.1794, 34.7282], [43.0521, 44.6108], [46.288, 46.9067]]);
const SRC = sp([[0, 0.4682], [8.81533, 10.0816], [11.163, 11.6746], [16.9725, 17.8414], [20.85, 21.725], [24.7094, 26.2214], [30.8718, 31.4067], [33.0904, 34.6395], [42.9634, 44.522], [46.1993, 46.818]]);
const DUR = 47;

test("the real ch-6 video: the clock offset is the constant 0.088 s the log shows", () => {
  assert.ok(Math.abs(clockOffset(VID, SRC) - 0.0887) < 0.005, String(clockOffset(VID, SRC)));
});

test("the real ch-6 video: every silence is the narration's own pause (it was rejected as 'unmatched silence gap(s)' before)", () => {
  assert.deepEqual(unmatchedSilences(VID, SRC, DUR), []);
});

test("scanned only down to 0.5 s the voiceover's lead-in is invisible and the video's lead-in is unmatched: the bug as it was", () => {
  const srcAt05 = SRC.filter((s) => s.duration >= 0.5);
  assert.equal(unmatchedSilences(VID, srcAt05, DUR).length, 1);
});

test("a dropout while the narration is SPEAKING still fails: a video silence inside no voiceover pause", () => {
  const dropout = [...VID, ...sp([[14.0, 15.2]])];
  const bad = unmatchedSilences(dropout, SRC, DUR);
  assert.equal(bad.length, 1);
  assert.equal(bad[0].start, 14.0);
});

test("a dropout that merely OVERLAPS a pause does not match: containment is still required", () => {
  const spill = [...VID.slice(0, 1), ...sp([[8.9, 12.5]]), ...VID.slice(3)];
  assert.equal(unmatchedSilences(spill, SRC, DUR).length, 1);
});

test("a silence after the voiceover has ended is not judged", () => {
  assert.deepEqual(unmatchedSilences(sp([[46.95, 48.5]]), SRC, DUR), []);
});

test("a clock offset beyond the cap is a fault and is not corrected for", () => {
  const far = sp([[0, 0.5], [9.9, 11.2]]);       // 1.08 s after the voiceover's pause at 8.815
  assert.ok(Math.abs(clockOffset(far, SRC)) <= 0.5);
  assert.equal(unmatchedSilences(far, SRC, DUR).length, 1);
});
