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
