// THE TEXT GRID (owner, 2026-10-10: "One grid. One anchor. Every beat." — "the user asked for centred and did not get it"). Every
// composition, in every form the pipeline draws, puts its words centred on the frame's axis and standing on one line (TEXT_GRID.base),
// with the visual above them. The rendered frames are measured by Layer 1's `grid` check (scripts/local-audit.cjs textGrid).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canvasLayout, normalizeCanvas, layoutViolations, TEXT_GRID } from "../../src/skills/remotion-render/visual/canvas-layout.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/shot-proof/beats.json", import.meta.url), "utf8"));
const beats = (Array.isArray(fixture) ? fixture : fixture.beats).map((b) => b.c);
const extra = [
  { visual_type: "PROCESS", data: { nodes: ["Apply", "Review", "Approve"] }, headline: "How the money moved", composition: "PROCESS-FULL" },
  { visual_type: "TIMELINE", data: { markers: [{ date: "1990", label: "Founded" }, { date: "2008", label: "Crash" }, { date: "2024", label: "Fine" }] }, headline: "Three dates", composition: "TIMELINE" },
  { visual_type: "LIST", data: { items: ["First", "Second", "Third"] }, headline: "Three exchanges", composition: "LIST-BUILD" },
  { visual_type: "COMPARISON", data: { a: { label: "Before", value: "12%" }, b: { label: "After", value: "40%" }, relation: "from-to" }, headline: "From 12% to 40%", composition: "COMPARISON-SPLIT" },
  { visual_type: "MAP", data: { place: "France" }, headline: "France now pays more", composition: "MAP-CENTERED" },
  { visual_type: "COUNTER", data: { value: "$86 million", label: "stolen" }, headline: "The heist", composition: "NUMBER-FULL" },
  { visual_type: "PIE", data: { percent: 62, label: "of buyers" }, headline: "Most buyers waited", composition: "DATA-FULL" },
  { visual_type: "GAUGE", data: { percent: 81, label: "approval" }, headline: "Approval fell", composition: "DATA-FULL" },
  { visual_type: "TYPE", headline: "Not the law but the training", composition: "TYPE-SPLIT" },
  { visual_type: "TYPE", headline: "Savers moved more", name_card: { name: "Brad Klontz", sub: "12 percent" } },
  { visual_type: "TYPE", headline: "Refused to let it go cold", composition: "TYPE-DEFINITION", sentence: "She refused to let it go cold." },
];

test("the grid is on in production", () => assert.equal(TEXT_GRID.on, true));

test("every composition's words are centred on the frame's axis and stand on the grid line — both variants", () => {
  const rows = [];
  for (const [i, c0] of [...beats, ...extra].entries()) for (const variant of [0, 1]) {
    const L = canvasLayout(normalizeCanvas({ ...c0, variant }, i));
    const t = L.boxes.statement || L.boxes.headline;
    if (!t || !t.w) continue;
    const cx = t.x + t.w / 2, bottom = t.y + t.h + (t.desc || 0);
    rows.push(`${L.composition.padEnd(16)} v${variant} centre x ${Math.round(cx)} bottom ${Math.round(bottom)}`);
    assert.ok(Math.abs(cx - 540) <= 2, `${L.composition} v${variant}: words centred at ${cx}`);
    assert.ok(Math.abs(bottom - TEXT_GRID.base) <= TEXT_GRID.tolerance, `${L.composition} v${variant}: words end at ${bottom}, grid line ${TEXT_GRID.base}`);
    assert.equal(t.align, "center", `${L.composition} v${variant}: align ${t.align}`);
    assert.deepEqual(layoutViolations(L), [], `${L.composition} v${variant}`);
    // the visual is above the words, never under or through them
    for (const [k, b] of Object.entries(L.boxes)) {
      if (!b || typeof b !== "object" || !("y" in b) || ["statement", "headline", "kicker", "lead_phrase", "rule", "rule_end", "underline", "photo", "split", "bar"].includes(k) || b.role === "rule") continue;
      if (k === "photo" && b.h >= 1900) continue;
      assert.ok(b.y + b.h <= t.y + 4 || b.x + b.w <= t.x || b.x >= t.x + t.w, `${L.composition} v${variant}: ${k} (y ${b.y}-${b.y + b.h}) runs into the words (y ${t.y})`);
    }
  }
  console.log(rows.join("\n"));
});

test("no composition keeps its words in the top band", () => {
  for (const [i, c0] of [...beats, ...extra].entries()) {
    const L = canvasLayout(normalizeCanvas(c0, i));
    const t = L.boxes.statement || L.boxes.headline;
    if (t && t.w) assert.ok(t.y > 620, `${L.composition}: words at y ${t.y}`);
  }
});

test("a planned slot layout does not move the words off the grid", () => {
  const c = { visual_type: "COUNTER", data: { value: "$86 million", label: "stolen" }, headline: "The heist", composition: "NUMBER-FULL",
    layout: { cols: 1, rows: 2, slots: [{ id: "number", col: 0, row: 0 }, { id: "headline", col: 0, row: 1 }] } };
  const L = canvasLayout(normalizeCanvas(c, 0));
  assert.equal(L.layout.used, false);
  const t = L.boxes.headline;
  assert.ok(Math.abs(t.y + t.h + (t.desc || 0) - TEXT_GRID.base) <= TEXT_GRID.tolerance);
});
