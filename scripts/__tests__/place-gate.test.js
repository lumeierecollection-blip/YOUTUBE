// The pre-ship place gate, run on the two real wrong-place videos that every model gate
// passed (fixtures built from those runs' resolved plans) and on a real approved video.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { placeGate, regionsIn, contradicts } from "../place-gate.js";

const fx = (n) => JSON.parse(readFileSync(new URL(`../fixtures/place-gate/${n}`, import.meta.url)));
const withPlaceCheck = (m, verdict) => ({ ...m, beats: m.beats.map((b) => (b.canvas.photo ? { canvas: { ...b.canvas, photo: { ...b.canvas.photo, place_check: { verdict, why: "model said so" } } } } : b)) });

test("real case: Washington STATE map for 'Moscow and Washington' (run 37810883817 ch-9) FAILS", () => {
  const r = placeGate(fx("washington-state-37810883817.json"));
  assert.equal(r.pass, false);
  assert.deepEqual(r.failures.map((f) => [f.beat, f.rule]), [[7, "M3"]]);
});

test("real case: Alexandria, Egypt photo in a US federal-court story (run 37766249863) FAILS", () => {
  const r = placeGate(fx("alexandria-egypt-37766249863.json"));
  assert.equal(r.pass, false);
  assert.deepEqual(r.failures.map((f) => f.beat), [5, 8]);
});

test("Alexandria still FAILS when the same-place model wrongly answers SAME (P3, deterministic)", () => {
  const r = placeGate(withPlaceCheck(fx("alexandria-egypt-37766249863.json"), "SAME"));
  assert.equal(r.pass, false);
  assert.ok(r.failures.every((f) => f.rule === "P3"), JSON.stringify(r.failures));
});

test("real approved video (run 37810883817 ch-5, Wilkes-Barre / Luzerne County) PASSES when confirmed", () => {
  const r = placeGate(fx("ch5-green-37810883817.json"));
  assert.equal(r.pass, true, JSON.stringify(r.failures));
  assert.equal(r.checked, 3);
});

test("a place photo with no SAME verdict fails closed", () => {
  for (const v of ["DIFFERENT", "UNSURE"]) assert.equal(placeGate(withPlaceCheck(fx("ch5-green-37810883817.json"), v)).pass, false, v);
});

test("map rules: unnamed place, longer place, no sentence", () => {
  const m = (place, sentence) => ({ beats: [{ canvas: { visual_type: "MAP", data: { place }, sentence } }] });
  assert.equal(placeGate(m("Germany", "Germany relied on this corridor.")).pass, true);
  assert.equal(placeGate(m("Germany", "Berlin relied on this corridor.")).failures[0].rule, "M1");
  assert.equal(placeGate(m("Sudan", "Fighting spread across South Sudan.")).failures[0].rule, "M4");
  assert.equal(placeGate(m("Germany", undefined)).failures[0].rule, "M0");
});

test("region contradiction compares states when both name one, else countries", () => {
  assert.equal(contradicts(regionsIn("City in Pennsylvania", { properOnly: false }), regionsIn("Florida real estate")), true);
  assert.equal(contradicts(regionsIn("City in Pennsylvania", { properOnly: false }), regionsIn("the United States")), false);
  assert.equal(contradicts(regionsIn("coastline egypt", { properOnly: false }), regionsIn("Florida real estate")), true);
  assert.equal(contradicts(new Set(), regionsIn("Florida")), false);
});
