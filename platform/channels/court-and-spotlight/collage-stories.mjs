/**
 * Two Court & Spotlight stories rendered in the living-collage engine. Facts, claims and sentences are the ones already verified against
 * their fetched sources (proof-investigation.mjs and grammy-pack.mjs); only the pictures and layout change. Written directly and NOT
 * reviewed by the script engine's critic.
 */
import * as inv from "./proof-investigation.mjs";
import * as gr from "./grammy-pack.mjs";

const grTitle = (id) => gr.ASSETS.find((a) => a.id === id).title;

export const STORIES = {
  investigation: {
    composition: "CourtCaseCollageShort",
    topic: inv.topic, claims: inv.claims, sources: inv.sources, sentences: inv.sentences, metadata: inv.metadata, blueprint: inv.blueprint,
    scenes: [
      { kind: "cover", treatment: "case-board-cover-with-sticker-portrait", objective: "Open the case board: the subject, the outcome and the Justice Department sentence text", background: "aged paper, torn scraps" },
      { kind: "doj", treatment: "typed-document-with-highlight-and-stamp", objective: "Show the release text with the guilty verdict highlighted and stamped CONVICTED", background: "aged paper, torn scraps" },
      { kind: "acquitted", treatment: "charge-tickets-stamped-acquitted", objective: "Show the five other charges as tickets, counted up and stamped ACQUITTED", background: "aged paper, torn scraps" },
      { kind: "alleged", treatment: "amber-allegation-card-with-source", objective: "Show the government figure on an amber card, stamped ALLEGED, with the CBS text beneath", background: "aged paper, amber card" },
      { kind: "sought", treatment: "sought-versus-given-collage", objective: "Set what prosecutors sought against the three years given, with the subject below", background: "aged paper, torn scraps" },
      { kind: "booking", treatment: "taped-booking-photo-record", objective: "Show the genuine public-domain booking photograph, its source, and the closing record of what was decided and what was alleged", background: "aged paper, taped photo" },
    ],
    ASSETS: [
      { id: "snipes-portrait", key: "portrait", title: "File:Wesley Snipes by Gage Skidmore.jpg", claim: "K1", cutout: { paper: 16, bw: true, seed: 4 } },
      { id: "snipes-booking", key: "booking", title: "File:Wesley Snipes mug shot.jpg", claim: "P1" },
    ],
  },
  grammy: {
    composition: "CourtMagCollageShort",
    topic: gr.topic, claims: gr.claims, sources: gr.sources, sentences: gr.sentences, metadata: gr.metadata, blueprint: gr.blueprint,
    scenes: [
      { kind: "cover", treatment: "magazine-cover-collage", objective: "Open on the real 2023 photograph taped on pastel scraps with the headline and a record sticker", background: "warm paper, pastel scraps" },
      { kind: "solti", treatment: "old-record-count-up-collage", objective: "Count up to the old record of 31 beside the real portrait of Georg Solti and the KQED line", background: "warm paper, yellow scrap" },
      { kind: "nine", treatment: "nominations-and-tie-collage", objective: "Count nine nominations with a sticker portrait, then the Cuff It win that tied the record", background: "warm paper, lilac and pink scraps" },
      { kind: "record", treatment: "strike-31-to-32-with-trophy-photo", objective: "Strike 31, land 32, circle it, with a real Grammy trophy photograph taped beside", background: "warm paper, pink scrap" },
      { kind: "quote", treatment: "pull-quote-with-photo", objective: "Show her quotation as a magazine pull-quote beside a labelled photograph", background: "warm paper, yellow scrap" },
    ],
    ASSETS: [
      { id: "bey-2023", key: "p2023", title: grTitle("bey-2023"), claim: "M1" },
      { id: "solti", key: "solti", title: grTitle("solti"), claim: "M5" },
      { id: "bey-2011", key: "p2011cut", title: grTitle("bey-2011"), claim: "M3", cutout: { paper: 8 } },
      { id: "trophy", key: "trophy", title: grTitle("trophy"), claim: "M1" },
      { id: "bey-2009", key: "p2009", title: grTitle("bey-2009"), claim: "M4" },
    ],
  },
};
