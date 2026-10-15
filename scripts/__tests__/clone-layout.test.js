// clone-layout: the clone family's OWN legality (CLONE-1..4). The canvas engine's zone gates do not judge this family; these do.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { treatmentBoxes, layoutProblems, TREATMENTS, FRAME, parseDate } from "../../src/skills/remotion-render/clone/clone-layout.js";
import { paletteFor } from "../../src/skills/remotion-render/clone/clone-palette.js";
const G = JSON.parse(readFileSync(new URL("../../config/clone-grammar.json", import.meta.url), "utf8"));

for (const t of TREATMENTS) {
  test(`treatment ${t}: legal at both tilts`, () => { assert.deepEqual(layoutProblems(t, 0), []); assert.deepEqual(layoutProblems(t, 1), []); });
}

test("every treatment a profile uses is a treatment that exists", () => {
  for (const [name, p] of Object.entries(G.profiles)) for (const t of p.treatments) assert.ok(TREATMENTS.includes(t), `${name}: unknown treatment ${t}`);
});

test("type over a full-bleed picture always sits on a solid plate", () => {
  const b = treatmentBoxes("bleed");
  assert.equal(b.text.plated, true);
  assert.equal(b.hero.w, FRAME.w);
});

test("no treatment puts display type on a picture except the plated bleed", () => {
  for (const t of TREATMENTS.filter((x) => x !== "bleed")) {
    const b = treatmentBoxes(t, 0);
    const overlap = b.hero.x < b.text.x + b.text.w && b.text.x < b.hero.x + b.hero.w && b.hero.y < b.text.y + b.text.h && b.text.y < b.hero.y + b.hero.h;
    assert.equal(overlap, false, t);
  }
});

test("a profile's profile fields are complete", () => {
  for (const [name, p] of Object.entries(G.profiles)) {
    for (const k of ["from", "shot_s", "display_words", "ground", "treatments", "accent_shapes", "type"]) assert.ok(p[k] !== undefined, `${name}.${k}`);
    assert.ok(p.type.display.family && p.type.label.family, name);
    assert.ok(p.display_words <= 3, `${name}: display words ${p.display_words} > 3`);
  }
});

test("colour comes from the channel: accent from colors.canvas_accent, ground overridable, nothing from the plan", () => {
  const p = G.profiles["dossier-mono"];
  assert.equal(paletteFor(p, { colors: { canvas_accent: "#112233" } }).accent, "#112233");
  assert.equal(paletteFor(p, { colors: { canvas_accent: "#112233" }, clone: { ground: "#EEEEEE" } }).ground, "#EEEEEE");
  assert.notEqual(paletteFor(G.profiles["archive-italic"], {}).ground, paletteFor(p, {}).ground, "paper and mist are different grounds");
});

test("the laws are the ones the references measured, and the grammar names its sources", () => {
  assert.ok(G.laws.events_per_10s_min >= 10 && G.laws.gap_p90_max_s <= 3 && G.laws.gap_max_s <= 6);
  assert.ok(G.laws.from.length >= 5);
  for (const f of G.laws.from) assert.ok(G.measured[f], f);
  assert.ok(G.grammar.rules.length >= 6);
});

test("the calendar plate reads exactly the date the sentence states", () => {
  assert.deepEqual(parseDate("October 1, 2026"), { month: "OCTOBER", day: "1", year: "2026" });
  assert.deepEqual(parseDate("October 2026"), { month: "OCTOBER", day: null, year: "2026" });
  assert.deepEqual(parseDate("2026"), { month: null, day: null, year: "2026" });
  assert.deepEqual(parseDate("Sep 24"), { month: "SEPTEMBER", day: "24", year: null });
  assert.deepEqual(parseDate("April 16, 2026"), { month: "APRIL", day: "16", year: "2026" });
  assert.equal(parseDate("the marketplace").month, null, "'mar' inside a word is not March");
});
