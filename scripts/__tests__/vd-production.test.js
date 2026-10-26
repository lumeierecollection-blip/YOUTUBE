/**
 * Production wrapper + deterministic visual QA (scripts/visual-director/production.mjs,
 * qa-video.mjs). Pure functions only: no ffmpeg, no model, no render.
 *
 * The contract these tests pin down:
 *  - APPROVED needs ALL of: an MP4, every deterministic check, every scene KEEP,
 *    the whole-video mute/alternation checks, and a clean gate. A recorded gate
 *    failure (VD_GATE=record) must never yield APPROVED.
 *  - every terminal state is one of APPROVED / FAILED_QA / RENDER_FAILED / INPUT_MISSING.
 *  - the manifest carries run id, source commit, generation id, timeline version+sha
 *    and the asset manifest, because those are what the QA report and artifact rely on.
 *  - the queued file name is the one the publisher can resolve back to the script.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decideTerminal, criticApproved, buildManifest, queueSlugFor, researchFor, ttsFor,
  slugFor, TIMELINE_VERSION, imageCredits,
} from "../visual-director/production.mjs";
import {
  parseBlackdetect, parseFreezedetect, parseVolumedetect, evaluateVisualQa,
} from "../visual-director/qa-video.mjs";

const tmp = () => mkdtempSync(join(tmpdir(), "vdprod-"));

const scene = (i, verdict = "KEEP") => ({ beat_index: i, status: "answered", verdict, effective_verdict: verdict });
const criticAllKeep = () => ({
  status: "complete",
  scenes: [scene(0), scene(1)],
  whole_video: { status: "answered", answer: { template_alternation: "yes", whole_mute_test: "yes", worst_beats: [] } },
});
const qaPass = () => ({ pass: true, checks: [{ id: "video.exists", pass: true, detail: "x" }] });

// ---------------------------------------------------------------- terminal states

test("decideTerminal: no MP4 is RENDER_FAILED only when the renderer actually failed", () => {
  assert.equal(decideTerminal({ hasVideo: false, renderFailed: true }), "RENDER_FAILED");
  assert.equal(decideTerminal({ hasVideo: false, renderFailed: false }), "FAILED_QA");
});

test("decideTerminal: APPROVED needs QA pass, every scene KEEP, whole-video yes and a clean gate", () => {
  assert.equal(decideTerminal({ hasVideo: true, qa: qaPass(), critic: criticAllKeep() }), "APPROVED");
  // A recorded gate failure is still a failure: VD_GATE=record only keeps rendering.
  assert.equal(decideTerminal({ hasVideo: true, qa: qaPass(), critic: criticAllKeep(), gateFailures: [{ beat_index: 3, rule: "camera-motivation" }] }), "FAILED_QA");
  assert.equal(decideTerminal({ hasVideo: true, qa: { pass: false, checks: [] }, critic: criticAllKeep() }), "FAILED_QA");
  assert.equal(decideTerminal({ hasVideo: true, qa: qaPass(), critic: { ...criticAllKeep(), scenes: [scene(0), scene(1, "REBUILD")] } }), "FAILED_QA");
  assert.equal(decideTerminal({ hasVideo: true, qa: qaPass(), critic: { ...criticAllKeep(), whole_video: { status: "answered", answer: { template_alternation: "partly", whole_mute_test: "yes" } } } }), "FAILED_QA");
  assert.equal(decideTerminal({ hasVideo: true, qa: qaPass(), critic: { status: "invalid", scenes: [], whole_video: null } }), "FAILED_QA");
});

test("criticApproved: an unanswered scene is not a KEEP", () => {
  const c = criticAllKeep();
  c.scenes.push({ beat_index: 2, status: "not_run", verdict: null, effective_verdict: null });
  assert.equal(criticApproved(c), false);
  assert.equal(criticApproved({ ...criticAllKeep(), whole_video: { status: "answered", answer: { template_alternation: "yes", whole_mute_test: "no" } } }), false);
  assert.equal(criticApproved(null), false);
});

// ---------------------------------------------------------------- naming + paths

test("queueSlugFor keeps the publisher's <slug>-shorts-<date>.mp4 contract", () => {
  const script = "data/research/1/hittite-cuneiform-tablets-discovery-2026-shorts-script.json";
  const queued = `${queueSlugFor(script)}-shorts-2026-10-26.mp4`;
  assert.equal(queued, "hittite-cuneiform-tablets-discovery-2026-shorts-shorts-2026-10-26.mp4");
  // topicSlugFromVideo (src/skills/youtube-publish/run.js) strips exactly this tail.
  const m = queued.match(/-(shorts|longform)-\d{4}-\d{2}-\d{2}\.mp4$/);
  assert.ok(m);
  assert.equal(queued.slice(0, m.index), "hittite-cuneiform-tablets-discovery-2026-shorts");
});

test("slugFor/researchFor/ttsFor agree with the prep artifact layout", () => {
  const script = "data/research/2/anthropic-claude-haiku-5-5-pricing-breakdown-shorts-script.json";
  assert.equal(slugFor(script), "anthropic-claude-haiku-5-5-pricing-breakdown");
  assert.match(researchFor(script) ?? "", /anthropic-claude-haiku-5-5-pricing-breakdown\.json$/);
  const t = ttsFor(script, 2);
  assert.match(t.mp3.replace(/\\/g, "/"), /data\/tts\/2\/anthropic-claude-haiku-5-5-pricing-breakdown-shorts-script-vo\.mp3$/);
});

// ---------------------------------------------------------------- manifest

test("buildManifest records run, commit, generation, timeline version+sha and the asset manifest", () => {
  const d = tmp();
  const video = join(d, "video.mp4");
  writeFileSync(video, "mp4");
  const direction = {
    beats: [{ beat_index: 0, t_start: 0, t_end: 4, mechanism: { family: "reveal" }, shots: [{ id: "b0s1" }] }],
  };
  const shotsDoc = { proof: false, refused: [], shots: [{ id: "b0s1", beat: 0, family: "reveal", move: "push-in", transition_out: "wipe" }] };
  const sfxDoc = { cues: [{ mapped: true, file: "x.wav" }] };
  const materials = { summary: { materials: 1, verified: 1, missing: 0, unverified: 0 }, beats: [{ beat_index: 0, materials: [{ shot_id: "b0s1", material_id: "m1", kind: "photo", must_show: "a tablet", status: "verified", chosen: { source_url: "https://example.org/x.jpg" } }] }] };
  const m = buildManifest({
    runId: "123", source: "deadbeef", generation: "123-ch1-x", channel: 1,
    script: "data/research/1/x-shorts-script.json", research: "data/research/1/x.json",
    video, direction, shotsDoc, sfxDoc, materials, materialsPath: join(d, "materials-report.json"),
    critic: criticAllKeep(), loopReport: { rounds: [{}], max_rounds: 5, stop_reason: "no scene needs rebuilding" },
    qa: { ...qaPass(), probe: { ok: true, duration: 4 }, black: [], freeze: [], volume: { mean_db: -20 } },
    terminal: "APPROVED", qaReport: join(d, "qa.json"), contactSheet: join(d, "sheet.jpg"), comparison: join(d, "comparison.md"),
    timelineSha256: "abc123", gateFailures: [],
    prunedShots: [{ beat_index: 0, dropped: [{ shot_id: "b0s2" }], kept: ["b0s1"] }],
  });
  assert.equal(m.terminal_state, "APPROVED");
  assert.equal(m.run_id, "123");
  assert.equal(m.source_commit, "deadbeef");
  assert.equal(m.generation_id, "123-ch1-x");
  assert.equal(m.timeline_version, TIMELINE_VERSION);
  assert.equal(m.timeline_sha256, "abc123");
  assert.equal(m.timeline.shots, 1);
  assert.equal(m.effects.moving_shots, 1);
  assert.equal(m.effects.mapped_sfx, 1);
  assert.equal(m.asset_manifest.summary.verified, 1);
  assert.equal(m.asset_manifest.materials[0].source_url, "https://example.org/x.jpg");
  assert.equal(m.qa.deterministic_pass, true);
  assert.equal(m.qa.probe.duration, 4);
  assert.deepEqual(m.qa.gate_failures, []);
  assert.deepEqual(m.timeline.pruned_shots, [{ beat_index: 0, dropped: [{ shot_id: "b0s2" }], kept: ["b0s1"] }]);
  assert.equal(m.qa.pruned_shots.length, 1);
});

test("imageCredits: only verified materials, deduped, credit or license+url", () => {
  const report = { beats: [{ beat_index: 0, materials: [
    { material_id: "a", status: "verified", chosen: { credit: "Photo: A, CC BY 4.0" } },
    { material_id: "b", status: "verified", chosen: { credit: "Photo: A, CC BY 4.0" } },
    { material_id: "c", status: "verified", chosen: { source_url: "https://x/y.jpg", license: "CC BY-SA 4.0" } },
    { material_id: "d", status: "missing", chosen: null },
  ] }] };
  assert.deepEqual(imageCredits(report), ["Photo: A, CC BY 4.0", "CC BY-SA 4.0: https://x/y.jpg"]);
});

// ---------------------------------------------------------------- deterministic QA parsers

test("parseBlackdetect/parseFreezedetect/parseVolumedetect read ffmpeg's log lines", () => {
  assert.deepEqual(parseBlackdetect("[blackdetect @ 0x1] black_start:1.5 black_end:3.0 black_duration:1.5"), [{ start: 1.5, end: 3, duration: 1.5 }]);
  assert.deepEqual(parseBlackdetect("no black here"), []);
  const fz = parseFreezedetect("freeze_start: 2\nfreeze_duration: 4.5\nfreeze_end: 6.5");
  assert.equal(fz.length, 1);
  assert.equal(fz[0].duration, 4.5);
  // A freeze that reaches EOF never gets freeze_end (run 40364703475's black fixture):
  // the video duration closes it, or a still frame would read as no freeze at all.
  assert.deepEqual(parseFreezedetect("lavfi.freezedetect.freeze_start: 0", 4), [{ start: 0, end: 4, duration: 4 }]);
  assert.deepEqual(parseVolumedetect("mean_volume: -18.4 dB\nmax_volume: -1.2 dB"), { mean_db: -18.4, max_db: -1.2 });
  assert.deepEqual(parseVolumedetect("nothing"), { mean_db: null, max_db: null });
});

// ---------------------------------------------------------------- deterministic QA verdict

function qaInputs(over = {}) {
  const d = tmp();
  const sheet = join(d, "contact-sheet.jpg");
  writeFileSync(sheet, "jpg");
  mkdirSync(join(d, "frames"));
  return {
    video: { path: join(d, "video.mp4"), exists: true, bytes: 1000 },
    direction: { beats: [{ beat_index: 0, t_start: 0, t_end: 4 }, { beat_index: 1, t_start: 4, t_end: 8 }] },
    framesIndex: { sheet, frames: [0, 0, 0, 1, 1, 1].map((b, i) => ({ beat_index: b, shot_id: `b${b}s1`, t: i, kind: "start" })) },
    shotsDoc: { proof: false, refused: [], shots: [
      { id: "b0s1", beat: 0, family: "reveal", move: "push-in", transition_out: "wipe" },
      { id: "b1s1", beat: 1, family: "map", move: "pan", transition_out: "cut" },
    ] },
    sfxDoc: { cues: [{ mapped: true, file: "hit.wav" }, { mapped: false, file: null }] },
    materialsReport: {
      summary: { materials: 2, verified: 2, missing: 0, unverified: 0 },
      beats: [{ beat_index: 0, materials: [{ material_id: "m1", status: "verified" }] }, { beat_index: 1, materials: [{ material_id: "m2", status: "verified" }] }],
    },
    probe: { ok: true, width: 1080, height: 1920, fps: 30, duration: 8.4, video_codec: "h264", audio_codec: "aac" },
    black: [], freeze: [], volume: { mean_db: -18, max_db: -1 },
    expected: null,
    ...over,
  };
}
const ids = (r) => r.checks.filter((c) => !c.pass).map((c) => c.id);

test("evaluateVisualQa: a real portrait video with motion, audio and verified materials passes", () => {
  const r = evaluateVisualQa(qaInputs());
  assert.deepEqual(ids(r), []);
  assert.equal(r.pass, true);
});

test("evaluateVisualQa: every failure names the check that failed", () => {
  assert.deepEqual(ids(evaluateVisualQa(qaInputs({ black: [{ start: 1, end: 3, duration: 2 }] }))), ["video.no_empty_black"]);
  assert.deepEqual(ids(evaluateVisualQa(qaInputs({ freeze: [{ start: 1, end: 5, duration: 4 }] }))), ["video.not_a_slideshow"]);
  assert.deepEqual(ids(evaluateVisualQa(qaInputs({ volume: { mean_db: -60, max_db: -40 } }))), ["video.not_silent"]);
  assert.deepEqual(ids(evaluateVisualQa(qaInputs({ probe: { ok: true, width: 1920, height: 1080, fps: 30, duration: 8.4, video_codec: "h264", audio_codec: "aac" } }))), ["video.portrait_1080x1920"]);
  assert.deepEqual(ids(evaluateVisualQa(qaInputs({ probe: { ok: true, width: 1080, height: 1920, fps: 30, duration: 30, video_codec: "h264", audio_codec: "aac" } }))), ["video.duration_matches_timeline"]);
  assert.deepEqual(ids(evaluateVisualQa(qaInputs({ probe: { ok: true, width: 1080, height: 1920, fps: 30, duration: 8.4, video_codec: "h264", audio_codec: null } }))), ["video.has_audio"]);
  assert.deepEqual(ids(evaluateVisualQa(qaInputs({ video: { path: "x", exists: false, bytes: 0 }, probe: { ok: false, error: "no video" } }))), ["video.exists", "video.probe", "video.portrait_1080x1920", "video.duration_matches_timeline", "video.has_audio"]);
  // A beat with fewer than 3 inspected frames is a coverage hole, not a pass.
  const few = qaInputs();
  few.framesIndex.frames = few.framesIndex.frames.filter((f) => f.beat_index === 0);
  assert.deepEqual(ids(evaluateVisualQa(few)), ["frames.every_beat_inspected"]);
  // Proof placeholders can never pass production QA.
  const proof = qaInputs();
  proof.shotsDoc = { ...proof.shotsDoc, proof: true, refused: ["b1s1/m2: missing"] };
  assert.deepEqual(ids(evaluateVisualQa(proof)), ["render.production_mode", "render.no_placeholders"]);
  const noMove = qaInputs();
  noMove.shotsDoc = { ...noMove.shotsDoc, shots: noMove.shotsDoc.shots.map((s) => ({ ...s, move: "hold", transition_out: "cut" })) };
  noMove.sfxDoc = { cues: [] };
  assert.deepEqual(ids(evaluateVisualQa(noMove)), ["timeline.not_one_template", "timeline.motion_is_executed", "timeline.effects_executed"]);
  const unverified = qaInputs();
  unverified.materialsReport = { summary: { materials: 2, verified: 1, missing: 0, unverified: 1 }, beats: [{ beat_index: 0, materials: [{ material_id: "m1", status: "verified" }] }, { beat_index: 1, materials: [{ material_id: "m2", status: "unverified" }] }] };
  assert.deepEqual(ids(evaluateVisualQa(unverified)), ["materials.coverage", "materials.all_verified"]);
});
