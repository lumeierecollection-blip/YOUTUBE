/**
 * Rival Lines, Format A (player documentary), cinematic cut: "Why is Lionel Messi called the greatest of all time?" told as short beats.
 * Verified career statistics come from one fetched Wikipedia article (the lead text and its Barcelona career-statistics table, checked
 * against the lead's own totals of 672 and 474). The key-pass comparison is a LIMITED SAMPLE of StatsBomb Open Data event data and is
 * labelled as one on screen. Written directly, NOT reviewed by the script engine's critic.
 */
const WIKI = "https://en.wikipedia.org/wiki/Lionel_Messi";
const SB = "https://github.com/statsbomb/open-data";
export const topic = "Why is Lionel Messi called the greatest of all time?";
export const sources = [
  { source_id: "wiki-messi", url: WIKI, published: "2026-11-10", title: "Lionel Messi (Wikipedia, lead and career-statistics table, retrieved 10 Nov 2026)", licence: "facts only; no text reproduced beyond short excerpts" },
  { source_id: "statsbomb", url: SB, published: "2026-11-10", title: "StatsBomb Open Data, La Liga 2009/10 and 2018/19 event data", licence: "StatsBomb Open Data terms: credit StatsBomb and show their logo" },
];
const w = (claim_id, claimText, excerpt, must, context = "Verified career fact from the article lead.") => ({ claim_id, claim: claimText, source_id: "wiki-messi", source_url: WIKI, published: "2026-11-10", excerpt, confidence: "high", context, contradictory_evidence: [], editorial_status: "established_fact", must });
const d = (claim_id, claimText, excerpt) => ({ claim_id, claim: claimText, source_id: "statsbomb", source_url: SB, published: "2026-11-10", excerpt, confidence: "medium", context: "Event-data-derived and LIMITED SAMPLE: the first 12 Barcelona league matches Messi started in each of 2009/10 and 2018/19 in StatsBomb Open Data, per 90 minutes played in those matches. Not a full-season or career statistic.", contradictory_evidence: [], editorial_status: "measured_statistic" });
export const claims = [
  w("W2", "Messi has won eight Ballons d'Or.", "including eight Ballons d'Or, six European Golden Shoes", "eight Ballons d'Or"),
  w("W3", "In 2008-09 Messi helped Barcelona achieve the first treble in Spanish football.", "During the 2008-09 season, he helped Barcelona achieve the first treble in Spanish football", "first treble in Spanish football"),
  w("W4", "With Barcelona Messi set the record for most goals in La Liga (474).", "he set records for most goals for a single club (672) and most goals in La Liga (474)", "most goals in La Liga (474)"),
  w("W5", "Messi led Argentina to victory at the 2022 World Cup.", "He then led Argentina to victory at the 2021 Copa America, the 2022 World Cup", "the 2022 World Cup"),
  w("W7", "In 2014-15 Messi helped Barcelona achieve a historic second treble.", "helped Barcelona achieve a historic second treble", "historic second treble"),
  { claim_id: "T1", claim: "In the 2011-12 season Messi scored 73 goals for Barcelona in all competitions, 50 of them in La Liga.", source_id: "wiki-messi", source_url: WIKI, published: "2026-11-10", excerpt: "Career statistics, Barcelona 2011-12: La Liga 37 apps, 50 goals; total 60 apps, 73 goals", confidence: "high", context: "Read from the Wikipedia career-statistics table; the run checks the table's totals against the lead's 672 Barcelona goals and 474 La Liga goals.", contradictory_evidence: [], editorial_status: "established_fact" },
  d("D2", "In the sample, Messi's key passes (passes that led to a shot) rose from 1.4 per 90 minutes in 2009/10 to 3.5 in 2018/19.", "key passes per 90: 1.44 (2009/10), 3.51 (2018/19)"),
];
const S = (text, scene, claim_ids) => ({ text, scene, claim_ids, ...(claim_ids.length ? {} : { allow_no_claim: true, editorial: "question or conclusion drawn from the beats above, not a new claim" }) });
export const sentences = [
  S("Why is Lionel Messi called the greatest of all time?", 0, []),
  S("Start with the trophies: eight Ballons d'Or.", 1, ["W2"]),
  S("Then the goals: four hundred and seventy-four in La Liga, a record.", 2, ["W4"]),
  S("One season, seventy-three.", 2, ["T1"]),
  S("Two trebles, in 2009 and 2015.", 3, ["W3", "W7"]),
  S("And in 2022, the World Cup.", 4, ["W5"]),
  S("In sampled matches, his key passes more than doubled.", 5, ["D2"]),
  S("That is the case for the greatest.", 6, []),
];
export const scenes = [
  { kind: "hook", treatment: "question-hook-with-shirts-and-portrait", objective: "Pose the question over a sticker portrait with a Barcelona shirt and an Argentina shirt behind", background: "white editorial page, club blue" },
  { kind: "trophies", treatment: "ballon-dor-count-up", objective: "Count up to eight Ballons d'Or with eight gold balls and a photograph", background: "white editorial page" },
  { kind: "chart", treatment: "goals-per-season-stacked-bars", objective: "Draw Barcelona goals per season, La Liga and other competitions, count up the 474 La Liga goals and mark the 73 of 2011-12", background: "white card" },
  { kind: "trebles", treatment: "two-trebles-timeline-with-shirt", objective: "Show the two trebles on cards with a photograph and the Barcelona shirt", background: "garnet block" },
  { kind: "worldcup", treatment: "world-cup-2022-collage", objective: "Show 2022 as a large number with the sticker portrait, an Argentina shirt and a photograph", background: "sky-blue block" },
  { kind: "creator", treatment: "key-pass-per-90-bars", objective: "Compare key passes per 90 in two sampled seasons with animated bars and the sample caveat", background: "white card" },
  { kind: "close", treatment: "portrait-led-recap-chips", objective: "Close on the portrait between both shirts with the case in five chips", background: "garnet block" },
];
export const blueprint = {
  central_question: "Why is Messi considered the greatest footballer ever?",
  thesis: "The case rests on trophies, a record goal count, one season of 73 goals, two trebles and a World Cup, and his chance creation more than doubled in the sample.",
  why_it_matters: "A great career is easier to judge when the evidence is laid out one beat at a time.",
  structure: ["the question", "trophies", "goals", "the 73-goal season", "trebles", "World Cup", "creation", "the case"],
};
export const ASSETS = [
  { id: "messi-2022", key: "p2022cut", title: "File:Lionel-Messi-Argentina-2022-FIFA-World-Cup sharpness.jpg", claim: "W5", cutout: {} },
  { id: "messi-2011", key: "p2011", title: "File:Lionel Messi Player of the Year 2011.jpg", claim: "W2" },
  { id: "messi-2010", key: "p2010", title: "File:Messi Barcelona - Valladolid.jpg", claim: "W3" },
  { id: "messi-2018", key: "p2018", title: "File:FWC 2018 - Group D - ARG v ISL - Messi penalty kick.jpg", claim: "W5" },
];
export const metadata = {
  title: "Why Is Lionel Messi Called the Greatest of All Time?",
  description: "Eight Ballons d'Or. A record 474 La Liga goals. Seventy-three goals in one season. Two trebles. The 2022 World Cup. In a limited sample of StatsBomb event data (12 Barcelona league starts in 2009/10 and 12 in 2018/19), his key passes per 90 minutes rose from 1.4 to 3.5. Career facts and season-by-season goals from Wikipedia; photographs from Wikimedia Commons, credited in the video. Shirts are original artwork without club crests or sponsors.\n\n#Shorts #Messi #Football #Barcelona #Argentina #GOAT #RivalLines\n\nData: StatsBomb Open Data (https://github.com/statsbomb/open-data). StatsBomb logo shown as required by their terms.\nSources: https://en.wikipedia.org/wiki/Lionel_Messi",
  tags: ["Lionel Messi", "Messi greatest of all time", "Messi documentary", "football", "Barcelona", "Argentina", "World Cup 2022", "StatsBomb"],
};
