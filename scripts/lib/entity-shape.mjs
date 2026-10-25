/**
 * Is a "named entity" actually a SPECIFIC NAMED THING? (owner, 2026-10-10)
 *
 * The planner lists "everything the sentence names that the scene shows" and the gate before it only asked whether the words appear in the
 * sentence. So "Indian" (a nationality, typed as a place) and "federal jury" (a generic body, typed as an institution) became entities, entered
 * the denominator of every coverage count, and were drawn as name cards. An entity must be one of:
 *   a person with a name · a specific place · a named organisation / institution · a named object · a stated figure (type "number")
 * and must NOT be
 *   a nationality or adjective ("Indian", "American")  ·  a generic role or body ("federal jury", "prosecutors", "officials")
 *   ·  a common-noun phrase that is lower-case in the sentence ("the police station")  ·  an abstract noun as an "object" ("inflation")
 *
 * Pure: the name, its type and the sentence. It only REJECTS; it never renames or adds. A rejected entity is not hidden, it is not an entity.
 *
 * Where this stops: the word lists are lists. A demonym or a generic noun that is not in them gets through, and a proper noun the sentence
 * writes in lower case ("nasa") is refused. The first is a missed rejection (the old behaviour), the second is the safe direction (type, not a
 * wrong image).
 */
import { ABSTRACT } from "../../src/skills/remotion-render/visual/concept-visuals.js";

export const DEMONYMS = new Set(`afghan african albanian algerian american andean arab arabian argentine argentinian armenian asian australian austrian azerbaijani
bangladeshi belarusian belgian bolivian bosnian brazilian british bulgarian burmese cambodian canadian chilean chinese colombian congolese croatian cuban cypriot czech
danish dutch ecuadorian egyptian emirati english eritrean estonian ethiopian european filipino finnish french georgian german ghanaian greek guatemalan haitian hungarian
icelandic indian indonesian iranian iraqi irish israeli italian ivorian jamaican japanese jordanian kazakh kenyan korean kosovar kurdish kuwaiti latvian lebanese libyan
lithuanian malaysian mexican moldovan mongolian moroccan nepali nepalese nigerian norwegian omani pakistani palestinian panamanian peruvian polish portuguese qatari romanian
russian rwandan saudi scottish senegalese serbian singaporean slovak slovenian somali spanish sudanese swedish swiss syrian taiwanese tanzanian thai tunisian turkish ugandan
ukrainian uruguayan uzbek venezuelan vietnamese welsh yemeni zambian zimbabwean western eastern northern southern midwestern`.split(/\s+/));

// A generic body or role: nobody in particular.
export const GENERIC = new Set(`jury juries juror jurors prosecutor prosecutors police policeman policemen officer officers official officials lawmaker lawmakers legislator legislators
regulator regulators authority authorities government governments agency agencies investigator investigators detective detectives judge judges court courts lawyer lawyers attorney
attorneys critic critics expert experts analyst analysts economist economists scientist scientists researcher researchers resident residents voter voters worker workers employee
employees customer customers consumer consumers investor investors shareholder shareholders executive executives manager managers leader leaders politician politicians
citizen citizens protester protesters activist activists journalist journalists reporter reporters witness witnesses suspect suspects victim victims defendant defendants
plaintiff plaintiffs company companies business businesses bank banks firm firms organization organizations organisation organisations institution institutions group groups
team teams staff public people man men woman women person persons family families child children student students teacher teachers doctor doctors patient patients
committee committees council councils board boards panel panels union unions party parties`.split(/\s+/));

// Words that only modify a generic body: "federal jury", "local officials", "state regulators".
const MODIFIERS = new Set(`federal state local national regional international foreign domestic county district city municipal public private civil criminal grand senior former current
several many some most other various major minor top high low big small new old`.split(/\s+/));

const toks = (s) => String(s || "").split(/[^A-Za-z0-9'’]+/).filter(Boolean);
const low = (w) => w.toLowerCase().replace(/['’]s$/, "");
const stem = (w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

/** Does the name occur in the sentence with a capital letter somewhere other than as the sentence's first word (or as an ALL-CAPS acronym)? */
function writtenAsProperNoun(name, sentence) {
  const sent = toks(sentence);
  const want = toks(name).map((w) => stem(low(w)));
  for (const [i, t] of sent.entries()) {
    if (!want.includes(stem(low(t)))) continue;
    if (/^[A-Z]/.test(t) && (i > 0 || /^[A-Z0-9]{2,}$/.test(t))) return true;
  }
  // The sentence's first word, capitalised, that is itself a name word and not a generic / demonym one ("Netflix announced...").
  if (sent.length && want.includes(stem(low(sent[0]))) && /^[A-Z]/.test(sent[0]) && !GENERIC.has(low(sent[0])) && !DEMONYMS.has(low(sent[0]))) return true;
  return false;
}

/** Two or more name words written back to back, each with a capital ("Union Bank", "Supreme Court"): a title-cased name, whatever its words are. */
function titleCasedRun(name, sentence) {
  const want = toks(name).map((w) => stem(low(w)));
  if (want.length < 2) return false;
  const sent = toks(sentence);
  for (let i = 0; i + want.length <= sent.length; i++) {
    if (want.every((w, k) => stem(low(sent[i + k])) === w && /^[A-Z]/.test(sent[i + k]))) return true;
  }
  return false;
}

/** { ok: true } or { ok: false, why }. `type` is the entity's type as the planner wrote it; numbers and dates are figures, not things to be named. */
export function entityShape(name, type, sentence) {
  const t = String(type || "").toLowerCase();
  const words = toks(name).map(low);
  if (!words.length) return { ok: false, why: "empty" };
  if (t === "number") return { ok: true };
  if (words.every((w) => DEMONYMS.has(w))) return { ok: false, why: "a nationality or adjective, not a thing that can be named" };
  if (words.every((w) => GENERIC.has(w) || MODIFIERS.has(w) || ["the", "a", "an", "of", "and"].includes(w)) && !titleCasedRun(name, sentence)) return { ok: false, why: "a generic role or body, nobody in particular" };
  if (t === "object") {
    if (words.some((w) => ABSTRACT.has(w) || ABSTRACT.has(stem(w)))) return { ok: false, why: "an abstract noun, not a physical object" };
    return { ok: true };
  }
  if (!writtenAsProperNoun(name, sentence)) return { ok: false, why: "a common-noun phrase: the sentence does not write it as a name" };
  return { ok: true };
}
