/**
 * Hidden Past, Vox treatment: the 9 November 1989 press conference. Hand-planned from one fetched Wikipedia article, NOT reviewed by the
 * script engine's critic. Every claim carries a text that the run must find in the fetched article before it renders.
 */
import { claims as docClaims, metadata as docMeta } from "./doc-berlin.mjs";
export const SLUG = "berlin-wall-early-announcement";
export const TOPIC = "How an early announcement opened the Berlin Wall's checkpoints";
export const WIKI_ARTICLE = "https://en.wikipedia.org/wiki/Fall_of_the_Berlin_Wall";
const COMMONS = (t) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2C/g, ",")}`;
export const FILES = {
  press: { title: "File:Bundesarchiv Bild 183-1989-1109-030, Berlin, Schabowski auf Pressekonferenz.jpg", full: true },
  note: { title: "File:Schabowski-notizzettel.jpg", full: true },
  gate: { title: "File:BrandenburgerTorDezember1989.jpg", width: 2000 },
};
for (const f of Object.values(FILES)) f.page_url = COMMONS(f.title);
const must = {
  B1: "prematurely announced that East Germans could travel without restrictions",
  B2: "beginning at 18:00 CET on 9 November and broadcast live on East German television and radio",
  B3: "he was handed a note from Krenz announcing the changes, but given no further instructions",
  B4: "it takes effect immediately, without delay",
  B5: "issued a bulletin at 19:04 which reported that East German citizens would be able to cross the inner German border",
  B6: "allowing guards to open the checkpoints",
};
export const CLAIMS = docClaims.map((c) => ({ ...c, must: { from: "wiki", text: must[c.claim_id] } }));
export const SENTENCES = [
  { text: "The Berlin Wall opened after an announcement came too early.", scene: 0, claim_ids: ["B1"] },
  { text: "He spoke live on East German television, 9 November 1989.", scene: 0, claim_ids: ["B2"] },
  { text: "Spokesman Günter Schabowski had just been handed a note.", scene: 1, claim_ids: ["B3"] },
  { text: "Asked when it began, he said: immediately, without delay.", scene: 2, claim_ids: ["B4"] },
  { text: "West German news told viewers the borders were open.", scene: 2, claim_ids: ["B5"] },
  { text: "That night, guards at Bornholmer Straße let people through.", scene: 3, claim_ids: ["B6"] },
  { text: "One unprepared answer opened the checkpoints.", scene: 4, claim_ids: ["B3", "B6"] },
];
export const ROUTES = { chapterTitle: "The Answer", headlines: ["An announcement came too early", "The note he was handed", "“Immediately, without delay”", "Berlin, that night", "The checkpoints opened"] };
export const METADATA = docMeta;
