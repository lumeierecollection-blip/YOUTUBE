/**
 * Hidden Past, documentary format: how a press conference on 9 November 1989 opened the Berlin Wall's checkpoints.
 * Written directly from one fetched Wikipedia article (Fall of the Berlin Wall) and NOT reviewed by the script engine's critic.
 * Topic chosen for the 9 November anniversary. Photographs are real Wikimedia Commons files with licences read from the API.
 */
const WIKI = "https://en.wikipedia.org/wiki/Fall_of_the_Berlin_Wall";
export const sources = [{ source_id: "wiki-fotbw", url: WIKI, published: "2026-11-10", title: "Fall of the Berlin Wall (Wikipedia, retrieved 10 Nov 2026)", licence: "facts only; CC BY-SA text not reproduced beyond short excerpts" }];
const claim = (claim_id, claimText, excerpt, context = "", editorial_status = "established_fact") => ({ claim_id, claim: claimText, source_id: "wiki-fotbw", source_url: WIKI, published: "2026-11-10", excerpt, confidence: "high", context, contradictory_evidence: [], editorial_status });
export const claims = [
  claim("B1", "A Politburo press conference on 9 November 1989 prematurely announced that East Germans could travel without restrictions.", "occurred after a Politburo press conference on 9 November 1989 prematurely announced that East Germans could travel without restrictions"),
  claim("B2", "The press conference was led by Günter Schabowski, began at 18:00 CET on 9 November, and was broadcast live on East German television and radio.", "led by Günter Schabowski, the outgoing party leader in East Berlin and top party spokesman as Secretary for Information, beginning at 18:00 CET on 9 November and broadcast live on East German television and radio"),
  claim("B3", "Shortly before the press conference Schabowski was handed a note announcing the changes, but given no further instructions on how to handle the information.", "Shortly before the press conference, he was handed a note from Krenz announcing the changes, but given no further instructions on how to handle the information.", "He had not been involved in the discussions about the new regulations and had not been fully updated."),
  claim("B4", "Asked when the regulations would take effect, Schabowski replied that, as far as he knew, it takes effect immediately, without delay.", "Schabowski replied, \"As far as I know, it takes effect immediately, without delay\"", "Wikipedia gives this as an English rendering of the German; it calls his answer an apparent assumption based on the note's opening paragraph.", "later_interpretation"),
  claim("B5", "West German news told viewers that East Germany's borders were open: the dpa bulletin at 19:04 said citizens could cross the inner German border \"immediately\", and ARD's Tagesthemen said the borders were open to everyone.", "The West German Deutsche Presse-Agentur issued a bulletin at 19:04 which reported that East German citizens would be able to cross the inner German border \"immediately\".", "Tagesthemen anchor Hanns Joachim Friedrichs: the GDR announced that, starting immediately, its borders are open to everyone."),
  claim("B6", "At 22:45 (alternatively given as 23:30) on 9 November, Harald Jäger, commander of the Bornholmer Straße crossing, yielded and let guards open the checkpoints.", "at 22:45 (alternatively given as 23:30) on 9 November, Harald Jäger, commander of the Bornholmer Straße border crossing, yielded, allowing guards to open the checkpoints"),
];
export const topic = "How an early announcement opened the Berlin Wall's checkpoints";
export const sentences = [
  { text: "The Berlin Wall opened after an announcement came too early.", scene: 0, claim_ids: ["B1"] },
  { text: "He spoke live on East German television, 9 November 1989.", scene: 0, claim_ids: ["B2"] },
  { text: "Spokesman Günter Schabowski had just been handed a note.", scene: 1, claim_ids: ["B3"] },
  { text: "Asked when it began, he said: immediately, without delay.", scene: 2, claim_ids: ["B4"] },
  { text: "West German news told viewers the borders were open.", scene: 2, claim_ids: ["B5"] },
  { text: "That night, guards at Bornholmer Straße let people through.", scene: 3, claim_ids: ["B6"] },
  { text: "One unprepared answer opened the checkpoints.", scene: 3, claim_ids: ["B3", "B6"] },
];
export const scenes = [
  { kind: "press", treatment: "archival-photo-matted-with-date-stamp", objective: "Show the real press-conference photograph, dated 9 November 1989, in a matted frame", background: "archival paper" },
  { kind: "note", treatment: "document-reveal", objective: "Show Schabowski's own note, the paper he was handed", background: "archival paper" },
  { kind: "quote", treatment: "quote-with-evening-timeline", objective: "Show his answer as a quotation and the evening's first three timed events", background: "archival paper" },
  { kind: "gate", treatment: "photo-with-full-timeline", objective: "Complete the timeline to the checkpoint opening, with a labelled later photograph", background: "archival paper" },
];
export const blueprint = {
  central_question: "How did an East German press conference open the Berlin Wall's checkpoints?",
  thesis: "On 9 November 1989 a spokesman, handed a note and not fully briefed, said new travel rules took effect 'immediately'; West German news broadcast it, crowds gathered, and that night guards opened the checkpoints.",
  why_it_matters: "Large historical turning points can hinge on a single unprepared answer.",
  structure: ["the announcement", "the note", "the answer and the broadcast", "the night"],
};
export const ASSETS = [
  { id: "press", key: "press", title: "File:Bundesarchiv Bild 183-1989-1109-030, Berlin, Schabowski auf Pressekonferenz.jpg", role: "press conference photograph", claim: "B2" },
  { id: "note", key: "note", title: "File:Schabowski-notizzettel.jpg", role: "Schabowski's note", claim: "B3" },
  { id: "gate", key: "gate", title: "File:BrandenburgerTorDezember1989.jpg", role: "later photograph, December 1989, labelled as such", claim: "B6" },
];
export const metadata = {
  title: "The Announcement That Came Too Early: Berlin Wall, 1989",
  description: "On 9 November 1989 an East German spokesman, handed a note and not fully briefed, said new travel rules took effect immediately. That night the checkpoints opened. Facts from Wikipedia's account of the fall of the Berlin Wall; photos from Wikimedia Commons with credits in the video.\n\n#Shorts #History #BerlinWall #ColdWar #HiddenPast\n\nSource: https://en.wikipedia.org/wiki/Fall_of_the_Berlin_Wall\nImages: Bundesarchiv (CC BY-SA 3.0 de), Günter Schabowski (CC BY-SA 3.0) and a public-domain photograph, via Wikimedia Commons.",
  tags: ["Berlin Wall", "1989", "Günter Schabowski", "Cold War", "German history", "9 November"],
};
