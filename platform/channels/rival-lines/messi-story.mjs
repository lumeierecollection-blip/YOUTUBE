/**
 * Rival Lines, Format A (player documentary): Lionel Messi. Career facts come from one fetched Wikipedia article; the playing-style
 * comparison is a LIMITED SAMPLE of StatsBomb Open Data event data (analysis_messi.py stops the run if a quoted figure differs).
 * Written directly, NOT reviewed by the script engine's critic.
 */
const WIKI = "https://en.wikipedia.org/wiki/Lionel_Messi";
const SB = "https://github.com/statsbomb/open-data";
export const topic = "Lionel Messi: from finisher to creator";
export const sources = [
  { source_id: "wiki-messi", url: WIKI, published: "2026-11-10", title: "Lionel Messi (Wikipedia, retrieved 10 Nov 2026)", licence: "facts only; no text reproduced beyond short excerpts" },
  { source_id: "statsbomb", url: SB, published: "2026-11-10", title: "StatsBomb Open Data, La Liga 2009/10 and 2018/19 event data", licence: "StatsBomb Open Data terms: credit StatsBomb and show their logo" },
];
const w = (claim_id, claimText, excerpt, must) => ({ claim_id, claim: claimText, source_id: "wiki-messi", source_url: WIKI, published: "2026-11-10", excerpt, confidence: "high", context: "Verified career fact from the article lead.", contradictory_evidence: [], editorial_status: "established_fact", must });
const d = (claim_id, claimText, excerpt) => ({ claim_id, claim: claimText, source_id: "statsbomb", source_url: SB, published: "2026-11-10", excerpt, confidence: "medium", context: "Event-data-derived and LIMITED SAMPLE: the first 12 Barcelona league matches Messi started in each of 2009/10 and 2018/19 in StatsBomb Open Data, per 90 minutes played in those matches. Not a full-season or career statistic.", contradictory_evidence: [], editorial_status: "measured_statistic" });
export const claims = [
  w("W1", "Messi made his competitive debut for Barcelona in 2004, at age 17.", "In 2004, Messi made his competitive debut for the La Liga club Barcelona at age 17.", "made his competitive debut for the La Liga club Barcelona at age 17"),
  w("W2", "Messi has won eight Ballons d'Or.", "including eight Ballons d'Or, six European Golden Shoes", "eight Ballons d'Or"),
  w("W3", "In 2008-09 Messi helped Barcelona achieve the first treble in Spanish football.", "During the 2008-09 season, he helped Barcelona achieve the first treble in Spanish football", "first treble in Spanish football"),
  w("W5", "Messi led Argentina to victory at the 2022 World Cup.", "He then led Argentina to victory at the 2021 Copa America, the 2022 World Cup", "the 2022 World Cup"),
  w("W6", "Messi is the most decorated player in the history of professional football.", "Messi is the most decorated player in the history of professional football", "most decorated player in the history of professional football"),
  d("D1", "In the sample, Messi took 4.7 shots per 90 minutes in 2009/10 and 4.8 in 2018/19.", "shots per 90: 4.67 (2009/10), 4.80 (2018/19)"),
  d("D2", "In the sample, Messi's key passes (passes that led to a shot) rose from 1.4 per 90 minutes in 2009/10 to 3.5 in 2018/19.", "key passes per 90: 1.44 (2009/10), 3.51 (2018/19)"),
];
const S = (text, scene, claim_ids) => ({ text, scene, claim_ids });
export const sentences = [
  S("Lionel Messi is the most decorated player in football history.", 0, ["W6"]),
  S("He debuted for Barcelona in 2004, aged seventeen.", 1, ["W1"]),
  S("By 2009, he had helped win Spain's first treble.", 1, ["W3"]),
  S("In sampled matches, his shooting barely changed.", 2, ["D1"]),
  S("But his key passes per ninety minutes more than doubled.", 3, ["D2"]),
  S("Eight Ballons d'Or, and the 2022 World Cup.", 4, ["W2", "W5"]),
  S("In this sample, the finisher became the creator.", 5, ["D1", "D2"]),
];
export const scenes = [
  { kind: "intro", treatment: "layered-portrait-collage-with-name", objective: "Open on a layered editorial collage: big type, a sticker portrait and older photographs behind", background: "white editorial page, club colours" },
  { kind: "timeline", treatment: "career-timeline-with-photographs", objective: "Show two career moments on a timeline with photographs from the era", background: "white editorial page" },
  { kind: "heat", treatment: "pass-origin-heatmaps-two-seasons", objective: "Show where his passes began in two sampled seasons, on real pitches", background: "white editorial page" },
  { kind: "stats", treatment: "per-90-bar-comparison", objective: "Compare shots and key passes per 90 between the two sampled seasons with animated bars", background: "white editorial page" },
  { kind: "honours", treatment: "honours-collage", objective: "Show the honours with a photograph and the sticker portrait, with the Ballon d'Or count up", background: "club-blue page" },
  { kind: "close", treatment: "portrait-led-conclusion", objective: "Return to the large portrait with the conclusion in type", background: "white editorial page, garnet block" },
];
export const blueprint = {
  central_question: "How did Messi's game change between 2009 and 2018?",
  thesis: "In matched samples of league starts his shooting stayed the same while his chance creation more than doubled.",
  why_it_matters: "A great career is easier to understand when one change is shown clearly.",
  structure: ["who he is", "the early career", "the shooting sample", "the creating sample", "the honours", "conclusion"],
};
export const ASSETS = [
  { id: "messi-2022", key: "p2022cut", title: "File:Lionel-Messi-Argentina-2022-FIFA-World-Cup sharpness.jpg", claim: "W5", cutout: {} },
  { id: "messi-2011", key: "p2011", title: "File:Lionel Messi Player of the Year 2011.jpg", claim: "W6" },
  { id: "messi-2007", key: "p2007", title: "File:Messi in Copa America 2007 (Cropped).jpg", claim: "W1" },
  { id: "messi-2010", key: "p2010", title: "File:Messi Barcelona - Valladolid.jpg", claim: "W3" },
  { id: "messi-2018", key: "p2018", title: "File:FWC 2018 - Group D - ARG v ISL - Messi penalty kick.jpg", claim: "W2" },
];
export const metadata = {
  title: "Lionel Messi: The Making of a Football Legend",
  description: "Lionel Messi is the most decorated player in football history. In a limited sample of StatsBomb event data (12 Barcelona league starts in 2009/10 and 12 in 2018/19), his shooting barely changed, while his key passes per 90 minutes rose from 1.4 to 3.5. Career facts from Wikipedia; photographs from Wikimedia Commons with credits in the video.\n\n#Shorts #Messi #Football #Barcelona #Argentina #RivalLines\n\nData: StatsBomb Open Data (https://github.com/statsbomb/open-data). StatsBomb logo shown as required by their terms.\nSources: https://en.wikipedia.org/wiki/Lionel_Messi",
  tags: ["Lionel Messi", "Messi documentary", "football", "Barcelona", "Argentina", "StatsBomb", "key passes", "football analysis"],
};
