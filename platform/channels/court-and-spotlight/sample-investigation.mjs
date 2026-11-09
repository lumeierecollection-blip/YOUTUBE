/**
 * Court & Spotlight, investigation format. Written directly from two fetched pages and NOT reviewed by the script engine's
 * independent critic. Convictions, acquittals, allegations and what prosecutors sought are kept apart, and each claim says which.
 * DOJ text was read from a republished copy (Blast Magazine, which names the US Department of Justice as its source), not justice.gov.
 */
const DOJ = { source_id: "doj-via-blast", url: "https://www.blastmagazine.com/?p=1227", published: "2008-04-25", title: "Wesley Snipes sentenced to three years for tax evasion (US Department of Justice release, republished)", licence: "facts only, no text reused beyond short excerpts" };
const CBS = { source_id: "cbs2008", url: "https://www.cbsnews.com/news/wesley-snipes-gets-3-years-in-prison", published: "2008-04-25", title: "Wesley Snipes Gets 3 Years In Prison", licence: "facts only, no text reused beyond short excerpts" };
const claim = (claim_id, src, claimText, excerpt, editorial_status, context) => ({ claim_id, claim: claimText, source_id: src.source_id, source_url: src.url, published: src.published, excerpt, confidence: "medium", context, contradictory_evidence: [], editorial_status });

export const sources = [DOJ, CBS];
export const claims = [
  claim("K1", DOJ, "A federal judge sentenced Wesley Snipes to three years' imprisonment for charges of failing to file income tax returns.", "U.S. District Judge Wm. Terrell Hodges sentenced Wesley Trent Snipes to three years imprisonment Thursday for charges of failing to file income tax returns.", "confirmed", "Official release text, read from a republished copy."),
  claim("K2", DOJ, "A jury found Snipes guilty, in February.", "Snipes was found guilty by a jury on February 1.", "confirmed", "Release gives the day and month; the year follows from the April 2008 sentencing."),
  claim("K3", CBS, "Snipes was acquitted of five additional charges, including felony tax fraud and conspiracy.", "Snipes was acquitted in February of five additional charges, including felony tax fraud and conspiracy.", "confirmed", "Reported by CBS News."),
  claim("K4", CBS, "The government alleged Snipes made at least $13.8 million for the years in question and owed $2.7 million in back taxes.", "The government alleged Snipes made at least $13.8 million for the years in question and owed $2.7 million in back taxes.", "allegation", "An allegation by the government, as CBS reports it. It is not a finding by the jury."),
  claim("K5", CBS, "Prosecutors sought the maximum penalty; Snipes was sentenced to three years.", "Wesley Snipes was sentenced to three years in prison on tax charges Thursday, a victory for prosecutors who sought to make an example of the action star by aggressively pursuing the maximum penalty.", "confirmed", "What prosecutors sought is reported by CBS; the sentence is confirmed by the release."),
];

export const sentences = [
  { text: "Wesley Snipes got three years in prison, over tax returns he never filed.", scene: 0, claim_ids: ["K1"] },
  { text: "A jury found him guilty in February, on failure-to-file charges.", scene: 1, claim_ids: ["K2", "K1"] },
  { text: "It acquitted him of five other charges, including felony tax fraud.", scene: 2, claim_ids: ["K3"] },
  { text: "Prosecutors alleged he earned at least thirteen point eight million dollars in those years.", scene: 3, claim_ids: ["K4"] },
  { text: "They sought the maximum, and the judge gave him three years.", scene: 4, claim_ids: ["K5"] },
];

export const scenes = [
  { kind: "cover", treatment: "case-file-cover", objective: "Open the case file: the name, the court town and the sentence, as confirmed", background: "dark navy desk" },
  { kind: "verdict-guilty", treatment: "verdict-document-stamp", objective: "Show the guilty verdict on the failure-to-file charges, stamped CONVICTED", background: "dark navy desk" },
  { kind: "verdict-acquitted", treatment: "verdict-document-stamp", objective: "Show the five other charges on which the jury acquitted, stamped ACQUITTED", background: "dark navy desk" },
  { kind: "allegation", treatment: "allegation-card-counter", objective: "Show the government's figure, kept visibly apart as an ALLEGATION and not a finding", background: "dark navy desk" },
  { kind: "sentence", treatment: "sought-versus-given", objective: "Show what prosecutors sought against the three-year sentence the judge gave", background: "dark navy desk" },
];

export const metadata = {
  title: "Wesley Snipes: Three Years in Prison Over Unfiled Tax Returns",
  description: "In April 2008 a federal judge sentenced Wesley Snipes to three years' imprisonment for failing to file income tax returns. A jury found him guilty on those charges in February and acquitted him of five others, including felony tax fraud. The government's $13.8 million figure was an allegation, not a verdict.\n\n#Shorts #TrueCrime #Celebrity #CourtAndSpotlight\n\nSources:\n- US Department of Justice release, republished by Blast Magazine, 25 April 2008: https://www.blastmagazine.com/?p=1227\n- CBS News, 25 April 2008: https://www.cbsnews.com/news/wesley-snipes-gets-3-years-in-prison",
  tags: ["Wesley Snipes", "tax case", "court case", "celebrity news", "true crime", "legal"],
};
