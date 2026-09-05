// data/audit/9/contract-probe.mjs — dump per-archetype: spec layers
// (role/slot/enter/exit/content) and compiled rects. Evidence for the
// audit-motion stage-9 ledger.
import { fromBeats } from "../../../src/skills/remotion-render/spec/fromBeats.js";
import { validateShotSpecs } from "../../../src/skills/remotion-render/spec/schema.js";
import { compile } from "../../../src/skills/remotion-render/layout/compile.js";
import { measuredKey } from "../../../src/skills/remotion-render/layout/compile-lint.js";
import { SAFE_SHORTS, SLOTS_SHORTS } from "../../../src/skills/remotion-render/layout/slots.js";
import { MG_TYPE } from "../../../src/skills/remotion-render/compositions/beats.js";

const DUR = 90;
const FIX = [
  { id: "h", archetype: "HERO_NUMBER", anchorTokenIndex: 3, text: "Rates grew from 12 percent in 2019 to 47 percent in 2024.", wordTokens: [{ text: "Rates" }, { text: "grew" }, { text: "from" }, { text: "12" }, { text: "percent" }, { text: "in" }, { text: "2019" }, { text: "to" }, { text: "47" }, { text: "percent" }, { text: "in" }, { text: "2024" }], data: { value: 47, unit: "%" }, caption: "Rates grew from 12 percent in 2019 to 47 percent in 2024.", kicker: "01 FIXTURE", startFrame: 300, durationInFrames: DUR, anchorFrame: 310, sectionIndex: 0 },
  { id: "t", archetype: "TERM_DEFINE", anchorTokenIndex: 0, text: "Inflation is a general increase in prices.", wordTokens: [{ text: "Inflation" }, { text: "is" }, { text: "a" }, { text: "general" }, { text: "increase" }, { text: "in" }, { text: "prices" }], data: { term: "inflation", definition: "a general increase in prices", phrase: "is" }, caption: "Inflation is a general increase in prices.", kicker: "02 FIXTURE", startFrame: 300, durationInFrames: DUR, anchorFrame: 310, sectionIndex: 0 },
  { id: "l", archetype: "LIST_ITEM", anchorTokenIndex: 0, text: "Alpha", wordTokens: [{ text: "Alpha" }], data: { items: ["Alpha", "Beta", "Gamma", "Delta"] }, caption: "", kicker: "", startFrame: 300, durationInFrames: DUR, anchorFrame: 310, sectionIndex: 0 },
  { id: "r", archetype: "RELATION", anchorTokenIndex: 1, text: "Spending drives inflation.", wordTokens: [{ text: "Spending" }, { text: "drives" }, { text: "inflation" }], data: { left: "spending", right: "inflation", relation: "drives" }, caption: "Spending drives inflation.", kicker: "04 FIXTURE", startFrame: 300, durationInFrames: DUR, anchorFrame: 310, sectionIndex: 0 },
  { id: "c", archetype: "CONTRAST", anchorTokenIndex: 3, text: "Then it was 12 percent, now it is 47.", wordTokens: [{ text: "Then" }, { text: "it" }, { text: "was" }, { text: "12" }, { text: "percent" }, { text: "now" }, { text: "it" }, { text: "is" }, { text: "47" }], data: { left: "then", right: "now" }, caption: "Then it was 12 percent, now it is 47.", kicker: "05 FIXTURE", startFrame: 300, durationInFrames: DUR, anchorFrame: 310, sectionIndex: 0 },
  { id: "s", archetype: "STATEMENT", anchorTokenIndex: 2, text: "It matters because every policy choice shifts the curve.", wordTokens: [{ text: "It" }, { text: "matters" }, { text: "because" }, { text: "every" }, { text: "policy" }, { text: "choice" }, { text: "shifts" }, { text: "the" }, { text: "curve" }], data: { subject: "" }, caption: "It matters because every policy choice shifts the curve.", kicker: "06 FIXTURE", startFrame: 300, durationInFrames: DUR, anchorFrame: 310, sectionIndex: 0 },
  { id: "i", archetype: "IMAGE_BEAT", anchorTokenIndex: 1, text: "The dam holds back a city's water.", wordTokens: [{ text: "The" }, { text: "dam" }, { text: "holds" }, { text: "back" }, { text: "a" }, { text: "city's" }, { text: "water" }], data: { image: "beat-1", subject: "dam" }, caption: "The dam holds back a city's water.", kicker: "07 FIXTURE", startFrame: 300, durationInFrames: DUR, anchorFrame: 310, sectionIndex: 0 },
  { id: "p", archetype: "PROGRESS", anchorTokenIndex: 3, text: "Rates grew from 12 percent in 2019 to 47 percent in 2024.", wordTokens: [{ text: "Rates" }, { text: "grew" }, { text: "from" }, { text: "12" }, { text: "percent" }, { text: "in" }, { text: "2019" }, { text: "to" }, { text: "47" }, { text: "percent" }, { text: "in" }, { text: "2024" }], data: { unit: "%", series: [{ label: "2019", value: 12 }, { label: "2024", value: 47, highlight: true }] }, caption: "Rates grew from 12 percent in 2019 to 47 percent in 2024.", kicker: "08 FIXTURE", startFrame: 300, durationInFrames: DUR, anchorFrame: 310, sectionIndex: 0 },
];

const specs = fromBeats(FIX);
const v = validateShotSpecs(specs);
console.log("VALIDATE:", v.valid ? "ok" : "FAIL " + v.errors.join(" | "));

function fixtureMetrics(text, fontSize, slotW) {
  const chars = String(text).length;
  const charW = 0.6 * fontSize;
  const perLine = Math.max(Math.floor(slotW / charW), 1);
  const lines = Math.min(Math.ceil(chars / perLine), 2);
  return { width: Math.min(chars * charW, slotW), lines };
}

const fontFamily = "Inter";
const fonts = {};
const measured = {};
const anchorFrame = {};
for (const spec of specs) {
  const beat = FIX.find((b) => b.id === spec.id);
  anchorFrame[spec.id] = beat ? Math.max(beat.anchorFrame - beat.startFrame, 0) : 0;
  spec.layers.forEach((layer, i) => {
    const key = `${spec.id}:${i}`;
    if (["kicker", "headline", "caption", "support"].includes(layer.role)) {
      const fontSize = MG_TYPE[layer.role] || 44;
      const text = layer.role === "kicker"
        ? `${String(layer.content.index).padStart(2, "0")} ${layer.content.label}`
        : (layer.content.text ?? "");
      const slotW = layer.role === "caption" ? SLOTS_SHORTS.caption.w : SLOTS_SHORTS.headline.w;
      fonts[key] = { fontSize, fontFamily };
      measured[measuredKey(text, fontSize, fontFamily)] = fixtureMetrics(text, fontSize, slotW);
    }
  });
}

for (const spec of specs) {
  console.log("SPEC " + spec.id + " " + spec.archetype);
  for (const l of spec.layers) {
    console.log("  L " + l.role + " slot=" + l.slot + " align=" + (l.align || "-") +
      " enter=" + l.enter.pattern + "@" + JSON.stringify(l.enter.atFrame) +
      " exit=" + l.exit.pattern + "@" + JSON.stringify(l.exit.atFrame) +
      " content=" + JSON.stringify(l.content).slice(0, 140));
  }
}

let frames;
try {
  frames = compile(specs, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts, measured, anchorFrame });
  console.log("COMPILE ok — frames:", frames.length);
  for (const f of frames) {
    console.log("FRAME " + f.beatId + " dur=" + f.durationInFrames);
    for (const r of f.rects) {
      console.log("  R " + r.role + " (" + r.x + "," + r.y + ") " + r.w + "x" + r.h +
        " from=" + r.from + " to=" + r.to + " struct=" + (r.structural === true) +
        " persist=" + (r.persistent === true) + (r.chart ? " chart(axisY=" + r.chart.axisY + ")" : "") +
        (r.fontSize ? " fs=" + r.fontSize : ""));
    }
  }
} catch (err) {
  console.log("COMPILE THREW:", err.message);
}
