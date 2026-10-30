// WHICH RENDERER A SCRIPT GETS, AND WHETHER ITS EDITOR TIMELINE IS FIT TO RENDER.
//
// Run 40958756262 (2026-10-29): the three scripts that failed were NOT in scripts/editor/timelines.json, so even with EDITOR_ENGINE=1 they
// used the older Gemini visual-plan pipeline, silently. Worse, a map entry whose timeline file was MISSING also fell back to that pipeline
// with no error. This pins the corrected behaviour: a configured-but-broken timeline is an error, EDITOR_STRICT makes "unmapped" an error,
// a timeline cannot be rendered against the wrong script, and the pre-render check enforces the provenance the final QA later demands.
// It is a static check; final-MP4 QA (scripts/editor/video-qa.js) and the script gates still own the video and the facts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEditorTimeline, timelineProblems, EditorTimelineError } from "../lib/editor-timeline-lookup.mjs";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const STEM = "a-researched-topic-shorts-script";
const SCRIPT = `data/research/2/${STEM}.json`;
const ON = { EDITOR_ENGINE: "1" };

function validTimeline(over = {}) {
  return {
    version: 1, id: "a-researched-topic", width: 1080, height: 1920, fps: 30, durationInFrames: 300,
    palette: { bg: "#000" }, fonts: { body: "x" },
    caption_style: { x: 60, y: 1400, w: 960, h: 300 },
    assets: { img1: { file: "data/editor/assets/img1.jpg", width: 1600, height: 900, credit: "Photo by A. Person, CC BY 4.0", source_url: "https://commons.wikimedia.org/wiki/File:Img1.jpg" } },
    layers: [{ id: "scene-0-image", type: "image", asset_id: "img1", start_f: 0, end_f: 300 }],
    captions: [{ start_f: 0, end_f: 90, text: "Hello there", words: [{ text: "Hello", start_f: 0, end_f: 45 }, { text: "there", start_f: 45, end_f: 90 }] }],
    metadata: { source_script: SCRIPT, source_audio: "data/editor/audio/a-researched-topic.mp3" },
    ...over,
  };
}

function makeRoot({ timeline = validTimeline(), map = { [STEM]: "data/editor/timelines/t.json" }, writeTimeline = true, writeAudio = true, writeAsset = true, rawMap } = {}) {
  const root = mkdtempSync(join(tmpdir(), "editor-lookup-"));
  const put = (rel, text) => { const p = join(root, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
  put("scripts/editor/timelines.json", rawMap ?? JSON.stringify(map));
  if (writeTimeline) put("data/editor/timelines/t.json", typeof timeline === "string" ? timeline : JSON.stringify(timeline));
  if (writeAsset) put("data/editor/assets/img1.jpg", "x");
  if (writeAudio) put("data/editor/audio/a-researched-topic.mp3", "x");
  return root;
}
const withRoot = (opts, fn) => { const root = makeRoot(opts); try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); } };
const codeOf = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof EditorTimelineError, `unexpected ${e}`); return e; } assert.fail("expected an EditorTimelineError"); };

test("the editor is off unless EDITOR_ENGINE is on: nothing changes for other scripts, even if the mapping is broken", () => {
  withRoot({ writeTimeline: false }, (root) => {
    for (const v of [undefined, "", "0", "false", "no"]) assert.equal(resolveEditorTimeline(SCRIPT, { root, env: { EDITOR_ENGINE: v } }), null);
  });
});

test("a mapped, valid timeline resolves, and the result carries the timeline and its path", () => {
  withRoot({}, (root) => {
    const r = resolveEditorTimeline(SCRIPT, { root, env: ON });
    assert.match(r.timelinePath, /t\.json$/);
    assert.equal(r.timeline.id, "a-researched-topic");
    assert.ok(resolveEditorTimeline(SCRIPT, { root, env: { ...ON, EDITOR_STRICT: "1" } }));
  });
});

test("an unmapped script uses the legacy renderer normally, but is an ERROR under EDITOR_STRICT", () => {
  withRoot({}, (root) => {
    const other = "data/research/48/not-mapped-shorts-script.json";
    assert.equal(resolveEditorTimeline(other, { root, env: ON }), null);
    assert.equal(codeOf(() => resolveEditorTimeline(other, { root, env: { ...ON, EDITOR_STRICT: "1" } })).code, "UNMAPPED");
  });
});

test("a map entry that points at a MISSING timeline file is an error, not a quiet fallback to the legacy renderer", () => {
  withRoot({ writeTimeline: false }, (root) => {
    assert.equal(codeOf(() => resolveEditorTimeline(SCRIPT, { root, env: ON })).code, "TIMELINE_MISSING");
  });
});

test("a missing, malformed or non-object timeline map is an error once the editor is requested", () => {
  const missing = makeRoot(); rmSync(join(missing, "scripts/editor/timelines.json"));
  try { assert.equal(codeOf(() => resolveEditorTimeline(SCRIPT, { root: missing, env: ON })).code, "MAP_MISSING"); } finally { rmSync(missing, { recursive: true, force: true }); }
  withRoot({ rawMap: "{not json" }, (root) => assert.equal(codeOf(() => resolveEditorTimeline(SCRIPT, { root, env: ON })).code, "MAP_MALFORMED"));
  withRoot({ rawMap: "[]" }, (root) => assert.equal(codeOf(() => resolveEditorTimeline(SCRIPT, { root, env: ON })).code, "MAP_MALFORMED"));
  withRoot({ map: { [STEM]: 42 } }, (root) => assert.equal(codeOf(() => resolveEditorTimeline(SCRIPT, { root, env: ON })).code, "MAP_ENTRY_INVALID"));
  withRoot({ map: { [STEM]: "  " } }, (root) => assert.equal(codeOf(() => resolveEditorTimeline(SCRIPT, { root, env: ON })).code, "MAP_ENTRY_INVALID"));
});

test("a timeline that is not valid JSON is an error", () => {
  withRoot({ timeline: "{oops" }, (root) => assert.equal(codeOf(() => resolveEditorTimeline(SCRIPT, { root, env: ON })).code, "TIMELINE_MALFORMED"));
});

test("a timeline mapped to the WRONG script is rejected before any render", () => {
  withRoot({ timeline: validTimeline({ metadata: { source_script: "data/research/1/some-other-shorts-script.json", source_audio: "data/editor/audio/a-researched-topic.mp3" } }) }, (root) => {
    const e = codeOf(() => resolveEditorTimeline(SCRIPT, { root, env: ON }));
    assert.equal(e.code, "TIMELINE_INVALID");
    assert.match(e.message, /belongs to script "some-other-shorts-script", not "a-researched-topic-shorts-script"/);
  });
  withRoot({ timeline: validTimeline({ metadata: { source_audio: "data/editor/audio/a-researched-topic.mp3" } }) }, (root) => {
    assert.match(codeOf(() => resolveEditorTimeline(SCRIPT, { root, env: ON })).message, /source_script is missing/);
  });
});

const BAD = {
  "an image without a credit": [(t) => { delete t.assets.img1.credit; }, /no credit/],
  "an image with a blank credit": [(t) => { t.assets.img1.credit = "   "; }, /no credit/],
  "an image without a source_url": [(t) => { delete t.assets.img1.source_url; }, /no http\(s\) source_url/],
  "an image whose source_url is not a URL": [(t) => { t.assets.img1.source_url = "from my head"; }, /no http\(s\) source_url/],
  "an asset file that does not exist": [(t) => { t.assets.img1.file = "data/editor/assets/nope.jpg"; }, /file not found/],
  "a layer that references an unknown asset": [(t) => { t.layers[0].asset_id = "ghost"; }, /unknown asset "ghost"/],
  "no image layers at all (a text-only timeline)": [(t) => { t.layers = []; }, /no image layers/],
  "no caption cues": [(t) => { t.captions = []; }, /no caption cues/],
  "a caption cue past the end of the timeline": [(t) => { t.captions[0].end_f = 9999; }, /outside the timeline/],
  "a caption cue that ends before it starts": [(t) => { t.captions[0].end_f = -1; }, /outside the timeline/],
  "a caption cue without word timings": [(t) => { delete t.captions[0].words; }, /no word timings/],
  "a caption box outside the canvas": [(t) => { t.caption_style = { x: 900, y: 1400, w: 960, h: 300 }; }, /caption box .* is outside/],
  "a voiceover that does not exist": [(t) => { t.metadata.source_audio = "data/editor/audio/missing.mp3"; }, /voiceover not found/],
  "no voiceover recorded": [(t) => { delete t.metadata.source_audio; }, /source_audio is missing/],
  "a non-integer duration": [(t) => { t.durationInFrames = 10.5; }, /durationInFrames.*positive integer/],
  "a missing required field": [(t) => { delete t.fonts; }, /missing required field "fonts"/],
  "an asset with no dimensions": [(t) => { delete t.assets.img1.width; }, /needs file, width and height/],
};
for (const [name, [mutate, expected]] of Object.entries(BAD)) {
  test(`pre-render check rejects ${name}`, () => {
    const t = validTimeline();
    mutate(t);
    withRoot({ timeline: t }, (root) => {
      const e = codeOf(() => resolveEditorTimeline(SCRIPT, { root, env: ON }));
      assert.equal(e.code, "TIMELINE_INVALID");
      assert.match(e.message, expected);
    });
  });
}

test("timelineProblems reports every problem at once, not just the first", () => {
  const t = validTimeline();
  delete t.assets.img1.credit; delete t.assets.img1.source_url; t.captions = [];
  withRoot({ timeline: t }, (root) => assert.ok(timelineProblems(t, { root, stem: STEM }).length >= 3));
});

test("the two timelines that exist in the repo are fit to render, in strict mode too", () => {
  for (const stem of ["aberfan-60-years-books-of-remembrance-shorts-script", "ancient-egypts-first-female-king-royal-seals-shorts-script"]) {
    const r = resolveEditorTimeline(`data/research/1/${stem}.json`, { root: REPO, env: { ...ON, EDITOR_STRICT: "1" } });
    assert.ok(r.timeline.captions.length > 0);
  }
});

// ---- the pipeline actually uses it, and does not render on error --------------------------------------------------------------------
const read = (p) => readFileSync(join(REPO, p), "utf8");

test("render-and-qa.js selects the renderer through the lookup and reports an error instead of rendering", () => {
  const src = read("scripts/render-and-qa.js");
  assert.match(src, /from "\.\/lib\/editor-timeline-lookup\.mjs"/);
  assert.match(src, /return resolveEditorTimeline\(scriptPath, \{ env: process\.env, root: ROOT \}\)/);
  assert.doesNotMatch(src, /return existsSync\(timelinePath\) \? \{ timelinePath, mapPath \} : null/, "the silent fallback is gone");
  const loop = src.slice(src.indexOf("async function renderWithCorrectionLoop"), src.indexOf("async function renderWithCorrectionLoop") + 900);
  assert.match(loop, /catch \(err\)/);
  assert.match(loop, /EditorTimelineError/);
  assert.match(loop, /return \{ skipped: false, ok: false, editorError: err\.code \}/);
  assert.match(src, /=== EDITOR: \$\{basename\(scriptPath\)\} -> \$\{basename\(editorTimeline\.timelinePath\)\} ===/, "the log line that proves the editor ran");
});

test("a failed editor final-MP4 QA rejects the video (it is queued as rejected and never returned as a pass)", () => {
  const src = read("scripts/render-and-qa.js");
  const body = src.slice(src.indexOf("async function renderEditorTimeline"), src.indexOf("async function renderWithCorrectionLoop"));
  assert.match(body, /if \(qa\.code !== 0\)[\s\S]*?verdict: "rejected"[\s\S]*?return \{ skipped: false, ok: false/);
  assert.match(body, /-editor-qa\.json/);
  assert.match(body, /-editor-contact\.jpg/);
});

// ---- no upload / queue processing off the production branch -------------------------------------------------------------------------
const lines = (p) => read(p).split("\n");
const stepIf = (file, name) => {
  const l = lines(file); const i = l.findIndex((x) => x.includes(`- name: ${name}`));
  assert.ok(i >= 0, `step "${name}" not found`);
  for (let k = i + 1; k < Math.min(i + 6, l.length); k++) if (/^\s*if:/.test(l[k])) return l[k];
  return "";
};

test("the daily pipeline cannot upload or process the queue except on main and outside a dry run", () => {
  const f = ".github/workflows/daily-pipeline-v2.yml";
  for (const step of ["Publish to YouTube (private)", "Process publish queue"]) {
    const cond = stepIf(f, step);
    assert.match(cond, /github\.ref == 'refs\/heads\/main'/, `${step} must be main-only`);
    assert.match(cond, /dry_run != 'true'/, `${step} must not run in a dry run`);
  }
  assert.match(stepIf(f, "Process publish queue"), /hold_public != 'true'/);
  const text = read(f);
  const rp = text.slice(text.indexOf("  review-publish:"), text.indexOf("  review-publish:") + 2500);
  assert.match(rp, /if: \$\{\{ always\(\) && github\.ref == 'refs\/heads\/main'/, "review-publish is main-only");
});

test("the editor proof workflow is read-only: strict, push-limited to its proof branch, no secrets, no publish code", () => {
  const t = read(".github/workflows/editor-proof.yml");
  assert.match(t, /EDITOR_ENGINE: "1"/);
  assert.match(t, /EDITOR_STRICT: "1"/);
  assert.match(t, /permissions:\s*\n\s*contents: read/);
  assert.match(t, /push:\s*\n\s*branches:\s*\n\s*- editor\/persisted-timeline/);
  assert.doesNotMatch(t, /secrets\.|youtube-publish|process-queue|YOUTUBE_/);
  assert.match(t, /--channel "\$ch"/, "the channel comes from the script path, not a hard-coded 1");
  assert.doesNotMatch(t, /--channel 1 /);
});
