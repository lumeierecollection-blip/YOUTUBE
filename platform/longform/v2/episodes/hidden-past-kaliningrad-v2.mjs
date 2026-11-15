// Hidden Past long-form, rebuild v2 (15 Nov 2026): "How Russia Ended Up Owning a Piece of Germany", 7-10 minutes.
// Owner verdict on v1 (245 s): "it's all good, but it needs more context, more explanation and understanding".
// Reference: RealLifeLore FA-oEtccS_k (see output/fresh-cycle-2026-11-14/rebuild/hidden/CLONE-SPEC.md): ~85% of its minutes are background, mechanism, dated evidence
// and consequence; maps run long with the camera and labels moving inside the shot; 47% of its shots are 5 s or shorter (median 5.35 s).
// So here: one or two sentences per beat (4-9 s), a new picture or a clear map move at every beat boundary, and motion inside every beat.
// Facts: ONLY from pages fetched 15 Nov 2026 (output/fresh-cycle-2026-11-14/hidden-past/sources/ and .../rebuild/hidden/sources/): Wikipedia "Kaliningrad Oblast",
// "Kaliningrad", "Königsberg", "East Prussia", "Suwałki Gap", and the Potsdam Agreement text (Avalon Project, Yale). Every sentence names its pages in `src`.
// Where two Wikipedia articles differ (which port is ice-free) the narration follows the oblast article.
const A = (id, ext = "jpg") => `lf2/hidden-past/${id}.${ext}`;
const C = {
  Kaliningrad: [20.4531, 54.7003], Baltiysk: [19.9167, 54.65], Chernyakhovsk: [21.8119, 54.6347], Suwalki: [22.9286, 54.0989], Grodno: [23.8333, 53.6667], Vilnius: [25.28, 54.6872],
  Gdansk: [18.6453, 54.3475], Klaipeda: [21.135, 55.7125], Minsk: [27.5586, 53.9006], Moscow: [37.6178, 55.7558], Malbork: [19.0333, 54.0333], Berlin: [13.405, 52.52], Warsaw: [21.0111, 52.23], Riga: [24.1064, 56.9489],
};
const W = (t, slug) => ({ title: `Wikipedia: ${t}`, url: `https://en.wikipedia.org/wiki/${slug}`, retrieved: "2026-11-15" });

export const SOURCES = {
  OB: W("Kaliningrad Oblast", "Kaliningrad_Oblast"), CITY: W("Kaliningrad", "Kaliningrad"), KB: W("Königsberg", "K%C3%B6nigsberg"), EP: W("East Prussia", "East_Prussia"), GAP: W("Suwałki Gap", "Suwa%C5%82ki_Gap"),
  PSD: { title: "Potsdam Agreement, section V 'City of Koenigsberg and the adjacent area' (Avalon Project, Yale Law School)", url: "https://avalon.law.yale.edu/20th_century/decade17.asp", retrieved: "2026-11-15" },
  COORDS: { title: "Coordinates: Wikipedia API / infobox coordinates for Kaliningrad, Baltiysk, Chernyakhovsk, Suwałki, Grodno, Vilnius, Gdańsk, Klaipėda, Minsk, Moscow, Malbork, Berlin, Warsaw, Riga", url: "https://en.wikipedia.org/w/api.php", retrieved: "2026-11-15" },
  COMMONS: { title: "Pictures via Wikimedia Commons (credits on screen; public/lf2/hidden-past/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/", retrieved: "2026-11-15" },
  EOX: { title: "Sentinel-2 cloudless imagery by EOX (CC BY 4.0), contains modified Copernicus Sentinel data", url: "https://s2maps.eu", retrieved: "2026-11-15" },
  RLL: { title: "Structure reference (not a fact source): RealLifeLore, Why Russia Thinks It Can Attack Europe and WIN", url: "https://www.youtube.com/watch?v=FA-oEtccS_k", retrieved: "2026-11-14" },
};

const V = (center, zoom, f = 0, pitch = 0) => ({ f, center, zoom, pitch, bearing: 0 });
const L = (at, text, kind, from, dx, dy, to) => ({ at, text, kind, from, dx, dy, to });
const PT = (id, at, from, pulse) => ({ id, at, from, pulse });
const M = (date, views, o = {}) => ({ type: "map", base: "s2", terrain: 0, ...(date ? { date } : {}), views, ...o });
const T = (text, x, y, from) => ({ text, x, y, from });
// footage scene: credited picture with a slow push (or pull when pull = true); captions in the source's words
const P = (image, date, caps, o = {}) => ({ type: "footage", image, date, captions: caps.map(([text, source, from, to]) => ({ text, source, from, ...(to ? { to } : {}) })), ...(o.pull ? { from: 1.12, to: 1.02 } : {}), ...o, pull: undefined });
const GAPV = [23.2, 54.2], REG = [22.5, 54.6];

export const EPISODE = {
  channel: "hidden-past", slug: "kaliningrad-v2", title: "How Russia Ended Up Owning a Piece of Germany", target_minutes: 9,
  sound: { bed: "MUSIC_DOC_PASSING", bed_rel_db: -20, dip_scenes: [] },
  beats: [
    // ---- 1. THE STAKE (GAP)
    { id: "V01", part: "the stake", ref: "FA 0:00 present-day stake first, on a map", src: ["GAP", "COORDS", "EOX"],
      vo: "On the border between Poland and Lithuania lies a sparsely populated stretch of land called the Suwałki Gap.",
      scene: M(null, [V(GAPV, 5.6), V(GAPV, 7.6, 170)], { points: [PT("su", C.Suwalki, 50, true)], labels: [L([21.4, 53.6], "Poland", "country", 10), L([24.6, 55.1], "Lithuania", "country", 20), L(C.Suwalki, "Suwałki", "place", 56, 18, 34)], tags: [T("THE SUWAŁKI GAP", 1180, 280, 90)] }) },
    { id: "V02", part: "the stake", ref: "FA: the map widens to the thing it points at", src: ["GAP", "CITY", "COORDS", "EOX"],
      vo: "It centres on the shortest path between Belarus, Russia's ally, and a piece of Russia that is cut off from the rest of the country.",
      scene: M(null, [V(GAPV, 7.0), V([23.6, 54.4], 5.9, 190)], { points: [PT("mn", C.Minsk, 70), PT("kg", C.Kaliningrad, 150, true)], lines: [{ id: "path", coords: [C.Grodno, C.Suwalki, C.Kaliningrad], dash: [2, 1.5], from: 60, dur: 90 }],
        labels: [L([25.6, 53.4], "Belarus", "country", 20), L(C.Kaliningrad, "Kaliningrad (Russia)", "place", 150, 20, -28), L(C.Suwalki, "Suwałki", "place", 40, 18, 34)] }) },
    { id: "V03", part: "the stake", ref: "FA: name the place", src: ["OB", "COORDS", "EOX"],
      vo: "That piece of Russia is Kaliningrad Oblast, on the Baltic Sea, with Poland to its south and Lithuania to its north and east.",
      scene: M(null, [V(REG, 6.0), V(C.Kaliningrad, 7.6, 190)], { points: [PT("kg", C.Kaliningrad, 20, true)], labels: [L(C.Kaliningrad, "Kaliningrad Oblast", "zone", 24, 30, -34), L([19.0, 55.3], "Baltic Sea", "water", 30), L([21.0, 53.5], "Poland", "country", 60), L([23.6, 55.5], "Lithuania", "country", 80)] }) },
    { id: "V04", part: "the stake", ref: "FA 2:09 the mechanism in one line", src: ["GAP"],
      vo: "Once Poland and the Baltic states joined NATO, this narrow strip became a weak point for the alliance, because it is the only land route to the Baltic states.",
      scene: M(null, [V(GAPV, 6.4), V([23.4, 54.6], 6.8, 200)], { points: [PT("su", C.Suwalki, 20, true), PT("vi", C.Vilnius, 70)], lines: [{ id: "route", coords: [C.Warsaw, C.Suwalki, C.Vilnius], from: 60, dur: 80, arrow: true, color: "#4C9BE8" }],
        labels: [L(C.Warsaw, "Warsaw", "place", 70, 18, -26), L(C.Suwalki, "Suwałki", "place", 26, 18, 34), L(C.Vilnius, "Vilnius", "place", 100, 18, -26)], tags: [T("NATO'S ONLY LAND ROUTE TO THE BALTIC STATES", 900, 280, 130)] }) },
    { id: "V05", part: "the stake", ref: "FA: stacked dates as figures", src: ["GAP", "KB"],
      vo: "Poland joined NATO in 1999 and Lithuania in 2004. From then on, every soldier supplied by land to the Baltic states had to pass through the gap.",
      scene: { type: "figures", image: A("kg-tripoint"), title: "Why the gap matters", rows: [{ value: "1999", label: "Poland joins NATO" }, { value: "2004", label: "Lithuania joins NATO" }, { value: "1 route", label: "the only land route to the Baltic states runs through the gap", source: "Source: Wikipedia, 'Suwałki Gap'" }] } },
    { id: "V06", part: "the question", ref: "FA 1:32 the question", src: ["OB", "CITY", "COMMONS"],
      vo: "So how did Russia end up with a piece of land on the Baltic, on the far side of two NATO countries? The answer starts with a German city.",
      scene: P(A("kg-cathedral-night"), "KALININGRAD TODAY", [["Until 1946 known in English as Königsberg.", "Wikipedia, 'Kaliningrad'", 100]], { pull: true }) },

    // ---- 2. THE PLACE TODAY
    { id: "V07", part: "the place", ref: "FA: who and where, with a figure", src: ["CITY", "OB", "COORDS", "EOX"],
      vo: "Its capital, Kaliningrad, sits on the Pregolya River. Almost half a million people live there, and about a million in the whole oblast.",
      scene: M(null, [V(C.Kaliningrad, 9.2), V(REG, 6.8, 180)], { points: [PT("kg", C.Kaliningrad, 10, true)], labels: [L(C.Kaliningrad, "Kaliningrad", "place", 14, 20, -28), L(C.Baltiysk, "Baltiysk", "place", 80, -110, 30)], tags: [T("489,359 people in the city (2020)", 1050, 300, 60), T("~1 million in the oblast (2021)", 1050, 380, 120)] }) },
    { id: "V08", part: "the place", ref: "FA: why the place matters", src: ["OB", "CITY", "COMMONS"],
      vo: "Its port of Baltiysk is described as Russia's only Baltic port that stays free of ice all year, which is why it matters to the Baltic Fleet.",
      scene: M(null, [V(C.Baltiysk, 10.2), V(C.Baltiysk, 8.4, 200)], { points: [PT("bl", C.Baltiysk, 20, true)], labels: [L(C.Baltiysk, "Baltiysk", "place", 24, -110, -20), L([19.2, 54.95], "Baltic Sea", "water", 40)], tags: [T("ONLY RUSSIAN BALTIC PORT FREE OF ICE ALL YEAR", 880, 300, 90)] }) },
    { id: "V09", part: "the place", ref: "FA: a surprising fact on a picture", src: ["OB", "COMMONS"],
      vo: "Beneath the region lies roughly ninety percent of the world's amber deposits, and many Russians call it Amber Land.",
      scene: P(A("kg-amber-mine"), "AMBER LAND", [["Roughly 90% of global amber deposits.", "Wikipedia, 'Kaliningrad Oblast'", 70]], { pos: "50% 60%" }) },
    { id: "V10", part: "the place", ref: "FA: the hinge", src: ["CITY", "KB", "COMMONS"],
      vo: "But until 1946 this city had another name, another language, and another country.",
      scene: P(A("kg-castle"), "BEFORE 1946", [["Königsberg Castle and the monument to Emperor William I, before 1945.", "Wikimedia Commons", 60]], { grade: "warm", pos: "50% 30%" }) },

    // ---- 3. BEFORE THE KNIGHTS, THE TEUTONIC ORDER (KB, OB)
    { id: "V11", part: "the knights", ref: "FA: who was there first", src: ["KB", "OB", "COORDS", "EOX"],
      vo: "Before any city stood here, the land belonged to the Old Prussians, a Baltic tribe. One of their settlements, on this spot, was called Twangste.",
      scene: M("BEFORE 1255", [V([21.0, 54.9], 6.2), V(C.Kaliningrad, 9.0, 190)], { points: [PT("tw", C.Kaliningrad, 90, true)], labels: [L([21.6, 55.0], "Old Prussian lands", "zone", 20), L(C.Kaliningrad, "Twangste", "place", 94, 22, -28), L([19.3, 55.3], "Baltic Sea", "water", 20)] }) },
    { id: "V12", part: "the knights", ref: "FA: a dated decision", src: ["OB", "KB", "COMMONS"],
      vo: "In the thirteenth century the Teutonic Order, a crusading order of knights, conquered the region and built a state ruled by the Church.",
      scene: P(A("kg-malbork"), "13TH CENTURY", [["The Teutonic Order established the State of the Teutonic Order, a theocracy.", "Wikipedia, 'Kaliningrad Oblast'", 70]], { pos: "50% 55%" }) },

    { id: "V14", part: "the knights", ref: "FA: the founding, dated", src: ["KB", "COMMONS"],
      vo: "In 1255 they destroyed Twangste and built a new fortress in its place, called Conigsberg.",
      scene: P(A("kg-castle-1900"), "FOUNDED 1255", [["Twangste was destroyed and replaced with a new fortress known as Conigsberg.", "Wikipedia, 'Königsberg'", 70]], { grade: "warm" }) },




    // ---- 4. POLAND, PRUSSIA, THE KINGS (OB, KB)
    { id: "V18", part: "Prussia", ref: "FA: the map carries the move", src: ["OB", "COORDS", "EOX"],
      vo: "After the Teutonic state lost a war with Poland it became a vassal of the Polish crown. During that war, in 1457, its capital moved from Marienburg to Königsberg.",
      scene: M("1457", [V([19.8, 54.4], 7.6), V([19.8, 54.4], 8.3, 200)], { points: [PT("mb", C.Malbork, 20), PT("kg", C.Kaliningrad, 120, true)], lines: [{ id: "cap", coords: [C.Malbork, C.Kaliningrad], from: 90, dur: 80, arrow: true, color: "#E5484D" }],
        labels: [L(C.Malbork, "Marienburg (Malbork)", "place", 24, -10, 34), L(C.Kaliningrad, "Königsberg", "place", 124, 20, -28)], tags: [T("CAPITAL MOVES TO KÖNIGSBERG", 1180, 300, 140)] }) },
    { id: "V19", part: "Prussia", ref: "FA: a painting as evidence", src: ["KB", "OB", "COMMONS"],
      vo: "In 1525 the Grand Master, Albert of Brandenburg, turned the Order's Prussian lands into the Duchy of Prussia and paid homage to the King of Poland as its first duke.",
      scene: P(A("kg-homage"), "1525", [["Albert of Brandenburg pays homage to King Sigismund I of Poland, 1525; painting by Jan Matejko, 1882.", "Wikipedia, 'Königsberg'", 70]], { fit: "contain", pos: "40% 50%" }) },

    { id: "V21", part: "Prussia", ref: "FA: institutions that outlive the war", src: ["KB", "COMMONS"],
      vo: "In 1544 Duke Albert founded the University of Königsberg. It became a centre of Protestant teaching and left a deep mark on Lithuanian culture.",
      scene: P(A("kg-albertinum"), "1544", [["The University of Königsberg, founded by Duke Albert in 1544.", "Wikipedia, 'Königsberg'", 70]], { pull: true, grade: "warm" }) },
    { id: "V22", part: "Prussia", ref: "FA: a detail that complicates the simple story", src: ["OB", "COMMONS"],
      vo: "It was never only German. The first Polish and Lithuanian catechisms and the first Lithuanian grammar book were all published in Königsberg.",
      scene: P(A("kg-merian-1651"), "KÖNIGSBERG, 1651", [["The first Polish and Lithuanian catechisms; the first Lithuanian grammar book.", "Wikipedia, 'Kaliningrad Oblast'", 70]], { fit: "contain" }) },
    { id: "V23", part: "Prussia", ref: "FA: a dated ceremony", src: ["KB", "COMMONS"],
      vo: "On the eighteenth of January 1701, Elector Frederick the Third was crowned in Königsberg Castle and became Frederick the First, King in Prussia.",
      scene: P(A("kg-coronation-1701"), "18 JANUARY 1701", [["Coronation of Frederick I in Königsberg Castle.", "Wikipedia, 'Königsberg'", 60]], { fit: "contain" }) },

    { id: "V25", part: "Prussia", ref: "FA: a human number", src: ["KB"],
      vo: "It was also a city of ideas. The philosopher Immanuel Kant lived there virtually all his life and rarely travelled more than ten miles from it.",
      scene: P(A("kg-kant"), "IMMANUEL KANT", [["Lived in Königsberg virtually all his life.", "Wikipedia, 'Königsberg'", 70]], { fit: "contain", pos: "50% 25%" }) },
    { id: "V26", part: "Prussia", ref: "FA: a diagram", src: ["CITY", "COMMONS"],
      vo: "In 1736 the mathematician Leonhard Euler wrote about the Seven Bridges of Königsberg, a paper that became a seminal work of graph theory and topology.",
      scene: P(A("kg-euler-fig", "png"), "1736", [["Leonhard Euler's 1736 paper on the Seven Bridges of Königsberg.", "Wikipedia, 'Kaliningrad'", 70]], { fit: "contain" }) },


    // ---- 5. THE FIRST EXCLAVE (EP, KB)
    { id: "V29", part: "the first exclave", ref: "FA: the map shows the problem, for the first time", src: ["EP", "KB", "COORDS", "EOX"],
      vo: "After the First World War the Treaty of Versailles gave most of West Prussia to Poland. East Prussia became an exclave, cut off from the rest of Germany by the Polish Corridor.",
      scene: M("1920", [V([16.5, 53.4], 4.6), V([17.5, 53.9], 5.6, 200)], { points: [PT("be", C.Berlin, 10), PT("kg", C.Kaliningrad, 20, true), PT("gd", C.Gdansk, 70)], lines: [{ id: "cut", coords: [C.Berlin, C.Gdansk, C.Kaliningrad], dash: [2, 1.5], from: 60, dur: 100, color: "#E5484D" }],
        labels: [L(C.Berlin, "Berlin", "place", 14, 18, -26), L(C.Kaliningrad, "Königsberg", "place", 24, 22, -28), L([18.4, 53.3], "Polish Corridor", "zone", 110), L([19.0, 52.2], "Poland", "country", 40)], tags: [T("EAST PRUSSIA: AN EXCLAVE OF GERMANY", 900, 300, 130)] }) },



    { id: "V33", part: "the first exclave", ref: "FA: a chart over a picture", src: ["KB"],
      vo: "In East Prussia's regional elections the Nazi Party won only four percent of the vote in 1925 and 1929. In 1933 it won fifty-eight percent.",
      scene: { type: "chart", image: A("kg-aerial-1944"), title: "Nazi Party vote, East Prussia's Landtag", sub: "Share of the vote", unit: "%", max: 70, bars: [{ label: "1925 / 1929", value: 4 }, { label: "1933", value: 58 }], source: "Source: Wikipedia, 'Königsberg'" } },

    // ---- 6. 1944-45 (KB, OB)
    { id: "V34", part: "1944-45", ref: "FA: the turn, dated", src: ["KB", "COMMONS"],
      vo: "In 1944 British bombing burned Königsberg for several days. The old centre, the cathedral, the castle, the old churches and the old university were destroyed.",
      scene: P(A("kg-aerial-1944"), "1944", [["Heavy damage from British bombing in 1944; the city burned for several days.", "Wikipedia, 'Königsberg'", 60], ["The historic centre, cathedral, castle, old churches and old university were destroyed.", "Wikipedia, 'Königsberg'", 140]], { pull: true, grade: "warm" }) },
    { id: "V35", part: "1944-45", ref: "FA: the human cost", src: ["KB", "OB", "COMMONS"],
      vo: "As the Red Army advanced, people fled. In the last days of the war more than two million people left East Prussia by sea.",
      scene: P(A("kg-refugees"), "1945", [["Refugees fleeing Königsberg before the advancing Red Army, 1945.", "Wikipedia, 'Königsberg'", 60], ["Over two million people fled East Prussia, evacuated by sea.", "Wikipedia, 'Kaliningrad Oblast'", 130]]) },

    { id: "V37", part: "1944-45", ref: "FA: the decisive day", src: ["KB", "COMMONS"],
      vo: "After a siege of three months, General Otto Lasch surrendered what remained of his forces on the ninth of April, a month before the war in Europe ended.",
      scene: P(A("kg-street-fight"), "9 APRIL 1945", [["Street fighting in Königsberg, 9 April 1945.", "Wikipedia, 'Battle of Königsberg'", 60]], { pos: "50% 45%" }) },
    { id: "V38", part: "1944-45", ref: "FA: stacked numbers", src: ["KB"],
      vo: "At the surrender the dead in the city, military and civilian, were estimated at forty-two thousand. The Red Army claimed over ninety thousand prisoners.",
      scene: { type: "figures", image: A("kg-street-fight"), title: "Königsberg, April 1945", rows: [{ value: "42,000", label: "military and civilian dead, estimated" }, { value: "90,000+", label: "prisoners claimed by the Red Army" }, { value: "120,000", label: "survivors remained in the ruins", source: "Source: Wikipedia, 'Königsberg'" }] } },


    // ---- 7. POTSDAM, THE NEW NAME, THE EXPULSION (PSD, KB, OB, CITY)
    { id: "V40", part: "Potsdam", ref: "FA: the decision, in the source's own words", src: ["PSD", "KB", "COMMONS"],
      vo: "At the Potsdam Conference that summer, the Allies considered a Soviet request: the city of Königsberg and the area around it.",
      scene: P(A("kg-potsdam"), "JULY - AUGUST 1945", [["Attlee, Truman and Stalin at the Potsdam Conference.", "Wikimedia Commons", 60]], { pull: true }) },
    { id: "V41", part: "Potsdam", ref: "FA: the text on screen", src: ["PSD", "KB"],
      vo: "The agreement says the conference agreed in principle to the ultimate transfer of the city to the Soviet Union, pending the peace settlement.",
      scene: P(A("kg-potsdam-table"), "1 AUGUST 1945", [["\"The Conference has agreed in principle to the proposal of the Soviet Government concerning the ultimate transfer to the Soviet Union of the City of Koenigsberg and the area adjacent to it.\"", "Potsdam Agreement, section V", 50]], { pos: "50% 40%" }) },

    { id: "V43", part: "Potsdam", ref: "FA: the map changes name", src: ["CITY", "OB", "KB", "COORDS", "EOX"],
      vo: "In 1946 Königsberg was renamed Kaliningrad, after Mikhail Kalinin, a Soviet leader who had no connection to the city. Two other places already carried his name.",
      scene: P(A("kg-kalinin"), "1946", [["Renamed Kaliningrad after Mikhail Kalinin, who was unrelated to the city.", "Wikipedia, 'Kaliningrad'", 70]], { fit: "contain", pos: "50% 20%" }) },
    { id: "V44", part: "Potsdam", ref: "FA: the map relabels itself", src: ["OB", "CITY", "KB", "COORDS", "EOX"],
      vo: "The German language was replaced by Russian, and German names across the region were replaced by Russian ones.",
      scene: M("1946", [V([20.9, 54.65], 8.4), V([20.9, 54.65], 9.2, 220)], { points: [PT("kg", C.Kaliningrad, 20), PT("bl", C.Baltiysk, 20), PT("ch", C.Chernyakhovsk, 20)],
        labels: [L(C.Kaliningrad, "Königsberg", "place", 24, 0, -30, 100), L(C.Kaliningrad, "Kaliningrad", "zone", 104, 0, -30), L(C.Baltiysk, "Pillau", "place", 30, -80, 30, 110), L(C.Baltiysk, "Baltiysk", "zone", 114, -80, 30), L(C.Chernyakhovsk, "Insterburg", "place", 36, 30, -30, 120), L(C.Chernyakhovsk, "Chernyakhovsk", "zone", 124, 30, -30)] }) },

    { id: "V46", part: "Potsdam", ref: "FA: a chart, with the source named", src: ["KB"],
      vo: "The German historian Andreas Kossert estimates that of up to 126,000 German civilians in the city when it fell, only 24,000 lived to be deported. Hunger caused three quarters of the deaths.",
      scene: { type: "chart", image: A("kg-street-fight"), title: "Causes of death, German civilians", sub: "Estimate by Andreas Kossert; epidemics 2.6% not shown", unit: "%", max: 100, bars: [{ label: "Hunger", value: 75 }, { label: "Violence", value: 15 }], source: "Source: Wikipedia, 'Königsberg', citing Andreas Kossert" } },
    { id: "V47", part: "Potsdam", ref: "FA: the replacement", src: ["OB", "CITY", "COORDS", "EOX"],
      vo: "The land was resettled with Soviet citizens, mostly ethnic Russians, but also Ukrainians and Belarusians. In 1950 the region had 1,165,000 inhabitants, about half the pre-war number.",
      scene: M("1950", [V([22.5, 54.9], 6.3), V([24.5, 54.8], 5.2, 200)], { points: [PT("kg", C.Kaliningrad, 20, true)], labels: [L(C.Kaliningrad, "Kaliningrad", "place", 24, 20, -28), L([24.6, 55.0], "Lithuanian SSR", "country", 70), L([27.2, 54.0], "Soviet Union", "country", 90)], tags: [T("1,165,000 INHABITANTS IN 1950", 1100, 300, 120)] }) },
    { id: "V48", part: "Potsdam", ref: "FA: a disputed motive", src: ["OB"],
      vo: "Why did Stalin make it a Russian region, not part of Soviet Lithuania? Some historians say it separated the Baltic states from the West; others, that it was too strategic for any other republic.",
      scene: M(null, [V([22.6, 55.0], 6.6), V([22.6, 55.0], 7.2, 200)], { points: [PT("kg", C.Kaliningrad, 10, true), PT("vi", C.Vilnius, 20)], labels: [L(C.Kaliningrad, "Kaliningrad", "place", 14, 20, -28), L([23.8, 55.4], "Lithuanian SSR", "country", 30), L(C.Vilnius, "Vilnius", "place", 40, 18, -26)] }) },

    { id: "V50", part: "Potsdam", ref: "FA: an irony", src: ["OB"],
      vo: "In the 1950s Khrushchev offered the whole oblast to Lithuania. Its leader, Antanas Sniečkus, refused, because it would add at least a million ethnic Russians.",
      scene: M("1950s", [V(REG, 6.2), V([23.2, 55.0], 6.0, 200)], { points: [PT("kg", C.Kaliningrad, 20, true)], lines: [{ id: "offer", coords: [C.Kaliningrad, C.Vilnius], dash: [2, 1.5], from: 60, dur: 80, arrow: true, color: "#F5C84B" }], labels: [L(C.Kaliningrad, "Kaliningrad", "place", 24, 20, -28), L(C.Vilnius, "Lithuanian SSR", "zone", 100, 18, -30)], tags: [T("OFFER REFUSED", 1200, 300, 150)] }) },

    { id: "V52", part: "Potsdam", ref: "FA: the old city erased", src: ["CITY", "OB", "COMMONS"],
      vo: "The old city was never restored. In the late 1960s the ruins of Königsberg Castle were demolished on Leonid Brezhnev's personal orders, despite protests.",
      scene: P(A("kg-castle-ruins"), "1965", [["Castle ruins, 1965.", "Wikimedia Commons", 60]], { pull: true, fit: "contain" }) },


    // ---- 8. 1990-2002: COLLAPSE, ISOLATION, THE CORRIDOR (KB, OB, GAP)
    { id: "V54", part: "1990", ref: "FA: the settlement", src: ["KB", "OB", "COMMONS"],
      vo: "The final word came on the twelfth of September 1990, when the Treaty on the Final Settlement with Respect to Germany was signed.",
      scene: P(A("kg-2plus4"), "12 SEPTEMBER 1990", [["The borders left open at Potsdam were settled.", "Wikipedia, 'Königsberg'", 60]], { fit: "contain" }) },

    { id: "V56", part: "1990", ref: "FA: the map shows the new problem", src: ["OB", "GAP", "COORDS", "EOX"],
      vo: "Lithuania became independent in 1990 and the Soviet Union dissolved in 1991. Kaliningrad was suddenly cut off from the rest of Russia.",
      scene: M("1990 - 1991", [V([26.5, 55.0], 4.9), V([27.5, 55.2], 4.5, 200)], { points: [PT("kg", C.Kaliningrad, 20, true), PT("mo", C.Moscow, 80)], labels: [L(C.Kaliningrad, "Kaliningrad", "place", 24, 20, -28), L([24.0, 55.6], "Lithuania", "country", 40), L([27.5, 53.6], "Belarus", "country", 50), L(C.Moscow, "Moscow", "place", 90, -10, -26)], tags: [T("CUT OFF FROM RUSSIA", 1100, 300, 120)] }) },
    { id: "V57", part: "1990", ref: "FA: why it hardened", src: ["OB", "GAP"],
      vo: "Then Poland and Lithuania joined NATO and the European Union and imposed strict border controls. Every land link between the region and the rest of Russia now crosses NATO and EU territory.",
      scene: M(null, [V([26.0, 55.0], 5.0), V([24.0, 54.8], 5.8, 220)], { points: [PT("kg", C.Kaliningrad, 20), PT("mo", C.Moscow, 20)], lines: [{ id: "land", coords: [C.Kaliningrad, C.Vilnius, C.Moscow], dash: [2, 1.5], from: 50, dur: 120, color: "#E5484D" }], labels: [L(C.Kaliningrad, "Kaliningrad", "place", 24, 20, -28), L([21.0, 53.5], "Poland (NATO, EU)", "country", 60), L([23.8, 55.5], "Lithuania (NATO, EU)", "country", 80), L(C.Moscow, "Moscow", "place", 40, -10, -26)] }) },
    { id: "V58", part: "1990", ref: "FA: the first request", src: ["GAP"],
      vo: "In 1990 a Kaliningrad official proposed a special corridor through Poland to Belarus. Gorbachev vetoed it and told them to stop spreading panic.",
      scene: P(A("kg-tripoint"), "1990", [["Gorbachev vetoed the proposal, urging them to \"stop spreading panic\".", "Wikipedia, 'Suwałki Gap'", 60]], { pos: "50% 55%" }) },
    { id: "V59", part: "1990", ref: "FA: the second request, drawn", src: ["GAP", "COORDS", "EOX"],
      vo: "After 1991 Russia asked again, now for a \"communication corridor\" to Grodno in Belarus. In 1996 Boris Yeltsin said he would ask Poland for permission to build a motorway.",
      scene: M("1994 - 1996", [V([22.6, 54.0], 6.4), V([22.6, 54.0], 7.0, 200)], { points: [PT("kg", C.Kaliningrad, 10), PT("gr", C.Grodno, 20)], lines: [{ id: "corr", coords: [C.Kaliningrad, C.Grodno], dash: [2, 1.5], from: 50, dur: 100, color: "#F5C84B" }], labels: [L(C.Kaliningrad, "Kaliningrad", "place", 14, 20, -28), L(C.Grodno, "Grodno", "place", 24, 18, 30), L([21.4, 53.4], "Poland", "country", 20)], tags: [T("PROPOSED CORRIDOR (SCHEMATIC)", 1000, 300, 110)] }) },
    { id: "V60", part: "1990", ref: "FA: the refusal, with reason", src: ["GAP", "COMMONS"],
      vo: "Poland refused. To many Poles, the word corridor sounded too much like Germany's demand for a link through the Polish Corridor, just before it invaded in 1939.",
      scene: P(A("kg-corridor-map", "jpg"), "POLAND REFUSES", [["A \"corridor\" sounded like the German request before the 1939 invasion of Poland.", "Wikipedia, 'Suwałki Gap'", 70]], { fit: "contain" }) },
    { id: "V61", part: "1990", ref: "FA: the compromise", src: ["GAP"],
      vo: "In 2001 and 2002, as Poland and Lithuania prepared to join the EU, Russia asked for free twelve-hour transit. That was rejected too. Instead came special transit permits, for Lithuania only.",
      scene: { type: "figures", image: A("kg-tripoint"), title: "Kaliningrad transit, 2001-2002", rows: [{ value: "12 hours", label: "free transit, asked by Russia: rejected" }, { value: "FTD", label: "Facilitated Transit Document, for road trips through Lithuania" }, { value: "FRTD", label: "Facilitated Rail Transit Document, for trains through Lithuania", source: "Source: Wikipedia, 'Suwałki Gap'" }] } },

    // ---- 9. TODAY: ECONOMY AND ARMS (OB, GAP)
    { id: "V62", part: "today", ref: "FA: the consequence, with a number", src: ["OB"],
      vo: "The isolation hurt. In 1996 Russia gave the oblast special economic status with tax incentives, to attract investors in a region with high unemployment.",
      scene: { type: "figures", image: A("kg-cathedral-2012"), title: "Kaliningrad Oblast, 2022", rows: [{ value: "1996", label: "special economic status, with tax incentives" }, { value: "US$10.6 bn", label: "gross regional product in 2022, about US$10,000 per person", source: "Source: Wikipedia, 'Kaliningrad Oblast'" }] } },


    { id: "V65", part: "today", ref: "FA: the latest chapter", src: ["OB", "COORDS", "EOX"],
      vo: "In February 2025 the Baltic states disconnected their grids from Russia's and joined the European network via Poland. Kaliningrad's grid became an island.",
      scene: M("FEBRUARY 2025", [V([22.6, 55.6], 5.4), V([22.6, 55.6], 6.0, 200)], { points: [PT("kg", C.Kaliningrad, 20, true)], labels: [L(C.Kaliningrad, "Kaliningrad grid", "zone", 24, 30, -34), L([24.6, 56.4], "Baltic states", "country", 30), L([20.2, 52.8], "Poland", "country", 40)], tags: [T("GRID ISLANDED", 1150, 300, 110)] }) },
    { id: "V66", part: "today", ref: "FA: the military facts, sourced", src: ["OB", "COMMONS"],
      vo: "Kaliningrad is strategically important for Russia's forces. Before 2022 its ground defence was anchored by the 11th Army Corps, over twelve thousand troops. Much of it was redeployed to Ukraine.",
      scene: P(A("kg-baltiysk-harbour"), "BEFORE 2022", [["Over 12,000 dedicated land troops; substantial portions redeployed to the front lines in Ukraine.", "Wikipedia, 'Kaliningrad Oblast'", 70]], { pos: "50% 40%" }) },
    { id: "V67", part: "today", ref: "FA: the weapons, named as the source names them", src: ["GAP", "COMMONS"],
      vo: "Iskander-M missiles, which can carry thermonuclear warheads, were installed in 2018. More followed in the late 2010s: Bastion-P and Oniks anti-ship missiles and S-400 air defence.",
      scene: P(A("kg-iskander"), "2018", [["An Iskander launcher. Iskander-M missiles were installed in the region in 2018.", "Wikipedia, 'Suwałki Gap'; photo: Wikimedia Commons", 60]], { pos: "50% 50%" }) },
    { id: "V68", part: "today", ref: "FA: the mechanism, drawn", src: ["GAP", "COORDS", "EOX"],
      vo: "That is why the gap worries NATO planners. Short-range rockets could reach supplies moving through it, and missiles in Kaliningrad threaten the sea and air routes as well.",
      scene: M(null, [V([22.0, 54.9], 6.4), V([22.0, 54.9], 7.0, 200)], { points: [PT("kg", C.Kaliningrad, 10, true), PT("su", C.Suwalki, 40)], lines: [{ id: "a", coords: [C.Kaliningrad, C.Suwalki], from: 60, dur: 70, arrow: true, color: "#E5484D" }, { id: "b", coords: [C.Kaliningrad, [19.0, 55.8]], from: 110, dur: 60, arrow: true, color: "#E5484D" }], labels: [L(C.Kaliningrad, "Kaliningrad", "place", 14, 20, -28), L(C.Suwalki, "The gap", "zone", 44, 24, 30), L([19.3, 56.0], "Sea routes", "water", 120)], tags: [T("SEA AND AIR ROUTES ARE THREATENED TOO", 880, 300, 130)] }) },
    { id: "V69", part: "today", ref: "FA: the 2022 test", src: ["OB", "GAP"],
      vo: "In 2022 Lithuania began enforcing EU sanctions, and about half of the goods going into Kaliningrad by rail were blocked. Food, medicine and passenger travel were exempt.",
      scene: { type: "figures", image: A("kg-tripoint"), title: "Transit, 2022", rows: [{ value: "~50%", label: "of goods imported by rail blocked by Lithuania's enforcement of EU sanctions" }, { value: "Exempt", label: "food, medicine and passenger travel", source: "Source: Wikipedia, 'Kaliningrad Oblast'" }] } },



    // ---- 10. THE GAP IN DEPTH (GAP)
    { id: "V72", part: "the gap", ref: "FA: back to the opening map, now understood", src: ["GAP", "COORDS", "EOX"],
      vo: "Now look at the gap again. Its hills, lakes and forests are crossed by only two major roads and one rail line linking Poland with Lithuania.",
      scene: M(null, [V(GAPV, 8.4), V(GAPV, 7.2, 200)], { points: [PT("su", C.Suwalki, 20, true)], labels: [L(C.Suwalki, "Suwałki", "place", 24, 18, 34), L([21.6, 53.6], "Poland", "country", 30), L([24.6, 55.0], "Lithuania", "country", 40)], tags: [T("2 MAJOR ROADS, 1 RAIL LINE", 1180, 300, 100)] }) },
    { id: "V73", part: "the gap", ref: "FA: what runs through it", src: ["GAP"],
      vo: "Through this strip run the Via Baltica road, a gas pipeline that opened on the first of May 2022, a power line opened in late 2015, and the Rail Baltica railway, still under construction.",
      scene: { type: "figures", image: A("kg-dragoon-ride"), title: "What passes through the gap", rows: [{ value: "E67", label: "Via Baltica, the road link from Finland and the Baltic states" }, { value: "2022", label: "gas interconnection Poland-Lithuania opens, 1 May" }, { value: "2015", label: "LitPol Link, the only land power line, opens" }, { value: "Rail Baltica", label: "standard-gauge railway, under construction", source: "Source: Wikipedia, 'Suwałki Gap'" }] } },

    { id: "V76", part: "the gap", ref: "FA: the response", src: ["GAP", "COMMONS"],
      vo: "NATO added forces. In spring 2022 about sixteen hundred troops from Germany, Czechia, Norway and the Netherlands stood in Lithuania, and Germany later said it would raise its presence to four thousand.",
      scene: P(A("kg-dragoon-ride"), "NATO'S RESPONSE", [["Germany announced in June 2023 that it would increase its presence to 4,000 troops.", "Wikipedia, 'Suwałki Gap'", 70]], { pull: true }) },
    { id: "V77", part: "the gap", ref: "FA: a simulation", src: ["GAP"],
      vo: "In 2016 the RAND Corporation ran simulations. With the NATO forces then available, an unexpected attack would have Russian troops enter or approach Riga and Tallinn within thirty-six to sixty hours.",
      scene: { type: "scale", title: "RAND simulation, 2016: hours until Russian troops approach Riga and Tallinn", unit: "hours", rows: [{ label: "Fastest", value: 36 }, { label: "Slowest", value: 60 }], source: "Source: Wikipedia, 'Suwałki Gap'" } },
    { id: "V78", part: "the gap", ref: "FA: the counter-view", src: ["GAP"],
      vo: "Not every expert agrees. Michael Kofman compared the gap to a MacGuffin. Franz-Stefan Gady said capturing a Baltic state would be easier. Alexander Lanoszka said Russia has no interest in closing it.",
      scene: { type: "figures", image: A("kg-cathedral-2012"), title: "Analysts disagree", rows: [{ value: "Kofman", label: "The gap is a MacGuffin: unimportant by itself", source: "Michael Kofman, CNA" }, { value: "Gady", label: "Capturing a Baltic state would be easier", source: "Franz-Stefan Gady, IISS" }, { value: "Lanoszka", label: "Russia has no interest in closing the gap", source: "Alexander Lanoszka, Chatham House. All via Wikipedia, 'Suwałki Gap'" }] } },


    // ---- 11. CLOSE
    { id: "V80", part: "close", ref: "FA 40:00 the thesis restated", src: ["OB", "CITY", "KB", "GAP", "COMMONS"],
      vo: "A city founded by crusading knights and crowned with Prussian kings, renamed after a Soviet official, now sits at the centre of NATO's planning.",
      scene: P(A("kg-cathedral-night"), "KALININGRAD", [["The coronation city of the Prussian monarchy.", "Wikipedia, 'Kaliningrad'", 60]], { pull: true }) },
    { id: "V81", part: "close", ref: "FA: the closing question", src: ["GAP"],
      vo: "Some analysts say the gap is NATO's Achilles' heel. Others say it is overblown. Should Europe worry more about Kaliningrad, or less? Tell us what you think in the comments.",
      scene: M(null, [V(GAPV, 5.6), V(REG, 6.0, 220)], { points: [PT("su", C.Suwalki, 20, true), PT("kg", C.Kaliningrad, 40, true)], labels: [L(C.Suwalki, "The gap", "zone", 24, 24, 30), L(C.Kaliningrad, "Kaliningrad", "place", 44, 20, -28)], tags: [T("WORRY MORE, OR LESS?", 1300, 300, 80)] }) },
  ],
  thumbs: [{ name: "thumb1-kaliningrad-v2", big: "Russia owns\na piece of\nGermany", small: "Kaliningrad", image: A("kg-castle-1900") }],
};
