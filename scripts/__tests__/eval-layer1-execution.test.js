import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  runLayer1, requiredFrames,
  SAFE_INSET, CAPTION_Y0, CAPTION_Y1,
} from "../eval-layer1-execution.js";
import { POP, ENTRANCE } from "../../src/skills/remotion-render/visual/pop-groups.js";

const box = (o = {}) => ({ x: 48, y: 130, w: 600, h: 200, role: null, align: null, rotate: null, size: null, bleed: 0, ...o });

function manifest(beats, extra = {}) {
  return { fps: 30, width: 1080, height: 1920, totalFrames: 600, beats, ...extra };
}
function beat(i, o = {}) {
  return {
    index: i, start_frame: i * 100, duration_frames: 100,
    canvas: { boxes: { headline: box() }, zones: { top: ["headline"] }, entrance_style: "together", ...(o.canvas || {}) },
    text: ["a headline"], ...o,
  };
}
const ids = (r) => r.checks.map((c) => c.id);
const failuresFor = (r, id) => r.failures.filter((f) => f.id === id);

describe("Layer 1 constants", () => {
  it("uses the same constants as local-audit.cjs:325", () => {
    assert.equal(SAFE_INSET, 48);
    assert.equal(CAPTION_Y0, 1450);
    assert.equal(CAPTION_Y1, 1610);
  });
});

describe("requiredFrames", () => {
  it("derives every entrance from the pop-groups constants, not a literal", () => {
    assert.equal(requiredFrames("together"), POP.START + POP.IN);
    assert.equal(requiredFrames("staggered"), ENTRANCE.STAGGERED);
    assert.equal(requiredFrames("visual-first"), ENTRANCE.TEXT_AFTER_VISUAL);
  });
  it("treats an unknown or absent entrance as the shortest one", () => {
    assert.equal(requiredFrames(undefined), POP.START + POP.IN);
    assert.equal(requiredFrames("something-new"), POP.START + POP.IN);
  });
});

describe("Layer 1 on a healthy manifest", () => {
  const r = runLayer1(manifest([beat(0), beat(1), beat(2)]));
  it("passes and reports every check as passing", () => {
    assert.equal(r.pass, true, JSON.stringify(r.failures, null, 2));
    assert.deepEqual(r.failures, []);
  });
  it("emits MOT-22 plus the two L1 checks", () => {
    assert.deepEqual(ids(r), ["MOT-22", "L1-legibility", "L1-motion"]);
  });
});

describe("MOT-22", () => {
  it("catches a frame covered by no beat", () => {
    const r = runLayer1(manifest([beat(0), { ...beat(1), start_frame: 110 }, { ...beat(2), start_frame: 210 }]));
    const f = failuresFor(r, "MOT-22");
    assert.equal(r.pass, false);
    assert.equal(f.length, 1);
    assert.match(f[0].detail, /covered by no beat/);
    assert.equal(f[0].beat, 1, "the gap is attributed to the beat that does not start where the previous ended");
  });
  it("catches an overlap", () => {
    const r = runLayer1(manifest([beat(0), { ...beat(1), start_frame: 90, duration_frames: 130 }, beat(2)]));
    const f = failuresFor(r, "MOT-22");
    assert.equal(r.pass, false);
    assert.match(f[0].detail, /overlapping boundary/);
  });
  // Measured on ch-2: frames 0-2 come back mean 255.0 stddev 0.0 — the global
  // white ground, not an uncovered black frame. MOT-22 as registered covers only
  // frames BETWEEN beats, so a lead-in must not fail.
  it("does not fail a lead-in, because the ground is mounted globally", () => {
    const r = runLayer1(manifest([{ ...beat(0), start_frame: 3 }, { ...beat(1), start_frame: 103 }]));
    assert.deepEqual(failuresFor(r, "MOT-22"), []);
    assert.equal(r.pass, true, JSON.stringify(r.failures));
  });
  it("fails a beat that holds zero frames", () => {
    const r = runLayer1(manifest([beat(0), { ...beat(1), duration_frames: 0 }, { ...beat(2), start_frame: 200 }]));
    assert.match(failuresFor(r, "MOT-22")[0].detail, /holds 0 frame/);
  });
});

describe("L1-legibility", () => {
  it("catches a box leaving the safe area", () => {
    const r = runLayer1(manifest([beat(0, { canvas: { boxes: { headline: box({ x: 4 }) } } })]));
    const f = failuresFor(r, "L1-legibility");
    assert.equal(r.pass, false);
    assert.equal(f[0].element, "headline");
    assert.match(f[0].detail, /leaves the frame's safe area/);
  });
  // local-audit.cjs:339 — photo, map and split bleed to the edge by design.
  it("allows photo, map and split to bleed", () => {
    for (const name of ["photo", "map", "split"]) {
      const r = runLayer1(manifest([beat(0, { canvas: { boxes: { [name]: box({ x: 0, w: 1080 }) } } })]));
      assert.deepEqual(failuresFor(r, "L1-legibility"), [], `${name} must be allowed to bleed`);
    }
  });
  it("allows role shape to bleed", () => {
    const r = runLayer1(manifest([beat(0, { canvas: { boxes: { blob: box({ x: 0, w: 1080, role: "shape" }) } } })]));
    assert.deepEqual(failuresFor(r, "L1-legibility"), []);
  });
  it("catches a box entering the caption band", () => {
    const r = runLayer1(manifest([beat(0, { canvas: { boxes: { headline: box({ y: 1400, h: 300 }) } } })]));
    const f = failuresFor(r, "L1-legibility");
    assert.match(f[0].detail, /enters the caption band 1450-1610/);
    assert.equal(f[0].element, "headline");
  });
  it("catches two text boxes overlapping", () => {
    const r = runLayer1(manifest([beat(0, {
      canvas: { boxes: { headline: box({ role: "headline" }), number: box({ role: "number", x: 100 }) } },
    })]));
    const f = failuresFor(r, "L1-legibility");
    assert.equal(r.pass, false);
    assert.match(f[0].detail, /overlap/);
    assert.match(f[0].element, /headline\+number/, "the failing element names BOTH boxes, so only they re-render");
  });
  // local-audit.cjs:336 uses a 2px tolerance.
  it("does not call touching boxes an overlap", () => {
    const r = runLayer1(manifest([beat(0, {
      canvas: { boxes: { headline: box({ role: "headline", w: 500 }), number: box({ role: "number", x: 546, w: 400 }) } },
    })]));
    assert.deepEqual(failuresFor(r, "L1-legibility"), []);
  });
  it("treats a numbered family as text (label0/label1)", () => {
    const r = runLayer1(manifest([beat(0, {
      canvas: { boxes: { label0: box({ x: 48, w: 500 }), label1: box({ x: 52, w: 500 }) } },
    })]));
    assert.match(failuresFor(r, "L1-legibility")[0].detail, /label0/);
  });
  it("fails a beat with no boxes at all", () => {
    const r = runLayer1(manifest([{ ...beat(0), canvas: { boxes: null } }]));
    assert.match(failuresFor(r, "L1-legibility")[0].detail, /no canvas boxes/);
  });
});

describe("L1-motion", () => {
  it("catches an entrance that cannot land inside its window", () => {
    const short = POP.START + POP.IN - 1;
    const r = runLayer1(manifest([
      { ...beat(0), start_frame: 0, duration_frames: 100, canvas: { boxes: { headline: box() }, entrance_style: "together" } },
      { ...beat(1), start_frame: 100, duration_frames: short, canvas: { boxes: { headline: box() }, entrance_style: "together" } },
    ]));
    const f = failuresFor(r, "L1-motion");
    assert.equal(r.pass, false);
    assert.equal(f[0].beat, 1);
    assert.match(f[0].detail, new RegExp(`needs ${POP.START + POP.IN} frame\\(s\\) to land but the beat holds ${short}`));
  });
  it("catches a staggered entrance in a window too short for it", () => {
    const r = runLayer1(manifest([
      { ...beat(0), start_frame: 0, duration_frames: 100, canvas: { boxes: { headline: box() }, entrance_style: "together" } },
      { ...beat(1), start_frame: 100, duration_frames: 10, canvas: { boxes: { headline: box() }, entrance_style: "staggered" } },
    ]));
    assert.match(failuresFor(r, "L1-motion")[0].detail, /entrance "staggered"/);
  });
});

describe("Layer 1 failure records", () => {
  it("carries the layer on every record, for provenance", () => {
    const r = runLayer1(manifest([beat(0), { ...beat(1), start_frame: 140 }, beat(2)]));
    assert.ok(r.checks.every((c) => c.layer === 1));
    assert.ok(r.failures.every((f) => f.beat !== undefined && "element" in f));
  });
  it("reports a missing manifest rather than passing it", () => {
    for (const bad of [null, {}, { beats: [] }]) {
      const r = runLayer1(bad);
      assert.equal(r.pass, false);
      assert.match(r.checks[0].detail, /no manifest|nothing to check/);
    }
  });
});

describe("Layer 1 against the real approved renders in this repo", () => {
  // Calibration: a gate that fires on a render local-audit already passed is a
  // false positive, and three were found and removed during this work (hero in
  // boxes, zones in boxes, MOT-22 extended to the lead-in).
  const { globSync } = { globSync: null };
  const files = [
    "data/audit/a1-ci/c2/data/renders/2/california-no-robo-bosses-act-ai-discipline-shorts-shorts-2026-10-06-manifest.json",
    "data/audit/a1-ci/r2/data/renders/2/avalonbay-40m-rent-overcharge-lawsuit-2026-shorts-shorts-2026-10-05-manifest.json",
  ];
  for (const f of files) {
    it(`agrees with the stored local-audit PASS on ${f.split("/").pop().slice(0, 44)}`, () => {
      let m;
      try { m = JSON.parse(readFileSync(f, "utf8")); } catch { return; }
      const r = runLayer1(m);
      assert.equal(r.pass, true, JSON.stringify(r.failures, null, 2));
    });
  }
});