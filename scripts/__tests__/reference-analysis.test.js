/**
 * Reference-video analysis (scripts/reference/*): pure parsers, the frame plan, the evidence filter, the schema,
 * and one real run on a 6 s fixture synthesised with ffmpeg (no vision: there are no API keys locally).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseProbe } from "../reference/probe.mjs";
import { parseShowinfo, mergeCuts, longestHold } from "../reference/scenes.mjs";
import { planSamples, dedupe, denseWindowsFrom } from "../reference/sample.mjs";
import { parseEbur128, parseSilence, parseRms, findOnsets } from "../reference/audio.mjs";
import { baseDirection, filterEvidence, validateDirection, direct } from "../reference/direct.mjs";
import { mmss, labelFilter } from "../reference/contact-sheet.mjs";

const CLI = fileURLToPath(new URL("../reference/analyze-reference.mjs", import.meta.url));

describe("parseProbe", () => {
  it("reads duration, fps, size, aspect, codec and audio", () => {
    const p = parseProbe({ format: { duration: "6.000000" }, streams: [{ codec_type: "video", codec_name: "h264", width: 540, height: 960, avg_frame_rate: "30/1" }, { codec_type: "audio", sample_rate: "44100", channels: 1, codec_name: "aac" }] });
    assert.equal(p.duration_s, 6); assert.equal(p.fps, 30); assert.equal(p.aspect, 0.5625);
    assert.equal(p.orientation, "vertical"); assert.equal(p.has_audio, true); assert.equal(p.audio_sample_rate, 44100); assert.equal(p.audio_channels, 1);
  });
  it("no audio stream -> has_audio false; no video -> throws", () => {
    assert.equal(parseProbe({ format: { duration: "1" }, streams: [{ codec_type: "video", width: 10, height: 10, avg_frame_rate: "25/1" }] }).has_audio, false);
    assert.throws(() => parseProbe({ format: {}, streams: [] }));
  });
});

describe("scene parsing", () => {
  it("parseShowinfo takes pts_time from showinfo lines only", () => {
    const s = "[Parsed_showinfo_2 @ 0x1] n:   0 pts:  60 pts_time:2.002 pos: 1\n[other] pts_time:9\n[Parsed_showinfo_2 @ 0x1] n:   1 pts: 120 pts_time:4.0 pos: 2";
    assert.deepEqual(parseShowinfo(s), [2.002, 4]);
  });
  it("mergeCuts collapses cuts closer than the gap; longestHold finds the biggest shot", () => {
    assert.deepEqual(mergeCuts([5, 2, 2.1, 5.05]), [2, 5]);
    assert.deepEqual(longestHold([2, 3], 10), { start: 3, end: 10, length_s: 7 });
  });
});

describe("planSamples", () => {
  const cuts = [2, 4];
  it("standard: cuts +-0.15 s plus uniform every 2 s, each with a reason, capped", () => {
    const p = planSamples({ duration: 6, cuts });
    const by = (r) => p.filter((s) => s.reason === r).map((s) => s.t);
    assert.deepEqual(by("cut-before"), [1.85, 3.85]);
    assert.deepEqual(by("cut-after"), [2.15, 4.15]);
    assert.ok(by("uniform").includes(0));
    assert.ok(p.every((s, i) => s.id === `f${String(i + 1).padStart(3, "0")}` && (i === 0 || s.t > p[i - 1].t)));
  });
  it("never exceeds the cap and keeps every cut frame first", () => {
    const longCuts = Array.from({ length: 20 }, (_, i) => 5 + i * 10);
    const p = planSamples({ duration: 600, cuts: longCuts });
    assert.ok(p.length <= 60);
    assert.equal(p.filter((s) => s.reason.startsWith("cut")).length, 40);
  });
  it("dense adds 4 fps inside windows; standard ignores them; dense cap is 200", () => {
    const win = [[10, 11]];
    assert.ok(planSamples({ duration: 20, cuts: [], mode: "dense", denseWindows: win }).filter((s) => s.reason === "dense").length >= 4);
    assert.equal(planSamples({ duration: 20, cuts: [], mode: "standard", denseWindows: win }).some((s) => s.reason === "dense"), false);
    assert.ok(planSamples({ duration: 1000, cuts: [], mode: "dense", denseWindows: [[0, 900]] }).length <= 200);
  });
  it("denseWindowsFrom merges overlapping windows", () => {
    assert.deepEqual(denseWindowsFrom([{ t: 5, novelty: 0.5, cut: true }, { t: 5.6, novelty: 0.3, cut: true }, { t: 9, novelty: 0.01, cut: false }]), [[4.5, 6.1]]);
  });
});

describe("dedupe", () => {
  it("drops a frame close to the last kept one and records which", () => {
    const flat = new Uint8Array(256).fill(100), near = new Uint8Array(256).fill(101), far = new Uint8Array(256).fill(200);
    const { kept, dropped } = dedupe([{ id: "f001", t: 0, thumb: flat }, { id: "f002", t: 1, thumb: near }, { id: "f003", t: 2, thumb: far }]);
    assert.deepEqual(kept.map((k) => k.id), ["f001", "f003"]);
    assert.equal(dropped[0].id, "f002"); assert.equal(dropped[0].duplicate_of, "f001");
  });
});

describe("audio parsers", () => {
  it("ebur128 summary, silencedetect, rms series and onsets", () => {
    assert.equal(parseEbur128("Summary:\n  Integrated loudness:\n    I:         -16.2 LUFS\n  Loudness range:\n    LRA:         3.1 LU\n  True peak:\n    Peak:       -1.5 dBFS").integrated_lufs, -16.2);
    assert.deepEqual(parseSilence("silence_start: 1.5\nsilence_end: 2.5 | silence_duration: 1", 6), [{ start: 1.5, end: 2.5 }]);
    const rms = parseRms("frame:0 pts:0 pts_time:0\nlavfi.astats.Overall.RMS_level=-50\nframe:1 pts:1 pts_time:0.1\nlavfi.astats.Overall.RMS_level=-inf");
    assert.deepEqual(rms, [{ t: 0, rms_db: -50 }, { t: 0.1, rms_db: -120 }]);
    const series = [-50, -50, -50, -50, -10, -10, -50].map((d, i) => ({ t: i / 10, rms_db: d }));
    assert.deepEqual(findOnsets(series).map((c) => c.t), [0.4]);
    assert.deepEqual(findOnsets([{ t: 0, rms_db: -120 }, { t: 0.1, rms_db: -10 }]), []);
  });
});

describe("contact sheet labels", () => {
  it("mm:ss.ss and an escaped drawtext label", () => {
    assert.equal(mmss(75.5), "01:15.50");
    assert.match(labelFilter("f001  00:02.00", null), /text='f001  00\\:02\.00'/);
  });
});

const meta = { duration_s: 6, fps: 30, width: 540, height: 960, orientation: "vertical", has_audio: true };
const scenes = { cuts: [2, 4], scene_cuts: 2, cadence: { events_per_10s: 3, cuts_per_10s: 3.3, p90_gap_s: 2, median_gap_s: 2, longest_hold: { start: 0, end: 2, length_s: 2 } } };
const audio = { loudness: { integrated_lufs: -20 }, silences: [], candidate_cues: [{ t: 2.1, rms_db: -10, jump_db: 20 }], transcript: null, why: "x" };
const mk = () => baseDirection({ file: "x.mp4", size_bytes: 1, metadata: meta, scenes, audio, framesSent: ["f001", "f002"], status: "complete" });
const o = (text, evidence, extra = {}) => ({ text, evidence, confidence: "high", ...extra });

describe("filterEvidence + schema", () => {
  it("keeps observations citing sent frames, rejects the rest with a reason", () => {
    const d = filterEvidence(mk(), {
      typography: [o("bold serif", ["f001"]), o("invented", ["f099"]), o("no evidence", [])],
      transitions: [o("hard cut", ["f001", "f002"], { type: "cut", at_cuts: [2.1] }), o("cut at nothing", ["f001"], { at_cuts: [5] })],
      sound_cues: [o("pop", ["f002"], { t: 2.1 }), o("nowhere", ["f002"], { t: 4.5 })],
      pacing: { observations: [o("fast", ["f001"])] },
      storyboard: [{ scene_id: "s1", start: 0, end: 2, frames: ["f001"], description: "d", technique: "t", evidence: ["f001"], confidence: "low" }, { scene_id: "s2", start: 2, end: 4, frames: ["f077"], description: "d", technique: "t", evidence: ["f002"], confidence: "low" }],
    }, ["f001", "f002"]);
    assert.equal(d.typography.length, 1);
    assert.equal(d.transitions.length, 1); assert.deepEqual(d.transitions[0].at_cuts, [2]);
    assert.equal(d.sound_cues.length, 1); assert.equal(d.pacing.observations.length, 1); assert.equal(d.storyboard.length, 1);
    assert.equal(d.rejected_observations.length, 5);
    assert.ok(d.rejected_observations.some((r) => r.cited.includes("f099")));
    assert.deepEqual(validateDirection(d).errors, []);
  });
  it("schema rejects an observation without evidence and accepts the measured-only skeleton", () => {
    assert.equal(validateDirection(baseDirection({ file: "x", size_bytes: 1, metadata: meta, scenes, audio: null, why: "w" })).valid, true);
    const bad = mk(); bad.effects.push({ text: "glow", confidence: "low" });
    assert.equal(validateDirection(bad).valid, false);
  });
  it("direct(): a mocked model answer is filtered; --no-vision never calls the model", async () => {
    const base = { file: "x.mp4", size_bytes: 1, metadata: meta, scenes, audio, frames: [{ id: "f001", t: 0, reason: "uniform", file: fileURLToPath(import.meta.url) }], sheets: [] };
    const none = await direct({ ...base, noVision: true, mock: () => { throw new Error("must not be called"); } });
    assert.equal(none.doc.direction.status, "measured-only");
    assert.equal(none.doc.typography.length, 0);
  });
});

describe("integration: synthetic 6 s fixture, --no-vision", () => {
  it("finds the 2 cuts, writes metadata, a contact sheet, and a measured-only direction", () => {
    const dir = mkdtempSync(join(tmpdir(), "refan-"));
    try {
      const fx = join(dir, "fixture.mp4");
      const f = spawnSync("ffmpeg", ["-v", "error", "-y",
        "-f", "lavfi", "-i", "testsrc2=s=540x960:r=30:d=2", "-f", "lavfi", "-i", "color=c=red:s=540x960:r=30:d=2", "-f", "lavfi", "-i", "smptebars=s=540x960:r=30:d=2",
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=6",
        "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p[v]", "-map", "[v]", "-map", "3:a", "-c:v", "libx264", "-c:a", "aac", "-shortest", fx], { encoding: "utf8" });
      assert.equal(f.status, 0, f.stderr);
      const out = join(dir, "out");
      const r = spawnSync(process.execPath, [CLI, fx, "--out", out, "--no-vision"], { encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr + r.stdout);
      const j = (n) => JSON.parse(readFileSync(join(out, n), "utf8"));
      const sc = j("scenes.json");
      assert.equal(sc.cuts.length, 2, JSON.stringify(sc.cuts));
      assert.ok(Math.abs(sc.cuts[0] - 2) <= 0.2 && Math.abs(sc.cuts[1] - 4) <= 0.2, JSON.stringify(sc.cuts));
      const m = j("metadata.json");
      assert.equal(m.width, 540); assert.equal(m.height, 960); assert.equal(m.fps, 30); assert.equal(m.has_audio, true);
      assert.ok(Math.abs(m.duration_s - 6) < 0.2);
      assert.ok(existsSync(join(out, "contact-01.jpg")));
      const d = j("direction.json");
      assert.equal(d.direction.status, "measured-only");
      assert.deepEqual(validateDirection(d).errors, []);
      assert.ok(existsSync(join(out, "direction.md")) && existsSync(join(out, "run-log.json")) && existsSync(join(out, "audio.json")));
      const again = spawnSync(process.execPath, [CLI, fx, "--out", out, "--no-vision"], { encoding: "utf8" });
      assert.match(again.stdout, /metadata\(cached\)/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
