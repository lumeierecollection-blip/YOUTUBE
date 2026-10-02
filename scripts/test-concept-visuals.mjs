// node scripts/test-concept-visuals.mjs — concepts are grounded in the sentence and map to the right class.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { conceptsInSentence, validateConcepts, visualsFor } from "../src/skills/remotion-render/visual/concept-visuals.js";
import { canvasLayout, zoneReport, contentBounds } from "../src/skills/remotion-render/visual/canvas-layout.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const specs = JSON.parse(readFileSync(join(ROOT, "scripts", "cutout-specs.json"), "utf8")).specs;
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };

eq("a sentence that names nothing gets no concept", conceptsInSentence("He set up a meeting.", specs), []);
eq("the gavel is found", conceptsInSentence("The judge's gavel came down.", specs).includes("gavel"), true);
eq("one word, one concept ('bank')", conceptsInSentence("The bank warned savers.", specs).filter((n) => n.startsWith("bank")).length, 1);
eq("a rise is the upward arrow, a bare 'up' is not", [conceptsInSentence("Prices rose again.", specs).includes("upward-arrow"), conceptsInSentence("They set it up.", specs).includes("upward-arrow")], [true, false]);
const v = validateConcepts(["gavel", "globe", "nonsense"], "The gavel fell.", specs);
eq("planner concepts: ungrounded and unknown dropped", [v.concepts.includes("gavel"), v.concepts.includes("globe"), v.dropped.length], [true, false, 2]);
const vis = visualsFor(["gavel", "upward-arrow", "factory", "padlock"], [{ name: "gavel", file: "cutouts/gavel.png", width: 600, height: 400 }]);
eq("classes: cutout from the library, symbol drawn, scene and unbuilt cutout skipped", [vis.visuals.map((x) => `${x.name}:${x.class}`), vis.skipped.length], [["gavel:cutout", "upward-arrow:symbol"], 2]);
for (const variant of [0, 1]) {
  const L = canvasLayout({ visual_type: "TYPE", headline: "The court voided the contract", variant, beat_index: variant, beat_total: 6, concept_visuals: vis.visuals });
  const z = zoneReport(L), cb = contentBounds(L);
  // Hero cutout (owner's spec 2026-10-02): centred, >= 500 px longest side, centre y 980-1060, headline <= 140 px.
  const h0 = L.boxes.cutout0, cx = h0.x + h0.w / 2, cy = h0.y + h0.h / 2;
  eq(`layout v${variant}: zones hold, hero >= 500 px centred (x 540 +-80, y 980-1060), headline <= 140 px, span >= 59.5%`,
    [z.ok, Math.max(h0.w, h0.h) >= 500, Math.abs(cx - 540) <= 80, cy >= 980 && cy <= 1061, L.boxes.statement.size <= 140, cb.h / 1920 >= 0.595], [true, true, true, true, true, true]);
}
console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
