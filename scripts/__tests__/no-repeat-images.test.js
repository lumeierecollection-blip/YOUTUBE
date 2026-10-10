// NO IMAGE TWICE IN ONE VIDEO (owner, 2026-10-08 / 2026-10-09). Every path that attaches a visual
// fills and filters ONE usedImages (scripts/lib/used-images.js), keyed by asset AND source.
// The case that got through: fetch-cutout-once.cjs writes each live cutout to
// cutouts-live/<channel>/<beat>-<concept>.png, so the same Pixabay picture offered to three beats
// under three concept slugs is three different paths — and the old concept-cutout filter
// (a separate set, keyed by path) attached it to all three.
import { test } from "node:test";
import assert from "node:assert/strict";
import { attachConceptVisuals, canvasContentFor } from "../render-and-qa.js";
import { canvasManifest } from "../../src/skills/remotion-render/visual/canvas-layout.js";
import { createUsedImages, imageKeys } from "../lib/used-images.js";

const GOLD = "https://pixabay.com/photos/gold-tiger-statue-figure-1234567/";
const beat = (index, narration) => {
  const b = { index, narration, visual_type: "TYPE", headline: narration.split(" ").slice(0, 4).join(" ") };
  b.canvas = canvasContentFor(b);
  b.canvas.composition = "TYPE-FULL";
  return b;
};
const cutout = (bi, slug) => ({ name: slug, class: "cutout", asset: `cutouts-live/26/${bi}-${slug}.png`, w: 800, h: 800, source: "live", source_url: GOLD, verdict: "LITERAL", seen: "a gold tiger statue" });
const stats = () => ({ bank: 0, live: 0, symbol: 0, none: 0 });

// Resolve the plan the way resolveCanvas step 3 does, then read back what the renderer would draw.
function resolvePlan(beats, results, used = createUsedImages()) {
  const wanted = beats.map((b, bi) => ({ bi, b, names: [...results.keys()].filter((k) => k.startsWith(`${bi}:`)).map((k) => k.slice(String(bi).length + 1)), from: "sentence" }));
  attachConceptVisuals({ wanted, results, used, stats: stats(), channelId: 26 });
  return beats.map((b, i) => canvasManifest(b.canvas, i).concept_visuals.map((v) => v.asset));
}

test("the same cutout offered to three beats (three beat-numbered paths, one picture): only the first beat draws it", () => {
  const beats = [beat(0, "The gold tiger was the founder's symbol"), beat(1, "Investors bought gold bars"), beat(2, "The gold tiger turned out hollow")];
  const results = new Map([["0:gold-tiger", cutout(0, "gold-tiger")], ["1:gold-bars", cutout(1, "gold-bars")], ["2:gold-tiger-statue", cutout(2, "gold-tiger-statue")]]);
  const drawn = resolvePlan(beats, results);
  assert.deepEqual(drawn[0], ["cutouts-live/26/0-gold-tiger.png"]);
  assert.deepEqual(drawn[1], [], "beat 2 must not receive the picture beat 1 shows");
  assert.deepEqual(drawn[2], [], "beat 3 must not receive the picture beat 1 shows");
});

test("the same cutout at the SAME path (run-cache hit) on three beats: only the first", () => {
  const beats = [beat(0, "Gold tiger one"), beat(1, "Gold tiger two"), beat(2, "Gold tiger three")];
  const same = { ...cutout(0, "gold-tiger") };
  const drawn = resolvePlan(beats, new Map([["0:gold-tiger", same], ["1:gold-tiger", same], ["2:gold-tiger", same]]));
  assert.deepEqual(drawn.map((d) => d.length), [1, 0, 0]);
});

test("an image an EARLIER path attached (money cutout / logo / photo) is not given to a concept beat", () => {
  const used = createUsedImages();
  used.add({ asset: "cutouts-live/26/0-gold-bar.png", source_url: GOLD });   // resolveCanvas main loop: a money hero cutout on beat 0
  const beats = [beat(1, "Gold bars in the vault"), beat(2, "A gold tiger")];
  const drawn = resolvePlan(beats, new Map([["0:gold-bars", cutout(1, "gold-bars")], ["1:gold-tiger", cutout(2, "gold-tiger")]]), used);
  assert.deepEqual(drawn, [[], []]);
});

test("different pictures still all render; drawn symbols are not images and always pass", () => {
  const beats = [beat(0, "Gold"), beat(1, "Risk"), beat(2, "Silver"), beat(3, "Risk again")];
  const silver = { ...cutout(2, "silver-bar"), source_url: "https://pixabay.com/photos/silver-bar-999/" };
  const sym = { name: "warning-triangle", class: "symbol", w: 1, h: 1 };
  const drawn = resolvePlan(beats, new Map([["0:gold-tiger", cutout(0, "gold-tiger")], ["1:warning-triangle", sym], ["2:silver-bar", silver], ["3:warning-triangle", sym]]));
  assert.deepEqual(drawn.map((d) => d.length), [1, 1, 1, 1]);
});

test("identity: asset + a specific source; a bare domain is not an identity", () => {
  assert.deepEqual(imageKeys({ asset: "a.png", source_url: GOLD }), ["a.png", GOLD]);
  assert.deepEqual(imageKeys({ asset: "a.png", source_url: "https://en.wikipedia.org" }), ["a.png"]);
  const used = createUsedImages();
  used.add({ asset: "cutouts-live/1/0-banknotes-cash.png", source_url: "https://en.wikipedia.org" });
  assert.equal(used.reused({ asset: "cutouts-live/1/4-coin.png", source_url: "https://en.wikipedia.org" }), false);
  // entity photo / logo / document: same file page, different local path -> a repeat
  used.add({ asset: "cutouts-live/49/1-blumhouse-logo.png", source_url: "https://commons.wikimedia.org/wiki/File:Blumhouse_Productions_logo.svg" });
  assert.equal(used.reused({ asset: "cutouts-live/49/7-blumhouse-productions-logo.png", source_url: "https://commons.wikimedia.org/wiki/File:Blumhouse_Productions_logo.svg" }), true);
});

// A logo is the entity's own mark: naming the entity again shows it again (it used to become a typed name).
test("a logo may be shown on more than one beat; a photo still may not", async () => {
  const { createUsedImages } = await import("../lib/used-images.js");
  const u = createUsedImages();
  const logo = { asset: "cutouts-live/10/4-mit-logo.png", source_url: "https://commons.wikimedia.org/wiki/File:MIT_2023_red_logo.svg", logo: true };
  assert.equal(u.reused(logo, "beat 4"), false);
  u.add(logo);
  assert.equal(u.reused({ ...logo, asset: "cutouts-live/10/8-mit-logo.png" }, "beat 8"), false, "same source, another beat: allowed");
  const photo = { asset: "entities/buildings/x.jpg", source_url: "https://commons.wikimedia.org/wiki/File:X.jpg" };
  u.add(photo);
  assert.equal(u.reused(photo, "beat 9"), true, "a photo is still never repeated");
  assert.equal(u.reused({ ...photo, logo: false }, "beat 9"), true);
  assert.equal(u.keep([logo, photo]).length, 1, "keep(): the logo passes, the repeated photo does not");
});
