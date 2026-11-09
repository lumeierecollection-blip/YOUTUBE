/**
 * Proof C: VOX-Style Pop-Culture Explainer. Written directly from two fetched trade-press reports and NOT reviewed by the script
 * engine's independent critic. Every number comes from those reports and nothing else: the Eras Tour bar is drawn open-topped at
 * "more than $1 billion" because Pollstar's figure was reported as a floor, and nothing is said about how long the Eras Tour took.
 * Photographs are real and licensed; none is generated.
 */
const MW = { source_id: "musicweek2023", url: "https://www.musicweek.com/live/read/taylor-swift-breaks-record-with-first-tour-to-gross-more-than-1-billion/088979", published: "2023-12", title: "Taylor Swift breaks record with first tour to gross more than $1 billion (Music Week; exact day not retrieved, December 2023 per Pollstar reporting)", licence: "facts only, short excerpts" };
const CMU = { source_id: "cmu2023", url: "https://completemusicupdate.com/taylor-swifts-record-breaking-tour-topped-a-billion-dollars/", published: "2023-12", title: "Taylor Swift's record breaking tour topped a billion dollars (Complete Music Update; exact day not retrieved)", licence: "facts only, short excerpts" };
const claim = (claim_id, src, claimText, excerpt, context) => ({ claim_id, claim: claimText, source_id: src.source_id, source_url: src.url, published: src.published, excerpt, confidence: "medium", context, contradictory_evidence: [], editorial_status: "confirmed" });

export const topic = "Why the Eras Tour's billion dollars was a different kind of record from Elton John's";
export const central_question = "How did Taylor Swift's Eras Tour beat a touring record that took Elton John five years, and why does the comparison matter?";
export const category = "cultural influence, comparison, why a record matters";

export const sources = [MW, CMU];
export const claims = [
  claim("T1", MW, "Pollstar reported that Taylor Swift's Eras Tour had so far grossed more than $1 billion, the first tour to do so.", "Taylor Swift’s Eras Tour has so far grossed more than $1 billion, according to Pollstar.", "Figure is a floor ('more than'), reported 'so far' in December 2023 and attributed to Pollstar. Headline: 'first tour to gross more than $1 billion'."),
  claim("T2", MW, "Elton John's Farewell Yellow Brick Road Tour set the previous touring record with $939 million.", "Elton John’s Farewell Yellow Brick Road Tour set the previous touring record with $939 million", "The report's wording. Billboard's own Boxscore ranks only officially reported figures and is a different basis; this video uses the Music Week/Pollstar framing only."),
  claim("T3", MW, "Elton John's $939 million was amassed over five years, due to pandemic delays.", "although that huge total was amassed over five years due to pandemic delays.", "Says nothing about how long the Eras Tour took, and the video says nothing either."),
  claim("T4", CMU, "Previous record-breaking tours by U2, Ed Sheeran and Elton John all included many more performances.", "making it bigger than previous record-breaking tours by U2, Ed Sheeran and Elton John which all included many more performances", "'Many more performances' is the report's wording; no show counts were retrieved, so none are shown."),
];

export const sentences = [
  { text: "A billion-dollar tour just beat a record Elton John spent five years setting.", scene: 0, claim_ids: ["T1", "T2", "T3"] },
  { text: "Pollstar says Taylor Swift's Eras Tour passed one billion dollars.", scene: 1, claim_ids: ["T1"] },
  { text: "Elton John's farewell tour held the old record: nine hundred thirty-nine million dollars.", scene: 2, claim_ids: ["T2"] },
  { text: "His total was built over five years, with pandemic delays.", scene: 3, claim_ids: ["T3"] },
  { text: "Earlier record tours also played many more shows.", scene: 4, claim_ids: ["T4"] },
  { text: "Same record, very different routes to get there.", scene: 5, claim_ids: [], allow_no_claim: true, editorial: "framing of the comparison, not a research claim" },
];

export const scenes = [
  { kind: "question", treatment: "two-cutouts-and-two-numbers", objective: "State the question with both artists as large cut-outs beside their two numbers", background: "light editorial page" },
  { kind: "chart", treatment: "zero-baseline-bar-chart", objective: "Compare the two totals on one zero-based axis in US dollars, the Eras bar open-topped because the figure was reported as 'more than'", background: "light editorial page" },
  { kind: "oldrecord", treatment: "record-card-with-cutout", objective: "Name the old record holder, the tour and the figure beside a large cut-out portrait", background: "light editorial page" },
  { kind: "fiveyears", treatment: "five-year-ruler", objective: "Show the old record's span as a five-year ruler filling in, labelled with the reason for the length", background: "light editorial page" },
  { kind: "moreshows", treatment: "two-column-comparison", objective: "Compare earlier record tours (many more performances) with the Eras Tour (a bigger gross) in two labelled columns", background: "light editorial page" },
  { kind: "answer", treatment: "split-answer", objective: "Close the argument with both artists side by side: the same record, reached by different routes", background: "light editorial page" },
];

export const blueprint = {
  central_question,
  thesis: "The Eras Tour passed the touring record on a bigger gross from fewer performances, while Elton John's record was assembled over five years; the same record, reached by very different routes.",
  why_it_matters: "A record number hides how it was built; the comparison shows what each total actually represents.",
  structure: ["the question", "the new figure", "the old record", "how long the old one took", "how many shows", "the answer"],
};

export const ASSETS = [
  { id: "swift-eras-2023", key: "swift", title: "File:Taylor Swift Eras 08092023-576.jpg", role: "cut-out of the artist whose tour passed the record", claim: "T1", cutout: { seed: 5, fallback: true } },
  { id: "elton-farewell-2018", key: "elton", title: "File:Elton John During His Farewell Yellow Brick Road World Tour (43974924360).jpg", role: "cut-out of the previous record holder, photographed on that tour", claim: "T2", cutout: { seed: 6, fallback: true } },
];

export const DOCUMENTS = [
  { id: "musicweek-excerpt", type: "short excerpt of fetched text", description: "Pollstar's reported gross, and Elton John's $939 million over five years", source_url: MW.url, claim: "T1, T2, T3" },
  { id: "cmu-excerpt", type: "short excerpt of fetched text", description: "Earlier record tours included many more performances", source_url: CMU.url, claim: "T4" },
];

export const metadata = {
  title: "How the Eras Tour Beat Elton John's Record (And Why It's Not the Same Race)",
  description: "Pollstar reported in December 2023 that Taylor Swift's Eras Tour had grossed more than $1 billion, passing the previous touring record of $939 million set by Elton John's Farewell Yellow Brick Road Tour. That total was amassed over five years because of pandemic delays, and earlier record tours by U2, Ed Sheeran and Elton John all included many more performances. Figures are as reported then; they are not updated here.\n\n#Shorts #TaylorSwift #EltonJohn #MusicBusiness #CourtAndSpotlight\n\nSources:\n- Music Week: https://www.musicweek.com/live/read/taylor-swift-breaks-record-with-first-tour-to-gross-more-than-1-billion/088979\n- Complete Music Update: https://completemusicupdate.com/taylor-swifts-record-breaking-tour-topped-a-billion-dollars/\nPhotos via Wikimedia Commons (CC BY 2.0), credited on screen.",
  tags: ["Taylor Swift", "Eras Tour", "Elton John", "touring record", "music business", "Pollstar"],
};
