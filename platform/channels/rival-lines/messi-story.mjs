/**
 * Rival Lines, Format A (player documentary): Lionel Messi. Posed as a question the viewer is left to answer, not an argument:
 * "Is he the greatest of all time?" followed by the evidence, shown with real photographs of the awards and shirts.
 * Career statistics come from one fetched Wikipedia article (lead text and its Barcelona career-statistics table, checked against the lead's
 * own totals). The key-pass figure is a LIMITED SAMPLE of StatsBomb Open Data and is labelled so. The script is fitted to the voice's
 * measured pace so the video lands at 35 to 40 seconds without altering the voice. Written directly, NOT reviewed by the script engine's critic.
 */
const WIKI = "https://en.wikipedia.org/wiki/Lionel_Messi";
const SB = "https://github.com/statsbomb/open-data";
export const topic = "Is Lionel Messi the greatest of all time?";
export const sources = [
  { source_id: "wiki-messi", url: WIKI, published: "2026-11-10", title: "Lionel Messi (Wikipedia, lead and career-statistics table, retrieved 10 Nov 2026)", licence: "facts only; no text reproduced beyond short excerpts" },
  { source_id: "statsbomb", url: SB, published: "2026-11-10", title: "StatsBomb Open Data, La Liga 2009/10 and 2018/19 event data", licence: "StatsBomb Open Data terms: credit StatsBomb and show their logo" },
];
const w = (claim_id, claimText, excerpt, must) => ({ claim_id, claim: claimText, source_id: "wiki-messi", source_url: WIKI, published: "2026-11-10", excerpt, confidence: "high", context: "Verified career fact from the article lead.", contradictory_evidence: [], editorial_status: "established_fact", must });
const d = (claim_id, claimText, excerpt) => ({ claim_id, claim: claimText, source_id: "statsbomb", source_url: SB, published: "2026-11-10", excerpt, confidence: "medium", context: "Event-data-derived and LIMITED SAMPLE: the first 12 Barcelona league matches Messi started in each of 2009/10 and 2018/19 in StatsBomb Open Data, per 90 minutes played in those matches. Not a full-season or career statistic.", contradictory_evidence: [], editorial_status: "measured_statistic" });
export const claims = [
  w("W2", "Messi has won a record eight Ballons d'Or.", "set numerous records for individual accolades won, including eight Ballons d'Or, six European Golden Shoes", "including eight Ballons d'Or"),
  w("W8", "Messi has won six European Golden Shoes, a record for individual accolades.", "including eight Ballons d'Or, six European Golden Shoes", "six European Golden Shoes"),
  w("W3", "In 2008-09 Messi helped Barcelona achieve the first treble in Spanish football.", "During the 2008-09 season, he helped Barcelona achieve the first treble in Spanish football", "first treble in Spanish football"),
  w("W4", "With Barcelona Messi set the record for most goals in La Liga (474).", "he set records for most goals for a single club (672) and most goals in La Liga (474)", "most goals in La Liga (474)"),
  w("W5", "Messi led Argentina to victory at the 2022 World Cup.", "He then led Argentina to victory at the 2021 Copa America, the 2022 World Cup", "the 2022 World Cup"),
  w("W7", "In 2014-15 Messi helped Barcelona achieve a historic second treble.", "helped Barcelona achieve a historic second treble", "historic second treble"),
  { claim_id: "T1", claim: "In the 2011-12 season Messi scored 73 goals for Barcelona in all competitions, 50 of them in La Liga.", source_id: "wiki-messi", source_url: WIKI, published: "2026-11-10", excerpt: "Career statistics, Barcelona 2011-12: La Liga 37 apps, 50 goals; total 60 apps, 73 goals", confidence: "high", context: "Read from the Wikipedia career-statistics table; the run checks the table's totals against the lead's 672 Barcelona goals and 474 La Liga goals.", contradictory_evidence: [], editorial_status: "established_fact" },
  d("D2", "In the sample, Messi's key passes (passes that led to a shot) rose from 1.4 per 90 minutes in 2009/10 to 3.5 in 2018/19.", "key passes per 90: 1.44 (2009/10), 3.51 (2018/19)"),
];

/** Story slots in order. The script fitter picks the wording and the optional lines that land at 35 to 40 seconds at the voice's own pace. */
export const slots = [
  { id: "hook", scene: 0, allow_no_claim: true, editorial: "the question the video leaves with the viewer", variants: [{ text: "Is Lionel Messi the greatest of all time?", claim_ids: [] }] },
  { id: "evidence", scene: 0, optional: true, allow_no_claim: true, editorial: "transition into the evidence", variants: [{ text: "Here is the evidence, in numbers.", claim_ids: [] }] },
  { id: "ballon", scene: 1, variants: [{ text: "Start with the individual awards: a record eight Ballons d'Or.", claim_ids: ["W2"] }, { text: "Start with the awards: a record eight Ballons d'Or.", claim_ids: ["W2"] }, { text: "A record eight Ballons d'Or.", claim_ids: ["W2"] }] },
  { id: "shoes", scene: 2, optional: true, variants: [{ text: "Add to that six European Golden Shoes.", claim_ids: ["W8"] }, { text: "And six European Golden Shoes.", claim_ids: ["W8"] }] },
  { id: "goals", scene: 3, variants: [{ text: "For Barcelona he scored four hundred and seventy-four La Liga goals, a record, and seventy-three goals in a single season.", claim_ids: ["W4", "T1"] }, { text: "Four hundred and seventy-four La Liga goals, a record, and seventy-three in a single season.", claim_ids: ["W4", "T1"] }, { text: "Four hundred and seventy-four La Liga goals, a record.", claim_ids: ["W4"] }] },
  { id: "trebles", scene: 4, variants: [{ text: "He helped Barcelona to two trebles, the first in Spanish football in 2009, and a second in 2015.", claim_ids: ["W3", "W7"] }, { text: "Two trebles with Barcelona, in 2009 and 2015.", claim_ids: ["W3", "W7"] }, { text: "Two trebles, 2009 and 2015.", claim_ids: ["W3", "W7"] }] },
  { id: "worldcup", scene: 5, variants: [{ text: "Then, in 2022, he led Argentina to victory at the World Cup.", claim_ids: ["W5"] }, { text: "In 2022, he led Argentina to the World Cup.", claim_ids: ["W5"] }, { text: "In 2022, the World Cup.", claim_ids: ["W5"] }] },
  { id: "creator", scene: 6, optional: true, variants: [{ text: "In sampled matches, his key passes per ninety minutes more than doubled.", claim_ids: ["D2"] }] },
  { id: "close", scene: 7, allow_no_claim: true, editorial: "hands the question back to the viewer", variants: [{ text: "So, is he the greatest of all time: you decide.", claim_ids: [] }, { text: "The greatest of all time: you decide.", claim_ids: [] }] },
];
export const scenes = [
  { kind: "hook", treatment: "question-hook-with-real-shirt-photographs", objective: "Pose the question over a sticker portrait with two shirt cut-outs, one Barcelona and one Argentina, the same size", background: "white editorial page, club blue" },
  { kind: "trophies", treatment: "eight-ballon-dor-photographs", objective: "Count up to eight and show one Ballon d'Or trophy cut-out eight times in an even grid", background: "white editorial page" },
  { kind: "shoes", treatment: "golden-shoe-photograph", objective: "Count up to six and show one Golden Shoe cut-out six times in an even grid", background: "gold block" },
  { kind: "chart", treatment: "goals-per-season-stacked-bars", objective: "Draw Barcelona goals per season, count up the 474 La Liga goals and mark the 73 of 2011-12", background: "white card" },
  { kind: "trebles", treatment: "two-trebles-with-trophy-display-photograph", objective: "Show the two trebles on two equal cards under a Barcelona shirt cut-out", background: "garnet block" },
  { kind: "worldcup", treatment: "world-cup-2022-photograph-collage", objective: "Show a real photograph of the 2022 World Cup trophy being kissed in an Argentina shirt, with 2022 in large type and an Argentina shirt cut-out", background: "sky-blue block" },
  { kind: "creator", treatment: "key-pass-per-90-bars", objective: "Compare key passes per 90 in two sampled seasons with animated bars and the sample caveat", background: "white card" },
  { kind: "close", treatment: "portrait-led-question-close", objective: "Close on the portrait with the question and the evidence as plain chips", background: "garnet block" },
];
export const blueprint = {
  central_question: "Is Messi the greatest footballer of all time?",
  thesis: "The evidence is laid out, with real photographs of the awards, and the question is left to the viewer.",
  why_it_matters: "A debate is more engaging when the facts are shown and the verdict is left open.",
  structure: ["the question", "Ballons d'Or", "Golden Shoes", "goals", "trebles", "World Cup", "creation", "back to the viewer"],
};
const T = (id, key, title, claim, cutout) => ({ id, key, title, claim, ...(cutout ? { cutout } : {}) });
export const ASSETS = [
  T("messi-2022", "p2022cut", "File:Lionel-Messi-Argentina-2022-FIFA-World-Cup sharpness.jpg", "W5", {}),
  // The trims remove the hanger above the Argentina shirt and the dark stand below the Ballon d'Or, which the mask kept as ragged shapes.
  // Objects are cut out of their photographs (general-object model), so each appears on its own: one shirt, one trophy, one shoe.
  // The Barcelona shirt is a real Barcelona home shirt, not one Messi wore; the video labels it only as "Barcelona".
  T("shirt-arg", "shirtArg", "File:Fútbol Diseñando una pasión - 124.jpg", "W5", { model: "isnet-general-use", trim: "0,0.065,1,1" }),
  T("shirt-bar", "shirtBar", "File:FC Barcelona shirt2.jpg", "W4", { model: "isnet-general-use" }),
  T("otamendi", "otamendi", "File:Nicolás Otamendi Copa del Mundo 2022.jpg", "W5"),
  T("golden-shoe", "shoe", "File:Messi's Golden Shoe (51937265513).jpg", "W8", { model: "isnet-general-use" }),
  T("ballon-dor", "bo", "File:Camp Nou Experience (Ank Kumar, INFOSYS) 01.jpg", "W2", { model: "isnet-general-use", trim: "0,0,1,0.665" }),
];
export const metadata = {
  title: "Is Lionel Messi the Greatest of All Time?",
  description: "Eight Ballons d'Or. Six European Golden Shoes. A record 474 La Liga goals and 73 in a single season. Two trebles. The 2022 World Cup. Is Lionel Messi the greatest of all time? You decide. Career facts and season-by-season goals from Wikipedia; in a limited sample of StatsBomb event data (12 Barcelona league starts in 2009/10 and 12 in 2018/19) his key passes per 90 minutes rose from 1.4 to 3.5. All photographs are from Wikimedia Commons, credited in the video.\n\n#Shorts #Messi #Football #Barcelona #Argentina #GOAT #RivalLines\n\nData: StatsBomb Open Data (https://github.com/statsbomb/open-data). StatsBomb logo shown as required by their terms.\nSources: https://en.wikipedia.org/wiki/Lionel_Messi",
  tags: ["Lionel Messi", "Messi greatest of all time", "Ballon d'Or", "football", "Barcelona", "Argentina", "World Cup 2022", "GOAT debate"],
};
