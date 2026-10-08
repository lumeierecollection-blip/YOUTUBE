/**
 * Replay: the planner's REAL layouts from CI run 37723570093 (attempt 2, the canvases the renderer
 * drew — scripts/fixtures/layout-replay/) through canvasLayout. Counts, per beat, who decided the
 * placement: the plan (both axes / one axis) or the table (no layout used, or a layout that moved
 * nothing).
 *
 * Before the visual-id mapping and the per-axis fallback, 6 of these 10 beats were drawn by the
 * table (2 rejected outright, 4 "used" layouts whose slots named a visual the beat did not have and
 * so moved nothing). After the mapping + per-axis fallback: 2 of 10; with the vertical eased to the
 * nearest legal position: 1 of 10, and 0 of 10 on run 37739128920.
 *
 * MUTATIONS (run, recorded in the commit): removing the visual-id mapping, or the per-axis fallback,
 * each raises the table count above the bound and turns this red. Restored byte-identical.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canvasLayout, normalizeCanvas } from "../../src/skills/remotion-render/visual/canvas-layout.js";

const fx = JSON.parse(readFileSync("scripts/fixtures/layout-replay/run-37723570093.json", "utf8"));
// These canvases come from runs that drew a kicker (lead_in) on every beat; the planner's layouts were made
// for those elements. Since 2026-10-08 a kicker is drawn only for a planner label, so each replayed lead_in is
// replayed as that label — the same elements, the same layout mechanics under test.
const asLabel = (c) => (c.lead_in ? { ...c, label: { text: c.lead_in, position: "top-left" } } : c);
const sourceOf = (lo) => (!lo?.used ? "table" : !lo.moved?.length ? "plan-noop" : lo.axes === "xy" ? "plan" : `plan-${lo.axes}`);
const sources = fx.canvases.map((c, i) => sourceOf(canvasLayout(normalizeCanvas(asLabel(c), i)).layout));

it("the table draws at most 1 of the 10 replayed beats (run 37723570093)", () => {
  const table = sources.filter((s) => s === "table" || s === "plan-noop").length;
  assert.ok(table <= 1, `table-drawn ${table}/10: ${sources.join(", ")}`);
});
it("run 37739128920 (the table drew beats 0 and 4, both NUMBER-FULL): the table draws at most 1", () => {
  const fx2 = JSON.parse(readFileSync("scripts/fixtures/layout-replay/run-37739128920.json", "utf8"));
  const src2 = fx2.canvases.map((c, i) => sourceOf(canvasLayout(normalizeCanvas(asLabel(c), i)).layout));
  const table = src2.filter((s) => s === "table" || s === "plan-noop").length;
  assert.ok(table <= 1, src2.join(", "));
});
it("every replayed beat that used the plan is legal by Layer 1's geometry", async () => {
  const { layoutViolations } = await import("../../src/skills/remotion-render/visual/canvas-layout.js");
  fx.canvases.forEach((c, i) => {
    const L = canvasLayout(normalizeCanvas(asLabel(c), i));
    const T = canvasLayout(normalizeCanvas({ ...c, layout: undefined }, i));
    const base = new Set(layoutViolations(T).map((v) => v.rule));
    assert.deepEqual(layoutViolations(L).filter((v) => !base.has(v.rule)), [], `beat ${i}`);
  });
});
it("run 37743696701: no planned layout leaves a beat more than 1 point below the default's box span (beat 1 rendered 58.9% by pixels)", async () => {
  const { contentBounds } = await import("../../src/skills/remotion-render/visual/canvas-layout.js");
  const fx3 = JSON.parse(readFileSync("scripts/fixtures/layout-replay/run-37743696701.json", "utf8"));
  fx3.canvases.forEach((c, i) => {
    const P = canvasLayout(normalizeCanvas(asLabel(c), i)), T = canvasLayout(normalizeCanvas({ ...c, layout: undefined }, i));
    if (T.boxes.photo) return;
    const ps = contentBounds(P).h / 1920, ts = contentBounds(T).h / 1920;
    assert.ok(ps >= Math.min(ts, 0.66) - 0.01 - 1e-9, `beat ${i}: planned ${ps.toFixed(3)} vs default ${ts.toFixed(3)}`);
  });
  const src3 = fx3.canvases.map((c, i) => sourceOf(canvasLayout(normalizeCanvas(asLabel(c), i)).layout));
  assert.ok(src3.filter((s) => s === "table" || s === "plan-noop").length <= 1, src3.join(", "));
});
it("run 37746025773: a placed cutout stays clear of y 1340 the way the table keeps it (its shadow crossed the edge)", () => {
  const fx4 = JSON.parse(readFileSync("scripts/fixtures/layout-replay/run-37746025773.json", "utf8"));
  const L = canvasLayout(normalizeCanvas(fx4.canvases[0], 0));
  const T = canvasLayout(normalizeCanvas({ ...fx4.canvases[0], layout: undefined }, 0));
  assert.ok(L.boxes.cutout0.y + L.boxes.cutout0.h <= Math.max(T.boxes.cutout0.y + T.boxes.cutout0.h, 1316), `cutout bottom ${L.boxes.cutout0.y + L.boxes.cutout0.h}`);
});
it("run 37764608991: a placed emphasis word keeps its descenders above y 1340 (they crossed the zone edge)", () => {
  const fx5 = JSON.parse(readFileSync("scripts/fixtures/layout-replay/run-37764608991.json", "utf8"));
  const L = canvasLayout(normalizeCanvas(fx5.canvases[8], 8));
  const e = L.boxes.emphasis;
  assert.ok(e.y + e.h + (e.desc || 0) <= 1340, `emphasis ink ends at ${e.y + e.h + (e.desc || 0)}`);
});
