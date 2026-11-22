// A channel's niche rules are enforced on discovery candidates before reservation (run 41030159423: the celebrity channel chose a church
// abuse settlement). The blocklist is deterministic; the model's niche-fit check can only reject, and a model failure keeps the candidate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { blocklistHit, guardTopics, parseFit, fitPrompt } from "../lib/niche-guard.mjs";

const { resolveChannel } = createRequire(import.meta.url)("../lib/channel-lookup.cjs");
const quiet = () => {};

test("the celebrity channel refuses abuse, clergy and death topics and keeps a ruling", async () => {
  const ch = resolveChannel("3");
  const topics = [
    { topic: "Archdiocese of New York Pays $800M Clergy Abuse Settlement", angle: "x" },
    { topic: "Judge Dismisses $400M Lawsuit Between Film Co-Stars", angle: "the court ruled" },
    { topic: "Singer Died After Overdose, Family Sues", angle: "" },
  ];
  const { kept, rejected } = await guardTopics(topics, ch, { log: quiet });
  assert.deepEqual(kept.map((t) => t.topic), ["Judge Dismisses $400M Lawsuit Between Film Co-Stars"]);
  assert.equal(rejected.length, 2);
  assert.match(rejected[0].reject_reason, /niche rules/);
});

test("the sports channel refuses betting talk, the geography channel refuses a live war", () => {
  assert.ok(blocklistHit({ topic: "Best Odds for the Derby", angle: "" }, resolveChannel("4")));
  assert.equal(blocklistHit({ topic: "Why Arsenal and Tottenham Dislike Each Other", angle: "" }, resolveChannel("4")), null);
  assert.ok(blocklistHit({ topic: "The Border After the Invasion", angle: "" }, resolveChannel("9")));
  assert.equal(blocklistHit({ topic: "The Smallest Country Border in Europe", angle: "" }, resolveChannel("9")), null);
});

test("the model's niche-fit verdict can reject; no answer or an error keeps the candidate", async () => {
  const ch = resolveChannel("3");
  const t = [{ topic: "A Charity Gala Raises Money", angle: "" }];
  assert.equal((await guardTopics(t, ch, { ask: async () => ({ fits: false, reason: "not about celebrities" }), log: quiet })).kept.length, 0);
  assert.equal((await guardTopics(t, ch, { ask: async () => ({ fits: true }), log: quiet })).kept.length, 1);
  assert.equal((await guardTopics(t, ch, { ask: async () => { throw new Error("quota"); }, log: quiet })).kept.length, 1);
  assert.equal((await guardTopics(t, ch, { ask: async () => ({ content: "hmm" }), log: quiet })).kept.length, 1);
  assert.equal(parseFit({ content: 'ok {"fits": false, "reason": "x"}' }).fits, false);
  assert.match(fitPrompt(t[0], ch), /Celebrity Feuds[\s\S]*unproven allegation/);
});

test("channels 1, 2 and 48 have no blocklist, so their discovery is unchanged", () => {
  for (const id of ["1", "2", "48"]) assert.equal((resolveChannel(id).niche_blocklist || []).length, 0);
});
