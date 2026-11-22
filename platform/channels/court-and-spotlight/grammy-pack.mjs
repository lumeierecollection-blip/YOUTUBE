/**
 * Court & Spotlight, "printed, not lit" explainer (github.com/Cele-san/vox-style-animation look): Beyoncé's record Grammy night.
 * Facts come from one fetched KQED report (6 Feb 2023). Written directly and NOT reviewed by the script engine's independent critic.
 * Every photograph is a real Wikimedia Commons file with its licence read from the API. Nothing is generated.
 */
import { sources as magSources, claims as magClaims, metadata as magMeta } from "./sample-magazine.mjs";

const KQED = magSources[0];
const claim = (claim_id, text, excerpt, context) => ({ claim_id, claim: text, source_id: KQED.source_id, source_url: KQED.url, published: KQED.published, excerpt, confidence: "high", context, contradictory_evidence: [], editorial_status: "confirmed" });
export const sources = magSources;
export const claims = [
  ...magClaims,
  claim("M5", "The previous Grammy record of 31 wins was set by the late Hungarian-born classical conductor Georg Solti.", "The previous Grammy record of 31 wins was a feat set by the late Hungarian-born classical conductor Georg Solti.", "Same KQED report."),
  claim("M6", "Half an hour into the show, Beyoncé tied the all-time record for most Grammys when she and co-writers won best R&B song for Cuff It.", "tied the all-time record for most Grammys won when she and a team of co-writers won best R&B song for", "Same KQED report; 'half an hour into the show' is the report's wording."),
];
export const topic = "Beyoncé's record-breaking Grammy night";
const S = (text, scene, claim_ids) => ({ text, scene, claim_ids });
export const sentences = [
  S("In one night, Beyoncé became the most-awarded artist in Grammy history.", 0, ["M1"]),
  S("The old record: thirty-one, set by conductor Georg Solti.", 1, ["M5"]),
  S("She arrived with nine nominations.", 2, ["M3"]),
  S("Half an hour in, Cuff It tied the record.", 2, ["M6"]),
  S("Her fourth win, for Renaissance, broke it.", 3, ["M2", "M1"]),
  S("Thirty-two Grammys, and a new record.", 3, ["M1"]),
  S("On stage, she said she was just trying to receive the night.", 4, ["M4"]),
];
export const scenes = [
  { kind: "cover", treatment: "paper-slap-in-photo-with-highlighter", objective: "Open on the real 2023 photograph with the headline and a highlighted 'most'", background: "cream paper, halftone dot field" },
  { kind: "solti", treatment: "giant-count-up-with-halftone-portrait", objective: "Count up to the old record of thirty-one beside a halftone ink portrait of Georg Solti", background: "recessed paper, coarse halftone (old world)" },
  { kind: "nine", treatment: "count-up-and-tie-card", objective: "Count nine nominations, then slap in the card for the Cuff It win that tied the record", background: "cream paper" },
  { kind: "record", treatment: "strike-31-to-32-with-trophy-and-red-pen", objective: "Strike through thirty-one, land thirty-two in cobalt, circle it in red pen, with a real Grammy trophy photograph", background: "cream paper" },
  { kind: "quote", treatment: "quote-with-highlighter", objective: "Show her quotation with the key word highlighted beside a labelled photograph", background: "recessed paper" },
];
export const blueprint = {
  central_question: "How did Beyoncé become the most-awarded artist in Grammy history?",
  thesis: "At the 65th Grammys she tied Georg Solti's record of 31 with Cuff It, then broke it with her fourth win, for Renaissance, reaching 32.",
  why_it_matters: "A record is easier to feel when the old number and the new one are shown side by side.",
  structure: ["the achievement", "the old record", "the nominations and the tie", "the new record", "the quote"],
};
export const ASSETS = [
  { id: "bey-2023", key: "p2023", title: "File:Beyoncé - Tottenham Hotspur Stadium - 1st June 2023 (10 of 118) (52946364598) (best crop).jpg", role: "cover photograph", claim: "M1" },
  { id: "solti", key: "solti", title: "File:Georg Solti in Amstelhotel Solti aan het woord (kop), Bestanddeelnr 927-4744.jpg", role: "old record holder, halftone ink cut-out", claim: "M5", cutout: { halftone: { cell: 11 } } },
  { id: "bey-2011", key: "p2011", title: "File:Beyoncé Knowles GMA Run the World cropped.jpg", role: "nominations scene cut-out", claim: "M3", cutout: {} },
  { id: "trophy", key: "trophy", title: "File:Grammy Award trophies - Kenny Rogers \"The Gambler\" (cropped).jpg", role: "a real Grammy trophy photograph (another artist's trophies, labelled)", claim: "M1", cutout: { model: "u2net", halftone: { cell: 10 } } },
  { id: "bey-2009", key: "p2009", title: "File:Beyoncé Knowles 2009.jpg", role: "quotation scene photograph (not from that night, labelled)", claim: "M4" },
];
export const metadata = {
  title: "How Beyoncé Broke the Grammy Record in One Night",
  description: "At the 2023 Grammys, Beyoncé tied the record of 31 set by conductor Georg Solti, then broke it with her fourth win of the night, reaching 32. Facts from KQED's report of 6 February 2023; photos from Wikimedia Commons with licences recorded and credited on screen. Trophy photo shows another artist's Grammy trophies.\n\n#Shorts #Beyonce #Grammys #MusicHistory #CourtAndSpotlight\n\nSource: https://kqed.org/arts/13924749/beyonce-sets-a-new-grammy-record-while-harry-styles-wins-album-of-the-year",
  tags: ["Beyoncé", "Grammys", "Grammy record", "Georg Solti", "Renaissance", "Cuff It", "2023 Grammys"],
};
