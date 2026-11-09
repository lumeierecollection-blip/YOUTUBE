/**
 * Proof B: Celebrity Profile / Glossy Entertainment Magazine. Written directly from one fetched news report and NOT reviewed by the
 * script engine's independent critic. Four real, licensed photographs from different years (dates read from Commons) show a career
 * progression; none is generated. The facts are the ones the KQED report states, and nothing about earlier career years is claimed.
 */
import { claims as sampleClaims, sources, sentences as sampleSentences, metadata as sampleMeta } from "./sample-magazine.mjs";

export const topic = "Beyoncé's record-breaking Grammy night";
export const central_question = "How did Beyoncé become the most-awarded artist in Grammy history?";
export const category = "awards and achievements, career milestone, Grammy record";

export const claims = sampleClaims;
export { sources };
export const sentences = sampleSentences;

export const scenes = [
  { kind: "cover", treatment: "magazine-cover-full-bleed", objective: "Open on a magazine cover: the real 2023 tour photograph full-bleed, the headline, the credit", background: "full-bleed photograph" },
  { kind: "nine", treatment: "big-number-with-cutout", objective: "Show nine nominations as a giant numeral with a clean cut-out portrait layered through it and nine stars lighting in turn", background: "cream page" },
  { kind: "win", treatment: "win-card-with-cutout-and-quote", objective: "Name the win and the album beside a framed photograph, then the quotation she gave on stage", background: "cream page" },
  { kind: "total", treatment: "counter-with-career-strip", objective: "Count up to thirty-two and show four photographs from different years as a career strip, each labelled with its photo date", background: "cream page, gold accent" },
  { kind: "record", treatment: "record-ribbon-with-photo", objective: "Close on the record ribbon and the sixty-five-year span over the 2023 photograph, with all photo credits", background: "cream page" },
];

export const blueprint = {
  central_question,
  thesis: "At the 65th Grammys, Beyoncé's fourth win of the night, best dance/electronic music album, took her career total to 32, the most of any artist in the awards' history.",
  why_it_matters: "A record built win by win is easy to lose in a number; this shows the night it was set.",
  structure: ["the achievement", "the nominations", "the win and the quote", "the number", "the record"],
};

export const ASSETS = [
  { id: "bey-2023", key: "p2023", title: "File:Beyoncé - Tottenham Hotspur Stadium - 1st June 2023 (10 of 118) (52946364598) (best crop).jpg", role: "full-bleed cover and closing photograph", claim: "M1" },
  { id: "bey-2011", key: "p2011", title: "File:Beyoncé Knowles GMA Run the World cropped.jpg", role: "clean cut-out through the nominations numeral", claim: "M3", cutout: { seed: 2 } },
  { id: "bey-2009", key: "p2009", title: "File:Beyoncé Knowles 2009.jpg", role: "framed photograph beside the win card", claim: "M2" },
  { id: "bey-2016", key: "p2016", title: "File:Beyonce - The Formation World Tour, at Wembley Stadium in London, England.jpg", role: "career strip", claim: "M1" },
];

export const DOCUMENTS = [
  { id: "kqed-excerpt", type: "typeset excerpt of fetched text", description: "The record, the win and the quotation", source_url: "https://kqed.org/arts/13924749/beyonce-sets-a-new-grammy-record-while-harry-styles-wins-album-of-the-year", claim: "M1, M2, M3, M4" },
];

export const metadata = {
  ...sampleMeta,
  description: sampleMeta.description.replace("Photo: Raph_PH, CC BY 2.0, via Wikimedia Commons.", "Photos via Wikimedia Commons, with author and licence recorded in the asset manifest: Raph_PH (CC BY 2.0) and others credited on screen."),
};
