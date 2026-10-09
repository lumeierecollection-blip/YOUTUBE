// FIGURE-LOW for a chart: the chart across the TOP band, its headline low (the number's and the map's
// counterpart). Without it a run of chart beats could not be arranged with fewer than three words-in-the-top-band
// beats in a row — boards 37925838913 / 37931078077 ch-2, ch-5, ch-10 (template-window).
import { test } from "node:test";
import assert from "node:assert/strict";
import { canvasLayout, canvasManifest, layoutViolations, normalizeCanvas, ZONES } from "../../src/skills/remotion-render/visual/canvas-layout.js";
import { shotMenu, applyShot } from "../render-and-qa.js";
import { labelsDrawn } from "../template-check.js";

const DATA = {
  BAR: { bars: [{ label: "needs", value: "50%" }, { label: "wants", value: "30%" }] },
  LINE: { points: [{ label: "2022", value: "2%" }, { label: "2024", value: "3.5%" }, { label: "2026", value: "4.5%" }] },
  TREND: { direction: "up", label: "surveillance" },
};
const chart = (vt, extra = {}) => ({ visual_type: vt, composition: "DATA-FULL", data: DATA[vt], headline: "Surveillance keeps expanding everywhere now", ...extra });

test("a chart drawn FIGURE-LOW is centred in the upper middle band with its headline under it, legally", () => {
  for (const vt of ["BAR", "LINE", "TREND"]) for (const variant of [0, 1]) {
    const L = canvasLayout(normalizeCanvas(chart(vt, { headline_zone: "middle", chart_zone: "top", variant }), variant));
    assert.deepEqual(layoutViolations(L), [], `${vt} v${variant}`);
    const cy = L.boxes.chart.y + L.boxes.chart.h / 2;
    assert.ok(Math.abs(cy - 960) <= 100, `${vt}: the chart is near the frame's centre (y ${cy}), not stranded in the top third`);
    assert.ok(L.boxes.headline.y >= L.boxes.chart.y + L.boxes.chart.h, `${vt}: the headline is under the chart`);
    assert.ok(L.boxes.headline.y >= ZONES.middle[0], `${vt}: the headline is in the middle band`);
    const m = canvasManifest(chart(vt, { headline_zone: "middle", chart_zone: "top", variant }), variant);
    assert.deepEqual(labelsDrawn(m), [], `${vt}: no words in the top band`);
  }
});

test("the default chart keeps its headline in the top band (words at the top)", () => {
  const m = canvasManifest(chart("BAR"), 0);
  assert.ok(labelsDrawn(m).length > 0);
});

test("the shot menu offers FIGURE-LOW[low] beside FIGURE[top] for BAR, LINE and TREND — and not for a donut", () => {
  for (const vt of ["BAR", "LINE", "TREND"]) {
    const b = { index: 3, narration: "Surveillance keeps expanding everywhere now.", visual_type: vt };
    const menu = shotMenu(chart(vt), b).filter((o) => !o.nochrome);
    assert.deepEqual(menu.map((o) => `${o.shot}[${o.words}]`).filter((s) => /^FIGURE/.test(s)).sort(), ["FIGURE-LOW[low]", "FIGURE[top]"], vt);
  }
  const pie = shotMenu({ visual_type: "PIE", composition: "DATA-FULL", data: { percent: 34, label: "of income" }, headline: "Housing share" }, { index: 3, narration: "Housing is thirty four percent of income." });
  assert.ok(!pie.some((o) => o.shot === "FIGURE-LOW"));
});

test("applyShot FIGURE-LOW needs a headline to put under the chart", () => {
  const c = chart("BAR", { headline: "" });
  assert.equal(applyShot(c, { index: 1, shot: "FIGURE-LOW" }, () => {}).drawn, false);
  const ok = chart("BAR");
  assert.equal(applyShot(ok, { index: 1, shot: "FIGURE-LOW" }, () => {}).drawn, true);
  assert.deepEqual([ok.headline_zone, ok.chart_zone], ["middle", "top"]);
});
