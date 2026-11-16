/**
 * Hidden Past, layered Vox Short that sends viewers to the long-form "How Russia Ended Up Owning a Piece of Germany" (Kaliningrad).
 * Facts: ONLY the pages the long-form episode (platform/longform/v2/episodes/hidden-past-kaliningrad-v2.mjs SOURCES) cites, re-fetched on every
 * run: English Wikipedia "Kaliningrad", "Königsberg", "Kaliningrad Oblast" and the Potsdam Agreement section V (Avalon Project, Yale). Each claim carries
 * the exact text the run must find in its page before anything renders. Pictures are the Wikimedia Commons files the long-form credits.
 * Not reviewed by the script engine's critic. Known limit: the "old city" picture (Königsberg 280.jpg) is an undated aerial view of the old centre,
 * shown to illustrate what the 1944 bombing destroyed; it is not a picture of the bombing itself.
 */
export const TOPIC = "How Russia ended up owning a piece of Germany: Königsberg to Kaliningrad";
export const SOURCES = {
  kg: { id: "wiki-kaliningrad", url: "https://en.wikipedia.org/wiki/Kaliningrad", api: "Kaliningrad" },
  kb: { id: "wiki-konigsberg", url: "https://en.wikipedia.org/wiki/K%C3%B6nigsberg", api: "Königsberg" },
  ob: { id: "wiki-oblast", url: "https://en.wikipedia.org/wiki/Kaliningrad_Oblast", api: "Kaliningrad Oblast" },
  psd: { id: "avalon-potsdam", url: "https://avalon.law.yale.edu/20th_century/decade17.asp", avalon: true },
};
const COMMONS = (t) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")")}`;
export const ASSETS = [
  { key: "cathedral", id: "kg-cathedral", title: "File:Konigsberg Cathedral 2012 1.jpg", claim: "K2", role: "Königsberg Cathedral, Kaliningrad, August 2012" },
  { key: "castle", id: "kg-castle", title: "File:Schloss Königsberg Ostpreussen vor 1900.jpg", claim: "K3", role: "Königsberg Castle, before 1900" },
  { key: "merian", id: "kg-merian", title: "File:Image-Koenigsberg, Map by Merian-Erben 1652.jpg", claim: "K4", role: "Königsberg, Merian engraving (Commons: 1651)" },
  { key: "coronation", id: "kg-coronation", title: "File:Preussen 1701 Königsberg.jpg", claim: "K5", role: "Coronation of Frederick I, Königsberg, 1701" },
  { key: "oldcity", id: "kg-oldcity", title: "File:Königsberg 280.jpg", claim: "K7", role: "Königsberg old centre, undated aerial photograph" },
  { key: "street", id: "kg-street", title: "File:Уличный бой в Кенигсберге.jpg", claim: "K8", role: "Soviet unit in street fighting in Königsberg (TASS)" },
  { key: "potsdam", id: "kg-potsdam", title: "File:Attlee, Truman and Stalin at Potsdam.jpg", claim: "K9", role: "Attlee, Truman and Stalin at the Potsdam Conference, July 1945" },
  { key: "kalinin", id: "kg-kalinin", title: "File:Михаил Калинин (1940).jpg", claim: "K10", role: "Mikhail Kalinin, 1940" },
];
for (const a of ASSETS) a.page_url = COMMONS(a.title);

const claim = (claim_id, text, musts) => ({ claim_id, claim: text, source_id: SOURCES[musts[0][0]].id, source_url: SOURCES[musts[0][0]].url, published: "2026-11-16", excerpt: musts.map((m) => m[1]).join(" / "), confidence: "high", context: "", contradictory_evidence: [], editorial_status: "established_fact", musts: musts.map(([from, text]) => ({ from, text })) });
export const CLAIMS = [
  claim("K1", "Kaliningrad is the centre of Kaliningrad Oblast, an exclave of Russia between Lithuania and Poland.", [["kg", "an exclave of Russia between Lithuania and Poland"]]),
  claim("K2", "Kaliningrad Oblast is on the Baltic Sea, bordered by Poland to the south and Lithuania to the north and east.", [["ob", "bordered by Poland to the south, Lithuania to the north and east, and the Baltic Sea to the west"]]),
  claim("K3", "Until 1946 the city was known in English as Königsberg; it was a German city founded in the 13th century.", [["kg", "until 1946 known in English as Königsberg"], ["kb", "was a German city established in the 13th century"]]),
  claim("K4", "Königsberg was founded in 1255 by the Teutonic Knights on the site of the Old Prussian settlement Twangste.", [["kb", "Founded in 1255 on the site of the Old Prussian settlement Twangste by the Teutonic Knights"]]),
  claim("K5", "On 18 January 1701 Elector Frederick III was crowned in Königsberg Castle and became Frederick I, King in Prussia.", [["kb", "By the act of coronation in Königsberg Castle on 18 January 1701"], ["kb", "became Frederick I, King in Prussia"]]),
  claim("K7", "In 1944 British bombing attacks burned Königsberg for several days and destroyed its historic centre.", [["kb", "In 1944, Königsberg suffered heavy damage from British bombing attacks and burned for several days"], ["kb", "The historic city centre"]]),
  claim("K8", "The Soviet Union captured Königsberg on 9 April 1945.", [["kg", "captured by the Soviet Union on 9 April 1945"]]),
  claim("K9", "The Potsdam Agreement (section V) says the Conference agreed in principle to the Soviet proposal for the ultimate transfer of the city of Königsberg to the Soviet Union.", [["psd", "agreed in principle to the proposal of the Soviet Government concerning the ultimate transfer to the Soviet Union of the City of Koenigsberg"]]),
  claim("K10", "Königsberg was renamed Kaliningrad in July 1946 in honour of Mikhail Kalinin, who was unrelated to the city.", [["kg", "renamed Kaliningrad in July 1946 in honour of Mikhail Kalinin"], ["kg", "Kalinin was unrelated to the city"]]),
  claim("K11", "All military and civilian land links between the region and the rest of Russia must pass through members of NATO and the EU.", [["ob", "All military and civilian land links between the region and the rest of Russia now must pass through members of NATO and the EU"]]),
  claim("K12", "After the defeat of Nazi Germany Königsberg became part of the Soviet Union and was renamed Kaliningrad in 1946; today it is in Russia.", [["kb", "after the defeat of Nazi Germany became part of the Soviet Union and was renamed to Kaliningrad in 1946"], ["kb", "After the fall of the USSR, Kaliningrad became part of Russia"]]),
];

const V = (text, claim_ids = []) => ({ text, claim_ids });
const NR = { allow_no_claim: true, editorial: "pointer to the full story on the channel, not a factual claim" };
/** One slot per picture, in story order. Longest variant first; the fitter picks what lands at 35 to 40 s at the voice's own pace. */
export const SLOTS = [
  { id: "hook", scene: 0, variants: [V("Why does Russia own land between Poland and Lithuania?", ["K1", "K2"])] },
  { id: "name", scene: 1, variants: [V("It is Kaliningrad, on the Baltic Sea.", ["K2"]), V("It is Kaliningrad.", ["K2"])] },
  { id: "german", scene: 2, variants: [V("Until 1946, it was a German city called Königsberg.", ["K3"]), V("Until 1946, it was Königsberg.", ["K3"])] },
  { id: "1255", scene: 3, optional: true, variants: [V("Teutonic Knights founded it in 1255.", ["K4"]), V("Founded in 1255.", ["K4"])] },
  { id: "1701", scene: 4, optional: true, variants: [V("In 1701, a king was crowned in its castle.", ["K5"]), V("In 1701, a king was crowned there.", ["K5"])] },
  { id: "bombs", scene: 6, variants: [V("In 1944, British bombs burned its old centre.", ["K7"]), V("In 1944, bombs burned the old city.", ["K7"])] },
  { id: "fall", scene: 7, variants: [V("On 9 April 1945, the Soviets captured it.", ["K8"]), V("In April 1945, the Soviets took it.", ["K8"])] },
  { id: "potsdam", scene: 8, variants: [V("At Potsdam, the Allies agreed, in principle, to give it to the Soviets.", ["K9"])] },
  { id: "rename", scene: 9, variants: [V("In 1946 it was renamed Kaliningrad, after Mikhail Kalinin, who had no link to it.", ["K10"]), V("Renamed Kaliningrad after Mikhail Kalinin, who was unrelated to it.", ["K10"])] },
  { id: "today", scene: 10, variants: [V("Today, every land link to Russia crosses NATO and EU territory.", ["K11"]), V("Every land link to Russia now crosses NATO and EU.", ["K11"])] },
  { id: "answer", scene: 11, variants: [V("That is how a German city became Russian.", ["K12"]), V("A German city became Russian.", ["K12"])] },
  { id: "cta", scene: 12, ...NR, variants: [V("The full story is on our channel."), V("Full story on our channel.")] },
];

export const SCENES = [
  { kind: "hook", treatment: "drawn-map-with-russia-stamp", objective: "Open on the question over a drawn map of Kaliningrad Oblast between Poland and Lithuania (Natural Earth), with a Russia stamp and a pin", background: "paper panel in saturated frame" },
  { kind: "name", treatment: "sticker-photo-with-title", objective: "Name Kaliningrad over a 2012 photograph of the cathedral on the Baltic coast", background: "paper panel in saturated frame" },
  { kind: "german", treatment: "photo-with-giant-year-and-stamp", objective: "Show Königsberg Castle before 1900 with the year 1946 and a German city stamp", background: "paper panel in saturated frame" },
  { kind: "k1255", treatment: "giant-year-with-engraving", objective: "Giant 1255 with the Merian engraving of Königsberg and the Teutonic Knights strip", background: "paper panel in saturated frame" },
  { kind: "k1701", treatment: "giant-year-with-coronation-picture", objective: "Giant 1701 with the coronation picture and a crowned-in-the-castle stamp", background: "paper panel in saturated frame" },
  { kind: "bombs", treatment: "photo-with-giant-year-and-stamp", objective: "Giant 1944 with an aerial view of the old centre and a burned-for-days stamp", background: "paper panel in saturated frame" },
  { kind: "fall", treatment: "photo-with-date-stamp", objective: "Soviet street-fighting photograph with the date 9 April 1945", background: "paper panel in saturated frame" },
  { kind: "potsdam", treatment: "photo-with-quote-slip", objective: "Potsdam Conference photograph with the Potsdam Agreement's own words as a quote slip", background: "paper panel in saturated frame" },
  { kind: "rename", treatment: "portrait-sticker-with-rename-stamp", objective: "Kalinin portrait, the year 1946 and the name Kaliningrad stamped over Königsberg", background: "paper panel in saturated frame" },
  { kind: "today", treatment: "drawn-map-with-route", objective: "Draw Kaliningrad and Moscow with Poland and Lithuania tinted and a schematic route between them", background: "paper panel in saturated frame" },
  { kind: "answer", treatment: "then-and-now-stickers", objective: "Then and now: the castle before 1900 against the cathedral in 2012, with the answer in a strip", background: "paper panel in saturated frame" },
  { kind: "outro", treatment: "drawn-map-with-cta-stamp", objective: "Return to the opening map with the pointer to the full story on the channel, so a replay loops", background: "paper panel in saturated frame" },
];

export const METADATA = {
  title: "Kaliningrad: Russia's Piece of Germany",
  description: "Why does Russia own land between Poland and Lithuania? Kaliningrad was the German city of Königsberg, founded in 1255 by the Teutonic Knights. A king was crowned in its castle in 1701. British bombing burned the old centre in 1944, the Soviet Union captured it on 9 April 1945, and at Potsdam the Allies agreed in principle to transfer it to the Soviet Union. It was renamed Kaliningrad in 1946 after Mikhail Kalinin. Today every land link between the region and the rest of Russia crosses NATO and EU territory.\n\nFull story: on our channel. The full video is \"How Russia Ended Up Owning a Piece of Germany\".\n\n#Shorts #Kaliningrad #History #Russia #HiddenPast\n\nSources: https://en.wikipedia.org/wiki/Kaliningrad , https://en.wikipedia.org/wiki/K%C3%B6nigsberg , https://en.wikipedia.org/wiki/Kaliningrad_Oblast , https://avalon.law.yale.edu/20th_century/decade17.asp (Potsdam Agreement, section V, Avalon Project, Yale Law School).\nImages via Wikimedia Commons: @@CREDITS@@\nMap data: Natural Earth (public domain).",
  tags: ["Kaliningrad", "Königsberg", "Russia", "Germany", "Potsdam Agreement", "East Prussia", "history", "Hidden Past"],
};
export const PINNED_COMMENT = "The full story, from the Teutonic Knights to Potsdam to NATO's planners, is on our channel: \"How Russia Ended Up Owning a Piece of Germany\". Was it right that the city went to the Soviet Union? Tell us below.";
