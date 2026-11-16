// Hidden Past long-form v4 (16 Nov 2026): v3 with the reference's MAP LOOK. RealLifeLore FA-oEtccS_k is about half flat political maps (red Russia, blue NATO, maroon Belarus,
// green others, thin light borders, thick arrows). v3 had dark satellite maps. Present-day maps (no historic date) are now flat political maps from Natural Earth borders
// (public domain; admin-0 10m + admin-1 Kaliningrad); colours come from config/longform-v2.json "political". Dated historic maps (1255, 1457, 1920, 1946, 1950, 1950s) stay on
// satellite relief because modern borders would be wrong for them. Five figure cards became maps that carry the same fact as tags. Four weaker beats were cut for length
// (V22 "never only German", V26 Euler, V38 1945 numbers, V78 analysts' disagreement). Script text and sources are otherwise v2's.
import { EPISODE as E3, SOURCES as S3 } from "./hidden-past-kaliningrad-v3.mjs";

export const SOURCES = { ...S3, NE: { title: "Borders: Natural Earth (public domain), 1:10m admin-0 countries and admin-1 Kaliningrad", url: "https://www.naturalearthdata.com/", retrieved: "2026-11-16" } };
const C = { Kaliningrad: [20.4531, 54.7003], Suwalki: [22.9286, 54.0989], Vilnius: [25.28, 54.6872], Minsk: [27.5586, 53.9006], Moscow: [37.6178, 55.7558], Warsaw: [21.0111, 52.23], Riga: [24.1064, 56.9489], Tallinn: [24.7536, 59.437], Grodno: [23.8333, 53.6667] };
const V = (center, zoom, f = 0) => ({ f, center, zoom, pitch: 0, bearing: 0 });
const L = (at, text, kind, from, dx, dy) => ({ at, text, kind, from, dx, dy });
const PT = (id, at, from, pulse) => ({ id, at, from, pulse });
const T = (text, x, y, from) => ({ text, x, y, from });
const LN = (id, coords, from, dur, o = {}) => ({ id, coords, from, dur, arrow: true, width: 9, color: "route", ...o });
const PM = (date, views, o = {}) => ({ type: "map", base: "political", terrain: 0, vignette: 0.12, ...(date ? { date } : {}), views, ...o });

const NEW = {
  V05: PM(null, [V([23.0, 55.4], 5.5), V([23.0, 54.9], 6.2, 200)], { points: [PT("wa", C.Warsaw, 20), PT("su", C.Suwalki, 30, true), PT("vi", C.Vilnius, 40)], lines: [LN("r", [C.Warsaw, C.Suwalki, C.Vilnius], 60, 80)],
    labels: [L([20.6, 52.7], "Poland", "country", 10), L([23.8, 55.6], "Lithuania", "country", 20), L([24.8, 57.1], "Latvia", "country", 20), L([25.6, 58.7], "Estonia", "country", 20), L(C.Suwalki, "Suwałki", "place", 40, 20, 34)],
    tags: [T("POLAND JOINS NATO: 1999", 90, 250, 30), T("LITHUANIA JOINS NATO: 2004", 90, 330, 80), T("1 LAND ROUTE TO THE BALTIC STATES", 90, 410, 130)] }),
  V61: PM("2001 - 2002", [V([23.2, 55.0], 5.9), V([24.6, 55.0], 6.2, 200)], { points: [PT("kg", C.Kaliningrad, 10, true), PT("vi", C.Vilnius, 20), PT("mn", C.Minsk, 30)], lines: [LN("t", [C.Kaliningrad, C.Vilnius, C.Minsk], 50, 100, { dash: [2, 1.5] })],
    labels: [L(C.Kaliningrad, "Kaliningrad", "place", 14, 20, -28), L(C.Vilnius, "Vilnius", "place", 40, 18, -26), L([23.5, 55.6], "Lithuania", "country", 20), L([28.2, 53.2], "Belarus", "country", 30)],
    tags: [T("12 HOURS FREE TRANSIT: REJECTED", 90, 250, 40), T("FTD: ROAD TRIPS THROUGH LITHUANIA", 90, 330, 90), T("FRTD: TRAINS THROUGH LITHUANIA", 90, 410, 140), T("ROUTE SCHEMATIC", 90, 490, 160)] }),
  V69: PM("2022", [V([27.0, 55.0], 5.1), V([25.0, 55.0], 5.6, 200)], { points: [PT("kg", C.Kaliningrad, 10, true), PT("mo", C.Moscow, 20)], lines: [LN("rail", [C.Moscow, C.Minsk, C.Vilnius, C.Kaliningrad], 40, 130, { color: "route" })],
    labels: [L(C.Kaliningrad, "Kaliningrad", "place", 14, 20, -28), L(C.Moscow, "Moscow", "place", 20, -10, -26), L([24.0, 55.7], "Lithuania (EU, NATO)", "country", 40), L([27.8, 53.4], "Belarus", "country", 30)],
    tags: [T("~50% OF GOODS BY RAIL BLOCKED", 90, 250, 80), T("FOOD, MEDICINE, PASSENGERS: EXEMPT", 90, 330, 130), T("ROUTE SCHEMATIC", 90, 410, 150)] }),
  V73: PM(null, [V([23.4, 54.6], 6.3), V([24.0, 55.6], 6.0, 200)], { points: [PT("wa", C.Warsaw, 10), PT("su", C.Suwalki, 20, true), PT("vi", C.Vilnius, 30), PT("ri", C.Riga, 40)], lines: [LN("e67", [C.Warsaw, C.Suwalki, C.Vilnius, C.Riga], 40, 130)],
    labels: [L(C.Warsaw, "Warsaw", "place", 14, 18, -26), L(C.Suwalki, "The gap", "zone", 30, 24, 30), L(C.Vilnius, "Vilnius", "place", 40, 18, -26), L(C.Riga, "Riga", "place", 40, 18, -26)],
    tags: [T("E67 VIA BALTICA ROAD (SCHEMATIC)", 90, 250, 60), T("GAS LINK OPENS 1 MAY 2022", 90, 330, 100), T("LITPOL LINK POWER LINE, 2015", 90, 410, 140), T("RAIL BALTICA: UNDER CONSTRUCTION", 90, 490, 180)] }),
  V77: PM("RAND, 2016", [V([25.5, 57.2], 5.6), V([25.5, 57.2], 6.1, 200)], { points: [PT("ri", C.Riga, 10, true), PT("ta", C.Tallinn, 20, true)], lines: [LN("a", [[30.2, 57.0], C.Riga], 50, 90), LN("b", [[30.2, 58.8], C.Tallinn], 60, 90, { color: "route2" })],
    labels: [L(C.Riga, "Riga", "place", 14, -20, 30), L(C.Tallinn, "Tallinn", "place", 24, -20, -28), L([24.5, 55.9], "Lithuania", "country", 20), L([26.6, 58.9], "Estonia", "country", 20), L([24.8, 57.0], "Latvia", "country", 20)],
    tags: [T("36 TO 60 HOURS", 90, 250, 80), T("UNTIL RUSSIAN TROOPS ENTER OR APPROACH RIGA AND TALLINN", 90, 330, 120), T("ARROWS SCHEMATIC", 90, 410, 150)] }),
};
const CUT = new Set(["V22", "V26", "V38", "V78"]);
const POLITICAL_OK = (b) => b.scene.type === "map" && (!b.scene.date || ["1990 - 1991", "1994 - 1996", "FEBRUARY 2025"].includes(b.scene.date));
const WIDER = (s) => ({ ...s, views: s.views.map((v) => ({ ...v, zoom: +Math.min(v.zoom, Math.max(v.zoom - 0.5, 5.0)).toFixed(2) })) }); // flat maps read at wider framing than satellite relief (reference shows whole regions)
const toPolitical = (b) => {
  const s = b.scene, ln = (s.lines || []).map((l, i) => ({ ...l, width: 9, arrow: l.arrow ?? true, color: i ? "route2" : "route" }));
  const { grade, ...rest } = s;
  return { ...b, src: [...new Set([...b.src, "NE"])], scene: WIDER({ ...rest, base: "political", terrain: 0, vignette: 0.12, lines: ln }) };
};
const beats = E3.beats.filter((b) => !CUT.has(b.id)).map((b) => (NEW[b.id] ? { ...b, src: [...new Set([...b.src.filter((x) => x !== "EOX"), "COORDS", "NE"])], scene: WIDER(NEW[b.id]) } : POLITICAL_OK(b) ? toPolitical(b) : b));
export const EPISODE = { ...E3, slug: "kaliningrad-v4", beats, thumbs: [{ name: "thumb1-kaliningrad-v4", big: "Russia owns\na piece of\nGermany", small: "Kaliningrad", image: "lf2/hidden-past/kg-castle-1900.jpg" }] };
