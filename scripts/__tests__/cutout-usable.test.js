// A cut-out is LOOKED AT before it is used (owner, 2026-10-18: "make sure that the photo is properly usable to cut out. If not, then as it is"): a BROKEN
// verdict, or no verdict, shows the photo as it is (vignette), never the broken cut-out; one check per file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { attachCutoutsChecked } from "../../src/skills/remotion-render/clone/clone-cutouts.js";

const beats = () => [
  { scene: { canvas: { photo: { asset: "entities/a.jpg", entity: "Ada Lovelace", kind: "person", cutout: "cutouts-live/0/photo-a-g.png", cutout_grounded: true } } } },
  { scene: { canvas: { photo: { asset: "entities/b.jpg", entity: "Old Bank", cutout: "cutouts-live/0/photo-b.png" } } } },
  { scene: { canvas: { photo: { asset: "entities/b.jpg", entity: "Old Bank", cutout: "cutouts-live/0/photo-b.png" } } } },
];

test("a usable cut-out is kept; a broken one, or an unanswered check, falls back to the photo as it is", async () => {
  const bs = beats(), asked = [];
  const check = async (rel) => { asked.push(rel); return rel.includes("photo-a") ? { ok: true, why: "whole head" } : { ok: false, why: "a slice of the roof is cut away" }; };
  await attachCutoutsChecked(bs, 0, () => {}, check);
  assert.equal(bs[0].scene.canvas.photo.cutout, "cutouts-live/0/photo-a-g.png");
  for (const b of [bs[1], bs[2]]) {
    assert.equal(b.scene.canvas.photo.cutout, undefined);
    assert.equal(b.scene.canvas.photo.vignette, true);
  }
  assert.deepEqual(asked, ["cutouts-live/0/photo-a-g.png", "cutouts-live/0/photo-b.png"], "the same file was checked twice");
  const none = beats();
  await attachCutoutsChecked(none, 0, () => {}, async () => ({ ok: false, why: "no vision provider answered" }));
  assert.equal(none[0].scene.canvas.photo.vignette, true);
});
