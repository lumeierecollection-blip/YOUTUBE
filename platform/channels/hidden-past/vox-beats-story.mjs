/**
 * Hidden Past, layered Vox cut: Pablo Escobar's hippos, rewritten for pace.
 * Script rules applied (from two MIT-licensed skills read on 11 Nov 2026, no code copied):
 *  - CK42BB/vox-explainer-skill, references/vox-style-guide.md: cold open, one turn to context, escalating beats with concrete numbers,
 *    complication, a quotable reframe that returns to the open; present tense; named specifics.
 *  - vyralcontent/content-skills, viral-short-form (retention.md): hook early, "but / therefore" between beats instead of "and then",
 *    a change of picture every 2 to 3 seconds, a re-hook in the middle, cut dead air, loop the last line back to the first.
 * Every claim and its must-text come from vox-hippos-story.mjs and are checked against the fetched Wikipedia article before the run renders.
 * Not reviewed by the script engine's critic.
 */
import { CLAIMS as BASE_CLAIMS, FILES as BASE_FILES, METADATA as BASE_META, WIKI_ARTICLE, WIKI_TITLE } from "./vox-hippos-story.mjs";
export { WIKI_ARTICLE, WIKI_TITLE };
export const SLUG = "escobar-hippos-layered";
export const TOPIC = "Pablo Escobar's hippos: four became about two hundred, and Colombia has approved a cull";
export const CLAIMS = BASE_CLAIMS;

const COMMONS = (t) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2C/g, ",")}`;
/** Four real photographs. `hippoA` is also cut out (rembg) to make the herd. */
export const ASSETS = [
  { key: "escobar", id: "escobar", title: BASE_FILES.mug.title, claim: "H1", role: "Pablo Escobar, police photograph" },
  { key: "hippoA", id: "hippo-grazing", title: BASE_FILES.hippo.title, claim: "H6", role: "a hippo at Hacienda Nápoles, 2008", cutout: true },
  { key: "hippoB", id: "hippo-water", title: "File:Hipopótamo PTHN.jpg", claim: "H10", role: "a hippo in water at Hacienda Nápoles" },
  { key: "gate", id: "gate", title: BASE_FILES.gate.title, claim: "H1", role: "entrance to Hacienda Nápoles, 2009" },
];
for (const a of ASSETS) a.page_url = COMMONS(a.title);

const V = (text, claim_ids = []) => ({ text, claim_ids });
const NR = { allow_no_claim: true, editorial: "turn to context, not a factual claim" };
/** One slot per beat, in story order; slot i is picture i. Variants are longest first so the fitter can choose the length that lands at 35 to 40 s. */
export const SLOTS = [
  { id: "hook1", scene: 0, variants: [V("Pablo Escobar's hippos are still alive.", ["H6"]), V("Escobar's hippos are still alive.", ["H6"])] },
  { id: "hook2", scene: 1, variants: [V("And Colombia has approved killing more than eighty of them.", ["H7"]), V("Colombia approved killing over eighty.", ["H7"])] },
  { id: "turn", scene: 2, ...NR, variants: [V("To understand why, you have to go back to 1981."), V("To see why, go back to 1981."), V("Go back to 1981.")] },
  { id: "import", scene: 3, variants: [V("Escobar imports four hippos for his private zoo.", ["H1"]), V("Escobar imports four hippos.", ["H1"])] },
  { id: "estate", scene: 4, variants: [V("His estate sits between Medellín and Bogotá.", ["H2"]), V("The estate sits between Medellín and Bogotá.", ["H2"])] },
  { id: "escape", scene: 5, variants: [V("In 1993 he dies, and the hippos escape.", ["H3"]), V("In 1993 he dies, and they escape.", ["H3"])] },
  { id: "n16", scene: 6, variants: [V("By 2007, there are sixteen.", ["H4"]), V("By 2007, sixteen.", ["H4"])] },
  { id: "n40", scene: 7, variants: [V("By 2014, about forty.", ["H5"])] },
  { id: "n200", scene: 8, variants: [V("Now, around two hundred.", ["H6"])] },
  { id: "invasive", scene: 9, variants: [V("But most conservationists call them invasive.", ["H9"]), V("But conservationists call them invasive.", ["H9"])] },
  { id: "cull", scene: 10, variants: [V("So in April 2026, Colombia approves killing over eighty.", ["H7"]), V("So Colombia approves killing over eighty.", ["H7"])] },
  { id: "india", scene: 11, variants: [V("An Indian billionaire offers to take them to India instead.", ["H8"]), V("An Indian billionaire offers them shelter in India.", ["H8"])] },
  { id: "stay", scene: 12, variants: [V("But some ecologists say they should stay.", ["H10"]), V("Some ecologists say they should stay.", ["H10"])] },
  { id: "gone", scene: 13, variants: [V("Escobar is gone, but his hippos are not.", ["H3", "H6"]), V("Escobar is gone, but the hippos are not.", ["H3", "H6"])] },
];

/** Picture kinds, same order as the slots. The composition draws each as several layers; see vox-beats.jsx. */
export const SCENES = [
  { kind: "still", treatment: "sticker-photo-with-title", objective: "Open on a real hippo at Hacienda Nápoles with a bold 'still alive' title", background: "paper panel in saturated frame" },
  { kind: "approved", treatment: "giant-number-with-stamp", objective: "Give the cull number as the dominant element with the approval stamp and the photograph pushed aside", background: "paper panel in saturated frame" },
  { kind: "year", treatment: "date-roll-turn", objective: "Mark the turn to context with the year 1981", background: "paper panel in saturated frame" },
  { kind: "import", treatment: "portrait-sticker-with-count", objective: "Show Escobar's police photograph beside the number four and four hippo cut-outs", background: "paper panel in saturated frame" },
  { kind: "estate", treatment: "drawn-map-with-pinned-photo", objective: "Draw Colombia, place Hacienda Nápoles between Medellín and Bogotá, and pin the entrance photograph to it", background: "paper panel in saturated frame" },
  { kind: "escape", treatment: "photo-with-cutouts-leaving", objective: "Show the estate entrance with hippo cut-outs leaving it, the year 1993 and a stamp", background: "paper panel in saturated frame" },
  { kind: "n16", treatment: "counting-herd", objective: "Show sixteen hippo cut-outs in a grid with 16 and 2007", background: "paper panel in saturated frame" },
  { kind: "n40", treatment: "counting-herd", objective: "Show forty hippo cut-outs in a grid with 40 and 2014", background: "paper panel in saturated frame" },
  { kind: "n200", treatment: "counting-herd", objective: "Show two hundred hippo cut-outs with about 200 and April 2026", background: "paper panel in saturated frame" },
  { kind: "invasive", treatment: "stamp-over-faded-herd", objective: "Stamp INVASIVE over the faded herd, attributed to most conservationists", background: "paper panel in saturated frame" },
  { kind: "cull", treatment: "herd-with-cull-highlight", objective: "Colour eighty of the two hundred cut-outs as the approved cull, with the date stamp", background: "paper panel in saturated frame" },
  { kind: "india", treatment: "drawn-arc-map", objective: "Draw an arc from Colombia to India with the offer labelled", background: "paper panel in saturated frame" },
  { kind: "stay", treatment: "sticker-photo-with-quote-card", objective: "Show a hippo in water with the ecologists' view as a quote card", background: "paper panel in saturated frame" },
  { kind: "gone", treatment: "then-and-now-stickers", objective: "Set Escobar's faded photograph against the hippo, 1993 against 2026, echoing the opening", background: "paper panel in saturated frame" },
];

export const METADATA = {
  ...BASE_META,
  description: BASE_META.description.replace("pictures from Wikimedia Commons, credited below.", "pictures from Wikimedia Commons, credited on screen and below.").replace("Images: Colombian National Police (public domain), Alvaro Morales Ríos (CC BY-SA 4.0) and XalD (CC BY 3.0)", "Images: Colombian National Police (public domain), Alvaro Morales Ríos (CC BY-SA 4.0) and XalD (CC BY 3.0)"),
};
