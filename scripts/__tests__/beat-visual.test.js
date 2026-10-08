/**
 * The one visual a beat gets (scripts/beat-visual.js), chosen from what asset resolution found.
 *
 * CI run 37766249863 beat 5: "Alexandria" in "pleaded guilty in Alexandria federal court" resolved to
 * "Alexandria (City in Egypt)" and its skyline verified MATCH — the first verified photo was used.
 * Now every candidate goes to the resolver with its caption, and the answer is validated in code.
 *
 * MUTATIONS (run, recorded in the commit): letting a face pass as "non_identifying", or an unlisted
 * asset pass as "found", each turns a test red; restoring render-and-qa's take-the-first-photo loop
 * turns the wiring test red. Restored byte-identical.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateChoice, chooseBeatVisual, buildBeatVisualPrompt, BEAT_VISUAL_PROMPT, SYMBOLS } from "../beat-visual.js";

const alexandria = { id: "entities/places/alexandria.jpg", entity: "Alexandria", entity_type: "place", kind: "place", caption: "Alexandria (City in Egypt)", seen_in_image: "aerial view of alexandria coastline egypt", source: "wikipedia summary" };
const portrait = { id: "entities/people/david-rush.jpg", entity: "David Rush", entity_type: "person", kind: "person", caption: "David Rush (American musician)", seen_in_image: "portrait", source: "wikipedia" };
const courthouse = { id: "entities/buildings/albert-v-bryan-courthouse.jpg", entity: "Albert V. Bryan Courthouse", entity_type: "building", kind: "building", caption: "Albert V. Bryan United States Courthouse (courthouse in Alexandria, Virginia)", seen_in_image: "federal courthouse exterior", source: "wikimedia commons" };
const line = "Rush pleaded guilty in Alexandria federal court to stealing gold bars.";

describe("the prompt", () => {
  it("is the owner's text, verbatim, and carries the line and every candidate's caption", () => {
    assert.match(BEAT_VISUAL_PROMPT, /^You are resolving the visual for one beat of a short-form video\./);
    assert.match(BEAT_VISUAL_PROMPT, /Never a wrong fact\. A photo of the wrong place/);
    const p = buildBeatVisualPrompt({ line, entities: [{ type: "place", name: "Alexandria" }], assets: [alexandria], styleSpec: { palette: ["#2B2B2B"] }, slot: null });
    assert.ok(p.includes(line));
    assert.ok(p.includes("Alexandria (City in Egypt)"), "the model sees the identity the photo was verified as");
    assert.ok(p.includes("type_card") && p.includes("symbol:warning-triangle"), "the drawable placeholders are listed");
  });
});

describe("validateChoice", () => {
  it("found: a listed asset is used", () => {
    const v = validateChoice({ visual: courthouse.id, source: "found", reason: "the courthouse in Alexandria, Virginia, where the plea happened", skipped: [{ asset: alexandria.id, why: "wrong place: Egypt, not Virginia" }] }, { assets: [alexandria, courthouse] });
    assert.equal(v.valid, true);
    assert.equal(v.asset.id, courthouse.id);
    assert.deepEqual(v.skipped, [{ asset: alexandria.id, why: "wrong place: Egypt, not Virginia" }]);
  });
  it("found: an asset that is not listed is refused — the beat falls to the type card", () => {
    const v = validateChoice({ visual: "entities/places/alexandria-virginia.jpg", source: "found", reason: "x" }, { assets: [alexandria] });
    assert.equal(v.valid, false);
    assert.equal(v.visual, "type_card");
    assert.equal(v.asset, null);
  });
  it("Alexandria replay: the wrong place skipped -> an honest placeholder, the reason and what was missing recorded", () => {
    const v = validateChoice({ visual: "type_card", source: "placeholder", reason: "the only photo is Alexandria, Egypt; the line is a federal court in Virginia", skipped: [{ asset: alexandria.id, why: "wrong place" }], missing: "a photo of Alexandria, Virginia or its federal courthouse" }, { assets: [alexandria] });
    assert.equal(v.valid, true);
    assert.equal(v.asset, null);
    assert.deepEqual(v.skipped, [{ asset: alexandria.id, why: "wrong place" }]);
    assert.match(v.missing, /Alexandria, Virginia/);
  });
  it("non_identifying: a face is never the treatment", () => {
    const v = validateChoice({ visual: portrait.id, source: "non_identifying", reason: "x" }, { assets: [portrait] });
    assert.equal(v.valid, false);
    assert.match(v.why, /is a face/);
  });
  it("non_identifying: the subject's building, or a bundled silhouette / document", () => {
    assert.equal(validateChoice({ visual: courthouse.id, source: "non_identifying", reason: "where he was tried" }, { assets: [courthouse, portrait] }).valid, true);
    assert.equal(validateChoice({ visual: "silhouette", source: "non_identifying", reason: "no photo of him", missing: "a verified photo of Rush" }, { assets: [portrait] }).valid, true);
  });
  it("placeholder: only kinds the renderer can draw; a map only when one is available", () => {
    assert.equal(validateChoice({ visual: `symbol:${SYMBOLS[0]}`, source: "placeholder", reason: "x" }, { assets: [] }).valid, true);
    assert.equal(validateChoice({ visual: "symbol:gavel", source: "placeholder", reason: "x" }, { assets: [] }).valid, false);
    assert.equal(validateChoice({ visual: "map", source: "placeholder", reason: "x" }, { assets: [], mapAvailable: false }).valid, false);
    assert.equal(validateChoice({ visual: "map", source: "placeholder", reason: "x" }, { assets: [], mapAvailable: true }).valid, true);
    assert.equal(validateChoice({ visual: "grey box", source: "placeholder", reason: "x" }, { assets: [] }).valid, false);
  });
  it("a skipped asset without a reason is still recorded; option 2/3 without 'missing' is marked", () => {
    const v = validateChoice({ visual: "type_card", source: "placeholder", reason: "unsure of the place" }, { assets: [alexandria] });
    assert.deepEqual(v.skipped, [{ asset: alexandria.id, why: "not chosen (no reason given)" }]);
    assert.equal(v.missing, "not stated");
  });
  it("no answer is UNSURE: no found asset is used", async () => {
    const v = await chooseBeatVisual({ line, entities: [], assets: [alexandria], ask: async () => ({ error: "no provider answered" }) });
    assert.equal(v.valid, false);
    assert.equal(v.asset, null);
    assert.equal(v.visual, "type_card");
    assert.match(v.skipped[0].why, /unsure/);
  });
});

describe("render-and-qa wiring", () => {
  const src = readFileSync("scripts/render-and-qa.js", "utf8");
  it("collects every verified candidate and asks the resolver; does not take the first photo a verifier passed", () => {
    assert.match(src, /if \(r\.ok && \(r\.logo \|\| r\.photo\)\) \{ found\.push\(/);
    assert.match(src, /const choice = await chooseBeatVisual\(\{/);
    assert.doesNotMatch(src, /photo = \{ \.\.\.r\.photo, entity: e0\.name \};/, "the first-ok photo assignment must be gone");
  });
  it("logs every choice with its reason and skipped assets", () => {
    assert.match(src, /\[visual-choice\] ch-\$\{channelId\} beat \$\{b\.index\}/);
  });
});
