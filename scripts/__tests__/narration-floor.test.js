import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { floorCheck } from "../narration-floor.mjs";

// Real audio made with ffmpeg (CI has it). Each case is one concrete failure the floor must name.
const dir = mkdtempSync(join(tmpdir(), "floor-"));
const tone = (name, expr, d) => spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `aevalsrc='${expr}':s=24000:d=${d}`, join(dir, name)]);
const SRT = join(dir, "s.srt");
writeFileSync(SRT, "1\n00:00:00,000 --> 00:00:03,000\nA.\n\n2\n00:00:03,000 --> 00:00:05,800\nB.\n");
const words = (end) => { const p = join(dir, `w-${end}.json`); writeFileSync(p, JSON.stringify([{ start: 0, end: 3, word: "A" }, { start: 3, end: end, word: "B" }])); return p; };
tone("good.mp3", "0.3*sin(2*PI*180*t)", 6);
tone("gap.mp3", "if(lt(t,2),0.3*sin(2*PI*180*t),0)+if(gt(t,4.5),0.3*sin(2*PI*180*t),0)", 6.5);
tone("clip.mp3", "2*sin(2*PI*180*t)", 3);
writeFileSync(join(dir, "bad.mp3"), "not audio");

test("a clean voiceover passes every floor check", () => {
  const r = floorCheck({ audio: join(dir, "good.mp3"), srt: SRT, words: words(5.8) });
  assert.equal(r.ok, true, r.failures.join("; "));
});

test("a silence longer than the limit inside the speech fails, and is named", () => {
  const r = floorCheck({ audio: join(dir, "gap.mp3"), srt: SRT, words: words(5.8) });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => /^silence: /.test(f)), r.failures.join("; "));
});

test("captions that end well after the last spoken word fail the drift check", () => {
  const r = floorCheck({ audio: join(dir, "good.mp3"), srt: SRT, words: words(6.5) });
  assert.ok(r.failures.some((f) => /^drift: /.test(f)), r.failures.join("; "));
});

test("a clipped voiceover fails, and a voiceover that ends before its last caption fails the length check", () => {
  const r = floorCheck({ audio: join(dir, "clip.mp3"), srt: SRT, words: words(5.8) });
  assert.ok(r.failures.some((f) => /^clipping: /.test(f)), r.failures.join("; "));
  assert.ok(r.failures.some((f) => /^length: /.test(f)), r.failures.join("; "));
});

test("a file that does not decode fails at decode, and nothing else is claimed", () => {
  const r = floorCheck({ audio: join(dir, "bad.mp3"), srt: SRT });
  assert.equal(r.ok, false);
  assert.match(r.failures[0], /^decode: /);
});

test("the video and the voiceover must agree within the tolerance", () => {
  tone("v.mp3", "0.3*sin(2*PI*180*t)", 6);
  const r = floorCheck({ audio: join(dir, "good.mp3"), srt: SRT, words: words(5.8), video: join(dir, "good.mp3") });
  assert.equal(r.ok, true, r.failures.join("; "));
  rmSync(dir, { recursive: true, force: true });
});
