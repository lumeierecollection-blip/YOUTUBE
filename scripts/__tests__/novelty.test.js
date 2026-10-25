// novelty: a slide is not news, a new element is. (scripts/lib/novelty.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { noveltySeries, eventsOf, cadenceOf, NOVELTY } from "../lib/novelty.mjs";

const W = 60, H = 100;
const blank = () => new Uint8Array(W * H).fill(255);
const rect = (g, x0, y0, x1, y1, v = 0) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * W + x] = v; return g; };
const series = (frames) => noveltySeries(frames, W, H);

test("a still frame has no events", () => {
  const f = rect(blank(), 10, 10, 30, 30);
  assert.equal(eventsOf(series([f, f, f, f, f])).length, 0);
});

test("a slide of a few pixels (the renderer's sway, a camera pan) is NOT novelty", () => {
  const fr = [];
  for (let s = 0; s < 6; s++) fr.push(rect(blank(), 10 + s, 20, 30 + s, 40)); // 1 analysis px per frame = 9 canvas px: well inside TOL
  assert.equal(eventsOf(series(fr)).length, 0);
});

// a busy frame (a grid of blocks, like a page of type) to which ONE small element is added: something new, but not a cut
const busy = () => { const g = blank(); for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) rect(g, 3 + c * 14, 3 + r * 15, 12 + c * 14, 12 + r * 15); return g; };
test("a new element appearing among existing detail is one event, and not a cut", () => {
  const a = busy(), b = rect(busy(), 20, 93, 26, 98);
  const ev = eventsOf(series([a, a, a, b, b, b]));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].cut, false);
  assert.equal(ev[0].t, +(3 / NOVELTY.RATE).toFixed(2));
});

test("a whole-frame change is a cut", () => {
  const a = rect(blank(), 0, 0, 30, 100), b = rect(blank(), 0, 0, 60, 30);   // different geometry: every edge is somewhere new
  const ev = eventsOf(series([a, a, b, b]));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].cut, true);
});

test("an element LEAVING counts too (the beat that clears is a change)", () => {
  const a = rect(blank(), 10, 10, 40, 60);
  assert.equal(eventsOf(series([a, a, blank(), blank()])).length, 1);
});

test("two pops closer than 0.4 s are one event", () => {
  const a = blank(), b = rect(blank(), 5, 5, 20, 20), c = rect(rect(blank(), 5, 5, 20, 20), 30, 50, 50, 80);
  assert.equal(eventsOf(series([a, b, c, c, c])).length, 1);
});

test("cadence: events per 10 s, the gaps between them and the longest wait", () => {
  const ev = [{ t: 1, cut: true }, { t: 2, cut: false }, { t: 4, cut: true }, { t: 9, cut: false }];
  const c = cadenceOf(ev, 10);
  assert.equal(c.events, 4);
  assert.equal(c.events_per_10s, 4);
  assert.equal(c.cuts, 2);
  assert.equal(c.gap_s.max, 5);          // 4 -> 9
  assert.equal(c.shot_s.max, 6);         // 4 -> end
});
