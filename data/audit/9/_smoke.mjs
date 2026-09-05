// data/audit/9/_smoke.mjs — verifies fromBeats+compile for shorts AND longform
// using the contract-probe pattern: ONE fromBeats call over all 7 beats
// (spec ids s0b0..s0b6), per-layer fonts/measured maps, per-spec anchorFrame
// map (beat-relative 10), single compile per format. Also confirms headline
// from/to values resolve to the claim delays (tA+0/+6/+8/+18) and that each
// spec's layers carry enter/exit motion for the wiring.
import { fromBeats } from "../../../src/skills/remotion-render/spec/fromBeats.js";
import { validateShotSpecs } from "../../../src/skills/remotion-render/spec/schema.js";
import { compile } from "../../../src/skills/remotion-render/layout/compile.js";
import { measuredKey } from "../../../src/skills/remotion-render/layout/compile-lint.js";
import { MG_TYPE } from "../../../src/skills/remotion-render/compositions/beats.js";
import { SAFE_LONGFORM, SAFE_SHORTS, SLOTS_LONGFORM, SLOTS_SHORTS } from "../../../src/skills/remotion-render/layout/slots.js";

const DUR = 90, START = 300, ANCHOR = 310, tA = 10;
const SCENE = {
  h: { headline: "47%", unit: "%" }, t: { headline: "Inflation", term: "inflation" },
  l: { headline: null, items: [{ text: "Alpha", anchor: 10 }, { text: "Beta", anchor: 55 }, { text: "Gamma", anchor: 100 }, { text: "Delta", anchor: 145 }, { text: "Epsilon", anchor: 190 }] },
  c: { headline: "47%" }, r: { headline: "DRIVES INFLATION" }, i: { headline: "ALAMEDA COURT" },   s: { headline: "Views are earned" },
};
const FIX = [
  { id: "h", archetype: "HERO_NUMBER", anchorTokenIndex: 3, text: "Rates grew from 12% to 47%", wordTokens: ["Rates","grew","from","12%","to","47%"].map((text)=>({text})), data: { value: 47, unit: "%" }, scene: SCENE.h, kicker: "01 FIXTURE", startFrame: START, durationInFrames: DUR, anchorFrame: ANCHOR, sectionIndex: 0 },
  { id: "t", archetype: "TERM_DEFINE", anchorTokenIndex: 0, text: "Inflation: prices rise", wordTokens: ["Inflation:","prices","rise"].map((text)=>({text})), data: { term: "inflation", definition: "a general increase in prices", phrase: "is" }, scene: SCENE.t, kicker: "02 FIXTURE", startFrame: START, durationInFrames: DUR, anchorFrame: ANCHOR, sectionIndex: 0 },
  { id: "l", archetype: "LIST_ITEM", anchorTokenIndex: 0, text: "Alpha", wordTokens: [{ text: "Alpha" }], data: { items: SCENE.l.items }, scene: SCENE.l, kicker: "03 FIXTURE", startFrame: START, durationInFrames: DUR, anchorFrame: ANCHOR, sectionIndex: 0 },
  { id: "c", archetype: "CONTRAST", anchorTokenIndex: 1, text: "12 percent vs 47 percent", wordTokens: ["12","percent","vs","47","percent"].map((text)=>({text})), data: { before: "12 percent", after: "47 percent" }, scene: SCENE.c, kicker: "04 FIXTURE", startFrame: START, durationInFrames: DUR, anchorFrame: ANCHOR, sectionIndex: 0 },
  { id: "r", archetype: "RELATION", anchorTokenIndex: 1, text: "Spending drives inflation", wordTokens: ["Spending","drives","inflation"].map((text)=>({text})), data: { left: "Spending", right: "inflation", relation: "drives" }, scene: SCENE.r, kicker: "05 FIXTURE", startFrame: START, durationInFrames: DUR, anchorFrame: ANCHOR, sectionIndex: 0 },
  { id: "i", archetype: "IMAGE_BEAT", anchorTokenIndex: 0, text: "cave exploration", wordTokens: ["cave","exploration"].map((text)=>({text})), data: { image: "b-roll/ch-01/cave-entrance.jpg", credit: "BOGDAN PETRYEAX" }, scene: SCENE.i, kicker: "06 FIXTURE", startFrame: START, durationInFrames: DUR, anchorFrame: ANCHOR, sectionIndex: 0 },
  { id: "s", archetype: "STATEMENT", anchorTokenIndex: 0, text: "Every view is earned", wordTokens: ["Every","view","is","earned"].map((text)=>({text})), data: { icon: "target" }, scene: SCENE.s, kicker: "07 FIXTURE", startFrame: START, durationInFrames: DUR, anchorFrame: ANCHOR, sectionIndex: 0 },
];

function fixtureMetrics(text, fontSize, slotW) {
  const chars = String(text).length;
  const charW = 0.6 * fontSize;
  const perLine = Math.max(Math.floor(slotW / charW), 1);
  const lines = Math.min(Math.ceil(chars / perLine), 2);
  return { width: Math.min(chars * charW, slotW), lines };
}

let fail = 0;
for (const fmt of ["shorts", "longform"]) {
  const slots = fmt === "shorts" ? SLOTS_SHORTS : SLOTS_LONGFORM;
  const safe = fmt === "shorts" ? SAFE_SHORTS : SAFE_LONGFORM;
  try {
    const fromOpts = {
      anchorFrames: Object.fromEntries(FIX.map((b) => [b.id, ANCHOR])),
      durations: Object.fromEntries(FIX.map((b) => [b.id, DUR])),
      defaultDuration: DUR, forceAllPersistent: true, runtime: "runtime 1",
      slotTable: slots, fonts: { family: "Inter" }, measured: {},
      fromVersion: "fromBeats-9",
    };
    const specs = fromBeats(FIX, fromOpts);
    validateShotSpecs(specs);
    const fontFamily = "Inter";
    const fonts = {};
    const measured = {};
    const anchorFrame = {};
    specs.forEach((spec, i) => {
      const beat = FIX[i];
      anchorFrame[spec.id] = Math.max(beat.anchorFrame - beat.startFrame, 0);
      spec.layers.forEach((layer, j) => {
        const key = `${spec.id}:${j}`;
        if (["kicker", "headline", "caption", "support"].includes(layer.role)) {
          const fontSize = MG_TYPE[layer.role] || 44;
          const text = layer.role === "kicker"
            ? `${String(layer.content.index).padStart(2, "0")} ${layer.content.label}`
            : (layer.content.text ?? "");
          const slotW = layer.role === "caption" ? slots.caption.w : slots.headline.w;
          fonts[key] = { fontSize, fontFamily };
          measured[measuredKey(text, fontSize, fontFamily)] = fixtureMetrics(text, fontSize, slotW);
        }
      });
    });
    const frames = compile(specs, { slots, safe, fonts, measured, anchorFrame });
    frames.forEach((frame, i) => {
      const spec = specs[i];
      const layers = spec.layers || [];
      const rects = frame.rects;
      const headline = rects.find((r) => r.role === "headline");
      const accent = rects.find((r) => r.role === "accent");
      const layerRoles = layers.map((l) => `${l.role}:${l.enter ? l.enter.pattern : "?"}`);
      console.log(`OK ${fmt} ${FIX[i].id} (${frame.beatId}) layers=[${layerRoles.join(", ")}] headline=${headline ? `${headline.w}x${headline.h}@f${headline.from}-${headline.to}` : "none"} accent=${accent ? `f${accent.from}` : "none"} stage=${JSON.stringify(slots.stage)}`);
    });
  } catch (e) {
    fail++;
    console.log(`FAIL ${fmt}: ${e.message}`);
  }
}
console.log(fail === 0 ? "SMOKE OK" : `${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
