/**
 * Composition variety (owner's spec 2026-10-03, part B): break the
 * "headline, headline, headline" pattern.
 *
 *   - Beat 0 (hook) and the last beat (CTA) are TYPE.
 *   - No two consecutive beats are TYPE (TYPE-FULL or TYPE-SPLIT without a hero
 *     visual — a name card counts as TYPE: it is the entity's name in type).
 *   - At most maxTypeBeats(n) TYPE beats: 3 of 10 (30%, never under 2 — the
 *     hook and the CTA).
 *
 * Used twice: by the planner on the planned visual types (count, re-ask once,
 * deterministic fallbacks) and by render-and-qa on the resolved canvases (a
 * beat whose photo did not verify fell back to TYPE after planning).
 *
 * The deterministic fallbacks for a sentence with nothing named to show
 * (part B.4), tried in this order — every one is built from the sentence's own
 * words, nothing is invented:
 *   1. it states a flow (FLOW_WORDS)        -> PROCESS, nodes from flowNodes()
 *   2. it states a rise or a fall           -> TREND (DATA-FULL): a line rising /
 *      falling to one dot, labelled with the sentence's subject — no numbers,
 *      no axis values
 *   3. it states a figure                   -> COUNTER (the caller's gate checks it)
 *   4. it states a risk / an approval / a break / a target / tracking / money
 *                                           -> that meaning's drawn symbol as the
 *      hero (concept-classes.js SYMBOLS); the symbol stands for what the
 *      sentence SAYS ("risk" -> warning triangle), not for its topic
 *   5. last resort, only to avoid a forbidden TYPE beat (owner's B.2: "PROCESS-
 *      FULL with two abstract nodes labeled with the sentence's key nouns") ->
 *      PROCESS with two of the sentence's content words, data.keynouns = true.
 *      Where its guarantee stops: an arrow between two nouns can read as a
 *      relation the sentence does not state; it is used only when 1-4 found
 *      nothing and the beat may not be TYPE, and it is logged as such.
 */
import { flowNodes, FLOW_WORDS } from "./canvas-grounding.js";

export const TYPE_COMPOSITIONS = ["TYPE-FULL", "TYPE-SPLIT"];

/** The most TYPE beats a video of n beats may have: 3 of 10, never fewer than the hook + CTA. */
export function maxTypeBeats(n) {
  return Math.max(2, Math.round(n * 0.3));
}

/** A resolved canvas reads as headline-led typography (no chart, number, photo, map, process or hero visual). */
export function isTypeCanvas(c) {
  return !!c && TYPE_COMPOSITIONS.includes(c.composition) && !c.photo && !(Array.isArray(c.concept_visuals) && c.concept_visuals.length);
}

/** A planned beat is TYPE (visual_type TYPE and no concept object or fallback symbol to show). */
export function isTypePlanned(b) {
  return String(b?.visual_type || "TYPE").toUpperCase() === "TYPE" && !(Array.isArray(b?.concepts) && b.concepts.length) && !b?.fallback_symbol;
}

/** { count, max, n, adjacent: [i, ...] (i and i-1 both TYPE), excess, ok } for a boolean TYPE flag per beat. */
export function varietyReport(isType) {
  const n = isType.length, max = maxTypeBeats(n);
  const count = isType.filter(Boolean).length;
  const adjacent = [];
  for (let i = 1; i < n; i++) if (isType[i] && isType[i - 1]) adjacent.push(i);
  const excess = Math.max(0, count - max);
  return { n, count, max, adjacent, excess, ok: excess === 0 && adjacent.length === 0 };
}

/**
 * The content beats to convert, in order: each one that sits next to another
 * TYPE beat (the later of a pair first), then the remaining excess — never the
 * hook or the CTA, and `skip(i)` beats last (a name card carries an entity).
 */
export function beatsToConvert(isType, skip = () => false) {
  const n = isType.length;
  const r = varietyReport(isType);
  if (r.ok) return [];
  const content = [...Array(n).keys()].filter((i) => i > 0 && i < n - 1 && isType[i]);
  const adj = new Set();
  for (const i of r.adjacent) { if (i < n - 1) adj.add(i); else if (i - 1 > 0) adj.add(i - 1); }
  const order = [...content.filter((i) => adj.has(i) && !skip(i)), ...content.filter((i) => !adj.has(i) && !skip(i)), ...content.filter((i) => skip(i))];
  return [...new Set(order)];
}

const GROWTH = /\b(rose|rise[sn]?|rising|grew|grow(?:s|ing|th)?|increas(?:e|es|ed|ing)|surg(?:e|es|ed|ing)|soar(?:s|ed|ing)?|climb(?:s|ed|ing)?|jump(?:s|ed|ing)?|spik(?:e|es|ed)|boom(?:s|ed|ing)?|expand(?:s|ed|ing)?|doubl(?:e|es|ed|ing)|tripl(?:e|es|ed)|higher|record high|gain(?:s|ed)?)\b/i;
const DECLINE = /\b(fell|fall(?:s|ing)?|drop(?:s|ped|ping)?|declin(?:e|es|ed|ing)|decreas(?:e|es|ed|ing)|shr[ai]nk(?:s|ing)?|shrunk|plung(?:e|es|ed)|plummet(?:s|ed)?|slump(?:s|ed)?|crash(?:es|ed)?|tumbl(?:e|es|ed)|lower|halv(?:e|es|ed)|lost|loses|losing|slid|slides)\b/i;
export const SYMBOL_RULES = [
  ["warning-triangle", /\b(risks?|risky|danger(?:s|ous)?|threat(?:s|en|ens|ened)?|warn(?:s|ed|ing)?|bann?(?:ed|s)?|illegal|fraud|scams?|hack(?:s|ed|ers?)?|breach(?:es|ed)?|crimes?|criminal|violat(?:e|es|ed|ion|ions)|penalt(?:y|ies)|fined|lawsuits?|sued|charged|indicted|guilty|unsafe|hazards?)\b/i],
  ["checkmark", /\b(approv(?:e|es|ed|al)|passed|confirm(?:s|ed)|legali[sz]ed|allowed|won|wins|granted|guarantee[sd]?|eligible|qualif(?:y|ies|ied)|accepted|cleared|upheld)\b/i],
  ["broken-chain", /\b(broke|broken|collaps(?:e|es|ed)|cut ties|split|ended|fail(?:s|ed|ure)|bankrupt(?:cy)?|default(?:s|ed)|cancel(?:l)?ed|terminated|disrupt(?:s|ed|ion))\b/i],
  ["crosshair", /\b(target(?:s|ed|ing)?|aim(?:s|ed)?|pinpoint(?:s|ed)?)\b/i],
  ["radar", /\b(track(?:s|ed|ing)?|monitor(?:s|ed|ing)?|surveillance|scan(?:s|ned|ning)?|detect(?:s|ed|ion)?|spied|spying)\b/i],
  ["dollar-sign", /\b(money|cash|dollars?|paid|pay(?:s|ing)?|costs?|price[sd]?|salar(?:y|ies)|wages?|budget|savings|debts?|loans?|income|tax(?:es)?|revenue|profits?|fees?)\b/i],
];

const STOP = new Set("a an the this that these those it its is are was were be been being has have had do does did will would can could should may might must of to in on at by for with from as into about over under after before than then and or but so yet not no nor if when while because which who whom whose what where why how all any each every some most more less much many few one two three four five six seven eight nine ten its their there here they them we you your our his her he she i me my just also only even still very really now new up down out off again".split(" "));
// "That's" / "Let's" are stop words once the contraction is cut (run 37125010644 ch-44 drew "That -> deal").
const contentWords = (s) => String(s || "").replace(/[^\p{L}\p{N}'\s-]/gu, " ").split(/\s+/).map((w) => w.replace(/['’](s|re|ve|ll|d|t)$/i, "")).filter((w) => w.length >= 4 && !STOP.has(w.toLowerCase()) && !/^\d/.test(w));

/** The direction and subject of a stated rise / fall, or null. Subject: up to 2 content words before the verb (else after). */
export function trendOf(sentence) {
  const s = String(sentence || "");
  const g = s.match(GROWTH), d = s.match(DECLINE);
  const m = g && d ? (g.index < d.index ? g : d) : g || d;
  if (!m) return null;
  const direction = m === g ? "up" : "down";
  const before = contentWords(s.slice(0, m.index)).slice(-2);
  const after = contentWords(s.slice(m.index + m[0].length)).slice(0, 2);
  const label = (before.length ? before : after).join(" ");
  return label ? { direction, label, verb: m[0] } : null;
}

/** The drawn symbol for what the sentence states, or null. */
export function symbolFor(sentence) {
  const s = String(sentence || "");
  for (const [name, re] of SYMBOL_RULES) if (re.test(s)) return name;
  return null;
}

// Verb forms and filler that are never a node's noun.
// Connectives are not nouns either (CI run 37129265971 ch-9 drew "HOWEVER -> EXPANSION").
const NOT_NOUN = /^(?:\w+(?:ed|ing)|however|therefore|meanwhile|moreover|furthermore|although|though|despite|instead|nevertheless|otherwise|indeed|thus|hence|still|also|while|whereas|means|makes|takes|gets|shows|says|said|changes|matters|needs|wants|keeps|helps|lets|puts|comes|goes|gives|everything|something|nothing|anything|everyone|someone|nobody)$/i;
/** Two of the sentence's content words — its first and last noun-like words (subject -> object) — the last-resort PROCESS. */
// A run of capitalized words is ONE name ("Middle Corridor", not "Middle" — CI run 37129265971 ch-9).
export function keyNouns(sentence) {
  const s = String(sentence || "");
  const items = [];
  const toks = s.replace(/[^\p{L}\p{N}'\s-]/gu, " ").split(/\s+/).filter(Boolean).map((w) => w.replace(/['’](s|re|ve|ll|d|t)$/i, ""));
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (/^\p{Lu}/u.test(w) && !STOP.has(w.toLowerCase()) && !NOT_NOUN.test(w)) {
      const run = [w];
      while (i + 1 < toks.length && /^\p{Lu}/u.test(toks[i + 1]) && run.length < 3) run.push(toks[++i]);
      if (run.length > 1 || i > 0 || w.length >= 4) items.push(run.join(" "));
      continue;
    }
    if (w.length >= 4 && !STOP.has(w.toLowerCase()) && !/^\d/.test(w) && !NOT_NOUN.test(w)) items.push(w);
  }
  const ws = [...new Set(items)];
  return ws.length >= 2 ? [ws[0], ws[ws.length - 1]] : null;
}

/**
 * The fallback candidates for a sentence, in the part-B.4 order. Each is
 * { kind, visual_type, data } (PROCESS / TREND / COUNTER) or { kind: "symbol",
 * symbol }. The caller runs its own gate (checkVisual) and its neighbour rule.
 * `number`: the sentence's figure for a COUNTER, if the caller has one.
 */
export function fallbacksFor(sentence, { number = null } = {}) {
  const out = [];
  const s = String(sentence || "");
  if (FLOW_WORDS.test(s)) { const nodes = flowNodes(s); if (nodes) out.push({ kind: "process", visual_type: "PROCESS", data: { nodes } }); }
  const tr = trendOf(s);
  if (tr) out.push({ kind: "trend", visual_type: "TREND", data: { direction: tr.direction, label: tr.label } });
  if (number) out.push({ kind: "counter", visual_type: "COUNTER", data: number });
  const sym = symbolFor(s);
  if (sym) out.push({ kind: "symbol", symbol: sym });
  const kn = keyNouns(s);
  if (kn) out.push({ kind: "keynouns", visual_type: "PROCESS", data: { nodes: kn, keynouns: true } });
  return out;
}

const STYLES = ["together", "staggered", "visual-first"];
/**
 * entrance_style per beat (part C.4): together | staggered | visual-first, never
 * the same on two consecutive beats. A planned value is kept when it is valid
 * and differs from the previous beat; otherwise the next style in rotation.
 */
export function assignEntranceStyles(planned = []) {
  const out = [];
  planned.forEach((p, i) => {
    // The planner's own style stands as written, repeat or not; only a beat it left open is filled,
    // with one that differs from its neighbour.
    if (STYLES.includes(p)) { out.push(p); return; }
    let s = STYLES[i % 3];
    if (i > 0 && s === out[i - 1]) s = STYLES[(STYLES.indexOf(s) + 1) % 3];
    out.push(s);
  });
  return out;
}
export const ENTRANCE_STYLES = STYLES;

/**
 * Animation families (Task 5.4): pop-in, slide-in, draw-in, count-up. Each beat
 * uses a different family; never the same family on two consecutive beats. A
 * beat showing a number counts up; a chart draws in; otherwise pop-in /
 * slide-in alternate. Exported so the render manifest can report the variety.
 */
const ANIM_FAMILIES = ["pop-in", "slide-in", "draw-in", "count-up"];
export function assignAnimationFamilies(beats = []) {
  const out = [];
  beats.forEach((b, i) => {
    // The planner's own family stands; only a beat it left open gets the default below.
    if (ANIM_FAMILIES.includes(b?.animation_family)) { out.push(b.animation_family); return; }
    const vt = String(b?.visual_type || "TYPE").toUpperCase();
    let fam;
    if (vt === "COUNTER" || vt === "GAUGE" || vt === "PIE") fam = "count-up";
    else if (["BAR", "LINE", "TREND"].includes(vt)) fam = "draw-in";
    else fam = i % 2 === 0 ? "pop-in" : "slide-in";
    if (i > 0 && fam === out[i - 1]) fam = ANIM_FAMILIES[(ANIM_FAMILIES.indexOf(fam) + 1) % ANIM_FAMILIES.length];
    out.push(fam);
  });
  return out;
}
export const ANIMATION_FAMILIES = ANIM_FAMILIES;
