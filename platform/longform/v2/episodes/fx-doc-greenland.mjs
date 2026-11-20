// Faceless breakout experiment, pilot A (documentary), 20 Nov 2026: "The Real Reason the United States Never Bought Greenland".
// Format learned from Okeanos History (faceless-breakout-experiment/formulas/documentary-formula.md): dated cold open with a scale fact, the puzzle, the usual
// answer granted, why it is not enough, a promise of named moments, chronological chapters ending on open questions, a layered verdict, a closing line.
// Facts: ONLY the Wikipedia articles snapshotted in data/longform/fx-doc/greenland/*.wiki on 20 Nov 2026 ("Proposed United States acquisition of Greenland" = ACQ,
// "Greenland crisis" = GC). Quoted documents are shown as typeset text "as quoted in" the source, never as fake scans. Pictures: Wikimedia Commons, licence-checked.
import { existsSync, readFileSync } from "node:fs";
const attPath = new URL("../../../../src/skills/remotion-render/public/lf2/fx-doc/ATTRIBUTIONS.json", import.meta.url);
const att = existsSync(attPath) ? JSON.parse(readFileSync(attPath, "utf8")) : {};
const IMG = (id) => (att[id] ? `lf2/fx-doc/${att[id].file}` : "lf2/hidden-past/tex-terrain.jpg"), CR = (id) => (att[id] ? att[id].credit_line : "picture pending");
const W = (t, slug) => ({ title: `Wikipedia: ${t}`, url: `https://en.wikipedia.org/wiki/${slug}`, retrieved: "2026-11-20" });
export const SOURCES = { ACQ: W("Proposed United States acquisition of Greenland", "Proposed_United_States_acquisition_of_Greenland"), GC: W("Greenland crisis", "Greenland_crisis"), NE: { title: "Natural Earth 1:50m countries (public domain), modern boundaries", url: "https://www.naturalearthdata.com/", retrieved: "2026-11-20" } };

const GEO = { base: "lf2/fx-doc/geo/world-50m.json", realms: "lf2/fx-doc/geo/realms.json" };
const V = (center, scale, f = 0) => ({ f, center, scale });
const map = (o) => ({ type: "eppmap", geo: GEO, rivers: false, note: { text: "Modern boundaries", from: 20 }, credit: "Base: Natural Earth (public domain)", ...o });
const RL = (keys, from = 0) => keys.map((key, n) => ({ key, color: key, from: from + n * 12 }));
const photo = (id, banner, o = {}) => ({ type: "fxphoto", image: IMG(id), credit: CR(id), banner, ...o });
const cards = (ids, banner, o = {}) => { const L = [[[560, 150, 800, 620, -2]], [[250, 170, 640, 560, -4], [1030, 210, 640, 560, 3]], [[130, 200, 520, 480, -5], [700, 150, 520, 480, 2], [1270, 220, 520, 480, -3]]][ids.length - 1];
  return { type: "fxcards", cards: ids.map((c, i) => { const [x, y, w, h, rot] = L[i], o2 = typeof c === "string" ? { id: c } : c; return { image: IMG(o2.id), x, y, w, h, rot, caption: o2.caption, pos: o2.pos }; }), banner, credits: ids.map((c) => CR(typeof c === "string" ? c : c.id)).join(" · "), ...o }; };
const page = (title, lines, mark, source, banner) => ({ type: "fxpage", title, lines, mark, source, banner });
const stat = (value, label, source, banner) => ({ type: "fxstat", value, label, source, banner });
let n = 0; const beat = (part, vo, scene, src = ["ACQ"]) => ({ id: `A${String(++n).padStart(2, "0")}`, part, src, vo, scene });
const CH = (num, title) => ({ text: title, date: `CHAPTER ${num}` });

export const EPISODE = {
  channel: "fx-doc", slug: "greenland", title: "The Real Reason the United States Never Bought Greenland", target_minutes: 22,
  blurb: ["The United States has tried to get Greenland at least six times since 1867. It has never owned it. The usual answer is that Denmark won't sell. The real answer is stranger.", "", "Every fact in this video comes from the sources listed below. Pictures: Wikimedia Commons (credits on screen). Narration is a synthetic voice."],
  sound: { bed: null },
  thumb: photo("gl-thule-aerial", { text: "Never sold" }),
  beats: [
    // ---- cold open
    beat("open", "On the fourteenth of December, nineteen forty-six, the American Secretary of State, James Byrnes, handed a memorandum to the Danish foreign minister, Gustav Rasmussen, who was visiting the United States.",
      cards([{ id: "gl-byrnes", caption: "James F. Byrnes" }], { text: "Washington, 14 December 1946" })),
    beat("open", "It offered Denmark one hundred million dollars, in gold bullion, for Greenland.",
      stat("$100,000,000", "in gold, for Greenland · offered 14 December 1946", "Wikipedia, 'Proposed United States acquisition of Greenland'")),
    beat("open", "Greenland covers more than two million square kilometres, roughly three times the size of Texas. If the United States had bought it, it would have been the largest territorial acquisition in American history, slightly larger than the Louisiana Purchase.",
      map({ views: [V([-40, 72], 520), V([-45, 68], 420, 300)], realms: RL(["greenland", "usa", "canada"], 0), labels: [{ at: [-41, 74], text: "Greenland", kind: "country", from: 10 }, { at: [-100, 42], text: "United States", kind: "country", from: 30 }, { at: [-100, 60], text: "Canada", kind: "region", from: 40 }] })),
    beat("open", "And Denmark was in no position to argue. It was a small country, just out of a German occupation, with American soldiers already stationed on the island and no means to make them leave.",
      cards(["gl-f89", "gl-thule-radar"], { text: "American forces in Greenland" })),
    beat("open", "Rasmussen said no.",
      stat("No.", "Denmark's answer, December 1946", "")),
    beat("open", "That was not the first American attempt to get Greenland, and it was not the last. There were talks in eighteen sixty-seven, in nineteen ten, in nineteen forty-six, in nineteen fifty-five, in twenty nineteen, and again from twenty twenty-five. Every single time, the answer was no.",
      { type: "fxcards", ...cards(["gl-seward", "gl-byrnes", "gl-trump-frederiksen"], { text: "1867 · 1910 · 1946 · 1955 · 2019 · 2025" }) }),
    beat("open", "So why, in a hundred and sixty years, has the most powerful country on Earth never managed to buy an island it wanted that badly?",
      photo("gl-icesheet", null, { sub: "Why has the United States never bought Greenland?" })),
    beat("open", "The usual answer is simple: Denmark won't sell. And that's not wrong, exactly. Danish governments have refused every offer, often in the same words. Greenland is not for sale.",
      photo("gl-christiansborg", { text: "Copenhagen · Christiansborg" })),
    beat("open", "But it can't be the whole answer. Because for most of that time, Denmark could not have stopped the Americans from doing almost anything they wanted on the island. And in the nineteen fifties, the American government itself wrote down why it no longer needed to buy it.",
      photo("gl-thule-aerial", { text: "Thule Air Base, northern Greenland" })),
    beat("open", "The real reason runs through a declaration signed for a group of Caribbean islands, an ambassador who made a treaty his own government said he had no right to make, a secret offer that stayed classified for decades, and a base that once held almost ten thousand Americans.",
      cards(["gl-stcroix", "gl-kauffmann", "gl-thule-aerial"], null)),
    // ---- chapter 1
    beat("seward", "In eighteen sixty-seven, the American Secretary of State, William Seward, bought Alaska from the Russian Empire. In the same year he called the idea of annexing both Greenland and Iceland worthy of serious consideration.",
      cards([{ id: "gl-seward", caption: "William H. Seward" }, { id: "gl-alaska", caption: "The Alaska Purchase cheque" }], CH(1, "Seward's other island"))),
    beat("seward", "Seward commissioned a report on the two islands from the United States Coast Survey. Published in eighteen sixty-eight, it praised Greenland's unusual healthfulness, its fish, its game and its minerals. It even predicted that owning Greenland would encourage Canada, squeezed between American territory on both sides, to join the United States.",
      page("A Report on the Resources of Iceland and Greenland (1868)", ["The report described Greenland's \"unusual healthfulness\"", "and large amounts of fish, game, and minerals.", "It predicted annexation would encourage Canada to join the United States."], "unusual healthfulness", "Summary as given in Wikipedia, 'Proposed United States acquisition of Greenland'", { text: "Seward's report, 1868" })),
    beat("seward", "Negotiations to buy both islands for five and a half million dollars in gold were reportedly nearly complete. But Seward never made the offer.",
      stat("$5,500,000", "in gold, for Greenland and Iceland · 1868, never offered", "Wikipedia, 'Proposed United States acquisition of Greenland'")),
    beat("seward", "The likely reason had nothing to do with Greenland. Congress had refused to approve a treaty to buy the Danish West Indies, and President Andrew Johnson was so unpopular with Congress that anything associated with him was unlikely to pass.",
      map({ views: [V([-50, 45], 380), V([-60, 35], 420, 300)], realms: RL(["usa", "greenland", "denmark"], 0), labels: [{ at: [-41, 72], text: "Greenland", kind: "country", from: 10 }, { at: [-64.8, 18.3], text: "Danish West Indies", kind: "place", from: 40 }] })),
    beat("seward", "In nineteen ten, the American ambassador in Copenhagen, Maurice Egan, passed on an even stranger idea from Danish friends: the United States would trade two Philippine islands, Mindanao and Palawan, for Greenland and the Danish West Indies. Denmark would then trade the Philippine islands to Germany, for the lost province of Northern Schleswig. Nothing came of it.",
      page("1910: a three-way swap, as discussed", ["United States → Denmark: Mindanao and Palawan", "Denmark → United States: Greenland and the Danish West Indies", "Denmark → Germany: Mindanao and Palawan, for Northern Schleswig"], "Greenland", "As described in Wikipedia, 'Proposed United States acquisition of Greenland'", { text: "Copenhagen, 1910" })),
    // ---- chapter 2
    beat("1916", "During the First World War, Washington wanted the Danish West Indies again, this time to protect the approaches to the Panama Canal. Denmark wanted something in return: American recognition of its claim to the whole of Greenland.",
      cards([{ id: "gl-stcroix", caption: "The last Danish parade, Saint Croix" }], CH(2, "The declaration of 1916"))),
    beat("1916", "Secretary of State Robert Lansing proposed combining the two. In nineteen sixteen Denmark sold the islands, which became the United States Virgin Islands. And alongside the treaty, Lansing issued a declaration that the United States would not object to Denmark extending its political and economic interests to the whole of Greenland.",
      page("Declaration by Secretary of State Robert Lansing, 1916", ["The United States \"will not object to the Danish Government", "extending their political and economic interests", "to the whole of Greenland\"."], "to the whole of Greenland", "As quoted in Wikipedia, 'Proposed United States acquisition of Greenland'", { text: "Washington, 1916" })),
    beat("1916", "Lansing later explained that this recognition was the key concession that persuaded the reluctant Danes to sell. Greenland was the price of the Virgin Islands.",
      photo("gl-stcroix", { text: "The price of the Virgin Islands" })),
    beat("1916", "Not everyone agreed. The explorer Robert Peary, who had spent years in the far north of Greenland, believed the United States should claim the island, for its minerals and to keep foreign bases away from America as aircraft and ships improved.",
      cards([{ id: "gl-peary", caption: "Robert Peary, 1909" }], { text: "The case against 1916" })),
    beat("1916", "Thirty years later, Time magazine would write that Lansing had erred in giving up the American claim to what it called the world's largest island and stationary aircraft carrier. The question was whether that mistake could be bought back.",
      page("Time, January 1947", ["Lansing had erred in relinquishing the American claim to", "\"the world's largest island and stationary aircraft carrier\"."], "stationary aircraft carrier", "As quoted in Wikipedia, 'Proposed United States acquisition of Greenland'", { text: "Time magazine, 1947" })),
    // ---- chapter 3
    beat("war", "In nineteen thirty-nine, Secretary of State Cordell Hull's staff advised him not to offer to buy Greenland. The Secretary of War, Harry Woodring, said the island was too far from American sea and air routes to matter.",
      cards([{ id: "gl-hull", caption: "Cordell Hull" }], CH(3, "The good traitor"))),
    beat("war", "Within a year, that changed. On the ninth of April nineteen forty, Germany invaded Denmark. And with Denmark occupied, Germany had a strong legal claim to its colony across the Atlantic.",
      map({ views: [V([-20, 62], 520), V([0, 58], 640, 300)], realms: RL(["denmark", "greenland", "iceland"], 0), labels: [{ at: [10, 56.5], text: "Denmark", kind: "region", from: 20 }, { at: [-41, 72], text: "Greenland", kind: "country", from: 30 }, { at: [-19, 65], text: "Iceland", kind: "region", from: 40 }] })),
    beat("war", "Greenland mattered for more than its position. It was the only known significant source of cryolite at the time. And the Germans were trying to use the island for weather stations in the North Atlantic.",
      cards([{ id: "gl-cryolite", caption: "The cryolite mine at Ivittuut" }, { id: "gl-edelweiss", caption: "German weather crew captured, 1944" }], { text: "Cryolite and weather" })),
    beat("war", "So for the first time, the United States applied the Monroe Doctrine to a European colony in the North Atlantic. It landed armed Coast Guard personnel in Greenland, but first formally discharged them from service and reconstituted them as volunteers, a legal fiction to avoid charges of an American invasion.",
      photo("gl-edelweiss", { text: "A neutral occupation" })),
    beat("war", "Then, on the ninth of April nineteen forty-one, exactly a year after the invasion of Denmark, Hull signed an agreement on the defence of Greenland with the Danish ambassador in Washington, Henrik Kauffmann.",
      cards([{ id: "gl-kauffmann", caption: "Henrik Kauffmann" }], { text: "Washington, 9 April 1941" })),
    beat("war", "Kauffmann signed without the consent of his government. Copenhagen, under German occupation, declared the agreement void and recalled him. He stayed in the United States anyway. After the war, Denmark recognised him again as its ambassador. He became known as the good traitor.",
      page("Agreement Relating to the Defense of Greenland, 1941", ["Signed by Cordell Hull and Henrik Kauffmann, 9 April 1941.", "The Danish government considered it void and recalled Kauffmann.", "After the war it recognised \"the good traitor\" as ambassador again."], "the good traitor", "As described in Wikipedia, 'Proposed United States acquisition of Greenland'", { text: "The Kauffmann agreement" })),
    beat("war", "In July nineteen forty-one, the US Army began building Bluie West One, the first of several American bases on the island. The agreement had one clause that would matter enormously later. It would remain in force until both sides agreed that the threat to the American continent had ended.",
      photo("gl-f89", { text: "American bases in Greenland" })),
    // ---- chapter 4
    beat("1946", "When the war ended, Denmark expected the Americans to go home. They didn't. The Danish government had understood the threat to mean the world war. The Americans understood it to include a new one, from the Soviet Union.",
      cards(["gl-thule-radar"], CH(4, "The secret offer"))),
    beat("1946", "In nineteen forty-six, the Joint Chiefs of Staff listed Greenland and Iceland as two of the three essential international locations for American bases. Greenland sat on the shortest polar route between Washington and Moscow, about midway between the two cities.",
      map({ views: [V([-30, 70], 300), V([-20, 66], 340, 300)], realms: RL(["usa", "greenland", "russia"], 0), points: [{ at: [-77.04, 38.9], from: 30 }, { at: [37.62, 55.75], from: 40 }], labels: [{ at: [-77, 36.5], text: "Washington", kind: "place", from: 34 }, { at: [37.6, 53.6], text: "Moscow", kind: "place", from: 44 }, { at: [-41, 72], text: "Greenland", kind: "country", from: 20 }] })),
    beat("1946", "A State Department official, William Trimble, argued that while few people in Denmark had any real interest in Greenland, owning it would give the United States staging areas for military operations over the Arctic. He suggested the price: one hundred million dollars. He also discussed an alternative, a swap for land at Point Barrow in Alaska.",
      stat("$100M", "or land at Point Barrow, Alaska · William Trimble's options", "Wikipedia, 'Proposed United States acquisition of Greenland'")),
    beat("1946", "Had that trade happened, from nineteen sixty-seven Denmark would have benefited from the Prudhoe Bay oil field, the richest petroleum discovery in American history.",
      map({ views: [V([-150, 69], 900), V([-149, 70], 1300, 300)], realms: RL(["usa", "canada"], 0), points: [{ at: [-156.8, 71.3], from: 20 }, { at: [-148.3, 70.3], from: 60 }], labels: [{ at: [-156.8, 72], text: "Point Barrow", kind: "place", from: 24 }, { at: [-148.3, 69.6], text: "Prudhoe Bay", kind: "place", from: 64 }] })),
    beat("1946", "Byrnes's memorandum offered Rasmussen three choices: a ninety-nine-year lease on the American bases, the United States taking over the defence of the island entirely, or an outright purchase. Washington preferred the purchase. A sale, the Americans said, would be the most clean-cut and satisfactory.",
      page("Memorandum, James F. Byrnes to Gustav Rasmussen, 14 Dec 1946", ["1. A 99-year lease on the existing American bases", "2. The United States wholly takes over the defence of Greenland", "3. Purchase: \"the most clean-cut and satisfactory\""], "the most clean-cut and satisfactory", "As described and quoted in Wikipedia, 'Proposed United States acquisition of Greenland'", { text: "Three options" })),
    beat("1946", "Byrnes wrote afterwards that the American needs seemed to come as a shock to Rasmussen. And they did, partly because Kauffmann had played down the purchase proposals in his reports home, saying the idea was considered ridiculous in Washington, when it was not.",
      cards([{ id: "gl-byrnes", caption: "Byrnes" }, { id: "gl-kauffmann", caption: "Kauffmann" }], { text: "A shock in Washington" })),
    beat("1946", "Rasmussen declined all three options. He told the American ambassador: while we owe much to America, I do not feel that we owe them the whole island of Greenland.",
      page("Gustav Rasmussen to US ambassador Josiah Marvel", ["\"While we owe much to America I do not feel", "that we owe them the whole island of Greenland.\""], "the whole island of Greenland", "As quoted in Wikipedia, 'Proposed United States acquisition of Greenland'", { text: "Copenhagen, 1946" })),
    beat("1946", "Money was not the obstacle. Denmark owed American investors seventy million dollars, it was short of dollars after the war, and rumours in Copenhagen put the price as high as a billion. Every Danish political party rejected a sale anyway.",
      stat("$1,000,000,000", "the price rumoured in Copenhagen · every Danish party rejected a sale", "Wikipedia, 'Proposed United States acquisition of Greenland' (Time, 1947)")),
    beat("1946", "Because for Danes, the West Indies had been an investment. Greenland was something else: since the Danish Golden Age of the nineteenth century, the North Atlantic colonies had been part of Denmark's Viking history and its national identity.",
      photo("gl-hvalsey", { text: "Hvalsey Church · Norse Greenland" })),
    beat("1946", "The offer stayed secret. It was classified until the nineteen seventies, and a Danish newspaper, Jyllands-Posten, only reported it in nineteen ninety-one. So the Americans had offered a fortune, and been refused. And yet they were still there. What would they do next?",
      photo("gl-oldmap", { text: "Classified until the 1970s" })),
    // ---- chapter 5: the real answer
    beat("1951", "By the spring of nineteen forty-eight, Denmark had given up trying to persuade the Americans to leave. A Danish minister wrote in his diary that the American de facto partial occupation of Greenland was something Denmark did not have the power to prevent.",
      cards(["gl-christiansborg"], CH(5, "Everything but the deed"))),
    beat("1951", "In nineteen forty-nine, both countries joined NATO. And in April nineteen fifty-one, they signed the Greenland Defense Agreement.",
      photo("gl-thule-aerial", { text: "The 1951 Defense Agreement" })),
    beat("1951", "It let the United States keep its bases in Greenland, and build new ones, called defence areas, if NATO considered them necessary. American forces could use and move between them freely. In return, the Americans could not infringe on Danish sovereignty. And the agreement would last as long as the NATO treaty itself.",
      page("Greenland Defense Agreement, April 1951", ["The United States keeps its bases, and may establish new \"defense areas\"", "if NATO deems it necessary; its forces move freely between them;", "it may not infringe on Danish sovereignty. It lasts as long as NATO."], "as long as NATO", "As described in Wikipedia, 'Proposed United States acquisition of Greenland'", { text: "Copenhagen, April 1951" })),
    beat("1951", "The BBC would later describe it simply. The nineteen fifty-one agreement, in effect, gave the United States whatever it wanted.",
      page("BBC, on the 1951 agreement", ["\"in effect, gave the US whatever it wanted\""], "whatever it wanted", "As quoted in Wikipedia, 'Proposed United States acquisition of Greenland'", null)),
    beat("1951", "Even so, in nineteen fifty-five, the Joint Chiefs of Staff asked President Eisenhower to try to buy Greenland one more time. Sovereignty, they wrote, provides the firmest basis for assuring that a territory and its resources will be available for military use when needed.",
      cards([{ id: "gl-eisenhower", caption: "Dwight D. Eisenhower" }], { text: "Washington, 1955" })),
    beat("1951", "The State Department disagreed, and its answer is the closest thing there is to the real reason. The time, it said, was long past when such a plan would be feasible. Greenland was constitutionally and psychologically part of Denmark. Trying to buy it might even endanger American access. And it was unnecessary, because, in the department's words, we are permitted to do almost anything, literally, that we want to.",
      page("US State Department, reply to the Joint Chiefs, 1955", ["\"the time was long past when such a plan would be feasible\"", "An attempt might endanger American access, and is unnecessary:", "\"we are permitted to do almost anything, literally, that we want to\""], "almost anything, literally, that we want to", "As quoted in Wikipedia, 'Proposed United States acquisition of Greenland'", { text: "The real reason, 1955" })),
    beat("1951", "A Danish scholar later wrote that his country's sovereignty over Greenland during the Cold War was fictional, and that the United States held sovereignty in practice. The Americans had everything ownership would give them, except the deed.",
      photo("gl-thule-radar", { text: "Sovereignty in practice" })),
    // ---- chapter 6
    beat("thule", "And they used it. Around nineteen fifty-three, in Operation Blue Jay, the United States built Thule Air Base in the far north of the island. From nineteen fifty-nine, Greenland was part of NORAD, the air defence of North America.",
      photo("gl-thule-aerial", { text: "Thule Air Base · Operation Blue Jay" }, { banner: { text: "Thule Air Base · Operation Blue Jay", date: "c. 1953" } })),
    beat("thule", "Thule employed more than a thousand Greenlanders and had almost ten thousand American personnel. With about fifty other American bases, it tracked Soviet submarines in the gap between Greenland, Iceland and Britain.",
      stat("~10,000", "American personnel at Thule, at its height", "Wikipedia, 'Proposed United States acquisition of Greenland'")),
    beat("thule", "Under the ice sheet, the Army built Camp Century, an experiment in polar engineering. A cancelled plan, Project Iceworm, would have deployed six hundred Minuteman missiles under the ice.",
      cards([{ id: "gl-camp-century", caption: "Camp Century: trench construction" }], CH(6, "Under the ice"))),
    beat("thule", "Then the Cold War ended, and American interest fell away almost overnight. The radars were abandoned. Since two thousand and four, Thule, now Pituffik Space Base, has been the only American base in Greenland, with a few hundred Americans.",
      photo("gl-thule-radar", { text: "After the Cold War" })),
    // ---- chapter 7
    beat("return", "In the twenty-first century, the Arctic came back. Russia stepped up its naval activity, and China began to talk about a Polar Silk Road. The gap between Greenland and Iceland is about three hundred kilometres wide; between Iceland and Britain, about eight hundred. Closing it is still an American priority in a war.",
      map({ views: [V([-20, 64], 700), V([-15, 63], 820, 300)], realms: RL(["greenland", "iceland", "uk", "norway"], 0), labels: [{ at: [-30, 66.2], text: "300 km", kind: "place", from: 40 }, { at: [-12, 61.5], text: "800 km", kind: "place", from: 60 }, { at: [-20, 68], text: "GIUK gap", kind: "water", from: 20 }] })),
    beat("return", "Pituffik is one of only two Arctic ground stations the United States has for satellites in polar orbit. Greenland also holds the largest deposits of rare-earth elements outside China, although, as one analyst pointed out, it has never produced a barrel of petroleum, and its one attempt at iron ore mining ended in bankruptcy.",
      cards([{ id: "gl-vance", caption: "Pituffik Space Base, 2025" }, { id: "gl-icesheet", caption: "The ice sheet: 80% of the island" }], CH(7, "The Arctic returns"))),
    // ---- chapter 8
    beat("2019", "In twenty nineteen, President Donald Trump asked his advisers to study buying Greenland. When the Wall Street Journal reported it, Greenland's and Denmark's leaders rejected a sale. Danish Prime Minister Mette Frederiksen called it an absurd discussion. Greenland, she said, is not for sale.",
      cards([{ id: "gl-trump-frederiksen", caption: "Trump and Frederiksen" }], CH(8, "Not for sale"))),
    beat("2019", "On the twentieth of August twenty nineteen, Trump cancelled a state visit to Denmark over her remarks. A day later, Frederiksen offered stronger cooperation with the United States in the Arctic. And in twenty twenty, the American consulate in Nuuk, closed since nineteen fifty-three, reopened.",
      photo("gl-consulate", { text: "US consulate, Nuuk · reopened 2020" })),
    // ---- chapter 9
    beat("2025", "After his re-election, the idea returned, much harder. In December twenty twenty-four, Trump wrote that American ownership and control of Greenland was an absolute necessity. In January he threatened tariffs against Denmark and refused to rule out economic or military action. In March twenty twenty-five he told Congress: one way or the other, we're going to get it.",
      cards([{ id: "gl-protest", caption: "Copenhagen: 'Hands off Greenland'" }], CH(9, "One way or the other"))),
    beat("2025", "In a poll of Greenlanders in January twenty twenty-five, eighty-five percent rejected leaving the Danish realm to join the United States. Six percent supported it.",
      stat("85%", "of Greenlanders polled rejected joining the United States · Jan 2025", "Verian poll for Sermitsiaq and Berlingske, via Wikipedia")),
    beat("2025", "By December twenty twenty-five, Denmark's own military intelligence had classified the United States as a potential threat to its security. In January twenty twenty-six, Frederiksen warned that a forcible American takeover would mean the end of NATO.",
      cards([{ id: "gl-frederiksen", caption: "Mette Frederiksen, 2026" }], { text: "Copenhagen, January 2026" }), ["ACQ", "GC"]),
    beat("2025", "Trump told the New York Times that ownership gives you things you can't get from just signing a document. It was, almost word for word, the argument the Joint Chiefs had made seventy years earlier, and the argument the State Department had rejected.",
      page("Donald Trump to The New York Times, January 2026", ["\"Ownership gives you things and elements", "that you can't get from just signing a document.\""], "just signing a document", "As quoted in Wikipedia, 'Proposed United States acquisition of Greenland'", { text: "The old argument, again" })),
    beat("2025", "Within weeks, after Denmark's refusal was backed by the European Union and other NATO members, Trump pledged not to use force or tariffs to take Greenland.",
      photo("gl-nuuk", { text: "Nuuk" }), ["GC"]),
    // ---- verdict
    beat("verdict", "On the twenty-second of September twenty twenty-six, at the United Nations, the United States, Denmark and Greenland signed a security agreement. It increases American involvement in Greenland's defence. And it affirms Danish sovereignty, and Greenland's right to decide its own future.",
      cards([{ id: "gl-signing", caption: "New York, 22 September 2026" }], CH(10, "The deed"))),
    beat("verdict", "So why has the United States never bought Greenland? There are several answers, and they stack. First, in nineteen sixteen, it signed away its own claim, as the price of the Virgin Islands.",
      page("Why the United States never bought Greenland", ["1. 1916: it recognised Danish rule over all of Greenland", "2. Greenland became part of Danish national identity", "3. 1951: it got the use of the island without owning it", "4. Today: Greenland's own right to decide"], "1916", "Summary of this video's sources", { text: "The verdict" })),
    beat("verdict", "Second, Greenland became part of how Danes saw their own country, which made a sale politically impossible, whatever the price.",
      photo("gl-hvalsey", { text: "National identity" })),
    beat("verdict", "Third, and most important, from nineteen fifty-one the United States already had nearly everything that owning Greenland would give it: the bases, the freedom to move, the right to build more. Its own State Department concluded that trying to buy the island could only put that at risk.",
      photo("gl-thule-aerial", { text: "Everything but the deed" })),
    beat("verdict", "And fourth, the question is no longer Denmark's alone. Under the Self-Government Act of two thousand and nine, Greenland can choose independence by its own referendum. Its government has said its goal is independence, and that Greenland is not for sale.",
      cards([{ id: "gl-nielsen", caption: "Jens-Frederik Nielsen" }, { id: "gl-flag", caption: "Nuuk" }], { text: "Greenland decides" })),
    beat("verdict", "For eighty years, the United States has had almost everything it wanted in Greenland except the deed. And every time it has asked for the deed, it has run into the same answer its own diplomats gave in nineteen fifty-five. It didn't need it.",
      photo("gl-nuuk-harbour", null, { sub: "It didn't need it." })),
  ],
};
