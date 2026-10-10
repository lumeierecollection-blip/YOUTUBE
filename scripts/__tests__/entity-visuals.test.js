import test from "node:test";
import assert from "node:assert/strict";
import { entityVisuals, summarise } from "../lib/entity-visuals.mjs";

const plan = { beats: [
  { named_entities: [{ name: "Acme Corp", type: "company" }, { name: "42", type: "number" }], canvas: { art: { kind: "marks", items: [{ name: "Acme Corp", asset: "a.png", source_url: "https://commons/a" }] } } },
  { named_entities: [{ name: "Ada Lovelace", type: "person" }], canvas: { photo: { asset: "p.jpg", source_url: "https://commons/p", entity: "Ada Lovelace" } } },
  { named_entities: [{ name: "Brazil", type: "place" }], canvas: { art: { kind: "flag", name: "Brazil", asset: "f.png", source_url: "https://f" } } },
  { named_entities: [{ name: "Globex", type: "company" }], canvas: { art: { kind: "plate-place", name: "Globex" } } },
  { named_entities: [{ name: "Peru", type: "place" }], visual_type: "MAP", data: { place: "Peru" }, canvas: {} },
  { named_entities: [{ name: "Initech", type: "company" }], hero_cutout: { name: "Initech", logo: true, asset: "i.png", source_url: "https://commons/i" }, canvas: {} },
] };

test("each named entity is classed by what it actually got to show", () => {
  const rows = entityVisuals(plan);
  assert.deepEqual(rows.map((r) => [r.name, r.visual]), [["Acme Corp", "logo"], ["Ada Lovelace", "portrait"], ["Brazil", "flag"], ["Globex", "typed"], ["Peru", "map"], ["Initech", "logo"]]);
  assert.deepEqual(summarise(rows), { named: 6, real: 5, typed: 1, fraction: 0.83, by: { logo: 2, portrait: 1, flag: 1, typed: 1, map: 1 } });
});

test("numbers are not entities that can be shown; an image of a different entity does not count", () => {
  const rows = entityVisuals({ beats: [{ named_entities: [{ name: "2019", type: "number" }, { name: "Grace Hopper", type: "person" }], canvas: { photo: { asset: "x.jpg", source_url: "https://x", entity: "Someone Else" } } }] });
  assert.deepEqual(rows.map((r) => [r.name, r.visual]), [["Grace Hopper", "typed"]]);
});
