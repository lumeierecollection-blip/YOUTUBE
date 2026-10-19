// A CHART THAT SHOWS NONE OF THE ENTITY YIELDS TO IT, AND A VISUAL THAT ALREADY SHOWS THE ENTITY IS NOT TRADED AWAY.
//
// Board 39324629999 (the first run where every short rendered on the 2D canvas engine — render.js routes
// all shorts through DirectedShorts): all three videos passed 28 of 29 canvas checks and every one failed
// entity-coverage, on beats whose sentence names a person / organisation / place and whose visual was a chart.
//
//   ch-2  beat 3: PIE 77%   — "Tech City Authority", "DeepSeek V4.1 Flash"  -> rejected
//   ch-2  beat 5: GAUGE     — "MiniMax", 73.7%                              -> rejected
//   ch-1  beat 4: BAR 3/26  — "National Museum of American History"         -> rejected
//   ch-48 beat 5: GAUGE     — "Scott Kramer", Google, Forbes, 3.2%          -> rejected
//
// DATA-FULL lays out no slot for a second object (render-and-qa.js COMPOSITION_TAKES_SECOND), so keeping the
// chart makes the gate's failure certain — and the pipeline rejects the video at canvas-checks rather than
// reporting the gap. The ladder now yields the chart to the entity, exactly as it already yields a bare stat
// card; the row carries every figure the sentence states, so no data is lost.
//
// The second defect on the same board: on ch-48 beat 1 the planner drew a MAP of Japan and the ladder REPLACED
// it with a stat card for the number 10, then the gate failed the beat for drawing none of Japan. A visual that
// already answers the primary entity is never replaced to chase a non-primary figure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ladderAll, ladderFor, yieldsTo, gapOf } from "../entity-ladder.js";
import { coverageOf, checkEntityCoverage } from "../entity-coverage.js";

const asDrawn = (d) => ({ composition: "ENTITY-ART", art: { ...d.art, items: d.art.names.map(() => null) } });

test("a PIE naming organisations yields to a plates row that carries them and the figure", () => {
  const b = {
    index: 3,
    narration: "Tech City Authority noted that rival DeepSeek V4.1 Flash beats it with a 77% score.",
    named_entities: [
      { type: "institution", name: "Tech City Authority" },
      { type: "company", name: "DeepSeek V4.1 Flash" },
      { type: "number", name: "77" },
    ],
    canvas: { composition: "DATA-FULL", visual_type: "PIE", data: { percent: 77, label: null }, sentence: "Tech City Authority noted that rival DeepSeek V4.1 Flash beats it with a 77% score." },
  };
  const [d] = ladderAll(b);
  assert.deepEqual(d.art.names, ["Tech City Authority", "DeepSeek V4.1 Flash", "77%"]);
  assert.deepEqual(d.art.kinds, ["plate-organization", "plate-organization", "figure"]);
  assert.equal(d.replaces, true);
  const c = asDrawn(d);
  for (const e of b.named_entities.map((x) => ({ type: ["institution", "company"].includes(x.type) ? "organization" : x.type, name: x.name }))) {
    assert.ok(coverageOf(c, e).covered, `"${e.name}" is drawn but read as uncovered`);
  }
});

test("a GAUGE naming a person and two organisations yields to a row that shows all of them", () => {
  const b = {
    index: 5,
    narration: "Scott Kramer cited Google data in Forbes showing growth exceeding 3.2 percent.",
    named_entities: [
      { type: "person", name: "Scott Kramer" },
      { type: "company", name: "Google" },
      { type: "company", name: "Forbes" },
    ],
    canvas: { composition: "DATA-FULL", visual_type: "GAUGE", data: { percent: 3.2, label: "growth" }, sentence: "Scott Kramer cited Google data in Forbes showing growth exceeding 3.2 percent." },
  };
  const [d] = ladderAll(b);
  assert.deepEqual(d.art.kinds, ["plate-person", "plate-organization", "plate-organization", "figure"]);
  const c = asDrawn(d);
  assert.ok(coverageOf(c, { type: "person", name: "Scott Kramer" }).covered);
  assert.ok(coverageOf(c, { type: "organization", name: "Google" }).covered);
  assert.ok(coverageOf(c, { type: "organization", name: "Forbes" }).covered);
  assert.ok(coverageOf(c, { type: "number", name: "3.2 percent" }).covered);
});

test("a BAR naming the place the sentence is about yields to its plate", () => {
  const b = {
    index: 4,
    narration: "Visitors at the National Museum of American History see three of the twenty-six steamer trunks.",
    named_entities: [{ type: "building", name: "National Museum of American History" }],
    canvas: { composition: "DATA-FULL", visual_type: "BAR", data: { bars: [{ label: "trunks on display", value: "3" }, { label: "total trunks", value: "26" }] }, sentence: "Visitors at the National Museum of American History see three of the twenty-six steamer trunks." },
  };
  const [d] = ladderAll(b);
  assert.equal(d.art.kind, "plate-organization");
  assert.equal(d.art.name, "National Museum of American History");
  assert.equal(d.replaces, true);
});

test("a chart whose primary is a figure is left alone (it is the answer to the sentence)", () => {
  const b = {
    index: 6,
    narration: "The program costs $352 million.",
    named_entities: [{ type: "number", name: "$352 million" }],
    canvas: { composition: "DATA-FULL", visual_type: "BAR", data: { bars: [{ label: "program cost", value: "352" }] }, sentence: "The program costs $352 million." },
  };
  assert.equal(gapOf(b).covered, true, "the chart draws the figure the sentence states");
  assert.equal(yieldsTo(b, gapOf(b)), false, "a chart of the stated figure must not be traded for a plate");
  assert.deepEqual(ladderAll(b), []);
});

test("a map that already shows the place is never replaced to chase a non-primary figure", () => {
  const b = {
    index: 1,
    narration: "In Japan, 1 out of 10 healthy office workers suffer from low back pain.",
    named_entities: [{ type: "place", name: "Japan" }],
    canvas: { composition: "MAP-CENTERED", visual_type: "MAP", data: { place: "Japan" }, sentence: "In Japan, 1 out of 10 healthy office workers suffer from low back pain." },
  };
  const dirs = ladderAll(b);
  assert.ok(dirs.every((d) => d.replaces === false), `the map is the answer to the beat, a directive replaced it: ${JSON.stringify(dirs)}`);
  // The frame is unchanged: the map still answers the primary place, so the gate passes even though the
  // non-primary figure is not on the beat.
  assert.equal(coverageOf(b.canvas, { type: "place", name: "Japan" }).covered, true);
  const r = checkEntityCoverage([{ ...b, canvas: b.canvas }]);
  assert.deepEqual(r.failures, []);
});

test("the replacement row passes the gate end to end", () => {
  const b = {
    index: 3,
    narration: "Tech City Authority noted that rival DeepSeek V4.1 Flash beats it with a 77% score.",
    named_entities: [
      { type: "institution", name: "Tech City Authority" },
      { type: "company", name: "DeepSeek V4.1 Flash" },
      { type: "number", name: "77" },
    ],
    canvas: { composition: "DATA-FULL", visual_type: "PIE", data: { percent: 77, label: null }, sentence: "Tech City Authority noted that rival DeepSeek V4.1 Flash beats it with a 77% score." },
  };
  const [d] = ladderAll(b);
  const r = checkEntityCoverage([{ ...b, canvas: asDrawn(d) }]);
  assert.deepEqual(r.failures, []);
});
