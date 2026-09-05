// scratch debug: compile longform TERM alone with the exact smoke maps,
// printing the per-layer rects from a manual re-implementation when it throws
import { fromBeats } from "../../../src/skills/remotion-render/spec/fromBeats.js";
import { compile } from "../../../src/skills/remotion-render/layout/compile.js";
import { measuredKey } from "../../../src/skills/remotion-render/layout/compile-lint.js";
import { MG_TYPE } from "../../../src/skills/remotion-render/compositions/beats.js";
import { SAFE_LONGFORM, SLOTS_LONGFORM } from "../../../src/skills/remotion-render/layout/slots.js";

const DUR = 90, START = 300, ANCHOR = 310;
const SCENE = { t: { headline: "Inflation", term: "inflation" } };
const FIX = [
  { id: "t", archetype: "TERM_DEFINE", anchorTokenIndex: 0, text: "Inflation is a general increase in prices.", wordTokens: ["Inflation", "is", "a", "general", "increase", "in", "prices"].map((text) => ({ text })), data: { term: "inflation", definition: "a general increase in prices", phrase: "is" }, caption: "Inflation: prices rise", kicker: "02 FIXTURE", startFrame: START, durationInFrames: DUR, anchorFrame: ANCHOR, sectionIndex: 0 },
];
const slots = SLOTS_LONGFORM, safe = SAFE_LONGFORM;
const fromOpts = {
  anchorFrames: { t: ANCHOR }, durations: { t: DUR }, defaultDuration: DUR,
  forceAllPersistent: true, runtime: "runtime 1", slotTable: slots,
  fonts: { family: "Inter" }, measured: {}, scene: SCENE, fromVersion: "fromBeats-9",
};
const specs = fromBeats(FIX, fromOpts);
const fontFamily = "Inter";
const fonts = {}, measured = {}, anchorFrame = {};
specs.forEach((spec, i) => {
  const beat = FIX[i];
  anchorFrame[spec.id] = Math.max(beat.anchorFrame - beat.startFrame, 0);
  spec.layers.forEach((layer, j) => {
    const key = `${spec.id}:${j}`;
    if (["kicker", "headline", "caption", "support"].includes(layer.role)) {
      const fontSize = MG_TYPE[layer.role] || 44;
      const text = layer.role === "kicker" ? `${String(layer.content.index).padStart(2, "0")} ${layer.content.label}` : (layer.content.text ?? "");
      const slotW = layer.role === "caption" ? slots.caption.w : slots.headline.w;
      fonts[key] = { fontSize, fontFamily };
      measured[measuredKey(text, fontSize, fontFamily)] = (() => {
        const chars = String(text).length;
        const charW = 0.6 * fontSize;
        const perLine = Math.max(Math.floor(slotW / charW), 1);
        const lines = Math.min(Math.ceil(chars / perLine), 2);
        return { width: Math.min(chars * charW, slotW), lines };
      })();
      console.log(`measured[${key}] "${text}" fs=${fontSize} slotW=${slotW} ->`, measured[measuredKey(text, fontSize, fontFamily)]);
    }
  });
});
try {
  const frames = compile(specs, { slots, safe, fonts, measured, anchorFrame });
  for (const f of frames) {
    console.log("FRAME " + f.beatId);
    for (const r of f.rects) console.log("  R " + r.role + " (" + r.x + "," + r.y + ") " + r.w + "x" + r.h + " from=" + r.from + " to=" + r.to);
  }
} catch (e) {
  console.log("COMPILE ERROR: " + e.message);
}
