/**
 * Proof A: Investigative / Dossier. Written directly from fetched sources and NOT reviewed by the script engine's independent critic.
 * Convictions, acquittals, allegations and what prosecutors sought are kept apart, and each claim says which. Every photograph is real,
 * licensed and recorded in the asset manifest; none is generated. DOJ text was read from a republished copy (Blast Magazine), not justice.gov.
 */
import { claims as baseClaims, sources as baseSources } from "./sample-investigation.mjs";

const COMMONS = "https://commons.wikimedia.org/wiki/File:Wesley_Snipes_mug_shot.jpg";
export const topic = "Wesley Snipes: what the jury decided, and what was only alleged";
export const central_question = "In Wesley Snipes's tax case, what did the jury decide, and what was only alleged?";
export const category = "court case, sentencing, alleged earnings, booking photograph";

export const sources = [...baseSources, { source_id: "commons-mugshot", url: COMMONS, published: "2008-04-24", title: "Wesley Snipes mug shot (Wikimedia Commons file page: author United States Marshals Service, public domain)", licence: "public domain" }];
export const claims = [
  ...baseClaims,
  { claim_id: "P1", claim: "A booking photograph of Wesley Snipes by the United States Marshals Service, dated 24 April 2008, is in the public domain.", source_id: "commons-mugshot", source_url: COMMONS, published: "2008-04-24", excerpt: "Mug shot of Wesley Snipes. Date: 2008-04-24. Author: United States Marshals Service. Licence: Public domain.", confidence: "medium", context: "Provenance as recorded on Wikimedia Commons. The date matches the sentencing date reported by the Department of Justice (a Thursday, the day before the 25 April release). The photo's date does not say when in the day, or why, it was taken.", contradictory_evidence: [], editorial_status: "confirmed" },
];

export const sentences = [
  { text: "Wesley Snipes got three years in prison for not filing tax returns.", scene: 0, claim_ids: ["K1"] },
  { text: "A jury found him guilty in February, on failure-to-file charges.", scene: 1, claim_ids: ["K2", "K1"] },
  { text: "It acquitted him of five other charges, including felony tax fraud.", scene: 2, claim_ids: ["K3"] },
  { text: "Prosecutors alleged he earned at least thirteen point eight million dollars.", scene: 3, claim_ids: ["K4"] },
  { text: "Prosecutors sought the maximum, and the judge gave three years.", scene: 4, claim_ids: ["K5"] },
  { text: "A US Marshals booking photo is dated that same day.", scene: 5, claim_ids: ["P1"] },
];

export const scenes = [
  { kind: "cover", treatment: "case-file-cover-with-cutout", objective: "Open with the real subject as a large torn-paper cut-out and the outcome in one line", background: "dark desk" },
  { kind: "doj", treatment: "document-extract-highlight", objective: "Show the Justice Department release text with the sentence and the jury verdict highlighted as they are read", background: "dark desk, paper card" },
  { kind: "timeline", treatment: "verdict-timeline-stamps", objective: "Lay the verdict out on a timeline: convicted on failure to file, acquitted on five other charges, then sentencing", background: "dark desk" },
  { kind: "alleged", treatment: "allegation-card-amber", objective: "Show the government's figure on its own amber card, stamped ALLEGED and marked as not a finding", background: "dark desk, amber card" },
  { kind: "sought", treatment: "sought-versus-given-bars", objective: "Show what prosecutors sought against the three years the judge gave, beside the subject", background: "dark desk" },
  { kind: "booking", treatment: "booking-photo-record", objective: "Show the genuine, public-domain US Marshals booking photograph with its date circled and its source stated", background: "dark desk, taped card" },
];

export const blueprint = {
  central_question,
  thesis: "The jury convicted on the failure-to-file charges and acquitted on five others; the government's money figure was an allegation and not a verdict.",
  why_it_matters: "A famous sentence is easy to remember as one thing, when the record separates what was decided from what was claimed.",
  structure: ["outcome", "the verdict on failure to file", "the acquittals", "the allegation, kept apart", "what was sought and given", "the dated record"],
};

export const ASSETS = [
  { id: "snipes-portrait", key: "portrait", title: "File:Wesley Snipes by Gage Skidmore.jpg", role: "large cut-out of the subject", claim: "K1", cutout: { paper: 16, bw: true, seed: 4 } },
  { id: "snipes-booking", key: "booking", title: "File:Wesley Snipes mug shot.jpg", role: "genuine booking photograph", claim: "P1" },
];

export const DOCUMENTS = [
  { id: "doj-excerpt", type: "typeset excerpt of fetched text", description: "Sentencing and verdict sentences from the US Department of Justice release", source_url: "https://www.blastmagazine.com/?p=1227", note: "Republished copy; justice.gov original not retrieved", claim: "K1, K2" },
  { id: "cbs-excerpt", type: "typeset excerpt of fetched text", description: "The government's alleged earnings and back-taxes figures", source_url: "https://www.cbsnews.com/news/wesley-snipes-gets-3-years-in-prison", claim: "K4" },
];

export const metadata = {
  title: "Wesley Snipes' Tax Case: What the Jury Actually Decided",
  description: "In April 2008 a federal judge sentenced Wesley Snipes to three years' imprisonment for failing to file income tax returns. A jury found him guilty on those charges in February and acquitted him of five others, including felony tax fraud. The government's $13.8 million figure was an allegation, not a verdict. A US Marshals booking photograph dated 24 April 2008 is in the public domain.\n\n#Shorts #TrueCrime #Celebrity #CourtAndSpotlight\n\nSources:\n- US Department of Justice release, republished by Blast Magazine, 25 April 2008: https://www.blastmagazine.com/?p=1227\n- CBS News, 25 April 2008: https://www.cbsnews.com/news/wesley-snipes-gets-3-years-in-prison\n- Booking photograph: United States Marshals Service, public domain, via Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Wesley_Snipes_mug_shot.jpg\n- Portrait: Gage Skidmore, CC BY-SA 3.0, via Wikimedia Commons.",
  tags: ["Wesley Snipes", "tax case", "court case", "celebrity news", "true crime", "legal"],
};
