// A planner label at a TOP position stands in the top header slot, whatever composition the text grid remapped the beat to.
// Board 38047691386 ch 49 beat 6: HERO-OVER carried its kicker down to y 1130, onto the statement (canvas-fit overlap).
import { test } from "node:test";
import assert from "node:assert/strict";
import { canvasLayout, normalizeCanvas, layoutViolations, ZONES } from "../../src/skills/remotion-render/visual/canvas-layout.js";

const hero = { name: "Prime Video", class: "cutout", asset: "cutouts-live/49/0-prime-video-logo.png", w: 1024, h: 300, logo: true };
const photo = { asset: "a.jpg", entity: "X", kind: "place", view: "place", w: 1600, h: 1000 };
const base = {
  "TYPE-FULL": { visual_type: "TYPE", composition: "TYPE-FULL", headline: "Psychic powers and feminine rage" },
  "HERO-OVER": { visual_type: "TYPE", composition: "TYPE-FULL", headline: "Psychic powers and feminine rage drive the season", concept_visuals: [hero] },
  "PHOTO-CARD": { visual_type: "PHOTO", composition: "PHOTO-CARD", headline: "Psychic powers", photo },
};

for (const [name, c] of Object.entries(base)) {
  for (const position of ["top-left", "top-right", "beside-headline"]) {
    test(`${name} with a ${position} label: the kicker is in the top zone and nothing overlaps`, () => {
      const L = canvasLayout(normalizeCanvas({ ...c, label: { text: "Prime Video", position }, motion_tier: "medium" }, 6));
      assert.ok(L.boxes.kicker, "the label is drawn");
      assert.ok(L.boxes.kicker.y + L.boxes.kicker.h <= ZONES.top[1], `kicker at y ${L.boxes.kicker.y}`);
      assert.deepEqual(layoutViolations(L).filter((v) => /overlap/.test(v.rule)), []);
    });
  }
}

test("an explicit bottom-left label stays at the bottom", () => {
  const L = canvasLayout(normalizeCanvas({ ...base["HERO-OVER"], label: { text: "Prime Video", position: "bottom-left" }, motion_tier: "medium" }, 6));
  assert.equal(L.boxes.kicker.y, 1368);
});
