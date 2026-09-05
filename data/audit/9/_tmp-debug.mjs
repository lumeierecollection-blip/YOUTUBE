// scratch debug: longform TERM layer dump + manual rect math (no compile throw)
import { fromBeats } from "../../../src/skills/remotion-render/spec/fromBeats.js";
import { SLOTS_LONGFORM, SLOTS_SHORTS } from "../../../src/skills/remotion-render/layout/slots.js";
import { anchoredRect, headlineContentBox, textBlockHeight } from "../../../src/skills/remotion-render/layout/compile-lint.js";

const FIX = [
  { id: "h", archetype: "HERO_NUMBER", anchorTokenIndex: 3, text: "Rates grew from 12 percent in 2019 to 47 percent in 2024.", wordTokens: ["Rates", "grew", "from", "12", "percent", "in", "2019", "to", "47", "percent", "in", "2024"].map((text) => ({ text })), data: { value: 47, unit: "%" }, caption: "Rates grew from 12% to 47%", kicker: "01 FIXTURE", startFrame: 300, durationInFrames: 90, anchorFrame: 310, sectionIndex: 0 },
  { id: "t", archetype: "TERM_DEFINE", anchorTokenIndex: 0, text: "Inflation is a general increase in prices.", wordTokens: ["Inflation", "is", "a", "general", "increase", "in", "prices"].map((text) => ({ text })), data: { term: "inflation", definition: "a general increase in prices", phrase: "is" }, caption: "Inflation: prices rise", kicker: "02 FIXTURE", startFrame: 300, durationInFrames: 90, anchorFrame: 310, sectionIndex: 0 },
  { id: "l", archetype: "LIST_ITEM", anchorTokenIndex: 0, text: "Alpha", wordTokens: [{ text: "Alpha" }], data: { items: [{ text: "Alpha", anchor: 10 }, { text: "Beta", anchor: 55 }, { text: "Gamma", anchor: 100 }, { text: "Delta", anchor: 145 }, { text: "Epsilon", anchor: 190 }] }, caption: "Alpha", kicker: "03 FIXTURE", startFrame: 300, durationInFrames: 90, anchorFrame: 310, sectionIndex: 0 },
  { id: "c", archetype: "CONTRAST", anchorTokenIndex: 1, text: "12 percent vs 47 percent", wordTokens: ["12", "percent", "vs", "47", "percent"].map((text) => ({ text })), data: { before: "12 percent", after: "47 percent" }, caption: "12 percent vs 47 percent", kicker: "04 FIXTURE", startFrame: 300, durationInFrames: 90, anchorFrame: 310, sectionIndex: 0 },
  { id: "r", archetype: "RELATION", anchorTokenIndex: 1, text: "Spending drives inflation", wordTokens: ["Spending", "drives", "inflation"].map((text) => ({ text })), data: { left: "Spending", right: "inflation", relation: "drives" }, caption: "Spending drives inflation", kicker: "05 FIXTURE", startFrame: 300, durationInFrames: 90, anchorFrame: 310, sectionIndex: 0 },
  { id: "i", archetype: "IMAGE_BEAT", anchorTokenIndex: 0, text: "cave exploration", wordTokens: ["cave", "exploration"].map((text) => ({ text })), data: { image: "b-roll/ch-01/cave-entrance.jpg", credit: "BOGDAN PETRYEAX" }, caption: "cave exploration", kicker: "06 FIXTURE", startFrame: 300, durationInFrames: 90, anchorFrame: 310, sectionIndex: 0 },
  { id: "s", archetype: "STATEMENT", anchorTokenIndex: 0, text: "Every view is earned", wordTokens: ["Every", "view", "is", "earned"].map((text) => ({ text })), data: { icon: "target" }, caption: "Every view is earned", kicker: "07 FIXTURE", startFrame: 300, durationInFrames: 90, anchorFrame: 310, sectionIndex: 0 },
];
const SCENE = {
  h: { headline: "47%", unit: "%" }, t: { headline: "Inflation", term: "inflation" },
  l: { headline: null, items: [{ text: "Alpha", anchor: 10 }, { text: "Beta", anchor: 55 }, { text: "Gamma", anchor: 100 }, { text: "Delta", anchor: 145 }, { text: "Epsilon", anchor: 190 }] },
  c: { headline: "47%" }, r: { headline: "DRIVES INFLATION" }, i: { headline: "ALAMEDA COURT" }, s: { headline: "Every view is earned" },
};

for (const fmt of ["shorts", "longform"]) {
  const slots = fmt === "shorts" ? SLOTS_SHORTS : SLOTS_LONGFORM;
  console.log("==== " + fmt.toUpperCase() + " ====");
  const specs = fromBeats(FIX, {
    anchorFrames: Object.fromEntries(FIX.map((b) => [b.id, 310])),
    durations: Object.fromEntries(FIX.map((b) => [b.id, 90])),
    defaultDuration: 90, forceAllPersistent: true, runtime: "runtime 1",
    slotTable: slots, fonts: { family: "Inter" }, measured: {},
    scene: SCENE, fromVersion: "fromBeats-9",
  });
  specs.forEach((spec) => {
    console.log("SPEC " + spec.id + " " + spec.archetype);
    spec.layers.forEach((l) => {
      const slot = slots[l.slot];
      console.log("  L " + l.role + " slot=" + JSON.stringify(slot) + " align=" + (l.align || "-"));
    });
  });
  // manual headline rect for TERM longform (the failing case)
  const headlineSlot = slots.headline;
  const captionSlot = slots.caption;
  const hCB = headlineContentBox(headlineSlot);
  console.log("headlineContentBox: " + hCB);
  // headline "Inflation" fs84 1line h96, anchored top-left (DEFAULT_ALIGN.headline)
  const hh = textBlockHeight(84, 1);
  const hr = anchoredRect(headlineSlot, "top-left", 403, hh);
  // caption "Inflation: prices rise" fs64 1line h72, anchored bottom (DEFAULT_ALIGN.caption)
  const ch = textBlockHeight(64, 1);
  const cr = anchoredRect(captionSlot, "bottom", 728, ch);
  console.log("manual headline rect: " + JSON.stringify(hr));
  console.log("manual caption rect:  " + JSON.stringify(cr));
}
