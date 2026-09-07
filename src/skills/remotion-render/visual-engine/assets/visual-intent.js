/**
 * VISUAL INTENT — what a sentence needs to SHOW, not which words it contains.
 *
 * The old selector matched keywords against object names. Asked for a cave it
 * returned a legal document, because "cave" was not a name in the library and
 * the scorer settled for whatever scored least badly. A document standing in
 * for a cave is not a weak visual; with the audio off it says something untrue.
 *
 * This extracts the structure in section 4.2 — concept, literal subject, action,
 * relationship, context, required and forbidden features — so the matcher has
 * something to reject on, not just something to rank by.
 *
 * NO MODEL RUNS HERE. There is no vision or language key in this environment,
 * and a matcher that silently degrades when its model is missing is worse than
 * one that is honest about being lexical. This is grammar and a topic lexicon.
 * It is good enough to keep a cave from being a document, which is the failure
 * that mattered; it will not resolve fine distinctions, and `confidence` says
 * so on every result.
 */

/** Words that carry no visual content. */
const STOP = new Set(`a an the and or but of to in on at for with from by is are was were be been being
  it its this that these those as if then than so not no you your they them their he she his her we our us i
  do does did done have has had will would can could should may might must about into over under after before
  just only very more most much many some any all every each other another such same own here there when where
  how what which who whom whose why now then still yet also too even ever never always often
  next time remember exactly like called holds record found ever below world`.split(/\s+/));

/**
 * A topic lexicon. Each topic lists words that place a sentence in it. This is
 * what lets the matcher reject on `incompatibleTopics`: without knowing the
 * sentence's topic there is nothing to reject against.
 */
const TOPIC_WORDS = {
  geology: "cave caves cavern underground rock rocks mineral minerals strata bedrock sediment depth deep metres meters kilometre kilometer surface subterranean geology limestone",
  nature: "life animal animals creature creatures species wild natural nature habitat ecosystem survive surviving thriving",
  biology: "bacteria microbe microbial spider spiders leech leeches centipede centipedes springtail insect organism organisms eat eats feeding food chain genetic dna cell cells",
  chemistry: "chemistry chemical sulfur sulphur hydrogen sulfide oxygen gas gases molecule molecules compound reaction mineral",
  ocean: "ocean sea vents vent deep-sea marine underwater abyss hydrothermal",
  environment: "environment climate atmosphere air ecosystem sunlight energy",
  space: "space planet planets star stars galaxy orbit cosmic universe solar telescope spacecraft",
  history: "history historical century ancient era archive archival year 1986 past centuries million years",
  law: "law legal court statute clause rights constitutional attorney judge ruling",
  justice: "justice conviction exoneration prison sentence wrongful innocence appeal",
  crime: "fraud crime criminal heist scam stolen laundering investigation",
  forensics: "forensic dna evidence sample lab genealogy cold case identification",
  finance: "money debt budget savings interest payment income spending dollars cost price",
  business: "company companies market stock shares revenue profit failure corporate business",
  geopolitics: "border borders territory nation country sovereignty geopolitical region state",
  technology: "software model ai tool app interface benchmark latency computer digital",
  engineering: "engineering machine mechanism load stress design structure gear bolt blueprint",
  manufacturing: "factory production assembly conveyor robot component manufacturing industrial",
  medicine: "patient medical hospital diagnosis symptom treatment drug dose scan clinical disease",
  learning: "skill learn learning concept understand knowledge practice",
  careers: "career interview job employer resume workplace hiring",
  insurance: "medicare insurance coverage plan enrollment benefit premium",
};
const TOPIC_INDEX = Object.entries(TOPIC_WORDS).map(([t, w]) => [t, new Set(w.split(/\s+/))]);

/**
 * Features a visual MUST NOT have, by topic. This is the half of the spec that
 * does the real work: a cave sentence forbids office and paperwork imagery
 * outright, so the matcher cannot settle for a document however it scores.
 */
const FORBIDDEN_BY_TOPIC = {
  geology: ["document", "office", "screen", "chart"],
  nature: ["document", "office", "screen"],
  biology: ["document", "office", "chart"],
  ocean: ["document", "office", "screen"],
  chemistry: ["document", "office"],
  space: ["document", "office", "paperwork"],
};

const words = (t) => String(t || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Which topics this sentence is in, strongest first. */
export function topicsOf(text) {
  const w = words(text);
  const scores = TOPIC_INDEX.map(([t, set]) => [t, w.filter((x) => set.has(x)).length]);
  const hits = scores.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return hits.map(([t]) => t);
}

/**
 * Verbs and vague nouns that are never what a sentence is ABOUT.
 *
 * Measured: taking the first topic-lexicon word gave "eat" as the subject of
 * "they eat chemistry: bacteria turning minerals into food", and "life" as the
 * subject of "life is thriving" — which then matched a spider, because one of
 * that spider's concept phrases ends in the word life. A subject has to be a
 * thing.
 */
const NOT_SUBJECTS = new Set(`eat eats eating turning running run stand stands standing hold holds
  found find finding needing need survive surviving thriving thrive broke break breaks sealed seal
  called call name names life living world worlds thing things way ways place places time times
  part parts kind kinds lot lots one none all more most less least`.split(/\s+/));

/**
 * Candidate subjects, most promising first. The matcher tries several rather
 * than committing to one, because the best subject is the one that turns out to
 * name an asset.
 */
export function subjectCandidates(text) {
  const w = words(text).filter((x) => x.length > 2 && !STOP.has(x) && !NOT_SUBJECTS.has(x));
  const known = w.filter((x) => TOPIC_INDEX.some(([, s]) => s.has(x)));
  const rest = w.filter((x) => !known.includes(x)).sort((a, b) => b.length - a.length);
  return [...new Set([...known, ...rest])].slice(0, 5);
}

function literalSubject(text) {
  return subjectCandidates(text)[0] || "";
}

const ACTION_CUES = [
  ["descend", /\b(deep(er|est)?|down(ward)?|below|beneath|sink|fell|drop)\b/i],
  ["count", /\b(\d[\d,]*|percent|%|thirty|forty|fifty|hundred|thousand|million|billion)\b/i],
  ["connect", /\b(connect\w*|network|link\w*|between|together|web|chain)\b/i],
  ["grow", /\b(grow\w*|expand\w*|spread\w*|rise|rising|increas\w+|entire|everywhere)\b/i],
  ["vanish", /\b(disappear\w*|vanish\w*|gone|lost|extinct|nothing|never)\b/i],
  ["transform", /\b(becomes?|turn\w* into|convert\w*|eat\w*|feed\w* on)\b/i],
  ["seal", /\b(seal\w*|shut|closed|cut off|isolat\w*)\b/i],
  ["reveal", /\b(inside|within|hidden|reveal\w*|discover\w*|found)\b/i],
];

/**
 * @param {string} text a single sentence
 * @returns {object} the section 4.2 intent structure
 */
export function visualIntent(text) {
  const topics = topicsOf(text);
  const subject = literalSubject(text);
  const action = (ACTION_CUES.find(([, re]) => re.test(text)) || ["none"])[0];
  const content = words(text).filter((w) => w.length > 2 && !STOP.has(w));

  const forbidden = new Set();
  for (const t of topics.slice(0, 2)) for (const f of FORBIDDEN_BY_TOPIC[t] || []) forbidden.add(f);

  return {
    concept: content.slice(0, 4).join(" "),
    literalSubject: subject,
    action,
    relationship: /\b(no|not|without|never|none)\b/i.test(text) ? "absence" :
      /\b(because|so|therefore|means)\b/i.test(text) ? "cause" :
      /\b(than|versus|compared|unlike)\b/i.test(text) ? "comparison" : "none",
    context: topics[0] || "general",
    topics,
    requiredVisualFeatures: content.slice(0, 6),
    forbiddenVisualFeatures: [...forbidden],
    /**
     * Lexical, and it says so. With no language model reachable this is word
     * overlap over a hand-written lexicon; a sentence whose topic the lexicon
     * does not cover scores 0 here and the matcher will fall through to the
     * expansion loop rather than guess.
     */
    confidence: topics.length ? Math.min(1, 0.4 + topics.length * 0.2) : 0,
    method: "lexical",
  };
}
