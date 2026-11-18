// Hidden Past long-form, reference clone of 18 Nov 2026: "Norman Conquest: Battle of Hastings 1066".
// CLONE of Epic History TV, "Napoleonic Wars: Battle of Austerlitz 1805" (bhQe2cjr5XQ, 6.5M views). Spec: channel-reverse/spec/CLONE-SPEC.md. Its formula, kept in order:
//   text cards on black -> a dated scene ("In December 1804, in the Cathedral of Notre Dame...") -> the claimants / coalition on a flat-colour map with portrait plates
//   -> the campaign on the map -> an order-of-forces card -> the battle in phases (map, then period art between phases) -> a casualty card -> consequences on the map
//   -> a closing line -> the red credits card. Calm narration, no questions to the viewer, past tense, dates and places.
// Facts: ONLY the Wikipedia articles snapshotted in data/longform/hidden-past/hastings/*.wiki (Battle of Hastings, Battle of Stamford Bridge, Battle of Fulford),
// retrieved 18 Nov 2026. Coordinates: Wikipedia API (coords.json). Realm outlines: OpenStreetMap (MODERN boundaries, said on screen). Where the sources contradict
// each other (Harold's death, the feigned flights, the site of the English line) the narration says so instead of choosing.
// Art: the Bayeux Tapestry (public domain photographs on Commons) and Horace Vernet's 1828 painting. Both are depictions, not records, and are captioned that way.
import { readFileSync } from "node:fs";

const GEO = JSON.parse(readFileSync(new URL("../../../../data/longform/hidden-past/hastings/hastings-geo.json", import.meta.url), "utf8"));
const CO = JSON.parse(readFileSync(new URL("../../../../data/longform/hidden-past/hastings/coords.json", import.meta.url), "utf8"));
const att = JSON.parse(readFileSync(new URL("../../../../src/skills/remotion-render/public/lf2/hidden-past/ATTRIBUTIONS.json", import.meta.url), "utf8"));
const A = (id) => `lf2/hidden-past/${att[id].file}`, AC = (id) => att[id].credit_line;
const P = { York: CO["York"], Stamford: CO["Stamford Bridge, East Riding of Yorkshire"], London: CO["London"], Pevensey: CO["Pevensey"], Hastings: CO["Hastings"], Valery: CO["Saint-Valery-sur-Somme"], Abbey: CO["Battle Abbey"], Battle: CO["Battle, East Sussex"], Orkney: CO["Orkney"], Wallingford: CO["Wallingford, Oxfordshire"], Southwark: CO["Southwark"], Berkhamsted: CO["Berkhamsted"], Westminster: CO["Westminster Abbey"] };
const W = (t, slug) => ({ title: `Wikipedia: ${t}`, url: `https://en.wikipedia.org/wiki/${slug}`, retrieved: "2026-11-18" });

export const SOURCES = {
  HA: W("Battle of Hastings", "Battle_of_Hastings"), SB: W("Battle of Stamford Bridge", "Battle_of_Stamford_Bridge"), FU: W("Battle of Fulford", "Battle_of_Fulford"),
  COORDS: { title: "Coordinates: Wikipedia API (prop=coordinates)", url: "https://en.wikipedia.org/w/api.php", retrieved: "2026-11-18" },
  OSM: { title: "Realm outlines: modern boundaries of England, Normandy and Norway from OpenStreetMap via Nominatim (c) OpenStreetMap contributors, ODbL", url: "https://www.openstreetmap.org/copyright", retrieved: "2026-11-18" },
  ART: { title: "Bayeux Tapestry photographs and Horace Vernet (1828), public domain via Wikimedia Commons (credits on screen; public/lf2/hidden-past/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/", retrieved: "2026-11-18" },
  IMG: { title: "Map imagery: NASA Blue Marble (public domain); Sentinel-2 cloudless 2016 by EOX (CC BY 4.0), contains modified Copernicus Sentinel data", url: "https://s2maps.eu", retrieved: "2026-11-18" },
  EPIC: { title: "Structure reference (not a fact source): Epic History TV, Napoleonic Wars: Battle of Austerlitz 1805", url: "https://www.youtube.com/watch?v=bhQe2cjr5XQ", retrieved: "2026-11-18" },
};

// the campaign map: muted Blue Marble, realms in flat colour (modern outlines, stated), serif labels, routes as arrows
const REALMS = (from = 0, k = 1) => [
  { id: "eng", data: GEO.england, color: "england", opacity: 0.55 * k, outline: true, from, dur: 20 },
  { id: "nor", data: GEO.normandy, color: "normandy", opacity: 0.6 * k, outline: true, from: from + 20, dur: 20 },
  { id: "nrw", data: GEO.norway, color: "norway", opacity: 0.55 * k, outline: true, from: from + 40, dur: 20 },
];
const WIDE = { center: [2.4, 53.2], zoom: 4.15, pitch: 0, bearing: 0 };
const SOUTH = { center: [0.6, 51.3], zoom: 6.6, pitch: 20, bearing: 0 };
const NORTH = { center: [-0.6, 53.4], zoom: 5.6, pitch: 18, bearing: 0 };
const L = (at, text, kind = "place", from = 20, dx, dy) => ({ at, text, kind, from, dx, dy });
const MAPNOTE = { text: "Outlines are modern boundaries, shown only to locate the realms of 1066.", source: "OpenStreetMap", from: 30 };
const mapScene = (o) => ({ type: "epmap", base: "bluemarble", terrain: 0, credit: "NASA Blue Marble (public domain) · outlines © OpenStreetMap contributors", ...o });
// the battlefield: real terrain at Battle, East Sussex (Sentinel-2 + elevation), with a SCHEMATIC of the two armies: the sources disagree on the exact site
const FIELD = { center: [P.Abbey[0], P.Abbey[1] - 0.0032], zoom: 15.3, pitch: 32, bearing: 0 };
const fieldScene = (o) => ({ type: "epmap", base: "s2", terrain: 1.6, credit: "Sentinel-2 cloudless 2016 by EOX (CC BY 4.0) · schematic positions", tags: [{ text: "Schematic: exact positions are disputed", x: 1180, y: 70, from: 10 }], grade: { saturation: -0.15, brightnessMax: 0.95 }, ...o });
const ENG_LINE = [[P.Abbey[0] - 0.0035, P.Abbey[1] - 0.0004], [P.Abbey[0] + 0.0035, P.Abbey[1] + 0.0002]];
const pan = (id, from, to, plates, extra = {}) => ({ type: "eppaint", image: A(id), credit: AC(id), from, to, plates, ...extra });

export const EPISODE = {
  channel: "hidden-past", slug: "hastings", title: "Norman Conquest: Battle of Hastings 1066", target_minutes: 9,
  sound: { bed: "MUSIC_DOC_WINTER", bed_rel_db: -14, dip_scenes: [] },
  beats: [
    // ---- prologue: text cards on black, then the dated scene
    { id: "N01", part: "prologue", ref: "bhQe2cjr5XQ 0:00: logo and title cards on black", src: ["HA"],
      vo: "Fourteenth of October, ten sixty-six. A ridge in Sussex, north of Hastings.",
      scene: { type: "eptitle", lines: [{ text: "The Norman Conquest", caps: true, size: 56 }, { text: "Hastings 1066", italic: true, size: 72 }] } },
    { id: "N02", part: "prologue", ref: "Epic RlKJDwViNKs: the honesty card before the story", src: ["HA"],
      vo: "Many of the accounts of what happened that day contradict each other. Where they do, we will say so.",
      scene: { type: "eptitle", rule: false, lines: [{ text: "Many of the primary accounts contradict each other.", size: 46 }, { text: "It is impossible to give an authoritative description of the battle.", italic: true, size: 40 }, { text: "Wikipedia, 'Battle of Hastings'", size: 26 }] } },
    { id: "N03", part: "a crown with no heir", ref: "bhQe2cjr5XQ 0:10: the dated scene that opens the story", src: ["HA", "ART"],
      vo: "On the fifth of January ten sixty-six, King Edward of England died with no clear heir. The richest and most powerful noble in the kingdom, Harold Godwinson, Earl of Wessex, was elected king and crowned.",
      scene: pan("hs-coronation", { x: 30, y: 50, s: 1.08 }, { x: 62, y: 45, s: 1.2 }, [{ name: "Harold Godwinson", role: "Elected king, January 1066 · as the Bayeux Tapestry shows him", from: 90 }]) },
    // ---- the claimants
    { id: "N04", part: "three claimants", ref: "bhQe2cjr5XQ 1:03: the coalition laid out on the political map", src: ["HA", "OSM", "IMG"],
      vo: "He was challenged at once by two powerful neighbours. Across the Channel, William, Duke of Normandy. Across the North Sea, Harald Hardrada, King of Norway.",
      scene: mapScene({ views: [{ ...WIDE, f: 0 }, { ...WIDE, f: 240, zoom: 4.3 }], fills: REALMS(10), labels: [L([-1.6, 52.6], "England", "country", 20), L(CO["Normandy"], "Normandy", "country", 40), L([8.5, 61.5], "Norway", "country", 60), L([3.2, 56.3], "North Sea", "water", 30)], captions: [MAPNOTE] }) },
    { id: "N05", part: "three claimants", ref: "bhQe2cjr5XQ: each claimant gets a portrait plate and his claim", src: ["HA", "ART"],
      vo: "William claimed that Edward had promised him the throne, and that Harold had sworn to support that promise. The Bayeux Tapestry, probably commissioned by Odo, Bishop of Bayeux, soon after the battle, shows Harold swearing an oath to William.",
      scene: pan("hs-oath", { x: 25, y: 50, s: 1.06 }, { x: 70, y: 50, s: 1.16 }, [{ name: "William, Duke of Normandy", role: "Claimed Edward promised him the crown", from: 60 }]) },
    { id: "N06", part: "three claimants", ref: "bhQe2cjr5XQ: the second claimant, on the map", src: ["HA", "OSM", "IMG"],
      vo: "Hardrada's claim rested on an agreement between his predecessor, Magnus the Good, and an earlier king of England, Harthacnut. Whichever of them died without an heir, the other would inherit both kingdoms. Both William and Hardrada began to gather ships.",
      scene: mapScene({ views: [{ ...WIDE, f: 0, center: [5, 58], zoom: 4.6 }, { ...WIDE, f: 300, center: [3, 56], zoom: 4.4 }], fills: REALMS(0), labels: [L([8.5, 61.5], "Norway", "country", 10), L([-1.6, 52.6], "England", "country", 30)], plates: [{ name: "Harald Hardrada", role: "King of Norway · claimant", from: 40, x: 1250, y: 860 }] }) },
    { id: "N07", part: "three claimants", ref: "bhQe2cjr5XQ: period art between map passages", src: ["HA", "ART"],
      vo: "In April, Halley's Comet appeared in the sky and was reported across Europe. Accounts at the time connected it with the fight for the English crown.",
      scene: pan("hs-comet", { x: 20, y: 40, s: 1.1 }, { x: 45, y: 35, s: 1.22 }, [{ name: "April 1066", role: "The comet, as the Bayeux Tapestry shows it", from: 40 }]) },
    // ---- the north
    { id: "N08", part: "invasion from the north", ref: "bhQe2cjr5XQ 2:57: the campaign drawn as routes", src: ["HA", "SB", "OSM", "IMG"],
      vo: "Harold spent the summer on the south coast with an army and a fleet, waiting for William. But most of his men were militia who had harvests to bring in. On the eighth of September he sent the militia and the fleet home.",
      scene: mapScene({ views: [{ ...SOUTH, f: 0 }, { ...SOUTH, f: 300, zoom: 6.3 }], fills: REALMS(0, 0.3).slice(0, 2), points: [{ id: "lon", at: P.London, color: "england", from: 20 }], labels: [L(P.London, "London", "place", 24, 16, -26), L([0.2, 50.6], "English Channel", "water", 30)], tags: [{ text: "8 September: militia and fleet sent home", x: 1050, y: 160, from: 120 }] }) },
    { id: "N09", part: "invasion from the north", ref: "bhQe2cjr5XQ: the invasion route, arrows", src: ["HA", "SB", "FU", "OSM", "IMG", "COORDS"],
      vo: "That same month, Hardrada invaded the north with more than three hundred ships, carrying perhaps fifteen thousand men, joined by Harold's own exiled brother, Tostig. On the twentieth of September, at Fulford, just south of York, they defeated the northern earls and took the city.",
      scene: mapScene({ views: [{ ...WIDE, f: 0, center: [1.5, 57], zoom: 4.6 }, { ...NORTH, f: 330 }], fills: REALMS(0), lines: [{ id: "hh", coords: [[4.6, 60.0], [-2.6, 59.2], [-1.4, 57.4], [0.2, 54.6], P.York], color: "norway", width: 5, from: 30, dur: 160, arrow: true }], points: [{ id: "yk", at: P.York, color: "norway", pulse: true, from: 190 }], labels: [L(P.Orkney, "Orkney", "place", 80, 16, -26), L(P.York, "York · Fulford, 20 Sept", "place", 200, 16, -26)], tags: [{ text: "Route schematic", x: 1450, y: 70, from: 30 }] }) },
    { id: "N10", part: "invasion from the north", ref: "bhQe2cjr5XQ 5:56: the forced march, on the map", src: ["HA", "SB", "OSM", "IMG", "COORDS"],
      vo: "Harold rushed north, gathering men as he went, and caught the Norwegians by surprise at Stamford Bridge on the twenty-fifth of September. Hardrada and Tostig were both killed. Of the three hundred ships, only twenty-four were needed to carry the survivors home.",
      scene: mapScene({ views: [{ ...NORTH, f: 0, center: [-0.5, 52.6], zoom: 5.4 }, { ...NORTH, f: 320, center: [-0.95, 53.95], zoom: 7.4 }], fills: REALMS(0, 0.3).slice(0, 1), lines: [{ id: "hn", coords: [P.London, [-0.9, 52.6], P.York, P.Stamford], color: "england", width: 6, from: 20, dur: 150, arrow: true }], points: [{ id: "sb", at: P.Stamford, color: "england", pulse: true, from: 170 }], labels: [L(P.London, "London", "place", 10, 16, -26), L(P.Stamford, "Stamford Bridge · 25 Sept", "place", 175, 16, -26)], key_: [{ color: "#A8201A", label: "Harold", line: true }, { color: "#B98B2E", label: "Hardrada", line: true }] }) },
    { id: "N11", part: "invasion from the north", ref: "bhQe2cjr5XQ: the cost, said plainly", src: ["SB", "HA"],
      vo: "The battle has traditionally been called the end of the Viking Age. But the victory came at great cost. Harold's army was battered and weakened, and far from the south. Three days later, William landed.",
      scene: { type: "eptitle", lines: [{ text: "25 September 1066", caps: true, size: 44 }, { text: "Victory in the north, at great cost.", italic: true, size: 56 }] } },
    // ---- the landing
    { id: "N12", part: "the landing", ref: "bhQe2cjr5XQ 2:57: the other army's crossing, drawn", src: ["HA", "OSM", "IMG", "COORDS"],
      vo: "William had spent almost nine months building a fleet from nothing. He was ready to cross from Saint-Valery-sur-Somme by about the twelfth of August, but the crossing was delayed. On the twenty-eighth of September, with the English fleet gone, the Normans landed at Pevensey.",
      scene: mapScene({ views: [{ ...SOUTH, f: 0, center: [1.0, 50.6], zoom: 7.0 }, { ...SOUTH, f: 320, center: [0.5, 50.8], zoom: 8.4 }], fills: REALMS(0, 0.3).slice(0, 2), lines: [{ id: "wm", coords: [P.Valery, [1.1, 50.5], P.Pevensey], color: "normandy", width: 6, from: 40, dur: 150, arrow: true }], points: [{ id: "pv", at: P.Pevensey, color: "normandy", pulse: true, from: 190 }], labels: [L(P.Valery, "Saint-Valery-sur-Somme", "place", 30, 16, -26), L(P.Pevensey, "Pevensey · 28 Sept", "place", 195, -260, -26)] }) },
    { id: "N13", part: "the landing", ref: "bhQe2cjr5XQ: the invader settles in, on the map", src: ["HA", "OSM", "IMG", "COORDS"],
      vo: "They built a wooden castle at Hastings and raided the country around it. The exact size of William's army is unknown. Writers at the time gave figures as high as a hundred and fifty thousand. Modern historians estimate between seven and twelve thousand.",
      scene: mapScene({ views: [{ ...SOUTH, f: 0, center: [0.45, 50.86], zoom: 9.2 }, { ...SOUTH, f: 300, center: [0.55, 50.87], zoom: 10.0, pitch: 35 }], fills: REALMS(0, 0.3).slice(0, 1), points: [{ id: "hs", at: P.Hastings, color: "normandy", pulse: true, from: 20 }, { id: "pv2", at: P.Pevensey, color: "normandy", from: 10 }], labels: [L(P.Hastings, "Hastings · wooden castle", "place", 26, 16, -26), L(P.Pevensey, "Pevensey", "place", 12, -150, -26)] }) },
    { id: "N14", part: "the landing", ref: "bhQe2cjr5XQ: the order-of-battle card", src: ["HA"],
      vo: "About half of William's force was infantry, a quarter cavalry, and a quarter archers or crossbowmen. The English fought on foot: the fyrd, a levy of local landholders, and the housecarls, the king's own armoured men. They had few archers. Their numbers are unknown too, with estimates from five to thirteen thousand.",
      scene: { type: "eporder", title: "Order of forces", sides: [{ name: "Normans · William", color: "normandy", rows: [{ blocks: 4, label: "Infantry", value: "about one half" }, { blocks: 2, label: "Cavalry", value: "about one quarter" }, { blocks: 2, label: "Archers and crossbowmen", value: "about one quarter" }, { blocks: 1, label: "Total", value: "unknown · estimates 7,000 to 12,000" }] }, { name: "English · Harold", color: "england", rows: [{ blocks: 3, label: "Fyrd", value: "local levy, on foot" }, { blocks: 2, label: "Housecarls", value: "the king's armoured men, on foot" }, { blocks: 1, label: "Archers", value: "no significant number" }, { blocks: 1, label: "Total", value: "unknown · estimates 5,000 to 13,000" }] }], note: "Figures: Wikipedia, 'Battle of Hastings' (modern historians' ranges). Contemporary writers gave 14,000 to 150,000 for William's army." } },
    // ---- the battle
    { id: "N15", part: "the battle", ref: "bhQe2cjr5XQ 8:32: the battlefield in relief", src: ["HA", "IMG"],
      vo: "Harold marched south, stopped in London for about a week, and on the night of the thirteenth of October camped on Caldbec Hill. The battle began the next morning at nine o'clock, between two hills, in country that was heavily wooded, with a marsh nearby.",
      scene: fieldScene({ views: [{ ...FIELD, f: 0, zoom: 13.4, pitch: 45, bearing: -25 }, { ...FIELD, f: 330 }], points: [{ id: "ab", at: P.Abbey, color: "england", from: 60 }], labels: [L(P.Abbey, "Battle Abbey today", "place", 70, 16, -26)] }) },
    { id: "N16", part: "the battle", ref: "bhQe2cjr5XQ: the two armies deployed, schematic", src: ["HA", "IMG"],
      vo: "The English formed a shield wall along the top of a steep slope, shields close together or overlapping, their flanks protected by woods and marshy ground. Below them William drew up three divisions: Bretons on the left, Normans in the centre under William himself, French and Flemings on the right.",
      scene: fieldScene({ views: [{ ...FIELD, f: 0 }, { ...FIELD, f: 330, bearing: 6, zoom: 15.5 }], lines: [{ id: "sw", coords: ENG_LINE, color: "england", width: 26, from: 20, dur: 50 }, { id: "nl", coords: [[P.Abbey[0] - 0.006, P.Abbey[1] - 0.0055], [P.Abbey[0] - 0.0025, P.Abbey[1] - 0.006]], color: "normandy", width: 22, from: 120, dur: 30 }, { id: "nc", coords: [[P.Abbey[0] - 0.0015, P.Abbey[1] - 0.0062], [P.Abbey[0] + 0.0015, P.Abbey[1] - 0.0062]], color: "normandy", width: 22, from: 150, dur: 30 }, { id: "nr", coords: [[P.Abbey[0] + 0.0025, P.Abbey[1] - 0.006], [P.Abbey[0] + 0.006, P.Abbey[1] - 0.0055]], color: "normandy", width: 22, from: 180, dur: 30 }], labels: [L(ENG_LINE[0], "English shield wall", "place", 40, -60, -60), L([P.Abbey[0] - 0.0045, P.Abbey[1] - 0.0058], "Bretons", "place", 130, -150, 30), L([P.Abbey[0], P.Abbey[1] - 0.0062], "Normans · William", "place", 160, -110, 40), L([P.Abbey[0] + 0.0045, P.Abbey[1] - 0.0058], "French and Flemings", "place", 190, 10, 30)] }) },
    { id: "N17", part: "the battle", ref: "bhQe2cjr5XQ: the first phase, arrows on the map", src: ["HA", "IMG"],
      vo: "The Norman archers opened, shooting uphill into the shield wall, to little effect. The infantry went in next and met a storm of spears, axes and stones. The cavalry followed and could not break through either.",
      scene: fieldScene({ views: [{ ...FIELD, f: 0, zoom: 15.4, bearing: 4 }, { ...FIELD, f: 300, zoom: 15.6, bearing: 10 }], lines: [{ id: "sw2", coords: ENG_LINE, color: "england", width: 26, from: 0, dur: 1 }, { id: "a1", coords: [[P.Abbey[0] - 0.002, P.Abbey[1] - 0.006], [P.Abbey[0] - 0.0015, P.Abbey[1] - 0.0012]], color: "normandy", width: 6, from: 20, dur: 60, arrow: true, dash: [2, 1] }, { id: "a2", coords: [[P.Abbey[0] + 0.001, P.Abbey[1] - 0.006], [P.Abbey[0] + 0.0012, P.Abbey[1] - 0.0012]], color: "normandy", width: 6, from: 110, dur: 60, arrow: true }, { id: "a3", coords: [[P.Abbey[0] + 0.004, P.Abbey[1] - 0.0058], [P.Abbey[0] + 0.0032, P.Abbey[1] - 0.001]], color: "normandy", width: 8, from: 200, dur: 60, arrow: true }], tags: [{ text: "Schematic: exact positions are disputed", x: 1180, y: 70, from: 0 }, { text: "1 · archers  2 · infantry  3 · cavalry", x: 90, y: 920, from: 40 }] }) },
    { id: "N18", part: "the battle", ref: "bhQe2cjr5XQ: period art between phases", src: ["HA", "ART"],
      vo: "Then a general retreat began, blamed on the Bretons on William's left. A rumour ran through the army that William had been killed. He rode through his men with his face showing, shouting that he was alive, and led a counter-attack on the English who had chased them downhill.",
      scene: pan("hs-helmet", { x: 30, y: 50, s: 1.1 }, { x: 55, y: 40, s: 1.3 }, [{ name: "William lifts his helmet", role: "To show he was alive · Bayeux Tapestry", from: 80 }]) },
    { id: "N19", part: "the battle", ref: "bhQe2cjr5XQ: what the sources disagree on, said", src: ["HA", "ART"],
      vo: "In the afternoon, the Normans appear to have turned that into a tactic: the feigned flight, a pretend retreat to draw men out of the line. Some historians have argued the story was invented afterwards, but most agree it happened. It probably thinned the housecarls, and the fyrd filled the gaps. The wall held.",
      scene: pan("hs-cavalry", { x: 15, y: 50, s: 1.12 }, { x: 85, y: 50, s: 1.12 }, [{ name: "The feigned flight", role: "Disputed by some historians · most agree it was used", from: 90 }]) },
    { id: "N20", part: "the death of a king", ref: "bhQe2cjr5XQ: the decisive moment", src: ["HA", "ART"],
      vo: "Late in the day, Harold was killed. How, nobody can say for certain. The Bayeux Tapestry shows a man pulling an arrow from his eye beside a man cut down by a sword, under the words: Here King Harold has been killed. It does not say which one is Harold.",
      scene: pan("hs-death", { x: 30, y: 45, s: 1.05 }, { x: 60, y: 40, s: 1.35 }, [{ name: "Hic Harold Rex interfectus est", role: "'Here King Harold has been killed' · Bayeux Tapestry", from: 150 }]) },
    { id: "N21", part: "the death of a king", ref: "bhQe2cjr5XQ: the competing accounts on one card", src: ["HA"],
      vo: "The story of the arrow in the eye first appears in writing in the ten-eighties, in a history by an Italian monk. Another chronicle says William killed Harold himself, which is unlikely. The chronicle of Battle Abbey says simply that no one knew who killed him.",
      scene: { type: "eptitle", rule: false, lines: [{ text: "How did Harold die?", caps: true, size: 46 }, { text: "An arrow to the eye: first written in the 1080s, Amatus of Montecassino.", size: 38, italic: true }, { text: "Killed by William himself: the Carmen. Unlikely.", size: 38, italic: true }, { text: "'No one knew who killed him': the Chronicle of Battle Abbey.", size: 38, italic: true }] } },
    { id: "N22", part: "the death of a king", ref: "bhQe2cjr5XQ: the collapse, on the map", src: ["HA", "IMG"],
      vo: "With the king dead, the English began to collapse. Many fled. The men of the royal household gathered around Harold's body and fought to the end. A last stand at a place remembered as the Malfosse, the evil ditch, wounded Count Eustace of Boulogne before it too was overrun.",
      scene: fieldScene({ views: [{ ...FIELD, f: 0, zoom: 15.5, bearing: 8 }, { ...FIELD, f: 330, zoom: 14.6, bearing: -15, pitch: 40 }], lines: [{ id: "sw3", coords: ENG_LINE, color: "england", width: 26, from: 0, dur: 1 }, { id: "br", coords: [[P.Abbey[0] - 0.003, P.Abbey[1] - 0.004], [P.Abbey[0] - 0.0005, P.Abbey[1] - 0.0002], [P.Abbey[0] + 0.0015, P.Abbey[1] + 0.003]], color: "normandy", width: 9, from: 30, dur: 90, arrow: true }], points: [{ id: "hd", at: P.Abbey, color: "england", pulse: true, from: 120 }], labels: [L(P.Abbey, "Where Harold fell, by 12th-century tradition", "place", 130, 16, -26)] }) },
    { id: "N23", part: "the death of a king", ref: "bhQe2cjr5XQ 14:25: the casualty card", src: ["HA"],
      vo: "How many died is unknown. Among the English known to have fought, about half were killed, though that may be too high. One in seven of the named Norman nobles died. One historian, Peter Marren, guesses at perhaps two thousand Normans and four thousand English.",
      scene: { type: "epcasualty", rows: [{ label: "Total killed", value: "unknown" }, { label: "English known to have fought", value: "about 1 in 2 killed (may be too high)" }, { label: "Named Norman nobles", value: "1 in 7 killed" }, { label: "Peter Marren's guess", value: "~2,000 Normans · ~4,000 English" }], note: "Wikipedia, 'Battle of Hastings'. Contemporary figures are highly exaggerated." } },
    // ---- aftermath
    { id: "N24", part: "aftermath", ref: "bhQe2cjr5XQ: the human aftermath, period painting", src: ["HA", "ART"],
      vo: "The next day Harold's body was identified, by his armour or by marks on his body. A twelfth-century tradition says his face could not be recognised, and that Edith, his common-law wife, was brought to the field to find him by marks only she knew.",
      scene: pan("hs-vernet", { x: 40, y: 55, s: 1.05 }, { x: 62, y: 72, s: 1.25 }, [{ name: "Edith finds Harold", role: "Horace Vernet, 1828 · a legend, painted over 750 years later", from: 100 }], { fit: "cover" }) },
    { id: "N25", part: "aftermath", ref: "bhQe2cjr5XQ 14:25: consequences on the map", src: ["HA", "OSM", "IMG", "COORDS"],
      vo: "England did not surrender at once. The surviving leaders proclaimed the young Edgar Atheling king. William marched on London, was held at London Bridge, and went the long way round: west to cross the Thames at Wallingford, then towards the city from the north-west. At Berkhamsted the English leaders submitted.",
      scene: mapScene({ views: [{ ...SOUTH, f: 0, center: [-0.2, 51.2], zoom: 7.2 }, { ...SOUTH, f: 360, center: [-0.5, 51.55], zoom: 7.9 }], fills: REALMS(0, 0.3).slice(0, 1), lines: [{ id: "wl", coords: [P.Hastings, [0.9, 51.1], P.Southwark, P.Wallingford, P.Berkhamsted], color: "normandy", width: 6, from: 20, dur: 220, arrow: true }], points: [{ id: "bk", at: P.Berkhamsted, color: "normandy", pulse: true, from: 240 }], labels: [L(P.Southwark, "Southwark", "place", 80, 16, -26), L(P.Wallingford, "Wallingford", "place", 150, -190, -26), L(P.Berkhamsted, "Berkhamsted · submission", "place", 245, 16, -26)], tags: [{ text: "Route schematic", x: 1450, y: 70, from: 20 }] }) },
    { id: "N26", part: "aftermath", ref: "bhQe2cjr5XQ: the dated outcome", src: ["HA"],
      vo: "On Christmas Day ten sixty-six, William was crowned King of England in Westminster Abbey, by Ealdred, the same archbishop who had crowned Harold less than a year before.",
      scene: { type: "eptitle", lines: [{ text: "25 December 1066", caps: true, size: 46 }, { text: "William is crowned in Westminster Abbey.", italic: true, size: 58 }] } },
    { id: "N27", part: "aftermath", ref: "bhQe2cjr5XQ: the longer consequences", src: ["HA", "ART"],
      vo: "Resistance went on for years: rebellions in Exeter, in the south and west, and in Northumbria, and a Danish fleet. William put them down ruthlessly, ending in the Harrying of the North in the winter of ten sixty-nine. He founded an abbey on the battlefield. Its high altar, later writers said, stood where Harold fell.",
      scene: pan("hs-coronation", { x: 75, y: 50, s: 1.2 }, { x: 40, y: 50, s: 1.08 }, [{ name: "1067 to 1070", role: "Rebellions, and the Harrying of the North", from: 60 }]) },
    { id: "N28", part: "epilogue", ref: "bhQe2cjr5XQ: the closing line", src: ["HA"],
      vo: "Some of the English who fought that day left England altogether, and joined the Varangian Guard of the emperor in Constantinople. In ten eighty-one, at Dyrrhachium, they faced the Normans again. And again, they were defeated.",
      scene: { type: "eptitle", lines: [{ text: "Dyrrhachium, 1081", caps: true, size: 46 }, { text: "The English and the Normans met again.", italic: true, size: 58 }] } },
    { id: "N29", part: "epilogue", ref: "bhQe2cjr5XQ: the red credits card", src: ["HA", "SB", "FU", "OSM", "ART", "IMG"],
      vo: "Every fact in this video comes from the sources on screen.",
      scene: { type: "epcredits", lines: ["Wikipedia: Battle of Hastings · Battle of Stamford Bridge · Battle of Fulford (retrieved 18 November 2026)", "Bayeux Tapestry photographs: Myrabella; Université de Caen Normandie / CNRS / ENSICAEN · public domain, via Wikimedia Commons", "Horace Vernet, Edith finds Harold's body (1828) · public domain, via Wikimedia Commons", "Maps: NASA Blue Marble (public domain) · Sentinel-2 cloudless 2016 by EOX (CC BY 4.0) · outlines © OpenStreetMap contributors (modern boundaries)", "Battle positions are schematic: the sources disagree on the exact site"] } },
  ],
  thumbs: [
    { name: "thumb1-laststand", type: "epthumb", series: "Battle of Hastings", big: [{ text: "Harold's" }, { text: "Last Day", dark: true }], year: "1066", bg: A("hs-vernet"), bgPos: "50% 60%", cut: { src: "lf2/hidden-past/hs-vernet-cutout-hs.png", x: 860, bottom: 0, h: 1040 }, credit: "Horace Vernet, 1828 · public domain" },
    { name: "thumb2-conquest", type: "epthumb", series: "Norman Conquest", big: [{ text: "Harold" }, { text: "vs William", dark: true }], year: "1066", bg: A("hs-cavalry"), bgPos: "40% 50%", cut: { src: "lf2/hidden-past/hs-vernet-cutout-hs.png", x: 900, bottom: 0, h: 1000 }, credit: "Bayeux Tapestry; Horace Vernet, 1828 · public domain" },
  ],
};
