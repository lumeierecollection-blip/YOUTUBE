// Hidden Past long-form sample: "The Ships That Were Trapped in the Suez Canal for Eight Years" (the Yellow Fleet, 1967-1975).
// Every narration line cites its sources by id; every scene's data comes from the files named in SOURCES. Map geometry: OpenStreetMap
// (canal, lakes) and geoBoundaries (Sinai governorates, used as an approximation of the occupied east bank, and labelled so).
// Reference techniques, per beat, in `ref`. Route lines between ports are drawn sketches, not navigation tracks, and are labelled as such.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const geo = JSON.parse(readFileSync(join(ROOT, "data/longform/hidden-past/suez-geo.json"), "utf8"));
const ships = JSON.parse(readFileSync(join(ROOT, "data/longform/hidden-past/yellow-fleet-ships.json"), "utf8")).ships;
const A = (id) => `lf2/hidden-past/${id}.jpg`;
const credit = (id) => JSON.parse(readFileSync(join(ROOT, "src/skills/remotion-render/public/lf2/hidden-past/ATTRIBUTIONS.json"), "utf8"))[id].credit_line;

export const SOURCES = {
  W1: { title: "Yellow Fleet", url: "https://en.wikipedia.org/wiki/Yellow_Fleet", retrieved: "2026-11-13" },
  W2: { title: "Closure of the Suez Canal (1967–1975)", url: "https://en.wikipedia.org/wiki/Closure_of_the_Suez_Canal_(1967%E2%80%931975)", retrieved: "2026-11-13" },
  W3: { title: "Suez Canal", url: "https://en.wikipedia.org/wiki/Suez_Canal", retrieved: "2026-11-13" },
  OSM: { title: "OpenStreetMap: Suez Canal, Great Bitter Lake, Little Bitter Lake, Lake Timsah (ODbL)", url: "https://www.openstreetmap.org/relation/1410016", retrieved: "2026-11-13" },
  GB: { title: "geoBoundaries EGY ADM1 (ODbL)", url: "https://www.geoboundaries.org/", retrieved: "2026-11-13" },
  COMMONS: { title: "Wikimedia Commons photographs (see public/lf2/hidden-past/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/", retrieved: "2026-11-13" },
};

const P = { gbl: [32.38, 30.33], lbl: [32.5, 30.2], timsah: [32.3, 30.565], said: [32.31, 31.26], suez: [32.55, 29.96], ismailia: [32.27, 30.6], sinai: [33.75, 29.9], cairo: [31.24, 30.04] };
const canal = geo.canal;
const lakes = geo.lakes, sinai = geo.sinai;
const suezRoute = [[-0.1, 51.4], [-5.2, 48.6], [-9.6, 43.5], [-9.8, 38.5], [-5.6, 35.95], [3, 37.6], [11.5, 37.4], [20, 34.6], [28, 32.4], [32.31, 31.3], ...canal.slice(1, -1), [32.56, 29.9], [33.6, 27.6], [38.2, 21], [42.5, 14.3], [43.4, 12.6], [51, 13.2], [60, 16.6], [72.8, 18.9]];
const capeRoute = [[-0.1, 51.4], [-5.2, 48.6], [-11.5, 42], [-19, 28], [-19.5, 15], [-12, 4], [0, -2], [8, -14], [13, -26], [18.4, -35.4], [26, -36.2], [36, -30], [44, -26.5], [52, -18], [58, -6], [64, 7], [72.8, 18.9]];
const homeRoute = [[32.31, 31.3], [28, 33], [20, 34.8], [11.5, 37.4], [3, 37.6], [-5.6, 35.95], [-9.8, 38.5], [-9.6, 43.5], [-5.2, 48.6], [1.5, 51], [4.5, 53], [8.3, 54], [9.99, 53.55]];
const lakeLabels = [{ at: P.gbl, text: "Great Bitter Lake", kind: "water", from: 30 }, { at: P.timsah, text: "Lake Timsah", kind: "water", dx: -150, from: 40 }];

export const EPISODE = {
  channel: "hidden-past", slug: "yellow-fleet", title: "The Ships That Were Trapped in the Suez Canal for Eight Years", target_minutes: 10,
  beats: [
    // ---- COLD OPEN (ref: 3IVbe0xrRt8 uncut opening map with labels arriving in narration order; WiRLNEl-4bk dated opening)
    { id: "H01", part: "cold open", ref: "3IVbe0xrRt8 0:00-0:30 one uncut map, labels in narration order; WiRLNEl-4bk dated cold open", src: ["W1", "OSM"], frames: [0, 90, 200],
      vo: "In June 1967, fourteen cargo ships dropped anchor in a lake in the middle of the Suez Canal. Within three days it was clear they were not going anywhere soon. They stayed for eight years.",
      scene: { type: "map", base: "s2", terrain: 1.2, views: [{ f: 0, center: [32.4, 30.35], zoom: 7.6, pitch: 0, bearing: 0 }, { f: 240, center: [32.39, 30.33], zoom: 9.4, pitch: 48, bearing: -28 }], date: "JUNE 1967",
        fills: [{ id: "lakes", data: lakes, color: "#3FA9F5", opacity: 0.32, outline: "#9fd6ff", from: 20, dur: 20 }], lines: [{ id: "canal", coords: canal, color: "#9fd6ff", width: 3, from: 0, dur: 1, casing: false }],
        labels: [{ at: P.gbl, text: "Great Bitter Lake", kind: "water", from: 30 }], tags: [{ text: "14 ships anchored here", x: 1180, y: 600, from: 110 }] } },
    { id: "H02", part: "cold open", ref: "WiRLNEl-4bk: authentic dated picture, source credit stays on screen, source-worded caption box", src: ["W1", "W2", "COMMONS"], frames: [40],
      vo: "On the fifth of June, Israel and Egypt went to war. The next day Egypt closed the canal, and within days Israeli troops stood on its east bank.",
      scene: { type: "footage", image: A("troop-carrier-1967"), credit: credit("troop-carrier-1967"), date: "22 JUNE 1967", grade: "bw", captions: [{ text: "Six Day War. An Israeli troop carrier on the east bank of the Suez Canal opposite Ismailia.", source: "Wikimedia Commons description", from: 10 }] } },
    { id: "H03", part: "cold open", ref: "FA-oEtccS_k: one relief map, the held zone filled in one colour, small key bottom-left", src: ["W1", "W2", "OSM", "GB"], frames: [150],
      vo: "Ships, dredgers and even a bridge were sunk to block it, and mines were laid in the water. Fifteen cargo ships from eight countries were caught inside.",
      scene: { type: "map", base: "s2", terrain: 0, views: [{ f: 0, center: [32.5, 30.5], zoom: 7.3, pitch: 20, bearing: 0 }, { f: 220, center: [32.9, 30.3], zoom: 6.9, pitch: 35, bearing: 8 }],
        fills: [{ id: "sinai", data: sinai, color: "#D7263D", opacity: 0.38, outline: "#ff6b7d", from: 30, dur: 30 }, { id: "lakes", data: lakes, color: "#3FA9F5", opacity: 0.4, from: 0, dur: 1 }],
        lines: [{ id: "canal", coords: canal, color: "#FFFFFF", width: 4, from: 4, dur: 50 }],
        points: [{ id: "n", at: P.said, pulse: true, from: 70 }, { id: "s", at: P.suez, pulse: true, from: 80 }],
        labels: [{ at: P.said, text: "Port Said · blocked", kind: "zone", dx: -170, from: 74 }, { at: P.suez, text: "Suez · blocked", kind: "zone", dx: -150, from: 84 }, { at: P.sinai, text: "Sinai", kind: "country", from: 40 }, { at: [31.5, 30.3], text: "Egypt", kind: "country", from: 20 }],
        key_: [{ color: "#D7263D", label: "Held by Israel from June 1967 (approx.)" }, { color: "#FFFFFF", label: "Suez Canal", line: true }] } },
    { id: "H04", part: "cold open", ref: "WiRLNEl-4bk 1:24: the figures stacked one after another in the first two minutes", src: ["W1"], frames: [130],
      vo: "Fifteen ships. Eight countries. Eight years. And when the canal finally opened again, only two of them could still sail home under their own power.",
      scene: { type: "figures", image: A("bitter-lake-space"), title: "The Yellow Fleet", rows: [{ value: "15", label: "cargo ships trapped in the canal" }, { value: "8", label: "countries: West Germany, Sweden, France, the UK, the US, Poland, Bulgaria, Czechoslovakia" }, { value: "8", label: "years, from June 1967 to 1975" }, { value: "2", label: "ships still able to sail home under their own power", source: "Source: Wikipedia, \"Yellow Fleet\"" }] } },
    // ---- WHY IT MATTERED (ref: U_UoAZrOTNU routes with arrows to named exits; chart over footage)
    { id: "H05", part: "why the canal mattered", ref: "U_UoAZrOTNU: routes as coloured lines with arrowheads to named destinations; one reframed base map", src: ["W3"], frames: [200],
      vo: "To see why that mattered, look at a map of the trade it carried. A ship from India to London could go round the southern tip of Africa, or cut through Egypt. The canal took about eight thousand nine hundred kilometres off the trip from the Arabian Sea to London.",
      scene: { type: "map", base: "bluemarble", terrain: 0, views: [{ f: 0, center: [30, 18], zoom: 2.35, pitch: 0, bearing: 0 }, { f: 240, center: [30, 12], zoom: 2.2, pitch: 0, bearing: 0 }],
        lines: [{ id: "cape", coords: capeRoute, color: "#FFFFFF", width: 4, dash: [2, 1.5], from: 10, dur: 90, arrow: true }, { id: "suez", coords: suezRoute, color: "#FFD23F", width: 6, from: 100, dur: 80, arrow: true }],
        labels: [{ at: [-0.1, 51.4], text: "London", kind: "place", dy: -30, from: 4 }, { at: [72.8, 18.9], text: "Bombay", kind: "place", dy: -30, from: 8 }, { at: [18.4, -35.4], text: "Cape of Good Hope", kind: "place", dy: 34, from: 60 }, { at: [32.4, 30.4], text: "Suez Canal", kind: "zone", dx: 120, from: 150 }],
        tags: [{ text: "About 8,900 km shorter", x: 1170, y: 300, from: 175 }], key_: [{ color: "#FFD23F", label: "Through the canal", line: true }, { color: "#FFFFFF", label: "Around Africa", line: true }, { color: "rgba(0,0,0,0)", label: "Route sketches, not ship tracks" }] } },
    { id: "H06", part: "why the canal mattered", ref: "U_UoAZrOTNU: bar chart laid over a picture", src: ["W2", "COMMONS"], frames: [80],
      vo: "In 1966, the year before it closed, sixty per cent of the oil Italy used came through the canal. For France it was thirty-nine per cent. For Britain, a quarter.",
      scene: { type: "chart", image: A("canal-1967-a"), credit: credit("canal-1967-a"), title: "Oil that came through the canal", sub: "Share of total oil consumption, 1966", unit: "%", bars: [{ label: "Italy", value: 60 }, { label: "France", value: 39 }, { label: "United Kingdom", value: 25 }], max: 70, source: "Source: Wikipedia, \"Closure of the Suez Canal (1967–1975)\"" } },
    { id: "H07", part: "why the canal mattered", ref: "WiRLNEl-4bk: an unfamiliar size set against a familiar one", src: ["W3"], frames: [90],
      vo: "The canal itself is short. Today it runs 193 kilometres from Port Said to Suez. The detour it saves is forty-six times longer than the canal.",
      scene: { type: "scale", title: "A short canal, a long detour", unit: "km", rows: [{ label: "Detour saved, Arabian Sea to London", value: 8900, note: "about 8,900 km" }, { label: "Length of the canal today", value: 193.3, note: "193.3 km, Port Said to Port Tewfik" }], source: "Source: Wikipedia, \"Suez Canal\"" } },
    // ---- THE TRAP
    { id: "H08", part: "the trap", ref: "U_UoAZrOTNU: re-framing the same base map close in; pulse markers on chokepoints", src: ["W1", "OSM"], frames: [180],
      vo: "When the shooting started, the fifteen ships were sailing north in a convoy. Fourteen of them anchored in the widest part of the canal, the Great Bitter Lake. Scuttled ships cut the American freighter Observer off from the rest, and it had to anchor alone in Lake Timsah, further north.",
      scene: { type: "map", base: "s2", terrain: 1.4, views: [{ f: 0, center: [32.36, 30.45], zoom: 8.6, pitch: 30, bearing: -20 }, { f: 220, center: [32.36, 30.42], zoom: 9.2, pitch: 55, bearing: -34 }],
        fills: [{ id: "lakes", data: lakes, color: "#3FA9F5", opacity: 0.35, outline: "#9fd6ff", from: 0, dur: 14 }], lines: [{ id: "canal", coords: canal, color: "#FFFFFF", width: 4, from: 0, dur: 1 }],
        points: [{ id: "obs", at: P.timsah, pulse: true, from: 120, color: "#FFD23F" }],
        labels: [...lakeLabels, { at: [32.3, 30.62], text: "SS Observer", kind: "zone", dx: 120, from: 126 }, { at: [32.44, 30.27], text: "14 ships", kind: "place", dy: 46, from: 60 }, { at: P.ismailia, text: "Ismailia", kind: "place", dx: -120, from: 50 }] } },
    { id: "H09", part: "the trap", ref: "N/A in references (our roster): the counted set shown whole so no ship is a statistic", src: ["W1"], frames: [80],
      vo: "These are the fifteen. Two West German ships, two Swedish, one French, four British, two American, two Polish, one Bulgarian and one from Czechoslovakia. They carried T-shirts, eggs and fruit, wool, case goods from the Far East, plastic toys for Woolworths, and American wheat bound for Bombay.",
      scene: { type: "roster", title: "The fifteen ships", sub: "Trapped June 1967. Colour = flag state.", items: ships.map((s) => ({ name: s.name.replace(/^(MS|SS) /, ""), group: s.country, note: s.cargo })), source: "Source: Wikipedia, \"Yellow Fleet\", table of stranded ships", image: A("bitter-lake-space") } },
    { id: "H10", part: "the trap", ref: "WiRLNEl-4bk: authentic picture, caption in the source's words", src: ["W1", "COMMONS"], frames: [60],
      vo: "With Israel holding the whole east bank, Egypt's president, Gamal Abdel Nasser, decided to keep the canal closed. Opening it would have let Israel use it.",
      scene: { type: "footage", image: A("boat-port-tewfik-1967"), credit: credit("boat-port-tewfik-1967"), date: "9 JUNE 1967", grade: "bw", captions: [{ text: "Six Day War. Israeli boat on Suez Canal. In background Port Tewfik.", source: "Wikimedia Commons description", from: 8 }] } },
    // ---- LIFE ON THE LAKE
    { id: "H11", part: "life on the lake", ref: "WiRLNEl-4bk 12:15: a satellite plate inset in a thin dark frame with its provider mark", src: ["COMMONS"], frames: [60],
      vo: "From orbit, the Great Bitter Lake is a blue patch in the desert, with the canal running in and out of it. For the crews, it became home.",
      scene: { type: "inset", image: A("bitter-lake-space"), mark: "NASA", title: "The Great Bitter Lake", note: "Photographed from orbit, 17 June 2002, looking south-east along the canal", credit: credit("bitter-lake-space") } },
    { id: "H12", part: "life on the lake", ref: "WiRLNEl-4bk: facts stacked one after another, each with its source", src: ["W1"], frames: [150],
      vo: "In October 1967 the officers met on the British ship Melampus and founded the Great Bitter Lake Association. They played football on the deck of the Port Invercargill, held church services on the Nordwind, showed films on the Vasil Levsky, and ran their own Olympic Games in 1968.",
      scene: { type: "figures", image: A("bitter-lake-space"), title: "Life on the Great Bitter Lake", rows: [{ value: "Oct 1967", label: "Great Bitter Lake Association founded on board the Melampus" }, { value: "1968", label: "\"Bitter Lake Olympic Games\", alongside the Mexico City Olympics" }, { value: "Deck", label: "Football on the Port Invercargill, church on the Nordwind, films on the Vasil Levsky" }, { value: "Post", label: "Their own hand-made stamps, recognised by the Egyptian postal authority", source: "Source: Wikipedia, \"Yellow Fleet\"" }] } },
    { id: "H13", part: "life on the lake", ref: "WiRLNEl-4bk: authentic picture with caption in the source's words", src: ["COMMONS"], frames: [60],
      vo: "From 1969 the ships were gathered into groups, so fewer sailors were needed. Skeleton crews rotated every three months. In 1972 the last German crew went home, and a Norwegian company was paid to look after their ships.",
      scene: { type: "footage", image: A("suezship-1973"), credit: credit("suezship-1973"), date: "NOVEMBER 1973", grade: "warm", captions: [{ text: "Ship anchored in the Suez Canal since 1967 with no possibility to move", source: "Wikimedia Commons description", from: 8 }] } },
    // ---- THE WAR AROUND THEM
    { id: "H14", part: "the war around them", ref: "FA-oEtccS_k: the front line as a map; R60ZGwd3n9E date-led history", src: ["W2", "OSM", "GB"], frames: [150],
      vo: "The canal was now the front line. Israel fortified the east bank with the Bar Lev Line. From 1967 to 1970 Egypt fought a War of Attrition across the water: shelling, air raids and commando raids, with the ships anchored in the middle.",
      scene: { type: "map", base: "s2", terrain: 0, views: [{ f: 0, center: [32.45, 30.4], zoom: 8.1, pitch: 50, bearing: 70 }, { f: 220, center: [32.42, 30.35], zoom: 8.5, pitch: 62, bearing: 52 }], date: "1967 – 1970",
        fills: [{ id: "sinai", data: sinai, color: "#D7263D", opacity: 0.3, outline: "#ff6b7d", from: 0, dur: 10 }, { id: "lakes", data: lakes, color: "#3FA9F5", opacity: 0.4, from: 0, dur: 1 }], lines: [{ id: "canal", coords: canal, color: "#FFFFFF", width: 5, from: 0, dur: 1 }],
        labels: [{ at: [32.62, 30.5], text: "Bar Lev Line (east bank)", kind: "zone", from: 40 }, { at: [32.1, 30.45], text: "Egyptian army (west bank)", kind: "place", from: 60 }, { at: P.gbl, text: "14 ships", kind: "place", from: 90 }],
        key_: [{ color: "#D7263D", label: "Held by Israel (approx.)" }] } },
    { id: "H15", part: "the war around them", ref: "R60ZGwd3n9E: dated history shown as a dated card", src: ["W1", "W2"], frames: [120],
      vo: "In October 1973 Egypt crossed the canal in the opening attack of the Yom Kippur War. One of the trapped ships, the American African Glen, was sunk.",
      scene: { type: "figures", image: A("canal-1967-b"), title: "6 October 1973", rows: [{ value: "Badr", label: "Egypt crosses the canal: Operation Badr, the start of the Yom Kippur War" }, { value: "1 ship", label: "the African Glen, sunk in 1973 during the war", source: "Sources: Wikipedia, \"Closure of the Suez Canal (1967–1975)\"; \"Yellow Fleet\"" }] } },
    // ---- THE WAY OUT
    { id: "H16", part: "the way out", ref: "WiRLNEl-4bk: authentic footage-led section; caption in source words", src: ["W2", "COMMONS"], frames: [60],
      vo: "After that war, the canal had to be cleared before anything could move. In 1974 a clearance operation, with US Navy helicopters among those taking part, swept it for mines and cleared the debris.",
      scene: { type: "footage", image: A("minesweep-1974"), credit: credit("minesweep-1974"), date: "1974", fit: "contain", captions: [{ text: "Two U.S. Navy RH-53D Sea Stallion helicopters sweeping the Suez Canal or one of the lakes during \"Operation Nimbus Moon\" in 1974.", source: "Wikimedia Commons description", from: 8 }] } },
    { id: "H17", part: "the way out", ref: "WiRLNEl-4bk: dated authentic picture", src: ["W2", "COMMONS"], frames: [60],
      vo: "On the fifth of June 1975, eight years almost to the day after it closed, the Suez Canal reopened, with President Anwar Sadat at the ceremony.",
      scene: { type: "footage", image: A("little-rock-1975"), credit: credit("little-rock-1975"), date: "5 JUNE 1975", fit: "contain", captions: [{ text: "USS Little Rock steaming in the Suez Canal, en route to Port Said for ceremonies reopening the canal, 5 June 1975.", source: "Wikimedia Commons description", from: 8 }] } },
    { id: "H18", part: "the way out", ref: "U_UoAZrOTNU: a single route with an arrowhead to a named destination", src: ["W1"], frames: [210],
      vo: "Twelve days earlier, on the twenty-fourth of May, the West German ships Münsterland and Nordwind had sailed into Hamburg. More than thirty thousand people were waiting on the quay.",
      scene: { type: "map", base: "bluemarble", terrain: 0, views: [{ f: 0, center: [16, 42], zoom: 3.6, pitch: 0, bearing: 0 }, { f: 240, center: [13, 45], zoom: 3.5, pitch: 25, bearing: 0 }], date: "24 MAY 1975",
        lines: [{ id: "home", coords: homeRoute, color: "#FFD23F", width: 6, from: 10, dur: 150, arrow: true }],
        points: [{ id: "hh", at: [9.99, 53.55], pulse: true, from: 160 }], labels: [{ at: [32.31, 31.26], text: "Port Said", kind: "place", dy: 34, from: 4 }, { at: [9.99, 53.55], text: "Hamburg", kind: "place", dx: 110, from: 165 }],
        tags: [{ text: "More than 30,000 people waiting", x: 1080, y: 250, from: 180 }], key_: [{ color: "#FFD23F", label: "Route sketch, not a ship track", line: true }] } },
    { id: "H19", part: "ending", ref: "WiRLNEl-4bk: a closing figure", src: ["W1"], frames: [100],
      vo: "For the Münsterland, it was the end of a voyage to Australia that had lasted eight years, three months and five days.",
      scene: { type: "figures", image: A("suezship-1973"), title: "The Münsterland's voyage", rows: [{ value: "8 y 3 m 5 d", label: "from leaving for Australia to arriving back in Hamburg", source: "Source: Wikipedia, \"Yellow Fleet\"" }] } },
  ],
  transitions: [
    { name: "tx1-map-to-photo", a: "H01", b: "H02", kind: "dissolve", dur: 20, aAt: 230, note: "map dissolves into the dated photograph (cold open)" },
    { name: "tx2-map-zoomthrough", a: "H08", b: "H09", kind: "zoomthrough", dur: 24, aAt: 210, note: "camera keeps pushing into the lake, the roster comes up through it" },
    { name: "tx3-footage-wipe", a: "H17", b: "H18", kind: "wipe", dur: 18, aAt: 200, note: "hard wipe with a thin line from the 1975 photo to the route home" },
  ],
  thumbs: [
    { name: "thumb1-lake", big: "Trapped\nfor 8 years", small: "15 ships", map: { views: [{ f: 0, center: [31.85, 30.32], zoom: 9.0, pitch: 0, bearing: 0 }], base: "s2", terrain: 0, fills: [{ id: "lakes", data: lakes, color: "#3FA9F5", opacity: 0.25, from: -30, dur: 1 }] }, circle: { x: 1360, y: 545, r: 240 } },
    { name: "thumb2-photo", big: "Stuck in\nthe Suez\nCanal", small: "1967 → 1975", image: A("suezship-1973") },
    { name: "thumb3-route", big: "8 years\nto get\nhome", small: "Suez → Hamburg", map: { views: [{ f: 0, center: [20, 43], zoom: 3.5, pitch: 0, bearing: 0 }], base: "bluemarble", terrain: 0, lines: [{ id: "home", coords: homeRoute, color: "#FFD23F", width: 9, from: -60, dur: 1 }] }, arrow: "M1520 860 Q 1560 520 1330 330" },
  ],
};
