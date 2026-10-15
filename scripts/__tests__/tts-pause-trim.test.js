// tts-pause-trim: dead air is shortened, the voice and natural pauses are not. The filter string is the one src/utils/tts_gemini.py applies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PY = readFileSync(new URL("../../src/utils/tts_gemini.py", import.meta.url), "utf8");
const FILTER = "silenceremove=stop_periods=-1:stop_duration=0.45:stop_threshold=-45dB:stop_silence=0.05";

test("the filter the test proves is the filter the TTS helper builds", () => {
  assert.ok(PY.includes('"silenceremove=stop_periods=-1:stop_duration=%s:stop_threshold=-45dB:stop_silence=0.05" % trim'));
  assert.ok(PY.includes('os.environ.get("TTS_PAUSE_TRIM", "0.45")'), "default trigger is 0.45 s");
  assert.ok(/TTS_PAUSE_TRIM=0 turns it off/.test(PY));
});

const ff = (args) => spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
const pauses = (path) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", path, "-af", "silencedetect=noise=-40dB:d=0.2", "-f", "null", "-"], { encoding: "utf8" });
  return [...(r.stderr || "").matchAll(/silence_duration: ([\d.]+)/g)].map((m) => +m[1]);
};
const dur = (path) => +spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], { encoding: "utf8" }).stdout.trim();

test("long pauses become about half a second, a natural pause is kept, the speech is not shortened", () => {
  const d = mkdtempSync(join(tmpdir(), "pause-"));
  const src = join(d, "in.wav"), out = join(d, "out.wav");
  const made = ff(["-f", "lavfi", "-i", "sine=frequency=220:duration=1.0", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-f", "lavfi", "-i", "sine=frequency=330:duration=1.0", "-f", "lavfi", "-i", "sine=frequency=440:duration=1.0",
    "-filter_complex", "[0]aresample=24000[a];[1]atrim=0:1.4[s1];[2]aresample=24000[b];[1]atrim=0:0.3[s2];[3]aresample=24000[c];[1]atrim=0:1.6[s3];[a][s1][b][s2][c][s3][a]concat=n=7:v=0:a=1[o]", "-map", "[o]", "-ac", "1", "-ar", "24000", src]);
  assert.equal(made.status, 0, made.stderr);
  assert.deepEqual(pauses(src).map((x) => Math.round(x * 10) / 10), [1.4, 0.3, 1.6]);
  const r = ff(["-i", src, "-af", FILTER, "-ar", "24000", "-ac", "1", out]);
  assert.equal(r.status, 0, r.stderr);
  const p = pauses(out);
  assert.equal(p.length, 3);
  assert.ok(p[0] < 0.6 && p[2] < 0.6, `long pauses ${p[0]}, ${p[2]}`);
  assert.ok(Math.abs(p[1] - 0.3) < 0.05, `the natural pause was changed: ${p[1]}`);
  assert.ok(dur(src) - dur(out) > 1.5, "saved no time");
  assert.ok(dur(out) > 4.9, "the speech itself was shortened");   // 4 x 1.0 s tone + 3 pauses of ~0.5 / 0.3 / 0.5
});
