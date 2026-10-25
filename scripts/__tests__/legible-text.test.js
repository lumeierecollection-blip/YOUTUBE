// What the frames showed (board 37901614633): a label ended mid-phrase ("VESSELS TO DISMANTLE THE", ch-9);
// an accent word must read on its beat's ground (ch-8's dark accent on near-black); a bar chart's labels
// were clipped at the band's floor (ch-9 beat 4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { trimDangling, readableAccent, canvasLayout, normalizeCanvas } from "../../src/skills/remotion-render/visual/canvas-layout.js";

const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
const cr = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test("a label never ends on a function word", () => {
  assert.equal(trimDangling("vessels to dismantle the"), "vessels to dismantle");
  assert.equal(trimDangling("Department of the"), "Department");
  assert.equal(trimDangling("cut off illicit funding"), "cut off illicit funding");
  assert.equal(trimDangling("Iran"), "Iran");
  assert.equal(trimDangling("the"), "the", "a single word stays");
});

test("the number card's label is drawn without the dangling word", () => {
  const L = canvasLayout(normalizeCanvas({ visual_type: "COUNTER", composition: "NUMBER-STAT", headline: null, data: { value: "17", label: "vessels to dismantle the" } }, 5));
  const lines = L.boxes.label?.lines || L.boxes.kicker?.lines || [];
  assert.ok(lines.length, "a label is drawn");
  assert.doesNotMatch(lines.join(" "), /\bTHE$/);
});

test("an accent reads at 3:1 on its ground, in the channel's own hue; one that already reads is untouched", () => {
  for (const [accent, ground] of [["#3B2A20", "#101010"], ["#1D3A5F", "#101010"], ["#F0E0C0", "#FFFFFF"], ["#6A5ACD", "#241C18"], ["#8C5A3C", "#382D28"]]) {
    const out = readableAccent(accent, ground);
    assert.ok(cr(out, ground) >= 3, `${accent} on ${ground} -> ${out} (${cr(out, ground).toFixed(2)}:1)`);
  }
  assert.equal(readableAccent("#8B1A1A", "#FFFFFF"), "#8B1A1A");
  assert.equal(readableAccent("#C28F70", "#101010"), "#C28F70");
});

test("a vertical bar chart's labels sit inside the chart's floor, not past it", () => {
  const jsx = readFileSync(new URL("../../src/skills/remotion-render/visual/full-canvas.jsx", import.meta.url), "utf8");
  assert.match(jsx, /y=\{base \+ 34\}/);
  assert.doesNotMatch(jsx, /y=\{base \+ 50\}/);
});
