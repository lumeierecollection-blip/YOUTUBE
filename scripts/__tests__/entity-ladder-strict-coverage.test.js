// Run 39705589195, job "render (2)", ch-2 openai-dots-vs-meta-muse-ai-agent-test (strict_visual channel).
//   beat 0 BAR "OpenAI" + "AI Agents Library", beat 2 COMPARE "OpenAI" + "Meta", beat 3 COUNTER "Gemini".
// Log order: the ladder refused OpenAI's 3.7:1 wordmark ("name in type"), so every plates row was type only; strict-visual
// (canvasHasRealVisual: asset-less plates are TEXT) then wiped the row for the chart the sentence grounds; entity-coverage
// read the real canvas and reported "draws chart, none of it the entity". The audit was reading the real drawn canvas.
// Fix: a wide wordmark that still draws tall enough is kept (width-bound), and a strict channel may repeat a mark on a beat
// that has no other verified picture, so the row carries a real asset and strict-visual leaves it alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEntityCoverage } from "../entity-coverage.js";
import { canvasHasRealVisual, strictVisualAudit } from "../strict-visual.mjs";
import { wordmarkFitsRow, markHeightInRow, MIN_MARK_H, markRepeatAllowed } from "../entity-ladder.js";

const org = (name) => ({ type: "organization", name });
const S0 = "OpenAI and AI Agents Library scored the agent test overall across six tasks.";
const S2 = "OpenAI scored better than Meta on the same test.";
const S3 = "Gemini scored well in the same test.";

// Before the fix: the manifest canvases of beats 0, 2, 3 (chart / stat card only).
const chart0 = { composition: "DATA-FULL", visual_type: "BAR", data: { bars: [{ label: "score overall across six", value: "9.08" }] } };
const chart2 = { composition: "COMPARISON-SPLIT", visual_type: "COMPARE", data: { a: { value: "9.08", label: "score" }, b: { value: "7.75", label: "score" } } };
const num3 = { composition: "NUMBER-FULL", visual_type: "COUNTER", data: { value: "8.5", label: "score in the same" } };

// After the fix: the plates row the ladder keeps (OpenAI's wordmark as an asset, the unmarked name in type).
const row0 = { composition: "ENTITY-ART", art: { kind: "plates", name: "OpenAI, AI Agents Library", names: ["OpenAI", "AI Agents Library"], kinds: ["plate-organization", "plate-organization"], items: [{ name: "OpenAI", asset: "logos/openai.svg" }, null] } };
const row2 = { composition: "ENTITY-ART", art: { kind: "plates", name: "OpenAI, Meta", names: ["OpenAI", "Meta"], kinds: ["plate-organization", "plate-organization"], items: [{ name: "OpenAI", asset: "logos/openai.svg" }, null] } };
// An organisation with no verified mark: the row is its name in type.
const typedRow3 = { composition: "ENTITY-ART", art: { kind: "plates", name: "Gemini", names: ["Gemini"], kinds: ["plate-organization"], items: [null] } };

const run = (canvases) => checkEntityCoverage([
  { index: 0, sentence: S0, named_entities: [org("OpenAI"), org("AI Agents Library")], canvas: canvases[0] },
  { index: 2, sentence: S2, named_entities: [org("OpenAI"), org("Meta")], canvas: canvases[1] },
  { index: 3, sentence: S3, named_entities: [org("Gemini")], canvas: canvases[2] },
]);

test("before the fix: chart-only beats naming an organisation fail coverage (the run's failure)", () => {
  const r = run([chart0, chart2, num3]);
  assert.deepEqual(r.failures.map((f) => f.beat), [0, 1, 2]);
  assert.match(r.failures[0].why, /none of it the entity/);
});

test("after the fix: a row carrying OpenAI's real mark covers beats 0 and 2", () => {
  const r = run([row0, row2, typedRow3]);
  assert.equal(r.rows[0].covered, true);
  assert.match(r.rows[0].by, /logo "OpenAI"/);
  assert.equal(r.rows[1].covered, true);
});

test("an organisation with no verified mark is not an asset: strict-visual still treats its name row as text", () => {
  assert.equal(canvasHasRealVisual(row0), true);
  assert.equal(canvasHasRealVisual(row2), true);
  assert.equal(canvasHasRealVisual(typedRow3), false);
  const a = strictVisualAudit([{ index: 3, narration: S3, named_entities: [org("Gemini")], canvas: typedRow3 }]);
  assert.equal(a.upgrades.length, 1, "a beat whose only entity has no mark is still upgraded to its figure; the audit then fails it, correctly (upstream: no verified mark exists)");
});

test("a beat with no mark for any organisation it names stays uncovered by a chart", () => {
  const r = run([chart0, chart2, num3]);
  assert.equal(r.rows[2].covered, false);
});

test("words-only beats that name an entity still fail", () => {
  const r = checkEntityCoverage([{ index: 0, sentence: S3, named_entities: [org("Gemini")], canvas: { composition: "TYPE-FULL", visual_type: "TYPE", data: null } }]);
  assert.equal(r.failures.length, 1);
  assert.match(r.failures[0].why, /words only/);
});

test("a wide wordmark is kept only when it still draws tall enough (width-bound)", () => {
  assert.ok(MIN_MARK_H >= 80);
  assert.equal(wordmarkFitsRow(3.7, 2), true, "OpenAI 3.7:1 in a two-plate row");
  assert.equal(wordmarkFitsRow(8, 1), false, "the 8:1 Google DeepMind case (board 39332364472) stays a name in type");
  assert.equal(wordmarkFitsRow(8, 2), false);
  assert.ok(markHeightInRow(3.7, 2) >= MIN_MARK_H);
  assert.ok(markHeightInRow(8, 1) < MIN_MARK_H);
});

test("ROW_BOX mirrors canvas-layout PLATES_SIZES", async () => {
  const { PLATES_SIZES } = await import("../../src/skills/remotion-render/visual/canvas-layout.js");
  assert.deepEqual(PLATES_SIZES, { 1: [440, 440], 2: [800, 500], 3: [960, 440], 4: [960, 350] });
});

test("a repeated mark is allowed only on a strict channel, on a beat with no picture of its own", () => {
  assert.equal(markRepeatAllowed(true, chart0), true);
  assert.equal(markRepeatAllowed(false, chart0), false, "other channels keep the no-repeat rule");
  assert.equal(markRepeatAllowed(true, { composition: "PHOTO-BAND", photo: { entity: "Meta HQ", kind: "place" } }), false);
});
