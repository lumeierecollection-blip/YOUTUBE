// The last beat is held to the end of the voiceover file (src/skills/remotion-render/cover-audio.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { coverAudio } from "../../src/skills/remotion-render/cover-audio.js";

const beats = () => [{ start_frame: 0, duration_frames: 150 }, { start_frame: 150, duration_frames: 1350 }];   // ends at 1500 f = 50 s

test("a file that runs past the last word: the last beat is extended to the file's end (ch 9: 1.95 s)", () => {
  const b = beats();
  const added = coverAudio(b, 1500 + 59);   // 52.97 s file, 1.97 s tail
  assert.equal(added, 59);
  assert.equal(b[1].start_frame + b[1].duration_frames, 1559);
  assert.equal(b[0].duration_frames, 150, "only the last beat moves");
});

test("beats that already reach the audio are left alone", () => {
  const b = beats();
  assert.equal(coverAudio(b, 1500), 0);
  assert.equal(coverAudio(b, 1400), 0);
  assert.equal(b[1].duration_frames, 1350);
});

test("nothing usable: no change, no throw", () => {
  for (const [bb, a] of [[[], 1600], [beats(), NaN], [beats(), 0], [null, 1600]]) assert.equal(coverAudio(bb, a), 0);
});
