/**
 * The planner names a beat's type and, optionally, its composition (visual_type and
 * canvas_composition on the beat). This is the vocabulary those names are read against.
 *
 * The renderer draws a fixed set of compositions on its grid (canvas-layout.js); that set is
 * what the planner is told. A name outside it is NOT an error: it is logged as
 * composition_unknown, mapped to the nearest composition, and the mapping is reported in the plan
 * (compositionMappings) so the audit shows what the planner asked for and what it got.
 *
 * Nothing here decides a beat on its own. wantedTypes() turns what the planner said into the
 * ordered list of visual types to TRY; the grounding gate (checkVisual in gemini-visual-plan.js)
 * still decides whether the sentence supports them.
 */

/** The compositions the renderer can draw (canvas-layout.js COMPONENTS + PORTRAIT). */
export const COMPOSITIONS = Object.freeze([
  "TYPE-FULL", "TYPE-SPLIT", "NUMBER-FULL", "DATA-FULL", "SCENE-FULL", "ARCHITECTURE", "PORTRAIT",
  "DOCUMENT", "MONEY", "MAP-CENTERED", "PROCESS-FULL", "TIMELINE", "COMPARISON-SPLIT", "LIST-BUILD",
]);

/** The visual types the planner may name (gemini-visual-plan.js VISUAL_TYPES). */
export const VISUAL_TYPE_NAMES = Object.freeze(["PHOTO", "COUNTER", "BAR", "PIE", "LINE", "GAUGE", "TREND", "MAP", "PROCESS", "LIST", "TIMELINE", "COMPARE", "DOCUMENT", "MONEY", "TYPE"]);

/** Visual types a composition is drawn from, most likely first. */
export const TYPES_FOR_COMPOSITION = Object.freeze({
  "TYPE-FULL": ["TYPE"], "TYPE-SPLIT": ["TYPE"], "NUMBER-FULL": ["COUNTER"], "DATA-FULL": ["BAR", "LINE", "PIE", "GAUGE", "TREND"],
  "SCENE-FULL": ["PHOTO"], "ARCHITECTURE": ["PHOTO"], "PORTRAIT": ["PHOTO"], "DOCUMENT": ["DOCUMENT"], "MONEY": ["MONEY"],
  "MAP-CENTERED": ["MAP"], "PROCESS-FULL": ["PROCESS"], "TIMELINE": ["TIMELINE"], "COMPARISON-SPLIT": ["COMPARE"], "LIST-BUILD": ["LIST"],
});

// Words a planner uses for a composition it was not given a name for.
const SYNONYMS = Object.freeze({
  "HEADLINE": "TYPE-FULL", "STATEMENT": "TYPE-FULL", "TYPOGRAPHY": "TYPE-FULL", "TYPE": "TYPE-FULL", "TEXT": "TYPE-FULL", "TITLE": "TYPE-FULL", "QUOTE": "TYPE-FULL",
  "SPLIT": "TYPE-SPLIT", "SPLIT-TYPE": "TYPE-SPLIT", "TWO-LINE": "TYPE-SPLIT",
  "NUMBER": "NUMBER-FULL", "BIG-NUMBER": "NUMBER-FULL", "COUNTER": "NUMBER-FULL", "HERO-NUMBER": "NUMBER-FULL", "STAT": "NUMBER-FULL", "FIGURE": "NUMBER-FULL",
  "CHART": "DATA-FULL", "DATA": "DATA-FULL", "GRAPH": "DATA-FULL", "BAR": "DATA-FULL", "BAR-CHART": "DATA-FULL", "LINE-CHART": "DATA-FULL", "PIE": "DATA-FULL", "DONUT": "DATA-FULL", "GAUGE": "DATA-FULL",
  "PHOTO": "SCENE-FULL", "IMAGE": "SCENE-FULL", "SCENE": "SCENE-FULL", "FULL-BLEED": "SCENE-FULL", "FULL-BLEED-PHOTO": "SCENE-FULL", "PHOTOGRAPH": "SCENE-FULL",
  "BUILDING": "ARCHITECTURE", "FACADE": "ARCHITECTURE", "PERSON": "PORTRAIT", "HEADSHOT": "PORTRAIT",
  "MAP": "MAP-CENTERED", "PROCESS": "PROCESS-FULL", "FLOW": "PROCESS-FULL", "DIAGRAM": "PROCESS-FULL", "FLOWCHART": "PROCESS-FULL",
  "COMPARISON": "COMPARISON-SPLIT", "COMPARE": "COMPARISON-SPLIT", "VERSUS": "COMPARISON-SPLIT", "VS": "COMPARISON-SPLIT", "SPLIT-SCREEN": "COMPARISON-SPLIT",
  "LIST": "LIST-BUILD", "BULLETS": "LIST-BUILD", "ENUMERATION": "LIST-BUILD", "CHECKLIST": "LIST-BUILD",
  // A SHOT name written here (canvas-layout.js SHOTS — the shot is its own field): the content it frames.
  "SCENE-LOW": "SCENE-FULL", "PHOTO-BAND": "SCENE-FULL", "PHOTO-EDGE": "SCENE-FULL", "PHOTO-CARD": "SCENE-FULL", "PHOTO-INSET": "SCENE-FULL", "PHOTO-STRIP": "SCENE-FULL",
  "HERO-STACK": "TYPE-FULL", "HERO-LOW": "TYPE-FULL", "HERO-SCATTER": "TYPE-FULL", "HERO-OVER": "TYPE-FULL",
});

const canon = (s) => String(s ?? "").trim().toUpperCase().replace(/[\s_/]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

function distance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/**
 * Map a composition name the planner wrote to one the renderer draws.
 * -> { composition, exact, via } or null when nothing reasonable is near.
 *   exact: the name was already one of COMPOSITIONS.
 *   via:   "synonym" | "nearest" for a mapped name.
 */
export function nearestComposition(name) {
  const c = canon(name);
  if (!c) return null;
  if (COMPOSITIONS.includes(c)) return { composition: c, exact: true, via: "exact" };
  if (SYNONYMS[c]) return { composition: SYNONYMS[c], exact: false, via: "synonym" };
  // a token the planner wrote that is part of a known name ("FULL-BLEED-MAP" -> MAP-CENTERED)
  for (const tok of c.split("-")) if (SYNONYMS[tok] && tok.length >= 3) return { composition: SYNONYMS[tok], exact: false, via: "synonym" };
  let best = null;
  for (const k of COMPOSITIONS) {
    const d = distance(c, k) / Math.max(c.length, k.length);
    if (!best || d < best.d) best = { composition: k, d };
  }
  return best && best.d <= 0.5 ? { composition: best.composition, exact: false, via: "nearest" } : null;
}

/**
 * What the planner said about a beat's type, as the ordered visual types to try.
 *   input   { visual_type, canvas_composition } as the planner wrote them
 *   -> { types: [...], split, composition, declared, unknown: [{ wrote, mappedTo }] }
 * `declared` is false when the planner named neither; then `types` is empty and the caller's
 * own default applies.
 */
export function wantedTypes({ visual_type, canvas_composition } = {}) {
  const types = [];
  const unknown = [];
  let composition = null, split = false;
  const vt = canon(visual_type);
  if (vt) {
    if (VISUAL_TYPE_NAMES.includes(vt)) types.push(vt);
    else if (vt === "PORTRAIT" || vt === "LOGO") types.push("PHOTO");
    else {
      const m = nearestComposition(vt);
      if (m) { unknown.push({ field: "visual_type", wrote: String(visual_type), mappedTo: m.composition }); for (const t of TYPES_FOR_COMPOSITION[m.composition]) types.push(t); composition = m.composition; }
      else unknown.push({ field: "visual_type", wrote: String(visual_type), mappedTo: null });
    }
  }
  const cc = canon(canvas_composition);
  if (cc) {
    const m = nearestComposition(cc);
    if (m) {
      composition = m.composition;
      if (!m.exact) unknown.push({ field: "canvas_composition", wrote: String(canvas_composition), mappedTo: m.composition });
      for (const t of TYPES_FOR_COMPOSITION[m.composition]) if (!types.includes(t)) types.push(t);
      split = m.composition === "TYPE-SPLIT";
    } else unknown.push({ field: "canvas_composition", wrote: String(canvas_composition), mappedTo: null });
  }
  return { types, split, composition, declared: types.length > 0, unknown };
}
