/**
 * The plan's `layout` decides where a beat's elements sit; the composition table is the fallback.
 *
 * canvasLayout() (canvas-layout.js) used to place every element from a per-composition code table:
 * every PROCESS-FULL beat on every channel drew its nodes at the same two cells. These tests drive
 * the real canvasLayout() — the function full-canvas.jsx draws from and render.js records in the
 * manifest — so the boxes asserted here ARE the rendered boxes.
 *
 * MUTATION (run, recorded in the commit): making canvasLayout ignore c.layout (`const layout =
 * null`) turns the cols:2-vs-cols:4, "moves the headline" and "records what it placed" tests red.
 * Restored byte-identical.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canvasLayout, normalizeCanvas, flattenBoxes, LAYOUT_AREA, slotRect, canvasManifest } from "../../src/skills/remotion-render/visual/canvas-layout.js";

const base = { visual_type: "PROCESS", composition: "PROCESS-FULL", data: { nodes: ["higher rates", "rent", "savings"] }, headline: "The chain", motion_tier: "medium" };
const L = (layout, extra = {}) => canvasLayout(normalizeCanvas({ ...base, ...extra, ...(layout ? { layout } : {}) }, 0));
const pos = (lay) => Object.fromEntries(flattenBoxes(lay.boxes).map(([k, b]) => [k, [b.x, b.y, b.w, b.h]]));

describe("plan.layout controls placement", () => {
  it("without a layout the composition table is unchanged (the fallback)", () => {
    const a = L(null), b = L(undefined);
    assert.deepEqual(pos(a), pos(b));
    assert.equal(a.layout, null);
  });

  it("cols:2 and cols:4 put the same element in different places", () => {
    const two = L({ cols: 2, rows: 3, slots: [{ id: "headline", col: 1, row: 1 }] });
    const four = L({ cols: 4, rows: 3, slots: [{ id: "headline", col: 1, row: 1 }] });
    const h2 = two.boxes.headline, h4 = four.boxes.headline;
    assert.notEqual(h2.x, h4.x, "a 2-column grid and a 4-column grid must place column 1 differently");
    assert.equal(h2.x, Math.round(LAYOUT_AREA.x0 + (LAYOUT_AREA.x1 - LAYOUT_AREA.x0) / 2));
    assert.equal(h4.x, Math.round(LAYOUT_AREA.x0 + (LAYOUT_AREA.x1 - LAYOUT_AREA.x0) / 4));
    assert.notDeepEqual(pos(two), pos(four));
  });

  it("moves the headline where the plan says, and the table position no longer holds", () => {
    const table = L(null).boxes.headline;
    const moved = L({ cols: 3, rows: 4, slots: [{ id: "headline", col: 2, row: 3, align: "right", v_align: "bottom" }] }).boxes.headline;
    assert.notDeepEqual([moved.x, moved.y], [table.x, table.y]);
    assert.equal(moved.x + moved.w, LAYOUT_AREA.x1, "right-aligned to the slot's right edge");
    assert.equal(moved.y + moved.h, LAYOUT_AREA.y1, "bottom-aligned to the slot's bottom edge");
  });

  it("moves, never resizes: every element keeps the size its content needs", () => {
    const t = L(null), m = L({ cols: 2, rows: 2, slots: [{ id: "headline", col: 1, row: 1 }, { id: "nodes", col: 0, row: 0 }] });
    for (const [k, b] of flattenBoxes(t.boxes)) {
      const mb = flattenBoxes(m.boxes).find(([mk]) => mk === k)[1];
      assert.deepEqual([mb.w, mb.h], [b.w, b.h], `${k} changed size`);
    }
  });

  it("a whole group moves together (the nodes keep their relative arrangement)", () => {
    const t = L(null).boxes.nodes, m = L({ cols: 1, rows: 1, slots: [{ id: "nodes", x: 48, y: 700, w: 984, h: 600 }] }).boxes.nodes;
    const dx = m[0].x - t[0].x, dy = m[0].y - t[0].y;
    m.forEach((n, i) => assert.deepEqual([n.x - t[i].x, n.y - t[i].y], [dx, dy]));
  });

  it("'hero' names the composition's main element", () => {
    const m = L({ cols: 2, rows: 2, slots: [{ id: "hero", col: 0, row: 1 }] });
    assert.equal(m.layout.placed[0].id, "nodes");
  });

  it("keeps an element on the frame and above the caption band — the only clamp", () => {
    const m = L({ slots: [{ id: "nodes", x: 2000, y: 3000, w: 10, h: 10 }] });
    for (const n of m.boxes.nodes) { assert.ok(n.x >= 48 && n.x + n.w <= 1032, `x ${n.x}`); assert.ok(n.y + n.h <= 1440, `y ${n.y}`); }
  });

  it("reports an id the beat does not have, and moves nothing for it", () => {
    const m = L({ cols: 2, rows: 2, slots: [{ id: "number", col: 1, row: 1 }] });
    assert.deepEqual(m.layout.unknown, ["number"]);
    assert.deepEqual(pos(m), pos(L(null)));
  });

  it("records what it placed in the render manifest", () => {
    const mf = canvasManifest({ ...base, layout: { cols: 4, rows: 2, slots: [{ id: "headline", col: 3, row: 0, align: "right" }] } }, 0);
    assert.equal(mf.plan_layout.cols, 4);
    assert.equal(mf.plan_layout.placed[0].id, "headline");
    assert.equal(canvasManifest(base, 0).plan_layout, null);
  });

  it("slotRect: a cell span on the plan's grid, or a pixel rectangle", () => {
    assert.deepEqual(slotRect({ cols: 2, rows: 2 }, { col: 1, row: 1 }), { x: 540, y: 735, w: 492, h: 605 });
    assert.deepEqual(slotRect({}, { x: 10, y: 20, w: 30, h: 40 }), { x: 10, y: 20, w: 30, h: 40 });
  });
});

// The shapes that failed Layer 1 in CI run 37707115528 (the first run whose rendered plan carried
// the planner's own layouts), rebuilt on the real canvasLayout.
const inter = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const zonesOfBox = (b) => [["top", 0, 620], ["middle", 620, 1340], ["bottom", 1340, 1920]].filter(([, y0, y1]) => b.y + b.h > y0 + 8 && b.y < y1 - 8).map(([n]) => n);

describe("what belongs to an element goes with it (CI run 37707115528)", () => {
  const typeFull = { visual_type: "TYPE", composition: "TYPE-FULL", headline: "Guilty to wire fraud", lead_in: "former officer", motion_tier: "medium" };
  it("a TYPE-FULL statement moved to the top keeps its kicker directly above it, not overlapping", () => {
    const lay = canvasLayout(normalizeCanvas({ ...typeFull, layout: { cols: 1, rows: 2, slots: [{ id: "headline", col: 0, row: 0 }] } }, 1));
    const st = lay.boxes.statement, k = lay.boxes.kicker;
    assert.ok(st && k, "the fixture has a statement and a kicker");
    assert.ok(!inter(st, k), `kicker ${JSON.stringify(k)} overlaps statement ${JSON.stringify(st)}`);
    assert.ok(k.y + k.h <= st.y, "the kicker sits above the statement");
  });
  it("a figure's label moves with the figure", () => {
    const num = { visual_type: "COUNTER", composition: "NUMBER-FULL", data: { value: "$200 million", label: "vanished" }, headline: "Where it went", motion_tier: "medium" };
    const t = canvasLayout(normalizeCanvas(num, 2)), m = canvasLayout(normalizeCanvas({ ...num, layout: { cols: 2, rows: 2, slots: [{ id: "number", col: 0, row: 1 }] } }, 2));
    assert.ok(t.boxes.label && m.boxes.label);
    assert.deepEqual([m.boxes.label.x - m.boxes.number.x, m.boxes.label.y - m.boxes.number.y], [t.boxes.label.x - t.boxes.number.x, t.boxes.label.y - t.boxes.number.y]);
    assert.ok(!inter(m.boxes.label, m.boxes.number));
  });
  it("a number placed across the top / middle edge is moved wholly into one zone, and the move is logged", () => {
    const num = { visual_type: "COUNTER", composition: "NUMBER-FULL", data: { value: "600", label: "pounds of gold" }, headline: "Gold bars", motion_tier: "medium" };
    const m = canvasLayout(normalizeCanvas({ ...num, layout: { slots: [{ id: "number", x: 48, y: 521, w: 600, h: 600 }] } }, 0));
    assert.equal(zonesOfBox(m.boxes.number).length, 1, `number y ${m.boxes.number.y}-${m.boxes.number.y + m.boxes.number.h}`);
    assert.ok(m.layout.adjusted.some((a) => /straddled y 620/.test(a)));
  });
  it("nothing placed enters the caption's zone (y >= 1340)", () => {
    const map = { visual_type: "MAP", composition: "MAP-CENTERED", data: { place: "Florida" }, headline: "Across Florida", motion_tier: "medium" };
    const m = canvasLayout(normalizeCanvas({ ...map, layout: { cols: 1, rows: 2, slots: [{ id: "map", col: 0, row: 1, v_align: "bottom" }] } }, 2));
    for (const [k, b] of flattenBoxes(m.boxes)) if (k !== "photo") assert.ok(b.y + b.h <= 1340 + 8, `${k} ends at ${b.y + b.h}`);
  });
});
