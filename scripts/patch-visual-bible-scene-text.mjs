/**
 * Visual Bible v4 -> v5: the rules run 35261545735 proved were missing.
 *
 * The narrative-typography pass (v4) wrote the contract for the ONE centred
 * phrase and assumed that was the only text in a video. Real frames from
 * run 35261545735 showed object-first mechanisms drawing headline-weight
 * labels, stacked title+subhead pairs, engine vocabulary as section labels,
 * and translucent text below AA. v4 had no rule that any of those broke,
 * because v4 did not know that text existed.
 *
 * Idempotent: re-running leaves an already-patched Bible unchanged.
 *
 *   node scripts/patch-visual-bible-scene-text.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "config/visual-bible.json";
const bible = JSON.parse(readFileSync(PATH, "utf8"));

const NEW_RULES = {
  "TYP-12": {
    name: "no-engine-vocabulary-on-screen",
    category: "TYPOGRAPHY",
    severity: "CRITICAL",
    description:
      "The names of the internal visual mechanisms must never be rendered. " +
      "Words like EXPECTED, REALITY, ACTUAL, CONSUMED, CAUSE, RESULT, " +
      "BEFORE, AFTER, SURFACE, BENEATH, 'EXPECTED -> ACTUAL' are engine " +
      "vocabulary: they name the device to the viewer instead of letting the " +
      "device work, and they are section labels, which TYP-09 already bans. " +
      "A mechanism that needs a word to explain what it is showing has not " +
      "shown it. The enforced list lives in " +
      "src/skills/remotion-render/visual/scene-text.js ENGINE_VOCABULARY, " +
      "and the local auditor fails any beat whose manifest reports one.",
    pass: "Every on-screen string is content: a phrase, a figure, or a named thing from the research.",
    fail: "Any label that names the mechanism, the state, or the layout role rather than the subject.",
  },
  "TYP-13": {
    name: "one-narrative-line-per-beat",
    category: "TYPOGRAPHY",
    severity: "CRITICAL",
    description:
      "A beat carries AT MOST ONE narrative line, whichever mechanism draws " +
      "it. Two narrative strings in one beat is the headline + supporting " +
      "line structure TYP-01 prohibits, and it arrives just as easily from " +
      "an object-first scene labelling two states as from a typography " +
      "scene stacking two rows. Figures and units (role 'value'/'quiet' in " +
      "TEXT_SURFACES) are data, not narrative lines, and do not count " +
      "against this — a chart may label its bar and its axis.",
    pass: "One thought, one line. A second string on the beat is a figure or a unit, not a second phrase.",
    fail: "Two title-ish strings in one beat, e.g. 'The Full Encounter' above 'Final Two Seconds'.",
  },
  "TYP-14": {
    name: "typography-never-substitutes-for-a-visual",
    category: "TYPOGRAPHY",
    severity: "CRITICAL",
    description:
      "A beat whose only content is text has no visual, and no mechanism " +
      "label makes it one. Declaring a mechanism does not discharge the " +
      "obligation to draw it: run 35261545735's STATE_CHANGE beat declared " +
      "a mechanism and rendered two text rows and two rules, which is a " +
      "text slide wearing a mechanism's name. Every object-first mechanism " +
      "must draw its objects; its strings may only label what is drawn.",
    pass: "Remove every string from the beat and a viewer still sees the idea.",
    fail: "Remove the strings and the frame is empty, or only rules/dividers remain.",
  },
  "COL-24": {
    name: "text-de-emphasis-by-colour-not-alpha",
    category: "COLOR",
    severity: "CRITICAL",
    description:
      "De-emphasised text is drawn in a quieter contrast-validated COLOUR at " +
      "full opacity, never as a bright fill at reduced alpha. A translucent " +
      "glyph composites toward the ground, and thin anti-aliased cores never " +
      "reach full coverage, so the measured contrast collapses: " +
      "StateChangeScene drew ed.text at 0.7 inside a group at 0.65 (0.455 " +
      "effective) and the gate measured rgb(77,77,87) on rgb(14,14,24) = " +
      "2.30:1. Alpha is for MOTION only, and the settled value must be 1. " +
      "Separately, a text fill needs headroom for its own edges: the same " +
      "#F5536B that measures 5.74:1 flat sampled 4.47:1 as a glyph. " +
      "ensureTextContrast() derives the headroom from the channel's declared " +
      "colour, so SCR-13 still holds — colour stays in channels.json.",
    pass: "Every settled text fill is opaque and clears the AA floor with headroom after anti-aliasing.",
    fail: "Any <text> whose settled opacity is below 1, or whose flat contrast has no margin over 4.5:1.",
  },
  "SRC-02": {
    name: "no-rendered-figure-without-a-source",
    category: "SOURCING",
    severity: "CRITICAL",
    description:
      "A numeral drawn on screen must come from the research, not from the " +
      "visual plan's geometry. ConsumptionScene printed axis labels " +
      "0/25/50/75/100% and an 'N% LEFT' readout computed from a " +
      "model-chosen fill ratio, which presents a proportion nobody measured " +
      "as a statistic; SurfaceBeneathScene did the same with 88/76/64%. A " +
      "mechanism may show a proportion GEOMETRICALLY — a bar's length, a " +
      "vessel's drain — without asserting a number. Print a figure only when " +
      "it traces to sources_used, exactly as SCR-14 requires of the script.",
    pass: "Every on-screen numeral traces to the research; proportions with no measured value are shown as geometry only.",
    fail: "Percentages, counts, or axis numerals derived from plan geometry or a default constant.",
  },
};

let added = 0;
let updated = 0;
for (const [id, rule] of Object.entries(NEW_RULES)) {
  if (!bible.rules[id]) added++;
  else if (JSON.stringify(bible.rules[id]) !== JSON.stringify(rule)) updated++;
  bible.rules[id] = rule;
}

// The failure_categories list is an array; add the owner distinction this
// class of defect needs, without disturbing the existing entries.
const cats = bible.failure_categories;
if (Array.isArray(cats)) {
  const want = "RENDERED_TEXT_CONTRACT — the renderer drew text that violates the typography contract (stacked lines, engine vocabulary, translucent fills, ungrounded numerals). Owner: PLAN_COMPLIANCE, not DIRECTION_QUALITY: the direction may have been fine and the scene built it wrong.";
  if (!cats.some((c) => String(c).startsWith("RENDERED_TEXT_CONTRACT"))) {
    cats.push(want);
    added++;
  }
}

bible.version = 5;

writeFileSync(PATH, JSON.stringify(bible, null, 2) + "\n");
console.log(`visual-bible.json -> v${bible.version}: ${added} added, ${updated} updated`);
console.log(`rules now: ${Object.keys(bible.rules).length}`);
