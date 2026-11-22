// The evidence record for an editor-rendered video: renderer identity + SHA-256 of the exact script, timeline, voiceover, MP4, QA report and
// every image, so "this MP4 is the render of the validated script and timeline of this run" can be checked. It must refuse to describe
// anything that is not a real, non-empty, QA-passing editor render. Pure fixtures; no network, no ffmpeg.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEditorManifest, writeEditorManifest, ManifestError, RENDERER_ID } from "../lib/editor-manifest.mjs";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const STEM = "a-researched-topic-shorts-script";
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

function fixture(mut = {}) {
  const root = mkdtempSync(join(tmpdir(), "manifest-"));
  const put = (rel, data) => { const p = join(root, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, data); return rel; };
  const files = {
    script: put(`data/research/2/${STEM}.json`, JSON.stringify({ channel_id: "2", sections: [{ id: "hook", voiceover: "x" }] })),
    audio: put("data/editor/audio/t.mp3", "AUDIO-BYTES"),
    asset: put("data/editor/assets/img1.jpg", "IMAGE-BYTES"),
    video: put("data/renders/2/out.mp4", "MP4-BYTES"),
    contact: put("data/renders/2/out-editor-contact.jpg", "JPEG-BYTES"),
  };
  const timeline = {
    id: "a-researched-topic", durationInFrames: 300, fps: 30,
    assets: { img1: { file: files.asset, width: 100, height: 100, credit: "Photo A, CC BY 4.0", source_url: "https://commons.wikimedia.org/wiki/File:A.jpg", license: "CC BY 4.0" } },
    layers: [{ id: "scene-0-image", type: "image", asset_id: "img1" }],
    metadata: { source_script: `data/research/2/${STEM}.json`, source_audio: files.audio },
    ...(mut.timeline || {}),
  };
  files.timeline = put("data/editor/timelines/t.json", JSON.stringify(timeline));
  const qa = { editor_timeline: true, pass: true, video: files.video, timeline: files.timeline, duration_s: 10, width: 540, height: 960, checks: { image_seconds_share: 1 }, ...(mut.qa || {}) };
  files.qa = put("data/renders/2/out-editor-qa.json", JSON.stringify(qa));
  return { root, files };
}
const opts = (f, extra = {}) => ({ root: f.root, channelId: "2", scriptPath: f.files.script, timelinePath: f.files.timeline, audioPath: f.files.audio, videoPath: f.files.video, qaPath: f.files.qa, contactPath: f.files.contact, ...extra });
const withFx = (mut, fn) => { const f = fixture(mut); try { return fn(f); } finally { rmSync(f.root, { recursive: true, force: true }); } };
const refuses = (f, extra, re) => assert.throws(() => buildEditorManifest(opts(f, extra)), (e) => e instanceof ManifestError && re.test(e.message), String(re));

test("the manifest names the editor renderer and binds the MP4 to its exact inputs by SHA-256", () => {
  withFx({}, (f) => {
    const m = buildEditorManifest(opts(f, { env: { GITHUB_RUN_ID: "123", GITHUB_SHA: "abc", GITHUB_REPOSITORY: "o/r", GITHUB_REF_NAME: "fix/x" }, now: new Date("2026-10-30T00:00:00Z") }));
    assert.equal(m.renderer.id, RENDERER_ID);
    assert.equal(m.renderer.legacy, false);
    assert.equal(m.channel_id, "2");
    assert.equal(m.script.sha256, sha(readFileSync(join(f.root, f.files.script))));
    assert.equal(m.script.stem, STEM);
    assert.equal(m.timeline.sha256, sha(readFileSync(join(f.root, f.files.timeline))));
    assert.equal(m.voiceover.sha256, sha("AUDIO-BYTES"));
    assert.equal(m.video.sha256, sha("MP4-BYTES"));
    assert.equal(m.video.bytes, 9);
    assert.deepEqual([m.video.duration_s, m.video.width, m.video.height], [10, 540, 960]);
    assert.equal(m.qa.pass, true);
    assert.equal(m.qa.report_sha256, sha(readFileSync(join(f.root, f.files.qa))));
    assert.deepEqual(m.assets.map((a) => [a.id, a.sha256, a.credit, a.source_url, a.license]), [["img1", sha("IMAGE-BYTES"), "Photo A, CC BY 4.0", "https://commons.wikimedia.org/wiki/File:A.jpg", "CC BY 4.0"]]);
    assert.deepEqual(m.ci, { repository: "o/r", run_id: "123", run_attempt: null, commit: "abc", ref: "fix/x" });
    assert.equal(m.generated_at, "2026-10-30T00:00:00.000Z");
    assert.ok(Object.values(m).flat().every((v) => typeof v !== "string" || !/[A-Za-z]:\\/.test(v)), "no absolute Windows paths");
  });
});

test("a different script, voiceover or video gives a different hash (the binding is real)", () => {
  withFx({}, (f) => {
    const before = buildEditorManifest(opts(f));
    writeFileSync(join(f.root, f.files.script), JSON.stringify({ changed: true }));
    writeFileSync(join(f.root, f.files.video), "OTHER-MP4");
    const after = buildEditorManifest(opts(f));
    assert.notEqual(after.script.sha256, before.script.sha256);
    assert.notEqual(after.video.sha256, before.video.sha256);
    assert.equal(after.voiceover.sha256, before.voiceover.sha256);
  });
});

test("writeEditorManifest puts <video>-editor-manifest.json next to the MP4", () => {
  withFx({}, (f) => {
    const out = writeEditorManifest(opts(f));
    assert.equal(out, join(f.root, "data/renders/2/out-editor-manifest.json"));
    assert.equal(JSON.parse(readFileSync(out, "utf8")).video.path, "data/renders/2/out.mp4");
  });
});

test("nothing is written for a video that is missing, empty, or not a QA pass", () => {
  withFx({}, (f) => { rmSync(join(f.root, f.files.video)); refuses(f, {}, /rendered video does not exist/); assert.equal(existsSync(join(f.root, "data/renders/2/out-editor-manifest.json")), false); });
  withFx({}, (f) => { writeFileSync(join(f.root, f.files.video), ""); refuses(f, {}, /rendered video is empty/); });
  withFx({ qa: { pass: false } }, (f) => refuses(f, {}, /does not say pass:true/));
  withFx({ qa: { pass: "true" } }, (f) => refuses(f, {}, /does not say pass:true/));
  withFx({}, (f) => { writeFileSync(join(f.root, f.files.qa), "{oops"); refuses(f, {}, /QA report is not valid JSON/); });
});

test("a QA report for a DIFFERENT video or timeline cannot vouch for this one", () => {
  withFx({ qa: { video: "data/renders/2/another.mp4" } }, (f) => refuses(f, {}, /different video/));
  withFx({ qa: { timeline: "data/editor/timelines/other.json" } }, (f) => refuses(f, {}, /different timeline/));
});

test("a timeline that belongs to another script, or lacks images, voiceover, contact sheet or asset files, is refused", () => {
  withFx({ timeline: { metadata: { source_script: "data/research/1/some-other-shorts-script.json" } } }, (f) => refuses(f, {}, /belongs to script "some-other-shorts-script"/));
  withFx({ timeline: { layers: [] } }, (f) => refuses(f, {}, /shows no images/));
  withFx({}, (f) => { rmSync(join(f.root, f.files.audio)); refuses(f, {}, /voiceover does not exist/); });
  withFx({}, (f) => { rmSync(join(f.root, f.files.contact)); refuses(f, {}, /contact sheet does not exist/); });
  withFx({}, (f) => { rmSync(join(f.root, f.files.asset)); refuses(f, {}, /asset "img1" has no file on disk/); });
  withFx({}, (f) => { rmSync(join(f.root, f.files.script)); refuses(f, {}, /script does not exist/); });
});

// ---- wiring: only the editor path writes it, only after QA passed, and a failure to write it is a rejection ------------------------------------
test("render-and-qa.js writes the manifest only in the editor path, after QA passed, and rejects the video if it cannot", () => {
  const src = readFileSync(join(REPO, "scripts/render-and-qa.js"), "utf8");
  assert.equal((src.match(/writeEditorManifest\(/g) || []).length, 1, "called exactly once");
  const start = src.indexOf("async function renderEditorTimeline");
  const end = src.indexOf("async function renderWithCorrectionLoop");
  const body = src.slice(start, end);
  const call = body.indexOf("writeEditorManifest(");
  assert.ok(call > body.indexOf("passed final-MP4 QA"), "after the QA pass");
  assert.ok(call < body.indexOf("ok: true"), "before the success result");
  assert.match(body, /catch \(err\)[\s\S]*?verdict: "rejected"[\s\S]*?stage: "editor-manifest"[\s\S]*?return \{ skipped: false, ok: false/);
  assert.match(body, /editorManifest: manifestPath/);
});
