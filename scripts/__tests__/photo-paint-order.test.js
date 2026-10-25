// A full-bleed photo that pops on its spoken name must stay the BOTTOM paint layer (pop-groups.js).
// Board 38044082797 ch 1 beat 7: the photo group was returned last, PopGroups painted it over the headline, and the words vanished.
import { test } from "node:test";
import assert from "node:assert/strict";
import { popGroups } from "../../src/skills/remotion-render/visual/pop-groups.js";
import { canvasLayout, normalizeCanvas } from "../../src/skills/remotion-render/visual/canvas-layout.js";

const beat = (composition, entity_pop) => normalizeCanvas({ visual_type: "PHOTO", composition, headline: "The city held its vote", photo: { asset: "x.jpg", entity: "Miami", kind: "place", view: "scene", w: 1600, h: 1000 }, ...(entity_pop ? { entity_pop } : {}) }, 0);

for (const comp of ["SCENE-LOW", "SCENE-FULL"]) {
  test(`${comp} with an entity pop: the photo is painted FIRST, and still arrives on its word`, () => {
    const c = beat(comp, { frame: 45, kind: "photo" });
    const g = popGroups(c, canvasLayout(c));
    assert.equal(g[0].key, "photo", "bottom layer");
    assert.equal(g[0].at, 44, "arrives on its word");
    assert.ok(g.slice(1).every((x) => x.key !== "photo"));
    assert.ok(g.slice(1).some((x) => x.at === 0), "the header is up from frame 0");
  });

  test(`${comp} without an entity pop: unchanged, the photo first`, () => {
    const c = beat(comp, null);
    assert.equal(popGroups(c, canvasLayout(c))[0].key, "photo");
  });
}
