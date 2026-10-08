/**
 * Deterministic grounding for the composition vocabulary (typography
 * rebuild, Task 6). Each extractor reads ONE sentence and returns the data a
 * composition draws — or null when the sentence does not state it. Every
 * character returned is a slice of the sentence, so nothing on screen is a
 * paraphrase and the "every claim traces to a source" rule holds by
 * construction (CLAUDE.md hard rules):
 *
 *   listItemsOf      LIST-BUILD       "basic, standard and premium" -> items
 *   timelineOf       TIMELINE         2+ dated events, each with its label
 *   compareOf        COMPARISON-SPLIT "42% vs 31%", "from 2% to 4.5%", "3x more than"
 *   documentNameOf   DOCUMENT         a named legal instrument or case
 *   moneyObjectOf    MONEY            a literal money object (cash, coins, a receipt)
 *
 * The planner (gemini-visual-plan.js) uses them twice: as the gate a
 * model-proposed LIST / TIMELINE / COMPARE / DOCUMENT / MONEY beat must pass,
 * and as the constructors the no-repeat rotation reaches for when two beats in
 * a row would share a composition (composition-rotation.js).
 *
 * Where this stops: these are pattern readers, not a parser. A list hidden in
 * a subordinate clause, a date written "the spring of 2019", or a comparison
 * phrased with no keyword is not found — the beat stays typography. That is the
 * safe direction: a missed pattern costs variety, never truth.
 */

// Words a label / item does not start with (conjunctions, prepositions) and
// does not end with (those, plus articles and auxiliaries: "the law was").
const LEAD_STOP = new Set(["and", "or", "but", "then", "so", "while", "whereas", "which", "that", "who", "when", "as", "because", "though", "although", "of", "to", "in", "on", "at", "by", "for", "with", "from"]);
const TAIL_STOP = new Set([...LEAD_STOP, "the", "a", "an", "is", "was", "were", "are", "be", "been", "has", "have", "had", "will", "would", "can", "could"]);
const SUBJECT = /^(?:he|she|they|it|we|you|i|there|this|these|those|who)$/i;
const words = (s) => String(s || "").split(/\s+/).filter(Boolean);
const clean = (w) => w.replace(/^[^\p{L}\p{N}$%]+|[^\p{L}\p{N}$%]+$/gu, "");
const trimEdges = (ws, { lead = true, tail = true } = {}) => {
  let a = 0, b = ws.length;
  while (lead && a < b && LEAD_STOP.has(clean(ws[a]).toLowerCase())) a++;
  while (tail && b > a && TAIL_STOP.has(clean(ws[b - 1]).toLowerCase())) b--;
  return ws.slice(a, b);
};

// ── LIST ──────────────────────────────────────────────────────────────
/**
 * An enumeration of 3-5 short items ("X, Y, and Z"): every item 1-3 words and
 * a slice of the sentence. { lead, items } — `lead` is the words before the
 * first item ("The three tiers are"), or "" when the list opens the sentence.
 * A run of clauses ("he ran, she walked, they left") is not a list: its items
 * are longer than 3 words.
 */
export function listItemsOf(sentence) {
  const text = String(sentence || "").replace(/[.!?]+$/, "").trim();
  if (!text) return null;
  const parts = text.split(/\s*[,;]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  // "X, Y and Z": split the last part on its own "and" / "or" when both sides are short.
  const last = parts[parts.length - 1].replace(/^(?:and|or|&)\s+/i, "");
  const tailSplit = last.match(/^(.+?)\s+(?:and|or|&)\s+(.+)$/i);
  const items = [];
  const raw = parts.slice(0, -1);
  if (tailSplit && words(tailSplit[1]).length <= 3 && words(tailSplit[2]).length <= 3) raw.push(tailSplit[1], tailSplit[2]);
  else raw.push(last);
  if (raw.length < 3) return null;
  // The first part carries the lead-in: keep its last 1-3 words as the item.
  const first = words(raw[0]);
  let lead = "";
  let firstItem = first;
  if (first.length > 3) {
    // Break after a linking word ("are", "include", "including", "such as", ":"), else take the last two words.
    const at = first.findIndex((w, i) => i < first.length - 1 && /^(?:are|is|include[sd]?|including|includes|namely|like|as|of|between|among|from|for|with|by)$/i.test(clean(w)));
    const cut = at >= 0 ? at + 1 : first.length - 2;
    lead = first.slice(0, cut).join(" ");
    firstItem = first.slice(cut);
  }
  const all = [firstItem.join(" "), ...raw.slice(1)].map((s) => trimEdges(words(s)).join(" ")).filter(Boolean);
  if (all.length < 3 || all.length > 5) return null;
  if (all.some((it) => words(it).length > 3 || words(it).length < 1)) return null;
  // A run of clauses ("she walked home, they stayed inside") is not a list.
  if (all.slice(1).some((it) => SUBJECT.test(clean(words(it)[0])))) return null;
  if (new Set(all.map((s) => s.toLowerCase())).size !== all.length) return null;
  // Every item must be text of the sentence.
  const low = text.toLowerCase();
  if (!all.every((it) => low.includes(it.toLowerCase()))) return null;
  return { lead: lead.trim(), items: all };
}

// ── TIMELINE ──────────────────────────────────────────────────────────
const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const DATE_RE = new RegExp(`\\b(?:${MONTH}\\.?\\s+(?:\\d{1,2}(?:st|nd|rd|th)?,?\\s+)?(?:19|20)\\d{2}|(?:19|20)\\d{2})\\b`, "g");
const PREP = /^(?:in|on|by|since|until|from|during|after|before|at|as|of|through|till)$/i;
/**
 * 2-4 dated events, in the order the sentence gives them: [{ date, label }].
 * `date` is the date as written ("2019", "March 2024"); `label` 1-4 words of
 * the sentence next to it. "The law passed in 2019 and was repealed in 2024"
 * -> 2019 "The law passed", 2024 "was repealed".
 */
export function timelineOf(sentence) {
  const text = String(sentence || "").replace(/\s+/g, " ").trim();
  const hits = [...text.matchAll(DATE_RE)].map((m) => ({ date: m[0], start: m.index, end: m.index + m[0].length }));
  const uniq = [];
  for (const h of hits) if (!uniq.some((u) => u.date.toLowerCase() === h.date.toLowerCase())) uniq.push(h);
  if (uniq.length < 2 || uniq.length > 4) return null;
  const out = [];
  for (let k = 0; k < uniq.length; k++) {
    const h = uniq[k];
    const prevEnd = k ? uniq[k - 1].end : 0;
    const nextStart = k + 1 < uniq.length ? uniq[k + 1].start : text.length;
    // Words before the date, back to the previous date / clause boundary.
    const beforeRaw = text.slice(prevEnd, h.start);
    const before = words(beforeRaw.split(/[,;:.]/).pop() || "");
    let label = [], fromBefore = false;
    if (before.length && PREP.test(clean(before[before.length - 1]))) {
      // "... passed in 2019": the words before the preposition describe the date.
      label = trimEdges(before.slice(0, -1));
      fromBefore = label.length > 0;
    }
    if (!label.length) {
      const after = words((text.slice(h.end, nextStart).split(/[.;]/)[0] || "").replace(/^\s*[,:]\s*/, ""));
      label = trimEdges(after.slice(0, 8));
    }
    if (label.length > 4) label = fromBefore ? label.slice(-4) : label.slice(0, 4);
    const lab = label.map(clean).filter(Boolean).join(" ").trim();
    if (!lab) return null;
    out.push({ date: h.date, label: lab });
  }
  const low = text.toLowerCase();
  if (!out.every((o) => low.includes(o.date.toLowerCase()) && low.includes(o.label.toLowerCase()))) return null;
  return out;
}

// ── COMPARE ───────────────────────────────────────────────────────────
const QTY = String.raw`[$€£]?\s?\d[\d,]*(?:\.\d+)?\s?(?:%|percent\b|thousand\b|million\b|billion\b|trillion\b|[kKmMbB]\b|x\b|times\b)?`;
const QTY_RE = new RegExp(QTY, "g");
const REL = /\b(vs\.?|versus|compared (?:to|with)|as opposed to|rather than|whereas|than|from)\b/i;
/**
 * Two figures the sentence sets against each other: { a, b, relation } with
 * a / b = { value, label }, `value` as written and `label` up to 3 words of
 * the sentence beside it (or null: "rose from 3% to 5%" labels neither).
 * relation: "vs" (vs / versus / compared to / whereas), "than", "from-to".
 */
export function compareOf(sentence) {
  const text = String(sentence || "").replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  const qs = [...text.matchAll(QTY_RE)].map((m) => ({ v: m[0].trim(), start: m.index, end: m.index + m[0].length })).filter((q) => /\d/.test(q.v));
  if (qs.length < 2) return null;
  const isYear = (v) => /^(?:19|20)\d{2}$/.test(v);
  const figs = qs.filter((q) => !isYear(q.v));
  if (figs.length < 2) return null;
  const mk = (q, side, gapStart, gapEnd) => {
    // label: words after the figure up to the next boundary, else words before it
    const after = words((text.slice(q.end, gapEnd) + " ").split(/[,;]| vs\.? | versus | compared | than | whereas | to | and | but /i)[0] || "");
    let lab = trimEdges(after).slice(0, 3);
    if (!lab.length) {
      const before = words(text.slice(gapStart, q.start).split(/[,;]/).pop() || "");
      lab = trimEdges(before).slice(-3);
    }
    const label = lab.map(clean).filter(Boolean).join(" ").trim() || null;
    return { value: q.v, label: label && !/^\d/.test(label) ? label : null };
  };
  const a = figs[0], b = figs[1];
  const between = text.slice(a.end, b.start);
  let relation = null;
  if (/\b(vs\.?|versus|compared (?:to|with)|as opposed to|whereas)\b/i.test(between)) relation = "vs";
  else if (/\bthan\b/i.test(between)) relation = "than";
  else if (/\bfrom\b/i.test(text.slice(0, b.start)) && /\bto\b/i.test(between) && /\bfrom\b/i.test(text.slice(Math.max(0, a.start - 12), a.start))) relation = "from-to";
  else if (/\bfrom\b/i.test(text.slice(0, a.start)) && /\bto\b/i.test(between)) relation = "from-to";
  if (!relation || a.v.replace(/\s/g, "") === b.v.replace(/\s/g, "")) return null;
  const A = relation === "from-to" ? { value: a.v, label: null } : mk(a, "a", 0, b.start);
  const B = relation === "from-to" ? { value: b.v, label: null } : mk(b, "b", a.end, text.length);
  // Shared subject of a from-to change: the words before "rose / fell / grew ..." (max 3), else none.
  let subject = null;
  if (relation === "from-to") {
    const pre = words(text.slice(0, a.start).split(/[,;]/).pop() || "");
    const cut = pre.findIndex((w) => /^(?:rose|fell|grew|dropped|climbed|jumped|increased|decreased|rises|falls|grows|went|moved|shifted|up|down)$/i.test(clean(w)));
    const subjWords = trimEdges(cut > 0 ? pre.slice(0, cut) : []).slice(-3);
    subject = subjWords.map(clean).filter(Boolean).join(" ") || null;
  }
  return { a: A, b: B, relation, subject };
}

// ── DOCUMENT ──────────────────────────────────────────────────────────
const DOC_WORD = "(?:Act|Amendment|Constitution|Treaty|Declaration|Convention|Agreement|Accord|Charter|Code|Statute|Ordinance|Protocol|Resolution|Order|Ruling|Decision|Opinion|Judgment|Indictment|Complaint|Settlement|Contract|Memorandum|Executive Order)";
const DOC_NAME = new RegExp(`\\b((?:[A-Z][\\w'’.-]*(?:\\s+(?:of|the|and|on|for)\\s+)?\\s*){1,5}${DOC_WORD}(?:\\s+of\\s+(?:19|20)\\d{2}|\\s+(?:19|20)\\d{2})?)\\b`);
const CASE_NAME = /\b([A-Z][\w'’.-]+ v\. [A-Z][\w'’.-]+)\b/;
/** A named legal instrument or case ("Dodd-Frank Act", "Fourteenth Amendment", "Miranda v. Arizona"), or null. */
export function documentNameOf(sentence) {
  const text = String(sentence || "");
  const c = text.match(CASE_NAME);
  if (c) return c[1];
  const m = text.match(DOC_NAME);
  if (!m) return null;
  // A bare "Act" / "The Order" is not a name: it needs a proper-noun modifier that is not the sentence's first word alone.
  const name = m[1].replace(/^(?:The|A|An|This|That)\s+/, "").trim();
  return name.split(/\s+/).length >= 2 ? name : null;
}

// ── MONEY ─────────────────────────────────────────────────────────────
const MONEY_OBJECTS = [
  [/\b(?:bank statements?)\b/i, "bank statement"],
  [/\b(?:receipts?)\b/i, "receipt"],
  [/\b(?:cheques?|checks?)\b(?!\s+(?:the|on|whether|that))/i, "cheque"],
  [/\b(?:coins?)\b/i, "coins"],
  [/\b(?:banknotes?|dollar bills?|bills)\b/i, "banknotes"],
  [/\b(?:cash|currency)\b/i, "banknotes cash"],
  // An AMOUNT in a currency ("seven million dollars", "$7", "€40") is not a
  // physical money object: it no longer grounds a banknote photo (a figure
  // draws it). Beat-check calls a banknote for an amount a topic-level stock
  // object — CI run 37795613343: ch-49 beats 4 and 6 ("seven million dollars"
  // box office) and ch-1 beat 6 ("every dollar of debt") all failed on it.
];
/** The literal money object a sentence names, as a photo query, or null. */
export function moneyObjectOf(sentence) {
  const t = String(sentence || "");
  for (const [re, q] of MONEY_OBJECTS) if (re.test(t)) return q;
  return null;
}

// ── PROCESS (cause -> effect) ─────────────────────────────────────────
const FLOW_FUNCTION = new Set(["a", "an", "the", "of", "to", "for", "in", "on", "at", "by", "and", "or", "but", "so", "as", "is", "are",
  "was", "were", "be", "been", "it", "its", "this", "that", "these", "those", "how", "what", "why", "with", "from", "into", "over",
  "than", "then", "they", "we", "you", "our", "their", "your", "i", "he", "she", "his", "her", "them", "us", "who", "which", "will",
  "can", "not", "no", "just", "now", "all", "more", "most"]);
// Words that state a flow: cause -> effect, a result, a sequence.
export const FLOW_WORDS = /\b(caus(e|es|ed|ing)|lead(s|ing)? to|led to|result(s|ed|ing)? in|so that|therefore|because|drives?|drove|trigger(s|ed)?|raises?|raised|cuts?|reduc(e|es|ed)|increas(e|es|ed)|boosts?|pushe[sd]?|forces?|forced|turns? into|becomes?|then|after|before|until|followed by|builds? (?:on|upon)|built (?:on|upon)|feeds?|fuels?|sparks?|prompt(s|ed)?|means?|which (makes|leads|raises|cuts))\b|->|→/i;

// The two sides of a flow the sentence STATES, as PROCESS nodes built only
// from its own words: the content-word run just before the flow word (the
// cause) and the first one after it (the effect), 1-3 words each.
// "Failure to do so can lead to legal repercussions" -> ["Failure", "legal
// repercussions"]; "X happened because Y" -> [Y, X]. Runs 36504143080 ..
// 36509937804: the model's PROCESS nodes were paraphrases ("markets",
// "raw data", "self-defense claim") the gate rightly refused, and the beat
// fell back to typography although the sentence stated its flow. Returns
// null when either side has no content word — nothing is invented.
const FLOW_AUX = new Set(["can", "could", "will", "would", "may", "might", "must", "should", "shall", "do", "does", "did", "has", "have",
  "had", "is", "are", "was", "were", "be", "been", "being", "also", "often", "directly", "ultimately", "eventually", "quickly", "not", "only",
  "which", "that", "this", "these", "those", "it", "they", "so", "such", "very", "even", "still", "already", "actually", "really", "one"]);
export function flowNodes(sentence) {
  const text = String(sentence || "");
  // Every flow word in the sentence, first to last; the first that has a
  // content word on both sides wins.
  const all = new RegExp(FLOW_WORDS.source, "gi");
  for (const m of text.matchAll(all)) {
    const n = flowAt(text, m);
    if (n) return n;
  }
  return null;
}
function flowAt(text, m) {
  const before = text.slice(0, m.index), after = text.slice(m.index + m[0].length);
  const toks = (s) => s.split(/[^A-Za-z0-9'$%-]+/).filter(Boolean);
  const stop = (w) => FLOW_FUNCTION.has(w) || FLOW_AUX.has(w) || /^(when|while|if|about|up|out|down|off|each|every|some|any|there|here|across|through|among|between|within|without|during|against|under|toward|towards|per|via|like|around|behind|beyond|after|before|since|until|onto|upon|while|where|whose|whom)$/.test(w);
  const ok = (w) => !stop(w.toLowerCase()) && /[A-Za-z]{3,}|\d/.test(w);
  const firstRun = (ws) => {
    const out = [];
    for (const w of ws) { if (ok(w)) { out.push(w); if (out.length === 3) break; } else if (out.length) break; }
    return out;
  };
  const lastRun = (ws) => firstRun([...ws].reverse()).reverse();
  // Clause edges: only the clause around the flow word counts.
  const left = lastRun(toks(before.split(/[,;:.!?]/).pop() || ""));
  const right = firstRun(toks((after.split(/[,;:.!?]/)[0]) || ""));
  if (!left.length || !right.length) return null;
  let nodes = [left.join(" "), right.join(" ")];
  if (/^(because|after)$/i.test(m[0].trim())) nodes = nodes.reverse();
  if (nodes[0].toLowerCase() === nodes[1].toLowerCase()) return null;
  return nodes;
}


// ── shared readers for the rotation's alternatives ────────────────────
import { resolveRegion } from "../src/skills/remotion-render/visual/geo-regions.js";
/** Places the sentence names that have a border in the Natural Earth data (1-3 word capitalised spans). */
export function knownPlacesOf(sentence) {
  const ws = String(sentence || "").split(/[^A-Za-z.'-]+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < ws.length; i++) for (let k = 3; k >= 1; k--) {
    const span = ws.slice(i, i + k).join(" ").replace(/[.]$/, "");
    if (k <= ws.length - i && /^[A-Z]/.test(span) && resolveRegion(span) && !out.includes(span)) out.push(span);
  }
  return out;
}
/** Percentages the sentence STATES ("40%", "40 percent"), as numbers. */
export function statedPercentsOf(sentence) {
  return ((String(sentence || "").match(/(\d[\d,]*(?:\.\d+)?)\s*(?:%|percent\b)/gi)) || []).map((m) => Number(m.replace(/[^\d.]/g, ""))).filter((n) => n > 0 && n <= 100);
}
/**
 * Quantities the sentence states, in order: { value, label } with `value` as
 * written (currency sign and scale included) and `label` up to 4 words of the
 * sentence next to it. Years are included (a year is drawn as a snapped hero
 * number); an identifier ("Article 10", "Section 357-A") is not a quantity.
 */
export function quantitiesOf(sentence) {
  const text = String(sentence || "").replace(/\s+/g, " ").trim();
  const re = new RegExp(QTY, "g");
  const out = [];
  for (const m of text.matchAll(re)) {
    const v = m[0].trim();
    if (!/\d/.test(v)) continue;
    const before = text.slice(0, m.index).trimEnd();
    if (ID_BEFORE.test(before)) continue;                           // Article 10, Section 357-A, Phase 2
    if (/^\d+[-\u2013]?[A-Za-z]{1,2}\b/.test(text.slice(m.index))) continue;
    const after = words(text.slice(m.index + m[0].length).split(/[,;.]/)[0] || "");
    let lab = trimEdges(after).slice(0, 4);
    if (!lab.length) lab = trimEdges(words(before.split(/[,;.]/).pop() || "")).slice(-4);
    out.push({ value: v, label: lab.map(clean).filter(Boolean).join(" ") || null });
  }
  return out;
}
const ID_BEFORE = /\b(?:article|articles|section|sections|sec\.?|rule|rules|chapter|clause|title|amendment|resolution|regulation|order|act|bill|case|docket|no\.?|number|part|schedule|phase|stage|level|tier|form|flight|route|highway|model|version|paragraph|item|exhibit|appendix|annex)\s*$/i;
