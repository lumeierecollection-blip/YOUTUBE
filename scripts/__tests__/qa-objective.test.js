// Objective QA checks against tiny synthetic ffmpeg clips (scripts/qa/objective-checks.mjs).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runObjectiveChecks, checkCaptions, checkMissingMedia, parseSrt } from "../qa/objective-checks.mjs";
import { planRiskFrames } from "../qa/risk-frames.mjs";

let dir;
const range = { min: 2, max: 5 };

function clip(name, { size = "1080x1920", dur = 3, vf = "", audio = "sine=frequency=440:duration=3", af = "" } = {}) {
  const out = join(dir, name);
  const args = ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=s=${size}:r=30:d=${dur}`];
  if (audio) args.push("-f", "lavfi", "-i", audio);
  if (vf) args.push("-vf", vf);
  if (af) args.push("-af", af);
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "45", "-pix_fmt", "yuv420p", "-r", "30");
  if (audio) args.push("-c:a", "aac", "-b:a", "32k", "-shortest");
  args.push(out);
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return out;
}
const by = (defects, check) => defects.filter((d) => d.check === check);

before(() => { dir = mkdtempSync(join(tmpdir(), "qa-obj-")); });
after(() => { rmSync(dir, { recursive: true, force: true }); });

test("a correct 1080x1920 30fps clip with tone has no blocker or major defect", () => {
  const d = runObjectiveChecks(clip("good.mp4"), { durationRange: range });
  assert.deepEqual(d.filter((x) => x.severity !== "minor"), []);
});

test("a 1920x1080 clip is an aspect blocker", () => {
  const d = runObjectiveChecks(clip("wide.mp4", { size: "640x360" }), { durationRange: range });
  const a = by(d, "aspect");
  assert.equal(a.length, 1);
  assert.equal(a[0].severity, "blocker");
  assert.equal(a[0].source, "objective");
});

test("1.5 s of black in the middle is a blank-frame defect at the right time", () => {
  const f = clip("black.mp4", { dur: 4, audio: "sine=frequency=440:duration=4", vf: "drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,1,2.5)'" });
  const b = by(runObjectiveChecks(f, { durationRange: { min: 2, max: 6 } }), "blank-frames");
  assert.equal(b.length, 1);
  assert.ok(Math.abs(b[0].t_start - 1) < 0.2, `start ${b[0].t_start}`);
  assert.ok(Math.abs(b[0].t_end - 2.5) < 0.2, `end ${b[0].t_end}`);
});

test("a clip with no audio is an audio-stream blocker", () => {
  const d = runObjectiveChecks(clip("silent-track.mp4", { audio: null }), { durationRange: range });
  assert.equal(by(d, "audio-stream")[0]?.severity, "blocker");
});

test("2 s of silence is an audio-silence defect at the right time", () => {
  const f = clip("gap.mp4", { dur: 4, audio: "sine=frequency=440:duration=4", af: "volume=enable='between(t,1,3)':volume=0" });
  const s = by(runObjectiveChecks(f, { durationRange: { min: 2, max: 6 } }), "audio-silence");
  assert.equal(s.length, 1);
  assert.ok(Math.abs(s[0].t_start - 1) < 0.2, `start ${s[0].t_start}`);
});

test("captions: overlap, past-end and gap are found; clean cues are not", () => {
  const srt = "1\n00:00:00,000 --> 00:00:01,500\nhello\n\n2\n00:00:01,000 --> 00:00:02,000\noverlap\n\n3\n00:00:06,000 --> 00:00:07,000\nafter a gap\n\n4\n00:00:09,000 --> 00:00:10,000\npast end\n";
  assert.equal(parseSrt(srt).length, 4);
  const d = checkCaptions(srt, 8);
  assert.equal(by(d, "captions-overlap").length, 1);
  assert.equal(by(d, "captions-gap").length, 1);
  assert.equal(by(d, "captions-past-end")[0].severity, "major");
  assert.equal(checkCaptions("1\n00:00:00,000 --> 00:00:01,000\nok\n\n2\n00:00:01,000 --> 00:00:02,000\nok\n", 3).length, 0);
});

test("missing media: a plan asset that is not on disk is a blocker on its beat", () => {
  mkdirSync(join(dir, "pub"), { recursive: true });
  writeFileSync(join(dir, "pub", "here.jpg"), "x");
  const m = { beats: [{ start_sec: 0, duration_sec: 2, canvas: { photo: { asset: "here.jpg" } } }, { start_sec: 2, duration_sec: 2, canvas: { photo: { asset: "gone.jpg" }, art: { items: [{ asset: "here.jpg" }] } } }] };
  const d = checkMissingMedia(m, join(dir, "pub"));
  assert.equal(d.length, 1);
  assert.equal(d[0].beat_index, 1);
  assert.equal(d[0].t_start, 2);
});

test("planRiskFrames: sorted, deduped, reasoned, capped", () => {
  const beats = Array.from({ length: 12 }, (_, i) => ({ start: i * 4, end: i * 4 + 4 }));
  const p = planRiskFrames({ duration: 48, beats, textChanges: [4.0, 9], transitions: [{ t: 8, dur: 0.4 }], max: 20 });
  assert.ok(p.length <= 20);
  assert.deepEqual(p.map((x) => x.t), [...p.map((x) => x.t)].sort((a, b) => a - b));
  assert.ok(p.every((x) => x.reasons.length >= 1 && x.t >= 0 && x.t < 48));
  assert.equal(new Set(p.map((x) => x.t)).size, p.length);
  const small = planRiskFrames({ duration: 10, beats: [{ start: 0, end: 5 }, { start: 5, end: 10 }], transitions: [{ t: 5, dur: 0.4 }] });
  assert.ok(small.some((x) => x.reasons.includes("mid-transition")));
});
