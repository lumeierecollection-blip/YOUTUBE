// Hidden Past long-form v3 (16 Nov 2026): v2's script and sources, unchanged, with the reference's visual mix added.
// Reference RealLifeLore FA-oEtccS_k: animated maps ~45% (long, camera moving) + 1-6 s news/archive cuts ~45%. v2 had maps and single stills; v3 adds
// `cuts` scenes: hard cuts every 3-5 s inside a beat between real Pixabay footage (Pixabay Content License, credited "Footage: Pixabay") and archive photos.
// Footage honesty: no clip is captioned as a specific historic event. Footage is labelled "TODAY" / "BALTIC COAST"; history stays on archive photos.
// Known gap: no licensed military or Suwałki-road footage was found (the Pixabay hits were AI-made, London/Moscow or unrelated), so the military and gap beats stay on maps and photos.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EPISODE as E2, SOURCES as S2 } from "./hidden-past-kaliningrad-v2.mjs";

const ATT = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../../src/skills/remotion-render/public/lf2/hidden-past/ATTRIBUTIONS.json"), "utf8"));
export const SOURCES = { ...S2, PIX: { title: "Footage: Pixabay (Pixabay Content License), clip pages listed in public/lf2/hidden-past/clips/hidden-past-kaliningrad-v3/FOOTAGE.json", url: "https://pixabay.com/videos/", retrieved: "2026-11-16" } };
const CLIP = "lf2/hidden-past/clips/hidden-past-kaliningrad-v3/";
// footage shot: w = share of the beat, start = seconds into the clip (clips are 8-10 s and hold their last frame)
const Fv = (name, start = 0, o = {}) => ({ video: `${CLIP}${name}.mp4`, videoLen: o.len || 10, start, credit: "Footage: Pixabay", ...o, len: undefined });
// archive photo shot with its recorded credit line
const Ph = (id, o = {}) => { const img = `lf2/hidden-past/${id}.jpg`; return { image: img, credit: ATT[id]?.credit_line, ...o }; };
const cap = (text, source, from = 20, to) => [{ text, source, from, ...(to ? { to } : {}) }];
const CUTS = (shots, o = {}) => ({ type: "cuts", credits: [], shots, ...o });

const OVER = {
  V06: CUTS([Fv("kg-city-aerial", 0, { w: 1.2 }), Ph("kg-cathedral-night", { w: 1, captions: cap("Until 1946 known in English as Königsberg.", "Wikipedia, 'Kaliningrad'", 14) }), Fv("q-kaliningrad-3", 0, { w: 1.1 })], { date: "KALININGRAD TODAY" }),
  V07: CUTS([Fv("q-kaliningrad-5", 0, { w: 1.1, captions: cap("489,359 people in the city (2020); about 1 million in the oblast (2021).", "Wikipedia, 'Kaliningrad' and 'Kaliningrad Oblast'", 24) }), Fv("kg-city-aerial", 3, { w: 1 })], { date: "KALININGRAD TODAY" }),
  V08: CUTS([Ph("kg-baltiysk-harbour", { w: 1.2, pos: "50% 40%", captions: cap("Baltiysk, the port on the Baltic.", "Wikimedia Commons", 14) }), Fv("baltic-waves", 0, { w: 1 })], { date: "BALTIC COAST" }),
  V25: CUTS([Ph("kg-kant", { w: 1.2, fit: "contain", pos: "50% 25%", captions: cap("Lived in Königsberg virtually all his life.", "Wikipedia, 'Königsberg'", 14) }), Fv("q-kaliningrad-8", 0, { w: 1 })], { date: "IMMANUEL KANT / THE CITY TODAY" }),
  V40: CUTS([Ph("kg-potsdam", { w: 1.2, captions: cap("Attlee, Truman and Stalin at the Potsdam Conference.", "Wikimedia Commons", 14) }), Ph("kg-potsdam-table", { w: 1, pos: "50% 40%" })], { date: "JULY - AUGUST 1945" }),
  V43: CUTS([Ph("kg-kalinin", { w: 1.2, fit: "contain", pos: "50% 20%", captions: cap("Renamed Kaliningrad after Mikhail Kalinin, who was unrelated to the city.", "Wikipedia, 'Kaliningrad'", 14) }), Fv("q-kaliningrad-7", 0, { w: 1 })], { date: "1946 / TODAY" }),
  V09: CUTS([Ph("kg-amber-mine", { w: 1.2, pos: "50% 60%", captions: cap("Roughly 90% of global amber deposits.", "Wikipedia, 'Kaliningrad Oblast'", 14) }), Ph("kg-amber-raw", { w: 1, fit: "contain" })], { date: "AMBER LAND" }),
  V10: CUTS([Ph("kg-castle", { w: 1.3, grade: "warm", pos: "50% 30%", captions: cap("Königsberg Castle and the monument to Emperor William I, before 1945.", "Wikimedia Commons", 12) }), Fv("q-kaliningrad-4", 0, { w: 1 })], { date: "BEFORE 1946 / TODAY" }),
  V12: CUTS([Ph("kg-malbork", { w: 1.2, pos: "50% 55%", captions: cap("The Teutonic Order established the State of the Teutonic Order, a theocracy.", "Wikipedia, 'Kaliningrad Oblast'", 14) }), Ph("kg-ordensburgen", { w: 1, fit: "contain" })], { date: "13TH CENTURY" }),
  V14: CUTS([Ph("kg-castle-1900", { w: 1.2, grade: "warm", captions: cap("Twangste was destroyed and replaced with a new fortress known as Conigsberg.", "Wikipedia, 'Königsberg'", 14) }), Ph("kg-theatrum", { w: 1, fit: "contain" })], { date: "FOUNDED 1255" }),
  V19: CUTS([Ph("kg-homage", { w: 1.3, fit: "contain", pos: "40% 50%", captions: cap("Albert of Brandenburg pays homage to King Sigismund I of Poland, 1525; painting by Jan Matejko, 1882.", "Wikipedia, 'Königsberg'", 14) }), Ph("kg-albert", { w: 1, fit: "contain" })], { date: "1525" }),
  V52: CUTS([Ph("kg-castle-ruins", { w: 1.2, fit: "contain", captions: cap("Castle ruins, 1965.", "Wikimedia Commons", 14) }), Ph("kg-castle-blast", { w: 1, fit: "contain" })], { date: "1965" }),
  V54: CUTS([Ph("kg-2plus4", { w: 1.2, fit: "contain", captions: cap("The borders left open at Potsdam were settled.", "Wikipedia, 'Königsberg'", 14) }), Ph("kg-2plus4-talks", { w: 1, fit: "contain" })], { date: "12 SEPTEMBER 1990" }),
  V62: CUTS([Fv("kg-city-aerial", 3, { w: 1 }), Fv("q-kaliningrad-3", 3, { w: 1 }), Fv("q-baltic-amber", 0, { w: 1 })], { date: "KALININGRAD OBLAST TODAY", captions: cap("1996: special economic status, with tax incentives. 2022: gross regional product about US$10.6 billion.", "Wikipedia, 'Kaliningrad Oblast'", 24) }),
  V80: CUTS([Fv("q-baltic-sunset", 0, { w: 1 }), Ph("kg-cathedral-night", { w: 1, captions: cap("The coronation city of the Prussian monarchy.", "Wikipedia, 'Kaliningrad'", 14) }), Fv("q-kaliningrad-7", 4, { w: 1 }), Fv("kg-coast-storm", 0, { w: 1 })], { date: "KALININGRAD" }),
};
// V62's figures (1996 / US$10.6 bn) now live in the caption; the v2 figures card is replaced because a figures card cannot carry video.
const beats = E2.beats.map((b) => (OVER[b.id] ? { ...b, src: [...new Set([...b.src, "PIX"])], scene: OVER[b.id] } : b));
export const EPISODE = { ...E2, slug: "kaliningrad-v3", beats, thumbs: [{ name: "thumb1-kaliningrad-v3", big: "Russia owns\na piece of\nGermany", small: "Kaliningrad", image: "lf2/hidden-past/kg-castle-1900.jpg" }] };
