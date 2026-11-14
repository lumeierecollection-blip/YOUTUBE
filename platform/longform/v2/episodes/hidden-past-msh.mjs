// Hidden Past long form: "Why Mount St. Helens Exploded Sideways" (the 18 May 1980 eruption). Visual identity: RealLifeLore, "Why The Nepal Flood Was WAY Scarier Than You Think"
// (WiRLNEl-4bk, the highest-viewed fixed reference for this channel, 2.33M views): cold open on real footage with its credit on screen, stacked sourced numbers in the first two
// minutes, a turn to "how it began", then terrain and the evidence, source-worded caption boxes. See docs/longform/WINNERS-AND-SOURCING.md.
// Every narration line is built from the text of the two Wikipedia articles saved in data/longform/hidden-past/msh/. Pictures: USGS photographs (public domain, Commons) and shots from a
// 1986 USDA Forest Service film held by the National Archives (public domain), cut into clips in public/lf2/hidden-past/clips/. Map: EOX Sentinel-2 cloudless + Mapzen terrain.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const A = (id) => `lf2/hidden-past/${id}.jpg`;
const V = (id) => `lf2/hidden-past/clips/${id}.mp4`;
const CRED = "USDA Forest Service film (1986), via National Archives · public domain · shot dates not labelled";

export const SOURCES = {
  W1: { title: "1980 eruption of Mount St. Helens", url: "https://en.wikipedia.org/wiki/1980_eruption_of_Mount_St._Helens", retrieved: "2026-11-13" },
  W2: { title: "Mount St. Helens", url: "https://en.wikipedia.org/wiki/Mount_St._Helens", retrieved: "2026-11-13" },
  NARA: { title: "Eruption of Mount St. Helens, 1980 (USDA Forest Service film, 1986), National Archives ARC 13364", url: "https://commons.wikimedia.org/wiki/File:Eruption_of_Mount_St._Helens,_1980.ogv", retrieved: "2026-11-13" },
  USGS: { title: "USGS photographs on Wikimedia Commons (see public/lf2/hidden-past/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/wiki/Category:Photographs_of_the_1980_eruption_of_Mount_St._Helens", retrieved: "2026-11-13" },
  EOX: { title: "Sentinel-2 cloudless imagery by EOX (CC BY 4.0), contains modified Copernicus Sentinel data; elevation: Mapzen terrain tiles", url: "https://s2maps.eu", retrieved: "2026-11-13" },
};

// place coordinates: Wikipedia articles (mountain, Spirit Lake, Castle Rock) and the death-site coordinates in the 1980 article
const MSH = [-122.1944, 46.1912], SPIRIT = [-122.135, 46.27306], CASTLE = [-122.89667, 46.26278], COLDWATER = [-122.22444, 46.27708];
// the blast fan, drawn from the STATED size only (fan-shaped area 31 km long, 37 km across; direct blast zone about 13 km radius). Approximate, and labelled so on screen.
const fan = (radiusKm, halfDeg) => {
  const kmLat = 111.2, kmLon = 111.2 * Math.cos((MSH[1] * Math.PI) / 180), ring = [MSH];
  for (let a = -halfDeg; a <= halfDeg; a += 4) { const r = (a * Math.PI) / 180; ring.push([MSH[0] + (radiusKm * Math.sin(r)) / kmLon, MSH[1] + (radiusKm * Math.cos(r)) / kmLat]); }
  ring.push(MSH);
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] };
};
const half = (Math.asin(18.5 / 31) * 180) / Math.PI; // 36.6 degrees each side of north gives a chord of 37 km at 31 km

export const EPISODE = {
  channel: "hidden-past", slug: "msh-1980", title: "Why Mount St. Helens Exploded Sideways", target_minutes: 6,
  beats: [
    // ---- COLD OPEN (ref WiRLNEl-4bk: real footage first, credit on screen, source-worded caption box, then stacked numbers)
    { id: "M01", part: "cold open", ref: "WiRLNEl-4bk 0:00: authentic footage first, the source credit stays on screen, a caption box in the source's own words", src: ["W1", "NARA"], frames: [60],
      vo: "At 8:32 on the morning of the eighteenth of May, 1980, Mount St. Helens, in Washington State, exploded. It is often considered the most disastrous volcanic event in the history of the United States.",
      scene: { type: "footage", video: V("msh-eruption-seq"), videoLen: 10, credit: CRED, captions: [{ text: "On May 18, 1980, at 8:32 a.m., Mount St. Helens in Skamania County, Washington, United States, experienced a catastrophic explosive eruption.", source: "Wikipedia, '1980 eruption of Mount St. Helens'", from: 20 }] } },
    { id: "M02", part: "cold open", ref: "WiRLNEl-4bk 1:24: the figures stacked one after another, each with its source", src: ["W1", "USGS"], frames: [150],
      vo: "About fifty-seven people died. About two hundred and thirty square miles of forest were flattened. An ash column rose fifteen miles into the sky, and the damage came to more than a billion dollars.",
      scene: { type: "figures", image: A("msh-plume-0518"), title: "18 May 1980", rows: [{ value: "57", label: "people killed" }, { value: "230", label: "square miles of forest knocked down (600 km²)" }, { value: "15", label: "miles high: the ash column (24 km)" }, { value: "$1bn+", label: "in damage", source: "Source: Wikipedia, '1980 eruption of Mount St. Helens'" }] } },
    { id: "M03", part: "cold open", ref: "WiRLNEl-4bk 2:40: the pivot, 'the most terrifying part is how it began'", src: ["W1", "NARA"], frames: [60],
      vo: "But the strangest part is how it began. For weeks, scientists had watched the north side of the mountain swell. At six that morning, their measurements showed nothing unusual.",
      scene: { type: "footage", video: V("msh-crater"), videoLen: 7.8, credit: CRED, captions: [{ text: "At 6:00 am Johnston's measurements did not indicate any unusual activity.", source: "Wikipedia, '1980 eruption of Mount St. Helens'", from: 130 }] } },
    // ---- THE WARNING
    { id: "M04", part: "the warning", ref: "U_UoAZrOTNU / WiRLNEl-4bk 4:43: the place, on a terrain map with a small uppercase label", src: ["W1", "W2", "EOX"], frames: [150],
      vo: "Mount St. Helens had been dormant since the 1850s. On the twentieth of March, 1980, a magnitude 4.2 earthquake beneath its north flank ended 123 years of silence.",
      scene: { type: "map", base: "s2", terrain: 1.2, date: "20 MARCH 1980", views: [{ f: 0, center: [-122.3, 46.25], zoom: 8.2, pitch: 0, bearing: 0 }, { f: 260, center: [-122.2, 46.2], zoom: 10.4, pitch: 48, bearing: -18 }],
        points: [{ id: "msh", at: MSH, pulse: true, from: 60 }], labels: [{ at: MSH, text: "Mount St. Helens", kind: "place", dx: 120, dy: 26, from: 70 }, { at: SPIRIT, text: "Spirit Lake", kind: "water", from: 130 }],
        tags: [{ text: "Magnitude 4.2 · 20 March 1980", x: 1130, y: 640, from: 110 }] } },
    { id: "M05", part: "the warning", ref: "WiRLNEl-4bk: authentic dated picture with the source's words in a lower-third box", src: ["W1", "USGS"], frames: [120],
      vo: "A week later, on the twenty-seventh of March, steam explosions blasted out a new crater and threw ash about two kilometres into the air. By the seventh of April, the crater was five hundred and twenty metres long and a hundred and fifty metres deep.",
      scene: { type: "footage", image: A("msh-early-0410"), date: "10 APRIL 1980", captions: [{ text: "…phreatic eruptions … excavating a new crater 250 feet (75 m) wide, and sending an ash column about 7,000 feet (2.1 km) into the air.", source: "Wikipedia, '1980 eruption of Mount St. Helens'", from: 100 }] } },
    { id: "M06", part: "the warning", ref: "WiRLNEl-4bk: unfamiliar size stated as measured figures", src: ["W1", "USGS"], frames: [150],
      vo: "Magma was pushing in beneath the north face. A section a mile and a half wide bulged outward, growing five to six feet a day, until by mid-May it stuck out more than four hundred feet.",
      scene: { type: "figures", image: A("msh-bulge-0427"), title: "The bulge", rows: [{ value: "1.5 mi", label: "wide: the section of the north face pushed outward (2.4 km)" }, { value: "5-6 ft", label: "growth per day in April and May (1.5 to 1.8 m)" }, { value: "400+ ft", label: "how far it extended north by mid-May (120 m)", source: "Source: Wikipedia, '1980 eruption of Mount St. Helens'" }] } },
    { id: "M07", part: "the warning", ref: "WiRLNEl-4bk: the warning in the source's own words", src: ["W1", "NARA"], frames: [60],
      vo: "On the thirtieth of April, geologists announced that the greatest immediate danger was the bulge sliding away, and that such a landslide might set off an eruption. The governor had declared a state of emergency, and a red zone was closed around the mountain.",
      scene: { type: "footage", video: V("msh-plume-far"), videoLen: 10, credit: CRED, captions: [{ text: "Geologists announced on April 30 that sliding of the bulge area was the greatest immediate danger and that such a landslide might spark an eruption.", source: "Wikipedia, '1980 eruption of Mount St. Helens'", from: 60 }] } },
    // ---- THE MORNING
    { id: "M08", part: "the morning", ref: "WiRLNEl-4bk 3:01: the time stated, the place named", src: ["W1", "EOX"], frames: [180],
      vo: "On the morning of the eighteenth of May, David Johnston, a US Geological Survey volcanologist, was on duty at an observation post about ten kilometres north of the volcano. At 8:32, a magnitude 5.1 earthquake struck directly beneath the north slope.",
      scene: { type: "map", base: "s2", terrain: 1.2, date: "18 MAY 1980 · 8:32 A.M.", views: [{ f: 0, center: [-122.2, 46.24], zoom: 10.6, pitch: 40, bearing: 0 }, { f: 300, center: [-122.2, 46.23], zoom: 11.2, pitch: 55, bearing: 0 }],
        points: [{ id: "msh", at: MSH, pulse: true, from: 90 }, { id: "cw", at: COLDWATER, from: 20 }], labels: [{ at: COLDWATER, text: "Coldwater II observation post", kind: "place", dx: -230, dy: -30, from: 24 }, { at: MSH, text: "Mount St. Helens", kind: "place", dx: 120, dy: 26, from: 40 }],
        tags: [{ text: "Magnitude 5.1 · directly beneath the north slope", x: 1090, y: 330, from: 150 }] } },
    { id: "M09", part: "the morning", ref: "WiRLNEl-4bk: the event, the source's superlative as a caption", src: ["W1", "USGS"], frames: [90],
      vo: "Seven to twenty seconds later, the whole weakened north face slid away. It was the largest landslide in recorded history, moving at up to two hundred and fifty kilometres an hour.",
      scene: { type: "footage", image: A("msh-post-0518"), date: "18 MAY 1980", fit: "contain", captions: [{ text: "…the entire weakened north face to slide away, a sector collapse which was the largest subaerial landslide in recorded history.", source: "Wikipedia, '1980 eruption of Mount St. Helens'", from: 80 }] } },
    { id: "M10", part: "the morning", ref: "WiRLNEl-4bk 3:38: scale given as measured figures", src: ["W1", "USGS"], frames: [150],
      vo: "Most of it poured into the valley of the North Fork Toutle River. The rubble was seventeen miles long, and on average a hundred and fifty feet thick.",
      scene: { type: "figures", image: A("msh-debris-0916"), title: "The landslide", rows: [{ value: "17 mi", label: "long: the rubble deposit (27 km)" }, { value: "150 ft", label: "thick on average (46 m)" }, { value: "0.7 mi³", label: "the volume of the deposit (2.9 km³)", source: "Source: Wikipedia, '1980 eruption of Mount St. Helens'" }] } },
    { id: "M11", part: "the morning", ref: "WiRLNEl-4bk: the footage carries the moment, the caption carries the source", src: ["W1", "NARA"], frames: [60],
      vo: "Then the gas-charged magma, suddenly released from the weight above it, exploded. The blast burst sideways, to the north. It began at about three hundred and fifty kilometres an hour, and within moments reached about a thousand and eighty.",
      scene: { type: "footage", video: V("msh-aerial-column"), videoLen: 5, credit: CRED, captions: [{ text: "Initially moving about 220 mph (350 km/h), the blast quickly accelerated to around 670 mph (1,080 km/h), and it may have briefly passed the speed of sound.", source: "Wikipedia, '1980 eruption of Mount St. Helens'", from: 90 }] } },
    { id: "M12", part: "the morning", ref: "FA-oEtccS_k: one relief map, the affected zone filled in one colour, a small key bottom-left", src: ["W1", "EOX"], frames: [220],
      vo: "At its source the blast lasted no more than about thirty seconds. It flattened a fan-shaped area thirty-seven kilometres across and thirty-one long. Two hundred and thirty square miles of forest were knocked down.",
      scene: { type: "map", base: "s2", terrain: 0, date: "18 MAY 1980", views: [{ f: 0, center: [-122.2, 46.3], zoom: 8.9, pitch: 0, bearing: 0 }, { f: 300, center: [-122.2, 46.31], zoom: 9.5, pitch: 25, bearing: 0 }],
        fills: [{ id: "far", data: fan(31, half), color: "#D7263D", opacity: 0.3, outline: "#ff6b7d", from: 40, dur: 40 }, { id: "near", data: fan(13, half), color: "#D7263D", opacity: 0.45, outline: "#ff6b7d", from: 70, dur: 40 }],
        points: [{ id: "msh", at: MSH, pulse: true, from: 20 }], labels: [{ at: MSH, text: "Mount St. Helens", kind: "place", dx: 120, dy: 26, from: 24 }],
        key_: [{ color: "#D7263D", label: "Blast fan, approximate: drawn from the stated size (31 km long, 37 km across), not a survey" }] } },
    { id: "M13", part: "the morning", ref: "WiRLNEl-4bk 1:24: the human cost, stated plainly with the source", src: ["W1", "USGS"], frames: [90],
      vo: "Most of the fifty-seven people who died succumbed to asphyxiation. They included the volcanologist David Johnston, six miles north of the mountain, and the photographers Reid Blackburn and Robert Landsburg. Landsburg protected his film with his body, and his photographs gave geologists a record of the eruption.",
      scene: { type: "footage", image: A("msh-johnston-0910"), date: "10 SEPTEMBER 1980", captions: [{ text: "He was able to protect his film with his body, and the surviving photos provided geologists with valuable documentation of the historic eruption.", source: "Wikipedia, '1980 eruption of Mount St. Helens'", from: 180 }] } },
    // ---- THE FLOODS AND AFTER
    { id: "M14", part: "after", ref: "WiRLNEl-4bk: the second wave of the disaster, shown on real footage", src: ["W1", "NARA"], frames: [60],
      vo: "The heat melted the mountain's glaciers and most of its snow, and mudflows began to move as early as 8:50. They reached the Columbia River, nearly fifty miles away. At the Columbia the mud made the channel twenty-five feet shallower for four miles, and temporarily closed it to ocean-going freighters.",
      scene: { type: "footage", video: V("msh-bridge-flood"), videoLen: 10, credit: CRED, captions: [{ text: "By 2:30 pm the massive mudflow had destroyed Camp Baker, and in the following hours, seven bridges were carried away.", source: "Wikipedia, '1980 eruption of Mount St. Helens'", from: 150 }] } },
    { id: "M15", part: "after", ref: "WiRLNEl-4bk 27:21: the losses as stacked figures", src: ["W1", "USGS"], frames: [150],
      vo: "In total, the eruption destroyed two hundred houses, forty-seven bridges, fifteen miles of railway and a hundred and eighty-five miles of highway. The mountain lost about thirteen per cent of its cone, and its summit dropped by roughly four hundred metres.",
      scene: { type: "figures", image: A("msh-mailboxes"), title: "What was lost", rows: [{ value: "200", label: "houses destroyed" }, { value: "47", label: "bridges destroyed" }, { value: "185 mi", label: "of highway destroyed (298 km)" }, { value: "-400 m", label: "the height of the mountain: 13% of its cone removed", source: "Source: Wikipedia, '1980 eruption of Mount St. Helens' and 'Mount St. Helens'" }] } },
    { id: "M16", part: "ending", ref: "WiRLNEl-4bk: the close returns to the central question, no sponsor", src: ["W1", "USGS"], frames: [90],
      vo: "Geologists had warned that a landslide might set off an eruption. What no measurement could tell them was when. The earthquake struck at eleven seconds past 8:32. The landslide followed within about twenty seconds, and the blast came a few seconds after the landslide began.",
      scene: { type: "footage", image: A("msh-plume-0518"), date: "18 MAY 1980", captions: [{ text: "An earthquake at 8:32:11 am PDT on May 18, 1980, caused the entire weakened north face to slide away", source: "Wikipedia, '1980 eruption of Mount St. Helens'", from: 150 }] } },
  ],
  transitions: [
    { name: "tx1-footage-to-figures", a: "M01", b: "M02", kind: "dissolve", dur: 20, aAt: 250, note: "cold-open footage dissolves into the stacked figures" },
    { name: "tx2-photo-to-map", a: "M07", b: "M08", kind: "wipe", dur: 18, aAt: 250, note: "wipe from the warning to the morning of 18 May" },
    { name: "tx3-map-to-footage", a: "M12", b: "M13", kind: "dissolve", dur: 20, aAt: 250, note: "the blast fan dissolves into the people" },
  ],
  thumbs: [
    { name: "thumb1-sideways", big: "Why it\nexploded\nsideways", small: "Mount St. Helens, 1980", image: A("msh-post-0518") },
    { name: "thumb2-slid", big: "The slide\ncame first", small: "8:32 a.m. · 18 May 1980", image: A("msh-plume-0518") },
    { name: "thumb3-swell", big: "They watched\nit swell", small: "then it slid away", image: A("msh-bulge-0427") },
  ],
};
