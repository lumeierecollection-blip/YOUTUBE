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
  eq(`layout v${variant}: zones hold, primary 420 px, span >= 61%`, [z.ok, Math.max(L.boxes.cutout0.w, L.boxes.cutout0.h), cb.h / 1920 >= 0.61], [true, 420, true]);
}
console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
