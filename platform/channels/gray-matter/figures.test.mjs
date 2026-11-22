// Run with: ANIMA_DIR=<checkout of the pinned Anima commit> node --test platform/channels/gray-matter/figures.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildFigures } from "./figures.mjs";
import { claims, scenePlan, scriptPackage, sentences } from "./sample.mjs";
import { SCENES } from "./scenes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const channel = JSON.parse(readFileSync(join(HERE, "channel.json"), "utf8"));
const anima = process.env.ANIMA_DIR;

test("every sentence cites claims that exist and every claim has a source and excerpt", () => {
  const ids = new Set(claims.map((c) => c.claim_id));
  for (const s of sentences) { assert.ok(s.claim_ids.length, s.sentence_id); for (const id of s.claim_ids) assert.ok(ids.has(id), id); }
  const sources = new Set(scriptPackage.sources.map((s) => s.source_id));
  for (const c of claims) { assert.ok(sources.has(c.source_id), c.claim_id); assert.ok(c.excerpt.length > 20, c.claim_id); assert.ok(channel.status_labels[c.editorial_status], c.editorial_status); }
});

test("every planned scene uses a treatment in the library and one narration sentence", () => {
  assert.equal(scenePlan.length, sentences.length);
  for (const scene of scenePlan) { assert.ok(SCENES[scene.treatment], scene.treatment); assert.ok(sentences.some((s) => s.sentence_id === scene.sentence)); }
});

test("script package and a built scene plan satisfy the contracts", async () => {
  const { validators } = await import("./preview.mjs");
  validators().script({ ...scriptPackage, duration_estimate_s: 28 });
});

test("Anima builds the figures and its bio audit passes", { skip: !anima && "ANIMA_DIR not set" }, async () => {
  const figures = await buildFigures(anima, channel.palette);
  assert.deepEqual(figures.audit, { ok: true, errors: [] });
  assert.equal(figures.synapse.spines.length, 8);
  assert.match(figures.synapse.synapse.terminal, /bio-membrane/);
  assert.ok(figures.neuron.svg.includes("bio-branch"));
  assert.ok(figures.actin.left.includes("bio-helix-strand"));
  // The cleft must exist: the terminal's lowest screen point stays above the spine head's top.
  const terminalBottom = figures.synapse.synapse.release[1];
  const headTop = Math.min(...figures.synapse.synapse.receptors.map((r) => r.at[1]));
  assert.ok(terminalBottom < headTop, `no cleft: terminal ${terminalBottom}, head ${headTop}`);
});
