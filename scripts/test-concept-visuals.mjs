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
// An object concept needs its own name in the sentence: the institution "bank" is not a bank-building photo,
// and "law" is not a gavel (CI run 37012196580 ch-2 beat 8 rendered a gavel for a credit law).
eq("'bank' alone grounds no bank-building", conceptsInSentence("The bank warned savers.", specs).filter((n) => n.startsWith("bank")).length, 0);
eq("'the bank building' grounds bank-building", conceptsInSentence("They sold the old bank building.", specs).includes("bank-building"), true);
eq("a law grounds no gavel", [conceptsInSentence("The new credit law protects drivers.", specs).includes("gavel"), validateConcepts(["gavel"], "The new credit law protects drivers.", specs).concepts.includes("gavel")], [false, false]);
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
// A wide object (a key, 2.5:1) is set on a diagonal: its INK box >= 470 px tall, centred, never shrunk (CI run 36999095271 ch-48 beat 2).
// The ink here is a bar through the middle of the PNG (a transparent margin above and below), as a real cutout has.
const bar = { pts: [[0.02, 0.3], [0.98, 0.3], [0.02, 0.7], [0.98, 0.7]] };
for (const [r, ink] of [[2.5, null], [4, null], [2.5, bar]]) {
  const L = canvasLayout({ visual_type: "TYPE", headline: "Keep a spare key", beat_index: 2, beat_total: 6, concept_visuals: [{ name: "key", class: "cutout", asset: "cutouts-live/48/2-key.png", w: 100 * r, h: 100, ink }] });
  const h0 = L.boxes.cutout0, cx = h0.x + h0.w / 2, cy = h0.y + h0.h / 2, cb = contentBounds(L);
  eq(`wide ${r}:1 cutout${ink ? " (ink margin)" : ""}: tilted, ink box >= 470 tall, <= 984 x 640, centred, ink reaches y >= 1290`,
    [h0.tilt > 0 && h0.tilt <= 30, h0.h >= 470, h0.w <= 984 && h0.h <= 640, Math.abs(cx - 540) <= 80, cy >= 980 && cy <= 1061, h0.y + h0.h >= 1290, cb.h / 1920 >= 0.6, zoneReport(L).ok], [true, true, true, true, true, true, true, true]);
}
// A skyline is never tilted: cropped level across the full width.
{
  const L = canvasLayout({ visual_type: "TYPE", headline: "The skyline kept rising", beat_index: 2, beat_total: 6, concept_visuals: [{ name: "city-skyline", class: "cutout", asset: "cutouts/city-skyline.png", w: 1024, h: 280 }] });
  const h0 = L.boxes.cutout0;
  eq("skyline: level, cropped to the frame, ink box >= 470 tall", [!h0.tilt, !!h0.crop, h0.x >= 48 && h0.x + h0.w <= 1032, h0.h >= 470], [true, true, true, true]);
}
console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
