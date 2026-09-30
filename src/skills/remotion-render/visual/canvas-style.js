/**
 * Per-beat styling decisions for a resolved full-canvas plan — pure JS, so
 * the rules are unit-tested (scripts/test-canvas-style.mjs) and the resolver
 * (scripts/render-and-qa.js resolveCanvas) only calls styleCanvases():
 *
 *   sentence case   headline / lead-in rebuilt from the narration's casing
 *   variant         beat index: left / right anchoring alternates beat by beat
 *   dark beats      RETIRED (assignDark is kept, tested, and not called): uniform white throughout. Was: the 4th (or 5th) beat and,
 *                   in a long video, the 4th / 5th after it; at most two, never
 *                   consecutive, never a photo / map / object beat
 *   emphasis        at most ONE beat's headline is one word filling the frame
 *   vertical        at most ONE beat's statement is rotated along the edge
 *   number accent   the hero number takes the channel accent when it is a
 *                   change / loss / gain, and the video's biggest figure always
 *                   does; otherwise it is ink
 *
 * None of this invents content: every character on screen is the planner's
 * (checked against the sentence by gemini-visual-plan.js); only its case,
 * position and colour are decided here.
 */
import { sentenceCase, fitEmphasis, numberParts } from "./typography.js";

export const DARK_MAX = 2;
const CHANGE_WORDS = /\b(ris(?:e|es|en|ing)|rose|fall(?:s|ing|en)?|fell|drop(?:s|ped|ping)?|cuts?|cutting|lost|loss(?:es)?|los(?:e|es|ing)|gain(?:s|ed|ing)?|grew|grow(?:s|th|ing)?|increas(?:e|es|ed|ing)|decreas(?:e|es|ed|ing)|surg(?:e|es|ed|ing)|plung(?:e|es|ed|ing)|jump(?:s|ed|ing)?|soar(?:s|ed|ing)?|slump(?:s|ed|ing)?|hik(?:e|es|ed|ing)|costs?|cost(?:ing)?|stole|stolen|defraud(?:ed|s)?|fraud|save[sd]?|saving|wip(?:e|ed|es) out|doubl(?:e|ed|es)|tripl(?:e|ed|es)|halv(?:e|ed|es))\b/i;

const isMap = (c) => String(c.visual_type).toUpperCase() === "MAP";
/** A beat that can carry the inverted ground: type, chart or process — not a photo, map or cutout. */
const darkEligible = (c) => !c.photo && !c.cutout && !isMap(c) && ["TYPE-FULL", "TYPE-SPLIT", "NUMBER-FULL", "DATA-FULL", "PROCESS-FULL", "LIST-BUILD", "TIMELINE"].includes(c.composition);

/** Which beats are dark: the 4th (else 5th) beat, then the 4th / 5th after it, at most two, never consecutive. */
export function assignDark(canvases) {
  const n = canvases.length, picked = [];
  const pick = (from) => {
    for (const i of [from, from + 1]) {
      if (i >= 1 && i < n && darkEligible(canvases[i]) && !picked.some((p) => Math.abs(p - i) < 2)) return i;
    }
    return -1;
  };
  if (n >= 4) {
    const a = pick(3);
    if (a >= 0) picked.push(a);
    if (a >= 0 && n >= 9) { const b = pick(a + 4); if (b >= 0 && picked.length < DARK_MAX) picked.push(b); }
  }
  canvases.forEach((c, i) => { c.dark = picked.includes(i); });
  return picked;
}

/** At most one beat's headline becomes the emphasis word (a TYPE beat, not the hook, whose emphasis word fits the frame). */
export function assignEmphasis(canvases, maxW = 984) {
  canvases.forEach((c) => { c.emphasis_beat = false; });
  for (let i = 1; i < canvases.length; i++) {
    const c = canvases[i];
    if (c.composition !== "TYPE-FULL" || String(c.visual_type).toUpperCase() !== "TYPE" || c.vertical || !c.headline || !c.emphasis_word) continue;
    const w = String(c.emphasis_word).replace(/[^\p{L}]/gu, "");
    if (!w || !new RegExp(`\\b${w}\\b`, "i").test(c.headline) || !fitEmphasis(w, maxW)) continue;
    c.emphasis_beat = true;
    return i;
  }
  return -1;
}

/** At most one beat's statement is rotated along the left edge: a short headline in a long video, mid-way through. */
export function assignVertical(canvases) {
  canvases.forEach((c) => { c.vertical = false; });
  const n = canvases.length;
  if (n < 7) return -1;
  const mid = Math.floor(n / 2);
  const order = [...canvases.keys()].filter((i) => i >= 2 && i < n - 1).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  for (const i of order) {
    const c = canvases[i];
    const words = String(c.headline || "").trim().split(/\s+/).filter(Boolean);
    if (c.composition !== "TYPE-FULL" || String(c.visual_type).toUpperCase() !== "TYPE" || c.emphasis_beat || c.dark || words.length < 1 || words.length > 3 || c.lead_in) continue;
    c.vertical = true;
    return i;
  }
  return -1;
}

/** Does the narration state a change / loss / gain? */
export const statesChange = (text) => CHANGE_WORDS.test(String(text || ""));

/** The hero number takes the accent when its sentence is a change / loss / gain, and the video's biggest figure always does. */
export function assignNumberAccent(canvases, narrations) {
  let best = -1, bestMag = -1;
  canvases.forEach((c, i) => {
    if (String(c.visual_type).toUpperCase() !== "COUNTER" || !c.data?.value) return;
    const p = numberParts(c.data.value);
    const mag = Number(String(p.digits).replace(/,/g, "")) * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[p.suffix] || ({ thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 }[p.scaleWord] || 1));
    if (mag > bestMag) { bestMag = mag; best = i; }
  });
  canvases.forEach((c, i) => {
    if (String(c.visual_type).toUpperCase() !== "COUNTER") return;
    c.number_accent = i === best || statesChange(narrations[i]);
  });
  return best;
}

/**
 * The whole pass. `canvases[i]` is beat i's canvas content, `narrations[i]`
 * its sentence. Returns what it decided (logged by the resolver).
 */
export function styleCanvases(canvases, narrations = []) {
  canvases.forEach((c, i) => {
    const src = narrations[i] || "";
    if (c.headline) c.headline = sentenceCase(c.headline, src);
    if (c.lead_in) c.lead_in = sentenceCase(c.lead_in, src);
    c.beat_index = i;
    c.beat_total = canvases.length;          // the folio ("03 / 08") on a beat with no lead-in
    c.variant = i;
  });
  const emphasis = assignEmphasis(canvases);
  // The rotated whole-line beat is retired (kinetic typography: no text animates as a block); assignVertical is kept and tested.
  canvases.forEach((c) => { c.vertical = false; });
  const vertical = -1;
  // No dark beats: the ground is uniform white on every beat (backgrounds.js).
  // assignDark is kept and tested, not called.
  canvases.forEach((c) => { c.dark = false; });
  const dark = [];
  const accentBest = assignNumberAccent(canvases, narrations);
  return { dark, emphasis, vertical, accentBest };
}
