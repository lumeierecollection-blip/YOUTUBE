// Hidden Past long-form, fresh cycle 15 Nov 2026: "How Russia Ended Up Owning a Piece of Germany".
// CLONE of RealLifeLore, "Why Russia Thinks It Can Attack Europe and WIN" (FA-oEtccS_k, 1.45M views, 3 weeks old at selection), measured from its transcript
// (output/fresh-cycle-2026-11-14/clone/shots/FA-oEtccS_k/transcript.txt, chunked local whisper) and 184-shot list (median shot 5.4 s; map shots run 30-120 s).
// Its formula, kept: a present-day stake in the first sentences -> the question -> long, slow map sequences that build the geography -> dated history with
// credited pictures between the maps -> back to the present-day stake -> a question for the comments. Its look: one relief map re-framed by the camera, labels
// arriving in narration order, credited news/archive pictures between maps. Ours uses our GeoMap (Sentinel-2 cloudless by EOX) and credited Commons photographs.
// Facts: ONLY from the Wikipedia articles fetched 15 Nov 2026 (output/fresh-cycle-2026-11-14/hidden-past/sources/): Kaliningrad Oblast, Kaliningrad, Suwałki Gap.
// Coordinates: Wikipedia API (coords.json in the same folder). Where the two articles differ (which port is ice-free) the narration follows the oblast article and says so.
const A = (id) => `lf2/hidden-past/${id}.jpg`;
const C = { Kaliningrad: [20.4531, 54.7003], Baltiysk: [19.9167, 54.65], Suwalki: [22.9286, 54.0989], Grodno: [23.8333, 53.6667], Vilnius: [25.28, 54.6872], Gdansk: [18.6453, 54.3475], Klaipeda: [21.135, 55.7125], Minsk: [27.5586, 53.9006], Moscow: [37.6178, 55.7558] };
const W = (t, slug) => ({ title: `Wikipedia: ${t}`, url: `https://en.wikipedia.org/wiki/${slug}`, retrieved: "2026-11-15" });

export const SOURCES = {
  OB: W("Kaliningrad Oblast", "Kaliningrad_Oblast"), CITY: W("Kaliningrad", "Kaliningrad"), GAP: W("Suwałki Gap", "Suwa%C5%82ki_Gap"),
  COORDS: { title: "Coordinates: Wikipedia API (prop=coordinates) for Kaliningrad, Baltiysk, Suwałki, Grodno, Vilnius, Gdańsk, Klaipėda, Minsk, Moscow", url: "https://en.wikipedia.org/w/api.php", retrieved: "2026-11-15" },
  COMMONS: { title: "Photographs via Wikimedia Commons (credits on screen; public/lf2/hidden-past/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/", retrieved: "2026-11-15" },
  EOX: { title: "Sentinel-2 cloudless imagery by EOX (CC BY 4.0), contains modified Copernicus Sentinel data", url: "https://s2maps.eu", retrieved: "2026-11-15" },
  RLL: { title: "Structure reference (not a fact source): RealLifeLore, Why Russia Thinks It Can Attack Europe and WIN", url: "https://www.youtube.com/watch?v=FA-oEtccS_k", retrieved: "2026-11-14" },
};

const GAPVIEW = { f: 0, center: [23.2, 54.2], zoom: 7.4, pitch: 0, bearing: 0 };
const REGION = { f: 0, center: [22.5, 54.6], zoom: 6.1, pitch: 0, bearing: 0 };
const L = (at, text, kind, from, dx, dy) => ({ at, text, kind, from, dx, dy });

export const EPISODE = {
  channel: "hidden-past", slug: "kaliningrad", title: "How Russia Ended Up Owning a Piece of Germany", target_minutes: 7,
  sound: { bed: "MUSIC_DOC_PASSING", bed_rel_db: -20, dip_scenes: [] },
  beats: [
    { id: "K01", part: "the stake", ref: "FA-oEtccS_k 0:00: the present-day stake first, on one map", src: ["GAP", "COORDS", "EOX"],
      vo: "On the border between Poland and Lithuania there is a sparsely populated stretch of land that NATO treats as one of its most vulnerable points. It is called the Suwałki Gap. It sits on the shortest route between Belarus and a piece of Russia that is not connected to the rest of Russia at all.",
      scene: { type: "map", base: "s2", terrain: 0, views: [{ ...GAPVIEW, zoom: 6.6 }, { ...GAPVIEW, f: 300 }],
        points: [{ id: "su", at: C.Suwalki, pulse: true, from: 60 }], labels: [L(C.Suwalki, "Suwałki", "place", 64, 18, 34), L([21.4, 53.6], "Poland", "country", 20), L([24.3, 55.2], "Lithuania", "country", 30), L([25.0, 53.5], "Belarus", "country", 40), L(C.Kaliningrad, "Russia", "country", 120, -40, -40)],
        tags: [{ text: "THE SUWAŁKI GAP", x: 1180, y: 280, from: 90 }] } },
    { id: "K02", part: "the stake", ref: "FA-oEtccS_k: the camera widens to show the whole region", src: ["OB", "COORDS", "EOX"],
      vo: "That piece of Russia is Kaliningrad Oblast: Russia's westernmost region, on the Baltic Sea, bordered by Poland to the south and Lithuania to the north and east. Around a million people live there, according to the 2021 Russian census.",
      scene: { type: "map", base: "s2", terrain: 0, views: [{ ...GAPVIEW }, { ...REGION, f: 260 }],
        points: [{ id: "kg", at: C.Kaliningrad, pulse: true, from: 40 }], labels: [L(C.Kaliningrad, "Kaliningrad", "place", 44, 18, -26), L([19.3, 55.2], "Baltic Sea", "water", 30), L([21.0, 53.4], "Poland", "country", 60), L([23.8, 55.5], "Lithuania", "country", 70), L(C.Moscow, "Moscow", "place", 120)],
        tags: [{ text: "~1 million people (2021 census)", x: 1120, y: 300, from: 140 }] } },
    { id: "K03", part: "the question", ref: "FA-oEtccS_k 2:09: the pivot to the real question, over a credited photograph", src: ["OB", "CITY", "COMMONS"],
      vo: "Its capital, Kaliningrad, sits on the Pregolya river. The region's port of Baltiysk is described as the only Russian port on the Baltic that stays free of ice in winter. Until 1946, this city had a different name, and it was not Russian. So how did Russia end up owning a piece of Germany?",
      scene: { type: "footage", image: A("kg-cathedral-night"), date: "KALININGRAD TODAY", captions: [{ text: "Until 1946 known in English as Königsberg.", source: "Wikipedia, 'Kaliningrad'", from: 120 }] } },
    { id: "K04", part: "Königsberg", ref: "FA-oEtccS_k: dated history between the maps, archive picture with its credit", src: ["OB", "COMMONS"],
      vo: "In 1255 the Teutonic Order, a crusading order of knights, founded a city here on the ruins of an Old Prussian settlement. They named it Königsberg, in honour of King Ottokar the Second of Bohemia.",
      scene: { type: "footage", image: A("kg-castle-1900"), date: "FOUNDED 1255", grade: "warm", captions: [{ text: "Königsberg Castle, before 1900.", source: "Wikimedia Commons, public domain", from: 60 }] } },
    { id: "K05", part: "Königsberg", ref: "FA-oEtccS_k: the map carries the century", src: ["OB", "CITY", "COORDS", "EOX"],
      vo: "For centuries it was a German city. It was the capital of the Duchy of Prussia until 1660 and the coronation city of the Prussian monarchy. Until the Second World War it was the easternmost large city in Germany.",
      scene: { type: "map", base: "s2", terrain: 0, date: "1660 - 1945", views: [{ ...REGION, zoom: 5.4, center: [18.5, 54.0] }, { ...REGION, f: 260, zoom: 6.3, center: [20.6, 54.5] }],
        points: [{ id: "kb", at: C.Kaliningrad, pulse: true, from: 50 }, { id: "gd", at: C.Gdansk, from: 80 }], labels: [L(C.Kaliningrad, "Königsberg", "place", 54, 18, -26), L(C.Gdansk, "Danzig (Gdańsk)", "place", 84, -190, -26), L([19.3, 55.2], "Baltic Sea", "water", 30)],
        tags: [{ text: "Easternmost large city in Germany until 1945", x: 1050, y: 300, from: 140 }] } },
    { id: "K06", part: "Königsberg", ref: "FA-oEtccS_k: a detail that complicates the simple story", src: ["OB", "COMMONS"],
      vo: "It was never only German. Polish and Lithuanian culture flourished there too. The first Polish and Lithuanian catechisms were published in Königsberg, and so was the first grammar book of the Lithuanian language.",
      scene: { type: "footage", image: A("kg-castle"), date: "KÖNIGSBERG", grade: "warm", pos: "50% 30%", captions: [{ text: "The first Lithuanian grammar book was published in Königsberg.", source: "Wikipedia, 'Kaliningrad Oblast'", from: 80 }] } },
    { id: "K07", part: "1945", ref: "FA-oEtccS_k: the war, dated, with a credited picture", src: ["CITY", "COMMONS"],
      vo: "Then came the war. Allied bombing heavily damaged the city in 1944, and the Battle of Königsberg followed in 1945. The Soviet Union captured the city on the ninth of April 1945. Today the Bunker Museum in Kaliningrad tells the story of that battle.",
      scene: { type: "footage", image: A("kg-bunker-museum"), date: "9 APRIL 1945", captions: [{ text: "Captured by the Soviet Union on 9 April 1945.", source: "Wikipedia, 'Kaliningrad'", from: 90 }] } },
    { id: "K08", part: "1945", ref: "FA-oEtccS_k: the decision, quoted in the source's words", src: ["OB", "COMMONS"],
      vo: "At the Potsdam Conference that summer, the Allies agreed in principle to a Soviet proposal: the city and the area around it would be transferred to the Soviet Union, pending a final peace settlement. Truman and Attlee said they would support the proposal at that settlement.",
      scene: { type: "footage", image: A("kg-potsdam"), date: "1 AUGUST 1945", captions: [{ text: "“The ultimate transfer to the Soviet Union of the city of Koenigsberg and the area adjacent to it.”", source: "Potsdam Agreement, quoted in Wikipedia, 'Kaliningrad Oblast'", from: 70 }] } },
    { id: "K09", part: "1946", ref: "FA-oEtccS_k: the map changes name", src: ["CITY", "OB", "COORDS", "EOX"],
      vo: "In 1946 Königsberg was renamed Kaliningrad, after the Russian Bolshevik leader Mikhail Kalinin. Its German population was expelled. Soviet citizens, mostly ethnic Russians, were moved in, and they make up most of the population today.",
      scene: { type: "map", base: "s2", terrain: 0, date: "1946", views: [{ ...REGION, zoom: 7.2, center: C.Kaliningrad }, { ...REGION, f: 240, zoom: 8.2, center: C.Kaliningrad }],
        points: [{ id: "kg", at: C.Kaliningrad, pulse: true, from: 30 }], labels: [L(C.Kaliningrad, "Königsberg", "place", 34, 18, -26, 120), L(C.Kaliningrad, "Kaliningrad", "place", 130, 18, 34), L(C.Baltiysk, "Baltiysk", "place", 160, -120, 30)],
        tags: [{ text: "Renamed after Mikhail Kalinin", x: 1100, y: 300, from: 140 }] } },
    { id: "K10", part: "1990", ref: "FA-oEtccS_k: stacked dates as figures", src: ["OB", "CITY", "COMMONS"],
      vo: "The final word came forty-five years later. The Treaty on the Final Settlement with Respect to Germany was signed on the twelfth of September 1990, and the borders left open at Potsdam were settled.",
      scene: { type: "figures", image: A("kg-cathedral-night"), title: "From Königsberg to Kaliningrad", rows: [{ value: "1255", label: "Founded by the Teutonic Order" }, { value: "1945", label: "Captured by the Soviet Union, 9 April" }, { value: "1946", label: "Renamed Kaliningrad" }, { value: "1990", label: "Final settlement treaty, 12 September", source: "Source: Wikipedia, 'Kaliningrad' and 'Kaliningrad Oblast'" }] } },
    { id: "K11", part: "the exclave", ref: "FA-oEtccS_k: the map shows the problem", src: ["GAP", "CITY", "COORDS", "EOX"],
      vo: "Then the Soviet Union dissolved. The borders that had been internal became hard borders, and they cut straight through the shortest land route between Kaliningrad and Russia's ally, Belarus. Kaliningrad was now cut off from the rest of the country.",
      scene: { type: "map", base: "s2", terrain: 0, views: [{ ...REGION, zoom: 5.2, center: [27.5, 55.0] }, { ...REGION, f: 280, zoom: 6.0, center: [23.0, 54.4] }],
        points: [{ id: "kg", at: C.Kaliningrad, from: 20 }, { id: "mn", at: C.Minsk, from: 40 }, { id: "gr", at: C.Grodno, from: 60 }],
        lines: [{ id: "route", coords: [C.Grodno, C.Suwalki, C.Kaliningrad], dash: [2, 1.5], from: 110, dur: 60 }],
        labels: [L(C.Kaliningrad, "Kaliningrad (Russia)", "place", 24, 18, -26), L(C.Minsk, "Minsk", "place", 44, 18, -26), L(C.Grodno, "Grodno", "place", 64, 18, 30), L([25.0, 53.3], "Belarus", "country", 50), L([24.0, 55.6], "Lithuania", "country", 50), L([21.3, 53.4], "Poland", "country", 50)] } },
    { id: "K12", part: "the fortress", ref: "FA-oEtccS_k: the military picture, sourced", src: ["CITY", "OB", "COMMONS"],
      vo: "Kaliningrad is the headquarters of Russia's Baltic Fleet. Before 2022 its ground defence was anchored by the 11th Army Corps, more than twelve thousand troops. Because of the war in Ukraine, much of that force and its heavy armour was sent to the front lines.",
      scene: { type: "footage", image: A("kg-baltiysk-harbour"), date: "BALTIYSK", captions: [{ text: "Over 12,000 ground troops before 2022; much of the force redeployed to Ukraine.", source: "Wikipedia, 'Kaliningrad Oblast'", from: 80 }] } },
    { id: "K13", part: "the gap", ref: "FA-oEtccS_k: back to the opening map, now understood", src: ["GAP", "COORDS", "EOX"],
      vo: "Which brings us back to the gap. Once Poland and the Baltic states joined NATO, this stretch became the alliance's weak point. If it were cut, NATO would lose its only land route to the Baltic states. Those fears grew after 2014, grew again after Russia's full-scale invasion of Ukraine in 2022, and the alliance increased its military presence in the area.",
      scene: { type: "map", base: "s2", terrain: 0, views: [{ ...GAPVIEW, zoom: 6.4 }, { ...GAPVIEW, f: 300, zoom: 7.6 }],
        points: [{ id: "su", at: C.Suwalki, pulse: true, from: 40 }, { id: "vi", at: C.Vilnius, from: 70 }],
        lines: [{ id: "cut", coords: [C.Grodno, C.Suwalki, C.Kaliningrad], from: 90, dur: 50, arrow: true }],
        labels: [L(C.Suwalki, "Suwałki", "place", 44, 18, 34), L(C.Vilnius, "Vilnius", "place", 74, 18, -26), L([21.4, 53.6], "Poland", "country", 20), L([24.3, 55.3], "Lithuania", "country", 20), L([25.0, 53.4], "Belarus", "country", 20)],
        tags: [{ text: "NATO's only land route to the Baltic states", x: 1060, y: 280, from: 130 }] } },
    { id: "K14", part: "close", ref: "FA-oEtccS_k: the closing question", src: ["OB", "CITY", "COMMONS"],
      vo: "A city founded by crusading knights, crowned Prussian kings, was renamed after a Soviet official, and now sits at the centre of NATO's planning. Should Europe worry more about Kaliningrad, or less? Tell us what you think in the comments.",
      scene: { type: "footage", image: A("kg-cathedral-night"), date: "KALININGRAD", captions: [{ text: "The coronation city of the Prussian monarchy.", source: "Wikipedia, 'Kaliningrad'", from: 60 }] } },
  ],
  thumbs: [{ name: "thumb1-kaliningrad", big: "Russia owns\na piece of\nGermany", small: "Kaliningrad", image: A("kg-castle-1900") }],
};
