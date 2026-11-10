/**
 * Hidden Past, Vox collage format (CK42BB/vox-explainer-skill, MIT): the same verified Berlin Wall claims as doc-berlin.mjs, rewritten to that
 * skill's arc: cold open, turn to context, escalating explanation, reframe. Present tense, concrete times, quotable last line.
 * Written directly and NOT reviewed by the script engine's critic.
 */
import * as base from "./doc-berlin.mjs";
export const { sources, claims, topic, blueprint, ASSETS, metadata } = base;
export const compositionId = "HiddenPastCollageShort";
const S = (text, scene, claim_ids = []) => ({ text, scene, claim_ids, ...(claim_ids.length ? {} : { allow_no_claim: true, editorial: "turn to context, not a factual claim" }) });
export const sentences = [
  S("In 1989, one press-conference answer opened the Berlin Wall.", 0, ["B1"]),
  S("To see how, start with a note.", 0),
  S("Spokesman Günter Schabowski has just been handed it.", 1, ["B3"]),
  S("Asked when it starts, he says: immediately, without delay.", 2, ["B4"]),
  S("West German news tells viewers the borders are open.", 2, ["B5"]),
  S("That night, guards at Bornholmer Straße let people through.", 3, ["B6"]),
  S("A wall that stood for decades opened on one unprepared answer.", 3, ["B1", "B3"]),
];
export const scenes = [
  { kind: "press", treatment: "collage-sticker-photo-with-stamp", objective: "Show the real press-conference photograph as a sticker with the date stamp", background: "paper panel in saturated frame" },
  { kind: "note", treatment: "collage-sticker-document", objective: "Show Schabowski's own note as a taped sticker", background: "paper panel in saturated frame" },
  { kind: "quote", treatment: "collage-quote-with-timestamps", objective: "Show his answer as a giant quotation and the evening's timed events", background: "accent card on paper" },
  { kind: "night", treatment: "collage-sticker-photo-with-timestamp", objective: "Show the later photograph, labelled, with the checkpoint time", background: "paper panel in saturated frame" },
];
