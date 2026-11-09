/**
 * Court & Spotlight, entertainment-magazine format (awards, achievements). Written directly from one fetched news report and NOT
 * reviewed by the script engine's independent critic. The photograph is a real, licensed Wikimedia Commons image whose licence, author
 * and subject were read from the Commons API; it is credited on screen.
 */
const KQED = { source_id: "kqed2023", url: "https://kqed.org/arts/13924749/beyonce-sets-a-new-grammy-record-while-harry-styles-wins-album-of-the-year", published: "2023-02-06", title: "Beyoncé sets a new Grammy record while Harry Styles wins album of the year (KQED, updated 6 Feb 2023)", licence: "facts only, no text reused beyond short excerpts" };
const claim = (claim_id, claimText, excerpt, context) => ({ claim_id, claim: claimText, source_id: KQED.source_id, source_url: KQED.url, published: KQED.published, excerpt, confidence: "high", context, contradictory_evidence: [], editorial_status: "confirmed" });

export const sources = [KQED];
export const claims = [
  claim("M1", "At the 65th Grammy Awards, Beyoncé won her fourth award of the year, for a career total of 32, the most Grammys of any artist in the awards' history.", "she won her fourth award of the year for a total of 32 in her career, shattering the record for the most Grammys of any artist in the prize’s 65-year history.", "Reported 6 February 2023. The total has since been reported differently elsewhere; this video states only the figure at that ceremony."),
  claim("M2", "The record-setting win was best dance/electronic music album, for RENAISSANCE.", "She had nine nominations this year, and hit the new record just after 7 p.m. PT, when she won best electronic/dance music album.", "Category wording as given in the report."),
  claim("M3", "Beyoncé had nine nominations at that ceremony.", "She had nine nominations this year", "Same report."),
  claim("M4", "Beyoncé cried on taking the stage and said, \"I'm just trying to receive this night.\"", "She cried upon taking the stage, saying, “I’m just trying to receive this night.”", "A quotation as reported by KQED."),
];

export const sentences = [
  { text: "In one night, Beyoncé became the most-awarded artist in Grammy history.", scene: 0, claim_ids: ["M1"] },
  { text: "She arrived with nine nominations.", scene: 1, claim_ids: ["M3"] },
  { text: "Her fourth win was best dance and electronic music album, for Renaissance.", scene: 2, claim_ids: ["M2", "M1"] },
  { text: "On stage she said she was just trying to receive the night.", scene: 2, claim_ids: ["M4"] },
  { text: "That made thirty-two Grammys in her career.", scene: 3, claim_ids: ["M1"] },
  { text: "More than any other artist in the awards' history.", scene: 4, claim_ids: ["M1"] },
];

export const scenes = [
  { kind: "cover", treatment: "magazine-cover", objective: "Open on a magazine cover with the real, licensed photograph, the headline and the credit", background: "cream page with full-bleed photo" },
  { kind: "nine", treatment: "big-number-nominations", objective: "Show nine nominations as nine marks filling in on a magazine page", background: "cream page" },
  { kind: "win", treatment: "pull-quote-win-card", objective: "Name the win: the album, the category and that it was her fourth of the night", background: "cream page with photo crop" },
  { kind: "total", treatment: "giant-number-counter", objective: "Show the career total counting up to thirty-two", background: "cream page, gold accent" },
  { kind: "record", treatment: "record-ribbon", objective: "Close on the record, with the photograph and the sixty-five-year span", background: "cream page with photo crop" },
];

export const PHOTO = { file: "File:Beyoncé_-_Tottenham_Hotspur_Stadium_-_1st_June_2023_(10_of_118)_(52946364598)_(best_crop).jpg", url: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Beyonc%C3%A9_-_Tottenham_Hotspur_Stadium_-_1st_June_2023_%2810_of_118%29_%2852946364598%29_%28best_crop%29.jpg", author: "Raph_PH", licence: "CC BY 2.0", licence_url: "https://creativecommons.org/licenses/by/2.0", subject: "Beyoncé at the Renaissance World Tour, Tottenham Hotspur Stadium, London, 1 June 2023 (as described on Commons)", credit_line: "Photo: Raph_PH, CC BY 2.0, via Wikimedia Commons" };

export const metadata = {
  title: "Beyoncé's Record-Breaking Grammy Night, in 30 Seconds",
  description: "At the 65th Grammy Awards in February 2023, Beyoncé won best dance/electronic music album for Renaissance, her fourth award of the night, taking her career total to 32: the most Grammys of any artist at the time. Totals have been reported differently since; this video states the figure from the 2023 ceremony.\n\n#Shorts #Grammys #Beyonce #Celebrity #CourtAndSpotlight\n\nSource: KQED, 6 February 2023: https://kqed.org/arts/13924749/beyonce-sets-a-new-grammy-record-while-harry-styles-wins-album-of-the-year\nPhoto: Raph_PH, CC BY 2.0, via Wikimedia Commons.",
  tags: ["Beyoncé", "Grammys", "Grammy record", "Renaissance", "celebrity news", "awards"],
};
