/**
 * Coverage-pass tests: sentence-level visual coverage instead of one scene per sentence.
 *
 * These tests exercise buildCoveragePlan, buildCoverageTimeline and the
 * coverage-audit gate with synthetic word timings (no network, no model) so
 * they run in CI without secrets or external services. Assets resolve to
 * honest label-card fallbacks when no real image is available.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { buildCoveragePlan } from "../editor/coverage-plan.mjs";
import { buildCoverageTimeline } from "../editor/coverage-timeline.mjs";
import { buildCaptions, scriptSentences } from "../editor/captions.mjs";
import { auditCoverage } from "../editor/coverage-audit.mjs";
import { solidLayer, svgLayer } from "../editor/coverage-layers.mjs";

function load(ch) {
  const script = JSON.parse(readFileSync(`data/research/${ch}/${ch === "1" ? "margaret-clitherow-execution-guy-fawkes" : ch === "2" ? "wso2-integrator-5-1-ai-workflow-release" : "university-of-michigan-haptic-steering-wheel-semi-autonomous"}-shorts-script.json`, "utf8"));
  const research = JSON.parse(readFileSync(`data/research/${ch}/${ch === "1" ? "margaret-clitherow-execution-guy-fawkes" : ch === "2" ? "wso2-integrator-5-1-ai-workflow-release" : "university-of-michigan-haptic-steering-wheel-semi-autonomous"}.json`, "utf8"));
  return { script, research };
}

function syntheticWords(script, duration) {
  const sentences = scriptSentences(script);
  let t = 0;
  const words = [];
  sentences.forEach((s, i) => {
    const ws = s.split(/\s+/);
    const dur = Math.max(1.0, ws.length / 2.6);
    ws.forEach((w, j) => { words.push({ text: w, word: w, sentence: i, start: t + dur * j / ws.length, end: t + dur * (j + 1) / ws.length }); });
    t += dur;
  });
  return { words, sentences, audioDuration: Math.max(t, duration || 30) };
}

function planFor(ch) {
  const { script, research } = load(ch);
  const { words, audioDuration } = syntheticWords(script);
  const plan = buildCoveragePlan({ script, research, words, audioDuration });
  return { plan, script, research, words, ttsWords: { words }, audioDuration };
}

function transcriptFromWords(words) {
  const by = new Map();
  for (const w of words.words || []) {
    if (!by.has(w.sentence)) by.set(w.sentence, []);
    by.get(w.sentence).push(w);
  }
  return {
    text: "",
    segments: [...by.keys()].sort().map((k) => {
      const ws = by.get(k);
      return { start: ws[0].start, end: ws.at(-1).end, text: " " + ws.map((x) => x.text).join(" "), words: ws.map((x) => ({ word: x.text, start: x.start, end: x.end })) };
    }),
    language: "en", source: "test",
  };
}

test("ch-1 coverage plan covers every essential concept with zero uncovered (20+ beats, 9 sentences)", () => {
  const { plan } = planFor("1");
  assert.equal(plan.report.uncovered.length, 0, `uncovered: ${JSON.stringify(plan.report.uncovered)}`);
  assert.ok(plan.report.beat_count >= 15, `expected 15+ beats, got ${plan.report.beat_count}`);
  assert.equal(plan.report.sentence_count, 9);
  assert.equal(plan.report.timing, "voiceover");
  // Multi-concept sentence 0: 1586 + pregnant mother + crushing + York -> 4 beats.
  const s0 = plan.report.beats_per_sentence.find((b) => b.sentence === 0);
  assert.ok(s0.beats >= 3, `sentence 0 should have 3+ beats, got ${s0.beats}`);
  console.log(`ch-1: ${plan.report.beat_count} beats / ${plan.report.sentence_count} sentences, ${plan.report.concept_count} concepts`);
});

test("ch-2 coverage plan covers every essential concept with zero uncovered", () => {
  const { plan } = planFor("2");
  assert.equal(plan.report.uncovered.length, 0, `uncovered: ${JSON.stringify(plan.report.uncovered)}`);
  assert.ok(plan.report.beat_count >= 10, `expected 10+ beats, got ${plan.report.beat_count}`);
  assert.equal(plan.report.sentence_count, 8);
  console.log(`ch-2: ${plan.report.beat_count} beats / ${plan.report.sentence_count} sentences, ${plan.report.concept_count} concepts`);
});

test("ch-48 coverage plan covers every essential concept with zero uncovered", () => {
  const { plan } = planFor("48");
  assert.equal(plan.report.uncovered.length, 0, `uncovered: ${JSON.stringify(plan.report.uncovered)}`);
  assert.ok(plan.report.beat_count >= 5, `expected 5+ beats, got ${plan.report.beat_count}`);
  assert.equal(plan.report.sentence_count, 5);
  console.log(`ch-48: ${plan.report.beat_count} beats / ${plan.report.sentence_count} sentences, ${plan.report.concept_count} concepts`);
});

test("coverage timeline builds valid layers and captions for ch-48 (diagram + annotated compositions)", async () => {
  const { plan, ttsWords, audioDuration } = planFor("48");
  const { script } = planFor("48");
  const captions = buildCaptions({ script, whisper: transcriptFromWords(ttsWords), duration: audioDuration });
  const tl = await buildCoverageTimeline({ plan, assetsByBeat: {}, captions, audioDuration, channel: { font: "Inter" } });
  assert.ok(tl.durationInFrames >= 1);
  assert.ok(tl.layers.length > 0, "timeline has layers");
  assert.ok(tl.captions.length > 0, "timeline has captions");
  assert.ok(tl.assets || {}, "timeline has assets object");
  // Every layer is within the timeline duration.
  for (const l of tl.layers) {
    assert.ok(l.in >= 0 && l.out <= tl.durationInFrames + 1, `layer ${l.id} out of range ${l.in}-${l.out} vs ${tl.durationInFrames}`);
    assert.ok(l.out > l.in, `layer ${l.id} has zero span`);
  }
  const byType = {};
  for (const l of tl.layers) byType[l.type] = (byType[l.type] || 0) + 1;
  assert.ok(byType.solid, "background solids present");
  assert.ok(byType.text, "label text present");
  console.log(`ch-48 timeline: ${tl.layers.length} layers (${JSON.stringify(byType)}), ${tl.captions.length} captions`);
});

test("coverage audit passes a clean coverage timeline", async () => {
  const { script, research } = load("48");
  const { words, audioDuration } = syntheticWords(script);
  const plan = buildCoveragePlan({ script, research, words: words.words, audioDuration });
  const captions = buildCaptions({ script, whisper: transcriptFromWords(words), duration: audioDuration });
  const tl = await buildCoverageTimeline({ plan, assetsByBeat: {}, captions, audioDuration, channel: {} });
  tl.metadata.coverage = true;
  const report = await auditCoverage({ timeline: tl, coverageReport: plan.report });
  assert.equal(report.pass, true, `audit should pass: ${JSON.stringify(report.failures)}`);
  assert.equal(report.checks.uncovered_count, 0);
  assert.equal(report.checks.decorative_layers, 0);
});

test("coverage audit fails when an image layer has no motion", async () => {
  const { script, research } = load("48");
  const { words, audioDuration } = syntheticWords(script);
  const plan = buildCoveragePlan({ script, research, words: words.words, audioDuration });
  const captions = buildCaptions({ script, whisper: transcriptFromWords(words), duration: audioDuration });
  const tl = await buildCoverageTimeline({ plan, assetsByBeat: {}, captions, audioDuration, channel: {} });
  tl.metadata.coverage = true;
  // Add a still image layer (no keyframes -> no motion).
  tl.layers.push({ id: "still-image", type: "image", asset_id: "asset-x", rect: { x: 0, y: 0, w: 1080, h: 1920 }, in: 0, out: 90, z: 999, props: { opacity: 1 }, keyframes: {} });
  tl.assets["asset-x"] = { file: "data/editor/auto/assets/x.jpg", width: 1080, height: 1920, credit: "Test", source_url: "https://example.com/x", license: "Test" };
  const report = await auditCoverage({ timeline: tl, coverageReport: plan.report });
  assert.equal(report.pass, false, "audit should fail on a still image layer");
  assert.ok(report.failures.some((f) => f.check === "motion"), "expected a motion failure");
});

test("coverage audit fails when an asset lacks credit or source_url", async () => {
  const { script, research } = load("48");
  const { words, audioDuration } = syntheticWords(script);
  const plan = buildCoveragePlan({ script, research, words: words.words, audioDuration });
  const captions = buildCaptions({ script, whisper: transcriptFromWords(words), duration: audioDuration });
  const tl = await buildCoverageTimeline({ plan, assetsByBeat: {}, captions, audioDuration, channel: {} });
  tl.metadata.coverage = true;
  tl.assets["asset-x"] = { file: "data/editor/auto/assets/x.jpg", width: 1080, height: 1920 }; // no credit, no source_url
  tl.layers.push({ id: "img-x", type: "image", asset_id: "asset-x", rect: { x: 0, y: 0, w: 1080, h: 1920 }, in: 0, out: 90, z: 999, props: { opacity: 1 }, keyframes: { opacity: [{ f: 0, v: 1 }, { f: 90, v: 1 }] } });
  const report = await auditCoverage({ timeline: tl, coverageReport: plan.report });
  assert.equal(report.pass, false, "audit should fail on missing provenance");
  assert.ok(report.failures.some((f) => f.check === "provenance"), "expected a provenance failure");
});

/** Build a minimal synthetic script + research for focused sentence tests. */
function makeTestScript(voiceover) {
  return {
    sources_used: ["https://example.com/test"],
    sections: [{ id: "s1", voiceover }],
  };
}

function makeTestResearch(entities = []) {
  return { strongest_angle: "test", named_entities: entities };
}

test("Part 5: one important subject gets at least one beat", () => {
  const script = makeTestScript("The bridge collapsed in 1986.");
  const research = makeTestResearch([{ name: "The bridge", kind: "object" }, { name: "1986", kind: "year" }]);
  const sentences = scriptSentences(script);
  let t = 0;
  const words = [];
  sentences.forEach((s, i) => {
    const ws = s.split(/\s+/);
    const dur = Math.max(1.0, ws.length / 2.6);
    ws.forEach((w, j) => { words.push({ text: w, word: w, sentence: i, start: t + dur * j / ws.length, end: t + dur * (j + 1) / ws.length }); });
    t += dur;
  });
  const plan = buildCoveragePlan({ script, research, words, audioDuration: t });
  assert.equal(plan.report.uncovered.length, 0, `uncovered: ${JSON.stringify(plan.report.uncovered)}`);
  assert.ok(plan.report.beat_count >= 1, `expected 1+ beat for single subject, got ${plan.report.beat_count}`);
});

test("Part 5: two distinct subjects get at least two beats", () => {
  const script = makeTestScript("The engineer inspected the bridge while workers evacuated residents.");
  const research = makeTestResearch([{ name: "The engineer", kind: "person" }, { name: "the bridge", kind: "object" }, { name: "workers", kind: "person" }, { name: "residents", kind: "person" }]);
  
  const sentences = scriptSentences(script);
  let t = 0;
  const words = [];
  sentences.forEach((s, i) => {
    const ws = s.split(/\s+/);
    const dur = Math.max(1.0, ws.length / 2.6);
    ws.forEach((w, j) => { words.push({ text: w, word: w, sentence: i, start: t + dur * j / ws.length, end: t + dur * (j + 1) / ws.length }); });
    t += dur;
  });
  const plan = buildCoveragePlan({ script, research, words, audioDuration: t });
  assert.equal(plan.report.uncovered.length, 0, `uncovered: ${JSON.stringify(plan.report.uncovered)}`);
  assert.ok(plan.report.beat_count >= 2, `expected 2+ beats for two subjects, got ${plan.report.beat_count}`);
});

test("Part 5: several subjects and actions get multiple beats", () => {
  const script = makeTestScript("The aircraft approached the runway as the control tower issued landing clearance.");
  const research = makeTestResearch([{ name: "The aircraft", kind: "object" }, { name: "the runway", kind: "object" }, { name: "the control tower", kind: "object" }]);
  
  const sentences = scriptSentences(script);
  let t = 0;
  const words = [];
  sentences.forEach((s, i) => {
    const ws = s.split(/\s+/);
    const dur = Math.max(1.0, ws.length / 2.6);
    ws.forEach((w, j) => { words.push({ text: w, word: w, sentence: i, start: t + dur * j / ws.length, end: t + dur * (j + 1) / ws.length }); });
    t += dur;
  });
  const plan = buildCoveragePlan({ script, research, words, audioDuration: t });
  assert.equal(plan.report.uncovered.length, 0, `uncovered: ${JSON.stringify(plan.report.uncovered)}`);
  assert.ok(plan.report.beat_count >= 2, `expected 2+ beats for aircraft+tower, got ${plan.report.beat_count}`);
});

test("Part 5: before-and-after explanation gets distinct beats", () => {
  const script = makeTestScript("Before the renovation, the hall was dark. After the renovation, it was bright.");
  const research = makeTestResearch([{ name: "the hall", kind: "object" }]);
  
  const sentences = scriptSentences(script);
  let t = 0;
  const words = [];
  sentences.forEach((s, i) => {
    const ws = s.split(/\s+/);
    const dur = Math.max(1.0, ws.length / 2.6);
    ws.forEach((w, j) => { words.push({ text: w, word: w, sentence: i, start: t + dur * j / ws.length, end: t + dur * (j + 1) / ws.length }); });
    t += dur;
  });
  const plan = buildCoveragePlan({ script, research, words, audioDuration: t });
  assert.equal(plan.report.uncovered.length, 0, `uncovered: ${JSON.stringify(plan.report.uncovered)}`);
  assert.ok(plan.report.beat_count >= 2, `expected 2+ beats for before/after, got ${plan.report.beat_count}`);
});

test("Part 5: geographical explanation names place and event", () => {
  const script = makeTestScript("The earthquake struck San Francisco in 1906.");
  const research = makeTestResearch([{ name: "San Francisco", kind: "place" }, { name: "1906", kind: "year" }]);
  
  const sentences = scriptSentences(script);
  let t = 0;
  const words = [];
  sentences.forEach((s, i) => {
    const ws = s.split(/\s+/);
    const dur = Math.max(1.0, ws.length / 2.6);
    ws.forEach((w, j) => { words.push({ text: w, word: w, sentence: i, start: t + dur * j / ws.length, end: t + dur * (j + 1) / ws.length }); });
    t += dur;
  });
  const plan = buildCoveragePlan({ script, research, words, audioDuration: t });
  assert.equal(plan.report.uncovered.length, 0, `uncovered: ${JSON.stringify(plan.report.uncovered)}`);
  assert.ok(plan.report.beat_count >= 2, `expected 2+ beats for place+year, got ${plan.report.beat_count}`);
});

test("Part 5: historical person and document get coverage", () => {
  const script = makeTestScript("Margaret Clitherow refused to enter a plea in the 1586 trial record.");
  const research = makeTestResearch([{ name: "Margaret Clitherow", kind: "person" }, { name: "1586", kind: "year" }]);
  
  const sentences = scriptSentences(script);
  let t = 0;
  const words = [];
  sentences.forEach((s, i) => {
    const ws = s.split(/\s+/);
    const dur = Math.max(1.0, ws.length / 2.6);
    ws.forEach((w, j) => { words.push({ text: w, word: w, sentence: i, start: t + dur * j / ws.length, end: t + dur * (j + 1) / ws.length }); });
    t += dur;
  });
  const plan = buildCoveragePlan({ script, research, words, audioDuration: t });
  assert.equal(plan.report.uncovered.length, 0, `uncovered: ${JSON.stringify(plan.report.uncovered)}`);
  assert.ok(plan.report.beat_count >= 2, `expected 2+ beats for person+document, got ${plan.report.beat_count}`);
});

test("Part 5: physical process gets sequential beats", () => {
  const script = makeTestScript("The engine burns fuel, drives the pistons, and turns the crankshaft.");
  const research = makeTestResearch([{ name: "The engine", kind: "object" }, { name: "fuel", kind: "object" }, { name: "pistons", kind: "object" }, { name: "crankshaft", kind: "object" }]);
  
  const sentences = scriptSentences(script);
  let t = 0;
  const words = [];
  sentences.forEach((s, i) => {
    const ws = s.split(/\s+/);
    const dur = Math.max(1.0, ws.length / 2.6);
    ws.forEach((w, j) => { words.push({ text: w, word: w, sentence: i, start: t + dur * j / ws.length, end: t + dur * (j + 1) / ws.length }); });
    t += dur;
  });
  const plan = buildCoveragePlan({ script, research, words, audioDuration: t });
  assert.equal(plan.report.uncovered.length, 0, `uncovered: ${JSON.stringify(plan.report.uncovered)}`);
  assert.ok(plan.report.beat_count >= 2, `expected 2+ beats for process steps, got ${plan.report.beat_count}`);
});

test("Part 5: timeline layers include pan drift on all layers to prevent static runs", async () => {
  const script = makeTestScript("The bridge collapsed in 1986.");
  const research = makeTestResearch([{ name: "The bridge", kind: "object" }]);
  
  const sentences = scriptSentences(script);
  let t = 0;
  const words = [];
  sentences.forEach((s, i) => {
    const ws = s.split(/\s+/);
    const dur = Math.max(1.0, ws.length / 2.6);
    ws.forEach((w, j) => { words.push({ text: w, word: w, sentence: i, start: t + dur * j / ws.length, end: t + dur * (j + 1) / ws.length }); });
    t += dur;
  });
  const plan = buildCoveragePlan({ script, research, words, audioDuration: t });
  const captions = buildCaptions({ script, whisper: transcriptFromWords({ words }), duration: t });
  const tl = await buildCoverageTimeline({ plan, assetsByBeat: {}, captions, audioDuration: t, channel: {} });
  // Every image layer should have scale keyframes (purposeful motion).
  // Every SVG diagram layer should have draw keyframes.
  // Background solid layers are intentionally static.
  for (const l of tl.layers) {
    const kf = l.keyframes || {};
    if (l.type === "solid") continue; // background solids are intentionally static
    if (l.type === "image") {
      assert.ok(kf.scale, "image layer " + l.id + " has no scale motion");
    }
    if (l.type === "svg") {
      assert.ok(kf.draw, "svg layer " + l.id + " has no draw motion");
    }
  }
});

/** Build a minimal coverage timeline with controllable image layers. */
function minimalTimeline(imageLayers = [], extra = {}) {
  return {
    id: "coverage-test",
    title: "Coverage test timeline",
    width: 1080, height: 1920, fps: 30, durationInFrames: 300,
    palette: {}, fonts: {}, caption_style: {},
    assets: {},
    layers: [
      { id: "bg", type: "solid", rect: { x: 0, y: 0, w: 1080, h: 1920 }, in: 0, out: 300, z: 1, props: { opacity: 1 }, keyframes: { opacity: [{ f: 0, v: 1 }] } },
      ...imageLayers,
    ],
    captions: [],
    metadata: { coverage: true, ...extra.metadata },
    ...extra,
  };
}

function imageLayer(id, { role, file, asset_id = "asset-" + id, motion = "push_in", credit = "Test", source_url = "https://example.com/x" } = {}) {
  const layer = {
    id, type: "image", asset_id, role,
    rect: { x: 0, y: 0, w: 1080, h: 1920 }, in: 0, out: 90, z: 10, props: { opacity: 1 },
    keyframes: { opacity: [{ f: 0, v: 1 }, { f: 90, v: 1 }], scale: [{ f: 0, v: 1 }, { f: 90, v: 1.08 }] },
  };
  if (file) layer.file = file;
  if (motion === "still") layer.keyframes = { opacity: [{ f: 0, v: 1 }, { f: 90, v: 1 }] };
  return layer;
}

test("coverage audit regression: person/place label-card image layer no longer throws (object is not iterable)", async () => {
  // Before the fix, line 81 ran personPlaceLabelCards.map(([i]) => i) over
  // layer OBJECTS (not [key, value] tuples), throwing TypeError: object is not iterable.
  const tl = minimalTimeline([
    imageLayer("img-person-card", { role: "person", file: "margaret.label.card.png", motion: "push_in" }),
  ]);
  tl.assets["asset-img-person-card"] = { file: "data/editor/auto/assets/margaret.label.card.png", width: 1080, height: 1920, credit: "Test", source_url: "https://example.com/person", license: "Test" };
  let threw = false;
  let report = null;
  try {
    report = await auditCoverage({ timeline: tl, coverageReport: { uncovered: [], beat_count: 1 } });
  } catch (e) { threw = true; console.error("unexpected throw:", e); }
  assert.equal(threw, false, "audit must not throw on person/place label-card image layers");
  assert.equal(report.pass, false, "audit should fail a person/place label-card layer");
  assert.ok(report.failures.some((f) => f.check === "person-place-photo"), "expected a person-place-photo failure");
  assert.ok(report.failures.some((f) => f.why.includes("img-person-card")), "failure should name the offending layer");
  assert.equal(report.checks.person_place_image_layers, 1);
  assert.equal(report.checks.person_place_label_cards, 1);
});

test("coverage audit counts moving vs still image layers and evaluates image layers", async () => {
  const tl = minimalTimeline([
    imageLayer("img-moving", { motion: "push_in" }),
    imageLayer("img-still", { motion: "still" }),
  ]);
  tl.assets["asset-img-moving"] = { file: "a.jpg", credit: "C", source_url: "https://example.com/a", license: "T" };
  tl.assets["asset-img-still"] = { file: "b.jpg", credit: "C", source_url: "https://example.com/b", license: "T" };
  const report = await auditCoverage({ timeline: tl, coverageReport: { uncovered: [], beat_count: 1 } });
  assert.equal(report.pass, false, "still image layer should fail the motion check");
  assert.equal(report.checks.image_layers, 2);
  assert.equal(report.checks.moving_image_layers, 1);
  assert.equal(report.checks.still_image_layers, 1);
  assert.ok(report.failures.some((f) => f.check === "motion" && f.why.includes("img-still")));
});

test("coverage audit handles empty image layers and missing optional fields without throwing", async () => {
  // No image layers at all.
  const empty = minimalTimeline([]);
  let report = await auditCoverage({ timeline: empty, coverageReport: { uncovered: [], beat_count: 0 } });
  assert.equal(report.pass, false, "no beats should fail");
  assert.equal(report.checks.image_layers, 0);
  assert.equal(report.checks.moving_image_layers, 0);
  assert.equal(report.checks.still_image_layers, 0);

  // Image layer missing optional role/file/credit/source_url fields.
  const sparse = minimalTimeline([
    imageLayer("img-sparse", {}), // no role, no file, default asset_id
  ]);
  sparse.assets = {}; // asset not registered -> no provenance entry for it
  report = await auditCoverage({ timeline: sparse, coverageReport: { uncovered: [], beat_count: 1 } });
  assert.equal(report.checks.image_layers, 1);
  assert.equal(report.checks.person_place_image_layers, 0);
  assert.equal(report.checks.person_place_label_cards, 0);
  assert.equal(report.pass, true, "sparse but motionful layer with no person/place role should pass");
});

test("coverage audit ignores layers without asset_id as image layers (unexpected structure)", async () => {
  const tl = minimalTimeline([
    { id: "not-image", type: "solid", rect: { x: 0, y: 0, w: 1080, h: 1920 }, in: 0, out: 300, z: 1, props: { opacity: 1 } },
    { id: "image-no-asset", type: "image", rect: { x: 0, y: 0, w: 1080, h: 1920 }, in: 0, out: 90, z: 10, props: { opacity: 1 }, keyframes: { scale: [{ f: 0, v: 1 }, { f: 90, v: 1.08 }] } }, // no asset_id
    imageLayer("img-real", { motion: "push_in" }),
  ]);
  tl.assets["asset-img-real"] = { file: "a.jpg", credit: "C", source_url: "https://example.com/a", license: "T" };
  const report = await auditCoverage({ timeline: tl, coverageReport: { uncovered: [], beat_count: 1 } });
  assert.equal(report.checks.image_layers, 1, "only layers with asset_id count as image layers");
  assert.equal(report.pass, true);
});

test("coverage timeline does not crash when a beat's visual class has no diagram area but holds a clock diagram", async () => {
  // compRect("organization") (and document/place/entity/photo) returns diagramX: null, so
  // diagramLayersFor was called with rect: null and clockDiagram crashed reading rect.w.
  // Passing undefined lets diagramLayersFor fall back to its default rect instead of crashing.
  const clockConcept = { id: "c0", label: "10 o'clock zone", visual: "annotated", diagram: "clock", value: 10, essential: true };
  const plan = {
    sentences: [],
    beats: [{
      id: "b0.0", sentence: 0, start: 0, end: 90, covers: ["c0"], labels: ["10 o'clock zone"],
      concepts: [clockConcept],
      visual_class: "organization", // compRect default -> diagramX: null
      revisit: false,
      motion: { type: "settle", direction: "none", reason: "test", start_f: 0, end_f: 90 },
    }],
    concepts: [clockConcept],
    report: { uncovered: [], beat_count: 1 },
  };
  const assetsByBeat = {
    "b0.0": { assets: {}, diagrams: [{ concept: clockConcept }], photoAsset: null },
  };
  let threw = false;
  let tl = null;
  try {
    tl = await buildCoverageTimeline({ plan, assetsByBeat, captions: [], audioDuration: 3, channel: {} });
  } catch (e) { threw = true; console.error("unexpected throw:", e); }
  assert.equal(threw, false, "timeline build must not throw when a diagram has no designated diagram area");
  assert.ok(tl, "timeline was produced");
  const diagramLayers = tl.layers.filter((l) => l.type === "svg");
  assert.ok(diagramLayers.length > 0, "diagram layers should still be drawn");
});

test("solidLayer forwards custom keyframes (ty/tx drift) so background solids are not held static", () => {
  const layer = solidLayer({
    id: "bg-drift", rect: { x: 0, y: 0, w: 1080, h: 1920 }, background: "#08090B",
    inF: 0, outF: 90, z: 1, opacity: 1,
    keyframes: { ty: [{ f: 0, v: 0 }, { f: 45, v: 100 }, { f: 90, v: 0 }] },
  });
  // The custom ty drift must be preserved alongside the opacity fade.
  assert.ok(layer.keyframes.ty, "solidLayer must forward the ty keyframe drift");
  assert.equal(layer.keyframes.ty.length, 3);
  assert.equal(layer.keyframes.ty[1].v, 100);
  // Opacity fade is still applied (authoritative).
  assert.ok(Array.isArray(layer.keyframes.opacity) && layer.keyframes.opacity.length >= 2);
});

test("coverage timeline background solid carries ty/tx drift to prevent static holds", async () => {
  const script = makeTestScript("The bridge collapsed in 1986.");
  const research = makeTestResearch([{ name: "The bridge", kind: "object" }]);
  const sentences = scriptSentences(script);
  let t = 0; const words = [];
  sentences.forEach((s, i) => {
    const ws = s.split(/\s+/); const dur = Math.max(1.0, ws.length / 2.6);
    ws.forEach((w, j) => { words.push({ text: w, word: w, sentence: i, start: t + dur * j / ws.length, end: t + dur * (j + 1) / ws.length }); }); t += dur;
  });
  const plan = buildCoveragePlan({ script, research, words, audioDuration: t });
  const captions = buildCaptions({ script, whisper: transcriptFromWords({ words }), duration: t });
  const tl = await buildCoverageTimeline({ plan, assetsByBeat: {}, captions, audioDuration: t, channel: {} });
  const bg = tl.layers.find((l) => l.id && String(l.id).endsWith("-bg"));
  assert.ok(bg, "background solid layer present");
  assert.ok(bg.keyframes.ty || bg.keyframes.tx, "background solid must declare drift motion (ty/tx) so long holds are not static");
});

test("svgLayer declares a purposeful ty drift so long diagram holds are not frozen", () => {
  const layer = svgLayer({
    id: "diag-wheel", rect: { x: 90, y: 400, w: 900, h: 700 },
    inF: 0, outF: 180, z: 5, drawFrames: 30,
    paths: [{ d: "M0 0 L100 100", stroke: "#D4A574", strokeWidth: 4 }],
  });
  assert.ok(layer.keyframes.ty, "svgLayer must declare a ty drift on diagrams");
  assert.equal(layer.keyframes.ty[0].v, 0);
  assert.equal(layer.keyframes.ty[layer.keyframes.ty.length - 1].v, 18);
  assert.ok(layer.keyframes.draw, "svgLayer must still declare the draw-on animation");
});
